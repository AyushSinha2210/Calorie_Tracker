package com.foodcal.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.material3.windowsizeclass.ExperimentalMaterial3WindowSizeClassApi
import androidx.compose.material3.windowsizeclass.calculateWindowSizeClass
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.foodcal.app.ui.AuthScreen
import com.foodcal.app.ui.AuthState
import com.foodcal.app.ui.AuthViewModel
import com.foodcal.app.ui.ColorDarkBg
import com.foodcal.app.ui.FoodCalApp
import com.foodcal.app.ui.FoodCalTheme
import com.foodcal.app.ui.MainViewModel
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.auth.api.signin.GoogleSignInOptions
import com.google.android.gms.common.api.ApiException
import com.google.firebase.auth.FirebaseAuth

import androidx.fragment.app.FragmentActivity
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Fingerprint
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.foodcal.app.ui.ColorBrandEmerald
import com.foodcal.app.ui.ColorDarkMuted
import com.foodcal.app.ui.FoodCalLogo
import com.foodcal.app.ui.FoodCalOpeningAnimatedLogo

class MainActivity : FragmentActivity() {

    @OptIn(ExperimentalMaterial3WindowSizeClassApi::class)
    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        val app = application as FoodCalApplication
        val container = app.container

        // Explicitly clear FLAG_SECURE so user can capture screenshots freely on device
        window.clearFlags(android.view.WindowManager.LayoutParams.FLAG_SECURE)

        setContent {
            val windowSizeClass = calculateWindowSizeClass(this)
            FoodCalTheme(darkTheme = true) {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = ColorDarkBg
                ) {
                    val authViewModel: AuthViewModel = viewModel(
                        factory = AuthViewModel.provideFactory(container.auth, container.firestore)
                    )
                    val authState by authViewModel.state.collectAsStateWithLifecycle()

                    var currentUser by remember { mutableStateOf(container.auth.currentUser) }

                    DisposableEffect(container.auth) {
                        val listener = FirebaseAuth.AuthStateListener { fbAuth ->
                            currentUser = fbAuth.currentUser
                        }
                        container.auth.addAuthStateListener(listener)
                        onDispose {
                            container.auth.removeAuthStateListener(listener)
                        }
                    }

                    val hasGoogleWebClientId = BuildConfig.FIREBASE_WEB_CLIENT_ID.isNotBlank()

                    val googleSignInLauncher = rememberLauncherForActivityResult(
                        contract = ActivityResultContracts.StartActivityForResult()
                    ) { result ->
                        if (result.resultCode == RESULT_OK && result.data != null) {
                            runCatching {
                                GoogleSignIn.getSignedInAccountFromIntent(result.data)
                                    .getResult(ApiException::class.java)
                            }.onSuccess { account ->
                                val token = account.idToken
                                if (token != null) {
                                    authViewModel.googleSignIn(token)
                                } else {
                                    authViewModel.setError("Google sign-in did not return an ID token. Ensure debug SHA-1 is added in Firebase console.")
                                }
                            }.onFailure { e ->
                                val msg = if (e is ApiException) {
                                    when (e.statusCode) {
                                        10 -> "Configuration error (Code 10: DEVELOPER_ERROR). Please ensure SHA-1 fingerprint is registered in Firebase console."
                                        12500 -> "Sign-in error (Code 12500). Please check Google Play Services on your device."
                                        else -> "Google sign-in error (${e.statusCode}): ${e.localizedMessage}"
                                    }
                                } else {
                                    e.localizedMessage ?: "Google sign-in failed."
                                }
                                authViewModel.setError(msg)
                            }
                        } else if (result.resultCode != RESULT_CANCELED) {
                            authViewModel.setError("Google sign-in was cancelled or failed.")
                        }
                    }

                    val activityRecognitionLauncher = rememberLauncherForActivityResult(
                        contract = ActivityResultContracts.RequestPermission()
                    ) { isGranted ->
                        if (isGranted) {
                            container.stepTrackerManager.registerSensorListener()
                            container.stepTrackerManager.syncStepsOnAppOpen()
                        }
                    }

                    LaunchedEffect(currentUser) {
                        if (currentUser != null) {
                            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.Q) {
                                if (checkSelfPermission(android.Manifest.permission.ACTIVITY_RECOGNITION) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                                    activityRecognitionLauncher.launch(android.Manifest.permission.ACTIVITY_RECOGNITION)
                                } else {
                                    container.stepTrackerManager.syncStepsOnAppOpen()
                                }
                            } else {
                                container.stepTrackerManager.syncStepsOnAppOpen()
                            }
                        }
                    }

                    var isOpeningApp by remember { mutableStateOf(true) }

                    LaunchedEffect(Unit) {
                        // Fast, snappy opening logo animation: 480ms
                        kotlinx.coroutines.delay(480)
                        isOpeningApp = false
                    }

                    if (isOpeningApp) {
                        Box(
                            modifier = Modifier
                                .fillMaxSize()
                                .background(ColorDarkBg),
                            contentAlignment = Alignment.Center
                        ) {
                            FoodCalOpeningAnimatedLogo(size = 80.dp, showWordmark = true)
                        }
                    } else if (currentUser != null) {
                        var isUnlocked by remember { mutableStateOf(!container.securityManager.isAppLockEnabled()) }

                        LaunchedEffect(Unit) {
                            if (container.securityManager.isAppLockEnabled() && container.securityManager.canAuthenticate()) {
                                container.securityManager.authenticate(
                                    activity = this@MainActivity,
                                    onSuccess = { isUnlocked = true },
                                    onError = { /* Keep locked until user taps button */ }
                                )
                            }
                        }

                        if (!isUnlocked) {
                            Box(
                                modifier = Modifier
                                    .fillMaxSize()
                                    .background(ColorDarkBg),
                                contentAlignment = Alignment.Center
                            ) {
                                Column(
                                    horizontalAlignment = Alignment.CenterHorizontally,
                                    verticalArrangement = Arrangement.spacedBy(16.dp)
                                ) {
                                    FoodCalLogo(size = 64.dp)
                                    Spacer(modifier = Modifier.height(6.dp))
                                    Text(
                                        text = "FoodCal is Locked",
                                        style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold),
                                        color = Color.White
                                    )
                                    Text(
                                        text = "Biometric protection is active on this device.",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = ColorDarkMuted
                                    )
                                    Spacer(modifier = Modifier.height(10.dp))
                                    Button(
                                        onClick = {
                                            container.securityManager.authenticate(
                                                activity = this@MainActivity,
                                                onSuccess = { isUnlocked = true },
                                                onError = { authViewModel.setError(it) }
                                            )
                                        },
                                        colors = ButtonDefaults.buttonColors(containerColor = ColorBrandEmerald)
                                    ) {
                                        Icon(Icons.Default.Fingerprint, contentDescription = null, tint = Color(0xFF042F1A))
                                        Spacer(modifier = Modifier.width(8.dp))
                                        Text("Unlock with Biometrics", color = Color(0xFF042F1A), fontWeight = FontWeight.Bold)
                                    }
                                }
                            }
                        } else {
                            val mainViewModel: MainViewModel = viewModel(
                                key = currentUser!!.uid,
                                factory = MainViewModel.provideFactory(
                                    container.repository,
                                    container.stepTrackerManager,
                                    container.stravaManager
                                )
                            )
                            FoodCalApp(
                                viewModel = mainViewModel,
                                windowWidthSizeClass = windowSizeClass.widthSizeClass,
                                onSignOut = {
                                    authViewModel.signOut()
                                }
                            )
                        }
                    } else {
                        AuthScreen(
                            state = authState,
                            onEmailSignIn = { email, pass ->
                                authViewModel.emailSignIn(email, pass)
                            },
                            onRegister = { name, email, pass ->
                                authViewModel.register(name, email, pass)
                            },
                            onGoogleSignIn = {
                                if (hasGoogleWebClientId) {
                                    val gso = GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
                                        .requestIdToken(BuildConfig.FIREBASE_WEB_CLIENT_ID)
                                        .requestEmail()
                                        .build()
                                    val client = GoogleSignIn.getClient(this@MainActivity, gso)
                                    client.signOut().addOnCompleteListener {
                                        googleSignInLauncher.launch(client.signInIntent)
                                    }
                                }
                            },
                            onForgotPassword = { email ->
                                authViewModel.sendPasswordReset(email)
                            },
                            hasGoogleClientId = hasGoogleWebClientId
                        )
                    }
                }
            }
        }
    }

    override fun onResume() {
        super.onResume()
        val app = application as? FoodCalApplication
        app?.container?.let { c ->
            if (c.auth.currentUser != null) {
                c.stepTrackerManager.syncStepsOnAppOpen()
            }
        }
    }
}
