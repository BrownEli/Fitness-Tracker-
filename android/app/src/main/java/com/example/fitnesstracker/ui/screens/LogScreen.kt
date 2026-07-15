package com.example.fitnesstracker.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.*
import androidx.compose.material3.TabRowDefaults.tabIndicatorOffset
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.fitnesstracker.ui.theme.*
import com.example.fitnesstracker.ui.viewmodel.LogViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LogScreen(viewModel: LogViewModel) {
    var selectedTab by remember { mutableIntStateOf(0) }
    val tabs = listOf("Weight & Notes", "Log Meals", "Log Workouts")

    Column(modifier = Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) {
        TabRow(
            selectedTabIndex = selectedTab,
            containerColor = MaterialTheme.colorScheme.surface,
            contentColor = MaterialTheme.colorScheme.primary,
            indicator = { tabPositions ->
                TabRowDefaults.Indicator(
                    modifier = Modifier.tabIndicatorOffset(tabPositions[selectedTab]),
                    color = MaterialTheme.colorScheme.primary
                )
            }
        ) {
            tabs.forEachIndexed { index, title ->
                Tab(
                    selected = selectedTab == index,
                    onClick = { selectedTab = index },
                    text = { Text(title, fontWeight = FontWeight.Bold, fontSize = 13.sp) },
                    selectedContentColor = MaterialTheme.colorScheme.primary,
                    unselectedContentColor = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
                )
            }
        }

        Box(modifier = Modifier.fillMaxSize().padding(16.dp)) {
            when (selectedTab) {
                0 -> WeightAndNotesForm(viewModel)
                1 -> MealsLogForm(viewModel)
                2 -> WorkoutsLogForm(viewModel)
            }
        }
    }
}

@Composable
fun WeightAndNotesForm(viewModel: LogViewModel) {
    var weightInput by remember { mutableStateOf("") }
    var notesInput by remember { mutableStateOf("") }
    var snackbarMessage by remember { mutableStateOf("") }

    LazyColumn(
        verticalArrangement = Arrangement.spacedBy(16.dp),
        modifier = Modifier.fillMaxSize()
    ) {
        item {
            Card(
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                shape = RoundedCornerShape(20.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text("Today's Scale Weight", fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurface)
                    OutlinedTextField(
                        value = weightInput,
                        onValueChange = { weightInput = it },
                        placeholder = { Text("e.g. 165.8") },
                        label = { Text("Weight (kg)") },
                        modifier = Modifier.fillMaxWidth()
                    )
                    Button(
                        onClick = {
                            val w = weightInput.toDoubleOrNull()
                            if (w != null) {
                                viewModel.saveWeight(w)
                                snackbarMessage = "Weight logged successfully!"
                            } else {
                                snackbarMessage = "Please enter a valid weight decimal"
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = Emerald500),
                        modifier = Modifier.fillMaxWidth().pressClickEffect(),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Text("Log Weight", fontWeight = FontWeight.Bold)
                    }
                }
            }
        }

        item {
            Card(
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                shape = RoundedCornerShape(20.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text("Training Journal Notes", fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurface)
                    OutlinedTextField(
                        value = notesInput,
                        onValueChange = { notesInput = it },
                        placeholder = { Text("How did your sessions feel? Focus points?") },
                        label = { Text("Session Notes") },
                        modifier = Modifier.fillMaxWidth(),
                        minLines = 3
                    )
                    Button(
                        onClick = {
                            if (notesInput.isNotBlank()) {
                                viewModel.saveNotes(notesInput)
                                snackbarMessage = "Journal entry saved!"
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = Indigo500),
                        modifier = Modifier.fillMaxWidth().pressClickEffect(),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Text("Save Journal Note", fontWeight = FontWeight.Bold)
                    }
                }
            }
        }

        if (snackbarMessage.isNotBlank()) {
            item {
                Text(snackbarMessage, color = Emerald600, fontWeight = FontWeight.Bold, fontSize = 13.sp)
            }
        }
    }
}

@Composable
fun MealsLogForm(viewModel: LogViewModel) {
    var mealName by remember { mutableStateOf("") }
    var proteinInput by remember { mutableStateOf("") }
    var caloriesInput by remember { mutableStateOf("") }
    var snackbarMessage by remember { mutableStateOf("") }

    Card(
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        shape = RoundedCornerShape(20.dp),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("Track a Meal Item", fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurface)
            
            OutlinedTextField(
                value = mealName,
                onValueChange = { mealName = it },
                label = { Text("Meal description") },
                placeholder = { Text("e.g. Egg White Scramble") },
                modifier = Modifier.fillMaxWidth()
            )

            OutlinedTextField(
                value = proteinInput,
                onValueChange = { proteinInput = it },
                label = { Text("Protein (grams)") },
                placeholder = { Text("e.g. 35") },
                modifier = Modifier.fillMaxWidth()
            )

            OutlinedTextField(
                value = caloriesInput,
                onValueChange = { caloriesInput = it },
                label = { Text("Calories (kcal)") },
                placeholder = { Text("e.g. 450") },
                modifier = Modifier.fillMaxWidth()
            )

            Button(
                onClick = {
                    val p = proteinInput.toIntOrNull() ?: 0
                    val c = caloriesInput.toIntOrNull() ?: 0
                    if (mealName.isNotBlank()) {
                        viewModel.addMeal(mealName, p, c)
                        mealName = ""
                        proteinInput = ""
                        caloriesInput = ""
                        snackbarMessage = "Meal logged successfully!"
                    } else {
                        snackbarMessage = "Please add a meal name"
                    }
                },
                colors = ButtonDefaults.buttonColors(containerColor = Emerald500),
                modifier = Modifier.fillMaxWidth().pressClickEffect(),
                shape = RoundedCornerShape(12.dp)
            ) {
                Text("Log Meal", fontWeight = FontWeight.Bold)
            }

            if (snackbarMessage.isNotBlank()) {
                Text(snackbarMessage, color = Emerald600, fontWeight = FontWeight.Bold, fontSize = 13.sp)
            }
        }
    }
}

@Composable
fun WorkoutsLogForm(viewModel: LogViewModel) {
    var exerciseName by remember { mutableStateOf("") }
    var category by remember { mutableStateOf("Chest") }
    var repsInput by remember { mutableStateOf("") }
    var weightInput by remember { mutableStateOf("") }
    
    val currentSets = remember { mutableStateListOf<Pair<Int, Double>>() }
    var snackbarMessage by remember { mutableStateOf("") }

    val categories = listOf("Chest", "Back", "Legs", "Shoulders", "Arms", "Core", "Cardio")

    LazyColumn(
        verticalArrangement = Arrangement.spacedBy(16.dp),
        modifier = Modifier.fillMaxSize()
    ) {
        item {
            Card(
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                shape = RoundedCornerShape(20.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text("Add Active Workout Exercise", fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurface)
                    
                    OutlinedTextField(
                        value = exerciseName,
                        onValueChange = { exerciseName = it },
                        label = { Text("Exercise Name") },
                        placeholder = { Text("e.g. Barbell Squats") },
                        modifier = Modifier.fillMaxWidth()
                    )

                    // Beautiful horizontal categories selection list
                    Text("Select Muscle Category", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f))
                    LazyRow(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        items(categories) { cat ->
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(if (category == cat) Emerald500 else MaterialTheme.colorScheme.surfaceVariant)
                                    .clickable { category = cat }
                                    .pressClickEffect()
                                    .padding(horizontal = 12.dp, vertical = 6.dp)
                            ) {
                                Text(
                                    text = cat,
                                    color = if (category == cat) Color.White else MaterialTheme.colorScheme.onSurface,
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        }
                    }

                    Divider(color = MaterialTheme.colorScheme.surfaceVariant, thickness = 1.dp)

                    // Add Sets Entry Sub-section
                    Text("Add Active Sets Details", fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurface)
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        OutlinedTextField(
                            value = repsInput,
                            onValueChange = { repsInput = it },
                            label = { Text("Reps") },
                            modifier = Modifier.weight(1f)
                        )
                        OutlinedTextField(
                            value = weightInput,
                            onValueChange = { weightInput = it },
                            label = { Text("Weight (kg)") },
                            modifier = Modifier.weight(1f)
                        )
                        IconButton(
                            onClick = {
                                val r = repsInput.toIntOrNull()
                                val w = weightInput.toDoubleOrNull()
                                if (r != null && w != null) {
                                    currentSets.add(Pair(r, w))
                                    repsInput = ""
                                    weightInput = ""
                                }
                            },
                            modifier = Modifier.pressClickEffect()
                        ) {
                            Icon(Icons.Default.Add, contentDescription = "Add Set", tint = Emerald600)
                        }
                    }

                    // Render currently added sets
                    if (currentSets.isNotEmpty()) {
                        Text("Current added sets list:", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f))
                        currentSets.forEachIndexed { index, set ->
                            Row(
                                modifier = Modifier.fillMaxWidth().padding(vertical = 2.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text("Set #${index + 1}: ${set.first} reps @ ${set.second} kg", fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurface)
                                IconButton(onClick = { currentSets.removeAt(index) }) {
                                    Icon(Icons.Default.Delete, contentDescription = "Remove Set", tint = Coral500)
                                }
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(8.dp))

                    Button(
                        onClick = {
                            if (exerciseName.isNotBlank() && currentSets.isNotEmpty()) {
                                viewModel.addWorkout(exerciseName, category, currentSets.toList())
                                exerciseName = ""
                                currentSets.clear()
                                snackbarMessage = "Exercise logged successfully!"
                            } else {
                                snackbarMessage = "Please add at least one set"
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = Emerald500),
                        modifier = Modifier.fillMaxWidth().pressClickEffect(),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Text("Submit Exercise Log", fontWeight = FontWeight.Bold)
                    }

                    if (snackbarMessage.isNotBlank()) {
                        Text(snackbarMessage, color = Emerald600, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                    }
                }
            }
        }
    }
}
