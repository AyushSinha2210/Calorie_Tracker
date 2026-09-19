package com.foodcal.app.data.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class NutritionItem(
    val name: String = "",
    val quantity: String = "100g",
    val grams: Int = 100,
    val calories: Int = 0,
    val protein: Double = 0.0,
    val carbs: Double = 0.0,
    val fat: Double = 0.0
)

data class UserProfile(
    val uid: String = "",
    val name: String = "",
    val email: String = "",
    val age: Int = 0,
    val gender: String = "",
    val weight: Double = 0.0, // kg
    val weightUnit: String = "kg",
    val originalWeight: Double = 0.0,
    val height: Double = 0.0, // cm
    val heightUnit: String = "cm",
    val originalHeight: Double = 0.0,
    val dailyCalorieTarget: Int = 2000,
    val profileComplete: Boolean = false,
    val profileImage: String? = null,
    val coachEnabled: Boolean = true,
    val coachTone: String = "friendly",
    val lastRecordedWeight: Double = 0.0,
    val lastWeightLogDate: String = ""
)

data class FoodLogEntry(
    val id: String = "",
    val itemName: String = "",
    val quantity: String = "1 item",
    val calories: Int = 0,
    val protein: Double = 0.0,
    val carbs: Double = 0.0,
    val fat: Double = 0.0,
    val healthScore: Int = 0,
    val source: String = "manual", // "scan" | "text" | "manual"
    val mealType: String = "Breakfast",
    val date: String = "", // "YYYY-MM-DD"
    val items: List<NutritionItem> = emptyList(),
    val createdAtMillis: Long = 0L
)

data class WorkoutLogEntry(
    val id: String = "",
    val exerciseName: String = "",
    val exerciseId: Int = 0,
    val category: String = "General",
    val inputType: String = "cardio", // "cardio" | "weighted" | "bodyweight" | "isometric"
    val caloriesBurned: Int = 0,
    val met: Double = 0.0,
    val effectiveDurationMin: Double = 0.0,
    val weightKg: Double = 70.0,
    val durationMin: Int = 0,
    val distanceKm: Double = 0.0,
    val sets: Int = 0,
    val reps: Int = 0,
    val liftedWeight: Double = 0.0,
    val holdSeconds: Int = 0,
    val image: String? = null,
    val date: String = "",
    val stravaActivityId: String? = null,
    val source: String = "manual" // "manual" | "strava"
)

data class StepLogEntry(
    val date: String = "",
    val steps: Int = 0,
    val targetSteps: Int = 10000,
    val distanceKm: Double = 0.0,
    val caloriesBurned: Int = 0,
    val lastSyncedMillis: Long = System.currentTimeMillis(),
    val source: String = "sensor"
)

data class StravaConnectionStatus(
    val isConnected: Boolean = false,
    val athleteName: String? = null,
    val athleteProfileUrl: String? = null,
    val lastSyncTime: String? = null,
    val totalSynced: Int = 0
)

@Serializable
data class StravaActivity(
    val id: Long = 0,
    val name: String = "",
    val distance: Double = 0.0,
    @SerialName("moving_time") val movingTime: Int = 0,
    @SerialName("elapsed_time") val elapsedTime: Int = 0,
    val type: String = "Workout",
    @SerialName("sport_type") val sportType: String? = null,
    @SerialName("start_date_local") val startDateLocal: String = "",
    val calories: Double? = null
)

data class WeightLogEntry(
    val id: String = "",
    val weight: Double = 0.0, // kg
    val originalWeight: Double = 0.0,
    val unit: String = "kg",
    val date: String = ""
)

@Serializable
data class ScanMealResponse(
    val mealName: String = "Meal",
    val items: List<NutritionItem> = emptyList(),
    @SerialName("total_calories") val totalCalories: Int = 0,
    @SerialName("total_protein") val totalProtein: Double = 0.0,
    @SerialName("total_carbs") val totalCarbs: Double = 0.0,
    @SerialName("total_fat") val totalFat: Double = 0.0,
    val healthScore: Int = 6,
    val tip: String = "",
    val note: String? = null
)

@Serializable
data class AnalyzeTextRequest(val text: String)

@Serializable
data class AnalyzeTextResponse(
    val items: List<NutritionItem> = emptyList(),
    @SerialName("total_calories") val totalCalories: Int = 0,
    @SerialName("total_protein") val totalProtein: Double = 0.0,
    @SerialName("total_carbs") val totalCarbs: Double = 0.0,
    @SerialName("total_fat") val totalFat: Double = 0.0,
    val note: String? = null
)

val CANONICAL_MEAL_TYPES = listOf("Breakfast", "Lunch", "Evening Snacks", "Dinner", "Late Night")

fun detectMealType(hour: Int = java.time.LocalTime.now().hour): String = when {
    hour in 6..10 -> "Breakfast"
    hour in 11..14 -> "Lunch"
    hour in 15..17 -> "Evening Snacks"
    hour in 18..21 -> "Dinner"
    else -> "Late Night"
}

sealed interface ProfileUiState {
    data object Loading : ProfileUiState
    data class NeedsProfile(val initialName: String = "", val initialEmail: String = "") : ProfileUiState
    data class Ready(val profile: UserProfile) : ProfileUiState
}

@Serializable
data class CalculateNutritionRequest(val items: List<NutritionItem>)

@Serializable
data class WorkoutSearchItem(
    val id: Int = 0,
    val name: String = "",
    val category: String? = null,
    val image: String? = null
)

@Serializable
data class WorkoutExerciseInfo(
    val id: Int = 0,
    val name: String = "",
    val categoryId: Int? = null,
    val categoryName: String? = null,
    val inputType: String = "cardio",
    val image: String? = null,
    val imageThumbnail: String? = null
)

@Serializable
data class WorkoutCalculationRequest(
    val exerciseName: String,
    val categoryId: Int? = null,
    val inputType: String = "cardio",
    val durationMin: Int = 0,
    val sets: Int = 0,
    val reps: Int = 0,
    val liftedWeight: Double = 0.0,
    val holdSeconds: Int = 0,
    val weightKg: Double
)

@Serializable
data class WorkoutCalculationResponse(
    val caloriesBurned: Int = 0,
    val met: Double = 0.0,
    val effectiveDurationMin: Double = 0.0
)

@Serializable
data class CoachRequest(
    val tone: String = "friendly",
    val activityType: String = "food",
    val entry: Map<String, String> = emptyMap(),
    val dayStats: Map<String, String> = emptyMap(),
    val userProfile: Map<String, String> = emptyMap()
)

@Serializable
data class CoachResponse(
    val comment: String = "",
    val error: Boolean = false
)

@Serializable
data class PromptTemplateDto(
    val name: String = "",
    val description: String = "",
    val category: String = "",
    val template: String = ""
)

@Serializable
data class BuildPromptRequest(
    val templateKey: String,
    val profile: Map<String, String> = emptyMap()
)

@Serializable
data class BuildPromptResponse(
    val prompt: String = "",
    val title: String = ""
)

