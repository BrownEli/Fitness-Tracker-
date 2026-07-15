package com.example.fitnesstracker.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.fitnesstracker.data.local.LocalStorageManager
import com.example.fitnesstracker.data.remote.DriveServiceHelper
import com.example.fitnesstracker.data.repository.DriveSyncRepository
import com.example.fitnesstracker.data.repository.FitnessRepository
import com.google.api.services.drive.Drive
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.io.File

class SyncViewModel(
    private val repository: FitnessRepository,
    private val syncRepository: DriveSyncRepository,
    private val localManager: LocalStorageManager
) : ViewModel() {

    private val _isGoogleAccountConnected = MutableStateFlow(false)
    val isGoogleAccountConnected: StateFlow<Boolean> = _isGoogleAccountConnected.asStateFlow()

    private val _syncFolderLocation = MutableStateFlow("MyFitnessTracker")
    val syncFolderLocation: StateFlow<String> = _syncFolderLocation.asStateFlow()

    private val _isSyncing = MutableStateFlow(false)
    val isSyncing: StateFlow<Boolean> = _isSyncing.asStateFlow()

    private val _syncMessage = MutableStateFlow("")
    val syncMessage: StateFlow<String> = _syncMessage.asStateFlow()

    fun setAccountConnected(connected: Boolean) {
        _isGoogleAccountConnected.value = connected
    }

    fun updateFolderLocation(newFolderName: String) {
        if (newFolderName.isNotBlank()) {
            _syncFolderLocation.value = newFolderName
        }
    }

    // Trigger immediate manual backup
    fun triggerManualBackup(driveService: Drive?) {
        if (driveService == null) {
            _syncMessage.value = "Google Drive client not authorized!"
            return
        }

        viewModelScope.launch {
            _isSyncing.value = true
            _syncMessage.value = "Initializing cloud transfer..."
            try {
                val driveHelper = DriveServiceHelper(driveService)
                
                // 1. Resolve folder path
                val folderId = driveHelper.getOrCreateFolder(_syncFolderLocation.value)
                
                // 2. Fetch local source payload
                val localFile = File(localManager.getBackupFileLocation())
                if (localFile.exists()) {
                    driveHelper.uploadFile(folderId, localFile)
                    _syncMessage.value = "Backup uploaded successfully!"
                } else {
                    _syncMessage.value = "No local backup data to sync yet."
                }
            } catch (e: Exception) {
                _syncMessage.value = "Sync failed: ${e.localizedMessage}"
            } finally {
                _isSyncing.value = false
            }
        }
    }

    // Restore from Drive backup file
    fun triggerManualRestore(driveService: Drive?) {
        if (driveService == null) {
            _syncMessage.value = "Google Drive client not authorized!"
            return
        }

        viewModelScope.launch {
            _isSyncing.value = true
            _syncMessage.value = "Searching for cloud backups..."
            try {
                val driveHelper = DriveServiceHelper(driveService)
                val folderId = driveHelper.getOrCreateFolder(_syncFolderLocation.value)
                val fileId = driveHelper.findBackupFile(folderId, "fitness_tracker_backup.json")

                if (fileId != null) {
                    _syncMessage.value = "Restoring local structures..."
                    val localTarget = File(localManager.getBackupFileLocation())
                    driveHelper.downloadFile(fileId, localTarget)
                    repository.refreshState()
                    _syncMessage.value = "System restored successfully!"
                } else {
                    _syncMessage.value = "No remote backup found under '${_syncFolderLocation.value}'."
                }
            } catch (e: Exception) {
                _syncMessage.value = "Restore failed: ${e.localizedMessage}"
            } finally {
                _isSyncing.value = false
            }
        }
    }

    // Local Helper to fetch path
    private fun LocalStorageManager.getBackupFileLocation(): String {
        return File(context.filesDir, "fitness_tracker_backup.json").absolutePath
    }
}
