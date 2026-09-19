package com.foodcal.app.ui

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

val ColorBrandEmerald = Color(0xFF10B981)
val ColorBrandLime = Color(0xFFA3E635)
val ColorDarkBg = Color(0xFF07090F)
val ColorDarkSurface = Color(0xFF0F141C)
val ColorDarkSurface2 = Color(0xFF161D27)
val ColorDarkBorder = Color(0xFF1F2937)
val ColorDarkText = Color(0xFFF5F7FA)
val ColorDarkMuted = Color(0xFF94A3B8)

// Macro Colors
val ColorMacroCal = Color(0xFFF97316)
val ColorMacroProtein = Color(0xFFF43F5E)
val ColorMacroCarbs = Color(0xFFF59E0B)
val ColorMacroFat = Color(0xFF38BDF8)

private val dark = darkColorScheme(
    primary = ColorBrandEmerald,
    onPrimary = Color(0xFF042F1A),
    secondary = ColorBrandLime,
    onSecondary = Color(0xFF1A3800),
    tertiary = ColorMacroCal,
    background = ColorDarkBg,
    onBackground = ColorDarkText,
    surface = ColorDarkSurface,
    onSurface = ColorDarkText,
    surfaceVariant = ColorDarkSurface2,
    onSurfaceVariant = ColorDarkMuted,
    outline = ColorDarkBorder,
    error = Color(0xFFEF4444)
)

private val light = lightColorScheme(
    primary = Color(0xFF059669),
    onPrimary = Color.White,
    secondary = Color(0xFF65A30D),
    onSecondary = Color.White,
    tertiary = Color(0xFFEA580C),
    background = Color(0xFFF7F8FA),
    onBackground = Color(0xFF0B1220),
    surface = Color.White,
    onSurface = Color(0xFF0B1220),
    surfaceVariant = Color(0xFFF1F5F9),
    onSurfaceVariant = Color(0xFF64748B),
    outline = Color(0xFFE2E8F0),
    error = Color(0xFFDC2626)
)

@Composable
fun FoodCalTheme(
    darkTheme: Boolean = true, // default to modern dark theme
    content: @Composable () -> Unit
) {
    MaterialTheme(
        colorScheme = if (darkTheme) dark else light,
        content = content
    )
}
