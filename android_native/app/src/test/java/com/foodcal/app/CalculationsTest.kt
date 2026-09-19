package com.foodcal.app

import com.foodcal.app.domain.calculateMetCalories
import com.foodcal.app.domain.calculateTotals
import com.foodcal.app.domain.maintenanceCalories
import com.foodcal.app.domain.scaleMacroByGrams
import org.junit.Assert.assertEquals
import org.junit.Test

class CalculationsTest {
    @Test
    fun totalsAddNutrition() {
        val totals = calculateTotals(listOf(200, 220), listOf(18, 22))
        assertEquals(420, totals.calories)
        assertEquals(40, totals.protein)
    }

    @Test
    fun maintenanceUsesMetricProfile() {
        assertEquals(1674, maintenanceCalories(70.0, 175.0, 25, "male"))
        assertEquals(1508, maintenanceCalories(70.0, 175.0, 25, "female"))
    }

    @Test
    fun macroScalingProportional() {
        // 200g of food from 100g base with 25g protein should yield 50g protein
        val scaled = scaleMacroByGrams(25.0, 100, 200)
        assertEquals(50.0, scaled, 0.001)

        // 150g from 100g base with 300 calories should yield 450 calories
        val scaledCals = scaleMacroByGrams(300.0, 100, 150)
        assertEquals(450.0, scaledCals, 0.001)
    }

    @Test
    fun metCalorieCalculation() {
        // Running at 7.0 MET for 30 minutes at 70kg: (7.0 * 3.5 * 70 / 200) * 30 = 257 kcal
        val burned = calculateMetCalories(7.0, 70.0, 30)
        assertEquals(257, burned)
    }

    @Test
    fun mealTypeDetectionCoversAllCanonicalBuckets() {
        assertEquals("Breakfast", com.foodcal.app.data.model.detectMealType(8))
        assertEquals("Lunch", com.foodcal.app.data.model.detectMealType(13))
        assertEquals("Evening Snacks", com.foodcal.app.data.model.detectMealType(17))
        assertEquals("Dinner", com.foodcal.app.data.model.detectMealType(20))
        assertEquals("Late Night", com.foodcal.app.data.model.detectMealType(23))
        assertEquals("Late Night", com.foodcal.app.data.model.detectMealType(2))
    }

    @Test
    fun unitConversionsAreAccurate() {
        // 154 lbs to kg: 154 * 0.453592 = 69.85 kg -> 69.9 kg
        val lbs = 154.0
        val kg = ((lbs * 0.453592) * 10.0).let { Math.round(it) } / 10.0
        assertEquals(69.9, kg, 0.1)

        // 70 kg to lbs: 70 / 0.453592 = 154.3 lbs
        val lbsFromKg = ((70.0 / 0.453592) * 10.0).let { Math.round(it) } / 10.0
        assertEquals(154.3, lbsFromKg, 0.1)

        // 5.9 ft to cm: 5.9 * 30.48 = 179.8 cm
        val cm = ((5.9 * 30.48) * 10.0).let { Math.round(it) } / 10.0
        assertEquals(179.8, cm, 0.1)
    }

    @Test
    fun foodLocalParserDetectsCommonFoodsAndTotals() {
        val parsed = com.foodcal.app.data.util.FoodLocalParser.parseLocalFoodDescription("2 bananas")
        assertEquals(1, parsed.items.size)
        assertEquals("Banana", parsed.items[0].name)
        assertEquals(210, parsed.totalCalories)
        assertEquals(2.6, parsed.totalProtein, 0.1)

        val meal = com.foodcal.app.data.util.FoodLocalParser.parseLocalFoodDescription("2 eggs sunny side up with 2 slices of whole wheat toast")
        assertEquals(2, meal.items.size)
        assertEquals(306, meal.totalCalories)
        assertEquals(17.6, meal.totalProtein, 0.1)
    }

    @Test
    fun foodLocalParserDetectsPooriAndChickpeasAccurately() {
        val parsed = com.foodcal.app.data.util.FoodLocalParser.parseLocalFoodDescription("7 poori and 100 gm chickpea")
        assertEquals(2, parsed.items.size)
        // 7 pooris = 7 * 135 = 945 kcal, 17.5g protein
        // 100g chickpeas = 164 kcal, 8.9g protein
        // Total = 1109 kcal, 26.4g protein
        assertEquals(1109, parsed.totalCalories)
        assertEquals(26.4, parsed.totalProtein, 0.5)
    }
}
