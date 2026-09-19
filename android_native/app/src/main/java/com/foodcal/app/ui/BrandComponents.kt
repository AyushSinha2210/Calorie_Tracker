package com.foodcal.app.ui

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.animateIntAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.ui.graphics.graphicsLayer
import kotlinx.coroutines.launch
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.withTransform
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlin.math.cos
import kotlin.math.sin

/**
 * Core vector drawing logic for the official FoodCal brand mark.
 * Identical across app icon, splash screen, and in-app navigation:
 * 1. Progress ring shaped as a letter "C" (starts at +45° bottom-right, sweeps 270° clockwise to 315° / -45°,
 *    leaving a 90° opening facing directly to the right).
 * 2. Centered tilted leaf symbol (rotated 28° clockwise around center, matching SVG / launcher icon).
 * 3. Accent Lime energy dot positioned directly in between the two arms of the "C" at angle 0°
 *    (center.x + radius, center.y), perfectly equidistant from the top-right and bottom-right tips.
 */
private fun DrawScope.drawFoodCalMark(
    sizePx: Float,
    sweepAngle: Float = 270f,
    alpha: Float = 1f,
    dotAlpha: Float = 1f,
    pulseGlow: Float = 0.85f
) {
    val strokeW = sizePx * 0.11f
    val radius = (sizePx - strokeW * 2.2f) / 2f
    val center = Offset(sizePx / 2f, sizePx / 2f)

    // 1. Ambient pulsing radial aura
    drawCircle(
        brush = Brush.radialGradient(
            colors = listOf(
                ColorBrandEmerald.copy(alpha = 0.30f * pulseGlow * alpha),
                ColorBrandLime.copy(alpha = 0.10f * pulseGlow * alpha),
                Color.Transparent
            ),
            center = center,
            radius = sizePx * 0.65f
        ),
        radius = sizePx * 0.65f,
        center = center
    )

    // 2. Background subtle circular track
    drawCircle(
        color = Color(0x1810B981).copy(alpha = 0.18f * alpha),
        radius = radius,
        style = Stroke(width = strokeW * 0.45f)
    )

    // 3. Progress Ring "C" (starts at +45° bottom-right, sweeps up to 270° clockwise to 315° top-right)
    if (sweepAngle > 0f) {
        drawArc(
            brush = Brush.linearGradient(
                colors = listOf(Color(0xFF34D399), ColorBrandEmerald, ColorBrandLime),
                start = Offset(center.x - radius, center.y - radius),
                end = Offset(center.x + radius, center.y + radius)
            ),
            startAngle = 45f,
            sweepAngle = sweepAngle.coerceIn(0f, 270f),
            useCenter = false,
            style = Stroke(width = strokeW, cap = StrokeCap.Round)
        )
    }

    // 4. Centered leaf rotated 28 degrees around center
    withTransform({
        rotate(degrees = 28f, pivot = center)
    }) {
        val leafHeight = radius * 1.15f
        val leafWidth = radius * 0.56f
        val cx = center.x
        val cy = center.y

        val leafPath = Path().apply {
            moveTo(cx, cy + leafHeight * 0.5f)
            cubicTo(
                cx - leafWidth * 0.95f, cy + leafHeight * 0.22f,
                cx - leafWidth * 0.95f, cy - leafHeight * 0.28f,
                cx, cy - leafHeight * 0.5f
            )
            cubicTo(
                cx + leafWidth * 0.95f, cy - leafHeight * 0.28f,
                cx + leafWidth * 0.95f, cy + leafHeight * 0.22f,
                cx, cy + leafHeight * 0.5f
            )
            close()
        }

        drawPath(
            path = leafPath,
            brush = Brush.linearGradient(
                colors = listOf(ColorBrandEmerald.copy(alpha = alpha), ColorBrandLime.copy(alpha = alpha)),
                start = Offset(cx - leafWidth, cy - leafHeight * 0.5f),
                end = Offset(cx + leafWidth, cy + leafHeight * 0.5f)
            )
        )

        // Central leaf vein
        drawLine(
            color = Color(0xFF052E1F).copy(alpha = 0.65f * alpha),
            start = Offset(cx, cy + leafHeight * 0.38f),
            end = Offset(cx, cy - leafHeight * 0.35f),
            strokeWidth = (strokeW * 0.25f).coerceAtLeast(1.5f),
            cap = StrokeCap.Round
        )
    }

    // 5. Accent lime dot positioned in the C opening at angle 0° (Offset(center.x + radius, center.y))
    // Exactly in between upper tip (+315° / -45°) and lower tip (+45°)
    if (dotAlpha > 0f) {
        val dotCenter = Offset(center.x + radius, center.y)

        // Outer glow
        drawCircle(
            color = ColorBrandLime.copy(alpha = 0.35f * pulseGlow * dotAlpha),
            radius = strokeW * 0.95f,
            center = dotCenter
        )
        // Dot body
        drawCircle(
            color = ColorBrandLime.copy(alpha = dotAlpha),
            radius = strokeW * 0.60f,
            center = dotCenter
        )
        // Crisp white inner core
        drawCircle(
            color = Color.White.copy(alpha = 0.92f * dotAlpha),
            radius = strokeW * 0.28f,
            center = dotCenter
        )
    }
}

/**
 * Modern FoodCal Brand Logo: precision-aligned "C" progress ring with tilted center leaf
 * and accent dot in between. Zero CPU usage when static.
 */
@Composable
fun FoodCalLogo(
    modifier: Modifier = Modifier,
    size: Dp = 40.dp,
    showWordmark: Boolean = true,
    animated: Boolean = false
) {
    Row(
        modifier = modifier,
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        Canvas(modifier = Modifier.size(size)) {
            drawFoodCalMark(
                sizePx = this.size.width,
                sweepAngle = 270f,
                alpha = 1f,
                dotAlpha = 1f,
                pulseGlow = 0.85f
            )
        }

        if (showWordmark) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = "Food",
                    style = MaterialTheme.typography.titleLarge.copy(
                        fontWeight = FontWeight.ExtraBold,
                        letterSpacing = (-0.5).sp
                    ),
                    color = Color.White
                )
                Text(
                    text = "Cal",
                    style = MaterialTheme.typography.titleLarge.copy(
                        fontWeight = FontWeight.ExtraBold,
                        letterSpacing = (-0.5).sp
                    ),
                    color = ColorBrandLime
                )
            }
        }
    }
}

/**
 * Fast Animated Logo shown ONLY while opening the app.
 * Snappy, fast 360ms entrance with scale spring and dynamic sweep arc revealing the "C",
 * settling cleanly to match FoodCalLogo identically.
 */
@Composable
fun FoodCalOpeningAnimatedLogo(
    modifier: Modifier = Modifier,
    size: Dp = 80.dp,
    showWordmark: Boolean = true
) {
    val scale = remember { Animatable(0.65f) }
    val sweepProgress = remember { Animatable(0f) }
    val alpha = remember { Animatable(0f) }

    LaunchedEffect(Unit) {
        launch {
            alpha.animateTo(1f, animationSpec = tween(durationMillis = 260, easing = FastOutSlowInEasing))
        }
        launch {
            scale.animateTo(
                targetValue = 1f,
                animationSpec = spring(
                    dampingRatio = Spring.DampingRatioMediumBouncy,
                    stiffness = Spring.StiffnessMedium
                )
            )
        }
        launch {
            sweepProgress.animateTo(
                targetValue = 1f,
                animationSpec = tween(durationMillis = 360, easing = FastOutSlowInEasing)
            )
        }
    }

    Row(
        modifier = modifier.graphicsLayer {
            scaleX = scale.value
            scaleY = scale.value
            this.alpha = alpha.value
        },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Canvas(modifier = Modifier.size(size)) {
            val dotAlpha = if (sweepProgress.value > 0.35f) {
                ((sweepProgress.value - 0.35f) / 0.65f).coerceIn(0f, 1f)
            } else 0f

            drawFoodCalMark(
                sizePx = this.size.width,
                sweepAngle = 270f * sweepProgress.value,
                alpha = alpha.value,
                dotAlpha = dotAlpha,
                pulseGlow = 0.95f
            )
        }

        if (showWordmark) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = "Food",
                    style = MaterialTheme.typography.headlineMedium.copy(
                        fontWeight = FontWeight.ExtraBold,
                        letterSpacing = (-0.5).sp
                    ),
                    color = Color.White
                )
                Text(
                    text = "Cal",
                    style = MaterialTheme.typography.headlineMedium.copy(
                        fontWeight = FontWeight.ExtraBold,
                        letterSpacing = (-0.5).sp
                    ),
                    color = ColorBrandLime
                )
            }
        }
    }
}


/**
 * Cal AI-style Animated Calorie Ring with eaten, target, and burned calories.
 */
@Composable
fun CalorieRing(
    eaten: Int,
    target: Int,
    burned: Int,
    modifier: Modifier = Modifier,
    customSize: Dp? = null
) {
    val remaining = (target - eaten + burned).coerceAtLeast(0)
    val safeTarget = if (target > 0) target else 2000
    val progressFraction = (eaten.toFloat() / safeTarget.toFloat()).coerceIn(0f, 1.5f)

    val animatedProgress by animateFloatAsState(
        targetValue = progressFraction,
        animationSpec = tween(durationMillis = 1000, easing = FastOutSlowInEasing),
        label = "calorie_ring_progress"
    )

    val animatedRemaining by animateIntAsState(
        targetValue = remaining,
        animationSpec = tween(durationMillis = 800, easing = FastOutSlowInEasing),
        label = "calorie_ring_remaining"
    )

    val isOverBudget = eaten > safeTarget

    BoxWithConstraints(
        modifier = modifier,
        contentAlignment = Alignment.Center
    ) {
        val ringSize = customSize ?: minOf(maxWidth * 0.55f, 240.dp).coerceAtLeast(140.dp)
        val strokeWidth = (ringSize * 0.085f).coerceIn(10.dp, 18.dp)

        Box(
            modifier = Modifier.size(ringSize),
            contentAlignment = Alignment.Center
        ) {
            Canvas(modifier = Modifier.size(ringSize)) {
                val strokePx = strokeWidth.toPx()
                val arcSize = Size(size.width - strokePx, size.height - strokePx)
                val topLeft = Offset(strokePx / 2f, strokePx / 2f)

                // Background circular track
                drawArc(
                    color = Color(0xFF161E2E),
                    startAngle = -90f,
                    sweepAngle = 360f,
                    useCenter = false,
                    topLeft = topLeft,
                    size = arcSize,
                    style = Stroke(width = strokePx, cap = StrokeCap.Round)
                )

                // Active progress gradient
                val gradientColors = if (isOverBudget) {
                    listOf(Color(0xFFF97316), Color(0xFFEF4444))
                } else {
                    listOf(ColorBrandEmerald, ColorBrandLime)
                }

                val sweepAngle = (animatedProgress * 360f).coerceAtMost(360f)
                if (sweepAngle > 0f) {
                    drawArc(
                        brush = Brush.sweepGradient(
                            colors = gradientColors,
                            center = center
                        ),
                        startAngle = -90f,
                        sweepAngle = sweepAngle,
                        useCenter = false,
                        topLeft = topLeft,
                        size = arcSize,
                        style = Stroke(width = strokePx, cap = StrokeCap.Round)
                    )
                }
            }

            // Center readout
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center
            ) {
                Text(
                    text = "$animatedRemaining",
                    style = MaterialTheme.typography.headlineLarge.copy(
                        fontWeight = FontWeight.Black,
                        fontSize = (ringSize.value * 0.20f).sp
                    ),
                    color = Color.White
                )
                Text(
                    text = if (isOverBudget) "kcal over" else "kcal remaining",
                    style = MaterialTheme.typography.labelMedium.copy(
                        fontWeight = FontWeight.Medium,
                        fontSize = (ringSize.value * 0.065f).sp
                    ),
                    color = if (isOverBudget) Color(0xFFF97316) else ColorDarkMuted
                )
            }
        }
    }
}

/**
 * Macro progress bar with colored accent and pill background.
 */
@Composable
fun MacroProgressBar(
    label: String,
    current: Double,
    target: Double,
    color: Color,
    modifier: Modifier = Modifier
) {
    val currentInt = current.toInt()
    val targetInt = if (target > 0) target.toInt() else 100
    val progress = (current / targetInt.toDouble()).toFloat().coerceIn(0f, 1f)

    val animatedProgress by animateFloatAsState(
        targetValue = progress,
        animationSpec = tween(durationMillis = 800, easing = FastOutSlowInEasing),
        label = "macro_progress"
    )

    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = label,
                style = MaterialTheme.typography.bodySmall.copy(fontWeight = FontWeight.SemiBold),
                color = Color.White
            )
            Text(
                text = "${currentInt}g / ${targetInt}g",
                style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Medium),
                color = ColorDarkMuted
            )
        }

        // Custom rounded progress bar
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(8.dp)
                .clip(CircleShape)
                .background(Color(0xFF1E293B))
        ) {
            Box(
                modifier = Modifier
                    .fillMaxWidth(animatedProgress)
                    .height(8.dp)
                    .clip(CircleShape)
                    .background(color)
            )
        }
    }
}

/**
 * Health Score Chip (Cal AI style: 1-10 rating with score gauge).
 */
@Composable
fun HealthScoreBadge(
    score: Int,
    modifier: Modifier = Modifier
) {
    val safeScore = score.coerceIn(1, 10)
    val (color, label) = when {
        safeScore >= 8 -> Pair(ColorBrandEmerald, "Optimal")
        safeScore >= 6 -> Pair(ColorBrandLime, "Good")
        safeScore >= 4 -> Pair(Color(0xFFF59E0B), "Moderate")
        else -> Pair(Color(0xFFEF4444), "Low")
    }

    Row(
        modifier = modifier
            .clip(RoundedCornerShape(12.dp))
            .background(color.copy(alpha = 0.15f))
            .border(1.dp, color.copy(alpha = 0.4f), RoundedCornerShape(12.dp))
            .padding(horizontal = 10.dp, vertical = 5.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        Box(
            modifier = Modifier
                .size(8.dp)
                .clip(CircleShape)
                .background(color)
        )
        Text(
            text = "$safeScore/10 $label",
            style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold),
            color = color
        )
    }
}

/**
 * Modern Dark Glass Card container with rounded corners and border.
 */
@Composable
fun GlassCard(
    modifier: Modifier = Modifier,
    backgroundColor: Color = ColorDarkSurface,
    borderColor: Color = ColorDarkBorder,
    onClick: (() -> Unit)? = null,
    content: @Composable ColumnScope.() -> Unit
) {
    val baseModifier = modifier
        .clip(RoundedCornerShape(22.dp))
        .background(backgroundColor)
        .border(1.dp, borderColor, RoundedCornerShape(22.dp))
        .then(if (onClick != null) Modifier.clickable { onClick() } else Modifier)
        .padding(18.dp)

    Column(
        modifier = baseModifier,
        content = content
    )
}

/**
 * Animated Scanning Laser overlay for the camera viewfinder / meal photo.
 */
@Composable
fun ScanLaserOverlay(
    modifier: Modifier = Modifier
) {
    val transition = rememberInfiniteTransition(label = "laser_transition")
    val laserPosition by transition.animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 1800, easing = LinearEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "laser_position"
    )

    Canvas(modifier = modifier) {
        val y = size.height * laserPosition
        val laserHeight = 40.dp.toPx()

        // Gradient laser beam
        drawRect(
            brush = Brush.verticalGradient(
                colors = listOf(
                    Color.Transparent,
                    ColorBrandEmerald.copy(alpha = 0.4f),
                    ColorBrandLime.copy(alpha = 0.8f),
                    Color.Transparent
                ),
                startY = (y - laserHeight).coerceAtLeast(0f),
                endY = (y + laserHeight).coerceAtMost(size.height)
            ),
            topLeft = Offset(0f, (y - laserHeight).coerceAtLeast(0f)),
            size = Size(size.width, laserHeight * 2)
        )

        // Center bright line
        drawLine(
            color = ColorBrandLime,
            start = Offset(0f, y),
            end = Offset(size.width, y),
            strokeWidth = 3.dp.toPx(),
            cap = StrokeCap.Round
        )
    }
}

