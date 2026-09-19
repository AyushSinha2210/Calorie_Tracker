package com.foodcal.app.ui

import androidx.compose.animation.AnimatedVisibility
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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.PhotoCamera
import androidx.compose.material.icons.filled.Restaurant
import androidx.compose.material.icons.outlined.AutoAwesome
import androidx.compose.material.icons.outlined.Check
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
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.TabRowDefaults
import androidx.compose.material3.TabRowDefaults.tabIndicatorOffset
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
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
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.foodcal.app.data.model.*
import java.time.LocalDate

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun FoodLogScreen(
    viewModel: MainViewModel,
    onNavigateToScan: () -> Unit
) {
    val selectedDate by viewModel.selectedDate.collectAsStateWithLifecycle()
    val daySummary by viewModel.daySummary.collectAsStateWithLifecycle()

    var showAddModal by remember { mutableStateOf(false) }
    var entryToEdit by remember { mutableStateOf<FoodLogEntry?>(null) }
    var entryToDelete by remember { mutableStateOf<FoodLogEntry?>(null) }

    val bottomSheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    val mealCategories = CANONICAL_MEAL_TYPES

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
                            "Food & Nutrition Log",
                            style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold),
                            color = Color.White,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                        Text(
                            selectedDate.toString(),
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
                            "Add Food",
                            color = Color(0xFF042F1A),
                            fontWeight = FontWeight.Bold,
                            style = MaterialTheme.typography.labelMedium,
                            maxLines = 1,
                            softWrap = false
                        )
                    }
                }
            }

            // Selected Date Summary Bar
            item {
                GlassCard(modifier = Modifier.fillMaxWidth()) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceAround
                    ) {
                        SummaryStat("Calories", "${daySummary.totalCalories} kcal", ColorMacroCal)
                        SummaryStat("Protein", "${daySummary.totalProtein.toInt()}g", ColorMacroProtein)
                        SummaryStat("Carbs", "${daySummary.totalCarbs.toInt()}g", ColorMacroCarbs)
                        SummaryStat("Fat", "${daySummary.totalFat.toInt()}g", ColorMacroFat)
                    }
                }
            }

            // Grouped Meals by Category
            mealCategories.forEach { category ->
                val categoryMeals = daySummary.foodLogs.filter { it.mealType.equals(category, ignoreCase = true) }

                item {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            category,
                            style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                            color = Color.White
                        )

                        val catCalories = categoryMeals.sumOf { it.calories }
                        if (catCalories > 0) {
                            Text(
                                "$catCalories kcal",
                                style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold),
                                color = ColorBrandEmerald
                            )
                        }
                    }
                }

                if (categoryMeals.isEmpty()) {
                    item {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(16.dp))
                                .background(ColorDarkSurface.copy(alpha = 0.5f))
                                .border(1.dp, ColorDarkBorder.copy(alpha = 0.4f), RoundedCornerShape(16.dp))
                                .padding(vertical = 12.dp, horizontal = 16.dp)
                        ) {
                            Text("No $category logged", color = ColorDarkMuted, style = MaterialTheme.typography.bodySmall)
                        }
                    }
                } else {
                    items(categoryMeals, key = { it.id }) { meal ->
                        MealRowCard(
                            meal = meal,
                            onEdit = { entryToEdit = meal },
                            onDelete = { entryToDelete = meal }
                        )
                    }
                }
            }

            // Other Group for any uncategorized or legacy meal types
            val otherMeals = daySummary.foodLogs.filter { log ->
                mealCategories.none { it.equals(log.mealType, ignoreCase = true) }
            }
            if (otherMeals.isNotEmpty()) {
                item {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            "Other",
                            style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                            color = Color.White
                        )
                        val catCalories = otherMeals.sumOf { it.calories }
                        if (catCalories > 0) {
                            Text(
                                "$catCalories kcal",
                                style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold),
                                color = ColorBrandEmerald
                            )
                        }
                    }
                }
                items(otherMeals, key = { it.id }) { meal ->
                    MealRowCard(
                        meal = meal,
                        onEdit = { entryToEdit = meal },
                        onDelete = { entryToDelete = meal }
                    )
                }
            }

            item {
                Spacer(modifier = Modifier.height(90.dp))
            }
        }
    }

    // Add Food Bottom Sheet
    if (showAddModal) {
        ModalBottomSheet(
            onDismissRequest = { showAddModal = false },
            sheetState = bottomSheetState,
            containerColor = ColorDarkSurface,
            dragHandle = null
        ) {
            AddFoodSheetContent(
                viewModel = viewModel,
                selectedDate = selectedDate.toString(),
                onNavigateToScan = {
                    showAddModal = false
                    onNavigateToScan()
                },
                onDone = { showAddModal = false }
            )
        }
    }

    // Edit Meal Dialog
    if (entryToEdit != null) {
        EditMealDialog(
            entry = entryToEdit!!,
            onSave = { id, name, cal, pro, carbs, fat ->
                viewModel.updateFoodLog(id, name, cal, pro, carbs, fat)
                entryToEdit = null
            },
            onDismiss = { entryToEdit = null }
        )
    }

    // Delete Confirmation Dialog
    if (entryToDelete != null) {
        AlertDialog(
            onDismissRequest = { entryToDelete = null },
            title = { Text("Delete Meal Entry?") },
            text = { Text("Are you sure you want to delete '${entryToDelete?.itemName}'?") },
            confirmButton = {
                Button(
                    onClick = {
                        entryToDelete?.let { viewModel.deleteFoodLog(it.id) }
                        entryToDelete = null
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFEF4444))
                ) {
                    Text("Delete")
                }
            },
            dismissButton = {
                TextButton(onClick = { entryToDelete = null }) {
                    Text("Cancel", color = ColorDarkMuted)
                }
            },
            containerColor = ColorDarkSurface,
            titleContentColor = Color.White,
            textContentColor = ColorDarkMuted
        )
    }
}

@Composable
private fun SummaryStat(label: String, value: String, color: Color) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(label, style = MaterialTheme.typography.labelSmall, color = ColorDarkMuted)
        Spacer(modifier = Modifier.height(2.dp))
        Text(value, fontWeight = FontWeight.Bold, color = color, style = MaterialTheme.typography.bodyMedium)
    }
}

@Composable
private fun MealRowCard(
    meal: FoodLogEntry,
    onEdit: () -> Unit,
    onDelete: () -> Unit
) {
    GlassCard(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(meal.itemName, fontWeight = FontWeight.Bold, color = Color.White)
                    if (meal.healthScore > 0) {
                        HealthScoreBadge(score = meal.healthScore)
                    }
                }
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    "${meal.calories} kcal  •  P: ${meal.protein.toInt()}g  •  C: ${meal.carbs.toInt()}g  •  F: ${meal.fat.toInt()}g",
                    style = MaterialTheme.typography.bodySmall,
                    color = ColorDarkMuted
                )
            }

            Row {
                IconButton(onClick = onEdit) {
                    Icon(Icons.Default.Edit, contentDescription = "Edit", tint = ColorDarkMuted, modifier = Modifier.size(18.dp))
                }
                IconButton(onClick = onDelete) {
                    Icon(Icons.Default.Delete, contentDescription = "Delete", tint = Color(0xFFEF4444).copy(alpha = 0.7f), modifier = Modifier.size(18.dp))
                }
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun AddFoodSheetContent(
    viewModel: MainViewModel,
    selectedDate: String,
    onNavigateToScan: () -> Unit,
    onDone: () -> Unit
) {
    var tabIndex by remember { mutableIntStateOf(0) } // 0: AI Text, 1: Manual
    var mealType by remember { mutableStateOf(detectMealType()) }

    // AI Text state
    var textPrompt by remember { mutableStateOf("") }
    var isAnalyzing by remember { mutableStateOf(false) }
    var analyzeResponse by remember { mutableStateOf<AnalyzeTextResponse?>(null) }
    var analyzeError by remember { mutableStateOf<String?>(null) }

    // Manual Entry state
    var manualName by remember { mutableStateOf("") }
    var manualCalories by remember { mutableStateOf("") }
    var manualProtein by remember { mutableStateOf("") }
    var manualCarbs by remember { mutableStateOf("") }
    var manualFat by remember { mutableStateOf("") }
    var isLookingUp by remember { mutableStateOf(false) }
    var lookupError by remember { mutableStateOf<String?>(null) }
    var isSaving by remember { mutableStateOf(false) }

    val scrollState = rememberScrollState()

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(20.dp)
            .verticalScroll(scrollState),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Quick Photo Scan Shortcut
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(16.dp))
                .background(ColorBrandEmerald.copy(alpha = 0.15f))
                .border(1.dp, ColorBrandEmerald.copy(alpha = 0.4f), RoundedCornerShape(16.dp))
                .clickable { onNavigateToScan() }
                .padding(14.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    Icon(Icons.Default.PhotoCamera, contentDescription = null, tint = ColorBrandLime)
                    Column {
                        Text("Cal AI Photo Scanner", fontWeight = FontWeight.Bold, color = Color.White)
                        Text("Snap meal photo for instant nutrition analysis", style = MaterialTheme.typography.bodySmall, color = ColorDarkMuted)
                    }
                }
                Icon(Icons.Outlined.AutoAwesome, contentDescription = null, tint = ColorBrandLime)
            }
        }

        // Tabs: AI Text vs Manual
        TabRow(
            selectedTabIndex = tabIndex,
            containerColor = Color.Transparent,
            contentColor = ColorBrandEmerald,
            indicator = { tabPositions ->
                TabRowDefaults.SecondaryIndicator(
                    modifier = Modifier.tabIndicatorOffset(tabPositions[tabIndex]),
                    color = ColorBrandEmerald
                )
            },
            divider = {}
        ) {
            Tab(selected = tabIndex == 0, onClick = { tabIndex = 0 }, text = { Text("AI Text Assistant", fontWeight = FontWeight.Bold) })
            Tab(selected = tabIndex == 1, onClick = { tabIndex = 1 }, text = { Text("Manual Entry", fontWeight = FontWeight.Bold) })
        }

        // Meal Type Filter Chips with FlowRow
        Text("Meal Type", color = ColorDarkMuted, style = MaterialTheme.typography.labelMedium)
        FlowRow(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            for (type in CANONICAL_MEAL_TYPES) {
                FilterChip(
                    selected = mealType == type,
                    onClick = { mealType = type },
                    label = { Text(type) },
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = ColorBrandEmerald,
                        selectedLabelColor = Color(0xFF042F1A),
                        containerColor = ColorDarkSurface2,
                        labelColor = Color.White
                    )
                )
            }
        }

        if (tabIndex == 0) {
            // AI Text Entry
            OutlinedTextField(
                value = textPrompt,
                onValueChange = { textPrompt = it },
                label = { Text("Describe what you ate") },
                placeholder = { Text("e.g. 2 eggs sunny side up with 2 slices of whole grain toast and an apple") },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(100.dp),
                colors = foodTextFieldColors()
            )

            if (analyzeError != null) {
                Text(analyzeError!!, color = Color(0xFFEF4444), style = MaterialTheme.typography.bodySmall)
            }

            Button(
                onClick = {
                    if (textPrompt.isNotBlank()) {
                        isAnalyzing = true
                        analyzeError = null
                        viewModel.analyzeText(textPrompt) { res ->
                            isAnalyzing = false
                            res.fold(
                                onSuccess = { analyzeResponse = it },
                                onFailure = { analyzeError = it.localizedMessage ?: "Could not analyze description" }
                            )
                        }
                    }
                },
                modifier = Modifier.fillMaxWidth(),
                enabled = !isAnalyzing && textPrompt.isNotBlank(),
                colors = ButtonDefaults.buttonColors(containerColor = ColorBrandLime, contentColor = Color(0xFF1A3800))
            ) {
                if (isAnalyzing) {
                    CircularProgressIndicator(modifier = Modifier.size(20.dp), color = Color(0xFF1A3800), strokeWidth = 2.dp)
                } else {
                    Icon(Icons.Outlined.AutoAwesome, contentDescription = null)
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Analyze with AI", fontWeight = FontWeight.Bold)
                }
            }

            // AI Preview Results
            if (analyzeResponse != null) {
                val resp = analyzeResponse!!
                GlassCard(modifier = Modifier.fillMaxWidth()) {
                    Text("AI Estimation Results", fontWeight = FontWeight.Bold, color = Color.White)
                    Spacer(modifier = Modifier.height(6.dp))
                    Text(
                        "${resp.totalCalories} kcal  •  Protein: ${resp.totalProtein.toInt()}g",
                        fontWeight = FontWeight.Bold,
                        color = ColorBrandEmerald
                    )
                    Spacer(modifier = Modifier.height(10.dp))
                    resp.items.forEach { item ->
                        Text("• ${item.name} (${item.quantity}): ${item.calories} kcal, ${item.protein}g protein", style = MaterialTheme.typography.bodySmall, color = ColorDarkMuted)
                    }
                    Spacer(modifier = Modifier.height(14.dp))
                    Button(
                        onClick = {
                            if (isSaving) return@Button
                            isSaving = true
                            val totalCarbs = if (resp.totalCarbs > 0.0) resp.totalCarbs else resp.items.sumOf { it.carbs }
                            val totalFat = if (resp.totalFat > 0.0) resp.totalFat else resp.items.sumOf { it.fat }
                            val entry = FoodLogEntry(
                                itemName = textPrompt.take(40),
                                quantity = "1 meal",
                                calories = resp.totalCalories,
                                protein = resp.totalProtein,
                                carbs = totalCarbs,
                                fat = totalFat,
                                healthScore = 0,
                                source = "text",
                                mealType = mealType,
                                date = selectedDate,
                                items = resp.items
                            )
                            onDone()
                            viewModel.saveFoodLog(entry)
                        },
                        enabled = !isSaving,
                        modifier = Modifier.fillMaxWidth(),
                        colors = ButtonDefaults.buttonColors(containerColor = ColorBrandEmerald)
                    ) {
                        Text("Save AI Meal", fontWeight = FontWeight.Bold)
                    }
                }
            }
        } else {
            // Manual Entry
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                OutlinedTextField(
                    value = manualName,
                    onValueChange = { manualName = it; lookupError = null },
                    label = { Text("Meal / Food Name") },
                    modifier = Modifier.weight(1f),
                    singleLine = true,
                    colors = foodTextFieldColors()
                )

                Button(
                    onClick = {
                        if (manualName.isNotBlank()) {
                            isLookingUp = true
                            lookupError = null
                            viewModel.lookupFood(manualName.trim()) { res ->
                                isLookingUp = false
                                res.fold(
                                    onSuccess = { itm ->
                                        manualCalories = itm.calories.toString()
                                        manualProtein = itm.protein.toString()
                                        manualCarbs = itm.carbs.toString()
                                        manualFat = itm.fat.toString()
                                    },
                                    onFailure = {
                                        lookupError = "Not found in database"
                                    }
                                )
                            }
                        }
                    },
                    enabled = !isLookingUp && manualName.isNotBlank(),
                    colors = ButtonDefaults.buttonColors(containerColor = ColorDarkSurface2)
                ) {
                    if (isLookingUp) {
                        CircularProgressIndicator(modifier = Modifier.size(16.dp), color = ColorBrandEmerald, strokeWidth = 2.dp)
                    } else {
                        Text("Look up", color = ColorBrandEmerald, fontWeight = FontWeight.Bold)
                    }
                }
            }

            if (lookupError != null) {
                Text(lookupError!!, color = Color(0xFFEF4444), style = MaterialTheme.typography.bodySmall)
            }

            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedTextField(
                    value = manualCalories,
                    onValueChange = { manualCalories = it },
                    label = { Text("Calories (kcal)") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    modifier = Modifier.weight(1f),
                    singleLine = true,
                    colors = foodTextFieldColors()
                )

                OutlinedTextField(
                    value = manualProtein,
                    onValueChange = { manualProtein = it },
                    label = { Text("Protein (g)") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    modifier = Modifier.weight(1f),
                    singleLine = true,
                    colors = foodTextFieldColors()
                )
            }

            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedTextField(
                    value = manualCarbs,
                    onValueChange = { manualCarbs = it },
                    label = { Text("Carbs (g)") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    modifier = Modifier.weight(1f),
                    singleLine = true,
                    colors = foodTextFieldColors()
                )

                OutlinedTextField(
                    value = manualFat,
                    onValueChange = { manualFat = it },
                    label = { Text("Fat (g)") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    modifier = Modifier.weight(1f),
                    singleLine = true,
                    colors = foodTextFieldColors()
                )
            }

            Button(
                onClick = {
                    if (isSaving) return@Button
                    if (manualName.isNotBlank()) {
                        isSaving = true
                        val entry = FoodLogEntry(
                            itemName = manualName,
                            quantity = "1 serving",
                            calories = manualCalories.toIntOrNull() ?: 0,
                            protein = manualProtein.toDoubleOrNull() ?: 0.0,
                            carbs = manualCarbs.toDoubleOrNull() ?: 0.0,
                            fat = manualFat.toDoubleOrNull() ?: 0.0,
                            healthScore = 0,
                            source = "manual",
                            mealType = mealType,
                            date = selectedDate
                        )
                        onDone()
                        viewModel.saveFoodLog(entry)
                    }
                },
                enabled = !isSaving && manualName.isNotBlank(),
                modifier = Modifier.fillMaxWidth(),
                colors = ButtonDefaults.buttonColors(containerColor = ColorBrandEmerald)
            ) {
                Text("Save Meal", fontWeight = FontWeight.Bold)
            }
        }

        Spacer(modifier = Modifier.height(24.dp))
    }
}

@Composable
private fun EditMealDialog(
    entry: FoodLogEntry,
    onSave: (id: String, name: String, cal: Int, pro: Double, carbs: Double, fat: Double) -> Unit,
    onDismiss: () -> Unit
) {
    var name by remember { mutableStateOf(entry.itemName) }
    var calText by remember { mutableStateOf(entry.calories.toString()) }
    var proText by remember { mutableStateOf(entry.protein.toString()) }
    var carbsText by remember { mutableStateOf(entry.carbs.toString()) }
    var fatText by remember { mutableStateOf(entry.fat.toString()) }
    var isSavingEdit by remember { mutableStateOf(false) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Edit Meal", fontWeight = FontWeight.Bold) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Name") },
                    singleLine = true,
                    colors = foodTextFieldColors()
                )
                OutlinedTextField(
                    value = calText,
                    onValueChange = { calText = it },
                    label = { Text("Calories") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    singleLine = true,
                    colors = foodTextFieldColors()
                )
                OutlinedTextField(
                    value = proText,
                    onValueChange = { proText = it },
                    label = { Text("Protein (g)") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    singleLine = true,
                    colors = foodTextFieldColors()
                )
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        value = carbsText,
                        onValueChange = { carbsText = it },
                        label = { Text("Carbs (g)") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                        modifier = Modifier.weight(1f),
                        singleLine = true,
                        colors = foodTextFieldColors()
                    )
                    OutlinedTextField(
                        value = fatText,
                        onValueChange = { fatText = it },
                        label = { Text("Fat (g)") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                        modifier = Modifier.weight(1f),
                        singleLine = true,
                        colors = foodTextFieldColors()
                    )
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    if (isSavingEdit) return@Button
                    isSavingEdit = true
                    onSave(
                        entry.id,
                        name,
                        calText.toIntOrNull() ?: entry.calories,
                        proText.toDoubleOrNull() ?: entry.protein,
                        carbsText.toDoubleOrNull() ?: entry.carbs,
                        fatText.toDoubleOrNull() ?: entry.fat
                    )
                },
                enabled = !isSavingEdit,
                colors = ButtonDefaults.buttonColors(containerColor = ColorBrandEmerald)
            ) {
                Text("Save Changes")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel", color = ColorDarkMuted) }
        },
        containerColor = ColorDarkSurface,
        titleContentColor = Color.White,
        textContentColor = ColorDarkMuted
    )
}

@Composable
private fun foodTextFieldColors() = OutlinedTextFieldDefaults.colors(
    focusedBorderColor = ColorBrandEmerald,
    unfocusedBorderColor = ColorDarkBorder,
    focusedLabelColor = ColorBrandEmerald,
    unfocusedLabelColor = ColorDarkMuted,
    focusedTextColor = Color.White,
    unfocusedTextColor = Color.White,
    cursorColor = ColorBrandEmerald
)

