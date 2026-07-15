package com.example.fitnesstracker.ui.viewmodel

import androidx.lifecycle.ViewModel
import com.example.fitnesstracker.data.model.DailyLog
import com.example.fitnesstracker.data.model.Meal
import com.example.fitnesstracker.data.model.Workout
import com.example.fitnesstracker.data.model.WorkoutSet
import com.example.fitnesstracker.data.repository.FitnessRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.UUID

class LogViewModel(private val repository: FitnessRepository) : ViewModel() {

    // Helper method to resolve or initialize today's daily log container
    private fun getOrCreateTodayLog(): DailyLog {
        val todayStr = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())
        val backup = repository.backupState.value
        val existing = backup.logs.values.find { it.date == todayStr }
        return existing ?: DailyLog(
            id = repository.generateUniqueId(),
            date = todayStr,
            weight = null,
            meals = emptyList(),
            workouts = emptyList(),
            notes = ""
        )
    }

    // Save/Update Weight
    fun saveWeight(weightValue: Double) {
        val log = getOrCreateTodayLog()
        repository.saveDailyLog(log.copy(weight = weightValue))
    }

    // Add a new Meal
    fun addMeal(name: String, protein: Int, calories: Int) {
        val log = getOrCreateTodayLog()
        val timestamp = SimpleDateFormat("HH:mm", Locale.getDefault()).format(Date())
        val newMeal = Meal(
            id = "meal_" + UUID.randomUUID().toString().take(6),
            name = name,
            protein = protein,
            calories = calories,
            timestamp = timestamp
        )
        val updatedMeals = log.meals + newMeal
        repository.saveDailyLog(log.copy(meals = updatedMeals))
    }

    // Add a new Workout exercise with multiple sets
    fun addWorkout(exerciseName: String, category: String, setsList: List<Pair<Int, Double>>) {
        val log = getOrCreateTodayLog()
        val workoutId = "work_" + UUID.randomUUID().toString().take(6)
        
        val sets = setsList.mapIndexed { idx, pair ->
            WorkoutSet(
                id = "set_${workoutId}_$idx",
                reps = pair.first,
                weight = pair.second,
                completed = false
            )
        }

        val newWorkout = Workout(
            id = workoutId,
            name = exerciseName,
            category = category,
            completed = false,
            sets = sets
        )

        val updatedWorkouts = log.workouts + newWorkout
        repository.saveDailyLog(log.copy(workouts = updatedWorkouts))
    }

    // Update journal notes
    fun saveNotes(notesText: String) {
        val log = getOrCreateTodayLog()
        repository.saveDailyLog(log.copy(notes = notesText))
    }
}
