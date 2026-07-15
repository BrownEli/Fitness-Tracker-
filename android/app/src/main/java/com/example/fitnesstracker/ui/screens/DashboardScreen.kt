package com.example.fitnesstracker.ui.screens

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.fitnesstracker.data.model.DailyLog
import com.example.fitnesstracker.ui.theme.*
import com.example.fitnesstracker.ui.viewmodel.DashboardViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DashboardScreen(viewModel: DashboardViewModel) {
    val backupState by viewModel.backupState.collectAsState()
    val todayLog by viewModel.todayLog.collectAsState()
    
    var showGoalDialog by remember { mutableStateOf(false) }

    Box(modifier = Modifier.fillMaxSize().background(Slate50)) {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Gradient Hero Card (Total Stats)
            item {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(28.dp))
                        .background(Brush.linearGradient(colors = listOf(Emerald500, Indigo500)))
                        .padding(24.dp)
                ) {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text(
                            text = "TODAY\'S TRACKING STATUS",
                            color = Color.White.copy(alpha = 0.8f),
                            fontWeight = FontWeight.Bold,
                            fontSize = 11.sp,
                            fontFamily = androidx.compose.ui.text.font.FontFamily.Monospace
                        )
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = todayLog?.weight?.let { "$it kg" } ?: "Weight Unlogged",
                                color = Color.White,
                                fontWeight = FontWeight.Black,
                                fontSize = 28.sp
                            )
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(12.dp))
                                    .background(Color.White.copy(alpha = 0.2f))
                                    .clickable { showGoalDialog = true }
                                    .padding(horizontal = 12.dp, vertical = 6.dp)
                            ) {
                                Text("Edit Goals", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                        HorizontalDivider(color = Color.White.copy(alpha = 0.15f), thickness = 1.dp)
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Column {
                                Text("Meals Logged", color = Color.White.copy(0.7f), fontSize = 11.sp)
                                Text("${todayLog?.meals?.size ?: 0} items", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                            }
                            Column {
                                Text("Workouts Done", color = Color.White.copy(0.7f), fontSize = 11.sp)
                                Text("${todayLog?.workouts?.count { it.completed } ?: 0} exercises", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                            }
                            Column {
                                Text("Weekly Streak", color = Color.White.copy(0.7f), fontSize = 11.sp)
                                Text("${backupState.analytics.cachedStats.streakDays} days 🔥", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                            }
                        }
                    }
                }
            }

            // Stats row (Average nutrition & calorie metrics cached)
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Card(
                        modifier = Modifier.weight(1f),
                        colors = CardDefaults.cardColors(containerColor = Color.White),
                        shape = RoundedCornerShape(20.dp)
                    ) {
                        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            Text("Avg Calories", color = Slate700, fontSize = 12.sp)
                            Text(
                                "${backupState.analytics.cachedStats.averageCalories} kcal",
                                color = Slate900,
                                fontWeight = FontWeight.Bold,
                                fontSize = 20.sp
                            )
                            LinearProgressIndicator(
                                progress = (backupState.analytics.cachedStats.averageCalories.toFloat() / backupState.goals.caloriesTarget.toFloat()).coerceIn(0f, 1f),
                                modifier = Modifier.fillMaxWidth().height(6.dp).clip(CircleShape),
                                color = Emerald500,
                                trackColor = Slate100
                            )
                        }
                    }

                    Card(
                        modifier = Modifier.weight(1f),
                        colors = CardDefaults.cardColors(containerColor = Color.White),
                        shape = RoundedCornerShape(20.dp)
                    ) {
                        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            Text("Avg Protein", color = Slate700, fontSize = 12.sp)
                            Text(
                                "${backupState.analytics.cachedStats.averageProtein}g",
                                color = Slate900,
                                fontWeight = FontWeight.Bold,
                                fontSize = 20.sp
                            )
                            LinearProgressIndicator(
                                progress = (backupState.analytics.cachedStats.averageProtein.toFloat() / backupState.goals.proteinTarget.toFloat()).coerceIn(0f, 1f),
                                modifier = Modifier.fillMaxWidth().height(6.dp).clip(CircleShape),
                                color = Indigo500,
                                trackColor = Slate100
                            )
                        }
                    }
                }
            }

            // Section: Today's Workouts List
            item {
                Text(
                    text = "TODAY'S WORKOUTS",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = Slate700,
                    modifier = Modifier.padding(top = 8.dp)
                )
            }

            val todayWorkouts = todayLog?.workouts ?: emptyList()
            if (todayWorkouts.isEmpty()) {
                item {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(20.dp))
                            .background(Color.White)
                            .padding(24.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text("No exercises logged for today yet.", color = Slate700, fontSize = 14.sp)
                    }
                }
            } else {
                items(todayWorkouts) { workout ->
                    Card(
                        colors = CardDefaults.cardColors(containerColor = Color.White),
                        shape = RoundedCornerShape(20.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Row(
                            modifier = Modifier.padding(16.dp).fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Box(
                                        modifier = Modifier
                                            .size(8.dp)
                                            .clip(CircleShape)
                                            .background(if (workout.completed) Emerald500 else Gold500)
                                    )
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Text(
                                        text = workout.name,
                                        fontWeight = FontWeight.Bold,
                                        color = Slate900,
                                        fontSize = 16.sp
                                    )
                                }
                                Text(
                                    text = "${workout.category} • ${workout.sets.size} sets",
                                    fontSize = 12.sp,
                                    color = Slate700
                                )
                            }
                            Checkbox(
                                checked = workout.completed,
                                onCheckedChange = { checked ->
                                    todayLog?.id?.let { logId ->
                                        viewModel.toggleWorkoutCompletion(logId, workout.id, checked)
                                    }
                                },
                                colors = CheckboxDefaults.colors(checkedColor = Emerald500)
                            )
                        }
                    }
                }
            }

            // Journal Note Panel
            val noteText = todayLog?.notes ?: ""
            if (noteText.isNotBlank()) {
                item {
                    Text(
                        text = "JOURNAL NOTES",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = Slate700,
                        modifier = Modifier.padding(top = 8.dp)
                    )
                }
                item {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(20.dp))
                            .background(Color.White)
                            .padding(16.dp)
                    ) {
                        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            Text("💡 Today\'s Session Notes", color = Slate900, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                            Text(noteText, color = Slate700, fontSize = 13.sp, lineHeight = 18.sp)
                        }
                    }
                }
            }
        }

        // Edit Goals Dialog popup
        if (showGoalDialog) {
            var currentWeightTarget by remember { mutableStateOf(backupState.goals.weightTarget.toString()) }
            var currentCaloriesTarget by remember { mutableStateOf(backupState.goals.caloriesTarget.toString()) }
            var currentProteinTarget by remember { mutableStateOf(backupState.goals.proteinTarget.toString()) }
            var currentWorkoutsTarget by remember { mutableStateOf(backupState.goals.weeklyWorkoutDaysTarget.toString()) }

            AlertDialog(
                onDismissRequest = { showGoalDialog = false },
                title = { Text("Configure Fitness Goals") },
                text = {
                    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        OutlinedTextField(
                            value = currentWeightTarget,
                            onValueChange = { currentWeightTarget = it },
                            label = { Text("Weight Target (kg)") },
                            modifier = Modifier.fillMaxWidth()
                        )
                        OutlinedTextField(
                            value = currentCaloriesTarget,
                            onValueChange = { currentCaloriesTarget = it },
                            label = { Text("Daily Caloric Target (kcal)") },
                            modifier = Modifier.fillMaxWidth()
                        )
                        OutlinedTextField(
                            value = currentProteinTarget,
                            onValueChange = { currentProteinTarget = it },
                            label = { Text("Daily Protein Target (g)") },
                            modifier = Modifier.fillMaxWidth()
                        )
                        OutlinedTextField(
                            value = currentWorkoutsTarget,
                            onValueChange = { currentWorkoutsTarget = it },
                            label = { Text("Weekly Workouts Target") },
                            modifier = Modifier.fillMaxWidth()
                        )
                    }
                },
                confirmButton = {
                    Button(
                        onClick = {
                            val w = currentWeightTarget.toDoubleOrNull() ?: backupState.goals.weightTarget
                            val c = currentCaloriesTarget.toIntOrNull() ?: backupState.goals.caloriesTarget
                            val p = currentProteinTarget.toIntOrNull() ?: backupState.goals.proteinTarget
                            val t = currentWorkoutsTarget.toIntOrNull() ?: backupState.goals.weeklyWorkoutDaysTarget
                            viewModel.updateGoals(w, c, p, t)
                            showGoalDialog = false
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = Emerald500)
                    ) {
                        Text("Apply Goals")
                    }
                },
                dismissButton = {
                    TextButton(onClick = { showGoalDialog = false }) {
                        Text("Cancel", color = Slate900)
                    }
                }
            )
        }
    }
}
