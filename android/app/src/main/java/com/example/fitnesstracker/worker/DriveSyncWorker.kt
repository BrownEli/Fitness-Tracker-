package com.example.fitnesstracker.worker

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.example.fitnesstracker.data.local.LocalStorageManager
import com.example.fitnesstracker.data.remote.DriveServiceHelper
import com.google.api.services.drive.Drive

class DriveSyncWorker(
    appContext: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(appContext, workerParams) {

    // Helper provider to allow resolution in testing or application lifecycle
    companion object {
        var driveServiceInstance: Drive? = null
    }

    override suspend fun doWork(): Result {
        val driveService = driveServiceInstance ?: return Result.failure()
        val driveHelper = DriveServiceHelper(driveService)
        val localManager = LocalStorageManager(applicationContext)

        return try {
            // 1. Resolve central backup folder in Google Drive
            val folderId = driveHelper.getOrCreateFolder("MyFitnessTracker")

            // 2. Locate or Upload consolidated backup payload
            val backupFile = java.io.File(applicationContext.filesDir, "fitness_tracker_backup.json")
            if (backupFile.exists()) {
                driveHelper.uploadFile(folderId, backupFile)
            }

            Result.success()
        } catch (e: Exception) {
            if (runAttemptCount < 3) Result.retry() else Result.failure()
        }
    }
}
