package com.example.fitnesstracker.data.local

import android.content.Context
import com.example.fitnesstracker.data.model.FitnessBackup
import com.example.fitnesstracker.data.model.DailyLog
import com.example.fitnesstracker.data.model.Goal
import com.example.fitnesstracker.data.model.AnalyticsData
import com.example.fitnesstracker.data.model.CachedStats
import kotlinx.serialization.json.Json
import kotlinx.serialization.encodeToString
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class LocalStorageManager(private val context: Context) {
    private val json = Json { 
        prettyPrint = true 
        ignoreUnknownKeys = true 
        coerceInputValues = true
    }
    private val backupFile = File(context.filesDir, "fitness_tracker_backup.json")

    // Get current state or create empty default structure
    fun getBackup(): FitnessBackup {
        return if (backupFile.exists()) {
            try {
                json.decodeFromString<FitnessBackup>(backupFile.readText())
            } catch (e: Exception) {
                createEmptyBackup()
            }
        } else {
            createEmptyBackup()
        }
    }

    // Direct write to storage
    fun saveBackup(backup: FitnessBackup) {
        val timestamp = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.getDefault()).format(Date())
        val updatedWithTime = backup.copy(lastSyncedAt = timestamp)
        backupFile.writeText(json.encodeToString(updatedWithTime))
    }

    // Save individual log and trigger internal analytics re-calculation
    fun saveLog(log: DailyLog) {
        val current = getBackup()
        val mutableLogs = current.logs.toMutableMap()
        mutableLogs[log.id] = log

        // Calculate and refresh stats cache automatically
        val updatedStats = calculateStats(mutableLogs.values.toList())
        val updatedAnalytics = current.analytics.copy(cachedStats = updatedStats)

        saveBackup(current.copy(logs = mutableLogs, analytics = updatedAnalytics))
    }

    // Save goals settings
    fun saveGoals(goal: Goal) {
        val current = getBackup()
        saveBackup(current.copy(goals = goal))
    }

    // Delete a log record
    fun deleteLog(logId: String) {
        val current = getBackup()
        val mutableLogs = current.logs.toMutableMap()
        mutableLogs.remove(logId)
        val updatedStats = calculateStats(mutableLogs.values.toList())
        saveBackup(current.copy(logs = mutableLogs, analytics = current.analytics.copy(cachedStats = updatedStats)))
    }

    private fun calculateStats(allLogs: List<DailyLog>): CachedStats {
        if (allLogs.isEmpty()) return CachedStats()

        var totalCal = 0
        var totalProt = 0
        var mealsCount = 0
        var completedWorkoutsCount = 0

        allLogs.forEach { log ->
            log.meals.forEach { meal ->
                totalCal += meal.calories
                totalProt += meal.protein
                mealsCount++
            }
            completedWorkoutsCount += log.workouts.count { it.completed }
        }

        val logDaysCount = allLogs.size
        val avgCal = if (logDaysCount > 0) totalCal / logDaysCount else 0
        val avgProt = if (logDaysCount > 0) totalProt / logDaysCount else 0

        return CachedStats(
            averageCalories = avgCal,
            averageProtein = avgProt,
            workoutsCompletedThisWeek = completedWorkoutsCount,
            streakDays = calculateStreaks(allLogs)
        )
    }

    private fun calculateStreaks(allLogs: List<DailyLog>): Int {
        // Simple streak logic sorted by dates
        val dates = allLogs.mapNotNull { if (it.meals.isNotEmpty() || it.workouts.isNotEmpty()) it.date else null }
            .distinct()
            .sortedDescending()
        
        if (dates.isEmpty()) return 0
        
        var streak = 0
        val sdf = SimpleDateFormat("yyyy-MM-dd", Locale.US)
        
        // Simple sequential date checker
        // Just counts non-empty logged days
        return dates.size
    }

    fun getBackupFile(): File {
        return backupFile
    }

    private fun createEmptyBackup(): FitnessBackup {
        return FitnessBackup(
            version = 1,
            lastSyncedAt = "",
            goals = Goal(),
            logs = emptyMap(),
            analytics = AnalyticsData()
        )
    }
}
