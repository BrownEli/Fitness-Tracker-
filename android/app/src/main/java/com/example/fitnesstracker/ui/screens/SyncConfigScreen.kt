package com.example.fitnesstracker.ui.screens

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.fitnesstracker.ui.theme.*
import com.example.fitnesstracker.ui.viewmodel.SyncViewModel
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.auth.api.signin.GoogleSignInOptions
import com.google.android.gms.common.api.Scope

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SyncConfigScreen(viewModel: SyncViewModel) {
    val context = LocalContext.current
    val isConnected by viewModel.isGoogleAccountConnected.collectAsState()
    val syncFolder by viewModel.syncFolderLocation.collectAsState()
    val isSyncing by viewModel.isSyncing.collectAsState()
    val syncMessage by viewModel.syncMessage.collectAsState()
    val profile by viewModel.googleUserProfile.collectAsState()
    val backupState by viewModel.backupState.collectAsState()
    val goals = backupState.goals

    var folderInput by remember { mutableStateOf(syncFolder) }
    var foodsDocInput by remember(goals.foodsDocId) { mutableStateOf(goals.foodsDocId) }
    var workoutsDocInput by remember(goals.workoutsDocId) { mutableStateOf(goals.workoutsDocId) }

    val parsedFoods by viewModel.parsedFoods.collectAsState()
    val parsedWorkouts by viewModel.parsedWorkouts.collectAsState()
    val isSyncingFoods by viewModel.isSyncingFoods.collectAsState()
    val isSyncingWorkouts by viewModel.isSyncingWorkouts.collectAsState()

    // Google Sign-In options with requested cloud drive & documents scopes
    val gso = remember {
        GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
            .requestEmail()
            .requestScopes(
                Scope("https://www.googleapis.com/auth/drive.file"),
                Scope("https://www.googleapis.com/auth/documents.readonly")
            )
            .build()
    }
    val googleSignInClient = remember { GoogleSignIn.getClient(context, gso) }

    // Activity launcher for Sign In Flow
    val signInLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.StartActivityForResult()
    ) { result ->
        val task = GoogleSignIn.getSignedInAccountFromIntent(result.data)
        try {
            val account = task.getResult(com.google.android.gms.common.api.ApiException::class.java)
            if (account != null) {
                val userProfile = com.example.fitnesstracker.ui.viewmodel.GoogleUserProfile(
                    displayName = account.displayName,
                    email = account.email,
                    photoUrl = account.photoUrl?.toString()
                )
                viewModel.setGoogleAccount(account.account, userProfile, context)
            } else {
                viewModel.setSyncMessage("Sign in canceled or returned no account.")
            }
        } catch (e: com.google.android.gms.common.api.ApiException) {
            viewModel.setSyncMessage("Google Sign In failed (Status ${e.statusCode}). Check console & SHA-1 signature.")
        } catch (e: Exception) {
            viewModel.setSyncMessage("Sign In error: ${e.localizedMessage}")
        }
    }

    // Auto check if account is already connected
    LaunchedEffect(Unit) {
        val lastAccount = GoogleSignIn.getLastSignedInAccount(context)
        if (lastAccount != null) {
            val userProfile = com.example.fitnesstracker.ui.viewmodel.GoogleUserProfile(
                displayName = lastAccount.displayName,
                email = lastAccount.email,
                photoUrl = lastAccount.photoUrl?.toString()
            )
            viewModel.setGoogleAccount(lastAccount.account, userProfile, context)
        }
    }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // 1. Google Drive & Docs Sync Hub Header Card
        item {
            Card(
                colors = CardDefaults.cardColors(containerColor = Slate900),
                shape = RoundedCornerShape(24.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(20.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text(
                        text = "WORKSPACE HUB",
                        color = Indigo500,
                        fontWeight = FontWeight.Black,
                        fontSize = 10.sp,
                        letterSpacing = 0.5.sp
                    )
                    Text(
                        text = "Google Drive & Docs Sync",
                        color = Color.White,
                        fontWeight = FontWeight.Black,
                        fontSize = 20.sp
                    )
                    Text(
                        text = "Unlock maximum hypertrophy progression by integrating Google Workspace. Automate backups directly to your personal Google Drive and import custom nutrition strategies or workout routines directly from your Google Docs!",
                        color = Color.White.copy(alpha = 0.7f),
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Medium,
                        lineHeight = 16.sp,
                        modifier = Modifier.padding(top = 4.dp)
                    )
                }
            }
        }

        // 2. Connection Status Card
        item {
            Card(
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                shape = RoundedCornerShape(20.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "GOOGLE CLOUD SYNC",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Black,
                            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f),
                            letterSpacing = 0.5.sp
                        )

                        // Online / Offline Status Badge
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(8.dp))
                                .background(if (isConnected) Emerald500.copy(alpha = 0.12f) else Coral500.copy(alpha = 0.12f))
                                .padding(horizontal = 8.dp, vertical = 4.dp)
                        ) {
                            Text(
                                text = if (isConnected) "ONLINE" else "OFFLINE",
                                color = if (isConnected) Emerald600 else Coral500,
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Black
                            )
                        }
                    }

                    Text(
                        text = "Keep your muscle history synchronized and safe.",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f)
                    )

                    if (isConnected && profile != null) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(12.dp),
                            modifier = Modifier
                                .fillMaxWidth()
                                .background(Slate100, shape = RoundedCornerShape(12.dp))
                                .padding(12.dp)
                        ) {
                            Box(
                                contentAlignment = Alignment.Center,
                                modifier = Modifier
                                    .size(40.dp)
                                    .background(Indigo500, shape = CircleShape)
                            ) {
                                Text(
                                    text = profile?.displayName?.take(1)?.uppercase() ?: "U",
                                    color = Color.White,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 16.sp
                                )
                            }
                            Column {
                                Text(
                                    text = profile?.displayName ?: "Authorized User",
                                    fontWeight = FontWeight.Bold,
                                    color = Slate900,
                                    fontSize = 13.sp
                                )
                                Text(
                                    text = profile?.email ?: "Active Google Sync Session",
                                    fontSize = 11.sp,
                                    color = Slate700
                                )
                            }
                        }
                    }

                    // Big screen-width connection button
                    Button(
                        onClick = {
                            if (isConnected) {
                                googleSignInClient.signOut().addOnCompleteListener {
                                    viewModel.setGoogleAccount(null, null, context)
                                }
                            } else {
                                val signInIntent = googleSignInClient.signInIntent
                                signInLauncher.launch(signInIntent)
                            }
                        },
                        colors = ButtonDefaults.buttonColors(
                            containerColor = if (isConnected) Coral500 else Indigo500
                        ),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(48.dp)
                            .pressClickEffect()
                    ) {
                        Text(
                            text = if (isConnected) "Disconnect Google Account" else "Connect Google Account",
                            fontWeight = FontWeight.Bold,
                            fontSize = 14.sp
                        )
                    }
                }
            }
        }

        // 3. Workspace Links & Folder Configurations Card
        item {
            Card(
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                shape = RoundedCornerShape(20.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Text(
                        text = "WORKSPACE HUB PATHS",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Black,
                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f),
                        letterSpacing = 0.5.sp
                    )

                    OutlinedTextField(
                        value = folderInput,
                        onValueChange = { folderInput = it },
                        label = { Text("Google Drive Backup Folder") },
                        placeholder = { Text("MyFitnessTracker") },
                        modifier = Modifier.fillMaxWidth(),
                        colors = TextFieldDefaults.outlinedTextFieldColors(focusedBorderColor = Indigo500)
                    )

                    OutlinedTextField(
                        value = foodsDocInput,
                        onValueChange = { foodsDocInput = it },
                        label = { Text("Foods To Eat Google Doc Link or ID") },
                        placeholder = { Text("Enter Google Doc URL or ID") },
                        modifier = Modifier.fillMaxWidth(),
                        colors = TextFieldDefaults.outlinedTextFieldColors(focusedBorderColor = Emerald500)
                    )

                    OutlinedTextField(
                        value = workoutsDocInput,
                        onValueChange = { workoutsDocInput = it },
                        label = { Text("Workout Plans Google Doc Link or ID") },
                        placeholder = { Text("Enter Google Doc URL or ID") },
                        modifier = Modifier.fillMaxWidth(),
                        colors = TextFieldDefaults.outlinedTextFieldColors(focusedBorderColor = Gold500)
                    )

                    Button(
                        onClick = {
                            viewModel.updateFolderLocation(folderInput)
                            val updatedGoal = goals.copy(
                                foodsDocId = foodsDocInput.trim(),
                                workoutsDocId = workoutsDocInput.trim()
                            )
                            viewModel.saveGoals(updatedGoal)
                            viewModel.setSyncMessage("Workspace link preferences saved successfully!")
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = Slate900),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(48.dp)
                            .pressClickEffect()
                    ) {
                        Text("Save Workspace Configuration", fontWeight = FontWeight.Bold, fontSize = 13.sp)
                    }
                }
            }
        }

        // 4. Synchronize Records Card (Visible only when connected)
        item {
            AnimatedVisibility(visible = isConnected) {
                Card(
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    shape = RoundedCornerShape(20.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(
                        modifier = Modifier.padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Text(
                            text = "CLOUD DATABASE BACKUP",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Black,
                            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f),
                            letterSpacing = 0.5.sp
                        )

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            Button(
                                onClick = { viewModel.triggerManualBackup() },
                                colors = ButtonDefaults.buttonColors(containerColor = Emerald500),
                                shape = RoundedCornerShape(12.dp),
                                enabled = !isSyncing,
                                modifier = Modifier
                                    .weight(1f)
                                    .height(48.dp)
                                    .pressClickEffect()
                            ) {
                                Text("Backup now", fontWeight = FontWeight.Black, fontSize = 13.sp)
                            }

                            Button(
                                onClick = { viewModel.triggerManualRestore() },
                                colors = ButtonDefaults.buttonColors(containerColor = Indigo500),
                                shape = RoundedCornerShape(12.dp),
                                enabled = !isSyncing,
                                modifier = Modifier
                                    .weight(1f)
                                    .height(48.dp)
                                    .pressClickEffect()
                            ) {
                                Text("Restore now", fontWeight = FontWeight.Black, fontSize = 13.sp)
                            }
                        }

                        if (isSyncing) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(10.dp),
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(top = 4.dp)
                            ) {
                                CircularProgressIndicator(color = Emerald500, modifier = Modifier.size(18.dp))
                                Text(
                                    text = "Executing cloud procedures...",
                                    fontSize = 12.sp,
                                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
                                )
                            }
                        }
                    }
                }
            }
        }

        // 4.5. Dynamic Google Docs Parsing & Logging Tools Card (Visible only when connected)
        item {
            AnimatedVisibility(visible = isConnected) {
                Card(
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    shape = RoundedCornerShape(24.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(
                        modifier = Modifier.padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        Text(
                            text = "GOOGLE DOCS IMPORT & LOGGING",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Black,
                            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f),
                            letterSpacing = 0.5.sp
                        )

                        // --- Part A: Foods Doc Sync ---
                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = "🥗 Muscle-Building Foods Doc",
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 14.sp,
                                    color = MaterialTheme.colorScheme.onSurface
                                )
                                Button(
                                    onClick = { viewModel.syncFoodsFromDoc(goals.foodsDocId) },
                                    colors = ButtonDefaults.buttonColors(containerColor = Emerald500),
                                    shape = RoundedCornerShape(10.dp),
                                    enabled = !isSyncingFoods && goals.foodsDocId.isNotBlank(),
                                    contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp)
                                ) {
                                    if (isSyncingFoods) {
                                        CircularProgressIndicator(color = Color.White, modifier = Modifier.size(14.dp))
                                    } else {
                                        Text("Import Foods", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                                    }
                                }
                            }

                            if (parsedFoods.isEmpty()) {
                                Text(
                                    text = "No imported foods loaded yet. Set a Foods Google Doc ID and click Import.",
                                    fontSize = 11.sp,
                                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f)
                                )
                            } else {
                                Card(
                                    colors = CardDefaults.cardColors(containerColor = Slate50),
                                    shape = RoundedCornerShape(12.dp),
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Column(
                                        modifier = Modifier.padding(8.dp),
                                        verticalArrangement = Arrangement.spacedBy(6.dp)
                                    ) {
                                        parsedFoods.take(5).forEach { meal ->
                                            Row(
                                                modifier = Modifier
                                                    .fillMaxWidth()
                                                    .background(Color.White, shape = RoundedCornerShape(8.dp))
                                                    .padding(8.dp),
                                                horizontalArrangement = Arrangement.SpaceBetween,
                                                verticalAlignment = Alignment.CenterVertically
                                            ) {
                                                Column(modifier = Modifier.weight(1f)) {
                                                    Text(meal.name, fontWeight = FontWeight.Bold, fontSize = 12.sp, color = Slate900)
                                                    Text("${meal.protein}g Protein • ${meal.calories} kcal", fontSize = 10.sp, color = Slate500, fontWeight = FontWeight.Bold)
                                                }
                                                Button(
                                                    onClick = { viewModel.logParsedMeal(meal) },
                                                    colors = ButtonDefaults.buttonColors(containerColor = Emerald500),
                                                    shape = RoundedCornerShape(8.dp),
                                                    contentPadding = PaddingValues(horizontal = 8.dp, vertical = 4.dp),
                                                    modifier = Modifier.height(28.dp)
                                                ) {
                                                    Text("Eat & Log", fontSize = 10.sp, fontWeight = FontWeight.Bold)
                                                }
                                            }
                                        }
                                        if (parsedFoods.size > 5) {
                                            Text(
                                                text = "And ${parsedFoods.size - 5} more items parsed...",
                                                fontSize = 10.sp,
                                                fontWeight = FontWeight.Bold,
                                                color = Slate500,
                                                modifier = Modifier.padding(start = 4.dp)
                                            )
                                        }
                                    }
                                }
                            }
                        }

                        Divider(color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.08f), thickness = 1.dp)

                        // --- Part B: Workouts Doc Sync ---
                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = "💪 Hypertrophy Routines Doc",
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 14.sp,
                                    color = MaterialTheme.colorScheme.onSurface
                                )
                                Button(
                                    onClick = { viewModel.syncWorkoutsFromDoc(goals.workoutsDocId) },
                                    colors = ButtonDefaults.buttonColors(containerColor = Gold500),
                                    shape = RoundedCornerShape(10.dp),
                                    enabled = !isSyncingWorkouts && goals.workoutsDocId.isNotBlank(),
                                    contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp)
                                ) {
                                    if (isSyncingWorkouts) {
                                        CircularProgressIndicator(color = Color.White, modifier = Modifier.size(14.dp))
                                    } else {
                                        Text("Import Workouts", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                                    }
                                }
                            }

                            if (parsedWorkouts.isEmpty()) {
                                Text(
                                    text = "No imported workouts loaded yet. Set a Workouts Google Doc ID and click Import.",
                                    fontSize = 11.sp,
                                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f)
                                )
                            } else {
                                Card(
                                    colors = CardDefaults.cardColors(containerColor = Slate50),
                                    shape = RoundedCornerShape(12.dp),
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Column(
                                        modifier = Modifier.padding(8.dp),
                                        verticalArrangement = Arrangement.spacedBy(6.dp)
                                    ) {
                                        parsedWorkouts.take(5).forEach { workout ->
                                            Row(
                                                modifier = Modifier
                                                    .fillMaxWidth()
                                                    .background(Color.White, shape = RoundedCornerShape(8.dp))
                                                    .padding(8.dp),
                                                horizontalArrangement = Arrangement.SpaceBetween,
                                                verticalAlignment = Alignment.CenterVertically
                                            ) {
                                                Column(modifier = Modifier.weight(1f)) {
                                                    Text(workout.name, fontWeight = FontWeight.Bold, fontSize = 12.sp, color = Slate900)
                                                    Text("${workout.category} • ${workout.sets.size} sets", fontSize = 10.sp, color = Slate500, fontWeight = FontWeight.Bold)
                                                }
                                                Button(
                                                    onClick = { viewModel.logParsedWorkout(workout) },
                                                    colors = ButtonDefaults.buttonColors(containerColor = Gold500),
                                                    shape = RoundedCornerShape(8.dp),
                                                    contentPadding = PaddingValues(horizontal = 8.dp, vertical = 4.dp),
                                                    modifier = Modifier.height(28.dp)
                                                ) {
                                                    Text("Log Exercise", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = Color.White)
                                                }
                                            }
                                        }
                                        if (parsedWorkouts.size > 5) {
                                            Text(
                                                text = "And ${parsedWorkouts.size - 5} more workouts parsed...",
                                                fontSize = 10.sp,
                                                fontWeight = FontWeight.Bold,
                                                color = Slate500,
                                                modifier = Modifier.padding(start = 4.dp)
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // 4.8. Dynamic Sync Global Status Bar (Always at bottom)
        item {
            if (syncMessage.isNotBlank()) {
                Card(
                    colors = CardDefaults.cardColors(containerColor = Indigo50),
                    shape = RoundedCornerShape(14.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier.padding(14.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Text("📡", fontSize = 16.sp)
                        Text(
                            text = syncMessage,
                            color = Indigo700,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            lineHeight = 16.sp,
                            modifier = Modifier.weight(1f)
                        )
                    }
                }
            }
        }

        // 5. Setup & Verification Instructions Card (At bottom)
        item {
            Card(
                colors = CardDefaults.cardColors(containerColor = Color(0xFFFEF3C7)),
                shape = RoundedCornerShape(16.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Text(
                        text = "⚙️ Developer Setup Notice",
                        fontWeight = FontWeight.Black,
                        fontSize = 13.sp,
                        color = Color(0xFF92400E)
                    )
                    Text(
                        text = "To enable Google Drive integration for your local build, make sure to add your signing key's SHA-1 certificate fingerprint and Android package name (com.example.fitnesstracker) to your project in the Google Cloud Console or Firebase console, and register the drive.file scope in your OAuth Consent screen. This guarantees secure, sandboxed cloud storage for your fitness records.",
                        fontSize = 11.sp,
                        color = Color(0xFFB45309),
                        fontWeight = FontWeight.Bold,
                        lineHeight = 15.sp
                    )
                }
            }
        }
    }
}
