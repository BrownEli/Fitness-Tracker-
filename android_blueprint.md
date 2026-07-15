# Android Jetpack Compose & MVVM Architecture Blueprint
## Offline-First Fitness Tracker with Unified Google Drive Sync

This document provides a production-grade architectural blueprint and implementation guide to build an Android companion app using **Jetpack Compose**, **Kotlin Coroutines / Flow**, and the **MVVM (Model-View-ViewModel)** pattern.

Following your preference, we avoid file-clutter on device and Google Drive by consolidating all data (Goals, Logs, and Analytics) into a **single, unified structured backup JSON** with a flat `logs` key containing unique ID-indexed records.

---

## 1. Directory & Package Architecture (MVVM)

```
com.example.fitnesstracker
├── data
│   ├── model
│   │   ├── FitnessBackup.kt     # Root backup payload containing goals, logs, and analytics
│   │   ├── DailyLog.kt          # Unique ID-indexed log (Date, Meals, Workouts, Notes)
│   │   ├── Goal.kt              # Caloric/protein goals
│   │   ├── Meal.kt              # Meal record with protein/calories
│   │   ├── Workout.kt           # Workout exercises and sets
│   │   └── AnalyticsData.kt     # Cached stats and coaching insights
│   ├── repository
│   │   ├── FitnessRepository.kt # Central repository providing Flow state to ViewModels
│   │   └── DriveSyncRepository.kt # WorkManager backup dispatcher
│   ├── local
│   │   └── LocalStorageManager.kt # Single JSON file read/write operations
│   └── remote
│       └── DriveServiceHelper.kt # Google Drive API communication layer
├── ui
│   ├── theme
│   │   ├── Color.kt             # Emerald green & Slate dark palettes
│   │   ├── Type.kt              # Inter & JetBrains Mono typography configurations
│   │   └── Theme.kt             # Material 3 Theme setup
│   ├── viewmodel
│   │   ├── DashboardViewModel.kt# Main dashboard analytics and today's activity state
│   │   ├── LogViewModel.kt      # Form fields and validation state for meals/workouts
│   │   └── SyncViewModel.kt     # Manual sync trigger and backup history
│   └── screens
│       ├── DashboardScreen.kt   # Clean, interactive progress tracking
│       ├── LogScreen.kt         # Workout and meal logging interface
│       └── SyncConfigScreen.kt  # Drive configuration and sync status
└── worker
    └── DriveSyncWorker.kt       # WorkManager orchestrating background JSON upload
```

---

## 2. Consolidated JSON Backup Schema (`fitness_tracker_backup.json`)

All persistent data resides inside a single structured file. This avoids multi-file synchronization issues, speed bottlenecks, or local state corruption.

```json
{
  "version": 1,
  "lastSyncedAt": "2026-07-15T07:15:38Z",
  "goals": {
    "weightTarget": 160.0,
    "caloriesTarget": 2800,
    "proteinTarget": 175,
    "weeklyWorkoutDaysTarget": 5
  },
  "logs": {
    "log_abc123": {
      "id": "log_abc123",
      "date": "2026-07-15",
      "weight": 165.8,
      "meals": [
        {
          "id": "meal_x1y2",
          "name": "Chicken Breast & Jasmine Rice",
          "protein": 50,
          "calories": 720,
          "timestamp": "12:30"
        }
      ],
      "workouts": [
        {
          "id": "work_z3w4",
          "name": "Deadlifts & Leg Volume",
          "category": "Legs",
          "completed": true,
          "sets": [
            {
              "id": "set_9a8b",
              "reps": 8,
              "weight": 225.0,
              "completed": true
            },
            {
              "id": "set_7c6d",
              "reps": 5,
              "weight": 315.0,
              "completed": true
            }
          ]
        }
      ],
      "notes": "Legs are absolutely cooked. Surpassed deadlift PR."
    },
    "log_def567": {
      "id": "log_def567",
      "date": "2026-07-14",
      "weight": 165.5,
      "meals": [
        {
          "id": "meal_a1b2",
          "name": "Greek Yogurt & Honey",
          "protein": 25,
          "calories": 240,
          "timestamp": "16:00"
        }
      ],
      "workouts": [],
      "notes": "Active recovery rest day."
    }
  },
  "analytics": {
    "cachedStats": {
      "averageCalories": 2480,
      "averageProtein": 165,
      "workoutsCompletedThisWeek": 3,
      "streakDays": 4
    },
    "insights": [
      {
        "id": "insight_999",
        "timestamp": "Yesterday, 18:30",
        "summary": "Optimizing Protein Timing for Anabolism",
        "text": "Your logs show excellent total protein intake, but most of it is concentrated in late meals...",
        "type": "nutrition"
      }
    ]
  }
}
```

---

## 3. Data Layer: Kotlin Data Models & Serialization

Using `@Serializable` from **Kotlinx Serialization** handles the nested backup structure.

### File: `data/model/FitnessBackup.kt`
```kotlin
package com.example.fitnesstracker.data.model

import kotlinx.serialization.Serializable

@Serializable
data class FitnessBackup(
    val version: Int = 1,
    val lastSyncedAt: String = "",
    val goals: Goal = Goal(),
    val logs: Map<String, DailyLog> = emptyMap(), // Log ID -> DailyLog
    val analytics: AnalyticsData = AnalyticsData()
)

@Serializable
data class Goal(
    val weightTarget: Double = 0.0,
    val caloriesTarget: Int = 2000,
    val proteinTarget: Int = 150,
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
```

---

## 4. Local Storage Engine (Consolidated JSON Reader/Writer)

This class acts as your high-performance offline engine, reading and writing inside the app's secure sandbox (`context.filesDir`).

### File: `data/local/LocalStorageManager.kt`
```kotlin
package com.example.fitnesstracker.data.local

import android.content.Context
import com.example.fitnesstracker.data.model.FitnessBackup
import com.example.fitnesstracker.data.model.DailyLog
import com.example.fitnesstracker.data.model.Goal
import kotlinx.serialization.json.Json
import kotlinx.serialization.encodeToString
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class LocalStorageManager(private val context: Context) {
    private val json = Json { prettyPrint = true; ignoreUnknownKeys = true }
    private val backupFile = File(context.filesDir, "fitness_tracker_backup.json")

    // Get the complete unified data backup
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

    // Overwrite/Write full backup
    fun saveBackup(backup: FitnessBackup) {
        val updatedBackup = backup.copy(
            lastSyncedAt = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.getDefault()).format(Date())
        )
        backupFile.writeText(json.encodeToString(updatedBackup))
    }

    // Retrieve a daily log by looking up its date string
    fun getLogForDate(dateString: String): DailyLog? {
        val backup = getBackup()
        return backup.logs.values.find { it.date == dateString }
    }

    // Save or update an individual log inside our unified collection
    fun saveLog(log: DailyLog) {
        val backup = getBackup()
        val updatedLogs = backup.logs.toMutableMap()
        updatedLogs[log.id] = log
        saveBackup(backup.copy(logs = updatedLogs))
    }

    // Update goals configuration
    fun saveGoals(goal: Goal) {
        val backup = getBackup()
        saveBackup(backup.copy(goals = goal))
    }

    private fun createEmptyBackup(): FitnessBackup {
        return FitnessBackup(
            lastSyncedAt = "",
            goals = Goal(),
            logs = emptyMap(),
            analytics = com.example.fitnesstracker.data.model.AnalyticsData()
        )
    }
}
```

---

## 5. MVVM Repository Flow State

The repository consumes local storage state as Flows, making updates reactive so the Compose screens redraw immediately.

### File: `data/repository/FitnessRepository.kt`
```kotlin
package com.example.fitnesstracker.data.repository

import com.example.fitnesstracker.data.local.LocalStorageManager
import com.example.fitnesstracker.data.model.FitnessBackup
import com.example.fitnesstracker.data.model.DailyLog
import com.example.fitnesstracker.data.model.Goal
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

class FitnessRepository(
    private val localManager: LocalStorageManager,
    private val driveSyncRepository: DriveSyncRepository
) {
    private val _backupState = MutableStateFlow(localManager.getBackup())
    val backupState: StateFlow<FitnessBackup> = _backupState.asStateFlow()

    fun refreshData() {
        _backupState.value = localManager.getBackup()
    }

    fun saveLog(log: DailyLog) {
        localManager.saveLog(log)
        refreshData()
        // Enqueue high-priority background sync with Google Drive
        driveSyncRepository.scheduleBackgroundSync()
    }

    fun saveGoals(goal: Goal) {
        localManager.saveGoals(goal)
        refreshData()
        driveSyncRepository.scheduleBackgroundSync()
    }
}
```

---

## 6. Background WorkManager Synchronization

WorkManager uploads the single consolidated `fitness_tracker_backup.json` to Google Drive safely.

### File: `worker/DriveSyncWorker.kt`
```kotlin
package com.example.fitnesstracker.worker

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.example.fitnesstracker.data.remote.DriveServiceHelper

class DriveSyncWorker(
    appContext: Context,
    workerParams: WorkerParameters,
    private val driveHelper: DriveServiceHelper
) : CoroutineWorker(appContext, workerParams) {

    override suspend fun doWork(): Result {
        return try {
            // 1. Resolve Sync Folder on Drive
            val folderId = driveHelper.getOrCreateFolder("MyFitnessTracker")
            
            // 2. Upload the single backup JSON file
            val backupFile = java.io.File(applicationContext.filesDir, "fitness_tracker_backup.json")
            if (backupFile.exists()) {
                driveHelper.uploadFile(folderId, backupFile)
            }

            Result.success()
        } catch (e: Exception) {
            // Respects WorkManager retry backoff criteria (max 3 times)
            if (runAttemptCount < 3) Result.retry() else Result.failure()
        }
    }
}
```

---

## 7. Jetpack Compose Integration

Our UI accesses state directly from the Repository via ViewModels.

### File: `ui/screens/DashboardScreen.kt`
```kotlin
package com.example.fitnesstracker.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.fitnesstracker.ui.viewmodel.DashboardViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DashboardScreen(viewModel: DashboardViewModel) {
    val backupState by viewModel.backupState.collectAsState()
    val todayDateString = "2026-07-15" // dynamically fetch via LocalDate.now()
    
    // Find today's log in our consolidated logs map
    val todayLog = backupState.logs.values.find { it.date == todayDateString }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier
                                .size(40.dp)
                                .background(Color(0xFF0F172A), RoundedCornerShape(12.dp)),
                            contentAlignment = Alignment.Center
                        ) {
                            Text("🏋️", fontSize = 20.sp)
                        }
                        Spacer(modifier = Modifier.width(12.dp))
                        Text(
                            text = "Fitness Tracker",
                            fontWeight = FontWeight.Black,
                            fontSize = 20.sp,
                            color = Color(0xFF0F172A)
                        )
                    }
                }
            )
        }
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .background(Color(0xFFF8FAFC))
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Dashboard Summary Card
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(
                        brush = Brush.linearGradient(
                            colors = listOf(Color(0xFF10B981), Color(0xFF6366F1))
                        ),
                        shape = RoundedCornerShape(24.dp)
                    )
                    .padding(24.dp)
            ) {
                Column {
                    Text("Consolidated Data", color = Color.White.copy(0.7f), fontWeight = FontWeight.Bold)
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = "Weight: ${todayLog?.weight ?: "Not logged"} kg",
                        color = Color.White,
                        fontWeight = FontWeight.ExtraBold,
                        fontSize = 24.sp
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                    Text("Goals: Caloric Target: ${backupState.goals.caloriesTarget} kcal", color = Color.White)
                    Text("Total logged entries: ${backupState.logs.size} days", color = Color.White)
                }
            }
        }
    }
}
```
