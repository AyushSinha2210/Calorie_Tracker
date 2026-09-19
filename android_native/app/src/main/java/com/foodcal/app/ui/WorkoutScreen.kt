package com.foodcal.app.ui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
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
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Bolt
import androidx.compose.material.icons.filled.Calculate
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.DirectionsBike
import androidx.compose.material.icons.filled.DirectionsRun
import androidx.compose.material.icons.filled.FitnessCenter
import androidx.compose.material.icons.filled.LocalFireDepartment
import androidx.compose.material.icons.filled.Pool
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.SelfImprovement
import androidx.compose.material.icons.filled.Sync
import androidx.compose.material.icons.filled.UploadFile
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import com.foodcal.app.data.parser.GpxParser
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import coil.compose.AsyncImage
import coil.request.ImageRequest
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.foodcal.app.data.model.WorkoutCalculationRequest
import com.foodcal.app.data.model.WorkoutLogEntry
import com.foodcal.app.data.model.WorkoutSearchItem
import kotlinx.coroutines.delay

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WorkoutScreen(
    viewModel: MainViewModel
) {
    val profile by viewModel.profile.collectAsStateWithLifecycle()
    val selectedDate by viewModel.selectedDate.collectAsStateWithLifecycle()
    val daySummary by viewModel.daySummary.collectAsStateWithLifecycle()

    var showAddModal by remember { mutableStateOf(false) }
    var importMessage by remember { mutableStateOf<String?>(null) }
    var workoutToDelete by remember { mutableStateOf<WorkoutLogEntry?>(null) }
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    val userWeight = profile?.weight ?: 70.0
    val context = LocalContext.current
    val gpxLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent()
    ) { uri: Uri? ->
        if (uri != null) {
            try {
                context.contentResolver.openInputStream(uri)?.use { stream ->
                    val parsed = GpxParser.parse(stream, userWeight)
                    val entry = WorkoutLogEntry(
                        exerciseName = parsed.name,
                        category = parsed.activityType,
                        inputType = "cardio",
                        durationMin = parsed.durationMin,
                        distanceKm = parsed.distanceKm,
                        caloriesBurned = parsed.caloriesBurned,
                        source = "gpx_import",
                        date = parsed.date
                    )
                    viewModel.saveWorkoutLog(entry)
                    importMessage = "Imported '${parsed.name}': ${parsed.distanceKm} km, ${parsed.durationMin} min (${parsed.caloriesBurned} kcal)!"
                }
            } catch (e: Exception) {
                importMessage = "Failed to import GPX file: ${e.message}"
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
                    Column(
                        modifier = Modifier
                            .weight(1f)
                            .padding(end = 8.dp)
                    ) {
                        Text(
                            "Workouts & Training",
                            style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold),
                            color = Color.White,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                        Text(
                            "${daySummary.workoutLogs.size} exercises • ${daySummary.totalCaloriesBurned} kcal burned",
                            style = MaterialTheme.typography.bodySmall,
                            color = ColorDarkMuted,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                    }

                    Button(
                        onClick = { showAddModal = true },
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = ColorBrandEmerald),
                        contentPadding = PaddingValues(horizontal = 14.dp, vertical = 8.dp)
                    ) {
                        Icon(Icons.Default.Add, contentDescription = null, tint = Color(0xFF042F1A), modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            "Log Exercise",
                            color = Color(0xFF042F1A),
                            fontWeight = FontWeight.Bold,
                            style = MaterialTheme.typography.labelMedium,
                            maxLines = 1,
                            softWrap = false
                        )
                    }
                }
            }

            // Summary Hero
            item {
                GlassCard(modifier = Modifier.fillMaxWidth()) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            Box(
                                modifier = Modifier
                                    .size(48.dp)
                                    .clip(CircleShape)
                                    .background(ColorMacroCal.copy(alpha = 0.2f)),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(Icons.Default.LocalFireDepartment, contentDescription = null, tint = ColorMacroCal, modifier = Modifier.size(26.dp))
                            }
                            Column {
                                Text("Total Calories Burned", style = MaterialTheme.typography.bodySmall, color = ColorDarkMuted)
                                Text("${daySummary.totalCaloriesBurned} kcal", style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold), color = Color.White)
                            }
                        }

                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(10.dp))
                                .background(ColorDarkSurface2)
                                .padding(horizontal = 12.dp, vertical = 6.dp)
                        ) {
                            Text("${daySummary.workoutLogs.size} Completed", style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold), color = ColorBrandLime)
                        }
                    }
                }
            }

            // Activity File Importer Card (GPX)
            item {
                GlassCard(
                    modifier = Modifier.fillMaxWidth(),
                    borderColor = ColorBrandEmerald.copy(alpha = 0.35f)
                ) {
                    Column(
                        modifier = Modifier.fillMaxWidth(),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(38.dp)
                                    .clip(CircleShape)
                                    .background(ColorBrandEmerald.copy(alpha = 0.2f)),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    Icons.Default.UploadFile,
                                    contentDescription = "Import",
                                    tint = ColorBrandEmerald,
                                    modifier = Modifier.size(20.dp)
                                )
                            }
                            Column {
                                Text(
                                    "Import Outdoor Activity",
                                    style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                                    color = Color.White
                                )
                                Text(
                                    "Import .gpx files from smartwatches, Samsung Health, Garmin, or Zepp",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = ColorDarkMuted
                                )
                            }
                        }

                        Button(
                            onClick = { gpxLauncher.launch("*/*") },
                            shape = RoundedCornerShape(12.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = ColorDarkSurface2),
                            modifier = Modifier
                                .fillMaxWidth()
                                .border(1.dp, ColorDarkBorder, RoundedCornerShape(12.dp))
                        ) {
                            Icon(Icons.Default.UploadFile, contentDescription = null, modifier = Modifier.size(18.dp), tint = ColorBrandLime)
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("Choose GPX Activity File (Free)", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                        }

                        if (importMessage != null) {
                            Text(
                                text = importMessage!!,
                                style = MaterialTheme.typography.bodySmall,
                                color = if (importMessage!!.startsWith("Failed")) Color(0xFFEF4444) else ColorBrandLime
                            )
                        }
                    }
                }
            }

            // Section Header
            item {
                Text(
                    "Today's Exercises (${daySummary.workoutLogs.size})",
                    style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                    color = Color.White
                )
            }

            if (daySummary.workoutLogs.isEmpty()) {
                item {
                    GlassCard(modifier = Modifier.fillMaxWidth()) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(24.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            Icon(Icons.Default.FitnessCenter, contentDescription = null, tint = ColorDarkMuted, modifier = Modifier.size(40.dp))
                            Text("No exercises logged for this day", fontWeight = FontWeight.SemiBold, color = Color.White)
                            Text("Keep track of your sets, reps, runs and calorie burn.", style = MaterialTheme.typography.bodySmall, color = ColorDarkMuted)
                        }
                    }
                }
            } else {
                items(daySummary.workoutLogs, key = { it.id }) { log ->
                    GlassCard(modifier = Modifier.fillMaxWidth()) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    Text(
                                        log.exerciseName,
                                        style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                                        color = Color.White
                                    )
                                    val isSport = log.inputType == "sports"
                                    Box(
                                        modifier = Modifier
                                            .clip(RoundedCornerShape(6.dp))
                                            .background(if (isSport) Color(0xFF10B981).copy(alpha = 0.2f) else ColorBrandEmerald.copy(alpha = 0.2f))
                                            .padding(horizontal = 6.dp, vertical = 2.dp)
                                    ) {
                                        Text(
                                            if (isSport) "Sports 🏸" else log.inputType.replaceFirstChar { it.uppercase() },
                                            style = MaterialTheme.typography.labelSmall,
                                            color = if (isSport) Color(0xFF34D399) else ColorBrandEmerald
                                        )
                                    }

                                    if (log.source == "gpx") {
                                        Box(
                                            modifier = Modifier
                                                .clip(RoundedCornerShape(6.dp))
                                                .background(Color(0xFF06B6D4).copy(alpha = 0.2f))
                                                .padding(horizontal = 6.dp, vertical = 2.dp)
                                        ) {
                                            Text(
                                                "GPX 📍",
                                                style = MaterialTheme.typography.labelSmall,
                                                color = Color(0xFF06B6D4),
                                                fontWeight = FontWeight.Bold
                                            )
                                        }
                                    }
                                }

                                Spacer(modifier = Modifier.height(4.dp))

                                val details = when (log.inputType) {
                                    "sports" -> "${log.durationMin} min of play"
                                    "weighted" -> "${log.sets} sets × ${log.reps} reps @ ${log.liftedWeight} kg"
                                    "bodyweight" -> "${log.sets} sets × ${log.reps} reps"
                                    "isometric" -> "${log.holdSeconds}s hold × ${log.sets} sets"
                                    else -> "${log.durationMin} min ${if (log.distanceKm > 0) "• ${log.distanceKm} km" else ""}"
                                }

                                Text(
                                    "${log.caloriesBurned} kcal burned  •  $details",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = ColorDarkMuted
                                )
                            }

                            IconButton(onClick = { workoutToDelete = log }) {
                                Icon(Icons.Default.Delete, contentDescription = "Delete", tint = Color(0xFFEF4444).copy(alpha = 0.7f), modifier = Modifier.size(20.dp))
                            }
                        }
                    }
                }
            }

            item {
                Spacer(modifier = Modifier.height(80.dp).navigationBarsPadding())
            }
        }
    }

    // Add Workout Modal
    if (showAddModal) {
        ModalBottomSheet(
            onDismissRequest = { showAddModal = false },
            sheetState = sheetState,
            containerColor = ColorDarkSurface,
            dragHandle = null
        ) {
            AddWorkoutSheet(
                viewModel = viewModel,
                userWeight = userWeight,
                selectedDate = selectedDate.toString(),
                onDone = { showAddModal = false }
            )
        }
    }

    // Delete Workout Dialog
    if (workoutToDelete != null) {
        AlertDialog(
            onDismissRequest = { workoutToDelete = null },
            title = { Text("Delete Workout?") },
            text = { Text("Are you sure you want to delete '${workoutToDelete?.exerciseName}'?") },
            confirmButton = {
                Button(
                    onClick = {
                        workoutToDelete?.let { viewModel.deleteWorkoutLog(it.id) }
                        workoutToDelete = null
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFEF4444))
                ) {
                    Text("Delete")
                }
            },
            dismissButton = {
                TextButton(onClick = { workoutToDelete = null }) {
                    Text("Cancel", color = ColorDarkMuted)
                }
            },
            containerColor = ColorDarkSurface,
            titleContentColor = Color.White,
            textContentColor = ColorDarkMuted
        )
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun AddWorkoutSheet(
    viewModel: MainViewModel,
    userWeight: Double,
    selectedDate: String,
    onDone: () -> Unit
) {
    var exerciseName by remember { mutableStateOf("") }
    var selectedExerciseId by remember { mutableStateOf(0) }
    var selectedCategory by remember { mutableStateOf("General") }
    var inputType by remember { mutableStateOf("cardio") } // cardio, weighted, bodyweight, isometric
    var exerciseImage by remember { mutableStateOf<String?>(null) }

    // Live debounced search
    var searchResults by remember { mutableStateOf<List<WorkoutSearchItem>>(emptyList()) }
    var isSearching by remember { mutableStateOf(false) }

    // Inputs
    var durationMin by remember { mutableStateOf("30") }
    var distanceKm by remember { mutableStateOf("") }
    var sets by remember { mutableStateOf("3") }
    var reps by remember { mutableStateOf("10") }
    var liftedWeight by remember { mutableStateOf("50") }
    var holdSeconds by remember { mutableStateOf("45") }

    var calculatedCalories by remember { mutableStateOf<Int?>(null) }
    var metVal by remember { mutableStateOf(0.0) }
    var effectiveDurationVal by remember { mutableStateOf(0.0) }
    var isCalculating by remember { mutableStateOf(false) }
    var isSaving by remember { mutableStateOf(false) }

    var suggestedCategoryFilter by remember { mutableStateOf("All") }

    val suggestedExercises = remember {
        listOf(
            SuggestedExerciseItem("Badminton", "Sports", "sports", "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=400&auto=format&fit=crop&q=80", Color(0xFF10B981)),
            SuggestedExerciseItem("Cricket", "Sports", "sports", "https://images.unsplash.com/photo-1531415074868-036b107e775a?w=400&auto=format&fit=crop&q=80", Color(0xFFF59E0B)),
            SuggestedExerciseItem("Football (Soccer)", "Sports", "sports", "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=400&auto=format&fit=crop&q=80", Color(0xFF3B82F6)),
            SuggestedExerciseItem("Basketball", "Sports", "sports", "https://images.unsplash.com/photo-1546519638-68e109498ffc?w=400&auto=format&fit=crop&q=80", Color(0xFFEA580C)),
            SuggestedExerciseItem("Tennis", "Sports", "sports", "https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?w=400&auto=format&fit=crop&q=80", Color(0xFF84CC16)),
            SuggestedExerciseItem("Table Tennis", "Sports", "sports", "https://images.unsplash.com/photo-1534158914592-062992fbe900?w=400&auto=format&fit=crop&q=80", Color(0xFF06B6D4)),
            SuggestedExerciseItem("Volleyball", "Sports", "sports", "https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?w=400&auto=format&fit=crop&q=80", Color(0xFFEC4899)),
            SuggestedExerciseItem("Squash", "Sports", "sports", "https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=400&auto=format&fit=crop&q=80", Color(0xFFA855F7)),
            SuggestedExerciseItem("Pickleball", "Sports", "sports", "https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?w=400&auto=format&fit=crop&q=80", Color(0xFF14B8A6)),
            SuggestedExerciseItem("Running (moderate)", "Cardio", "cardio", "https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=300&auto=format&fit=crop&q=80", Color(0xFF10B981)),
            SuggestedExerciseItem("Cycling (stationary)", "Cardio", "cardio", "https://images.unsplash.com/photo-1517649763962-0c623266ddc0?w=300&auto=format&fit=crop&q=80", Color(0xFF06B6D4)),
            SuggestedExerciseItem("Swimming (freestyle)", "Cardio", "cardio", "https://images.unsplash.com/photo-1530549387789-4c1017266635?w=300&auto=format&fit=crop&q=80", Color(0xFF3B82F6)),
            SuggestedExerciseItem("Walking (brisk)", "Cardio", "cardio", "https://images.unsplash.com/photo-1513593771513-7b58b6c4af38?w=300&auto=format&fit=crop&q=80", Color(0xFF14B8A6)),
            SuggestedExerciseItem("Bench Press", "Chest", "weighted", "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=300&auto=format&fit=crop&q=80", Color(0xFFF59E0B)),
            SuggestedExerciseItem("Squats", "Legs", "weighted", "https://images.unsplash.com/photo-1574680096145-d05b474e2155?w=300&auto=format&fit=crop&q=80", Color(0xFFEC4899)),
            SuggestedExerciseItem("Deadlift", "Back", "weighted", "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=300&auto=format&fit=crop&q=80", Color(0xFF8B5CF6)),
            SuggestedExerciseItem("Push-ups", "Upper Body", "bodyweight", "https://images.unsplash.com/photo-1598971639058-fab3c3109a00?w=300&auto=format&fit=crop&q=80", Color(0xFF10B981)),
            SuggestedExerciseItem("Pull-ups", "Back / Arms", "bodyweight", "https://images.unsplash.com/photo-1597452485669-2c7bb5fef90d?w=300&auto=format&fit=crop&q=80", Color(0xFF6366F1)),
            SuggestedExerciseItem("Plank", "Core", "isometric", "https://images.unsplash.com/photo-1566241142559-40e1dab266c6?w=300&auto=format&fit=crop&q=80", Color(0xFFF97316)),
            SuggestedExerciseItem("Jump Rope", "Cardio", "cardio", "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=300&auto=format&fit=crop&q=80", Color(0xFFEAB308)),
            SuggestedExerciseItem("HIIT Circuit", "Full Body", "cardio", "https://images.unsplash.com/photo-1434682881908-b43d0467b798?w=300&auto=format&fit=crop&q=80", Color(0xFFEF4444))
        )
    }

    val filteredSuggestions = remember(suggestedCategoryFilter, suggestedExercises) {
        when (suggestedCategoryFilter) {
            "🏸 Sports" -> suggestedExercises.filter { it.inputType == "sports" }
            "🏃 Cardio" -> suggestedExercises.filter { it.inputType == "cardio" }
            "🏋️ Gym & Core" -> suggestedExercises.filter { it.inputType in listOf("weighted", "bodyweight", "isometric") }
            else -> suggestedExercises
        }
    }

    // Debounced search effect with instant local sports/exercise matching
    LaunchedEffect(exerciseName) {
        val query = exerciseName.trim()
        if (query.length >= 2) {
            val localMatches = suggestedExercises.filter {
                it.name.contains(query, ignoreCase = true) ||
                (query.contains("sport", ignoreCase = true) && it.inputType == "sports")
            }.map {
                WorkoutSearchItem(
                    id = if (it.inputType == "sports") -1 else 0,
                    name = it.name,
                    category = it.category,
                    image = it.imageUrl
                )
            }
            searchResults = localMatches.take(4)

            delay(350)
            isSearching = true
            viewModel.searchWorkouts(query) { res ->
                isSearching = false
                val remote = res.getOrDefault(emptyList())
                val seen = mutableSetOf<String>()
                val combined = mutableListOf<WorkoutSearchItem>()
                for (item in localMatches + remote) {
                    val key = item.name.lowercase().trim()
                    if (seen.add(key)) {
                        combined.add(item)
                    }
                }
                searchResults = combined.take(6)
            }
        } else {
            searchResults = emptyList()
        }
    }

    val scrollState = rememberScrollState()

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(20.dp)
            .navigationBarsPadding()
            .imePadding()
            .verticalScroll(scrollState),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        Text("Log Exercise", style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold), color = Color.White)

        // Exercise Name with Search Icon
        OutlinedTextField(
            value = exerciseName,
            onValueChange = {
                exerciseName = it
                calculatedCalories = null
            },
            label = { Text("Exercise Name") },
            placeholder = { Text("Search e.g. Badminton, Running, Bench Press") },
            trailingIcon = {
                if (isSearching) {
                    CircularProgressIndicator(modifier = Modifier.size(18.dp), color = ColorBrandEmerald, strokeWidth = 2.dp)
                } else {
                    Icon(Icons.Default.Search, contentDescription = null, tint = ColorDarkMuted)
                }
            },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
            colors = workoutTextFieldColors()
        )

        // Search Results Dropdown/Chips
        if (searchResults.isNotEmpty()) {
            Text("Search Suggestions", color = ColorBrandLime, style = MaterialTheme.typography.labelSmall)
            FlowRow(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                searchResults.forEach { item ->
                    FilterChip(
                        selected = false,
                        onClick = {
                            exerciseName = item.name
                            selectedExerciseId = item.id
                            searchResults = emptyList()
                            calculatedCalories = null
                            val matchedLocal = suggestedExercises.find { it.name.equals(item.name, ignoreCase = true) }
                            if (matchedLocal != null) {
                                inputType = matchedLocal.inputType
                                selectedCategory = matchedLocal.category
                                exerciseImage = matchedLocal.imageUrl
                            } else if (item.id < 0 || item.category?.contains("Sport", ignoreCase = true) == true) {
                                inputType = "sports"
                                selectedCategory = "Sports"
                                exerciseImage = item.image
                            } else {
                                // Fetch exercise details from wger to auto-classify inputType
                                viewModel.getExerciseInfo(item.id) { infoRes ->
                                    infoRes.getOrNull()?.let { info ->
                                        inputType = info.inputType
                                        selectedCategory = info.categoryName ?: "General"
                                        exerciseImage = info.image
                                    }
                                }
                            }
                        },
                        leadingIcon = {
                            Icon(
                                Icons.Default.FitnessCenter,
                                contentDescription = null,
                                modifier = Modifier.size(16.dp),
                                tint = ColorBrandEmerald
                            )
                        },
                        label = { Text(item.name, style = MaterialTheme.typography.labelSmall) },
                        colors = FilterChipDefaults.filterChipColors(
                            containerColor = ColorDarkSurface2,
                            labelColor = Color.White
                        )
                    )
                }
            }
        }

        // Visual Suggested Exercises with Pictures
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Suggested Exercises (Choose to prefill)", color = ColorDarkMuted, style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold))
            FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                listOf("All", "🏸 Sports", "🏃 Cardio", "🏋️ Gym & Core").forEach { tab ->
                    FilterChip(
                        selected = suggestedCategoryFilter == tab,
                        onClick = { suggestedCategoryFilter = tab },
                        label = { Text(tab, style = MaterialTheme.typography.labelSmall) },
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
        val context = LocalContext.current
        LazyRow(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            items(filteredSuggestions, key = { it.name }) { ex ->
                val isSelected = exerciseName == ex.name
                Column(
                    modifier = Modifier
                        .width(122.dp)
                        .clip(RoundedCornerShape(16.dp))
                        .background(ColorDarkSurface2)
                        .border(
                            width = if (isSelected) 2.dp else 1.dp,
                            color = if (isSelected) ColorBrandLime else ColorDarkBorder,
                            shape = RoundedCornerShape(16.dp)
                        )
                        .clickable {
                            exerciseName = ex.name
                            selectedCategory = ex.category
                            inputType = ex.inputType
                            exerciseImage = ex.imageUrl
                            calculatedCalories = null
                        }
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(72.dp)
                            .background(ex.accentColor.copy(alpha = 0.2f))
                    ) {
                        AsyncImage(
                            model = ImageRequest.Builder(context)
                                .data(ex.imageUrl)
                                .crossfade(true)
                                .build(),
                            contentDescription = ex.name,
                            contentScale = ContentScale.Crop,
                            modifier = Modifier.fillMaxSize()
                        )

                        // Category badge
                        Box(
                            modifier = Modifier
                                .padding(6.dp)
                                .align(Alignment.TopStart)
                                .clip(RoundedCornerShape(6.dp))
                                .background(Color(0xD90F172A))
                                .padding(horizontal = 6.dp, vertical = 2.dp)
                        ) {
                            Text(
                                text = ex.category,
                                style = MaterialTheme.typography.labelSmall.copy(fontSize = 9.sp, fontWeight = FontWeight.Bold),
                                color = ex.accentColor
                            )
                        }

                        if (isSelected) {
                            Box(
                                modifier = Modifier
                                    .padding(6.dp)
                                    .align(Alignment.TopEnd)
                                    .size(20.dp)
                                    .clip(CircleShape)
                                    .background(ColorBrandLime),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    Icons.Default.CheckCircle,
                                    contentDescription = null,
                                    tint = Color(0xFF042F1A),
                                    modifier = Modifier.size(16.dp)
                                )
                            }
                        }
                    }

                    Column(
                        modifier = Modifier.padding(8.dp),
                        verticalArrangement = Arrangement.spacedBy(2.dp)
                    ) {
                        Text(
                            text = ex.name,
                            style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold, fontSize = 11.sp),
                            color = Color.White,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                        Text(
                            text = ex.inputType.replaceFirstChar { it.uppercase() },
                            style = MaterialTheme.typography.labelSmall.copy(fontSize = 10.sp),
                            color = ColorDarkMuted
                        )
                    }
                }
            }
        }

        // Input Type Chips
        Text("Exercise Type", color = ColorDarkMuted, style = MaterialTheme.typography.labelMedium)
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf(
                "sports" to "🏸 Sports",
                "cardio" to "🏃 Cardio",
                "weighted" to "🏋️ Weighted",
                "bodyweight" to "🤸 Bodyweight",
                "isometric" to "⏱️ Isometric"
            ).forEach { (typeKey, label) ->
                FilterChip(
                    selected = inputType == typeKey,
                    onClick = {
                        inputType = typeKey
                        calculatedCalories = null
                    },
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

        // Dynamic fields based on type
        when (inputType) {
            "sports" -> {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    OutlinedTextField(
                        value = durationMin,
                        onValueChange = { durationMin = it; calculatedCalories = null },
                        label = { Text("Duration Played (min)") },
                        placeholder = { Text("e.g. 45") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        colors = workoutTextFieldColors()
                    )

                    // Quick duration preset chips
                    Text("Quick Presets:", color = ColorDarkMuted, style = MaterialTheme.typography.labelSmall)
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        listOf("30", "45", "60", "90", "120").forEach { min ->
                            FilterChip(
                                selected = durationMin == min,
                                onClick = {
                                    durationMin = min
                                    calculatedCalories = null
                                },
                                label = { Text("${min}m", style = MaterialTheme.typography.labelSmall) },
                                colors = FilterChipDefaults.filterChipColors(
                                    selectedContainerColor = ColorBrandEmerald,
                                    selectedLabelColor = Color(0xFF042F1A),
                                    containerColor = ColorDarkSurface2,
                                    labelColor = Color.White
                                )
                            )
                        }
                    }

                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(8.dp))
                            .background(ColorBrandEmerald.copy(alpha = 0.1f))
                            .padding(horizontal = 10.dp, vertical = 6.dp)
                    ) {
                        Text(
                            "🏸 Calories calculated based on sport intensity & your body weight (${String.format(java.util.Locale.US, "%.1f", userWeight)} kg)",
                            style = MaterialTheme.typography.bodySmall.copy(fontSize = 11.sp),
                            color = ColorBrandEmerald
                        )
                    }
                }
            }
            "cardio" -> {
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    OutlinedTextField(
                        value = durationMin,
                        onValueChange = { durationMin = it; calculatedCalories = null },
                        label = { Text("Duration (min)") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        modifier = Modifier.weight(1f),
                        singleLine = true,
                        colors = workoutTextFieldColors()
                    )
                    OutlinedTextField(
                        value = distanceKm,
                        onValueChange = { distanceKm = it; calculatedCalories = null },
                        label = { Text("Distance (km, opt)") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                        modifier = Modifier.weight(1f),
                        singleLine = true,
                        colors = workoutTextFieldColors()
                    )
                }
            }
            "weighted" -> {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        value = sets,
                        onValueChange = { sets = it; calculatedCalories = null },
                        label = { Text("Sets") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        modifier = Modifier.weight(1f),
                        singleLine = true,
                        colors = workoutTextFieldColors()
                    )
                    OutlinedTextField(
                        value = reps,
                        onValueChange = { reps = it; calculatedCalories = null },
                        label = { Text("Reps") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        modifier = Modifier.weight(1f),
                        singleLine = true,
                        colors = workoutTextFieldColors()
                    )
                    OutlinedTextField(
                        value = liftedWeight,
                        onValueChange = { liftedWeight = it; calculatedCalories = null },
                        label = { Text("Weight (kg)") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                        modifier = Modifier.weight(1f),
                        singleLine = true,
                        colors = workoutTextFieldColors()
                    )
                }
            }
            "bodyweight" -> {
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    OutlinedTextField(
                        value = sets,
                        onValueChange = { sets = it; calculatedCalories = null },
                        label = { Text("Sets") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        modifier = Modifier.weight(1f),
                        singleLine = true,
                        colors = workoutTextFieldColors()
                    )
                    OutlinedTextField(
                        value = reps,
                        onValueChange = { reps = it; calculatedCalories = null },
                        label = { Text("Reps") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        modifier = Modifier.weight(1f),
                        singleLine = true,
                        colors = workoutTextFieldColors()
                    )
                }
            }
            "isometric" -> {
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    OutlinedTextField(
                        value = holdSeconds,
                        onValueChange = { holdSeconds = it; calculatedCalories = null },
                        label = { Text("Hold (seconds)") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        modifier = Modifier.weight(1f),
                        singleLine = true,
                        colors = workoutTextFieldColors()
                    )
                    OutlinedTextField(
                        value = sets,
                        onValueChange = { sets = it; calculatedCalories = null },
                        label = { Text("Sets") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        modifier = Modifier.weight(1f),
                        singleLine = true,
                        colors = workoutTextFieldColors()
                    )
                }
            }
        }

        // Calculation Trigger & Output
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Button(
                onClick = {
                    if (exerciseName.isNotBlank()) {
                        isCalculating = true
                        val req = WorkoutCalculationRequest(
                            exerciseName = exerciseName,
                            inputType = inputType,
                            durationMin = durationMin.toIntOrNull() ?: 30,
                            sets = sets.toIntOrNull() ?: 3,
                            reps = reps.toIntOrNull() ?: 10,
                            liftedWeight = liftedWeight.toDoubleOrNull() ?: 0.0,
                            holdSeconds = holdSeconds.toIntOrNull() ?: 0,
                            weightKg = userWeight
                        )
                        viewModel.calculateWorkout(req) { res ->
                            isCalculating = false
                            val response = res.getOrNull()
                            if (response != null) {
                                calculatedCalories = response.caloriesBurned
                                metVal = response.met
                                effectiveDurationVal = response.effectiveDurationMin
                            } else {
                                calculatedCalories = fallbackCalories(inputType, durationMin.toIntOrNull() ?: 30, sets.toIntOrNull() ?: 3, userWeight, exerciseName)
                            }
                        }
                    }
                },
                enabled = exerciseName.isNotBlank() && !isCalculating,
                colors = ButtonDefaults.buttonColors(containerColor = ColorDarkSurface2)
            ) {
                if (isCalculating) {
                    CircularProgressIndicator(modifier = Modifier.size(16.dp), color = ColorBrandLime, strokeWidth = 2.dp)
                } else {
                    Icon(Icons.Default.Calculate, contentDescription = null, tint = ColorBrandLime, modifier = Modifier.size(18.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Calculate Burned", color = ColorBrandLime)
                }
            }

            if (calculatedCalories != null) {
                Text(
                    "${calculatedCalories} kcal",
                    fontWeight = FontWeight.Black,
                    color = ColorMacroCal,
                    style = MaterialTheme.typography.titleMedium
                )
            }
        }

        // Save Workout Button
        Button(
            onClick = {
                if (isSaving) return@Button
                if (exerciseName.isNotBlank()) {
                    isSaving = true
                    val finalCalories = calculatedCalories ?: fallbackCalories(inputType, durationMin.toIntOrNull() ?: 30, sets.toIntOrNull() ?: 3, userWeight, exerciseName)
                    val entry = WorkoutLogEntry(
                        exerciseName = exerciseName,
                        exerciseId = selectedExerciseId,
                        category = selectedCategory,
                        inputType = inputType,
                        durationMin = durationMin.toIntOrNull() ?: 0,
                        distanceKm = distanceKm.toDoubleOrNull() ?: 0.0,
                        sets = sets.toIntOrNull() ?: 0,
                        reps = reps.toIntOrNull() ?: 0,
                        liftedWeight = liftedWeight.toDoubleOrNull() ?: 0.0,
                        holdSeconds = holdSeconds.toIntOrNull() ?: 0,
                        caloriesBurned = finalCalories,
                        met = metVal,
                        effectiveDurationMin = effectiveDurationVal,
                        weightKg = userWeight,
                        image = exerciseImage,
                        date = selectedDate
                    )
                    onDone()
                    viewModel.saveWorkoutLog(entry)
                }
            },
            enabled = !isSaving && exerciseName.isNotBlank(),
            modifier = Modifier
                .fillMaxWidth()
                .height(50.dp),
            shape = RoundedCornerShape(14.dp),
            colors = ButtonDefaults.buttonColors(containerColor = ColorBrandEmerald, contentColor = Color(0xFF042F1A))
        ) {
            Text("Save Workout", fontWeight = FontWeight.Bold, fontSize = 16.sp)
        }

        Spacer(modifier = Modifier.height(20.dp))
    }
}

private fun fallbackCalories(inputType: String, durationMin: Int, sets: Int, weightKg: Double, exerciseName: String = ""): Int {
    return when (inputType) {
        "sports" -> {
            val name = exerciseName.lowercase()
            val met = when {
                name.contains("squash") -> 12.0
                name.contains("boxing") -> 9.0
                name.contains("football") || name.contains("soccer") -> 8.5
                name.contains("basketball") || name.contains("hockey") -> 8.0
                name.contains("swimming") -> 8.0
                name.contains("tennis") -> 7.3
                name.contains("badminton") -> 7.0
                name.contains("pickleball") || name.contains("padel") -> 6.5
                name.contains("cricket") -> 5.0
                name.contains("volleyball") -> 4.5
                name.contains("table tennis") || name.contains("ping pong") -> 4.0
                else -> 7.0
            }
            ((met * 3.5 * weightKg / 200.0) * durationMin).toInt().coerceAtLeast(20)
        }
        "cardio" -> ((7.0 * 3.5 * weightKg / 200.0) * durationMin).toInt().coerceAtLeast(20)
        "weighted" -> (sets * 25).coerceAtLeast(30)
        "isometric" -> (sets * 15).coerceAtLeast(20)
        else -> (sets * 20).coerceAtLeast(30)
    }
}

@Composable
private fun workoutTextFieldColors() = OutlinedTextFieldDefaults.colors(
    focusedBorderColor = ColorBrandEmerald,
    unfocusedBorderColor = ColorDarkBorder,
    focusedLabelColor = ColorBrandEmerald,
    unfocusedLabelColor = ColorDarkMuted,
    focusedTextColor = Color.White,
    unfocusedTextColor = Color.White,
    cursorColor = ColorBrandEmerald
)

private data class SuggestedExerciseItem(
    val name: String,
    val category: String,
    val inputType: String,
    val imageUrl: String,
    val accentColor: Color
)
