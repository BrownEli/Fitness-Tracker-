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
    var weightInputState by remember(todayLog?.weight) { 
        mutableStateOf(todayLog?.weight?.toString() ?: "") 
    }

    Box(modifier = Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Section: Active Logging Day
            item {
                Card(
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    shape = RoundedCornerShape(24.dp),
                    elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(
                        modifier = Modifier.padding(20.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween,
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Column {
                                Text(
                                    text = "ACTIVE LOGGING DAY",
                                    color = Indigo500,
                                    fontWeight = FontWeight.Black,
                                    fontSize = 11.sp,
                                    letterSpacing = 0.5.sp
                                )
                                Text(
                                    text = "Today, " + java.text.SimpleDateFormat("MMM dd, yyyy", java.util.Locale.getDefault()).format(java.util.Date()),
                                    color = MaterialTheme.colorScheme.onSurface,
                                    fontWeight = FontWeight.Black,
                                    fontSize = 20.sp,
                                    modifier = Modifier.padding(top = 2.dp)
                                )
                            }
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(12.dp))
                                    .background(Slate100)
                                    .clickable { showGoalDialog = true }
                                    .pressClickEffect()
                                    .padding(horizontal = 12.dp, vertical = 6.dp)
                            ) {
                                Text(
                                    text = "Configure Goals", 
                                    color = Slate900, 
                                    fontSize = 11.sp, 
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        }

                        Divider(color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.08f), thickness = 1.dp)

                        // In-line Weight Input
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(10.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text(
                                text = "Scale Weight today:",
                                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.8f),
                                fontWeight = FontWeight.Bold,
                                fontSize = 13.sp,
                                modifier = Modifier.weight(1f)
                            )
                            
                            OutlinedTextField(
                                value = weightInputState,
                                onValueChange = { weightInputState = it },
                                placeholder = { Text("0.0", fontSize = 13.sp) },
                                modifier = Modifier
                                    .width(90.dp)
                                    .height(48.dp),
                                shape = RoundedCornerShape(10.dp),
                                singleLine = true,
                                colors = TextFieldDefaults.outlinedTextFieldColors(
                                    focusedIndicatorColor = Indigo500,
                                    unfocusedIndicatorColor = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.12f)
                                )
                            )

                            Text(
                                text = "kg",
                                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f),
                                fontWeight = FontWeight.Bold,
                                fontSize = 13.sp
                            )

                            Button(
                                onClick = {
                                    val wValue = weightInputState.toDoubleOrNull()
                                    if (wValue != null) {
                                        viewModel.saveWeight(wValue)
                                    }
                                },
                                colors = ButtonDefaults.buttonColors(containerColor = Emerald500),
                                shape = RoundedCornerShape(10.dp),
                                modifier = Modifier
                                    .height(40.dp)
                                    .pressClickEffect()
                            ) {
                                Text("Save", fontWeight = FontWeight.Bold, fontSize = 12.sp)
                            }
                        }
                    }
                }
            }

            // Calculations for 3 Metric Cards
            val proteinLogged = todayLog?.meals?.sumOf { it.protein } ?: 0
            val proteinTarget = backupState.goals.proteinTarget.coerceAtLeast(1)
            val proteinPercent = ((proteinLogged.toFloat() / proteinTarget.toFloat()) * 100).toInt().coerceIn(0, 100)

            val caloriesLogged = todayLog?.meals?.sumOf { it.calories } ?: 0
            val caloriesTarget = backupState.goals.caloriesTarget.coerceAtLeast(1)
            val caloriesPercent = ((caloriesLogged.toFloat() / caloriesTarget.toFloat()) * 100).toInt().coerceIn(0, 100)

            val workoutsLogged = todayLog?.workouts ?: emptyList()
            val workoutsCompletedCount = workoutsLogged.count { it.completed }
            val totalWorkoutsCount = workoutsLogged.size
            val workoutsPercent = if (totalWorkoutsCount > 0) {
                ((workoutsCompletedCount.toFloat() / totalWorkoutsCount.toFloat()) * 100).toInt().coerceIn(0, 100)
            } else 0

            // 1. TODAY'S PROTEIN CARD
            item {
                Card(
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    shape = RoundedCornerShape(20.dp),
                    elevation = CardDefaults.cardElevation(defaultElevation = 0.5.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(
                        modifier = Modifier.padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Box(
                                    modifier = Modifier
                                        .size(32.dp)
                                        .clip(RoundedCornerShape(8.dp))
                                        .background(Emerald50.copy(alpha = 0.4f)),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text("🔥", fontSize = 16.sp)
                                }
                                Spacer(modifier = Modifier.width(10.dp))
                                Column {
                                    Text(
                                        text = "TODAY'S PROTEIN",
                                        fontWeight = FontWeight.Black,
                                        fontSize = 11.sp,
                                        color = Emerald600,
                                        letterSpacing = 0.5.sp
                                    )
                                    Text(
                                        text = "$proteinLogged g / $proteinTarget g",
                                        fontWeight = FontWeight.Black,
                                        fontSize = 17.sp,
                                        color = MaterialTheme.colorScheme.onSurface
                                    )
                                }
                            }

                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(Emerald500.copy(alpha = 0.12f))
                                    .padding(horizontal = 8.dp, vertical = 4.dp)
                            ) {
                                Text(
                                    text = "$proteinPercent%",
                                    color = Emerald600,
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        }

                        LinearProgressIndicator(
                            progress = (proteinLogged.toFloat() / proteinTarget.toFloat()).coerceIn(0f, 1f),
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(6.dp)
                                .clip(CircleShape),
                            color = Emerald500,
                            trackColor = MaterialTheme.colorScheme.surfaceVariant
                        )
                    }
                }
            }

            // 2. CALORIES SURPLUS/BUDGET CARD
            item {
                Card(
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    shape = RoundedCornerShape(20.dp),
                    elevation = CardDefaults.cardElevation(defaultElevation = 0.5.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(
                        modifier = Modifier.padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Box(
                                    modifier = Modifier
                                        .size(32.dp)
                                        .clip(RoundedCornerShape(8.dp))
                                        .background(Slate100),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text("⚡", fontSize = 16.sp)
                                }
                                Spacer(modifier = Modifier.width(10.dp))
                                Column {
                                    Text(
                                        text = "CALORIE SURPLUS",
                                        fontWeight = FontWeight.Black,
                                        fontSize = 11.sp,
                                        color = Indigo500,
                                        letterSpacing = 0.5.sp
                                    )
                                    Text(
                                        text = "$caloriesLogged / $caloriesTarget kcal",
                                        fontWeight = FontWeight.Black,
                                        fontSize = 17.sp,
                                        color = MaterialTheme.colorScheme.onSurface
                                    )
                                }
                            }

                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(Indigo500.copy(alpha = 0.12f))
                                    .padding(horizontal = 8.dp, vertical = 4.dp)
                            ) {
                                Text(
                                    text = "$caloriesPercent%",
                                    color = Indigo500,
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        }

                        LinearProgressIndicator(
                            progress = (caloriesLogged.toFloat() / caloriesTarget.toFloat()).coerceIn(0f, 1f),
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(6.dp)
                                .clip(CircleShape),
                            color = Indigo500,
                            trackColor = MaterialTheme.colorScheme.surfaceVariant
                        )
                    }
                }
            }

            // 3. COMPLETED EXERCISES CARD
            item {
                Card(
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    shape = RoundedCornerShape(20.dp),
                    elevation = CardDefaults.cardElevation(defaultElevation = 0.5.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(
                        modifier = Modifier.padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Box(
                                    modifier = Modifier
                                        .size(32.dp)
                                        .clip(RoundedCornerShape(8.dp))
                                        .background(Gold500.copy(alpha = 0.15f)),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text("💪", fontSize = 16.sp)
                                }
                                Spacer(modifier = Modifier.width(10.dp))
                                Column {
                                    Text(
                                        text = "COMPLETED EXERCISES",
                                        fontWeight = FontWeight.Black,
                                        fontSize = 11.sp,
                                        color = Gold600,
                                        letterSpacing = 0.5.sp
                                    )
                                    Text(
                                        text = "$workoutsCompletedCount / $totalWorkoutsCount Lifts Today",
                                        fontWeight = FontWeight.Black,
                                        fontSize = 17.sp,
                                        color = MaterialTheme.colorScheme.onSurface
                                    )
                                }
                            }

                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(Gold500.copy(alpha = 0.15f))
                                    .padding(horizontal = 8.dp, vertical = 4.dp)
                            ) {
                                Text(
                                    text = "$workoutsPercent%",
                                    color = Gold600,
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        }

                        LinearProgressIndicator(
                            progress = if (totalWorkoutsCount > 0) (workoutsCompletedCount.toFloat() / totalWorkoutsCount.toFloat()).coerceIn(0f, 1f) else 0f,
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(6.dp)
                                .clip(CircleShape),
                            color = Gold500,
                            trackColor = MaterialTheme.colorScheme.surfaceVariant
                        )
                    }
                }
            }

            // Stats row (Average nutrition & calorie metrics cached)
            item {
                Text(
                    text = "WEEKLY PERFORMANCE AVERAGES",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f),
                    modifier = Modifier.padding(top = 8.dp)
                )
            }

            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Card(
                        modifier = Modifier.weight(1f).pressClickEffect(),
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                        shape = RoundedCornerShape(20.dp)
                    ) {
                        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            Text("Avg Calories", color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f), fontSize = 12.sp)
                            Text(
                                "${backupState.analytics.cachedStats.averageCalories} kcal",
                                color = MaterialTheme.colorScheme.onSurface,
                                fontWeight = FontWeight.Bold,
                                fontSize = 20.sp
                            )
                            LinearProgressIndicator(
                                progress = (backupState.analytics.cachedStats.averageCalories.toFloat() / backupState.goals.caloriesTarget.toFloat()).coerceIn(0f, 1f),
                                modifier = Modifier.fillMaxWidth().height(6.dp).clip(CircleShape),
                                color = Emerald500,
                                trackColor = MaterialTheme.colorScheme.surfaceVariant
                            )
                        }
                    }

                    Card(
                        modifier = Modifier.weight(1f).pressClickEffect(),
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                        shape = RoundedCornerShape(20.dp)
                    ) {
                        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            Text("Avg Protein", color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f), fontSize = 12.sp)
                            Text(
                                "${backupState.analytics.cachedStats.averageProtein}g",
                                color = MaterialTheme.colorScheme.onSurface,
                                fontWeight = FontWeight.Bold,
                                fontSize = 20.sp
                            )
                            LinearProgressIndicator(
                                progress = (backupState.analytics.cachedStats.averageProtein.toFloat() / backupState.goals.proteinTarget.toFloat()).coerceIn(0f, 1f),
                                modifier = Modifier.fillMaxWidth().height(6.dp).clip(CircleShape),
                                color = Indigo500,
                                trackColor = MaterialTheme.colorScheme.surfaceVariant
                            )
                        }
                    }
                }
            }

            // Section: Today's Workouts List
            item {
                Text(
                    text = "TODAY'S WORKOUTS",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f),
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
                            .background(MaterialTheme.colorScheme.surface)
                            .padding(24.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text("No exercises logged for today yet.", color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f), fontSize = 14.sp)
                    }
                }
            } else {
                items(todayWorkouts) { workout ->
                    Card(
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                        shape = RoundedCornerShape(20.dp),
                        modifier = Modifier.fillMaxWidth().pressClickEffect()
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
                                        color = MaterialTheme.colorScheme.onSurface,
                                        fontSize = 16.sp
                                    )
                                }
                                Text(
                                    text = "${workout.category} • ${workout.sets.size} sets",
                                    fontSize = 12.sp,
                                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f)
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
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f),
                        modifier = Modifier.padding(top = 8.dp)
                    )
                }
                item {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(20.dp))
                            .background(MaterialTheme.colorScheme.surface)
                            .padding(16.dp)
                    ) {
                        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            Text("💡 Today's Session Notes", color = MaterialTheme.colorScheme.onSurface, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                            Text(noteText, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.8f), fontSize = 13.sp, lineHeight = 18.sp)
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
                title = { Text("Configure Fitness Goals", fontWeight = FontWeight.Black) },
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
                        Text("Apply Goals", fontWeight = FontWeight.Bold)
                    }
                },
                dismissButton = {
                    TextButton(onClick = { showGoalDialog = false }) {
                        Text("Cancel", color = Indigo500, fontWeight = FontWeight.Bold)
                    }
                }
            )
        }
    }
}
