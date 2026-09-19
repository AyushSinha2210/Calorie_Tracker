package com.foodcal.app.ui

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.CloudDone
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Feedback
import androidx.compose.material.icons.filled.Fingerprint
import androidx.compose.material.icons.filled.Logout
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Security
import androidx.compose.material.icons.outlined.Edit
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.ui.layout.ContentScale
import coil.compose.AsyncImage
import com.foodcal.app.util.ImageUtils
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.fragment.app.FragmentActivity
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.foodcal.app.data.model.UserProfile
import kotlinx.coroutines.launch
import kotlin.math.roundToInt

@Composable
fun ProfileSettingsScreen(
    viewModel: MainViewModel,
    onSignOut: () -> Unit
) {
    val profile by viewModel.profile.collectAsStateWithLifecycle()
    val scope = rememberCoroutineScope()
    val snackbarHostState = remember { SnackbarHostState() }

    var showEditProfileDialog by remember { mutableStateOf(false) }
    var showFeedbackDialog by remember { mutableStateOf(false) }
    var feedbackText by remember { mutableStateOf("") }
    var isSendingFeedback by remember { mutableStateOf(false) }

    val context = LocalContext.current
    val securityManager = remember { com.foodcal.app.security.AppSecurityManager(context) }
    var isAppLockEnabled by remember { mutableStateOf(securityManager.isAppLockEnabled()) }
    var localImageOverride by remember { mutableStateOf<String?>(null) }

    val photoPickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent()
    ) { uri: Uri? ->
        if (uri != null && profile != null) {
            scope.launch {
                val dataUrl = ImageUtils.processProfileImageUri(context, uri)
                if (dataUrl != null) {
                    localImageOverride = dataUrl
                    val updated = profile!!.copy(profileImage = dataUrl)
                    viewModel.saveProfile(updated)
                    snackbarHostState.showSnackbar("Profile photo updated!")
                } else {
                    snackbarHostState.showSnackbar("Failed to process selected image.")
                }
            }
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(ColorDarkBg)
            .statusBarsPadding(),
        contentAlignment = Alignment.TopCenter
    ) {
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .widthIn(max = 840.dp)
                .padding(horizontal = 18.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            item {
                Spacer(modifier = Modifier.height(8.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        "Profile & Settings",
                        style = MaterialTheme.typography.headlineSmall.copy(fontWeight = FontWeight.Bold),
                        color = Color.White
                    )

                    IconButton(onClick = { showEditProfileDialog = true }) {
                        Icon(Icons.Outlined.Edit, contentDescription = "Edit Profile", tint = ColorBrandLime)
                    }
                }
            }

            // Profile Card
            item {
                GlassCard(modifier = Modifier.fillMaxWidth()) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                        Box(modifier = Modifier.size(68.dp)) {
                            ProfileAvatar(
                                imageSource = localImageOverride ?: profile?.profileImage,
                                displayName = profile?.name,
                                modifier = Modifier
                                    .size(68.dp)
                                    .border(2.dp, ColorBrandEmerald.copy(alpha = 0.7f), CircleShape)
                                    .clickable { photoPickerLauncher.launch("image/*") },
                                iconSize = 36.dp
                            )

                            // Camera edit badge on avatar
                            Box(
                                modifier = Modifier
                                    .size(24.dp)
                                    .align(Alignment.BottomEnd)
                                    .clip(CircleShape)
                                    .background(ColorBrandEmerald)
                                    .clickable { photoPickerLauncher.launch("image/*") },
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    Icons.Default.CameraAlt,
                                    contentDescription = "Change photo",
                                    tint = Color(0xFF042F1A),
                                    modifier = Modifier.size(14.dp)
                                )
                            }
                        }

                        Column {
                            Text(
                                text = profile?.name?.ifBlank { "Fitness Member" } ?: "Fitness Member",
                                style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold),
                                color = Color.White
                            )
                            Text(
                                text = profile?.email ?: "",
                                style = MaterialTheme.typography.bodySmall,
                                color = ColorDarkMuted
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(18.dp))

                    // Stats Grid
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(14.dp))
                            .background(ColorDarkSurface2)
                            .padding(14.dp),
                        horizontalArrangement = Arrangement.SpaceAround
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text("Weight", style = MaterialTheme.typography.labelSmall, color = ColorDarkMuted)
                            val wText = if (profile?.weightUnit == "lbs" && (profile?.originalWeight ?: 0.0) > 0) {
                                "${profile?.originalWeight} lbs"
                            } else {
                                "${profile?.weight ?: 0.0} kg"
                            }
                            Text(wText, fontWeight = FontWeight.Bold, color = Color.White)
                        }
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text("Height", style = MaterialTheme.typography.labelSmall, color = ColorDarkMuted)
                            val hText = if (profile?.heightUnit == "ft" && (profile?.originalHeight ?: 0.0) > 0) {
                                "${profile?.originalHeight} ft"
                            } else {
                                "${profile?.height ?: 0.0} cm"
                            }
                            Text(hText, fontWeight = FontWeight.Bold, color = Color.White)
                        }
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text("Age", style = MaterialTheme.typography.labelSmall, color = ColorDarkMuted)
                            Text("${profile?.age ?: 0}", fontWeight = FontWeight.Bold, color = Color.White)
                        }
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text("Daily Goal", style = MaterialTheme.typography.labelSmall, color = ColorDarkMuted)
                            Text("${profile?.dailyCalorieTarget ?: 2000} kcal", fontWeight = FontWeight.Bold, color = ColorBrandEmerald)
                        }
                    }
                }
            }

            // App & Account Settings
            item {
                Text("Preferences & Support", fontWeight = FontWeight.Bold, color = Color.White)
            }

            item {
                GlassCard(
                    modifier = Modifier.fillMaxWidth(),
                    onClick = { showFeedbackDialog = true }
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Icon(Icons.Default.Feedback, contentDescription = null, tint = ColorBrandLime)
                        Column {
                            Text("Send App Feedback", fontWeight = FontWeight.Bold, color = Color.White)
                            Text("Help us improve FoodCal with your suggestions", style = MaterialTheme.typography.bodySmall, color = ColorDarkMuted)
                        }
                    }
                }
            }

            // Security & Privacy Card
            item {
                GlassCard(modifier = Modifier.fillMaxWidth()) {
                    Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            Icon(Icons.Default.Security, contentDescription = null, tint = ColorBrandLime)
                            Text("Security & Privacy", fontWeight = FontWeight.Bold, color = Color.White)
                        }

                        // Biometric App Lock toggle
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text("Biometric App Lock", fontWeight = FontWeight.SemiBold, color = Color.White)
                                Text("Require fingerprint or device PIN when opening FoodCal", style = MaterialTheme.typography.bodySmall, color = ColorDarkMuted)
                            }
                            Switch(
                                checked = isAppLockEnabled,
                                onCheckedChange = { enable ->
                                    if (enable) {
                                        val activity = context as? FragmentActivity
                                        if (activity != null && securityManager.canAuthenticate()) {
                                            securityManager.authenticate(
                                                activity = activity,
                                                title = "Enable App Lock",
                                                subtitle = "Verify identity to activate biometric protection",
                                                onSuccess = {
                                                    securityManager.setAppLockEnabled(true)
                                                    isAppLockEnabled = true
                                                    scope.launch { snackbarHostState.showSnackbar("Biometric lock enabled") }
                                                },
                                                onError = { err ->
                                                    scope.launch { snackbarHostState.showSnackbar(err) }
                                                }
                                            )
                                        } else {
                                            securityManager.setAppLockEnabled(true)
                                            isAppLockEnabled = true
                                            scope.launch { snackbarHostState.showSnackbar("App lock enabled") }
                                        }
                                    } else {
                                        securityManager.setAppLockEnabled(false)
                                        isAppLockEnabled = false
                                        scope.launch { snackbarHostState.showSnackbar("App lock disabled") }
                                    }
                                },
                                colors = SwitchDefaults.colors(
                                    checkedThumbColor = ColorBrandLime,
                                    checkedTrackColor = ColorBrandEmerald,
                                    uncheckedThumbColor = ColorDarkMuted,
                                    uncheckedTrackColor = ColorDarkSurface2
                                )
                            )
                        }

                        // Offline Mobile Cache status
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(10.dp))
                                .background(ColorDarkSurface2)
                                .padding(10.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            Icon(Icons.Default.CloudDone, contentDescription = null, tint = ColorBrandEmerald, modifier = Modifier.size(20.dp))
                            Column {
                                Text("Encrypted Offline Mobile Storage", fontWeight = FontWeight.Bold, color = Color.White, style = MaterialTheme.typography.labelMedium)
                                Text("Active: All meal, workout, and weight logs are cached on this device for instant offline access.", style = MaterialTheme.typography.labelSmall, color = ColorDarkMuted)
                            }
                        }
                    }
                }
            }

            item {
                GlassCard(
                    modifier = Modifier.fillMaxWidth(),
                    onClick = onSignOut
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Icon(Icons.Default.Logout, contentDescription = null, tint = Color(0xFFEF4444))
                        Column {
                            Text("Sign Out", fontWeight = FontWeight.Bold, color = Color(0xFFEF4444))
                            Text("Log out of your FoodCal account", style = MaterialTheme.typography.bodySmall, color = ColorDarkMuted)
                        }
                    }
                }
            }

            item {
                Spacer(modifier = Modifier.height(80.dp).navigationBarsPadding())
            }
        }

        SnackbarHost(
            hostState = snackbarHostState,
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .navigationBarsPadding()
                .padding(bottom = 16.dp)
        )
    }

    // Edit Profile Dialog
    if (showEditProfileDialog) {
        val cur = profile ?: UserProfile()
        var editName by remember { mutableStateOf(cur.name) }
        var editWeightUnit by remember { mutableStateOf(cur.weightUnit.ifBlank { "kg" }) }
        var editWeight by remember {
            val initial = if (cur.weightUnit == "lbs" && cur.originalWeight > 0) cur.originalWeight.toString() else cur.weight.toString()
            mutableStateOf(initial)
        }
        var editHeightUnit by remember { mutableStateOf(cur.heightUnit.ifBlank { "cm" }) }
        var editHeight by remember {
            val initial = if (cur.heightUnit == "ft" && cur.originalHeight > 0) cur.originalHeight.toString() else cur.height.toString()
            mutableStateOf(initial)
        }
        var editTarget by remember { mutableStateOf(cur.dailyCalorieTarget.toString()) }
        val dialogScroll = rememberScrollState()

        AlertDialog(
            onDismissRequest = { showEditProfileDialog = false },
            title = { Text("Edit Profile & Target", fontWeight = FontWeight.Bold) },
            text = {
                Column(
                    modifier = Modifier.verticalScroll(dialogScroll).imePadding(),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Button(
                            onClick = { photoPickerLauncher.launch("image/*") },
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(10.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = ColorDarkSurface2)
                        ) {
                            Icon(Icons.Default.CameraAlt, contentDescription = null, tint = ColorBrandLime, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("Change Photo", color = Color.White, style = MaterialTheme.typography.labelSmall)
                        }

                        if (!cur.profileImage.isNullOrBlank() || !localImageOverride.isNullOrBlank()) {
                            Button(
                                onClick = {
                                    localImageOverride = ""
                                    val updated = cur.copy(profileImage = "")
                                    viewModel.saveProfile(updated)
                                    scope.launch { snackbarHostState.showSnackbar("Profile photo removed") }
                                },
                                shape = RoundedCornerShape(10.dp),
                                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF3F1A1A))
                            ) {
                                Icon(Icons.Default.Delete, contentDescription = null, tint = Color(0xFFEF4444), modifier = Modifier.size(16.dp))
                                Spacer(modifier = Modifier.width(4.dp))
                                Text("Remove", color = Color(0xFFEF4444), style = MaterialTheme.typography.labelSmall)
                            }
                        }
                    }

                    OutlinedTextField(
                        value = editName,
                        onValueChange = { editName = it },
                        label = { Text("Display Name") },
                        singleLine = true,
                        colors = profileTextFieldColors()
                    )

                    // Weight with unit toggle
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        OutlinedTextField(
                            value = editWeight,
                            onValueChange = { editWeight = it },
                            label = { Text("Weight ($editWeightUnit)") },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                            modifier = Modifier.weight(1f),
                            singleLine = true,
                            colors = profileTextFieldColors()
                        )
                        Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                            listOf("kg", "lbs").forEach { u ->
                                FilterChip(
                                    selected = editWeightUnit == u,
                                    onClick = {
                                        if (editWeightUnit != u) {
                                            val num = editWeight.toDoubleOrNull()
                                            if (num != null) {
                                                editWeight = if (u == "lbs") {
                                                    ((num / 0.453592) * 10.0).roundToInt().div(10.0).toString()
                                                } else {
                                                    ((num * 0.453592) * 10.0).roundToInt().div(10.0).toString()
                                                }
                                            }
                                            editWeightUnit = u
                                        }
                                    },
                                    label = { Text(u, style = MaterialTheme.typography.labelSmall) },
                                    colors = FilterChipDefaults.filterChipColors(
                                        selectedContainerColor = ColorBrandEmerald,
                                        selectedLabelColor = Color(0xFF042F1A),
                                        containerColor = ColorDarkSurface2,
                                        labelColor = Color.White
                                    )
                                )
                            }
                        }
                    }

                    // Height with unit toggle
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        OutlinedTextField(
                            value = editHeight,
                            onValueChange = { editHeight = it },
                            label = { Text("Height ($editHeightUnit)") },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                            modifier = Modifier.weight(1f),
                            singleLine = true,
                            colors = profileTextFieldColors()
                        )
                        Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                            listOf("cm", "ft").forEach { u ->
                                FilterChip(
                                    selected = editHeightUnit == u,
                                    onClick = {
                                        if (editHeightUnit != u) {
                                            val num = editHeight.toDoubleOrNull()
                                            if (num != null) {
                                                editHeight = if (u == "ft") {
                                                    ((num / 30.48) * 100.0).roundToInt().div(100.0).toString()
                                                } else {
                                                    ((num * 30.48) * 10.0).roundToInt().div(10.0).toString()
                                                }
                                            }
                                            editHeightUnit = u
                                        }
                                    },
                                    label = { Text(u, style = MaterialTheme.typography.labelSmall) },
                                    colors = FilterChipDefaults.filterChipColors(
                                        selectedContainerColor = ColorBrandEmerald,
                                        selectedLabelColor = Color(0xFF042F1A),
                                        containerColor = ColorDarkSurface2,
                                        labelColor = Color.White
                                    )
                                )
                            }
                        }
                    }

                    OutlinedTextField(
                        value = editTarget,
                        onValueChange = { editTarget = it },
                        label = { Text("Daily Calorie Target") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        singleLine = true,
                        colors = profileTextFieldColors()
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        val rawW = editWeight.toDoubleOrNull() ?: cur.weight
                        val wKg = if (editWeightUnit == "lbs") ((rawW * 0.453592) * 10.0).roundToInt() / 10.0 else rawW
                        val rawH = editHeight.toDoubleOrNull() ?: cur.height
                        val hCm = if (editHeightUnit == "ft") ((rawH * 30.48) * 10.0).roundToInt() / 10.0 else rawH

                        val updated = cur.copy(
                            name = editName,
                            weight = wKg,
                            weightUnit = editWeightUnit,
                            originalWeight = rawW,
                            height = hCm,
                            heightUnit = editHeightUnit,
                            originalHeight = rawH,
                            dailyCalorieTarget = editTarget.toIntOrNull() ?: cur.dailyCalorieTarget
                        )
                        viewModel.saveProfile(updated)
                        showEditProfileDialog = false
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = ColorBrandEmerald)
                ) {
                    Text("Save Changes", color = Color(0xFF042F1A), fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { showEditProfileDialog = false }) { Text("Cancel", color = ColorDarkMuted) }
            },
            containerColor = ColorDarkSurface,
            titleContentColor = Color.White,
            textContentColor = ColorDarkMuted
        )
    }

    // Feedback Dialog
    if (showFeedbackDialog) {
        val fbScroll = rememberScrollState()
        AlertDialog(
            onDismissRequest = { showFeedbackDialog = false },
            title = { Text("Send Feedback", fontWeight = FontWeight.Bold) },
            text = {
                Column(
                    modifier = Modifier.verticalScroll(fbScroll).imePadding(),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Text("Tell us what features you love or what we can build next.", color = ColorDarkMuted, style = MaterialTheme.typography.bodySmall)
                    OutlinedTextField(
                        value = feedbackText,
                        onValueChange = { feedbackText = it },
                        label = { Text("Your Message") },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(100.dp),
                        colors = profileTextFieldColors()
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        if (feedbackText.isNotBlank()) {
                            isSendingFeedback = true
                            viewModel.submitFeedback(feedbackText.trim(), profile?.email ?: "anonymous") { res ->
                                isSendingFeedback = false
                                if (res.isSuccess) {
                                    feedbackText = ""
                                    showFeedbackDialog = false
                                    scope.launch { snackbarHostState.showSnackbar("Thank you for your feedback!") }
                                } else {
                                    scope.launch {
                                        snackbarHostState.showSnackbar(
                                            "Failed to send feedback: ${res.exceptionOrNull()?.message ?: "Network error"}"
                                        )
                                    }
                                }
                            }
                        }
                    },
                    enabled = !isSendingFeedback && feedbackText.isNotBlank(),
                    colors = ButtonDefaults.buttonColors(containerColor = ColorBrandEmerald)
                ) {
                    if (isSendingFeedback) {
                        CircularProgressIndicator(modifier = Modifier.size(16.dp), color = Color(0xFF042F1A), strokeWidth = 2.dp)
                    } else {
                        Text("Submit", color = Color(0xFF042F1A), fontWeight = FontWeight.Bold)
                    }
                }
            },
            dismissButton = {
                TextButton(onClick = { showFeedbackDialog = false }) { Text("Cancel", color = ColorDarkMuted) }
            },
            containerColor = ColorDarkSurface,
            titleContentColor = Color.White,
            textContentColor = ColorDarkMuted
        )
    }
}

@Composable
private fun profileTextFieldColors() = OutlinedTextFieldDefaults.colors(
    focusedBorderColor = ColorBrandEmerald,
    unfocusedBorderColor = ColorDarkBorder,
    focusedLabelColor = ColorBrandEmerald,
    unfocusedLabelColor = ColorDarkMuted,
    focusedTextColor = Color.White,
    unfocusedTextColor = Color.White,
    cursorColor = ColorBrandEmerald
)
