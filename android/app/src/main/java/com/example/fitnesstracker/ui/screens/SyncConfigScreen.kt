package com.example.fitnesstracker.ui.screens

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
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

    var folderInput by remember { mutableStateOf(syncFolder) }

    // Set up standard Google Sign-In options with requested cloud drive scopes
    val gso = remember {
        GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
            .requestEmail()
            .requestScopes(Scope("https://www.googleapis.com/auth/drive.file"))
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
                viewModel.setGoogleAccount(account.account, context)
            } else {
                viewModel.setGoogleAccount(null, context)
            }
        } catch (e: Exception) {
            viewModel.setGoogleAccount(null, context)
        }
    }

    // Auto check if account is already connected
    LaunchedEffect(Unit) {
        val lastAccount = GoogleSignIn.getLastSignedInAccount(context)
        if (lastAccount != null) {
            viewModel.setGoogleAccount(lastAccount.account, context)
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Sign-in Status Card
        Card(
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
            shape = RoundedCornerShape(20.dp),
            modifier = Modifier.fillMaxWidth().pressClickEffect()
        ) {
            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("Google Drive Connection Status", fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurface)
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier
                                .size(12.dp)
                                .background(if (isConnected) Emerald500 else Coral500, RoundedCornerShape(6.dp))
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = if (isConnected) "Connected" else "Disconnected",
                            color = MaterialTheme.colorScheme.onSurface,
                            fontWeight = FontWeight.Bold,
                            fontSize = 15.sp
                        )
                    }
                    Button(
                        onClick = {
                            if (isConnected) {
                                googleSignInClient.signOut().addOnCompleteListener {
                                    viewModel.setGoogleAccount(null, context)
                                }
                            } else {
                                val signInIntent = googleSignInClient.signInIntent
                                signInLauncher.launch(signInIntent)
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = if (isConnected) Coral500 else Emerald500),
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier.pressClickEffect()
                    ) {
                        Text(if (isConnected) "Sign Out" else "Connect Google Drive")
                    }
                }
            }
        }

        // Folder Location Target Configuration
        Card(
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
            shape = RoundedCornerShape(20.dp),
            modifier = Modifier.fillMaxWidth().pressClickEffect()
        ) {
            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("Remote Sync Target Folder", fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurface)
                OutlinedTextField(
                    value = folderInput,
                    onValueChange = { folderInput = it },
                    label = { Text("Google Drive Folder Path") },
                    placeholder = { Text("MyFitnessTracker") },
                    modifier = Modifier.fillMaxWidth()
                )
                Button(
                    onClick = { viewModel.updateFolderLocation(folderInput) },
                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary),
                    modifier = Modifier.fillMaxWidth().pressClickEffect(),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Text("Apply Path Location", fontWeight = FontWeight.Bold)
                }
            }
        }

        // Action Trigger Buttons (Sync & Restore)
        AnimatedVisibility(visible = isConnected) {
            Card(
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                shape = RoundedCornerShape(20.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text("Synchronize Records", fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurface)
                    
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Button(
                            onClick = { viewModel.triggerManualBackup() },
                            colors = ButtonDefaults.buttonColors(containerColor = Emerald500),
                            modifier = Modifier.weight(1f).pressClickEffect(),
                            shape = RoundedCornerShape(12.dp),
                            enabled = !isSyncing
                        ) {
                            Text("Backup to Drive", fontWeight = FontWeight.Bold)
                        }

                        Button(
                            onClick = { viewModel.triggerManualRestore() },
                            colors = ButtonDefaults.buttonColors(containerColor = Indigo500),
                            modifier = Modifier.weight(1f).pressClickEffect(),
                            shape = RoundedCornerShape(12.dp),
                            enabled = !isSyncing
                        ) {
                            Text("Restore from Drive", fontWeight = FontWeight.Bold)
                        }
                    }

                    if (isSyncing) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(12.dp),
                            modifier = Modifier.fillMaxWidth().padding(top = 8.dp)
                        ) {
                            CircularProgressIndicator(color = Emerald500, modifier = Modifier.size(24.dp))
                            Text("Executing cloud procedures...", fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f))
                        }
                    }

                    if (syncMessage.isNotBlank()) {
                        Text(
                            text = syncMessage,
                            color = MaterialTheme.colorScheme.onSurface,
                            fontWeight = FontWeight.Bold,
                            fontSize = 13.sp,
                            modifier = Modifier.padding(top = 4.dp)
                        )
                    }
                }
            }
        }
    }
}
