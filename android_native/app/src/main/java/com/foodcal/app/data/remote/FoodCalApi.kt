package com.foodcal.app.data.remote

import com.foodcal.app.data.model.*
import okhttp3.MultipartBody
import retrofit2.http.*

interface FoodCalApi {
    @Multipart
    @POST("scan-meal")
    suspend fun scanMeal(
        @Part image: MultipartBody.Part
    ): ScanMealResponse

    @Multipart
    @POST("analyze-food-image")
    suspend fun analyzeFoodImage(
        @Part image: MultipartBody.Part
    ): AnalyzeTextResponse

    @POST("analyze-food")
    suspend fun analyzeFood(
        @Body request: AnalyzeTextRequest
    ): AnalyzeTextResponse

    @POST("calculate-nutrition")
    suspend fun calculateNutrition(
        @Body request: CalculateNutritionRequest
    ): AnalyzeTextResponse

    @FormUrlEncoded
    @POST("lookup-food")
    suspend fun lookupFood(
        @Field("name") name: String,
        @Field("quantity") quantity: String = "100g"
    ): NutritionItem

    @GET("workout/search")
    suspend fun searchWorkouts(
        @Query("term") term: String
    ): List<WorkoutSearchItem>

    @GET("workout/exercise-info/{id}")
    suspend fun exerciseInfo(
        @Path("id") id: Int
    ): WorkoutExerciseInfo

    @POST("workout/calculate")
    suspend fun calculateWorkout(
        @Body request: WorkoutCalculationRequest
    ): WorkoutCalculationResponse

    @POST("ai-coach/comment")
    suspend fun coachComment(
        @Body request: CoachRequest
    ): CoachResponse

    @GET("ai-coach/templates")
    suspend fun getCoachTemplates(): Map<String, PromptTemplateDto>

    @POST("ai-coach/prompt")
    suspend fun buildCoachPrompt(
        @Body request: BuildPromptRequest
    ): BuildPromptResponse
}
