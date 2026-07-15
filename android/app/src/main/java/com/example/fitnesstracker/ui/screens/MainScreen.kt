package com.example.fitnesstracker.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
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
                        Box(
                            modifier = androidx.compose.foundation.layout.size(36.dp)
                                .background(Slate900, RoundedCornerShape(10.dp)),
                            contentAlignment = androidx.compose.ui.Alignment.Center
                        ) {
                            Text("🏋️", fontSize = 18.sp)
                        }
                        Spacer(modifier = Modifier.width(10.dp))
                        Text(
                            text = "My Fitness companion",
                            fontWeight = FontWeight.ExtraBold,
                            fontSize = 18.sp,
                            color = Slate900
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Color.White)
            )
        },
        bottomBar = {
            NavigationBar(
                containerColor = Color.White,
                contentColor = Emerald600
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
                            selectedIconColor = Emerald600,
                            selectedTextColor = Emerald600,
                            indicatorColor = Emerald50.copy(alpha = 0.5f),
                            unselectedTextColor = Slate700
                        )
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

// Background utility matching composable rules
@Composable
fun Modifier.background(color: Color, shape: androidx.compose.ui.graphics.Shape) =
    this.clip(shape).background(color)
