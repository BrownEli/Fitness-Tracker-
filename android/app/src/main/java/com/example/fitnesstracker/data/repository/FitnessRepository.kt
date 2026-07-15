package com.example.fitnesstracker.data.repository

import com.example.fitnesstracker.data.local.LocalStorageManager
import com.example.fitnesstracker.data.model.FitnessBackup
import com.example.fitnesstracker.data.model.DailyLog
import com.example.fitnesstracker.data.model.Goal
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.util.UUID

class FitnessRepository(
    private val localManager: LocalStorageManager,
    private val syncRepository: DriveSyncRepository
) {
    private val _backupState = MutableStateFlow(localManager.getBackup())
    val backupState: StateFlow<FitnessBackup> = _backupState.asStateFlow()

    init {
        refreshState()
    }

    fun refreshState() {
        _backupState.value = localManager.getBackup()
    }

    // Save or Update a single daily log
    fun saveDailyLog(log: DailyLog) {
        localManager.saveLog(log)
        refreshState()
        syncRepository.scheduleBackgroundSync()
    }

    // Create or Edit goals
    fun updateGoals(goal: Goal) {
        localManager.saveGoals(goal)
        refreshState()
        syncRepository.scheduleBackgroundSync()
    }

    // Delete log
    fun deleteDailyLog(id: String) {
        localManager.deleteLog(id)
        refreshState()
        syncRepository.scheduleBackgroundSync()
    }

    // Generates a unique log ID
    fun generateUniqueId(): String {
        return "log_" + UUID.randomUUID().toString().take(8)
    }
}
