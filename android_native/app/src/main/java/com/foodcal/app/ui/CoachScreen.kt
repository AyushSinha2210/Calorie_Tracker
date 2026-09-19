package com.foodcal.app.ui

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.widget.Toast
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.Psychology
import androidx.compose.material.icons.outlined.AutoAwesome
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.TabRowDefaults
import androidx.compose.material3.TabRowDefaults.tabIndicatorOffset
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.foodcal.app.data.model.PromptTemplateDto

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun CoachScreen(
    viewModel: MainViewModel
) {
    val context = LocalContext.current
    val profile by viewModel.profile.collectAsStateWithLifecycle()
    val daySummary by viewModel.daySummary.collectAsStateWithLifecycle()

    var activeTab by remember { mutableIntStateOf(0) } // 0: Daily Coach, 1: Prompt Library

    val currentTone = profile?.coachTone ?: "friendly"
    val tones = listOf(
        "friendly" to "Friendly",
        "tough_love" to "Tough Love",
        "direct" to "Direct",
        "enthusiastic" to "Enthusiastic",
        "scientific" to "Scientific"
    )

    var coachComment by remember { mutableStateOf<String?>(null) }
    var isCommentLoading by remember { mutableStateOf(false) }

    var templates by remember { mutableStateOf<Map<String, PromptTemplateDto>>(emptyMap()) }
    var isTemplatesLoading by remember { mutableStateOf(false) }
    var selectedTemplateKey by remember { mutableStateOf<String?>(null) }
    var generatedPrompt by remember { mutableStateOf<String?>(null) }
    var isGeneratingPrompt by remember { mutableStateOf(false) }

    LaunchedEffect(activeTab) {
        if (activeTab == 1 && templates.isEmpty()) {
            isTemplatesLoading = true
            viewModel.getCoachTemplates { res ->
                isTemplatesLoading = false
                templates = res.getOrElse {
                    mapOf(
                        "macro_balance" to PromptTemplateDto("Macro Optimization", "Optimize daily protein and calorie distribution", "Nutrition", "Analyze my daily intake: {calories} kcal, {protein}g protein for my weight {weight}kg."),
                        "recovery_advice" to PromptTemplateDto("Post-Workout Recovery", "Tips on post-workout refuel", "Recovery", "I just completed {workout}. What are the best foods to eat for optimal muscle recovery?"),
                        "cutting_phase" to PromptTemplateDto("Fat Loss Guide", "Structured fat loss plan", "Fat Loss", "Help me cut body fat while maintaining muscle mass at {weight}kg with a target of {calories} kcal.")
                    )
                }
            }
        }
    }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(ColorDarkBg)
            .padding(horizontal = 18.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item {
            Spacer(modifier = Modifier.height(36.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Box(
                    modifier = Modifier
                        .size(44.dp)
                        .clip(CircleShape)
                        .background(ColorBrandLime.copy(alpha = 0.2f)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(Icons.Outlined.AutoAwesome, contentDescription = null, tint = ColorBrandLime, modifier = Modifier.size(24.dp))
                }
                Column {
                    Text(
                        "AI Health Coach",
                        style = MaterialTheme.typography.headlineSmall.copy(fontWeight = FontWeight.Bold),
                        color = Color.White
                    )
                    Text("Personalized feedback and prompt templates", style = MaterialTheme.typography.bodySmall, color = ColorDarkMuted)
                }
            }
        }

        // Tab Row
        item {
            TabRow(
                selectedTabIndex = activeTab,
                containerColor = Color.Transparent,
                contentColor = ColorBrandEmerald,
                indicator = { tabPositions ->
                    TabRowDefaults.SecondaryIndicator(
                        modifier = Modifier.tabIndicatorOffset(tabPositions[activeTab]),
                        color = ColorBrandEmerald
                    )
                },
                divider = {}
            ) {
                Tab(
                    selected = activeTab == 0,
                    onClick = { activeTab = 0 },
                    text = { Text("Daily Feedback", fontWeight = FontWeight.Bold) }
                )
                Tab(
                    selected = activeTab == 1,
                    onClick = { activeTab = 1 },
                    text = { Text("Prompt Library", fontWeight = FontWeight.Bold) }
                )
            }
        }

        if (activeTab == 0) {
            // Coach Tone Selector
            item {
                GlassCard(modifier = Modifier.fillMaxWidth()) {
                    Text("Coach Persona / Tone", fontWeight = FontWeight.Bold, color = Color.White)
                    Spacer(modifier = Modifier.height(10.dp))
                    FlowRow(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        tones.forEach { (key, label) ->
                            FilterChip(
                                selected = currentTone == key,
                                onClick = { viewModel.updateCoachTone(key) },
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
            }

            // Generate Day Feedback Action
            item {
                GlassCard(modifier = Modifier.fillMaxWidth()) {
                    Text("Today's Performance Analysis", fontWeight = FontWeight.Bold, color = Color.White)
                    Spacer(modifier = Modifier.height(6.dp))
                    Text(
                        "${daySummary.totalCalories} kcal consumed • ${daySummary.totalProtein.toInt()}g protein • ${daySummary.totalCaloriesBurned} kcal burned",
                        style = MaterialTheme.typography.bodySmall,
                        color = ColorDarkMuted
                    )

                    Spacer(modifier = Modifier.height(16.dp))

                    if (coachComment != null) {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(14.dp))
                                .background(ColorDarkSurface2)
                                .border(1.dp, ColorBrandEmerald.copy(alpha = 0.4f), RoundedCornerShape(14.dp))
                                .padding(16.dp)
                        ) {
                            Text(coachComment!!, color = Color.White, style = MaterialTheme.typography.bodyMedium)
                        }
                        Spacer(modifier = Modifier.height(12.dp))
                    }

                    Button(
                        onClick = {
                            isCommentLoading = true
                            viewModel.getCoachComment(
                                tone = currentTone,
                                activityType = "daily",
                                entryName = "Today Summary",
                                calories = daySummary.totalCalories,
                                protein = daySummary.totalProtein
                            ) { res ->
                                isCommentLoading = false
                                coachComment = res.getOrElse { "Keep tracking consistently to build lifelong momentum!" }
                            }
                        },
                        modifier = Modifier.fillMaxWidth(),
                        enabled = !isCommentLoading,
                        colors = ButtonDefaults.buttonColors(containerColor = ColorBrandEmerald, contentColor = Color(0xFF042F1A))
                    ) {
                        if (isCommentLoading) {
                            CircularProgressIndicator(modifier = Modifier.size(20.dp), color = Color(0xFF042F1A), strokeWidth = 2.dp)
                        } else {
                            Icon(Icons.Outlined.AutoAwesome, contentDescription = null)
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(if (coachComment == null) "Ask AI Coach for Feedback" else "Refresh Coach Advice", fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        } else {
            // Prompt Library Tab
            if (isTemplatesLoading) {
                item {
                    Box(modifier = Modifier.fillMaxWidth().height(140.dp), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator(color = ColorBrandEmerald)
                    }
                }
            } else {
                item {
                    Text("Expert Prompts for Gemini & ChatGPT", fontWeight = FontWeight.Bold, color = Color.White)
                }

                templates.forEach { (key, template) ->
                    item {
                        GlassCard(
                            modifier = Modifier.fillMaxWidth(),
                            onClick = {
                                selectedTemplateKey = key
                                isGeneratingPrompt = true
                                val profileMap = mapOf(
                                    "calories" to (profile?.dailyCalorieTarget ?: 2000).toString(),
                                    "weight" to (profile?.weight ?: 70.0).toString(),
                                    "gender" to (profile?.gender ?: "male"),
                                    "workout" to (daySummary.workoutLogs.firstOrNull()?.exerciseName ?: "strength training")
                                )
                                viewModel.buildCoachPrompt(key, profileMap) { res ->
                                    isGeneratingPrompt = false
                                    generatedPrompt = res.getOrNull()?.prompt ?: template.template
                                        .replace("{calories}", profileMap["calories"]!!)
                                        .replace("{weight}", profileMap["weight"]!!)
                                        .replace("{workout}", profileMap["workout"]!!)
                                }
                            }
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(template.name, fontWeight = FontWeight.Bold, color = Color.White)
                                    Spacer(modifier = Modifier.height(2.dp))
                                    Text(template.description, style = MaterialTheme.typography.bodySmall, color = ColorDarkMuted)
                                }
                                Box(
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(8.dp))
                                        .background(ColorBrandEmerald.copy(alpha = 0.15f))
                                        .padding(horizontal = 8.dp, vertical = 4.dp)
                                ) {
                                    Text(template.category, style = MaterialTheme.typography.labelSmall, color = ColorBrandEmerald)
                                }
                            }

                            if (selectedTemplateKey == key && generatedPrompt != null) {
                                Spacer(modifier = Modifier.height(14.dp))
                                Box(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .clip(RoundedCornerShape(12.dp))
                                        .background(ColorDarkSurface2)
                                        .padding(12.dp)
                                ) {
                                    Text(generatedPrompt!!, style = MaterialTheme.typography.bodySmall, color = ColorDarkText)
                                }
                                Spacer(modifier = Modifier.height(10.dp))
                                Button(
                                    onClick = {
                                        val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                                        val clip = ClipData.newPlainText("FoodCal AI Prompt", generatedPrompt)
                                        clipboard.setPrimaryClip(clip)
                                        Toast.makeText(context, "Copied prompt to clipboard!", Toast.LENGTH_SHORT).show()
                                    },
                                    colors = ButtonDefaults.buttonColors(containerColor = ColorBrandLime, contentColor = Color(0xFF1A3800))
                                ) {
                                    Icon(Icons.Default.ContentCopy, contentDescription = null, modifier = Modifier.size(16.dp))
                                    Spacer(modifier = Modifier.width(6.dp))
                                    Text("Copy Prompt", fontWeight = FontWeight.Bold)
                                }
                            }
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

