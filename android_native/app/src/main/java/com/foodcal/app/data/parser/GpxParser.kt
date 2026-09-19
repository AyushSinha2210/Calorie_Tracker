package com.foodcal.app.data.parser

import android.location.Location
import java.io.InputStream
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import kotlin.math.roundToInt

data class ParsedGpxActivity(
    val name: String,
    val date: String,
    val durationMin: Int,
    val distanceKm: Double,
    val caloriesBurned: Int,
    val activityType: String
)

object GpxParser {
    fun parse(inputStream: InputStream, userWeightKg: Double = 70.0): ParsedGpxActivity {
        val content = inputStream.bufferedReader().use { it.readText() }

        // Extract activity name
        val nameMatch = Regex("<name>(.*?)</name>").find(content)
        val activityName = nameMatch?.groupValues?.get(1)?.trim()?.take(40) ?: "Outdoor Activity"

        // Extract timestamps
        val timeMatches = Regex("<time>(.*?)</time>").findAll(content).toList()
        var durationMin = 30
        var dateStr = LocalDate.now().toString()

        if (timeMatches.isNotEmpty()) {
            val startTimeStr = timeMatches.first().groupValues[1]
            val endTimeStr = timeMatches.last().groupValues[1]
            try {
                val startInstant = Instant.parse(startTimeStr)
                val endInstant = Instant.parse(endTimeStr)
                val diffSeconds = (endInstant.epochSecond - startInstant.epochSecond).coerceAtLeast(60)
                durationMin = (diffSeconds / 60).toInt().coerceAtLeast(1)
                dateStr = startInstant.atZone(ZoneId.systemDefault()).toLocalDate().toString()
            } catch (_: Exception) {}
        }

        // Extract trkpt coordinates
        val trkptMatches = Regex("<trkpt\\s+[^>]*lat=[\"']([-0-9.]+)[\"'][^>]*lon=[\"']([-0-9.]+)[\"']").findAll(content).toList()
        var totalDistanceMeters = 0.0
        val results = FloatArray(1)

        for (i in 0 until trkptMatches.size - 1) {
            val lat1 = trkptMatches[i].groupValues[1].toDoubleOrNull() ?: continue
            val lon1 = trkptMatches[i].groupValues[2].toDoubleOrNull() ?: continue
            val lat2 = trkptMatches[i + 1].groupValues[1].toDoubleOrNull() ?: continue
            val lon2 = trkptMatches[i + 1].groupValues[2].toDoubleOrNull() ?: continue

            Location.distanceBetween(lat1, lon1, lat2, lon2, results)
            totalDistanceMeters += results[0]
        }

        val distanceKm = ((totalDistanceMeters / 1000.0) * 100.0).roundToInt() / 100.0

        // Determine activity type & MET
        val lowerName = activityName.lowercase()
        val (type, met) = when {
            lowerName.contains("ride") || lowerName.contains("cycle") || lowerName.contains("biking") -> "Cardio" to 7.5
            lowerName.contains("walk") || lowerName.contains("hike") -> "Cardio" to 3.8
            lowerName.contains("badminton") -> "Sports" to 7.0
            lowerName.contains("soccer") || lowerName.contains("football") -> "Sports" to 8.5
            lowerName.contains("tennis") -> "Sports" to 7.3
            lowerName.contains("basketball") -> "Sports" to 8.0
            else -> "Cardio" to 9.0
        }

        val calories = ((met * 3.5 * userWeightKg / 200.0) * durationMin).toInt().coerceAtLeast(30)

        return ParsedGpxActivity(
            name = activityName,
            date = dateStr,
            durationMin = durationMin,
            distanceKm = distanceKm,
            caloriesBurned = calories,
            activityType = type
        )
    }
}

