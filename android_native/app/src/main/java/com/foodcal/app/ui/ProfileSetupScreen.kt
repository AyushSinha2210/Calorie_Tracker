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
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
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
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import coil.compose.AsyncImage
import com.foodcal.app.util.ImageUtils
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.foodcal.app.data.model.UserProfile
import kotlin.math.roundToInt

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun ProfileSetupScreen(
    initialName: String = "",
    initialEmail: String = "",
    onComplete: (UserProfile) -> Unit
) {
    var name by remember { mutableStateOf(initialName) }
    var ageText by remember { mutableStateOf("25") }
    var gender by remember { mutableStateOf("male") } // male, female, other
    var weightText by remember { mutableStateOf("70") }
    var weightUnit by remember { mutableStateOf("kg") } // kg, lbs
    var heightText by remember { mutableStateOf("175") }
    var heightUnit by remember { mutableStateOf("cm") } // cm, ft
    var goalType by remember { mutableStateOf("maintain") } // lose, maintain, gain

    var profileImageBase64 by remember { mutableStateOf("") }
    val context = LocalContext.current
    val photoPickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent()
    ) { uri: Uri? ->
        if (uri != null) {
            val dataUrl = ImageUtils.processProfileImageUri(context, uri)
            if (dataUrl != null) {
                profileImageBase64 = dataUrl
            }
        }
    }

    val rawWeight = weightText.toDoubleOrNull() ?: 70.0
    val rawHeight = heightText.toDoubleOrNull() ?: 175.0
    val weightKg = if (weightUnit == "lbs") ((rawWeight * 0.453592) * 10.0).roundToInt() / 10.0 else rawWeight
    val heightCm = if (heightUnit == "ft") ((rawHeight * 30.48) * 10.0).roundToInt() / 10.0 else rawHeight
    val age = ageText.toIntOrNull() ?: 25

    // Mifflin-St Jeor formula
    val genderOffset = if (gender == "female") -161 else 5
    val bmr = (10 * weightKg + 6.25 * heightCm - 5 * age + genderOffset).coerceAtLeast(1000.0)
    val tdee = bmr * 1.35
    val suggestedCal = when (goalType) {
        "lose" -> (tdee - 500).roundToInt()
        "gain" -> (tdee + 400).roundToInt()
        else -> tdee.roundToInt()
    }

    var customCalorieTarget by remember { mutableStateOf("") }
    val effectiveTarget = customCalorieTarget.toIntOrNull() ?: suggestedCal

    val scrollState = rememberScrollState()

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(ColorDarkBg)
            .statusBarsPadding()
            .navigationBarsPadding()
            .imePadding(),
        contentAlignment = Alignment.TopCenter
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .widthIn(max = 560.dp)
                .verticalScroll(scrollState)
                .padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Spacer(modifier = Modifier.height(12.dp))

            FoodCalLogo(size = 44.dp)

            Text(
                text = "Welcome! Let's set up your profile",
                style = MaterialTheme.typography.headlineSmall.copy(fontWeight = FontWeight.Bold),
                color = Color.White
            )

            Text(
                text = "FoodCal tailors calorie & macro targets specifically for your body and goals.",
                style = MaterialTheme.typography.bodyMedium,
                color = ColorDarkMuted
            )

            GlassCard(modifier = Modifier.fillMaxWidth()) {
                Text(
                    text = "Personal Information",
                    style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                    color = Color.White
                )

                Spacer(modifier = Modifier.height(14.dp))

                // Profile Avatar Picker
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.Center
                ) {
                    Box(modifier = Modifier.size(80.dp)) {
                        ProfileAvatar(
                            imageSource = profileImageBase64,
                            displayName = name,
                            modifier = Modifier
                                .size(80.dp)
                                .border(2.dp, ColorBrandEmerald.copy(alpha = 0.7f), CircleShape)
                                .clickable { photoPickerLauncher.launch("image/*") },
                            iconSize = 42.dp
                        )

                        // Camera badge
                        Box(
                            modifier = Modifier
                                .size(28.dp)
                                .align(Alignment.BottomEnd)
                                .clip(CircleShape)
                                .background(ColorBrandEmerald)
                                .clickable { photoPickerLauncher.launch("image/*") },
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                Icons.Default.CameraAlt,
                                contentDescription = "Add photo",
                                tint = Color(0xFF042F1A),
                                modifier = Modifier.size(16.dp)
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(14.dp))

                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Display Name") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    colors = setupTextFieldColors()
                )

                Spacer(modifier = Modifier.height(12.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    OutlinedTextField(
                        value = ageText,
                        onValueChange = { ageText = it },
                        label = { Text("Age") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        modifier = Modifier.weight(1f),
                        singleLine = true,
                        colors = setupTextFieldColors()
                    )

                    OutlinedTextField(
                        value = weightText,
                        onValueChange = { weightText = it },
                        label = { Text("Weight ($weightUnit)") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                        modifier = Modifier.weight(1.3f),
                        singleLine = true,
                        colors = setupTextFieldColors()
                    )
                }

                Spacer(modifier = Modifier.height(8.dp))

                // Weight Unit Chips
                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("Weight Unit:", color = ColorDarkMuted, style = MaterialTheme.typography.labelSmall)
                    listOf("kg" to "Kilograms (kg)", "lbs" to "Pounds (lbs)").forEach { (u, label) ->
                        FilterChip(
                            selected = weightUnit == u,
                            onClick = {
                                if (weightUnit != u) {
                                    val currentNum = weightText.toDoubleOrNull()
                                    if (currentNum != null) {
                                        weightText = if (u == "lbs") {
                                            ((currentNum / 0.453592) * 10.0).roundToInt().div(10.0).toString()
                                        } else {
                                            ((currentNum * 0.453592) * 10.0).roundToInt().div(10.0).toString()
                                        }
                                    }
                                    weightUnit = u
                                }
                            },
                            label = { Text(label, style = MaterialTheme.typography.labelSmall) },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = ColorBrandEmerald,
                                selectedLabelColor = Color(0xFF042F1A),
                                containerColor = ColorDarkSurface2,
                                labelColor = Color.White
                            )
                        )
                    }
                }

                Spacer(modifier = Modifier.height(12.dp))

                OutlinedTextField(
                    value = heightText,
                    onValueChange = { heightText = it },
                    label = { Text("Height ($heightUnit)") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    colors = setupTextFieldColors()
                )

                Spacer(modifier = Modifier.height(8.dp))

                // Height Unit Chips
                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("Height Unit:", color = ColorDarkMuted, style = MaterialTheme.typography.labelSmall)
                    listOf("cm" to "Centimeters (cm)", "ft" to "Feet (ft)").forEach { (u, label) ->
                        FilterChip(
                            selected = heightUnit == u,
                            onClick = {
                                if (heightUnit != u) {
                                    val currentNum = heightText.toDoubleOrNull()
                                    if (currentNum != null) {
                                        heightText = if (u == "ft") {
                                            ((currentNum / 30.48) * 100.0).roundToInt().div(100.0).toString()
                                        } else {
                                            ((currentNum * 30.48) * 10.0).roundToInt().div(10.0).toString()
                                        }
                                    }
                                    heightUnit = u
                                }
                            },
                            label = { Text(label, style = MaterialTheme.typography.labelSmall) },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = ColorBrandEmerald,
                                selectedLabelColor = Color(0xFF042F1A),
                                containerColor = ColorDarkSurface2,
                                labelColor = Color.White
                            )
                        )
                    }
                }

                Spacer(modifier = Modifier.height(14.dp))

                Text("Gender", color = ColorDarkMuted, style = MaterialTheme.typography.labelMedium)
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf("male" to "Male", "female" to "Female", "other" to "Other").forEach { (key, label) ->
                        FilterChip(
                            selected = gender == key,
                            onClick = { gender = key },
                            label = { Text(label) },
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

            GlassCard(modifier = Modifier.fillMaxWidth()) {
                Text(
                    text = "Your Goal",
                    style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                    color = Color.White
                )

                Spacer(modifier = Modifier.height(12.dp))

                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf("lose" to "Lose Weight", "maintain" to "Maintain", "gain" to "Build Muscle").forEach { (key, label) ->
                        FilterChip(
                            selected = goalType == key,
                            onClick = { goalType = key },
                            label = { Text(label) },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = ColorBrandLime,
                                selectedLabelColor = Color(0xFF1A3800),
                                containerColor = ColorDarkSurface2,
                                labelColor = Color.White
                            )
                        )
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                Text(
                    text = "Recommended Daily Target: $suggestedCal kcal",
                    style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.SemiBold),
                    color = ColorBrandLime
                )

                Spacer(modifier = Modifier.height(10.dp))

                OutlinedTextField(
                    value = customCalorieTarget,
                    onValueChange = { customCalorieTarget = it },
                    label = { Text("Custom Daily Target (Optional)") },
                    placeholder = { Text("$suggestedCal kcal") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    colors = setupTextFieldColors()
                )
            }

            Button(
                onClick = {
                    val profile = UserProfile(
                        name = name.ifBlank { "Fitness Enthusiast" },
                        email = initialEmail,
                        age = age,
                        gender = gender,
                        weight = weightKg,
                        weightUnit = weightUnit,
                        originalWeight = rawWeight,
                        height = heightCm,
                        heightUnit = heightUnit,
                        originalHeight = rawHeight,
                        dailyCalorieTarget = effectiveTarget,
                        profileComplete = true,
                        coachEnabled = true,
                        coachTone = "friendly",
                        lastRecordedWeight = weightKg,
                        lastWeightLogDate = java.time.LocalDate.now().toString(),
                        profileImage = profileImageBase64.ifBlank { null }
                    )
                    onComplete(profile)
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(52.dp),
                shape = RoundedCornerShape(14.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = ColorBrandEmerald,
                    contentColor = Color(0xFF042F1A)
                )
            ) {
                Text("Complete Profile & Start Tracking", fontWeight = FontWeight.Bold, fontSize = 16.sp)
            }

            Spacer(modifier = Modifier.height(32.dp))
        }
    }
}

@Composable
private fun setupTextFieldColors() = OutlinedTextFieldDefaults.colors(
    focusedBorderColor = ColorBrandEmerald,
    unfocusedBorderColor = ColorDarkBorder,
    focusedLabelColor = ColorBrandEmerald,
    unfocusedLabelColor = ColorDarkMuted,
    focusedTextColor = Color.White,
    unfocusedTextColor = Color.White,
    cursorColor = ColorBrandEmerald
)
