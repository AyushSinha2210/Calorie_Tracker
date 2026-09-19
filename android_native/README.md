# FoodCal Native Android App

Modern, lightning-fast native Android client for **FoodCal** built with **Kotlin**, **Jetpack Compose (Material 3)**, **CameraX**, and **Firebase Firestore + Auth**. Matches Cal AI-style meal scanning with real-time bidirectional sync to the web dashboard.

---

## 🌟 Key Features

1. **Instant Meal Photo Scanner (Cal AI style)**:
   - CameraX real-time viewfinder with torch, camera flip, and gallery upload.
   - Animated laser scan overlay with Gemini AI multimodal vision analysis.
   - 1–10 Health Score gauge with actionable dietary tips.
   - Proportional macro recalculation when meal item portions are adjusted.
   - Saved with `source: "scan"` and full nutritional breakdown (`calories`, `protein`, `carbs`, `fat`).

2. **Cal AI Hero Dashboard**:
   - Custom animated circular Calorie Ring with eaten, burned, and remaining kcal stats.
   - Macro progress meters: Protein (`#F43F5E`), Carbs (`#F59E0B`), Fat (`#38BDF8`).
   - Interactive 7-day horizontal day strip with quick date switching.
   - Real-time Firestore sync with offline persistence.

3. **Smart Food & Workout Tracking**:
   - Tabbed food logging: Instant Photo Scan, Natural Language AI text analysis, and manual entry.
   - Workout logger with cardio, weighted, bodyweight, and isometric input types with MET calorie estimation.

4. **Progress & Analytics**:
   - 7-Day calorie history bar chart with target threshold line.
   - 7-Day protein intake chart.
   - Weight progression line chart with check-in history.

5. **AI Health Coach & Prompt Library**:
   - Customizable coaching persona: Friendly, Tough Love, Direct, Enthusiastic, Scientific.
   - Daily performance evaluation.
   - Prompt library with one-tap copy for Gemini and ChatGPT.

---

## 🏗 Architecture & Tech Stack

- **Language:** Kotlin 2.1.20
- **UI Framework:** Jetpack Compose (BOM 2025.02.00) + Material 3
- **Dependency Injection:** Lightweight Manual DI via `AppContainer` (fast build times, zero reflection overhead)
- **Database & Auth:** Firebase Auth + Cloud Firestore SDK with offline persistence
- **Networking:** Retrofit 2.11 + OkHttp 4.12 + Kotlinx Serialization
- **Camera:** CameraX 1.4.1 (Camera2, Lifecycle, View)
- **Images:** Coil 2.7.0
- **Visuals:** Custom Canvas drawing (calorie ring, laser scanner, bar & line charts)

---

## ⚙️ Configuration (`local.properties`)

Ensure `android_native/local.properties` contains your Firebase project credentials and backend URL:

```properties
sdk.dir=C\:\\Users\\<USER>\\AppData\\Local\\Android\\Sdk
foodcalApiBaseUrl=https\://calorie-tracker-k014.onrender.com/
firebaseApiKey=AIzaSyDxuO_oEg2WM4e22X0kyu-tkzZuVvUmlsQ
firebaseAppId=1\:906126032220\:web\:fb1e8f3700cc1a69a01599
firebaseMessagingSenderId=906126032220
firebaseProjectId=calorie-tracker-c483b
firebaseStorageBucket=calorie-tracker-c483b.firebasestorage.app
firebaseWebClientId=
```

> **Security Note:** Private API keys (Gemini, Groq, FatSecret) remain strictly secured on the server backend (`server/.env`).

---

## 🔑 Firebase Google Sign-In Setup

To enable Google Sign-In with Firebase, register the Android app's debug SHA-1 fingerprint in the [Firebase Console](https://console.firebase.google.com/project/calorie-tracker-c483b/settings/general/android:com.foodcal.app):

- **Package Name:** `com.foodcal.app`
- **Debug SHA-1:** `06:88:8D:A1:D5:CA:24:1B:8A:7D:9F:9E:98:19:CF:FD:CC:22:90:C3`
- **Debug SHA-256:** `03:1E:ED:3D:80:DA:64:98:D0:94:73:16:68:C3:11:DA:77:F9:9C:C5:A9:99:5F:16:E9:56:5E:6E:40:B8:0F:65`

After registering, paste your Web Client ID into `local.properties`:
```properties
firebaseWebClientId=YOUR_WEB_CLIENT_ID.apps.googleusercontent.com
```

---

## 🚀 Building & Testing

Using PowerShell on Windows:

```powershell
# Set Java Home to Android Studio JDK 21
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"

# Run unit tests
.\gradlew.bat testDebugUnitTest

# Assemble Debug APK
.\gradlew.bat assembleDebug
```

The compiled APK will be located at:
`android_native/app/build/outputs/apk/debug/app-debug.apk`
