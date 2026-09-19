package com.foodcal.app.data.sensor

import android.Manifest
import android.content.Context
import android.content.SharedPreferences
import android.content.pm.PackageManager
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Build
import android.util.Log
import androidx.core.content.ContextCompat
import com.foodcal.app.data.model.StepLogEntry
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.SetOptions
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import java.time.LocalDate

class StepTrackerManager(
    private val context: Context,
    private val firestore: FirebaseFirestore,
    private val auth: FirebaseAuth
) : SensorEventListener {

    private val tag = "StepTrackerManager"
    private val prefs: SharedPreferences = context.getSharedPreferences("foodcal_steps_prefs", Context.MODE_PRIVATE)
    private val sensorManager = context.getSystemService(Context.SENSOR_SERVICE) as? SensorManager
    private val stepCounterSensor: Sensor? = sensorManager?.getDefaultSensor(Sensor.TYPE_STEP_COUNTER)
    private val stepDetectorSensor: Sensor? = sensorManager?.getDefaultSensor(Sensor.TYPE_STEP_DETECTOR)
    private val accelerometerSensor: Sensor? = sensorManager?.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    private val keyDate = "step_date"
    private val keyBaseline = "step_baseline"
    private val keyLastSensorVal = "step_last_sensor_val"
    private val keyTodaySteps = "step_today_steps"
    private val keyTargetSteps = "step_target_steps"

    private var lastAccelMagnitude = 0f
    private var lastStepTimeMillis = 0L
    private var hasReceivedHardwareStepCounterEvent = false

    private val _stepLog = MutableStateFlow(loadInitialStepLog())
    val stepLog: StateFlow<StepLogEntry> = _stepLog.asStateFlow()

    init {
        registerSensorListener()
    }

    private fun todayDate(): String = LocalDate.now().toString()

    private fun loadInitialStepLog(): StepLogEntry {
        val today = todayDate()
        val storedDate = prefs.getString(keyDate, "") ?: ""
        val target = prefs.getInt(keyTargetSteps, 10000)

        val steps = if (storedDate == today) {
            prefs.getInt(keyTodaySteps, 0)
        } else {
            0
        }

        val distanceKm = calculateDistanceKm(steps)
        val calories = calculateCalories(steps)

        return StepLogEntry(
            date = today,
            steps = steps,
            targetSteps = target,
            distanceKm = distanceKm,
            caloriesBurned = calories,
            lastSyncedMillis = System.currentTimeMillis(),
            source = "sensor"
        )
    }

    fun hasActivityRecognitionPermission(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.ACTIVITY_RECOGNITION
            ) == PackageManager.PERMISSION_GRANTED
        } else {
            true
        }
    }

    fun getSensorTypeDescription(): String {
        return when {
            hasReceivedHardwareStepCounterEvent -> "Hardware Step Counter"
            stepCounterSensor != null -> "Hardware Step Counter"
            stepDetectorSensor != null -> "Step Detector"
            accelerometerSensor != null -> "Motion Accelerometer"
            else -> "Manual Tracking"
        }
    }

    fun registerSensorListener() {
        sensorManager?.let { sm ->
            stepCounterSensor?.let { sensor ->
                sm.registerListener(this, sensor, SensorManager.SENSOR_DELAY_UI)
                Log.d(tag, "Registered TYPE_STEP_COUNTER listener")
            }
            stepDetectorSensor?.let { sensor ->
                sm.registerListener(this, sensor, SensorManager.SENSOR_DELAY_UI)
                Log.d(tag, "Registered TYPE_STEP_DETECTOR listener")
            }
            // Accelerometer fallback (works on 100% of devices)
            accelerometerSensor?.let { sensor ->
                sm.registerListener(this, sensor, SensorManager.SENSOR_DELAY_GAME)
                Log.d(tag, "Registered TYPE_ACCELEROMETER listener")
            }
        }
    }

    fun unregisterSensorListener() {
        sensorManager?.unregisterListener(this)
    }

    override fun onSensorChanged(event: SensorEvent?) {
        if (event == null) return

        when (event.sensor.type) {
            Sensor.TYPE_STEP_COUNTER -> {
                hasReceivedHardwareStepCounterEvent = true
                val rawSteps = event.values.firstOrNull()?.toInt() ?: return
                handleStepCounterReading(rawSteps)
            }
            Sensor.TYPE_STEP_DETECTOR -> {
                if (event.values.firstOrNull() == 1.0f) {
                    incrementStepCount(1)
                }
            }
            Sensor.TYPE_ACCELEROMETER -> {
                // If hardware step counter is delivering readings, skip accelerometer to prevent double counting
                if (hasReceivedHardwareStepCounterEvent) return

                val x = event.values[0]
                val y = event.values[1]
                val z = event.values[2]
                val mag = kotlin.math.sqrt((x * x + y * y + z * z).toDouble()).toFloat()
                val now = System.currentTimeMillis()
                // Step peak detection: threshold 11.6 m/s^2 (gravity 9.8 + dynamic acceleration)
                if (mag > 11.6f && lastAccelMagnitude <= 11.6f && (now - lastStepTimeMillis > 280L)) {
                    lastStepTimeMillis = now
                    incrementStepCount(1)
                }
                lastAccelMagnitude = mag
            }
        }
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}

    private fun handleStepCounterReading(rawSensorSteps: Int) {
        val today = todayDate()
        val storedDate = prefs.getString(keyDate, "") ?: ""
        var baseline = prefs.getInt(keyBaseline, -1)
        val target = prefs.getInt(keyTargetSteps, 10000)

        // New day rollover
        if (storedDate != today) {
            baseline = rawSensorSteps
            prefs.edit()
                .putString(keyDate, today)
                .putInt(keyBaseline, baseline)
                .putInt(keyLastSensorVal, rawSensorSteps)
                .putInt(keyTodaySteps, 0)
                .apply()
        } else if (baseline < 0 || rawSensorSteps < baseline) {
            // First time running or phone rebooted since baseline was recorded
            val currentSteps = prefs.getInt(keyTodaySteps, 0)
            baseline = (rawSensorSteps - currentSteps).coerceAtLeast(0)
            prefs.edit()
                .putString(keyDate, today)
                .putInt(keyBaseline, baseline)
                .putInt(keyLastSensorVal, rawSensorSteps)
                .apply()
        }

        val calculatedTodaySteps = (rawSensorSteps - baseline).coerceAtLeast(0)
        prefs.edit()
            .putInt(keyTodaySteps, calculatedTodaySteps)
            .putInt(keyLastSensorVal, rawSensorSteps)
            .apply()

        val distanceKm = calculateDistanceKm(calculatedTodaySteps)
        val calories = calculateCalories(calculatedTodaySteps)

        val updated = StepLogEntry(
            date = today,
            steps = calculatedTodaySteps,
            targetSteps = target,
            distanceKm = distanceKm,
            caloriesBurned = calories,
            lastSyncedMillis = System.currentTimeMillis(),
            source = "sensor"
        )
        _stepLog.value = updated

        // Sync to cloud
        syncStepEntryToFirestore(updated)
    }

    fun incrementStepCount(delta: Int) {
        val today = todayDate()
        val storedDate = prefs.getString(keyDate, "") ?: ""
        val target = prefs.getInt(keyTargetSteps, 10000)

        val currentSteps = if (storedDate == today) prefs.getInt(keyTodaySteps, 0) else 0
        val newSteps = currentSteps + delta

        prefs.edit()
            .putString(keyDate, today)
            .putInt(keyTodaySteps, newSteps)
            .apply()

        val distanceKm = calculateDistanceKm(newSteps)
        val calories = calculateCalories(newSteps)

        val updated = StepLogEntry(
            date = today,
            steps = newSteps,
            targetSteps = target,
            distanceKm = distanceKm,
            caloriesBurned = calories,
            lastSyncedMillis = System.currentTimeMillis(),
            source = "sensor"
        )
        _stepLog.value = updated
        syncStepEntryToFirestore(updated)
    }

    /**
     * Called whenever the user opens the app or returns to foreground.
     * Re-registers sensor and syncs with cloud Firestore.
     */
    fun syncStepsOnAppOpen() {
        registerSensorListener()
        val today = todayDate()
        val storedDate = prefs.getString(keyDate, "") ?: ""
        val target = prefs.getInt(keyTargetSteps, 10000)

        val steps = if (storedDate == today) {
            prefs.getInt(keyTodaySteps, 0)
        } else {
            0
        }

        val distanceKm = calculateDistanceKm(steps)
        val calories = calculateCalories(steps)

        val currentEntry = StepLogEntry(
            date = today,
            steps = steps,
            targetSteps = target,
            distanceKm = distanceKm,
            caloriesBurned = calories,
            lastSyncedMillis = System.currentTimeMillis(),
            source = "sensor"
        )
        _stepLog.value = currentEntry

        scope.launch {
            // First push current local steps
            syncStepEntryToFirestore(currentEntry)

            // Also check if remote Firestore has higher step count (e.g. from another sync or earlier today)
            val uid = auth.currentUser?.uid ?: return@launch
            runCatching {
                val doc = firestore.collection("users").document(uid)
                    .collection("stepLogs").document(today).get().await()

                if (doc.exists()) {
                    val remoteSteps = (doc.getLong("steps") ?: 0L).toInt()
                    val remoteTarget = (doc.getLong("targetSteps") ?: 10000L).toInt()
                    if (remoteSteps > steps) {
                        prefs.edit()
                            .putString(keyDate, today)
                            .putInt(keyTodaySteps, remoteSteps)
                            .putInt(keyTargetSteps, remoteTarget)
                            .apply()

                        _stepLog.value = StepLogEntry(
                            date = today,
                            steps = remoteSteps,
                            targetSteps = remoteTarget,
                            distanceKm = calculateDistanceKm(remoteSteps),
                            caloriesBurned = calculateCalories(remoteSteps),
                            lastSyncedMillis = System.currentTimeMillis(),
                            source = "cloud_sync"
                        )
                    }
                }
            }
        }
    }

    fun setTodaySteps(count: Int) {
        val today = todayDate()
        val target = prefs.getInt(keyTargetSteps, 10000)
        val nonNegative = count.coerceAtLeast(0)
        val lastSensor = prefs.getInt(keyLastSensorVal, -1)

        // Recalibrate baseline so future hardware sensor events continue smoothly
        if (lastSensor > 0) {
            val newBaseline = (lastSensor - nonNegative).coerceAtLeast(0)
            prefs.edit().putInt(keyBaseline, newBaseline).apply()
        }

        prefs.edit()
            .putString(keyDate, today)
            .putInt(keyTodaySteps, nonNegative)
            .apply()

        val distanceKm = calculateDistanceKm(nonNegative)
        val calories = calculateCalories(nonNegative)

        val updated = StepLogEntry(
            date = today,
            steps = nonNegative,
            targetSteps = target,
            distanceKm = distanceKm,
            caloriesBurned = calories,
            lastSyncedMillis = System.currentTimeMillis(),
            source = "manual"
        )
        _stepLog.value = updated
        syncStepEntryToFirestore(updated)
    }

    fun addManualSteps(count: Int) {
        incrementStepCount(count)
    }

    fun setTargetSteps(target: Int) {
        prefs.edit().putInt(keyTargetSteps, target).apply()
        _stepLog.value = _stepLog.value.copy(targetSteps = target)
        syncStepEntryToFirestore(_stepLog.value)
    }

    private fun syncStepEntryToFirestore(entry: StepLogEntry) {
        val uid = auth.currentUser?.uid ?: return
        scope.launch {
            runCatching {
                val map = hashMapOf(
                    "date" to entry.date,
                    "steps" to entry.steps,
                    "targetSteps" to entry.targetSteps,
                    "distanceKm" to entry.distanceKm,
                    "caloriesBurned" to entry.caloriesBurned,
                    "source" to entry.source,
                    "updatedAt" to FieldValue.serverTimestamp()
                )
                firestore.collection("users").document(uid)
                    .collection("stepLogs").document(entry.date)
                    .set(map, SetOptions.merge())
                    .await()
            }.onFailure { e ->
                Log.w(tag, "Failed to sync steps to Firestore: ${e.message}")
            }
        }
    }

    private fun calculateDistanceKm(steps: Int): Double {
        // Average stride length: ~0.76 meters per step
        return ((steps * 0.76) / 1000.0 * 100.0).toInt() / 100.0
    }

    private fun calculateCalories(steps: Int): Int {
        // Average active calorie burn: ~0.04 kcal per step
        return (steps * 0.04).toInt()
    }
}

