package com.foodcal.app.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.foodcal.app.data.model.*
import com.foodcal.app.data.repository.FoodCalRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import java.io.File
import java.time.LocalDate
import com.foodcal.app.data.sensor.StepTrackerManager
import com.foodcal.app.data.remote.StravaManager
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.map

data class DaySummary(
    val date: String = "",
    val foodLogs: List<FoodLogEntry> = emptyList(),
    val totalCalories: Int = 0,
    val totalProtein: Double = 0.0,
    val totalCarbs: Double = 0.0,
    val totalFat: Double = 0.0,
    val workoutLogs: List<WorkoutLogEntry> = emptyList(),
    val totalCaloriesBurned: Int = 0,
    val steps: Int = 0,
    val stepDistanceKm: Double = 0.0,
    val stepCalories: Int = 0,
    val stepTarget: Int = 10000
)

class MainViewModel(
    val repository: FoodCalRepository,
    val stepTrackerManager: StepTrackerManager? = null,
    val stravaManager: StravaManager? = null
) : ViewModel() {

    private val thirtyDaysAgo = LocalDate.now().minusDays(30).toString()
    private val sixtyDaysAgo = LocalDate.now().minusDays(60).toString()

    val profileState: StateFlow<ProfileUiState> = repository.observeProfileState()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), ProfileUiState.Loading)

    private val _localProfileOverride = MutableStateFlow<UserProfile?>(null)

    val profile: StateFlow<UserProfile?> = combine(
        repository.observeProfile(),
        _localProfileOverride
    ) { repoProf, overrideProf ->
        overrideProf ?: repoProf
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), null)

    val allFoodLogs: StateFlow<List<FoodLogEntry>> = repository.observeFoodLogs(thirtyDaysAgo)
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val allWorkoutLogs: StateFlow<List<WorkoutLogEntry>> = repository.observeWorkoutLogs(thirtyDaysAgo)
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val allWeightLogs: StateFlow<List<WeightLogEntry>> = repository.observeWeightLogs(sixtyDaysAgo)
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val todaySteps: StateFlow<StepLogEntry> = stepTrackerManager?.stepLog
        ?: repository.observeStepLog(LocalDate.now().toString())
            .map { it ?: StepLogEntry(date = LocalDate.now().toString()) }
            .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), StepLogEntry(date = LocalDate.now().toString()))

    val stravaStatus: StateFlow<StravaConnectionStatus> = stravaManager?.status
        ?: MutableStateFlow(StravaConnectionStatus()).asStateFlow()

    private val _selectedDate = MutableStateFlow(LocalDate.now())
    val selectedDate: StateFlow<LocalDate> = _selectedDate

    val daySummary: StateFlow<DaySummary> = combine(
        selectedDate,
        allFoodLogs,
        allWorkoutLogs,
        todaySteps
    ) { date, foods, workouts, stepsEntry ->
        val dateStr = date.toString()
        val dayFoods = foods.filter { it.date == dateStr }
        val dayWorkouts = workouts.filter { it.date == dateStr }
        val isToday = dateStr == LocalDate.now().toString()

        DaySummary(
            date = dateStr,
            foodLogs = dayFoods,
            totalCalories = dayFoods.sumOf { it.calories },
            totalProtein = dayFoods.sumOf { it.protein },
            totalCarbs = dayFoods.sumOf { it.carbs },
            totalFat = dayFoods.sumOf { it.fat },
            workoutLogs = dayWorkouts,
            totalCaloriesBurned = dayWorkouts.sumOf { it.caloriesBurned },
            steps = if (isToday) stepsEntry.steps else 0,
            stepDistanceKm = if (isToday) stepsEntry.distanceKm else 0.0,
            stepCalories = if (isToday) stepsEntry.caloriesBurned else 0,
            stepTarget = stepsEntry.targetSteps
        )
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), DaySummary())

    fun setSelectedDate(date: LocalDate) {
        _selectedDate.value = date
    }

    // ── Food Actions ───────────────────────────────────────────────────
    fun saveFoodLog(entry: FoodLogEntry, onComplete: ((Boolean) -> Unit)? = null) {
        viewModelScope.launch {
            val res = repository.saveFoodLog(entry)
            onComplete?.invoke(res.isSuccess)
        }
    }

    fun updateFoodLog(id: String, itemName: String, calories: Int, protein: Double, carbs: Double, fat: Double) {
        viewModelScope.launch {
            repository.updateFoodLog(id, itemName, calories, protein, carbs, fat)
        }
    }

    fun deleteFoodLog(id: String) {
        viewModelScope.launch {
            repository.deleteFoodLog(id)
        }
    }

    // ── Workout Actions ────────────────────────────────────────────────
    fun saveWorkoutLog(entry: WorkoutLogEntry, onComplete: ((Boolean) -> Unit)? = null) {
        viewModelScope.launch {
            val res = repository.saveWorkoutLog(entry)
            onComplete?.invoke(res.isSuccess)
        }
    }

    fun deleteWorkoutLog(id: String) {
        viewModelScope.launch {
            repository.deleteWorkoutLog(id)
        }
    }

    // ── Weight Actions ─────────────────────────────────────────────────
    fun saveWeightLog(weightKg: Double, originalWeight: Double, unit: String, date: String) {
        viewModelScope.launch {
            repository.saveWeightLog(weightKg, originalWeight, unit, date)
        }
    }

    fun deleteWeightLog(id: String) {
        viewModelScope.launch {
            repository.deleteWeightLog(id)
        }
    }

    // ── Profile Actions ────────────────────────────────────────────────
    fun saveProfile(userProfile: UserProfile, onComplete: ((Boolean) -> Unit)? = null) {
        _localProfileOverride.value = userProfile
        viewModelScope.launch {
            val res = repository.saveProfile(userProfile)
            onComplete?.invoke(res.isSuccess)
        }
    }

    fun updateCoachTone(tone: String) {
        viewModelScope.launch {
            repository.updateCoachPreferences(enabled = true, tone = tone)
        }
    }

    // ── AI Actions ─────────────────────────────────────────────────────
    fun scanMeal(file: File, callback: (Result<ScanMealResponse>) -> Unit) {
        viewModelScope.launch {
            val result = repository.scanMeal(file)
            callback(result)
        }
    }

    fun analyzeText(text: String, callback: (Result<AnalyzeTextResponse>) -> Unit) {
        viewModelScope.launch {
            val result = repository.analyzeText(text)
            callback(result)
        }
    }

    fun lookupFood(name: String, quantity: String = "100g", callback: (Result<NutritionItem>) -> Unit) {
        viewModelScope.launch {
            val result = repository.lookupFood(name, quantity)
            callback(result)
        }
    }

    fun submitFeedback(message: String, email: String, callback: (Result<Unit>) -> Unit) {
        viewModelScope.launch {
            val result = repository.submitFeedback(message, email)
            callback(result)
        }
    }

    fun searchWorkouts(term: String, callback: (Result<List<WorkoutSearchItem>>) -> Unit) {
        viewModelScope.launch {
            val result = repository.searchWorkouts(term)
            callback(result)
        }
    }

    fun getExerciseInfo(id: Int, callback: (Result<WorkoutExerciseInfo>) -> Unit) {
        viewModelScope.launch {
            val result = repository.getExerciseInfo(id)
            callback(result)
        }
    }

    fun calculateWorkout(request: WorkoutCalculationRequest, callback: (Result<WorkoutCalculationResponse>) -> Unit) {
        viewModelScope.launch {
            val result = repository.calculateWorkout(request)
            callback(result)
        }
    }

    fun getCoachComment(
        tone: String,
        activityType: String,
        entryName: String,
        calories: Int,
        protein: Double,
        callback: (Result<String>) -> Unit
    ) {
        viewModelScope.launch {
            val result = repository.getCoachComment(tone, activityType, entryName, calories, protein)
            callback(result)
        }
    }

    fun getCoachTemplates(callback: (Result<Map<String, PromptTemplateDto>>) -> Unit) {
        viewModelScope.launch {
            val result = repository.getCoachTemplates()
            callback(result)
        }
    }

    fun buildCoachPrompt(
        templateKey: String,
        profileMap: Map<String, String>,
        callback: (Result<BuildPromptResponse>) -> Unit
    ) {
        viewModelScope.launch {
            val result = repository.buildCoachPrompt(templateKey, profileMap)
            callback(result)
        }
    }

    // ── Steps Actions ──────────────────────────────────────────────────
    fun syncSteps() {
        stepTrackerManager?.syncStepsOnAppOpen()
    }

    fun addManualSteps(count: Int) {
        stepTrackerManager?.addManualSteps(count)
    }

    fun setTodaySteps(count: Int) {
        stepTrackerManager?.setTodaySteps(count)
    }

    fun setTargetSteps(target: Int) {
        stepTrackerManager?.setTargetSteps(target)
    }

    fun getSensorTypeDescription(): String {
        return stepTrackerManager?.getSensorTypeDescription() ?: "Motion Sensor"
    }

    // ── Strava Actions ─────────────────────────────────────────────────
    fun syncStrava(onComplete: ((Result<Int>) -> Unit)? = null) {
        viewModelScope.launch {
            val res = stravaManager?.syncWorkouts() ?: Result.failure(IllegalStateException("Strava not initialized"))
            onComplete?.invoke(res)
        }
    }

    fun connectStrava(accessToken: String, athleteName: String = "Athlete", onComplete: ((Result<Unit>) -> Unit)? = null) {
        viewModelScope.launch {
            val res = stravaManager?.connect(accessToken = accessToken, athleteName = athleteName)
                ?: Result.failure(IllegalStateException("Strava not initialized"))
            onComplete?.invoke(res)
        }
    }

    fun disconnectStrava(onComplete: ((Result<Unit>) -> Unit)? = null) {
        viewModelScope.launch {
            val res = stravaManager?.disconnect() ?: Result.success(Unit)
            onComplete?.invoke(res)
        }
    }

    companion object {
        fun provideFactory(
            repository: FoodCalRepository,
            stepTrackerManager: StepTrackerManager? = null,
            stravaManager: StravaManager? = null
        ): ViewModelProvider.Factory =
            object : ViewModelProvider.Factory {
                @Suppress("UNCHECKED_CAST")
                override fun <T : ViewModel> create(modelClass: Class<T>): T {
                    return MainViewModel(repository, stepTrackerManager, stravaManager) as T
                }
            }
    }
}

