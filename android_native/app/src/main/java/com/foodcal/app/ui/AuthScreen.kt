package com.foodcal.app.ui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Email
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material.icons.outlined.Visibility
import androidx.compose.material.icons.outlined.VisibilityOff
import androidx.compose.ui.res.painterResource
import com.foodcal.app.R
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.TabRowDefaults
import androidx.compose.material3.TabRowDefaults.tabIndicatorOffset
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
fun AuthScreen(
    state: AuthState,
    onEmailSignIn: (String, String) -> Unit,
    onRegister: (String, String, String) -> Unit,
    onGoogleSignIn: () -> Unit,
    onForgotPassword: (String) -> Unit,
    hasGoogleClientId: Boolean
) {
    var selectedTab by remember { mutableIntStateOf(0) } // 0: Sign In, 1: Register
    var name by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var passwordVisible by remember { mutableStateOf(false) }
    var showForgotDialog by remember { mutableStateOf(false) }
    var showGoogleSetupDialog by remember { mutableStateOf(false) }
    var forgotEmail by remember { mutableStateOf("") }

    val scrollState = rememberScrollState()

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(ColorDarkBg)
            .padding(horizontal = 24.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(scrollState),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Spacer(modifier = Modifier.height(48.dp))

            // Logo & Tagline
            FoodCalLogo(
                size = 56.dp,
                showWordmark = true
            )

            Spacer(modifier = Modifier.height(10.dp))

            Text(
                text = "Track smarter. Eat better. Reach your goals.",
                style = MaterialTheme.typography.bodyMedium,
                color = ColorDarkMuted,
                textAlign = TextAlign.Center
            )

            Spacer(modifier = Modifier.height(32.dp))

            // Card container
            GlassCard(
                modifier = Modifier.fillMaxWidth()
            ) {
                // Tab Row for Sign In / Register
                TabRow(
                    selectedTabIndex = selectedTab,
                    containerColor = Color.Transparent,
                    contentColor = ColorBrandEmerald,
                    indicator = { tabPositions ->
                        TabRowDefaults.SecondaryIndicator(
                            modifier = Modifier.tabIndicatorOffset(tabPositions[selectedTab]),
                            color = ColorBrandEmerald
                        )
                    },
                    divider = {}
                ) {
                    Tab(
                        selected = selectedTab == 0,
                        onClick = { selectedTab = 0 },
                        text = {
                            Text(
                                "Sign In",
                                fontWeight = if (selectedTab == 0) FontWeight.Bold else FontWeight.Normal,
                                color = if (selectedTab == 0) Color.White else ColorDarkMuted
                            )
                        }
                    )
                    Tab(
                        selected = selectedTab == 1,
                        onClick = { selectedTab = 1 },
                        text = {
                            Text(
                                "Create Account",
                                fontWeight = if (selectedTab == 1) FontWeight.Bold else FontWeight.Normal,
                                color = if (selectedTab == 1) Color.White else ColorDarkMuted
                            )
                        }
                    )
                }

                Spacer(modifier = Modifier.height(20.dp))

                // Error / Info banner
                AnimatedVisibility(visible = state is AuthState.Error) {
                    val msg = (state as? AuthState.Error)?.message.orEmpty()
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(12.dp))
                            .background(Color(0xFF7F1D1D).copy(alpha = 0.4f))
                            .padding(12.dp)
                    ) {
                        Text(
                            text = msg,
                            color = Color(0xFFFCA5A5),
                            style = MaterialTheme.typography.bodySmall
                        )
                    }
                    Spacer(modifier = Modifier.height(14.dp))
                }

                AnimatedVisibility(visible = state is AuthState.PasswordResetSent) {
                    val resetEmail = (state as? AuthState.PasswordResetSent)?.email.orEmpty()
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(12.dp))
                            .background(ColorBrandEmerald.copy(alpha = 0.2f))
                            .padding(12.dp)
                    ) {
                        Text(
                            text = "Password reset instructions sent to $resetEmail.",
                            color = ColorBrandEmerald,
                            style = MaterialTheme.typography.bodySmall
                        )
                    }
                    Spacer(modifier = Modifier.height(14.dp))
                }

                // Name field if Registering
                if (selectedTab == 1) {
                    OutlinedTextField(
                        value = name,
                        onValueChange = { name = it },
                        modifier = Modifier.fillMaxWidth(),
                        label = { Text("Your Name") },
                        leadingIcon = { Icon(Icons.Outlined.Person, contentDescription = null, tint = ColorDarkMuted) },
                        singleLine = true,
                        colors = outlinedTextFieldColors()
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                }

                // Email field
                OutlinedTextField(
                    value = email,
                    onValueChange = { email = it },
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text("Email Address") },
                    leadingIcon = { Icon(Icons.Outlined.Email, contentDescription = null, tint = ColorDarkMuted) },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                    singleLine = true,
                    colors = outlinedTextFieldColors()
                )

                Spacer(modifier = Modifier.height(12.dp))

                // Password field
                OutlinedTextField(
                    value = password,
                    onValueChange = { password = it },
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text("Password") },
                    leadingIcon = { Icon(Icons.Outlined.Lock, contentDescription = null, tint = ColorDarkMuted) },
                    trailingIcon = {
                        IconButton(onClick = { passwordVisible = !passwordVisible }) {
                            Icon(
                                if (passwordVisible) Icons.Outlined.VisibilityOff else Icons.Outlined.Visibility,
                                contentDescription = "Toggle password visibility",
                                tint = ColorDarkMuted
                            )
                        }
                    },
                    visualTransformation = if (passwordVisible) VisualTransformation.None else PasswordVisualTransformation(),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                    singleLine = true,
                    colors = outlinedTextFieldColors()
                )

                if (selectedTab == 0) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.End
                    ) {
                        TextButton(
                            onClick = {
                                forgotEmail = email
                                showForgotDialog = true
                            }
                        ) {
                            Text(
                                "Forgot password?",
                                color = ColorBrandEmerald,
                                style = MaterialTheme.typography.labelMedium
                            )
                        }
                    }
                } else {
                    Spacer(modifier = Modifier.height(16.dp))
                }

                // Action button
                val isLoading = state is AuthState.Loading
                Button(
                    onClick = {
                        if (selectedTab == 0) {
                            onEmailSignIn(email, password)
                        } else {
                            onRegister(name, email, password)
                        }
                    },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(50.dp),
                    enabled = !isLoading,
                    shape = RoundedCornerShape(14.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = ColorBrandEmerald,
                        contentColor = Color(0xFF042F1A)
                    )
                ) {
                    if (isLoading) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(22.dp),
                            color = Color(0xFF042F1A),
                            strokeWidth = 2.5.dp
                        )
                    } else {
                        Text(
                            text = if (selectedTab == 0) "Sign In" else "Create Account",
                            fontWeight = FontWeight.Bold,
                            fontSize = 16.sp
                        )
                    }
                }

                // Google Sign In button
                Spacer(modifier = Modifier.height(14.dp))
                OutlinedButton(
                    onClick = {
                        if (hasGoogleClientId) {
                            onGoogleSignIn()
                        } else {
                            showGoogleSetupDialog = true
                        }
                    },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(50.dp),
                    enabled = !isLoading,
                    shape = RoundedCornerShape(14.dp),
                    colors = ButtonDefaults.outlinedButtonColors(
                        contentColor = Color.White
                    )
                ) {
                    Icon(
                        painter = painterResource(id = R.drawable.ic_google_logo),
                        contentDescription = "Google Logo",
                        tint = Color.Unspecified,
                        modifier = Modifier.size(20.dp)
                    )
                    Spacer(modifier = Modifier.width(10.dp))
                    Text("Continue with Google", fontWeight = FontWeight.SemiBold)
                }
            }

            Spacer(modifier = Modifier.height(48.dp))
        }

        // Forgot Password Dialog
        if (showForgotDialog) {
            AlertDialog(
                onDismissRequest = { showForgotDialog = false },
                title = { Text("Reset Password", fontWeight = FontWeight.Bold) },
                text = {
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Text("Enter your email address to receive a password reset link.")
                        OutlinedTextField(
                            value = forgotEmail,
                            onValueChange = { forgotEmail = it },
                            modifier = Modifier.fillMaxWidth(),
                            label = { Text("Email") },
                            singleLine = true,
                            colors = outlinedTextFieldColors()
                        )
                    }
                },
                confirmButton = {
                    Button(
                        onClick = {
                            onForgotPassword(forgotEmail)
                            showForgotDialog = false
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = ColorBrandEmerald)
                    ) {
                        Text("Send Link")
                    }
                },
                dismissButton = {
                    TextButton(onClick = { showForgotDialog = false }) {
                        Text("Cancel", color = ColorDarkMuted)
                    }
                },
                containerColor = ColorDarkSurface,
                titleContentColor = Color.White,
                textContentColor = ColorDarkMuted
            )
        }

        // Google Setup Guide Dialog
        if (showGoogleSetupDialog) {
            AlertDialog(
                onDismissRequest = { showGoogleSetupDialog = false },
                title = { Text("Google Sign-In Setup", fontWeight = FontWeight.Bold) },
                text = {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text(
                            "To enable 1-tap Google Sign-In with Firebase:",
                            style = MaterialTheme.typography.bodySmall,
                            color = ColorDarkMuted
                        )
                        Text(
                            "1. Open Firebase Console -> Authentication -> Sign-in method -> Google.\n2. Under 'Web SDK configuration', copy Web Client ID.\n3. Add to android_native/local.properties as:\n   firebaseWebClientId=YOUR_CLIENT_ID",
                            style = MaterialTheme.typography.bodySmall,
                            color = Color.White
                        )
                        Text(
                            "Debug SHA-1 fingerprint:\n06:88:8D:A1:D5:CA:24:1B:8A:7D:9F:9E:98:19:CF:FD:CC:22:90:C3",
                            style = MaterialTheme.typography.bodySmall,
                            color = ColorBrandEmerald
                        )
                    }
                },
                confirmButton = {
                    Button(
                        onClick = { showGoogleSetupDialog = false },
                        colors = ButtonDefaults.buttonColors(containerColor = ColorBrandEmerald)
                    ) {
                        Text("Got it", color = Color(0xFF042F1A), fontWeight = FontWeight.Bold)
                    }
                },
                containerColor = ColorDarkSurface,
                titleContentColor = Color.White,
                textContentColor = ColorDarkMuted
            )
        }
    }
}

@Composable
private fun outlinedTextFieldColors() = OutlinedTextFieldDefaults.colors(
    focusedBorderColor = ColorBrandEmerald,
    unfocusedBorderColor = ColorDarkBorder,
    focusedLabelColor = ColorBrandEmerald,
    unfocusedLabelColor = ColorDarkMuted,
    focusedTextColor = Color.White,
    unfocusedTextColor = Color.White,
    cursorColor = ColorBrandEmerald
)
