package com.example.fitnesstracker.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.fitnesstracker.ui.theme.*
import com.example.fitnesstracker.ui.viewmodel.DashboardViewModel
import com.example.fitnesstracker.ui.viewmodel.LogViewModel
import com.example.fitnesstracker.ui.viewmodel.SyncViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MainScreen(
    dashboardViewModel: DashboardViewModel,
    logViewModel: LogViewModel,
    syncViewModel: SyncViewModel
) {
    var selectedScreenIndex by remember { mutableIntStateOf(0) }
    val screens = listOf("Dashboard", "Log Entries", "Sync Settings")

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = androidx.compose.ui.Alignment.CenterVertically
                    ) {
                        // Branded Rounded Logo Box
                        Box(
                            modifier = Modifier
                                .size(40.dp)
                                .clip(RoundedCornerShape(12.dp))
                                .background(Slate900),
                            contentAlignment = androidx.compose.ui.Alignment.Center
                        ) {
                            Text(
                                text = "⚡",
                                fontSize = 20.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color.White
                            )
                        }
                        Spacer(modifier = Modifier.width(12.dp))
                        Column {
                            Text(
                                text = "Fitness Tracker",
                                fontWeight = FontWeight.Black,
                                fontSize = 19.sp,
                                color = MaterialTheme.colorScheme.onSurface
                            )
                            Text(
                                text = "SIMPLE PERSONAL PROGRESSION & NUTRITION",
                                fontWeight = FontWeight.SemiBold,
                                fontSize = 8.sp,
                                color = Indigo500,
                                letterSpacing = 0.5.sp
                            )
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.surface)
            )
        },
        bottomBar = {
            NavigationBar(
                containerColor = MaterialTheme.colorScheme.surface,
                contentColor = MaterialTheme.colorScheme.primary
            ) {
                screens.forEachIndexed { index, name ->
                    NavigationBarItem(
                        selected = selectedScreenIndex == index,
                        onClick = { selectedScreenIndex = index },
                        label = { Text(name, fontWeight = FontWeight.Bold) },
                        icon = {
                            Text(
                                text = when (index) {
                                    0 -> "📊"
                                    1 -> "📝"
                                    else -> "☁️"
                                },
                                fontSize = 20.sp
                            )
                        },
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor = MaterialTheme.colorScheme.primary,
                            selectedTextColor = MaterialTheme.colorScheme.primary,
                            indicatorColor = MaterialTheme.colorScheme.primary.copy(alpha = 0.15f),
                            unselectedTextColor = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
                        ),
                        modifier = Modifier.pressClickEffect()
                    )
                }
            }
        }
    ) { innerPadding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            when (selectedScreenIndex) {
                0 -> DashboardScreen(dashboardViewModel)
                1 -> LogScreen(logViewModel)
                2 -> SyncConfigScreen(syncViewModel)
            }
        }
    }
}
