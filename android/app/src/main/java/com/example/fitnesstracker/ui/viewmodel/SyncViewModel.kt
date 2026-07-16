package com.example.fitnesstracker.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.fitnesstracker.data.local.LocalStorageManager
import com.example.fitnesstracker.data.remote.DriveServiceHelper
import com.example.fitnesstracker.data.repository.DriveSyncRepository
import com.example.fitnesstracker.data.repository.FitnessRepository
import com.example.fitnesstracker.data.model.Meal
import com.example.fitnesstracker.data.model.Workout
import com.example.fitnesstracker.data.model.WorkoutSet
import com.example.fitnesstracker.data.model.DailyLog
import com.example.fitnesstracker.data.model.Goal
import com.google.api.services.drive.Drive
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.UUID

data class GoogleUserProfile(
    val displayName: String? = null,
    val email: String? = null,
    val photoUrl: String? = null
)

class SyncViewModel(
    private val repository: FitnessRepository,
    private val syncRepository: DriveSyncRepository,
    private val localManager: LocalStorageManager
) : ViewModel() {

    private val _isGoogleAccountConnected = MutableStateFlow(false)
    val isGoogleAccountConnected: StateFlow<Boolean> = _isGoogleAccountConnected.asStateFlow()

    private val _googleUserProfile = MutableStateFlow<GoogleUserProfile?>(null)
    val googleUserProfile: StateFlow<GoogleUserProfile?> = _googleUserProfile.asStateFlow()

    private val _driveService = MutableStateFlow<Drive?>(null)
    val driveService: StateFlow<Drive?> = _driveService.asStateFlow()

    private val _syncFolderLocation = MutableStateFlow("MyFitnessTracker")
    val syncFolderLocation: StateFlow<String> = _syncFolderLocation.asStateFlow()

    private val _isSyncing = MutableStateFlow(false)
    val isSyncing: StateFlow<Boolean> = _isSyncing.asStateFlow()

    private val _syncMessage = MutableStateFlow("")
    val syncMessage: StateFlow<String> = _syncMessage.asStateFlow()

    private val _parsedFoods = MutableStateFlow<List<Meal>>(emptyList())
    val parsedFoods: StateFlow<List<Meal>> = _parsedFoods.asStateFlow()

    private val _parsedWorkouts = MutableStateFlow<List<Workout>>(emptyList())
    val parsedWorkouts: StateFlow<List<Workout>> = _parsedWorkouts.asStateFlow()

    private val _isSyncingFoods = MutableStateFlow(false)
    val isSyncingFoods: StateFlow<Boolean> = _isSyncingFoods.asStateFlow()

    private val _isSyncingWorkouts = MutableStateFlow(false)
    val isSyncingWorkouts: StateFlow<Boolean> = _isSyncingWorkouts.asStateFlow()

    // Expose repository's backupState
    val backupState: StateFlow<com.example.fitnesstracker.data.model.FitnessBackup> = repository.backupState

    fun setAccountConnected(connected: Boolean) {
        _isGoogleAccountConnected.value = connected
    }

    fun setSyncMessage(msg: String) {
        _syncMessage.value = msg
    }

    fun saveGoals(goal: Goal) {
        repository.updateGoals(goal)
    }

    fun setGoogleAccount(account: android.accounts.Account?, profile: GoogleUserProfile?, context: android.content.Context) {
        _googleUserProfile.value = profile
        if (account != null) {
            try {
                val credential = com.google.api.client.googleapis.extensions.android.gms.auth.GoogleAccountCredential.usingOAuth2(
                    context,
                    listOf(
                        "https://www.googleapis.com/auth/drive.file",
                        "https://www.googleapis.com/auth/documents.readonly"
                    )
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

    private fun extractDocId(input: String): String {
        val regex = """/document/d/([a-zA-Z0-9-_]+)""".toRegex()
        val match = regex.find(input)
        return match?.groupValues?.get(1) ?: input.trim()
    }

    private fun parseFoodsFromText(text: String): List<Meal> {
        val lines = text.split('\n')
        val meals = ArrayList<Meal>()
        
        lines.forEach { line ->
            val cleanLine = line.replace("""^[•\-\*\s\d\.\)]+""".toRegex(), "").trim()
            if (cleanLine.length < 3) return@forEach
            
            val lower = cleanLine.lowercase()
            if (lower.contains("food to eat") || lower.contains("nutrition plan") || lower.contains("week") || lower.contains("day") || lower.contains("phase")) {
                return@forEach
            }
            
            var protein = 0
            var calories = 0
            
            val proteinRegexes = listOf(
                """(\d+)\s*g\s*protein""".toRegex(RegexOption.IGNORE_CASE),
                """(\d+)\s*g\s*p\b""".toRegex(RegexOption.IGNORE_CASE),
                """protein\s*:\s*(\d+)\s*g""".toRegex(RegexOption.IGNORE_CASE),
                """(\d+)\s*protein""".toRegex(RegexOption.IGNORE_CASE)
            )
            
            for (regex in proteinRegexes) {
                val match = regex.find(cleanLine)
                if (match != null) {
                    protein = match.groupValues[1].toIntOrNull() ?: 0
                    break
                }
            }
            
            val calorieRegexes = listOf(
                """(\d+)\s*k?cal\b""".toRegex(RegexOption.IGNORE_CASE),
                """(\d+)\s*calories""".toRegex(RegexOption.IGNORE_CASE),
                """cal\w*\s*:\s*(\d+)""".toRegex(RegexOption.IGNORE_CASE)
            )
            
            for (regex in calorieRegexes) {
                val match = regex.find(cleanLine)
                if (match != null) {
                    calories = match.groupValues[1].toIntOrNull() ?: 0
                    break
                }
            }
            
            if (protein > 0 || calories > 0) {
                var name = cleanLine.split("-", ":", "|")[0]
                    .replace("""\(\s*\d+\s*[a-zA-Z]*\s*\)""".toRegex(), "")
                    .trim()
                if (name.length > 50) {
                    name = name.take(47) + "..."
                }
                meals.add(
                    Meal(
                        id = "meal_" + java.util.UUID.randomUUID().toString().take(8),
                        name = if (name.isNotBlank()) name else "Parsed Food Item",
                        protein = protein,
                        calories = calories,
                        timestamp = java.text.SimpleDateFormat("HH:mm", java.util.Locale.getDefault()).format(java.util.Date())
                    )
                )
            }
        }
        return meals
    }

    private fun parseWorkoutsFromText(text: String): List<Workout> {
        val lines = text.split('\n')
        val workouts = ArrayList<Workout>()
        var currentCategory = "Other"
        
        lines.forEach { line ->
            val trimmed = line.trim()
            if (trimmed.isEmpty()) return@forEach
            
            val lower = trimmed.lowercase()
            if (lower.contains("chest") || lower.contains("push")) {
                currentCategory = "Chest"
            } else if (lower.contains("back") || lower.contains("pull")) {
                currentCategory = "Back"
            } else if (lower.contains("leg") || lower.contains("quad") || lower.contains("hamstring")) {
                currentCategory = "Legs"
            } else if (lower.contains("shoulder") || lower.contains("arm") || lower.contains("bicep") || lower.contains("tricep") || lower.contains("delts")) {
                currentCategory = "Arms/Shoulders"
            }
            
            if (trimmed.startsWith("#") || lower.startsWith("workout") || lower.startsWith("phase") || trimmed.length < 5) {
                return@forEach
            }
            
            var sets = 3
            var reps = 10
            var weight = 135.0
            
            val setsRepsMatch = """(\d+)\s*sets?\s*(?:x|of)\s*(\d+)""".toRegex(RegexOption.IGNORE_CASE).find(trimmed)
                ?: """(\d+)\s*x\s*(\d+)""".toRegex(RegexOption.IGNORE_CASE).find(trimmed)
                
            if (setsRepsMatch != null) {
                sets = setsRepsMatch.groupValues[1].toIntOrNull() ?: 3
                reps = setsRepsMatch.groupValues[2].toIntOrNull() ?: 10
            }
            
            if (lower.contains("press") || lower.contains("squat") || lower.contains("deadlift")) {
                weight = 135.0
            } else if (lower.contains("curl") || lower.contains("lateral") || lower.contains("extension") || lower.contains("raise")) {
                weight = 25.0
            } else {
                weight = 45.0
            }
            
            var name = trimmed.split("-", ":", "|")[0]
                .replace("""^[•\-\*\s\d\.\)]+""".toRegex(), "")
                .replace("""\(\s*\d+\s*sets?.*\)(?i)""".toRegex(), "")
                .trim()
                
            if (name.isNotEmpty() && name.length >= 3 && !lower.contains("goal") && !lower.contains("track") && !lower.contains("rest")) {
                if (name.length > 50) {
                    name = name.take(47) + "..."
                }
                
                val setsArray = List(sets) { i ->
                    WorkoutSet(
                        id = "set-${System.currentTimeMillis()}-$i-${(0..999).random()}",
                        reps = reps,
                        weight = weight,
                        completed = false
                    )
                }
                
                workouts.add(
                    Workout(
                        id = "workout_" + java.util.UUID.randomUUID().toString().take(8),
                        name = name,
                        category = currentCategory,
                        sets = setsArray,
                        completed = false
                    )
                )
            }
        }
        return workouts
    }

    fun syncFoodsFromDoc(docId: String) {
        val service = _driveService.value
        if (service == null) {
            _syncMessage.value = "Google Account not connected!"
            return
        }
        val cleanId = extractDocId(docId)
        if (cleanId.isBlank()) {
            _syncMessage.value = "Please enter a valid Google Doc ID/URL"
            return
        }

        viewModelScope.launch {
            _isSyncingFoods.value = true
            _syncMessage.value = "Fetching foods document..."
            try {
                val inputStream = service.files().export(cleanId, "text/plain").executeMediaAsInputStream()
                val text = inputStream.bufferedReader().use { it.readText() }
                
                val foods = parseFoodsFromText(text)
                _parsedFoods.value = foods
                _syncMessage.value = "Successfully loaded ${foods.size} muscle food options from your Google Doc!"
            } catch (e: Exception) {
                _syncMessage.value = "Failed to load document: ${e.localizedMessage}"
            } finally {
                _isSyncingFoods.value = false
            }
        }
    }

    fun syncWorkoutsFromDoc(docId: String) {
        val service = _driveService.value
        if (service == null) {
            _syncMessage.value = "Google Account not connected!"
            return
        }
        val cleanId = extractDocId(docId)
        if (cleanId.isBlank()) {
            _syncMessage.value = "Please enter a valid Google Doc ID/URL"
            return
        }

        viewModelScope.launch {
            _isSyncingWorkouts.value = true
            _syncMessage.value = "Fetching workouts document..."
            try {
                val inputStream = service.files().export(cleanId, "text/plain").executeMediaAsInputStream()
                val text = inputStream.bufferedReader().use { it.readText() }
                
                val workouts = parseWorkoutsFromText(text)
                _parsedWorkouts.value = workouts
                _syncMessage.value = "Successfully extracted ${workouts.size} hypertrophy routines!"
            } catch (e: Exception) {
                _syncMessage.value = "Failed to load document: ${e.localizedMessage}"
            } finally {
                _isSyncingWorkouts.value = false
            }
        }
    }

    fun logParsedMeal(meal: Meal) {
        viewModelScope.launch {
            val currentBackup = repository.backupState.value
            val todayDate = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US).format(java.util.Date())
            val todayLog = currentBackup.logs.values.find { it.date == todayDate }
                ?: DailyLog(
                    id = repository.generateUniqueId(),
                    date = todayDate
                )
            
            val updatedMeals = todayLog.meals.toMutableList().apply { add(meal) }
            val updatedLog = todayLog.copy(meals = updatedMeals)
            repository.saveDailyLog(updatedLog)
            _syncMessage.value = "Added '${meal.name}' to today's fuel log!"
        }
    }

    fun logParsedWorkout(workout: Workout) {
        viewModelScope.launch {
            val currentBackup = repository.backupState.value
            val todayDate = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US).format(java.util.Date())
            val todayLog = currentBackup.logs.values.find { it.date == todayDate }
                ?: DailyLog(
                    id = repository.generateUniqueId(),
                    date = todayDate
                )
            
            val updatedWorkouts = todayLog.workouts.toMutableList().apply { add(workout) }
            val updatedLog = todayLog.copy(workouts = updatedWorkouts)
            repository.saveDailyLog(updatedLog)
            _syncMessage.value = "Added '${workout.name}' to today's lifts log!"
        }
    }
}
