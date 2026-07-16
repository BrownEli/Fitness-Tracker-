package com.example.fitnesstracker.ui.screens

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
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

    var folderInput by remember { mutableStateOf(syncFolder) }

    // Google Sign-In options with requested cloud drive scopes
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

                    // Big screen-width connection button
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

        // 3. Remote Folder Configuration Card
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
                        text = "TARGET SYNC LOCATION",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Black,
                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f),
                        letterSpacing = 0.5.sp
                    )

                    OutlinedTextField(
                        value = folderInput,
                        onValueChange = { folderInput = it },
                        label = { Text("Google Drive Folder") },
                        placeholder = { Text("MyFitnessTracker") },
                        modifier = Modifier.fillMaxWidth(),
                        colors = TextFieldDefaults.outlinedTextFieldColors(focusedIndicatorColor = Indigo500)
                    )

                    Button(
                        onClick = { viewModel.updateFolderLocation(folderInput) },
                        colors = ButtonDefaults.buttonColors(containerColor = Slate900),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(46.dp)
                            .pressClickEffect()
                    ) {
                        Text("Apply Path Location", fontWeight = FontWeight.Bold, fontSize = 13.sp)
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
                            text = "SYNCHRONIZE RECORDS",
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

                        if (syncMessage.isNotBlank()) {
                            Text(
                                text = syncMessage,
                                color = Indigo500,
                                fontWeight = FontWeight.Bold,
                                fontSize = 12.sp,
                                modifier = Modifier.padding(top = 4.dp)
                            )
                        }
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
