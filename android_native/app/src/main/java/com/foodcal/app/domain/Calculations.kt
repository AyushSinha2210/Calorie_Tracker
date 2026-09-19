package com.foodcal.app.domain

import kotlin.math.roundToInt

data class DailyTotals(val calories: Int, val protein: Int)

fun calculateTotals(calories: List<Int>, protein: List<Int>) = DailyTotals(calories.sum(), protein.sum())

fun maintenanceCalories(weightKg: Double, heightCm: Double, age: Int, gender: String): Int {
    if (weightKg <= 0 || heightCm <= 0 || age <= 0) return 0
    val offset = if (gender.equals("female", true)) -161 else 5
    return (10 * weightKg + 6.25 * heightCm - 5 * age + offset).roundToInt()
}

fun scaleMacroByGrams(baseValue: Double, baseGrams: Int, targetGrams: Int): Double {
    if (baseGrams <= 0 || targetGrams <= 0) return 0.0
    return (baseValue * (targetGrams.toDouble() / baseGrams.toDouble()))
}

fun calculateMetCalories(met: Double, weightKg: Double, durationMin: Int): Int {
    if (met <= 0 || weightKg <= 0 || durationMin <= 0) return 0
    return ((met * 3.5 * weightKg / 200.0) * durationMin).roundToInt()
}
