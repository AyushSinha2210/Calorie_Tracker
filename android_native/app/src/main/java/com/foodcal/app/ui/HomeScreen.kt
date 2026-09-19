package com.foodcal.app.ui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.BarChart
import androidx.compose.material.icons.filled.ChevronLeft
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.DirectionsWalk
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.FitnessCenter
import androidx.compose.material.icons.filled.LocalFireDepartment
import androidx.compose.material.icons.filled.PhotoCamera
import androidx.compose.material.icons.filled.Psychology
import androidx.compose.material.icons.filled.Restaurant
import androidx.compose.material.icons.filled.Sync
import androidx.compose.material.icons.outlined.AutoAwesome
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material3.windowsizeclass.WindowWidthSizeClass
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.layout.ContentScale
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil.compose.AsyncImage
import com.foodcal.app.data.model.FoodLogEntry
import com.foodcal.app.data.model.WorkoutLogEntry
import java.time.LocalDate
import java.time.format.DateTimeFormatter

@Composable
fun HomeScreen(
    viewModel: MainViewModel,
    windowWidthSizeClass: WindowWidthSizeClass = WindowWidthSizeClass.Compact,
    onNavigateToScan: () -> Unit,
    onNavigateToFood: () -> Unit,
    onNavigateToWorkouts: () -> Unit,
    onNavigateToProgress: () -> Unit = {},
    onNavigateToCoach: () -> Unit = {},
    onNavigateToProfile: () -> Unit
) {
    val profile by viewModel.profile.collectAsStateWithLifecycle()
    val selectedDate by viewModel.selectedDate.collectAsStateWithLifecycle()
    val daySummary by viewModel.daySummary.collectAsStateWithLifecycle()

    var foodToDelete by remember { mutableStateOf<FoodLogEntry?>(null) }
    var coachInsight by remember { mutableStateOf<String?>(null) }
    var isCoachLoading by remember { mutableStateOf(false) }
    var showEditStepsDialog by remember { mutableStateOf(false) }

    val calorieTarget = profile?.dailyCalorieTarget ?: 2000
    // Estimate protein target: ~2g per kg, or 25% of calories
    val proteinTarget = (profile?.weight?.times(2.0) ?: 130.0).coerceAtLeast(80.0)
    val carbsTarget = ((calorieTarget * 0.45) / 4.0).coerceAtLeast(100.0)
    val fatTarget = ((calorieTarget * 0.25) / 9.0).coerceAtLeast(40.0)

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(ColorDarkBg),
        contentAlignment = Alignment.TopCenter
    ) {
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .widthIn(max = 840.dp)
                .statusBarsPadding()
                .padding(horizontal = 18.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            item {
                // Top Bar
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    FoodCalLogo(size = 38.dp)

                    Row(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        IconButton(
                            onClick = onNavigateToCoach,
                            modifier = Modifier
                                .clip(CircleShape)
                                .background(ColorDarkSurface2)
                        ) {
                            Icon(Icons.Default.Psychology, contentDescription = "AI Coach", tint = ColorBrandLime)
                        }

                        IconButton(
                            onClick = onNavigateToProfile,
                            modifier = Modifier
                                .size(40.dp)
                                .clip(CircleShape)
                        ) {
                            ProfileAvatar(
                                imageSource = profile?.profileImage,
                                displayName = profile?.name,
                                modifier = Modifier.size(40.dp),
                                iconSize = 22.dp
                            )
                        }
                    }
                }
            }

            // Adaptive Quick Actions Strip (Add Food, Log Exercise, Log Weight - adjusts to any screen size)
            item {
                AdaptiveQuickActionsBar(
                    onNavigateToFood = onNavigateToFood,
                    onNavigateToWorkouts = onNavigateToWorkouts,
                    onNavigateToProgress = onNavigateToProgress
                )
            }

            // Horizontal Date Strip (Past up to Today only)
            item {
                DateSelectorStrip(
                    selectedDate = selectedDate,
                    onDateSelected = { viewModel.setSelectedDate(it) }
                )
            }

            // Separate Records for Food Intake vs Exercise Burned vs Net Budget
            item {
                Column(
                    modifier = Modifier.fillMaxWidth(),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    // Two side-by-side dedicated records
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        // 1. Food Intake Record
                        GlassCard(
                            modifier = Modifier.weight(1f),
                            borderColor = ColorBrandEmerald.copy(alpha = 0.4f)
                        ) {
                            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                                ) {
                                    Box(
                                        modifier = Modifier
                                            .size(24.dp)
                                            .clip(CircleShape)
                                            .background(ColorBrandEmerald.copy(alpha = 0.2f)),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Icon(Icons.Default.Restaurant, contentDescription = null, tint = ColorBrandEmerald, modifier = Modifier.size(13.dp))
                                    }
                                    Text(
                                        text = "FOOD INTAKE",
                                        style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Black, fontSize = 10.sp),
                                        color = ColorBrandEmerald
                                    )
                                }
                                Text(
                                    text = "${daySummary.totalCalories} kcal",
                                    style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Black),
                                    color = Color.White
                                )
                                Text(
                                    text = "${daySummary.foodLogs.size} meal${if (daySummary.foodLogs.size == 1) "" else "s"} logged",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = ColorDarkMuted
                                )
                            }
                        }

                        // 2. Exercise Burned Record
                        GlassCard(
                            modifier = Modifier.weight(1f),
                            borderColor = ColorMacroCal.copy(alpha = 0.4f)
                        ) {
                            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                                ) {
                                    Box(
                                        modifier = Modifier
                                            .size(24.dp)
                                            .clip(CircleShape)
                                            .background(ColorMacroCal.copy(alpha = 0.2f)),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Icon(Icons.Default.LocalFireDepartment, contentDescription = null, tint = ColorMacroCal, modifier = Modifier.size(13.dp))
                                    }
                                    Text(
                                        text = "ACTIVE BURN",
                                        style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Black, fontSize = 10.sp),
                                        color = ColorMacroCal
                                    )
                                }
                                Text(
                                    text = "${daySummary.totalCaloriesBurned} kcal",
                                    style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Black),
                                    color = Color.White
                                )
                                Text(
                                    text = "${daySummary.workoutLogs.size} exercise${if (daySummary.workoutLogs.size == 1) "" else "s"} logged",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = ColorDarkMuted
                                )
                            }
                        }
                    }

                    // Cal AI Calorie Ring & Net Budget Hero Card
                    GlassCard(modifier = Modifier.fillMaxWidth()) {
                        Column(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            Text(
                                text = "Daily Calorie Budget",
                                style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                                color = Color.White
                            )

                            Spacer(modifier = Modifier.height(16.dp))

                            CalorieRing(
                                eaten = daySummary.totalCalories,
                                target = calorieTarget,
                                burned = daySummary.totalCaloriesBurned
                            )

                            Spacer(modifier = Modifier.height(16.dp))

                            // Net Calorie Balance Breakdown strip
                            val netCalories = (daySummary.totalCalories - daySummary.totalCaloriesBurned).coerceAtLeast(0)
                            val remainingCal = (calorieTarget - daySummary.totalCalories + daySummary.totalCaloriesBurned).coerceAtLeast(0)

                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(14.dp))
                                    .background(ColorDarkSurface2)
                                    .padding(vertical = 12.dp, horizontal = 16.dp),
                                horizontalArrangement = Arrangement.SpaceAround,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                StatPill("Eaten (Food)", "${daySummary.totalCalories} kcal", ColorBrandEmerald)
                                StatPill("Active Burn", "-${daySummary.totalCaloriesBurned} kcal", ColorMacroCal)
                                StatPill("Net Remaining", "$remainingCal kcal", ColorBrandLime)
                            }

                            Spacer(modifier = Modifier.height(18.dp))

                            // Macro progress bars
                            Column(
                                modifier = Modifier.fillMaxWidth(),
                                verticalArrangement = Arrangement.spacedBy(10.dp)
                            ) {
                                MacroProgressBar("Protein", daySummary.totalProtein, proteinTarget, ColorMacroProtein)
                                MacroProgressBar("Carbs", daySummary.totalCarbs, carbsTarget, ColorMacroCarbs)
                                MacroProgressBar("Fat", daySummary.totalFat, fatTarget, ColorMacroFat)
                            }
                        }
                    }
                }
            }

            // Daily Steps Walked Hero Card (Auto-synced on each app open)
            item {
                val todaySteps = daySummary.steps
                val stepTarget = if (daySummary.stepTarget > 0) daySummary.stepTarget else 10000
                val progress = (todaySteps.toFloat() / stepTarget.toFloat()).coerceIn(0f, 1f)
                val distanceKm = daySummary.stepDistanceKm
                val stepCalories = daySummary.stepCalories

                GlassCard(
                    modifier = Modifier.fillMaxWidth(),
                    borderColor = Color(0xFF06B6D4).copy(alpha = 0.4f)
                ) {
                    Column(
                        modifier = Modifier.fillMaxWidth(),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                Box(
                                    modifier = Modifier
                                        .size(34.dp)
                                        .clip(CircleShape)
                                        .background(Color(0xFF06B6D4).copy(alpha = 0.2f)),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Icon(Icons.Default.DirectionsWalk, contentDescription = "Steps", tint = Color(0xFF06B6D4), modifier = Modifier.size(20.dp))
                                }
                                Column {
                                    Text("Daily Steps Walked", style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold), color = Color.White)
                                    Text("${viewModel.getSensorTypeDescription()} • Auto-sync on open", style = MaterialTheme.typography.labelSmall, color = ColorDarkMuted)
                                }
                            }

                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                Box(
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(12.dp))
                                        .background(Color(0xFF06B6D4).copy(alpha = 0.18f))
                                        .border(1.dp, Color(0xFF06B6D4).copy(alpha = 0.45f), RoundedCornerShape(12.dp))
                                        .clickable { showEditStepsDialog = true }
                                        .padding(horizontal = 12.dp, vertical = 7.dp),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                        Icon(Icons.Default.Edit, contentDescription = "Edit Steps", tint = Color(0xFF06B6D4), modifier = Modifier.size(18.dp))
                                        Text("Edit Steps", color = Color(0xFF06B6D4), fontWeight = FontWeight.ExtraBold, style = MaterialTheme.typography.labelMedium)
                                    }
                                }
                                IconButton(
                                    onClick = { viewModel.syncSteps() },
                                    modifier = Modifier.size(36.dp)
                                ) {
                                    Icon(Icons.Default.Sync, contentDescription = "Sync Steps", tint = Color(0xFF06B6D4), modifier = Modifier.size(20.dp))
                                }
                            }
                        }

                        // Steps Progress Indicator
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.Bottom
                        ) {
                            Column(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(10.dp))
                                    .clickable { showEditStepsDialog = true }
                                    .padding(vertical = 2.dp)
                            ) {
                                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    Text(
                                        text = String.format(java.util.Locale.US, "%,d", todaySteps),
                                        style = MaterialTheme.typography.headlineMedium.copy(fontWeight = FontWeight.Black),
                                        color = Color.White
                                    )
                                    Box(
                                        modifier = Modifier
                                            .size(28.dp)
                                            .clip(CircleShape)
                                            .background(Color(0xFF06B6D4).copy(alpha = 0.2f)),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Icon(Icons.Default.Edit, contentDescription = "Edit Steps", tint = Color(0xFF06B6D4), modifier = Modifier.size(16.dp))
                                    }
                                }
                                Text(
                                    text = "Goal: ${String.format(java.util.Locale.US, "%,d", stepTarget)} steps (${(progress * 100).toInt()}%)",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = ColorDarkMuted
                                )
                            }

                            Row(horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                                Column(horizontalAlignment = Alignment.End) {
                                    Text("${String.format(java.util.Locale.US, "%.2f", distanceKm)} km", fontWeight = FontWeight.Bold, color = Color(0xFF38BDF8))
                                    Text("Distance", style = MaterialTheme.typography.labelSmall, color = ColorDarkMuted)
                                }
                                Column(horizontalAlignment = Alignment.End) {
                                    Text("$stepCalories kcal", fontWeight = FontWeight.Bold, color = ColorMacroCal)
                                    Text("Burned", style = MaterialTheme.typography.labelSmall, color = ColorDarkMuted)
                                }
                            }
                        }

                        // Progress Bar
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(8.dp)
                                .clip(RoundedCornerShape(4.dp))
                                .background(ColorDarkSurface2)
                        ) {
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth(progress)
                                    .fillMaxHeight()
                                    .clip(RoundedCornerShape(4.dp))
                                    .background(
                                        Brush.horizontalGradient(
                                            listOf(Color(0xFF06B6D4), Color(0xFF38BDF8))
                                        )
                                    )
                            )
                        }
                    }
                }
            }

        // Instant Cal AI Scan Action Banner
        item {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(22.dp))
                    .background(
                        Brush.horizontalGradient(
                            listOf(Color(0xFF047857), Color(0xFF10B981))
                        )
                    )
                    .clickable { onNavigateToScan() }
                    .padding(20.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            Icon(Icons.Outlined.AutoAwesome, contentDescription = null, tint = ColorBrandLime, modifier = Modifier.size(18.dp))
                            Text("Cal AI Photo Scanner", fontWeight = FontWeight.Black, color = Color.White, fontSize = 16.sp)
                        }
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            "Snap a meal to detect calories, macros & health score in seconds.",
                            style = MaterialTheme.typography.bodySmall,
                            color = Color.White.copy(alpha = 0.85f)
                        )
                    }
                    Spacer(modifier = Modifier.width(12.dp))
                    Box(
                        modifier = Modifier
                            .size(46.dp)
                            .clip(CircleShape)
                            .background(Color.White),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(Icons.Default.PhotoCamera, contentDescription = "Scan", tint = Color(0xFF047857), modifier = Modifier.size(26.dp))
                    }
                }
            }
        }

        // Today's Meals Header
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Meals Logged",
                    style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                    color = Color.White
                )

                TextButton(onClick = onNavigateToFood) {
                    Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(18.dp), tint = ColorBrandLime)
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("Add Food", color = ColorBrandLime, fontWeight = FontWeight.Bold)
                }
            }
        }

        // Meals List
        if (daySummary.foodLogs.isEmpty()) {
            item {
                GlassCard(
                    modifier = Modifier.fillMaxWidth(),
                    borderColor = ColorDarkBorder
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 12.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Icon(Icons.Default.Restaurant, contentDescription = null, tint = ColorDarkMuted, modifier = Modifier.size(36.dp))
                        Text("No meals logged for this day", fontWeight = FontWeight.SemiBold, color = Color.White)
                        Text("Take a photo or enter items manually to track your day.", style = MaterialTheme.typography.bodySmall, color = ColorDarkMuted)
                    }
                }
            }
        } else {
            items(daySummary.foodLogs, key = { it.id }) { meal ->
                MealCard(
                    meal = meal,
                    onDelete = { foodToDelete = meal }
                )
            }
        }

        // Today's Workouts Summary
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Workouts & Activity",
                    style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                    color = Color.White
                )

                TextButton(onClick = onNavigateToWorkouts) {
                    Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(18.dp), tint = ColorBrandLime)
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("Log Workout", color = ColorBrandLime, fontWeight = FontWeight.Bold)
                }
            }
        }

        if (daySummary.workoutLogs.isEmpty()) {
            item {
                GlassCard(modifier = Modifier.fillMaxWidth()) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 10.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        Icon(Icons.Default.FitnessCenter, contentDescription = null, tint = ColorDarkMuted, modifier = Modifier.size(32.dp))
                        Text("No workouts recorded today", fontWeight = FontWeight.SemiBold, color = Color.White)
                        Text("Cardio, lifting, or bodyweight exercises add back burned calories.", style = MaterialTheme.typography.bodySmall, color = ColorDarkMuted)
                    }
                }
            }
        } else {
            items(daySummary.workoutLogs, key = { it.id }) { workout ->
                WorkoutItemCard(workout = workout, onDelete = { viewModel.deleteWorkoutLog(workout.id) })
            }
        }

        // AI Coach Card
        item {
            GlassCard(modifier = Modifier.fillMaxWidth()) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Icon(Icons.Outlined.AutoAwesome, contentDescription = null, tint = ColorBrandLime)
                    Text("AI Coach Daily Feedback", fontWeight = FontWeight.Bold, color = Color.White)
                }

                Spacer(modifier = Modifier.height(10.dp))

                if (coachInsight != null) {
                    Text(
                        text = coachInsight!!,
                        style = MaterialTheme.typography.bodyMedium,
                        color = ColorDarkText
                    )
                } else {
                    Text(
                        text = "Get real-time feedback on your balance of calories, protein, and activity.",
                        style = MaterialTheme.typography.bodySmall,
                        color = ColorDarkMuted
                    )
                    Spacer(modifier = Modifier.height(10.dp))
                    Button(
                        onClick = {
                            isCoachLoading = true
                            val tone = profile?.coachTone ?: "friendly"
                            viewModel.getCoachComment(
                                tone = tone,
                                activityType = "daily",
                                entryName = "Today Summary",
                                calories = daySummary.totalCalories,
                                protein = daySummary.totalProtein
                            ) { result ->
                                isCoachLoading = false
                                coachInsight = result.getOrElse { "Coach is taking a short rest. Keep crushing your goals!" }
                            }
                        },
                        enabled = !isCoachLoading,
                        colors = ButtonDefaults.buttonColors(containerColor = ColorDarkSurface2)
                    ) {
                        if (isCoachLoading) {
                            CircularProgressIndicator(modifier = Modifier.size(18.dp), color = ColorBrandEmerald, strokeWidth = 2.dp)
                        } else {
                            Text("Get Coach Feedback", color = ColorBrandEmerald, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }

        item {
            Spacer(modifier = Modifier.height(90.dp))
        }
    }
}

    // Delete Food Confirmation Dialog
    if (foodToDelete != null) {
        AlertDialog(
            onDismissRequest = { foodToDelete = null },
            title = { Text("Delete Meal Entry?") },
            text = { Text("Are you sure you want to delete '${foodToDelete?.itemName}'?") },
            confirmButton = {
                Button(
                    onClick = {
                        foodToDelete?.let { viewModel.deleteFoodLog(it.id) }
                        foodToDelete = null
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFEF4444))
                ) {
                    Text("Delete")
                }
            },
            dismissButton = {
                TextButton(onClick = { foodToDelete = null }) {
                    Text("Cancel", color = ColorDarkMuted)
                }
            },
            containerColor = ColorDarkSurface,
            titleContentColor = Color.White,
        )
    }

    // Edit / Calibrate Today's Steps Dialog
    if (showEditStepsDialog) {
        val currentSteps = daySummary.steps
        var stepInputText by remember { mutableStateOf(currentSteps.toString()) }
        AlertDialog(
            onDismissRequest = { showEditStepsDialog = false },
            containerColor = ColorDarkSurface,
            title = {
                Text(
                    text = "Daily Steps Walked",
                    style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold),
                    color = Color.White
                )
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
                    Text(
                        text = "Sensor: ${viewModel.getSensorTypeDescription()}.\nSteps automatically increment as you walk with your phone in pocket or hand. You can also calibrate your steps to match your smartwatch or health app.",
                        style = MaterialTheme.typography.bodySmall,
                        color = ColorDarkMuted
                    )

                    OutlinedTextField(
                        value = stepInputText,
                        onValueChange = { stepInputText = it.filter { ch -> ch.isDigit() } },
                        label = { Text("Today's Steps") },
                        singleLine = true,
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = Color.White,
                            unfocusedTextColor = Color.White,
                            focusedBorderColor = Color(0xFF06B6D4),
                            unfocusedBorderColor = ColorDarkBorder,
                            focusedLabelColor = Color(0xFF06B6D4),
                            unfocusedLabelColor = ColorDarkMuted
                        ),
                        modifier = Modifier.fillMaxWidth()
                    )

                    Text(
                        text = "Quick Add:",
                        style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold),
                        color = ColorDarkMuted
                    )

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        listOf(500, 1000, 2500, 5000).forEach { delta ->
                            Box(
                                modifier = Modifier
                                    .weight(1f)
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(ColorDarkSurface2)
                                    .border(1.dp, ColorDarkBorder, RoundedCornerShape(8.dp))
                                    .clickable {
                                        val current = stepInputText.toIntOrNull() ?: currentSteps
                                        stepInputText = (current + delta).toString()
                                    }
                                    .padding(vertical = 8.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = "+$delta",
                                    style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold),
                                    color = Color(0xFF06B6D4)
                                )
                            }
                        }
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        val parsed = stepInputText.toIntOrNull() ?: currentSteps
                        viewModel.setTodaySteps(parsed)
                        showEditStepsDialog = false
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF06B6D4))
                ) {
                    Text("Save Steps", color = Color.White, fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { showEditStepsDialog = false }) {
                    Text("Cancel", color = ColorDarkMuted)
                }
            }
        )
    }
}

@Composable
private fun StatPill(label: String, value: String, color: Color) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(label, style = MaterialTheme.typography.labelSmall, color = ColorDarkMuted)
        Spacer(modifier = Modifier.height(2.dp))
        Text(value, fontWeight = FontWeight.Bold, color = color, style = MaterialTheme.typography.bodyMedium)
    }
}

@Composable
private fun MealCard(
    meal: FoodLogEntry,
    onDelete: () -> Unit
) {
    GlassCard(
        modifier = Modifier.fillMaxWidth(),
        borderColor = ColorDarkBorder
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.Top
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    // Meal Type pill
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(6.dp))
                            .background(ColorBrandEmerald.copy(alpha = 0.15f))
                            .padding(horizontal = 8.dp, vertical = 2.dp)
                    ) {
                        Text(
                            text = meal.mealType,
                            style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold),
                            color = ColorBrandEmerald
                        )
                    }

                    if (meal.healthScore > 0) {
                        HealthScoreBadge(score = meal.healthScore)
                    }
                }

                Spacer(modifier = Modifier.height(6.dp))

                Text(
                    text = meal.itemName,
                    style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                    color = Color.White
                )

                Spacer(modifier = Modifier.height(4.dp))

                Text(
                    text = "${meal.calories} kcal  •  P: ${meal.protein.toInt()}g  •  C: ${meal.carbs.toInt()}g  •  F: ${meal.fat.toInt()}g",
                    style = MaterialTheme.typography.bodySmall,
                    color = ColorDarkMuted
                )
            }

            IconButton(onClick = onDelete) {
                Icon(Icons.Default.Delete, contentDescription = "Delete", tint = Color(0xFFEF4444).copy(alpha = 0.7f), modifier = Modifier.size(20.dp))
            }
        }
    }
}

@Composable
private fun WorkoutItemCard(
    workout: WorkoutLogEntry,
    onDelete: () -> Unit
) {
    GlassCard(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Box(
                    modifier = Modifier
                        .size(38.dp)
                        .clip(CircleShape)
                        .background(ColorMacroCal.copy(alpha = 0.2f)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(Icons.Default.LocalFireDepartment, contentDescription = null, tint = ColorMacroCal, modifier = Modifier.size(20.dp))
                }

                Column {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text(workout.exerciseName, fontWeight = FontWeight.Bold, color = Color.White)
                        if (workout.source == "gpx_import") {
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(4.dp))
                                    .background(ColorBrandLime.copy(alpha = 0.2f))
                                    .padding(horizontal = 5.dp, vertical = 1.dp)
                            ) {
                                Text("GPX", color = ColorBrandLime, style = MaterialTheme.typography.labelSmall.copy(fontSize = 9.sp, fontWeight = FontWeight.Bold))
                            }
                        }
                    }
                    val sportDetail = if (workout.inputType == "sports" && workout.durationMin > 0) "${workout.durationMin}m play" else if (workout.inputType == "sports") "Sports" else workout.inputType.replaceFirstChar { it.uppercase() }
                    Text(
                        "${workout.caloriesBurned} kcal burned • $sportDetail",
                        style = MaterialTheme.typography.bodySmall,
                        color = ColorDarkMuted
                    )
                }
            }

            IconButton(onClick = onDelete) {
                Icon(Icons.Default.Delete, contentDescription = "Delete", tint = Color(0xFFEF4444).copy(alpha = 0.7f), modifier = Modifier.size(20.dp))
            }
        }
    }
}

@Composable
private fun DateSelectorStrip(
    selectedDate: LocalDate,
    onDateSelected: (LocalDate) -> Unit
) {
    val today = remember { LocalDate.now() }
    val days = remember {
        (-29..0).map { offset -> today.plusDays(offset.toLong()) }
    }
    val listState = androidx.compose.foundation.lazy.rememberLazyListState()

    androidx.compose.runtime.LaunchedEffect(selectedDate) {
        val idx = days.indexOf(selectedDate)
        if (idx >= 0) {
            listState.animateScrollToItem((idx - 2).coerceAtLeast(0))
        }
    }

    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        // Professional Header Row
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Text(
                    text = selectedDate.format(DateTimeFormatter.ofPattern("MMMM yyyy")),
                    style = MaterialTheme.typography.titleMedium.copy(
                        fontWeight = FontWeight.ExtraBold,
                        letterSpacing = (-0.3).sp
                    ),
                    color = Color.White
                )
                if (selectedDate == today) {
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(6.dp))
                            .background(ColorBrandEmerald.copy(alpha = 0.2f))
                            .padding(horizontal = 6.dp, vertical = 2.dp)
                    ) {
                        Text(
                            text = "TODAY",
                            style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold),
                            color = ColorBrandLime
                        )
                    }
                }
            }

            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                IconButton(
                    onClick = { onDateSelected(selectedDate.minusDays(1)) },
                    modifier = Modifier.size(32.dp)
                ) {
                    Icon(
                        Icons.Default.ChevronLeft,
                        contentDescription = "Previous Day",
                        tint = ColorDarkMuted,
                        modifier = Modifier.size(20.dp)
                    )
                }

                if (selectedDate != today) {
                    TextButton(
                        onClick = { onDateSelected(today) },
                        contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 8.dp, vertical = 2.dp),
                        modifier = Modifier.height(28.dp),
                        colors = ButtonDefaults.textButtonColors(contentColor = ColorBrandLime)
                    ) {
                        Text("Today", style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold))
                    }
                }

                val canGoForward = selectedDate.isBefore(today)
                IconButton(
                    onClick = { if (canGoForward) onDateSelected(selectedDate.plusDays(1)) },
                    enabled = canGoForward,
                    modifier = Modifier.size(32.dp)
                ) {
                    Icon(
                        Icons.Default.ChevronRight,
                        contentDescription = "Next Day",
                        tint = if (canGoForward) ColorDarkMuted else ColorDarkMuted.copy(alpha = 0.2f),
                        modifier = Modifier.size(20.dp)
                    )
                }
            }
        }

        // Horizontal Date Strip Cards (History up to today)
        androidx.compose.foundation.lazy.LazyRow(
            state = listState,
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            items(days, key = { it.toString() }) { date ->
                val isSelected = date == selectedDate
                val isToday = date == today

                val pillBackground = if (isSelected) {
                    Brush.verticalGradient(listOf(ColorBrandEmerald, Color(0xFF059669)))
                } else {
                    Brush.verticalGradient(listOf(ColorDarkSurface, ColorDarkSurface2))
                }

                val borderColor = if (isSelected) {
                    ColorBrandLime
                } else if (isToday) {
                    ColorBrandEmerald.copy(alpha = 0.8f)
                } else {
                    ColorDarkBorder
                }

                Column(
                    modifier = Modifier
                        .width(58.dp)
                        .height(76.dp)
                        .clip(RoundedCornerShape(18.dp))
                        .background(pillBackground)
                        .border(
                            width = if (isSelected || isToday) 1.5.dp else 1.dp,
                            color = borderColor,
                            shape = RoundedCornerShape(18.dp)
                        )
                        .clickable { onDateSelected(date) }
                        .padding(vertical = 8.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(
                        text = date.format(DateTimeFormatter.ofPattern("EEE")).uppercase(),
                        style = MaterialTheme.typography.labelSmall.copy(
                            fontWeight = if (isSelected) FontWeight.Black else FontWeight.Bold,
                            letterSpacing = 0.5.sp
                        ),
                        color = if (isSelected) Color(0xFF022C17) else ColorDarkMuted
                    )

                    Text(
                        text = date.dayOfMonth.toString(),
                        style = MaterialTheme.typography.titleMedium.copy(
                            fontWeight = FontWeight.Black,
                            fontSize = 18.sp
                        ),
                        color = if (isSelected) Color(0xFF022C17) else Color.White
                    )

                    if (isSelected) {
                        Box(
                            modifier = Modifier
                                .width(16.dp)
                                .height(3.dp)
                                .clip(RoundedCornerShape(2.dp))
                                .background(ColorBrandLime)
                        )
                    } else if (isToday) {
                        Box(
                            modifier = Modifier
                                .size(5.dp)
                                .clip(CircleShape)
                                .background(ColorBrandLime)
                        )
                    } else {
                        Spacer(modifier = Modifier.height(5.dp))
                    }
                }
            }
        }
    }
}

@Composable
private fun AdaptiveQuickActionsBar(
    onNavigateToFood: () -> Unit,
    onNavigateToWorkouts: () -> Unit,
    onNavigateToProgress: () -> Unit,
    modifier: Modifier = Modifier
) {
    BoxWithConstraints(modifier = modifier.fillMaxWidth()) {
        val density = LocalDensity.current
        val isNarrow = maxWidth < 400.dp || density.fontScale > 1.15f

        if (isNarrow) {
            LazyRow(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                item {
                    QuickActionButton(
                        icon = Icons.Default.Restaurant,
                        label = "Add Food",
                        tint = ColorBrandEmerald,
                        onClick = onNavigateToFood
                    )
                }
                item {
                    QuickActionButton(
                        icon = Icons.Default.FitnessCenter,
                        label = "Log Exercise",
                        tint = ColorMacroCal,
                        onClick = onNavigateToWorkouts
                    )
                }
                item {
                    QuickActionButton(
                        icon = Icons.Default.BarChart,
                        label = "Log Weight",
                        tint = ColorBrandLime,
                        onClick = onNavigateToProgress
                    )
                }
            }
        } else {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                QuickActionButton(
                    icon = Icons.Default.Restaurant,
                    label = "Add Food",
                    tint = ColorBrandEmerald,
                    onClick = onNavigateToFood,
                    modifier = Modifier.weight(1f)
                )
                QuickActionButton(
                    icon = Icons.Default.FitnessCenter,
                    label = "Log Exercise",
                    tint = ColorMacroCal,
                    onClick = onNavigateToWorkouts,
                    modifier = Modifier.weight(1f)
                )
                QuickActionButton(
                    icon = Icons.Default.BarChart,
                    label = "Log Weight",
                    tint = ColorBrandLime,
                    onClick = onNavigateToProgress,
                    modifier = Modifier.weight(1f)
                )
            }
        }
    }
}

@Composable
private fun QuickActionButton(
    icon: ImageVector,
    label: String,
    tint: Color,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier
            .height(44.dp)
            .clip(RoundedCornerShape(14.dp))
            .background(ColorDarkSurface2)
            .border(1.dp, ColorDarkBorder, RoundedCornerShape(14.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center
    ) {
        Box(
            modifier = Modifier
                .size(24.dp)
                .clip(CircleShape)
                .background(tint.copy(alpha = 0.2f)),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = tint,
                modifier = Modifier.size(14.dp)
            )
        }
        Spacer(modifier = Modifier.width(6.dp))
        Text(
            text = label,
            style = MaterialTheme.typography.labelMedium.copy(
                fontWeight = FontWeight.Bold,
                fontSize = 12.sp
            ),
            color = Color.White,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
        )
    }
}

