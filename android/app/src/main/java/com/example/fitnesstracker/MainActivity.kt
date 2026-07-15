package com.example.fitnesstracker

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import com.example.fitnesstracker.data.local.LocalStorageManager
import com.example.fitnesstracker.data.repository.DriveSyncRepository
import com.example.fitnesstracker.data.repository.FitnessRepository
import com.example.fitnesstracker.ui.screens.MainScreen
import com.example.fitnesstracker.ui.theme.FitnessTrackerTheme
import com.example.fitnesstracker.ui.viewmodel.DashboardViewModel
import com.example.fitnesstracker.ui.viewmodel.LogViewModel
import com.example.fitnesstracker.ui.viewmodel.SyncViewModel

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Initialize Local Storage & Backup Engines
        val localManager = LocalStorageManager(applicationContext)
        val syncRepository = DriveSyncRepository(applicationContext)
        val fitnessRepository = FitnessRepository(localManager, syncRepository)

        // Initialize MVVM ViewModels
        val dashboardViewModel = DashboardViewModel(fitnessRepository)
        val logViewModel = LogViewModel(fitnessRepository)
        val syncViewModel = SyncViewModel(fitnessRepository, syncRepository, localManager)

        setContent {
            FitnessTrackerTheme {
                MainScreen(
                    dashboardViewModel = dashboardViewModel,
                    logViewModel = logViewModel,
                    syncViewModel = syncViewModel
                )
            }
        }
    }
}
