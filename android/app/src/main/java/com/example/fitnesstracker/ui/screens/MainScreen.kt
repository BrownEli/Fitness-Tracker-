package com.example.fitnesstracker.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Menu
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
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MainScreen(
    dashboardViewModel: DashboardViewModel,
    logViewModel: LogViewModel,
    syncViewModel: SyncViewModel
) {
    var selectedScreenIndex by remember { mutableIntStateOf(0) }
    val screens = listOf("Dashboard", "Log Entries", "Sync Settings")
    val drawerState = rememberDrawerState(initialValue = DrawerValue.Closed)
    val scope = rememberCoroutineScope()

    ModalNavigationDrawer(
        drawerState = drawerState,
        drawerContent = {
            ModalDrawerSheet(
                drawerContainerColor = Slate900,
                drawerContentColor = Color.White,
                modifier = Modifier.width(280.dp)
            ) {
                Spacer(modifier = Modifier.height(24.dp))
                
                // Sidebar header matching the Web visual identity
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 24.dp, vertical = 16.dp),
                    verticalAlignment = androidx.compose.ui.Alignment.CenterVertically
                ) {
                    Box(
                        modifier = Modifier
                            .size(44.dp)
                            .clip(RoundedCornerShape(12.dp))
                            .background(Color.White.copy(alpha = 0.12f)),
                        contentAlignment = androidx.compose.ui.Alignment.Center
                    ) {
                        Text(
                            text = "⚡",
                            fontSize = 22.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color.White
                        )
                    }
                    Spacer(modifier = Modifier.width(14.dp))
                    Column {
                        Text(
                            text = "Fitness Tracker",
                            fontWeight = FontWeight.Black,
                            fontSize = 18.sp,
                            color = Color.White
                        )
                        Text(
                            text = "HYPERTROPHY FOCUS",
                            fontWeight = FontWeight.Black,
                            fontSize = 9.sp,
                            color = Indigo500,
                            letterSpacing = 0.5.sp
                        )
                    }
                }
                
                Divider(
                    color = Color.White.copy(alpha = 0.08f),
                    thickness = 1.dp,
                    modifier = Modifier.padding(vertical = 12.dp)
                )

                screens.forEachIndexed { index, name ->
                    val isSelected = selectedScreenIndex == index
                    NavigationDrawerItem(
                        label = { 
                            Text(
                                text = name, 
                                fontWeight = FontWeight.Bold,
                                fontSize = 14.sp
                            ) 
                        },
                        selected = isSelected,
                        onClick = {
                            selectedScreenIndex = index
                            scope.launch { drawerState.close() }
                        },
                        icon = {
                            Text(
                                text = when (index) {
                                    0 -> "📊"
                                    1 -> "📝"
                                    else -> "☁|"
                                },
                                fontSize = 20.sp
                            )
                        },
                        colors = NavigationDrawerItemDefaults.colors(
                            selectedContainerColor = Indigo500,
                            selectedTextColor = Color.White,
                            selectedIconColor = Color.White,
                            unselectedTextColor = Color.White.copy(alpha = 0.7f),
                            unselectedIconColor = Color.White.copy(alpha = 0.7f)
                        ),
                        modifier = Modifier
                            .padding(NavigationDrawerItemDefaults.ItemPadding)
                            .pressClickEffect()
                    )
                }
            }
        }
    ) {
        Scaffold(
            topBar = {
                TopAppBar(
                    title = {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = androidx.compose.ui.Alignment.CenterVertically
                        ) {
                            Column {
                                Text(
                                    text = "Fitness Tracker",
                                    fontWeight = FontWeight.Black,
                                    fontSize = 18.sp,
                                    color = MaterialTheme.colorScheme.onSurface
                                )
                                Text(
                                    text = when (selectedScreenIndex) {
                                        0 -> "📊 ANALYTICS & STATS TRENDS"
                                        1 -> "📝 TRAINING JOURNAL LOGS"
                                        else -> "☁ WORKSPACE HUB INTEGRATION"
                                    },
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 8.sp,
                                    color = Indigo500,
                                    letterSpacing = 0.5.sp
                                )
                            }
                        }
                    },
                    navigationIcon = {
                        IconButton(
                            onClick = { scope.launch { drawerState.open() } },
                            modifier = Modifier.pressClickEffect()
                        ) {
                            Icon(
                                imageVector = Icons.Default.Menu,
                                contentDescription = "Open Side Menu",
                                tint = MaterialTheme.colorScheme.onSurface
                            )
                        }
                    },
                    colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.surface)
                )
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
}
