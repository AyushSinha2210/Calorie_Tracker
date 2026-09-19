import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.serialization")
    id("org.jetbrains.kotlin.plugin.compose")
}

val localProperties = Properties().apply {
    val localFile = rootProject.file("local.properties")
    if (localFile.exists()) {
        load(localFile.inputStream())
    }
}

android {
    namespace = "com.foodcal.app"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.foodcal.app"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        vectorDrawables.useSupportLibrary = true

        val apiBaseUrl = localProperties.getProperty("foodcalApiBaseUrl") ?: "https://calorie-tracker-k014.onrender.com/"
        val fbApiKey = localProperties.getProperty("firebaseApiKey") ?: ""
        val fbAppId = localProperties.getProperty("firebaseAppId") ?: ""
        val fbSenderId = localProperties.getProperty("firebaseMessagingSenderId") ?: ""
        val fbProjectId = localProperties.getProperty("firebaseProjectId") ?: "calorie-tracker-c483b"
        val fbStorageBucket = localProperties.getProperty("firebaseStorageBucket") ?: "calorie-tracker-c483b.firebasestorage.app"
        val fbWebClientId = localProperties.getProperty("firebaseWebClientId") ?: ""

        buildConfigField("String", "API_BASE_URL", "\"$apiBaseUrl\"")
        buildConfigField("String", "FIREBASE_API_KEY", "\"$fbApiKey\"")
        buildConfigField("String", "FIREBASE_APP_ID", "\"$fbAppId\"")
        buildConfigField("String", "FIREBASE_SENDER_ID", "\"$fbSenderId\"")
        buildConfigField("String", "FIREBASE_PROJECT_ID", "\"$fbProjectId\"")
        buildConfigField("String", "FIREBASE_STORAGE_BUCKET", "\"$fbStorageBucket\"")
        buildConfigField("String", "FIREBASE_WEB_CLIENT_ID", "\"$fbWebClientId\"")
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlin {
        compilerOptions {
            jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17)
        }
    }
    buildFeatures {
        compose = true
        buildConfig = true
    }
    packaging {
        resources.excludes += "/META-INF/{AL2.0,LGPL2.1}"
    }
}

dependencies {
    val composeBom = platform("androidx.compose:compose-bom:2025.02.00")
    implementation(composeBom)
    androidTestImplementation(composeBom)

    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.core:core-splashscreen:1.0.1")
    implementation("androidx.activity:activity-compose:1.10.1")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material3:material3-window-size-class")
    implementation("androidx.compose.material:material-icons-extended")
    implementation("androidx.navigation:navigation-compose:2.8.8")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.8.7")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.7")
    implementation("androidx.datastore:datastore-preferences:1.1.2")
    implementation("androidx.biometric:biometric:1.1.0")

    // CameraX for food scanning
    val cameraVersion = "1.4.1"
    implementation("androidx.camera:camera-core:$cameraVersion")
    implementation("androidx.camera:camera-camera2:$cameraVersion")
    implementation("androidx.camera:camera-lifecycle:$cameraVersion")
    implementation("androidx.camera:camera-view:$cameraVersion")
    implementation("androidx.concurrent:concurrent-futures-ktx:1.2.0")
    implementation("com.google.guava:guava:33.3.1-android")

    // Network & Serialization
    implementation("com.squareup.retrofit2:retrofit:2.11.0")
    implementation("com.jakewharton.retrofit:retrofit2-kotlinx-serialization-converter:1.0.0")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.8.0")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("com.squareup.okhttp3:logging-interceptor:4.12.0")

    // Image loading
    implementation("io.coil-kt:coil-compose:2.7.0")

    // Firebase (Auth & Firestore)
    implementation("com.google.firebase:firebase-auth:23.2.0")
    implementation("com.google.firebase:firebase-firestore:25.1.2")
    implementation("com.google.android.gms:play-services-auth:21.3.0")

    // Testing
    testImplementation("junit:junit:4.13.2")
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.10.1")
    debugImplementation("androidx.compose.ui:ui-tooling")
    debugImplementation("androidx.compose.ui:ui-test-manifest")
}
