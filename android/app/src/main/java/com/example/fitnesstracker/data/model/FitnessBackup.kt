package com.example.fitnesstracker.data.model

import kotlinx.serialization.Serializable

@Serializable
data class FitnessBackup(
    val version: Int = 1,
    val lastSyncedAt: String = "",
    val goals: Goal = Goal(),
    val logs: Map<String, DailyLog> = emptyMap(), // Map of ID -> DailyLog
    val analytics: AnalyticsData = AnalyticsData()
)

@Serializable
data class Goal(
    val weightTarget: Double = 160.0,
    val caloriesTarget: Int = 2500,
    val proteinTarget: Int = 160,
    val weeklyWorkoutDaysTarget: Int = 5
)

@Serializable
data class DailyLog(
    val id: String,
    val date: String, // YYYY-MM-DD
    val weight: Double? = null,
    val meals: List<Meal> = emptyList(),
    val workouts: List<Workout> = emptyList(),
    val notes: String = ""
)

@Serializable
data class Meal(
    val id: String,
    val name: String,
    val protein: Int,
    val calories: Int,
    val timestamp: String
)

@Serializable
data class Workout(
    val id: String,
    val name: String,
    val category: String,
    val completed: Boolean,
    val sets: List<WorkoutSet> = emptyList()
)

@Serializable
data class WorkoutSet(
    val id: String,
    val reps: Int,
    val weight: Double,
    val completed: Boolean
)

@Serializable
data class AnalyticsData(
    val cachedStats: CachedStats = CachedStats(),
    val insights: List<CoachingInsight> = emptyList()
)

@Serializable
data class CachedStats(
    val averageCalories: Int = 0,
    val averageProtein: Int = 0,
    val workoutsCompletedThisWeek: Int = 0,
    val streakDays: Int = 0
)

@Serializable
data class CoachingInsight(
    val id: String,
    val timestamp: String,
    val summary: String,
    val text: String,
    val type: String
)
