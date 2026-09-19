package com.foodcal.app.data.remote

import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import com.foodcal.app.data.model.StravaActivity
import com.foodcal.app.data.model.StravaConnectionStatus
import com.foodcal.app.data.model.WorkoutLogEntry
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
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import okhttp3.OkHttpClient
import okhttp3.Request
import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter

class StravaManager(
    private val context: Context,
    private val firestore: FirebaseFirestore,
    private val auth: FirebaseAuth,
    private val okHttpClient: OkHttpClient
) {
    private val tag = "StravaManager"
    private val prefs: SharedPreferences = context.getSharedPreferences("foodcal_strava_prefs", Context.MODE_PRIVATE)
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    private val json = Json {
        ignoreUnknownKeys = true
        coerceInputValues = true
        isLenient = true
    }

    private val keyIsConnected = "strava_is_connected"
    private val keyAccessToken = "strava_access_token"
    private val keyRefreshToken = "strava_refresh_token"
    private val keyExpiresAt = "strava_expires_at"
    private val keyAthleteName = "strava_athlete_name"
    private val keyAthleteProfile = "strava_athlete_profile"
    private val keyLastSyncTime = "strava_last_sync_time"
    private val keyTotalSynced = "strava_total_synced"

    private val _status = MutableStateFlow(loadInitialStatus())
    val status: StateFlow<StravaConnectionStatus> = _status.asStateFlow()

    init {
        // Observe cloud sync state for current user
        observeCloudConnection()
    }

    private fun loadInitialStatus(): StravaConnectionStatus {
        return StravaConnectionStatus(
            isConnected = prefs.getBoolean(keyIsConnected, false),
            athleteName = prefs.getString(keyAthleteName, null),
            athleteProfileUrl = prefs.getString(keyAthleteProfile, null),
            lastSyncTime = prefs.getString(keyLastSyncTime, null),
            totalSynced = prefs.getInt(keyTotalSynced, 0)
        )
    }

    private fun observeCloudConnection() {
        val uid = auth.currentUser?.uid ?: return
        firestore.collection("users").document(uid)
            .collection("integrations").document("strava")
            .addSnapshotListener { snap, _ ->
                if (snap != null && snap.exists()) {
                    val connected = snap.getBoolean("isConnected") ?: false
                    val athleteName = snap.getString("athleteName")
                    val athleteProfile = snap.getString("athleteProfileUrl")
                    val token = snap.getString("accessToken")
                    val rToken = snap.getString("refreshToken")
                    val exp = snap.getLong("expiresAt") ?: 0L
                    val lastSync = snap.getString("lastSyncTime")
                    val count = (snap.getLong("totalSynced") ?: 0L).toInt()

                    prefs.edit()
                        .putBoolean(keyIsConnected, connected)
                        .putString(keyAthleteName, athleteName)
                        .putString(keyAthleteProfile, athleteProfile)
                        .putString(keyAccessToken, token)
                        .putString(keyRefreshToken, rToken)
                        .putLong(keyExpiresAt, exp)
                        .putString(keyLastSyncTime, lastSync)
                        .putInt(keyTotalSynced, count)
                        .apply()

                    _status.value = StravaConnectionStatus(
                        isConnected = connected,
                        athleteName = athleteName,
                        athleteProfileUrl = athleteProfile,
                        lastSyncTime = lastSync,
                        totalSynced = count
                    )
                }
            }
    }

    fun isConnected(): Boolean = _status.value.isConnected

    fun getAccessToken(): String? = prefs.getString(keyAccessToken, null)

    suspend fun connect(
        accessToken: String,
        refreshToken: String = "",
        expiresAt: Long = 0,
        athleteName: String = "Strava Athlete",
        athleteProfile: String? = null
    ): Result<Unit> = withContext(Dispatchers.IO) {
        runCatching {
            val uid = auth.currentUser?.uid ?: throw IllegalStateException("Not logged in")

            prefs.edit()
                .putBoolean(keyIsConnected, true)
                .putString(keyAccessToken, accessToken.trim())
                .putString(keyRefreshToken, refreshToken.trim())
                .putLong(keyExpiresAt, expiresAt)
                .putString(keyAthleteName, athleteName)
                .putString(keyAthleteProfile, athleteProfile)
                .apply()

            val map = hashMapOf(
                "isConnected" to true,
                "accessToken" to accessToken.trim(),
                "refreshToken" to refreshToken.trim(),
                "expiresAt" to expiresAt,
                "athleteName" to athleteName,
                "athleteProfileUrl" to athleteProfile,
                "connectedAt" to FieldValue.serverTimestamp(),
                "updatedAt" to FieldValue.serverTimestamp()
            )

            firestore.collection("users").document(uid)
                .collection("integrations").document("strava")
                .set(map, SetOptions.merge())
                .await()

            _status.value = StravaConnectionStatus(
                isConnected = true,
                athleteName = athleteName,
                athleteProfileUrl = athleteProfile,
                lastSyncTime = prefs.getString(keyLastSyncTime, null),
                totalSynced = prefs.getInt(keyTotalSynced, 0)
            )

            // Trigger immediate sync upon connecting
            syncWorkouts()
            Unit
        }
    }

    suspend fun disconnect(): Result<Unit> = withContext(Dispatchers.IO) {
        runCatching {
            val uid = auth.currentUser?.uid
            prefs.edit().clear().apply()

            if (uid != null) {
                val map = mapOf(
                    "isConnected" to false,
                    "accessToken" to null,
                    "refreshToken" to null,
                    "disconnectedAt" to FieldValue.serverTimestamp()
                )
                firestore.collection("users").document(uid)
                    .collection("integrations").document("strava")
                    .set(map, SetOptions.merge())
                    .await()
            }

            _status.value = StravaConnectionStatus(
                isConnected = false,
                athleteName = null,
                athleteProfileUrl = null,
                lastSyncTime = null,
                totalSynced = 0
            )
        }
    }

    /**
     * Synchronizes workouts from Strava into Firestore.
     * Prevents duplicates by cross-checking stravaActivityId.
     */
    suspend fun syncWorkouts(): Result<Int> = withContext(Dispatchers.IO) {
        runCatching {
            val token = getAccessToken()
            if (token.isNullOrBlank()) {
                throw IllegalStateException("Strava is not connected")
            }
            val uid = auth.currentUser?.uid ?: throw IllegalStateException("Not logged in")

            // 1. Fetch recent activities from Strava API
            val request = Request.Builder()
                .url("https://www.strava.com/api/v3/athlete/activities?per_page=30")
                .addHeader("Authorization", "Bearer $token")
                .get()
                .build()

            val response = okHttpClient.newCall(request).execute()
            if (!response.isSuccessful) {
                val bodyStr = response.body?.string().orEmpty()
                if (response.code == 401) {
                    throw IllegalStateException("Strava token expired or invalid (401). Please reconnect.")
                }
                throw IllegalStateException("Strava API error (${response.code}): $bodyStr")
            }

            val bodyText = response.body?.string() ?: "[]"
            val activities = json.decodeFromString<List<StravaActivity>>(bodyText)

            if (activities.isEmpty()) {
                return@runCatching 0
            }

            // 2. Fetch existing workout logs in Firestore to deduplicate by stravaActivityId
            val existingDocs = firestore.collection("users").document(uid)
                .collection("workoutLogs")
                .get()
                .await()

            val existingStravaIds = existingDocs.documents.mapNotNull {
                it.getString("stravaActivityId")
            }.toSet()

            var newCount = 0

            // 3. User profile weight for calorie calculations
            val userProfileDoc = firestore.collection("users").document(uid).get().await()
            val userWeight = (userProfileDoc.getDouble("weight") ?: 70.0)

            for (act in activities) {
                val actIdStr = act.id.toString()
                if (existingStravaIds.contains(actIdStr)) {
                    continue // Already imported
                }

                val workoutEntry = mapStravaActivityToWorkout(act, userWeight)

                val map = hashMapOf(
                    "exerciseName" to workoutEntry.exerciseName,
                    "exerciseId" to -1, // Negative ID for external activity
                    "category" to workoutEntry.category,
                    "inputType" to workoutEntry.inputType,
                    "caloriesBurned" to workoutEntry.caloriesBurned,
                    "met" to workoutEntry.met,
                    "effectiveDurationMin" to workoutEntry.effectiveDurationMin,
                    "weightKg" to workoutEntry.weightKg,
                    "durationMin" to workoutEntry.durationMin,
                    "distanceKm" to workoutEntry.distanceKm,
                    "sets" to 0,
                    "reps" to 0,
                    "liftedWeight" to 0.0,
                    "holdSeconds" to 0,
                    "image" to workoutEntry.image,
                    "date" to workoutEntry.date,
                    "stravaActivityId" to actIdStr,
                    "source" to "strava",
                    "createdAt" to FieldValue.serverTimestamp()
                )

                firestore.collection("users").document(uid)
                    .collection("workoutLogs")
                    .add(map)
                    .await()

                newCount++
            }

            // Update last sync time
            val nowTime = LocalDateTime.now().format(DateTimeFormatter.ofPattern("MMM d, HH:mm"))
            val totalSynced = prefs.getInt(keyTotalSynced, 0) + newCount

            prefs.edit()
                .putString(keyLastSyncTime, nowTime)
                .putInt(keyTotalSynced, totalSynced)
                .apply()

            firestore.collection("users").document(uid)
                .collection("integrations").document("strava")
                .set(
                    mapOf(
                        "lastSyncTime" to nowTime,
                        "totalSynced" to totalSynced,
                        "lastSyncCount" to newCount,
                        "updatedAt" to FieldValue.serverTimestamp()
                    ),
                    SetOptions.merge()
                )
                .await()

            _status.value = _status.value.copy(
                lastSyncTime = nowTime,
                totalSynced = totalSynced
            )

            Log.d(tag, "Successfully synced $newCount new activities from Strava")
            newCount
        }
    }

    /**
     * Called automatically when the app is opened to sync latest Strava workouts.
     */
    fun syncOnAppOpen() {
        if (!isConnected()) return
        scope.launch {
            runCatching {
                syncWorkouts()
            }.onFailure { e ->
                Log.w(tag, "Background Strava sync on open failed: ${e.message}")
            }
        }
    }

    private fun mapStravaActivityToWorkout(act: StravaActivity, weightKg: Double): WorkoutLogEntry {
        val durationMin = (act.movingTime / 60).coerceAtLeast(1)
        val distanceKm = ((act.distance / 1000.0) * 100.0).toInt() / 100.0

        val dateStr = try {
            Instant.parse(act.startDateLocal).atZone(ZoneId.systemDefault()).toLocalDate().toString()
        } catch (_: Exception) {
            act.startDateLocal.take(10).ifEmpty { LocalDate.now().toString() }
        }

        val typeLower = act.type.lowercase()
        val sportTypeLower = act.sportType?.lowercase().orEmpty()

        val (category, inputType, met, imageUrl) = when {
            typeLower.contains("badminton") || sportTypeLower.contains("badminton") ->
                Quadruple("Sports", "sports", 7.0, "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=400&auto=format&fit=crop&q=80")
            typeLower.contains("soccer") || typeLower.contains("football") || sportTypeLower.contains("soccer") ->
                Quadruple("Sports", "sports", 8.5, "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=400&auto=format&fit=crop&q=80")
            typeLower.contains("tennis") || sportTypeLower.contains("tennis") || sportTypeLower.contains("pickleball") ->
                Quadruple("Sports", "sports", 7.3, "https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?w=400&auto=format&fit=crop&q=80")
            typeLower.contains("basketball") ->
                Quadruple("Sports", "sports", 8.0, "https://images.unsplash.com/photo-1546519638-68e109498ffc?w=400&auto=format&fit=crop&q=80")
            typeLower.contains("cricket") ->
                Quadruple("Sports", "sports", 5.0, "https://images.unsplash.com/photo-1531415074868-036b107e775a?w=400&auto=format&fit=crop&q=80")
            typeLower.contains("squash") ->
                Quadruple("Sports", "sports", 12.0, "https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=400&auto=format&fit=crop&q=80")
            typeLower.contains("ride") || typeLower.contains("cycling") ->
                Quadruple("Cardio", "cardio", 7.5, "https://images.unsplash.com/photo-1517649763962-0c623266ddc0?w=300&auto=format&fit=crop&q=80")
            typeLower.contains("swim") ->
                Quadruple("Cardio", "cardio", 8.0, "https://images.unsplash.com/photo-1530549387789-4c1017266635?w=300&auto=format&fit=crop&q=80")
            typeLower.contains("walk") || typeLower.contains("hike") ->
                Quadruple("Cardio", "cardio", 3.8, "https://images.unsplash.com/photo-1513593771513-7b58b6c4af38?w=300&auto=format&fit=crop&q=80")
            typeLower.contains("weight") || typeLower.contains("gym") || typeLower.contains("crossfit") ->
                Quadruple("General", "weighted", 5.0, "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=300&auto=format&fit=crop&q=80")
            else ->
                // Default running / generic cardio
                Quadruple("Cardio", "cardio", 9.0, "https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=300&auto=format&fit=crop&q=80")
        }

        val calculatedCal = act.calories?.toInt()?.takeIf { it > 0 } ?: run {
            ((met * 3.5 * weightKg / 200.0) * durationMin).toInt().coerceAtLeast(30)
        }

        return WorkoutLogEntry(
            exerciseName = act.name.ifBlank { "${act.type} (Strava)" },
            exerciseId = -1,
            category = category,
            inputType = inputType,
            durationMin = durationMin,
            distanceKm = distanceKm,
            caloriesBurned = calculatedCal,
            met = met,
            effectiveDurationMin = durationMin.toDouble(),
            weightKg = weightKg,
            image = imageUrl,
            date = dateStr,
            stravaActivityId = act.id.toString(),
            source = "strava"
        )
    }

    private data class Quadruple<A, B, C, D>(val first: A, val second: B, val third: C, val fourth: D)
}

