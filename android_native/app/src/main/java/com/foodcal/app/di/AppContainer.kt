package com.foodcal.app.di

import android.content.Context
import com.foodcal.app.BuildConfig
import com.foodcal.app.data.remote.FoodCalApi
import com.foodcal.app.data.repository.FoodCalRepository
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.FirebaseFirestoreSettings
import com.google.firebase.firestore.PersistentCacheSettings
import com.jakewharton.retrofit2.converter.kotlinx.serialization.asConverterFactory
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import java.util.concurrent.TimeUnit

class AppContainer(private val context: Context) {

    val firebaseApp: FirebaseApp by lazy {
        if (FirebaseApp.getApps(context).isNotEmpty()) {
            FirebaseApp.getInstance()
        } else {
            val options = FirebaseOptions.Builder()
                .setApiKey(BuildConfig.FIREBASE_API_KEY)
                .setApplicationId(BuildConfig.FIREBASE_APP_ID)
                .setGcmSenderId(BuildConfig.FIREBASE_SENDER_ID)
                .setProjectId(BuildConfig.FIREBASE_PROJECT_ID)
                .setStorageBucket(BuildConfig.FIREBASE_STORAGE_BUCKET)
                .build()
            FirebaseApp.initializeApp(context, options)
        }
    }

    val auth: FirebaseAuth by lazy {
        FirebaseAuth.getInstance(firebaseApp)
    }

    val firestore: FirebaseFirestore by lazy {
        FirebaseFirestore.getInstance(firebaseApp).apply {
            val settings = FirebaseFirestoreSettings.Builder()
                .setLocalCacheSettings(
                    PersistentCacheSettings.newBuilder()
                        .setSizeBytes(FirebaseFirestoreSettings.CACHE_SIZE_UNLIMITED)
                        .build()
                )
                .build()
            firestoreSettings = settings
        }
    }

    private val json: Json by lazy {
        Json {
            ignoreUnknownKeys = true
            coerceInputValues = true
            isLenient = true
        }
    }

    private val okHttpClient: OkHttpClient by lazy {
        val logging = HttpLoggingInterceptor().apply {
            level = if (BuildConfig.DEBUG) HttpLoggingInterceptor.Level.BASIC else HttpLoggingInterceptor.Level.NONE
        }
        OkHttpClient.Builder()
            .connectTimeout(60, TimeUnit.SECONDS)
            .readTimeout(120, TimeUnit.SECONDS) // Generous for Render free-tier cold starts
            .writeTimeout(60, TimeUnit.SECONDS)
            .addInterceptor(logging)
            .build()
    }

    val api: FoodCalApi by lazy {
        val baseUrl = if (BuildConfig.API_BASE_URL.endsWith("/")) BuildConfig.API_BASE_URL else "${BuildConfig.API_BASE_URL}/"
        Retrofit.Builder()
            .baseUrl(baseUrl)
            .client(okHttpClient)
            .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
            .build()
            .create(FoodCalApi::class.java)
    }

    val repository: FoodCalRepository by lazy {
        FoodCalRepository(api, auth, firestore)
    }

    val stepTrackerManager: com.foodcal.app.data.sensor.StepTrackerManager by lazy {
        com.foodcal.app.data.sensor.StepTrackerManager(context, firestore, auth)
    }

    val stravaManager: com.foodcal.app.data.remote.StravaManager by lazy {
        com.foodcal.app.data.remote.StravaManager(context, firestore, auth, okHttpClient)
    }

    val securityManager: com.foodcal.app.security.AppSecurityManager by lazy {
        com.foodcal.app.security.AppSecurityManager(context)
    }
}

