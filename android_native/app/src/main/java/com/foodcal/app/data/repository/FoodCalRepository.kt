package com.foodcal.app.data.repository

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import com.foodcal.app.data.model.*
import com.foodcal.app.data.remote.FoodCalApi
import com.foodcal.app.data.util.FoodLocalParser
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.tasks.await
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.asRequestBody
import java.io.File
import java.io.FileOutputStream
import java.time.LocalDate

@OptIn(ExperimentalCoroutinesApi::class)
class FoodCalRepository(
    private val api: FoodCalApi,
    private val auth: FirebaseAuth,
    private val firestore: FirebaseFirestore
) {
    val currentUserId: String?
        get() = auth.currentUser?.uid

    val todayDateString: String
        get() = LocalDate.now().toString()

    fun currentUidFlow(): Flow<String?> = callbackFlow {
        val listener = FirebaseAuth.AuthStateListener { fAuth ->
            trySend(fAuth.currentUser?.uid)
        }
        auth.addAuthStateListener(listener)
        trySend(auth.currentUser?.uid)
        awaitClose { auth.removeAuthStateListener(listener) }
    }

    private fun parseUserProfile(uid: String, data: Map<String, Any?>): UserProfile {
        return UserProfile(
            uid = uid,
            name = data["name"] as? String ?: "",
            email = data["email"] as? String ?: auth.currentUser?.email ?: "",
            age = (data["age"] as? Number)?.toInt() ?: 0,
            gender = data["gender"] as? String ?: "",
            weight = (data["weight"] as? Number)?.toDouble() ?: 0.0,
            weightUnit = data["weightUnit"] as? String ?: "kg",
            originalWeight = (data["originalWeight"] as? Number)?.toDouble() ?: 0.0,
            height = (data["height"] as? Number)?.toDouble() ?: 0.0,
            heightUnit = data["heightUnit"] as? String ?: "cm",
            originalHeight = (data["originalHeight"] as? Number)?.toDouble() ?: 0.0,
            dailyCalorieTarget = (data["dailyCalorieTarget"] as? Number)?.toInt() ?: 2000,
            profileComplete = data["profileComplete"] as? Boolean ?: false,
            profileImage = data["profileImage"] as? String,
            coachEnabled = data["coachEnabled"] as? Boolean ?: true,
            coachTone = data["coachTone"] as? String ?: "friendly",
            lastRecordedWeight = (data["lastRecordedWeight"] as? Number)?.toDouble() ?: 0.0,
            lastWeightLogDate = data["lastWeightLogDate"] as? String ?: ""
        )
    }

    // ── User Profile Flows ─────────────────────────────────────────────
    fun observeProfileState(): Flow<ProfileUiState> = currentUidFlow().flatMapLatest { uid ->
        if (uid == null) {
            flowOf<ProfileUiState>(ProfileUiState.Loading)
        } else {
            callbackFlow<ProfileUiState> {
                val docRef = firestore.collection("users").document(uid)
                val listener = docRef.addSnapshotListener { snapshot, error ->
                    if (error != null) {
                        trySend(ProfileUiState.NeedsProfile(
                            initialName = auth.currentUser?.displayName.orEmpty(),
                            initialEmail = auth.currentUser?.email.orEmpty()
                        ))
                        return@addSnapshotListener
                    }
                    if (snapshot == null || !snapshot.exists()) {
                        trySend(ProfileUiState.NeedsProfile(
                            initialName = auth.currentUser?.displayName.orEmpty(),
                            initialEmail = auth.currentUser?.email.orEmpty()
                        ))
                    } else {
                        val data = snapshot.data ?: emptyMap()
                        val complete = data["profileComplete"] as? Boolean ?: false
                        if (!complete) {
                            trySend(ProfileUiState.NeedsProfile(
                                initialName = (data["name"] as? String)?.ifBlank { auth.currentUser?.displayName.orEmpty() } ?: auth.currentUser?.displayName.orEmpty(),
                                initialEmail = (data["email"] as? String)?.ifBlank { auth.currentUser?.email.orEmpty() } ?: auth.currentUser?.email.orEmpty()
                            ))
                        } else {
                            val profile = parseUserProfile(uid, data)
                            trySend(ProfileUiState.Ready(profile))
                        }
                    }
                }
                awaitClose { listener.remove() }
            }
        }
    }

    fun observeProfile(): Flow<UserProfile?> = currentUidFlow().flatMapLatest { uid ->
        if (uid == null) {
            flowOf(null)
        } else {
            callbackFlow {
                val docRef = firestore.collection("users").document(uid)
                val listener = docRef.addSnapshotListener { snapshot, _ ->
                    if (snapshot != null && snapshot.exists()) {
                        trySend(parseUserProfile(uid, snapshot.data ?: emptyMap()))
                    } else {
                        trySend(null)
                    }
                }
                awaitClose { listener.remove() }
            }
        }
    }

    suspend fun saveProfile(profile: UserProfile): Result<Unit> = runCatching {
        val uid = currentUserId ?: throw IllegalStateException("Not logged in")
        val map = hashMapOf<String, Any?>(
            "name" to profile.name,
            "age" to profile.age,
            "gender" to profile.gender,
            "weight" to profile.weight,
            "weightUnit" to profile.weightUnit,
            "originalWeight" to profile.originalWeight,
            "height" to profile.height,
            "heightUnit" to profile.heightUnit,
            "originalHeight" to profile.originalHeight,
            "dailyCalorieTarget" to profile.dailyCalorieTarget,
            "profileComplete" to true,
            "coachEnabled" to profile.coachEnabled,
            "coachTone" to profile.coachTone,
            "lastActive" to FieldValue.serverTimestamp()
        )
        if (profile.profileImage != null) {
            map["profileImage"] = profile.profileImage
        }
        firestore.collection("users").document(uid).set(map, com.google.firebase.firestore.SetOptions.merge()).await()

        // Bi-directional sync: record today's weight check-in when updating profile weight
        if (profile.weight > 0) {
            val today = todayDateString
            val weightMap = hashMapOf(
                "weight" to profile.weight,
                "originalWeight" to (if (profile.originalWeight > 0) profile.originalWeight else profile.weight),
                "unit" to profile.weightUnit.ifBlank { "kg" },
                "date" to today,
                "source" to "profile",
                "createdAt" to FieldValue.serverTimestamp()
            )
            firestore.collection("users").document(uid).collection("weightLogs").add(weightMap).await()
            firestore.collection("users").document(uid).update(
                "lastRecordedWeight", profile.weight,
                "lastWeightLogDate", today
            ).await()
        }
    }

    suspend fun updateCoachPreferences(enabled: Boolean, tone: String): Result<Unit> = runCatching {
        val uid = currentUserId ?: return@runCatching
        firestore.collection("users").document(uid).update(
            "coachEnabled", enabled,
            "coachTone", tone
        ).await()
    }

    suspend fun updateLastActiveThrottled(): Result<Unit> = runCatching {
        val uid = currentUserId ?: return@runCatching
        firestore.collection("users").document(uid).set(
            mapOf("lastActive" to FieldValue.serverTimestamp()),
            com.google.firebase.firestore.SetOptions.merge()
        ).await()
    }

    // ── Food Logs ────────────────────────────────────────────────────
    fun observeFoodLogs(startDate: String): Flow<List<FoodLogEntry>> = currentUidFlow().flatMapLatest { uid ->
        if (uid == null) {
            flowOf(emptyList())
        } else {
            callbackFlow {
                val query = firestore.collection("users").document(uid)
                    .collection("foodLogs")
                    .whereGreaterThanOrEqualTo("date", startDate)
                    .orderBy("date", Query.Direction.DESCENDING)

                val listener = query.addSnapshotListener { snap, _ ->
                    if (snap != null) {
                        val list = snap.documents.map { doc ->
                            val data = doc.data ?: emptyMap()
                            @Suppress("UNCHECKED_CAST")
                            val rawItems = data["items"] as? List<Map<String, Any?>> ?: emptyList()
                            val items = rawItems.map { itm ->
                                NutritionItem(
                                    name = itm["name"] as? String ?: "",
                                    quantity = itm["quantity"] as? String ?: "100g",
                                    grams = (itm["grams"] as? Number)?.toInt() ?: 100,
                                    calories = (itm["calories"] as? Number)?.toInt() ?: 0,
                                    protein = (itm["protein"] as? Number)?.toDouble() ?: 0.0,
                                    carbs = (itm["carbs"] as? Number)?.toDouble() ?: 0.0,
                                    fat = (itm["fat"] as? Number)?.toDouble() ?: 0.0
                                )
                            }
                            FoodLogEntry(
                                id = doc.id,
                                itemName = data["itemName"] as? String ?: "Meal",
                                quantity = data["quantity"] as? String ?: "1 item",
                                calories = (data["calories"] as? Number)?.toInt() ?: 0,
                                protein = (data["protein"] as? Number)?.toDouble() ?: 0.0,
                                carbs = (data["carbs"] as? Number)?.toDouble() ?: 0.0,
                                fat = (data["fat"] as? Number)?.toDouble() ?: 0.0,
                                healthScore = (data["healthScore"] as? Number)?.toInt() ?: 0,
                                source = data["source"] as? String ?: "manual",
                                mealType = data["mealType"] as? String ?: "Breakfast",
                                date = data["date"] as? String ?: "",
                                items = items
                            )
                        }
                        trySend(list)
                    }
                }
                awaitClose { listener.remove() }
            }
        }
    }

    suspend fun saveFoodLog(entry: FoodLogEntry): Result<Unit> = runCatching {
        val uid = currentUserId ?: throw IllegalStateException("Not logged in")
        val itemsList = entry.items.map {
            mapOf(
                "name" to it.name,
                "quantity" to it.quantity,
                "grams" to it.grams,
                "calories" to it.calories,
                "protein" to it.protein,
                "carbs" to it.carbs,
                "fat" to it.fat
            )
        }
        val map = hashMapOf(
            "itemName" to entry.itemName,
            "quantity" to entry.quantity,
            "calories" to entry.calories,
            "protein" to entry.protein,
            "carbs" to entry.carbs,
            "fat" to entry.fat,
            "healthScore" to entry.healthScore,
            "source" to entry.source,
            "mealType" to entry.mealType,
            "date" to entry.date.ifEmpty { todayDateString },
            "items" to itemsList,
            "createdAt" to FieldValue.serverTimestamp()
        )
        firestore.collection("users").document(uid).collection("foodLogs").add(map).await()
    }

    suspend fun updateFoodLog(
        id: String,
        itemName: String,
        calories: Int,
        protein: Double,
        carbs: Double,
        fat: Double
    ): Result<Unit> = runCatching {
        val uid = currentUserId ?: return@runCatching
        firestore.collection("users").document(uid).collection("foodLogs").document(id).update(
            "itemName", itemName,
            "calories", calories,
            "protein", protein,
            "carbs", carbs,
            "fat", fat
        ).await()
    }

    suspend fun deleteFoodLog(id: String): Result<Unit> = runCatching {
        val uid = currentUserId ?: return@runCatching
        firestore.collection("users").document(uid).collection("foodLogs").document(id).delete().await()
    }

    // ── Workout Logs ─────────────────────────────────────────────────
    fun observeWorkoutLogs(startDate: String): Flow<List<WorkoutLogEntry>> = currentUidFlow().flatMapLatest { uid ->
        if (uid == null) {
            flowOf(emptyList())
        } else {
            callbackFlow {
                val query = firestore.collection("users").document(uid)
                    .collection("workoutLogs")
                    .whereGreaterThanOrEqualTo("date", startDate)
                    .orderBy("date", Query.Direction.DESCENDING)

                val listener = query.addSnapshotListener { snap, _ ->
                    if (snap != null) {
                        val list = snap.documents.map { doc ->
                            val data = doc.data ?: emptyMap()
                            WorkoutLogEntry(
                                id = doc.id,
                                exerciseName = data["exerciseName"] as? String ?: "Workout",
                                exerciseId = (data["exerciseId"] as? Number)?.toInt() ?: 0,
                                category = data["category"] as? String ?: "General",
                                inputType = data["inputType"] as? String ?: "cardio",
                                caloriesBurned = (data["caloriesBurned"] as? Number)?.toInt() ?: 0,
                                met = (data["met"] as? Number)?.toDouble() ?: 0.0,
                                effectiveDurationMin = (data["effectiveDurationMin"] as? Number)?.toDouble() ?: 0.0,
                                weightKg = (data["weightKg"] as? Number)?.toDouble() ?: 70.0,
                                durationMin = (data["durationMin"] as? Number)?.toInt() ?: 0,
                                distanceKm = (data["distanceKm"] as? Number)?.toDouble() ?: 0.0,
                                sets = (data["sets"] as? Number)?.toInt() ?: 0,
                                reps = (data["reps"] as? Number)?.toInt() ?: 0,
                                liftedWeight = (data["liftedWeight"] as? Number)?.toDouble() ?: 0.0,
                                holdSeconds = (data["holdSeconds"] as? Number)?.toInt() ?: 0,
                                image = data["image"] as? String,
                                date = data["date"] as? String ?: "",
                                stravaActivityId = data["stravaActivityId"] as? String,
                                source = data["source"] as? String ?: "manual"
                            )
                        }
                        trySend(list)
                    }
                }
                awaitClose { listener.remove() }
            }
        }
    }

    suspend fun saveWorkoutLog(entry: WorkoutLogEntry): Result<Unit> = runCatching {
        val uid = currentUserId ?: throw IllegalStateException("Not logged in")
        val map = hashMapOf<String, Any?>(
            "exerciseName" to entry.exerciseName,
            "exerciseId" to entry.exerciseId,
            "category" to entry.category,
            "inputType" to entry.inputType,
            "caloriesBurned" to entry.caloriesBurned,
            "met" to entry.met,
            "effectiveDurationMin" to entry.effectiveDurationMin,
            "weightKg" to entry.weightKg,
            "durationMin" to entry.durationMin,
            "distanceKm" to entry.distanceKm,
            "sets" to entry.sets,
            "reps" to entry.reps,
            "liftedWeight" to entry.liftedWeight,
            "holdSeconds" to entry.holdSeconds,
            "date" to entry.date.ifEmpty { todayDateString },
            "source" to entry.source,
            "createdAt" to FieldValue.serverTimestamp()
        )
        if (entry.image != null) map["image"] = entry.image
        if (entry.stravaActivityId != null) map["stravaActivityId"] = entry.stravaActivityId
        firestore.collection("users").document(uid).collection("workoutLogs").add(map).await()
    }

    suspend fun deleteWorkoutLog(id: String): Result<Unit> = runCatching {
        val uid = currentUserId ?: return@runCatching
        firestore.collection("users").document(uid).collection("workoutLogs").document(id).delete().await()
    }

    // ── Step Logs ────────────────────────────────────────────────────
    fun observeStepLog(date: String): Flow<StepLogEntry?> = currentUidFlow().flatMapLatest { uid ->
        if (uid == null) {
            flowOf(null)
        } else {
            callbackFlow {
                val docRef = firestore.collection("users").document(uid).collection("stepLogs").document(date)
                val listener = docRef.addSnapshotListener { snap, _ ->
                    if (snap != null && snap.exists()) {
                        val steps = (snap.getLong("steps") ?: 0L).toInt()
                        val target = (snap.getLong("targetSteps") ?: 10000L).toInt()
                        val distanceKm = snap.getDouble("distanceKm") ?: ((steps * 0.76) / 1000.0)
                        val cal = (snap.getLong("caloriesBurned") ?: 0L).toInt()
                        trySend(StepLogEntry(
                            date = date,
                            steps = steps,
                            targetSteps = target,
                            distanceKm = ((distanceKm * 100.0).toInt() / 100.0),
                            caloriesBurned = if (cal > 0) cal else (steps * 0.04).toInt(),
                            source = snap.getString("source") ?: "cloud"
                        ))
                    } else {
                        trySend(null)
                    }
                }
                awaitClose { listener.remove() }
            }
        }
    }

    suspend fun saveStepLog(entry: StepLogEntry): Result<Unit> = runCatching {
        val uid = currentUserId ?: throw IllegalStateException("Not logged in")
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
            .set(map, com.google.firebase.firestore.SetOptions.merge())
            .await()
    }

    // ── Weight Logs ──────────────────────────────────────────────────
    fun observeWeightLogs(startDate: String): Flow<List<WeightLogEntry>> = currentUidFlow().flatMapLatest { uid ->
        if (uid == null) {
            flowOf(emptyList())
        } else {
            callbackFlow {
                val query = firestore.collection("users").document(uid)
                    .collection("weightLogs")
                    .whereGreaterThanOrEqualTo("date", startDate)
                    .orderBy("date", Query.Direction.DESCENDING)

                val listener = query.addSnapshotListener { snap, _ ->
                    if (snap != null) {
                        val list = snap.documents.map { doc ->
                            val data = doc.data ?: emptyMap()
                            WeightLogEntry(
                                id = doc.id,
                                weight = (data["weight"] as? Number)?.toDouble() ?: 0.0,
                                originalWeight = (data["originalWeight"] as? Number)?.toDouble() ?: 0.0,
                                unit = data["unit"] as? String ?: "kg",
                                date = data["date"] as? String ?: ""
                            )
                        }
                        trySend(list)
                    }
                }
                awaitClose { listener.remove() }
            }
        }
    }

    suspend fun saveWeightLog(weightKg: Double, originalWeight: Double, unit: String, date: String): Result<Unit> = runCatching {
        val uid = currentUserId ?: throw IllegalStateException("Not logged in")
        val logDate = date.ifEmpty { todayDateString }
        val map = hashMapOf(
            "weight" to weightKg,
            "originalWeight" to originalWeight,
            "unit" to unit,
            "date" to logDate,
            "createdAt" to FieldValue.serverTimestamp()
        )
        firestore.collection("users").document(uid).collection("weightLogs").add(map).await()

        // Bi-directional sync: update user profile's weight fields
        val profileUpdates = hashMapOf<String, Any>(
            "weight" to weightKg,
            "originalWeight" to originalWeight,
            "weightUnit" to unit,
            "lastRecordedWeight" to weightKg,
            "lastWeightLogDate" to logDate
        )
        firestore.collection("users").document(uid).set(profileUpdates, com.google.firebase.firestore.SetOptions.merge()).await()
    }

    suspend fun deleteWeightLog(id: String): Result<Unit> = runCatching {
        val uid = currentUserId ?: return@runCatching
        firestore.collection("users").document(uid).collection("weightLogs").document(id).delete().await()
    }

    // ── Feedbacks ─────────────────────────────────────────────────────
    suspend fun submitFeedback(message: String, email: String): Result<Unit> = runCatching {
        firestore.collection("feedbacks").add(
            mapOf(
                "message" to message,
                "email" to email,
                "timestamp" to FieldValue.serverTimestamp()
            )
        ).await()
        Unit
    }

    // ── Backend AI Endpoints ─────────────────────────────────────────
    suspend fun scanMeal(photoFile: File): Result<ScanMealResponse> = runCatching {
        val compressed = compressImageFile(photoFile)
        val body = compressed.asRequestBody("image/jpeg".toMediaTypeOrNull())
        val part = MultipartBody.Part.createFormData("image", "meal.jpg", body)

        try {
            api.scanMeal(part)
        } catch (e: retrofit2.HttpException) {
            if (e.code() == 404) {
                // Fallback to legacy detect + calculate nutrition
                val fallbackPart = MultipartBody.Part.createFormData("image", "meal.jpg", body)
                val detected = api.analyzeFoodImage(fallbackPart)
                if (detected.items.isNotEmpty()) {
                    val calc = api.calculateNutrition(CalculateNutritionRequest(detected.items))
                    ScanMealResponse(
                        mealName = detected.items.joinToString(", ") { it.name }.take(80),
                        items = calc.items,
                        totalCalories = calc.totalCalories,
                        totalProtein = calc.totalProtein,
                        totalCarbs = calc.totalCarbs,
                        totalFat = calc.totalFat,
                        healthScore = 0,
                        tip = "Nutrition estimated via fallback service"
                    )
                } else {
                    ScanMealResponse(
                        mealName = "Meal",
                        items = emptyList(),
                        note = "No food items detected"
                    )
                }
            } else {
                throw e
            }
        }
    }

    suspend fun analyzeText(text: String): Result<AnalyzeTextResponse> = runCatching {
        val remoteRes = runCatching { api.analyzeFood(AnalyzeTextRequest(text)) }.getOrNull()
        if (remoteRes != null && remoteRes.items.isNotEmpty()) {
            remoteRes
        } else {
            FoodLocalParser.parseLocalFoodDescription(text)
        }
    }

    suspend fun lookupFood(name: String, quantity: String = "100g"): Result<NutritionItem> = runCatching {
        api.lookupFood(name, quantity)
    }

    suspend fun searchWorkouts(term: String): Result<List<WorkoutSearchItem>> = runCatching {
        api.searchWorkouts(term)
    }

    suspend fun getExerciseInfo(id: Int): Result<WorkoutExerciseInfo> = runCatching {
        api.exerciseInfo(id)
    }

    suspend fun calculateWorkout(request: WorkoutCalculationRequest): Result<WorkoutCalculationResponse> = runCatching {
        api.calculateWorkout(request)
    }

    suspend fun getCoachComment(tone: String, activityType: String, entryName: String, calories: Int, protein: Double): Result<String> = runCatching {
        val req = CoachRequest(
            tone = tone,
            activityType = activityType,
            entry = mapOf("name" to entryName, "calories" to calories.toString(), "protein" to protein.toString())
        )
        val remote = runCatching { api.coachComment(req).comment }.getOrNull()
        if (!remote.isNullOrBlank() && !remote.contains("taking a break", ignoreCase = true) && !remote.contains("unavailable", ignoreCase = true)) {
            remote
        } else {
            generateLocalCoachComment(tone, calories, protein, activityType)
        }
    }

    fun generateLocalCoachComment(
        tone: String,
        calories: Int,
        protein: Double,
        activityType: String
    ): String {
        val toneKey = tone.lowercase()
        return when (toneKey) {
            "tough_love" -> {
                when {
                    calories == 0 -> "Zero logs today? Excuses don't burn calories or build muscle. Log your intake now and stay accountable!"
                    protein < 50.0 -> "$calories kcal logged with only ${protein.toInt()}g protein. You're starving your muscles! Eat real protein before calling it a day."
                    protein >= 120.0 -> "$calories kcal and ${protein.toInt()}g protein. Good effort on hitting protein, but consistency tomorrow is what separates winners from talkers. Don't slack off."
                    else -> "You're at $calories kcal with ${protein.toInt()}g protein. Decent start, but step it up on nutrition and push harder!"
                }
            }
            "direct" -> {
                when {
                    calories == 0 -> "No intake recorded yet today. Input your meals to track your daily target accurately."
                    protein < 50.0 -> "Current intake: $calories kcal and ${protein.toInt()}g protein. Protein is below optimal recovery levels; aim to add a high-protein source next meal."
                    else -> "Logged $calories kcal with ${protein.toInt()}g protein. You are on track with your nutritional distribution. Maintain this pace."
                }
            }
            "enthusiastic" -> {
                when {
                    calories == 0 -> "Ready to conquer the day! Log your first meal or snack and let's crush your fitness goals together! 🔥"
                    protein >= 100.0 -> "Incredible job! $calories kcal and ${protein.toInt()}g protein! Your body is fully fueled and building muscle. Keep this awesome energy going! 💪🔥"
                    else -> "Awesome work logging $calories kcal and ${protein.toInt()}g protein today! You're making real progress step by step. Let's finish strong! 🌟"
                }
            }
            "scientific" -> {
                when {
                    protein < 50.0 -> "Current intake is $calories kcal with ${protein.toInt()}g protein. Muscle protein synthesis requires approximately 1.6g to 2.2g of protein per kg of body mass. Consider optimizing your leucine-rich amino acid intake."
                    else -> "Thermodynamic intake stands at $calories kcal with ${protein.toInt()}g of amino acid substrates. Energy balance and nitrogen retention are progressing within target metabolic ranges."
                }
            }
            else -> { // friendly
                when {
                    calories == 0 -> "Hey there! Whenever you're ready, log your meals so we can help you stay balanced and energized today! 😊"
                    protein < 60.0 -> "Great tracking! You're at $calories kcal with ${protein.toInt()}g protein. A quick protein snack like Greek yogurt, eggs, or paneer would be a fantastic boost!"
                    else -> "Fantastic job today! You've logged $calories kcal with ${protein.toInt()}g protein. You're nourishing your body well and staying consistent. Keep it up! 👏"
                }
            }
        }
    }

    suspend fun getCoachTemplates(): Result<Map<String, PromptTemplateDto>> = runCatching {
        api.getCoachTemplates()
    }

    suspend fun buildCoachPrompt(templateKey: String, profile: Map<String, String>): Result<BuildPromptResponse> = runCatching {
        api.buildCoachPrompt(BuildPromptRequest(templateKey, profile))
    }

    private fun compressImageFile(file: File): File {
        return try {
            val bmp = BitmapFactory.decodeFile(file.absolutePath) ?: return file
            val maxDim = 1280
            val w = bmp.width
            val h = bmp.height
            val scale = if (w > h && w > maxDim) maxDim.toFloat() / w else if (h > maxDim) maxDim.toFloat() / h else 1f
            val scaledBmp = if (scale < 1f) Bitmap.createScaledBitmap(bmp, (w * scale).toInt(), (h * scale).toInt(), true) else bmp

            val outFile = File.createTempFile("scan_", ".jpg")
            val out = FileOutputStream(outFile)
            scaledBmp.compress(Bitmap.CompressFormat.JPEG, 80, out)
            out.flush()
            out.close()
            outFile
        } catch (_: Exception) {
            file
        }
    }
}
