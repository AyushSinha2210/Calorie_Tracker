package com.foodcal.app.security

import android.content.Context
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * Multi-layer security manager providing:
 * 1. Biometric / Device Screen Lock authentication
 * 2. App Lock state verification
 * 3. Privacy protection flags
 */
class AppSecurityManager(private val context: Context) {

    private val sharedPrefs = context.getSharedPreferences("foodcal_security_prefs", Context.MODE_PRIVATE)

    private val _isAppLocked = MutableStateFlow(isAppLockEnabled())
    val isAppLocked: Flow<Boolean> = _isAppLocked.asStateFlow()

    fun isAppLockEnabled(): Boolean {
        return sharedPrefs.getBoolean("app_lock_enabled", false)
    }

    fun setAppLockEnabled(enabled: Boolean) {
        sharedPrefs.edit().putBoolean("app_lock_enabled", enabled).apply()
        _isAppLocked.value = enabled
    }

    fun isScreenSecurityEnabled(): Boolean {
        return false
    }

    fun setScreenSecurityEnabled(enabled: Boolean) {
        sharedPrefs.edit().putBoolean("screen_security_enabled", false).apply()
    }

    /**
     * Checks if the device has biometric or screen lock hardware available.
     */
    fun canAuthenticate(): Boolean {
        val biometricManager = BiometricManager.from(context)
        val authenticators = BiometricManager.Authenticators.BIOMETRIC_STRONG or
                BiometricManager.Authenticators.DEVICE_CREDENTIAL
        return biometricManager.canAuthenticate(authenticators) == BiometricManager.BIOMETRIC_SUCCESS
    }

    /**
     * Shows the biometric / device credentials prompt.
     */
    fun authenticate(
        activity: FragmentActivity,
        title: String = "Unlock FoodCal",
        subtitle: String = "Authenticate to access your fitness records",
        onSuccess: () -> Unit,
        onError: (String) -> Unit
    ) {
        val executor = ContextCompat.getMainExecutor(activity)
        val promptInfo = BiometricPrompt.PromptInfo.Builder()
            .setTitle(title)
            .setSubtitle(subtitle)
            .setAllowedAuthenticators(
                BiometricManager.Authenticators.BIOMETRIC_STRONG or
                        BiometricManager.Authenticators.DEVICE_CREDENTIAL
            )
            .build()

        val biometricPrompt = BiometricPrompt(
            activity,
            executor,
            object : BiometricPrompt.AuthenticationCallback() {
                override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                    super.onAuthenticationSucceeded(result)
                    onSuccess()
                }

                override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                    super.onAuthenticationError(errorCode, errString)
                    onError(errString.toString())
                }

                override fun onAuthenticationFailed() {
                    super.onAuthenticationFailed()
                    onError("Authentication failed. Please try again.")
                }
            }
        )

        biometricPrompt.authenticate(promptInfo)
    }
}

