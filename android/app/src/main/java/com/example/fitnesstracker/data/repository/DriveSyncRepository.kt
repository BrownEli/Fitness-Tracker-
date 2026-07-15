package com.example.fitnesstracker.data.repository

import android.content.Context
import androidx.work.Constraints
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import com.example.fitnesstracker.worker.DriveSyncWorker
import java.util.concurrent.TimeUnit

class DriveSyncRepository(private val context: Context) {
    private val workManager = WorkManager.getInstance(context)

    /**
     * Enqueues a background sync operation with constraints (internet required).
     */
    fun scheduleBackgroundSync() {
        val constraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build()

        val syncRequest = OneTimeWorkRequestBuilder<DriveSyncWorker>()
            .setConstraints(constraints)
            .setBackoffCriteria(
                androidx.work.BackoffPolicy.EXPONENTIAL,
                androidx.work.WorkRequest.MIN_BACKOFF_MILLIS,
                TimeUnit.MILLISECONDS
            )
            .build()

        workManager.enqueueUniqueWork(
            "drive_backup_sync_task",
            ExistingWorkPolicy.REPLACE,
            syncRequest
        )
    }
}
