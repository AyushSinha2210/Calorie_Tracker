package com.foodcal.app.ui

import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.BarChart
import androidx.compose.material.icons.filled.FitnessCenter
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.PhotoCamera
import androidx.compose.material.icons.filled.Psychology
import androidx.compose.material.icons.filled.Restaurant
import androidx.compose.material.icons.outlined.AutoAwesome
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.FloatingActionButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationRail
import androidx.compose.material3.NavigationRailItem
import androidx.compose.material3.NavigationRailItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.windowsizeclass.WindowWidthSizeClass
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.foodcal.app.data.model.ProfileUiState

enum class AppDestination(val label: String, val icon: ImageVector) {
    HOME("Home", Icons.Default.Home),
    FOOD("Food", Icons.Default.Restaurant),
    SCAN("Scan", Icons.Default.PhotoCamera),
    WORKOUTS("Workouts", Icons.Default.FitnessCenter),
    PROGRESS("Progress", Icons.Default.BarChart),
    COACH("Coach", Icons.Default.Psychology),
    PROFILE("Profile", Icons.Default.Person)
}

@Composable
fun FoodCalApp(
    viewModel: MainViewModel,
    windowWidthSizeClass: WindowWidthSizeClass = WindowWidthSizeClass.Compact,
    onSignOut: () -> Unit
) {
    var currentDestination by rememberSaveable { mutableStateOf(AppDestination.HOME) }
    val profileState by viewModel.profileState.collectAsStateWithLifecycle()

    // Handle back button: if not on HOME, back takes user to HOME
    BackHandler(enabled = currentDestination != AppDestination.HOME) {
        currentDestination = AppDestination.HOME
    }

    // 1. Loading state: don't flash dashboard while profile is loading
    when (val state = profileState) {
        is ProfileUiState.Loading -> {
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
                    FoodCalLogo(size = 56.dp)
                    CircularProgressIndicator(
                        color = ColorBrandEmerald,
                        modifier = Modifier.size(36.dp),
                        strokeWidth = 3.dp
                    )
                    Text(
                        text = "Loading your fitness dashboard...",
                        style = MaterialTheme.typography.bodyMedium,
                        color = ColorDarkMuted
                    )
                }
            }
            return
        }

        is ProfileUiState.NeedsProfile -> {
            ProfileSetupScreen(
                initialName = state.initialName,
                initialEmail = state.initialEmail,
                onComplete = { completedProfile ->
                    viewModel.saveProfile(completedProfile)
                }
            )
            return
        }

        is ProfileUiState.Ready -> {
            // User profile is ready, proceed to render main application
        }
    }

    // If scanning, show full screen Scanner
    if (currentDestination == AppDestination.SCAN) {
        ScanMealScreen(
            viewModel = viewModel,
            onClose = { currentDestination = AppDestination.HOME },
            onMealSaved = { currentDestination = AppDestination.HOME }
        )
        return
    }

    val isCompact = windowWidthSizeClass == WindowWidthSizeClass.Compact

    if (isCompact) {
        // Compact Screen Layout (Mobile Portrait)
        Scaffold(
            bottomBar = {
                BottomNavBar(
                    currentDestination = currentDestination,
                    onSelectDestination = { currentDestination = it }
                )
            },
            containerColor = ColorDarkBg
        ) { innerPadding ->
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(innerPadding)
            ) {
                DestinationContent(
                    destination = currentDestination,
                    viewModel = viewModel,
                    windowWidthSizeClass = windowWidthSizeClass,
                    onNavigateToDestination = { currentDestination = it },
                    onSignOut = onSignOut
                )
            }
        }
    } else {
        // Medium / Expanded Screen Layout (Foldables, Tablets, Desktop/Landscape)
        Row(
            modifier = Modifier
                .fillMaxSize()
                .background(ColorDarkBg)
        ) {
            NavigationRail(
                containerColor = ColorDarkSurface,
                contentColor = ColorDarkMuted,
                modifier = Modifier
                    .fillMaxHeight()
                    .statusBarsPadding()
                    .navigationBarsPadding(),
                header = {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                        modifier = Modifier.padding(vertical = 12.dp)
                    ) {
                        FoodCalLogo(size = 36.dp)
                        FloatingActionButton(
                            onClick = { currentDestination = AppDestination.SCAN },
                            shape = CircleShape,
                            containerColor = ColorBrandEmerald,
                            contentColor = Color(0xFF042F1A),
                            elevation = FloatingActionButtonDefaults.elevation(0.dp),
                            modifier = Modifier.size(46.dp)
                        ) {
                            Icon(
                                Icons.Outlined.AutoAwesome,
                                contentDescription = "Scan Meal",
                                modifier = Modifier.size(24.dp)
                            )
                        }
                    }
                }
            ) {
                val railItems = listOf(
                    AppDestination.HOME,
                    AppDestination.FOOD,
                    AppDestination.WORKOUTS,
                    AppDestination.PROGRESS,
                    AppDestination.COACH,
                    AppDestination.PROFILE
                )
                railItems.forEach { item ->
                    val isSelected = currentDestination == item
                    NavigationRailItem(
                        selected = isSelected,
                        onClick = { currentDestination = item },
                        icon = {
                            Icon(
                                item.icon,
                                contentDescription = item.label,
                                modifier = Modifier.size(22.dp)
                            )
                        },
                        label = {
                            Text(
                                text = item.label,
                                style = MaterialTheme.typography.labelSmall
                            )
                        },
                        colors = NavigationRailItemDefaults.colors(
                            selectedIconColor = ColorBrandEmerald,
                            selectedTextColor = ColorBrandEmerald,
                            unselectedIconColor = ColorDarkMuted,
                            unselectedTextColor = ColorDarkMuted,
                            indicatorColor = ColorDarkSurface2
                        )
                    )
                }
            }

            Box(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxSize()
            ) {
                DestinationContent(
                    destination = currentDestination,
                    viewModel = viewModel,
                    windowWidthSizeClass = windowWidthSizeClass,
                    onNavigateToDestination = { currentDestination = it },
                    onSignOut = onSignOut
                )
            }
        }
    }
}

@Composable
private fun DestinationContent(
    destination: AppDestination,
    viewModel: MainViewModel,
    windowWidthSizeClass: WindowWidthSizeClass,
    onNavigateToDestination: (AppDestination) -> Unit,
    onSignOut: () -> Unit
) {
    AnimatedContent(
        targetState = destination,
        transitionSpec = { fadeIn() togetherWith fadeOut() },
        label = "nav_transition"
    ) { target ->
        when (target) {
            AppDestination.HOME -> HomeScreen(
                viewModel = viewModel,
                windowWidthSizeClass = windowWidthSizeClass,
                onNavigateToScan = { onNavigateToDestination(AppDestination.SCAN) },
                onNavigateToFood = { onNavigateToDestination(AppDestination.FOOD) },
                onNavigateToWorkouts = { onNavigateToDestination(AppDestination.WORKOUTS) },
                onNavigateToProgress = { onNavigateToDestination(AppDestination.PROGRESS) },
                onNavigateToCoach = { onNavigateToDestination(AppDestination.COACH) },
                onNavigateToProfile = { onNavigateToDestination(AppDestination.PROFILE) }
            )
            AppDestination.FOOD -> FoodLogScreen(
                viewModel = viewModel,
                onNavigateToScan = { onNavigateToDestination(AppDestination.SCAN) }
            )
            AppDestination.WORKOUTS -> WorkoutScreen(
                viewModel = viewModel
            )
            AppDestination.PROGRESS -> ProgressScreen(
                viewModel = viewModel
            )
            AppDestination.COACH -> CoachScreen(
                viewModel = viewModel
            )
            AppDestination.PROFILE -> ProfileSettingsScreen(
                viewModel = viewModel,
                onSignOut = onSignOut
            )
            AppDestination.SCAN -> Unit
        }
    }
}

@Composable
private fun BottomNavBar(
    currentDestination: AppDestination,
    onSelectDestination: (AppDestination) -> Unit
) {
    val navItems = listOf(
        AppDestination.HOME,
        AppDestination.FOOD,
        AppDestination.SCAN,
        AppDestination.WORKOUTS,
        AppDestination.PROGRESS
    )

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .background(ColorDarkSurface)
            .border(1.dp, ColorDarkBorder, RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp))
            .clip(RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp))
            .navigationBarsPadding()
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .height(72.dp)
                .padding(horizontal = 8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            navItems.forEach { item ->
                if (item == AppDestination.SCAN) {
                    // Center Elevated Scan Action Button
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .offset(y = (-8).dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Box(
                            modifier = Modifier
                                .size(56.dp)
                                .clip(CircleShape)
                                .background(
                                    Brush.linearGradient(
                                        listOf(ColorBrandEmerald, ColorBrandLime)
                                    )
                                )
                                .border(3.dp, ColorDarkSurface, CircleShape)
                                .clickable { onSelectDestination(AppDestination.SCAN) },
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                Icons.Outlined.AutoAwesome,
                                contentDescription = "Scan Meal",
                                tint = Color(0xFF042F1A),
                                modifier = Modifier.size(28.dp)
                            )
                        }
                    }
                } else {
                    val isSelected = currentDestination == item
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(12.dp))
                            .clickable { onSelectDestination(item) }
                            .padding(vertical = 8.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            Icon(
                                item.icon,
                                contentDescription = item.label,
                                tint = if (isSelected) ColorBrandEmerald else ColorDarkMuted,
                                modifier = Modifier.size(22.dp)
                            )
                            Text(
                                text = item.label,
                                color = if (isSelected) ColorBrandEmerald else ColorDarkMuted,
                                style = MaterialTheme.typography.labelSmall
                            )
                        }
                    }
                }
            }
        }
    }
}
