package com.foodcal.app.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
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
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.MonitorWeight
import androidx.compose.material.icons.filled.TrendingDown
import androidx.compose.material.icons.filled.TrendingUp
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.foodcal.app.data.model.WeightLogEntry
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import kotlin.math.roundToInt

@Composable
fun ProgressScreen(
    viewModel: MainViewModel
) {
    val profile by viewModel.profile.collectAsStateWithLifecycle()
    val foodLogs by viewModel.allFoodLogs.collectAsStateWithLifecycle()
    val weightLogs by viewModel.allWeightLogs.collectAsStateWithLifecycle()

    var showWeightDialog by remember { mutableStateOf(false) }
    var weightToDelete by remember { mutableStateOf<WeightLogEntry?>(null) }

    val calorieTarget = profile?.dailyCalorieTarget ?: 2000
    val proteinTarget = (profile?.weight?.times(2.0) ?: 130.0).toInt().coerceAtLeast(80)

    // Last 7 days data for charts
    val last7Days = remember {
        (6 downTo 0).map { LocalDate.now().minusDays(it.toLong()) }
    }

    val dailyCalories = last7Days.map { date ->
        val dateStr = date.toString()
        val cals = foodLogs.filter { it.date == dateStr }.sumOf { it.calories }
        date to cals
    }

    val dailyProtein = last7Days.map { date ->
        val dateStr = date.toString()
        val pro = foodLogs.filter { it.date == dateStr }.sumOf { it.protein }
        date to pro
    }

    val sortedWeights = weightLogs.sortedBy { it.date }

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
                            "Progress & Trends",
                            style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold),
                            color = Color.White,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                        Text(
                            "Last 7-day intake and body metrics",
                            style = MaterialTheme.typography.bodySmall,
                            color = ColorDarkMuted,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                    }

                    Button(
                        onClick = { showWeightDialog = true },
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = ColorBrandEmerald),
                        contentPadding = PaddingValues(horizontal = 14.dp, vertical = 8.dp)
                    ) {
                        Icon(Icons.Default.Add, contentDescription = null, tint = Color(0xFF042F1A), modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            "Log Weight",
                            color = Color(0xFF042F1A),
                            fontWeight = FontWeight.Bold,
                            style = MaterialTheme.typography.labelMedium,
                            maxLines = 1,
                            softWrap = false
                        )
                    }
                }
            }

            // 7-Day Calorie Bar Chart Card
            item {
                GlassCard(modifier = Modifier.fillMaxWidth()) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("Calorie Intake (7 Days)", fontWeight = FontWeight.Bold, color = Color.White)
                        Text("Target: $calorieTarget kcal", style = MaterialTheme.typography.labelSmall, color = ColorBrandLime)
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    BarChart7Days(
                        data = dailyCalories.map { it.first.format(DateTimeFormatter.ofPattern("EEE")) to it.second.toFloat() },
                        target = calorieTarget.toFloat(),
                        barColor = ColorBrandEmerald,
                        overColor = Color(0xFFF97316)
                    )
                }
            }

            // 7-Day Protein Bar Chart Card
            item {
                GlassCard(modifier = Modifier.fillMaxWidth()) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("Protein Intake (7 Days)", fontWeight = FontWeight.Bold, color = Color.White)
                        Text("Target: ${proteinTarget}g", style = MaterialTheme.typography.labelSmall, color = ColorMacroProtein)
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    BarChart7Days(
                        data = dailyProtein.map { it.first.format(DateTimeFormatter.ofPattern("EEE")) to it.second.toFloat() },
                        target = proteinTarget.toFloat(),
                        barColor = ColorMacroProtein,
                        overColor = ColorBrandLime
                    )
                }
            }

            // Weight Trajectory Card
            item {
                GlassCard(modifier = Modifier.fillMaxWidth()) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text("Weight History", fontWeight = FontWeight.Bold, color = Color.White)
                            val latestWeight = sortedWeights.lastOrNull()?.weight ?: profile?.weight ?: 0.0
                            Text(
                                "Current: $latestWeight kg",
                                style = MaterialTheme.typography.bodySmall,
                                color = ColorDarkMuted
                            )
                        }

                        if (sortedWeights.size >= 2) {
                            val first = sortedWeights.first().weight
                            val last = sortedWeights.last().weight
                            val diff = last - first
                            val isLoss = diff < 0
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                Icon(
                                    if (isLoss) Icons.Default.TrendingDown else Icons.Default.TrendingUp,
                                    contentDescription = null,
                                    tint = if (isLoss) ColorBrandEmerald else Color(0xFFF97316),
                                    modifier = Modifier.size(18.dp)
                                )
                                Text(
                                    String.format("%.1f kg", kotlin.math.abs(diff)),
                                    fontWeight = FontWeight.Bold,
                                    color = if (isLoss) ColorBrandEmerald else Color(0xFFF97316)
                                )
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    if (sortedWeights.size >= 2) {
                        WeightLineChart(entries = sortedWeights)
                    } else {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(120.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text("Log at least 2 weight entries to see trend chart", color = ColorDarkMuted, style = MaterialTheme.typography.bodySmall)
                        }
                    }
                }
            }

            // Recent Weight Logs List
            item {
                Text("Weight Check-in History", fontWeight = FontWeight.Bold, color = Color.White)
            }

            if (weightLogs.isEmpty()) {
                item {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(16.dp))
                            .background(ColorDarkSurface)
                            .padding(20.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text("No weight check-ins recorded yet.", color = ColorDarkMuted)
                    }
                }
            } else {
                items(weightLogs, key = { it.id }) { log ->
                    GlassCard(modifier = Modifier.fillMaxWidth()) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                Icon(Icons.Default.MonitorWeight, contentDescription = null, tint = ColorBrandLime)
                                Column {
                                    val displayWeight = if (log.unit == "lbs" && log.originalWeight > 0) {
                                        "${log.originalWeight} lbs (${log.weight} kg)"
                                    } else {
                                        "${log.weight} kg"
                                    }
                                    Text(displayWeight, fontWeight = FontWeight.Bold, color = Color.White)
                                    Text(log.date, style = MaterialTheme.typography.labelSmall, color = ColorDarkMuted)
                                }
                            }

                            IconButton(onClick = { weightToDelete = log }) {
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

    // Log Weight Dialog
    if (showWeightDialog) {
        var inputWeight by remember {
            val initial = if (profile?.weightUnit == "lbs" && (profile?.originalWeight ?: 0.0) > 0) {
                profile?.originalWeight.toString()
            } else {
                profile?.weight?.toString() ?: "70"
            }
            mutableStateOf(initial)
        }
        var selectedUnit by remember { mutableStateOf(profile?.weightUnit?.ifBlank { "kg" } ?: "kg") }
        val dialogScroll = rememberScrollState()

        AlertDialog(
            onDismissRequest = { showWeightDialog = false },
            title = { Text("Log Today's Weight", fontWeight = FontWeight.Bold) },
            text = {
                Column(
                    modifier = Modifier.verticalScroll(dialogScroll).imePadding(),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Text("Regular check-ins help track your true body trajectory.", color = ColorDarkMuted, style = MaterialTheme.typography.bodySmall)

                    OutlinedTextField(
                        value = inputWeight,
                        onValueChange = { inputWeight = it },
                        label = { Text("Weight ($selectedUnit)") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                        singleLine = true,
                        colors = progressTextFieldColors()
                    )

                    Row(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("Unit:", color = ColorDarkMuted, style = MaterialTheme.typography.labelSmall)
                        listOf("kg" to "kg", "lbs" to "lbs").forEach { (u, label) ->
                            FilterChip(
                                selected = selectedUnit == u,
                                onClick = {
                                    if (selectedUnit != u) {
                                        val cur = inputWeight.toDoubleOrNull()
                                        if (cur != null) {
                                            inputWeight = if (u == "lbs") {
                                                ((cur / 0.453592) * 10.0).roundToInt().div(10.0).toString()
                                            } else {
                                                ((cur * 0.453592) * 10.0).roundToInt().div(10.0).toString()
                                            }
                                        }
                                        selectedUnit = u
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
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        val w = inputWeight.toDoubleOrNull()
                        if (w != null && w > 0) {
                            showWeightDialog = false
                            val weightKg = if (selectedUnit == "lbs") {
                                ((w * 0.453592) * 10.0).roundToInt() / 10.0
                            } else {
                                w
                            }
                            viewModel.saveWeightLog(
                                weightKg = weightKg,
                                originalWeight = w,
                                unit = selectedUnit,
                                date = LocalDate.now().toString()
                            )
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = ColorBrandEmerald)
                ) {
                    Text("Save Weight", color = Color(0xFF042F1A), fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { showWeightDialog = false }) { Text("Cancel", color = ColorDarkMuted) }
            },
            containerColor = ColorDarkSurface,
            titleContentColor = Color.White,
            textContentColor = ColorDarkMuted
        )
    }

    // Delete Weight Confirmation
    if (weightToDelete != null) {
        AlertDialog(
            onDismissRequest = { weightToDelete = null },
            title = { Text("Delete Weight Entry?") },
            text = { Text("Are you sure you want to delete this weight log?") },
            confirmButton = {
                Button(
                    onClick = {
                        weightToDelete?.let { viewModel.deleteWeightLog(it.id) }
                        weightToDelete = null
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFEF4444))
                ) {
                    Text("Delete")
                }
            },
            dismissButton = {
                TextButton(onClick = { weightToDelete = null }) { Text("Cancel", color = ColorDarkMuted) }
            },
            containerColor = ColorDarkSurface,
            titleContentColor = Color.White,
            textContentColor = ColorDarkMuted
        )
    }
}

/**
 * 7-Day Bar Chart drawn cleanly via Compose Canvas
 */
@Composable
private fun BarChart7Days(
    data: List<Pair<String, Float>>,
    target: Float,
    barColor: Color,
    overColor: Color
) {
    val maxVal = (data.maxOfOrNull { it.second } ?: target).coerceAtLeast(target * 1.15f).coerceAtLeast(10f)

    Column(modifier = Modifier.fillMaxWidth()) {
        Canvas(
            modifier = Modifier
                .fillMaxWidth()
                .height(150.dp)
        ) {
            val canvasW = size.width
            val canvasH = size.height - 24.dp.toPx()
            val barCount = data.size
            val barW = (canvasW / barCount) * 0.45f
            val spacing = canvasW / barCount

            // Dotted / subtle line for target
            val targetY = canvasH - (target / maxVal) * canvasH
            drawLine(
                color = ColorDarkMuted.copy(alpha = 0.5f),
                start = Offset(0f, targetY),
                end = Offset(canvasW, targetY),
                strokeWidth = 2.dp.toPx()
            )

            // Draw bars
            data.forEachIndexed { index, pair ->
                val x = index * spacing + (spacing - barW) / 2f
                val barH = ((pair.second / maxVal) * canvasH).coerceAtLeast(4f)
                val y = canvasH - barH

                val color = if (pair.second > target && target > 0) overColor else barColor

                drawRoundRect(
                    color = color,
                    topLeft = Offset(x, y),
                    size = Size(barW, barH),
                    cornerRadius = androidx.compose.ui.geometry.CornerRadius(6.dp.toPx())
                )
            }
        }

        // Day Labels
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceAround
        ) {
            data.forEach { (day, _) ->
                Text(
                    text = day,
                    style = MaterialTheme.typography.labelSmall,
                    color = ColorDarkMuted
                )
            }
        }
    }
}

/**
 * Weight Line Chart with smooth path and gradient fill
 */
@Composable
private fun WeightLineChart(entries: List<WeightLogEntry>) {
    val weights = entries.map { it.weight.toFloat() }
    val minW = (weights.minOrNull() ?: 60f) - 1f
    val maxW = (weights.maxOrNull() ?: 80f) + 1f
    val range = (maxW - minW).coerceAtLeast(1f)

    Canvas(
        modifier = Modifier
            .fillMaxWidth()
            .height(140.dp)
    ) {
        val w = size.width
        val h = size.height
        val stepX = w / (weights.size - 1).coerceAtLeast(1)

        val points = weights.mapIndexed { idx, wt ->
            val x = idx * stepX
            val y = h - ((wt - minW) / range) * h
            Offset(x, y)
        }

        // Path for line
        val linePath = Path()
        val fillPath = Path()

        points.forEachIndexed { i, pt ->
            if (i == 0) {
                linePath.moveTo(pt.x, pt.y)
                fillPath.moveTo(pt.x, h)
                fillPath.lineTo(pt.x, pt.y)
            } else {
                linePath.lineTo(pt.x, pt.y)
                fillPath.lineTo(pt.x, pt.y)
            }
        }
        fillPath.lineTo(points.last().x, h)
        fillPath.close()

        // Gradient under line
        drawPath(
            path = fillPath,
            brush = Brush.verticalGradient(
                colors = listOf(ColorBrandEmerald.copy(alpha = 0.3f), Color.Transparent),
                startY = 0f,
                endY = h
            )
        )

        // Line
        drawPath(
            path = linePath,
            color = ColorBrandEmerald,
            style = Stroke(width = 3.dp.toPx(), cap = StrokeCap.Round)
        )

        // Points
        points.forEach { pt ->
            drawCircle(color = ColorBrandLime, radius = 4.dp.toPx(), center = pt)
            drawCircle(color = Color(0xFF042F1A), radius = 2.dp.toPx(), center = pt)
        }
    }
}

@Composable
private fun progressTextFieldColors() = OutlinedTextFieldDefaults.colors(
    focusedBorderColor = ColorBrandEmerald,
    unfocusedBorderColor = ColorDarkBorder,
    focusedLabelColor = ColorBrandEmerald,
    unfocusedLabelColor = ColorDarkMuted,
    focusedTextColor = Color.White,
    unfocusedTextColor = Color.White,
    cursorColor = ColorBrandEmerald
)
