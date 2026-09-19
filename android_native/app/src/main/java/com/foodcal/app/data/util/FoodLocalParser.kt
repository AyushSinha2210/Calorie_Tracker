package com.foodcal.app.data.util

import com.foodcal.app.data.model.AnalyzeTextResponse
import com.foodcal.app.data.model.NutritionItem
import kotlin.math.roundToInt

object FoodLocalParser {

    private data class FoodBase(
        val name: String,
        val defaultServing: String,
        val grams: Int,
        val calories: Int,
        val protein: Double,
        val carbs: Double,
        val fat: Double,
        val aliases: List<String>
    )

    private val DATABASE = listOf(
        // ── Staples & Breads ──
        FoodBase("Poori / Puri", "1 piece", 35, 135, 2.5, 16.0, 7.0, listOf("poori", "pooris", "puri", "puris")),
        FoodBase("Bhatura", "1 piece", 90, 290, 6.0, 38.0, 13.0, listOf("bhatura", "bhature", "bhatoora")),
        FoodBase("Naan", "1 piece", 90, 260, 7.5, 45.0, 5.0, listOf("naan", "garlic naan", "butter naan", "kulcha")),
        FoodBase("Roti / Chapati", "1 piece", 40, 104, 3.1, 20.0, 1.5, listOf("roti", "rotis", "chapati", "chapatis", "phulka", "fulka")),
        FoodBase("Paratha", "1 piece", 65, 210, 4.5, 30.0, 8.0, listOf("paratha", "parantha", "plain paratha")),
        FoodBase("Aloo Paratha", "1 piece", 100, 285, 5.5, 44.0, 9.5, listOf("aloo paratha", "alu paratha")),
        FoodBase("Whole Wheat Toast", "1 slice", 40, 75, 2.5, 14.0, 1.0, listOf("toast", "bread", "whole wheat toast", "whole wheat bread", "slice of bread", "slices of bread", "brown bread", "white bread")),
        FoodBase("White Rice", "1 cup (150g)", 150, 195, 4.0, 42.0, 0.4, listOf("rice", "white rice", "steamed rice", "chawal")),
        FoodBase("Brown Rice", "1 cup (150g)", 150, 185, 4.0, 38.0, 1.5, listOf("brown rice")),
        FoodBase("Biryani", "1 plate", 250, 420, 18.0, 52.0, 15.0, listOf("biryani", "chicken biryani", "veg biryani", "pulao")),
        FoodBase("Khichdi", "1 bowl", 200, 220, 8.4, 38.0, 4.0, listOf("khichdi", "khichri")),

        // ── Legumes, Curries & Dal ──
        FoodBase("Chickpeas (Chole / Chana)", "100g", 100, 164, 8.9, 27.4, 2.6, listOf("chickpea", "chickpeas", "chana", "chole", "kabuli chana", "kala chana", "garbanzo")),
        FoodBase("Dal / Lentils", "1 bowl", 150, 140, 9.0, 20.0, 3.0, listOf("dal", "daal", "lentil", "lentils", "moong dal", "yellow dal", "toor dal", "dal tadka")),
        FoodBase("Rajma", "1 bowl", 150, 188, 10.8, 29.0, 3.3, listOf("rajma", "kidney beans")),
        FoodBase("Paneer Butter Masala", "1 bowl", 150, 320, 10.0, 12.0, 26.0, listOf("paneer curry", "paneer butter masala", "shahi paneer", "kadai paneer")),

        // ── Proteins & Dairy ──
        FoodBase("Egg", "1 egg", 50, 78, 6.3, 0.6, 5.3, listOf("egg", "eggs", "boiled egg", "boiled eggs", "fried egg", "anda")),
        FoodBase("Egg White", "1 white", 33, 17, 3.6, 0.2, 0.1, listOf("egg white", "egg whites")),
        FoodBase("Egg Omelette", "1 omelette", 60, 110, 6.5, 1.0, 9.0, listOf("omelette", "omelet", "egg bhurji")),
        FoodBase("Chicken Breast", "100g", 100, 165, 31.0, 0.0, 3.6, listOf("chicken", "chicken breast", "grilled chicken", "boiled chicken")),
        FoodBase("Chicken Curry", "1 bowl", 150, 240, 22.0, 6.0, 14.0, listOf("chicken curry", "chicken gravy")),
        FoodBase("Fish", "1 piece (100g)", 100, 140, 22.0, 0.0, 5.5, listOf("fish", "cooked fish", "fish curry", "machli")),
        FoodBase("Paneer", "100g", 100, 265, 18.0, 3.0, 20.0, listOf("paneer", "cottage cheese", "raw paneer")),
        FoodBase("Milk", "1 glass (200ml)", 200, 116, 6.4, 9.6, 6.0, listOf("milk", "cow milk", "doodh", "toned milk")),
        FoodBase("Curd / Dahi", "1 bowl (150g)", 150, 90, 5.2, 7.0, 4.8, listOf("curd", "dahi", "yogurt", "plain yogurt")),
        FoodBase("Greek Yogurt", "1 cup (150g)", 150, 130, 15.0, 6.0, 4.0, listOf("greek yogurt", "hung curd")),
        FoodBase("Tofu", "100g", 100, 76, 8.1, 1.9, 4.8, listOf("tofu", "soy paneer")),
        FoodBase("Whey Protein Shake", "1 scoop (35g)", 35, 130, 24.0, 3.0, 1.5, listOf("protein shake", "protein powder", "whey", "shake")),
        FoodBase("Peanut Butter", "1 tbsp (16g)", 16, 94, 4.0, 3.0, 8.0, listOf("peanut butter", "pb")),
        FoodBase("Almonds", "10 pieces (12g)", 12, 70, 2.5, 2.5, 6.0, listOf("almond", "almonds", "badam")),

        // ── Common Fruits (Strictly Accurate Macros - Minimal Protein) ──
        FoodBase("Banana", "1 medium", 118, 105, 1.3, 27.0, 0.3, listOf("banana", "bananas", "kela")),
        FoodBase("Apple", "1 medium", 182, 95, 0.5, 25.0, 0.3, listOf("apple", "apples", "seb")),
        FoodBase("Orange", "1 medium", 130, 62, 1.2, 15.0, 0.2, listOf("orange", "oranges", "santra")),
        FoodBase("Mango", "1 medium", 200, 120, 1.6, 30.0, 0.8, listOf("mango", "mangoes", "aam")),
        FoodBase("Watermelon", "1 cup (150g)", 150, 45, 0.9, 11.5, 0.3, listOf("watermelon", "tarbooj")),
        FoodBase("Papaya", "1 cup (145g)", 145, 62, 0.7, 15.5, 0.4, listOf("papaya", "papita")),
        FoodBase("Guava", "1 medium (90g)", 90, 61, 2.3, 12.9, 0.9, listOf("guava", "amrood")),
        FoodBase("Grapes", "1 cup (100g)", 100, 69, 0.7, 18.1, 0.2, listOf("grapes", "angoor")),

        // ── Snacks & Breakfast ──
        FoodBase("Oatmeal", "1 bowl (150g)", 150, 150, 5.0, 27.0, 2.5, listOf("oat", "oats", "oatmeal", "porridge")),
        FoodBase("Poha", "1 plate", 150, 195, 3.5, 36.0, 4.0, listOf("poha", "pohe")),
        FoodBase("Upma", "1 plate", 150, 210, 5.0, 38.0, 4.5, listOf("upma")),
        FoodBase("Idli", "1 idli", 50, 65, 2.0, 14.0, 0.2, listOf("idli", "idlis")),
        FoodBase("Dosa", "1 dosa", 80, 135, 3.0, 23.0, 3.5, listOf("dosa", "plain dosa", "sada dosa")),
        FoodBase("Masala Dosa", "1 dosa", 150, 250, 4.5, 38.0, 9.0, listOf("masala dosa")),
        FoodBase("Samosa", "1 piece", 80, 260, 4.0, 30.0, 14.0, listOf("samosa", "samosas")),
        FoodBase("Mixed Green Salad", "1 bowl", 100, 50, 2.0, 8.0, 1.0, listOf("salad", "green salad", "cucumber")),
        FoodBase("Pizza Slice", "1 slice", 107, 285, 12.0, 36.0, 10.0, listOf("pizza", "slice of pizza")),
        FoodBase("Burger", "1 burger", 150, 450, 22.0, 40.0, 21.0, listOf("burger", "sandwich")),
        FoodBase("Chai / Milk Tea", "1 cup (150ml)", 150, 75, 2.0, 10.0, 3.0, listOf("tea", "chai", "milk tea")),
        FoodBase("Coffee", "1 cup (150ml)", 150, 65, 2.0, 8.0, 2.5, listOf("coffee", "black coffee"))
    )

    fun parseLocalFoodDescription(text: String): AnalyzeTextResponse {
        val lower = text.lowercase().trim()
        val detectedItems = mutableListOf<NutritionItem>()
        val segments = lower.split(Regex("""\s*(?:,|\band\b|\bwith\b|\+|\bplus\b)\s*""")).filter { it.isNotBlank() }

        for (segment in segments) {
            // 1. Check for explicit grams/ml, e.g. "100 gm chickpea" or "250g rice"
            val gramMatch = Regex("""\b(\d+(?:\.\d+)?)\s*(?:g|gm|gms|gram|grams|ml)\b""", RegexOption.IGNORE_CASE).find(segment)
            val explicitGrams = gramMatch?.groupValues?.get(1)?.toDoubleOrNull()

            // 2. Check for piece/unit count, e.g. "7 poori" or "2 eggs"
            val cleanedSegment = if (gramMatch != null) segment.replace(gramMatch.value, " ") else segment
            val numMatch = Regex("""\b(\d+(?:\.\d+)?)\b""").find(cleanedSegment)
            val count = (numMatch?.groupValues?.get(1)?.toDoubleOrNull() ?: 1.0).coerceIn(0.25, 50.0)

            for (food in DATABASE) {
                val matchesFood = food.aliases.any { alias ->
                    Regex("""\b${Regex.escape(alias)}\b""").containsMatchIn(segment)
                }
                if (matchesFood) {
                    val factor = if (explicitGrams != null && explicitGrams > 0.0) {
                        explicitGrams / food.grams.toDouble()
                    } else {
                        count
                    }

                    val totalGrams = if (explicitGrams != null && explicitGrams > 0.0) {
                        explicitGrams.roundToInt()
                    } else {
                        (food.grams * count).roundToInt()
                    }

                    val cals = (food.calories * factor).roundToInt()
                    val pro = Math.round(food.protein * factor * 10.0) / 10.0
                    val carbs = Math.round(food.carbs * factor * 10.0) / 10.0
                    val fat = Math.round(food.fat * factor * 10.0) / 10.0

                    val quantityStr = if (explicitGrams != null && explicitGrams > 0.0) {
                        "${explicitGrams.roundToInt()}g"
                    } else if (count == 1.0) {
                        food.defaultServing
                    } else {
                        "${if (count % 1.0 == 0.0) count.toInt() else count} × ${food.defaultServing}"
                    }

                    detectedItems.add(
                        NutritionItem(
                            name = food.name,
                            quantity = quantityStr,
                            grams = totalGrams,
                            calories = cals,
                            protein = pro,
                            carbs = carbs,
                            fat = fat
                        )
                    )
                    break
                }
            }
        }

        // If segmenting didn't catch anything, try full text search
        if (detectedItems.isEmpty()) {
            for (food in DATABASE) {
                for (alias in food.aliases) {
                    val gramRegex = Regex("""(\d+(?:\.\d+)?)\s*(?:g|gm|gms|gram|grams|ml)\s+${Regex.escape(alias)}""", RegexOption.IGNORE_CASE)
                    val gMatch = gramRegex.find(lower)
                    if (gMatch != null) {
                        val gVal = gMatch.groupValues[1].toDoubleOrNull() ?: food.grams.toDouble()
                        val factor = gVal / food.grams.toDouble()
                        detectedItems.add(
                            NutritionItem(
                                name = food.name,
                                quantity = "${gVal.roundToInt()}g",
                                grams = gVal.roundToInt(),
                                calories = (food.calories * factor).roundToInt(),
                                protein = Math.round(food.protein * factor * 10.0) / 10.0,
                                carbs = Math.round(food.carbs * factor * 10.0) / 10.0,
                                fat = Math.round(food.fat * factor * 10.0) / 10.0
                            )
                        )
                        break
                    }

                    val countRegex = Regex("""(?:(\d+(?:\.\d+)?)\s*(?:pieces?|slices?|cups?|bowls?|x)?\s+)?\b${Regex.escape(alias)}\b""")
                    val match = countRegex.find(lower)
                    if (match != null) {
                        val count = (match.groupValues.getOrNull(1)?.toDoubleOrNull() ?: 1.0).coerceIn(0.25, 50.0)
                        val cals = (food.calories * count).roundToInt()
                        val pro = Math.round(food.protein * count * 10.0) / 10.0
                        val carbs = Math.round(food.carbs * count * 10.0) / 10.0
                        val fat = Math.round(food.fat * count * 10.0) / 10.0
                        val quantityStr = if (count == 1.0) food.defaultServing else "${if (count % 1.0 == 0.0) count.toInt() else count} × ${food.defaultServing}"

                        detectedItems.add(
                            NutritionItem(
                                name = food.name,
                                quantity = quantityStr,
                                grams = (food.grams * count).roundToInt(),
                                calories = cals,
                                protein = pro,
                                carbs = carbs,
                                fat = fat
                            )
                        )
                        break
                    }
                }
            }
        }

        if (detectedItems.isNotEmpty()) {
            val totalCal = detectedItems.sumOf { it.calories }
            val totalPro = Math.round(detectedItems.sumOf { it.protein } * 10.0) / 10.0
            val totalCarbs = Math.round(detectedItems.sumOf { it.carbs } * 10.0) / 10.0
            val totalFat = Math.round(detectedItems.sumOf { it.fat } * 10.0) / 10.0
            return AnalyzeTextResponse(
                items = detectedItems,
                totalCalories = totalCal,
                totalProtein = totalPro,
                totalCarbs = totalCarbs,
                totalFat = totalFat,
                note = "Estimated via verified local nutritional database"
            )
        }

        // Adaptive estimate for unlisted foods based on detected quantities
        val countMatch = Regex("""\b(\d+(?:\.\d+)?)\b""").find(lower)
        val estimatedCount = (countMatch?.groupValues?.get(1)?.toDoubleOrNull() ?: 1.0).coerceIn(1.0, 20.0)
        val genericCals = (180.0 * estimatedCount).roundToInt()
        val genericPro = Math.round(6.0 * estimatedCount * 10.0) / 10.0
        val genericCarbs = Math.round(24.0 * estimatedCount * 10.0) / 10.0
        val genericFat = Math.round(7.0 * estimatedCount * 10.0) / 10.0

        val genericItem = NutritionItem(
            name = text.take(30).replaceFirstChar { it.uppercase() },
            quantity = if (estimatedCount > 1.0) "${estimatedCount.toInt()} servings" else "1 standard serving",
            grams = (100 * estimatedCount).roundToInt(),
            calories = genericCals,
            protein = genericPro,
            carbs = genericCarbs,
            fat = genericFat
        )
        return AnalyzeTextResponse(
            items = listOf(genericItem),
            totalCalories = genericItem.calories,
            totalProtein = genericItem.protein,
            totalCarbs = genericItem.carbs,
            totalFat = genericItem.fat,
            note = "Estimated based on average meal portions"
        )
    }
}
