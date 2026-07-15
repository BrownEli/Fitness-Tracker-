package com.example.fitnesstracker.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.*
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

    Column(modifier = Modifier.fillMaxSize().background(Slate50)) {
        TabRow(
            selectedTabIndex = selectedTab,
            containerColor = Color.White,
            contentColor = Emerald600,
            indicator = { tabPositions ->
                TabRowDefaults.SecondaryIndicator(
                    modifier = Modifier.tabIndicatorOffset(tabPositions[selectedTab]),
                    color = Emerald500
                )
            }
        ) {
            tabs.forEachIndexed { index, title ->
                Tab(
                    selected = selectedTab == index,
                    onClick = { selectedTab = index },
                    text = { Text(title, fontWeight = FontWeight.Bold, fontSize = 13.sp) },
                    selectedContentColor = Emerald600,
                    unselectedContentColor = Slate700
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
                colors = CardDefaults.cardColors(containerColor = Color.White),
                shape = RoundedCornerShape(20.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text("Today's Scale Weight", fontWeight = FontWeight.Bold, color = Slate900)
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
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Text("Log Weight", fontWeight = FontWeight.Bold)
                    }
                }
            }
        }

        item {
            Card(
                colors = CardDefaults.cardColors(containerColor = Color.White),
                shape = RoundedCornerShape(20.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text("Training Journal Notes", fontWeight = FontWeight.Bold, color = Slate900)
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
                        modifier = Modifier.fillMaxWidth(),
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
        colors = CardDefaults.cardColors(containerColor = Color.White),
        shape = RoundedCornerShape(20.dp),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("Track a Meal Item", fontWeight = FontWeight.Bold, color = Slate900)
            
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
                modifier = Modifier.fillMaxWidth(),
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
                colors = CardDefaults.cardColors(containerColor = Color.White),
                shape = RoundedCornerShape(20.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text("Add Active Workout Exercise", fontWeight = FontWeight.Bold, color = Slate900)
                    
                    OutlinedTextField(
                        value = exerciseName,
                        onValueChange = { exerciseName = it },
                        label = { Text("Exercise Name") },
                        placeholder = { Text("e.g. Barbell Squats") },
                        modifier = Modifier.fillMaxWidth()
                    )

                    // Simple category buttons
                    Text("Select Muscle Category", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Slate700)
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(8.dp))
                                .background(if (category == "Legs") Emerald500 else Slate100)
                                .clickable { category = "Legs" }
                                .padding(horizontal = 12.dp, vertical = 6.dp)
                        ) {
                            Text("Legs", color = if (category == "Legs") Color.White else Slate900, fontSize = 12.sp)
                        }
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(8.dp))
                                .background(if (category == "Chest") Emerald500 else Slate100)
                                .clickable { category = "Chest" }
                                .padding(horizontal = 12.dp, vertical = 6.dp)
                        ) {
                            Text("Chest", color = if (category == "Chest") Color.White else Slate900, fontSize = 12.sp)
                        }
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(8.dp))
                                .background(if (category == "Back") Emerald500 else Slate100)
                                .clickable { category = "Back" }
                                .padding(horizontal = 12.dp, vertical = 6.dp)
                        ) {
                            Text("Back", color = if (category == "Back") Color.White else Slate900, fontSize = 12.sp)
                        }
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(8.dp))
                                .background(if (category == "Shoulders") Emerald500 else Slate100)
                                .clickable { category = "Shoulders" }
                                .padding(horizontal = 12.dp, vertical = 6.dp)
                        ) {
                            Text("Shoulders", color = if (category == "Shoulders") Color.White else Slate900, fontSize = 12.sp)
                        }
                    }

                    Divider(color = Slate100, thickness = 1.dp)

                    // Add Sets Entry Sub-section
                    Text("Add Active Sets Details", fontWeight = FontWeight.Bold, color = Slate900)
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
                            }
                        ) {
                            Icon(Icons.Default.Add, contentDescription = "Add Set", tint = Emerald600)
                        }
                    }

                    // Render currently added sets
                    if (currentSets.isNotEmpty()) {
                        Text("Current added sets list:", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Slate700)
                        currentSets.forEachIndexed { index, set ->
                            Row(
                                modifier = Modifier.fillMaxWidth().padding(vertical = 2.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text("Set #${index + 1}: ${set.first} reps @ ${set.second} kg", fontSize = 13.sp, color = Slate900)
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
                        modifier = Modifier.fillMaxWidth(),
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
