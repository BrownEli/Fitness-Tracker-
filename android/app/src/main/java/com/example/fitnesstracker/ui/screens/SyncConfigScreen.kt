package com.example.fitnesstracker.ui.screens

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.fitnesstracker.ui.theme.*
import com.example.fitnesstracker.ui.viewmodel.SyncViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SyncConfigScreen(viewModel: SyncViewModel) {
    val isConnected by viewModel.isGoogleAccountConnected.collectAsState()
    val syncFolder by viewModel.syncFolderLocation.collectAsState()
    val isSyncing by viewModel.isSyncing.collectAsState()
    val syncMessage by viewModel.syncMessage.collectAsState()

    var folderInput by remember { mutableStateOf(syncFolder) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Slate50)
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Sign-in Status Card
        Card(
            colors = CardDefaults.cardColors(containerColor = Color.White),
            shape = RoundedCornerShape(20.dp),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("Google Drive Connection Status", fontWeight = FontWeight.Bold, color = Slate900)
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
                            color = Slate900,
                            fontWeight = FontWeight.Bold,
                            fontSize = 15.sp
                        )
                    }
                    Button(
                        onClick = { viewModel.setAccountConnected(!isConnected) },
                        colors = ButtonDefaults.buttonColors(containerColor = if (isConnected) Coral500 else Emerald500),
                        shape = RoundedCornerShape(10.dp)
                    ) {
                        Text(if (isConnected) "Sign Out" else "Connect Google Drive")
                    }
                }
            }
        }

        // Folder Location Target Configuration
        Card(
            colors = CardDefaults.cardColors(containerColor = Color.White),
            shape = RoundedCornerShape(20.dp),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("Remote Sync Target Folder", fontWeight = FontWeight.Bold, color = Slate900)
                OutlinedTextField(
                    value = folderInput,
                    onValueChange = { folderInput = it },
                    label = { Text("Google Drive Folder Path") },
                    placeholder = { Text("MyFitnessTracker") },
                    modifier = Modifier.fillMaxWidth()
                )
                Button(
                    onClick = { viewModel.updateFolderLocation(folderInput) },
                    colors = ButtonDefaults.buttonColors(containerColor = Slate900),
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Text("Apply Path Location", fontWeight = FontWeight.Bold)
                }
            }
        }

        // Action Trigger Buttons (Sync & Restore)
        AnimatedVisibility(visible = isConnected) {
            Card(
                colors = CardDefaults.cardColors(containerColor = Color.White),
                shape = RoundedCornerShape(20.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text("Synchronize Records", fontWeight = FontWeight.Bold, color = Slate900)
                    
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Button(
                            onClick = { viewModel.triggerManualBackup(null) /* Pass actual authorized Drive service object */ },
                            colors = ButtonDefaults.buttonColors(containerColor = Emerald500),
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(12.dp),
                            enabled = !isSyncing
                        ) {
                            Text("Backup to Drive", fontWeight = FontWeight.Bold)
                        }

                        Button(
                            onClick = { viewModel.triggerManualRestore(null) /* Pass actual authorized Drive service object */ },
                            colors = ButtonDefaults.buttonColors(containerColor = Indigo500),
                            modifier = Modifier.weight(1f),
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
                            Text("Executing cloud procedures...", fontSize = 13.sp, color = Slate700)
                        }
                    }

                    if (syncMessage.isNotBlank()) {
                        Text(
                            text = syncMessage,
                            color = Slate900,
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
