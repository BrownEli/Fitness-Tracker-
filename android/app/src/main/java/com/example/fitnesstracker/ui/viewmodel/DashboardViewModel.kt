package com.example.fitnesstracker.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.fitnesstracker.data.model.DailyLog
import com.example.fitnesstracker.data.model.FitnessBackup
import com.example.fitnesstracker.data.model.Goal
import com.example.fitnesstracker.data.model.Workout
import com.example.fitnesstracker.data.repository.FitnessRepository
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class DashboardViewModel(private val repository: FitnessRepository) : ViewModel() {

    val backupState: StateFlow<FitnessBackup> = repository.backupState

    // Map backupState into a specific day log (defaulting to today's date)
    val todayLog: StateFlow<DailyLog?> = repository.backupState.map { backup ->
        val todayStr = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())
        backup.logs.values.find { it.date == todayStr }
    }.stateIn(viewModelScope, SharingStarted.Lazily, null)

    // Save goals changes
    fun updateGoals(weightTarget: Double, caloriesTarget: Int, proteinTarget: Int, workoutDaysTarget: Int) {
        val newGoal = Goal(
            weightTarget = weightTarget,
            caloriesTarget = caloriesTarget,
            proteinTarget = proteinTarget,
            weeklyWorkoutDaysTarget = workoutDaysTarget
        )
        repository.updateGoals(newGoal)
    }

    // Toggle workout status
    fun toggleWorkoutCompletion(logId: String, workoutId: String, completed: Boolean) {
        val currentBackup = repository.backupState.value
        val log = currentBackup.logs[logId] ?: return
        
        val updatedWorkouts = log.workouts.map { workout ->
            if (workout.id == workoutId) {
                workout.copy(completed = completed)
            } else {
                workout
            }
        }
        
        repository.saveDailyLog(log.copy(workouts = updatedWorkouts))
    }

    // Quick delete a daily log
    fun deleteLog(logId: String) {
        repository.deleteDailyLog(logId)
    }

    // Save/Update Scale Weight from inline Dashboard tracker
    fun saveWeight(weightValue: Double) {
        val todayStr = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())
        val backup = repository.backupState.value
        val existing = backup.logs.values.find { it.date == todayStr }
        val log = existing ?: DailyLog(
            id = repository.generateUniqueId(),
            date = todayStr,
            weight = null,
            meals = emptyList(),
            workouts = emptyList(),
            notes = ""
        )
        repository.saveDailyLog(log.copy(weight = weightValue))
    }
}
