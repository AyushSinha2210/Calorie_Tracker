package com.foodcal.app.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.GoogleAuthProvider
import com.google.firebase.auth.UserProfileChangeRequest
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.SetOptions
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await

sealed interface AuthState {
    data object Idle : AuthState
    data object Loading : AuthState
    data object SignedIn : AuthState
    data class EmailVerificationSent(val email: String) : AuthState
    data class PasswordResetSent(val email: String) : AuthState
    data class Error(val message: String) : AuthState
}

class AuthViewModel(
    private val auth: FirebaseAuth,
    private val firestore: FirebaseFirestore
) : ViewModel() {

    private val _state = MutableStateFlow<AuthState>(AuthState.Idle)
    val state: StateFlow<AuthState> = _state

    val currentUser get() = auth.currentUser

    fun emailSignIn(email: String, password: String) = viewModelScope.launch {
        if (email.isBlank() || password.isBlank()) {
            _state.value = AuthState.Error("Please enter both email and password")
            return@launch
        }
        _state.value = AuthState.Loading
        _state.value = runCatching {
            val result = auth.signInWithEmailAndPassword(email.trim(), password).await()
            val user = result.user
            if (user != null) {
                firestore.collection("users").document(user.uid).set(
                    mapOf("lastActive" to FieldValue.serverTimestamp()),
                    SetOptions.merge()
                ).await()
            }
            AuthState.SignedIn
        }.getOrElse {
            AuthState.Error(it.localizedMessage ?: "Failed to sign in. Please check your credentials.")
        }
    }

    fun register(name: String, email: String, password: String) = viewModelScope.launch {
        if (email.isBlank() || password.isBlank()) {
            _state.value = AuthState.Error("Please enter all required fields")
            return@launch
        }
        if (password.length < 6) {
            _state.value = AuthState.Error("Password must be at least 6 characters")
            return@launch
        }
        _state.value = AuthState.Loading
        _state.value = runCatching {
            val result = auth.createUserWithEmailAndPassword(email.trim(), password).await()
            val user = result.user
            if (user != null) {
                if (name.isNotBlank()) {
                    user.updateProfile(UserProfileChangeRequest.Builder().setDisplayName(name.trim()).build()).await()
                }
                user.sendEmailVerification().await()

                val initialData = hashMapOf<String, Any?>(
                    "name" to name.trim(),
                    "email" to email.trim(),
                    "createdAt" to FieldValue.serverTimestamp(),
                    "lastActive" to FieldValue.serverTimestamp(),
                    "profileComplete" to false
                )
                firestore.collection("users").document(user.uid).set(initialData, SetOptions.merge()).await()
            }
            AuthState.SignedIn
        }.getOrElse {
            AuthState.Error(it.localizedMessage ?: "Registration failed. Please try again.")
        }
    }

    fun googleSignIn(idToken: String) = viewModelScope.launch {
        _state.value = AuthState.Loading
        _state.value = runCatching {
            val credential = GoogleAuthProvider.getCredential(idToken, null)
            val result = auth.signInWithCredential(credential).await()
            val user = result.user
            if (user != null) {
                val docRef = firestore.collection("users").document(user.uid)
                val snap = docRef.get().await()
                if (!snap.exists()) {
                    val initialData = hashMapOf<String, Any?>(
                        "name" to (user.displayName ?: ""),
                        "email" to (user.email ?: ""),
                        "createdAt" to FieldValue.serverTimestamp(),
                        "lastActive" to FieldValue.serverTimestamp(),
                        "profileComplete" to false
                    )
                    docRef.set(initialData, SetOptions.merge()).await()
                } else {
                    docRef.set(mapOf("lastActive" to FieldValue.serverTimestamp()), SetOptions.merge()).await()
                }
            }
            AuthState.SignedIn
        }.getOrElse {
            AuthState.Error(it.localizedMessage ?: "Google sign-in failed")
        }
    }

    fun sendPasswordReset(email: String) = viewModelScope.launch {
        if (email.isBlank()) {
            _state.value = AuthState.Error("Please enter your email to reset password")
            return@launch
        }
        _state.value = AuthState.Loading
        _state.value = runCatching {
            auth.sendPasswordResetEmail(email.trim()).await()
            AuthState.PasswordResetSent(email.trim())
        }.getOrElse {
            AuthState.Error(it.localizedMessage ?: "Could not send reset email")
        }
    }

    fun sendEmailVerification() = viewModelScope.launch {
        val user = auth.currentUser ?: return@launch
        _state.value = AuthState.Loading
        _state.value = runCatching {
            user.sendEmailVerification().await()
            AuthState.EmailVerificationSent(user.email.orEmpty())
        }.getOrElse {
            AuthState.Error(it.localizedMessage ?: "Could not send verification email")
        }
    }

    fun signOut() {
        auth.signOut()
        _state.value = AuthState.Idle
    }

    fun resetState() {
        _state.value = AuthState.Idle
    }

    fun setError(message: String) {
        _state.value = AuthState.Error(message)
    }

    companion object {
        fun provideFactory(auth: FirebaseAuth, firestore: FirebaseFirestore): ViewModelProvider.Factory =
            object : ViewModelProvider.Factory {
                @Suppress("UNCHECKED_CAST")
                override fun <T : ViewModel> create(modelClass: Class<T>): T {
                    return AuthViewModel(auth, firestore) as T
                }
            }
    }
}
