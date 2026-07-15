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

    private val _driveService = MutableStateFlow<Drive?>(null)
    val driveService: StateFlow<Drive?> = _driveService.asStateFlow()

    private val _syncFolderLocation = MutableStateFlow("MyFitnessTracker")
    val syncFolderLocation: StateFlow<String> = _syncFolderLocation.asStateFlow()

    private val _isSyncing = MutableStateFlow(false)
    val isSyncing: StateFlow<Boolean> = _isSyncing.asStateFlow()

    private val _syncMessage = MutableStateFlow("")
    val syncMessage: StateFlow<String> = _syncMessage.asStateFlow()

    fun setAccountConnected(connected: Boolean) {
        _isGoogleAccountConnected.value = connected
    }

    fun setGoogleAccount(account: android.accounts.Account?, context: android.content.Context) {
        if (account != null) {
            try {
                val credential = com.google.api.client.googleapis.extensions.android.gms.auth.GoogleAccountCredential.usingOAuth2(
                    context,
                    listOf("https://www.googleapis.com/auth/drive.file")
                )
                credential.selectedAccount = account
                
                val drive = com.google.api.services.drive.Drive.Builder(
                    com.google.api.client.http.javanet.NetHttpTransport(),
                    com.google.api.client.json.gson.GsonFactory.getDefaultInstance(),
                    credential
                )
                .setApplicationName("FitnessTracker")
                .build()
                
                _driveService.value = drive
                _isGoogleAccountConnected.value = true
                com.example.fitnesstracker.worker.DriveSyncWorker.driveServiceInstance = drive
                _syncMessage.value = "Google Account connected!"
            } catch (e: Exception) {
                _syncMessage.value = "Failed to initialize Drive client: ${e.localizedMessage}"
                _isGoogleAccountConnected.value = false
                _driveService.value = null
            }
        } else {
            _driveService.value = null
            _isGoogleAccountConnected.value = false
            com.example.fitnesstracker.worker.DriveSyncWorker.driveServiceInstance = null
            _syncMessage.value = "Google Account disconnected."
        }
    }

    fun updateFolderLocation(newFolderName: String) {
        if (newFolderName.isNotBlank()) {
            _syncFolderLocation.value = newFolderName
        }
    }

    // Trigger immediate manual backup
    fun triggerManualBackup() {
        val service = _driveService.value
        if (service == null) {
            _syncMessage.value = "Google Drive client not authorized!"
            return
        }

        viewModelScope.launch {
            _isSyncing.value = true
            _syncMessage.value = "Initializing cloud transfer..."
            try {
                val driveHelper = DriveServiceHelper(service)
                
                // 1. Resolve folder path
                val folderId = driveHelper.getOrCreateFolder(_syncFolderLocation.value)
                
                // 2. Fetch local source payload
                val localFile = localManager.getBackupFile()
                if (localFile.exists()) {
                    driveHelper.uploadFile(folderId, localFile)
                    _syncMessage.value = "Backup uploaded successfully!"
                    syncRepository.scheduleBackgroundSync() // Run verification sync
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
    fun triggerManualRestore() {
        val service = _driveService.value
        if (service == null) {
            _syncMessage.value = "Google Drive client not authorized!"
            return
        }

        viewModelScope.launch {
            _isSyncing.value = true
            _syncMessage.value = "Searching for cloud backups..."
            try {
                val driveHelper = DriveServiceHelper(service)
                val folderId = driveHelper.getOrCreateFolder(_syncFolderLocation.value)
                val fileId = driveHelper.findBackupFile(folderId, "fitness_tracker_backup.json")

                if (fileId != null) {
                    _syncMessage.value = "Restoring local structures..."
                    val localTarget = localManager.getBackupFile()
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
}
