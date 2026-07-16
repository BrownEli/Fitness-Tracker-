package com.example.fitnesstracker.ui.screens

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.*
import androidx.compose.material3.TabRowDefaults.tabIndicatorOffset
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.fitnesstracker.ui.theme.*
import com.example.fitnesstracker.ui.viewmodel.LogViewModel

data class WorkoutDayPlan(
    val day: Int,
    val focus: String,
    val category: String,
    val exercises: List<String>
)

data class ExerciseDetails(
    val name: String,
    val target: String,
    val volume: String,
    val intensity: String,
    val description: String
)

val WEEKLY_PLAN_DATA = listOf(
    WorkoutDayPlan(1, "Core & Chest", "Chest", listOf("Bench Crunches", "Dumbbell Flat Bench Press")),
    WorkoutDayPlan(2, "Arms & Shoulders", "Shoulders", listOf("Bicep Curls", "Seated Dumbbell Shoulder Press")),
    WorkoutDayPlan(3, "Core & Back", "Back", listOf("Flat Bench Leg Raises", "Dumbbell Rows")),
    WorkoutDayPlan(4, "Active Recovery & Legs", "Legs", listOf("Bodyweight Bench Squats", "Light Stretching")),
    WorkoutDayPlan(5, "Repeat & Overload Cycle", "Legs", listOf("Bench Crunches", "Dumbbell Flat Bench Press", "Seated Dumbbell Shoulder Press"))
)

val EXERCISES_DATABASE = mapOf(
    "Bench Crunches" to ExerciseDetails(
        name = "Bench Crunches",
        target = "Core / Stomach",
        volume = "3 sets of 20 repetitions",
        intensity = "Moderate, controlled pace",
        description = "Lie flat on your back on the workout bench with your feet planted firmly on the ground or hooked into the foot pads. Place your hands gently behind your head or crossed over your chest. Contract your abdominal muscles to lift your shoulders and upper torso off the bench. Focus on squeezing your stomach at the top, then slowly lower yourself back down."
    ),
    "Dumbbell Flat Bench Press" to ExerciseDetails(
        name = "Dumbbell Flat Bench Press",
        target = "Chest & Arms",
        volume = "3 sets of 20 repetitions",
        intensity = "Comfortable weight",
        description = "Lie flat on the bench holding a dumbbell in each hand at chest level, palms facing forward. Press the weights straight up toward the ceiling until your arms are fully extended but not locked. Slowly lower the weights back down to chest level, keeping your elbows at a 45-degree angle to your body."
    ),
    "Flat Bench Leg Raises" to ExerciseDetails(
        name = "Flat Bench Leg Raises",
        target = "Lower Abs",
        volume = "3 sets of 8-10 repetitions",
        intensity = "Slow, steady speed",
        description = "Lie flat on your back on the bench, gripping the top of the bench behind your head for stability. Keeping your legs straight (or slightly bent if it strains your back), slowly lift them up until they are perpendicular to the floor. Lower them back down slowly."
    ),
    "Seated Dumbbell Shoulder Press" to ExerciseDetails(
        name = "Seated Dumbbell Shoulder Press",
        target = "Shoulders",
        volume = "3 sets of 10 repetitions",
        intensity = "Controlled overhead press",
        description = "Adjust your bench to an upright seated position. Sit with your back firmly against the pad. Bring the dumbbells up to shoulder height, palms facing away from you. Press the weights straight up overhead until your arms are extended, then slowly lower them."
    ),
    "Bicep Curls" to ExerciseDetails(
        name = "Bicep Curls",
        target = "Arms (Biceps)",
        volume = "3 sets of 12 repetitions",
        intensity = "Controlled, strict form",
        description = "Stand with dumbbells in hands, elbows pinned to your sides. Squeeze biceps to curl dumbbells to shoulder height. Slow, 2-second eccentric lower. No body swinging."
    ),
    "Dumbbell Rows" to ExerciseDetails(
        name = "Dumbbell Rows",
        target = "Core & Back (Lats)",
        volume = "3 sets of 12 repetitions",
        intensity = "Moderate weight with hold",
        description = "Place one knee and one hand on your workout bench for stability. With other hand, pull the dumbbell up to your hip pocket. Squeeze your mid-back at the top, then extend arm fully down."
    ),
    "Bodyweight Bench Squats" to ExerciseDetails(
        name = "Bodyweight Bench Squats",
        target = "Legs (Quads & Glutes)",
        volume = "3 sets of 15 repetitions",
        intensity = "Fluid, explosive stand",
        description = "Stand with feet shoulder-width apart in front of the bench. Lower your hips back and down until your glutes lightly tap the bench pad. Instantly drive through your heels to return to standing."
    ),
    "Light Stretching" to ExerciseDetails(
        name = "Light Stretching",
        target = "Active Recovery",
        volume = "10-15 minutes total",
        intensity = "Relaxed, deep breathing",
        description = "Perform light dynamic and static stretches. Reach for your toes, stretch your shoulders, chest, and hip flexors. Hold stretch positions without pain, breathing deeply."
    )
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LogScreen(viewModel: LogViewModel) {
    var selectedTab by remember { mutableIntStateOf(0) }
    val tabs = listOf("Weight & Journal", "Track Food", "Hypertrophy Workout")

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
                    text = { Text(title, fontWeight = FontWeight.Bold, fontSize = 12.sp) },
                    selectedContentColor = MaterialTheme.colorScheme.primary,
                    unselectedContentColor = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
                )
            }
        }

        Box(modifier = Modifier.fillMaxSize().padding(16.dp)) {
            when (selectedTab) {
                0 -> WeightAndNotesForm(viewModel)
                1 -> MealsLogForm(viewModel)
                2 -> InteractiveWorkoutsForm(viewModel)
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
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
                shape = RoundedCornerShape(24.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text("Today's Scale Weight", fontWeight = FontWeight.Black, color = MaterialTheme.colorScheme.onSurface, fontSize = 16.sp)
                    OutlinedTextField(
                        value = weightInput,
                        onValueChange = { weightInput = it },
                        placeholder = { Text("e.g. 75.5") },
                        label = { Text("Weight (kg)") },
                        modifier = Modifier.fillMaxWidth(),
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                        colors = TextFieldDefaults.outlinedTextFieldColors(
                            focusedBorderColor = Indigo500
                        )
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
                        colors = ButtonDefaults.buttonColors(containerColor = Indigo500),
                        modifier = Modifier.fillMaxWidth().height(48.dp).pressClickEffect(),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Text("Log Scale Weight", fontWeight = FontWeight.Bold, fontSize = 14.sp)
                    }
                }
            }
        }

        item {
            Card(
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                shape = RoundedCornerShape(24.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text("Training Journal Notes", fontWeight = FontWeight.Black, color = MaterialTheme.colorScheme.onSurface, fontSize = 16.sp)
                    OutlinedTextField(
                        value = notesInput,
                        onValueChange = { notesInput = it },
                        placeholder = { Text("How did your sessions feel? Focus points?") },
                        label = { Text("Session Notes") },
                        modifier = Modifier.fillMaxWidth(),
                        minLines = 3,
                        colors = TextFieldDefaults.outlinedTextFieldColors(
                            focusedBorderColor = Indigo500
                        )
                    )
                    Button(
                        onClick = {
                            if (notesInput.isNotBlank()) {
                                viewModel.saveNotes(notesInput)
                                snackbarMessage = "Journal entry saved!"
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = Indigo500),
                        modifier = Modifier.fillMaxWidth().height(48.dp).pressClickEffect(),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Text("Save Journal Note", fontWeight = FontWeight.Bold, fontSize = 14.sp)
                    }
                }
            }
        }

        if (snackbarMessage.isNotBlank()) {
            item {
                Card(
                    colors = CardDefaults.cardColors(containerColor = Indigo50.copy(alpha = 0.5f)),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Box(modifier = Modifier.padding(12.dp), contentAlignment = Alignment.Center) {
                        Text(snackbarMessage, color = Indigo700, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MealsLogForm(viewModel: LogViewModel) {
    var mealName by remember { mutableStateOf("") }
    var proteinInput by remember { mutableStateOf("") }
    var caloriesInput by remember { mutableStateOf("") }
    var snackbarMessage by remember { mutableStateOf("") }

    LazyColumn(
        verticalArrangement = Arrangement.spacedBy(16.dp),
        modifier = Modifier.fillMaxSize()
    ) {
        item {
            Card(
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                shape = RoundedCornerShape(24.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
                    Column {
                        Text("Log Food & Fuel", fontWeight = FontWeight.Black, color = MaterialTheme.colorScheme.onSurface, fontSize = 18.sp)
                        Text(
                            "Add what you ate and at what time to track protein timing",
                            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f),
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.padding(top = 2.dp)
                        )
                    }
                    
                    OutlinedTextField(
                        value = mealName,
                        onValueChange = { mealName = it },
                        label = { Text("What did you eat?") },
                        placeholder = { Text("e.g. Egg White Scramble") },
                        modifier = Modifier.fillMaxWidth(),
                        colors = TextFieldDefaults.outlinedTextFieldColors(focusedBorderColor = Indigo500)
                    )

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        OutlinedTextField(
                            value = proteinInput,
                            onValueChange = { proteinInput = it },
                            label = { Text("Protein (g)") },
                            placeholder = { Text("e.g. 35") },
                            modifier = Modifier.weight(1f),
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            colors = TextFieldDefaults.outlinedTextFieldColors(focusedBorderColor = Indigo500)
                        )

                        OutlinedTextField(
                            value = caloriesInput,
                            onValueChange = { caloriesInput = it },
                            label = { Text("Calories (kcal)") },
                            placeholder = { Text("e.g. 450") },
                            modifier = Modifier.weight(1f),
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            colors = TextFieldDefaults.outlinedTextFieldColors(focusedBorderColor = Indigo500)
                        )
                    }

                    // Gold Spark Tip Box
                    Card(
                        colors = CardDefaults.cardColors(containerColor = Color(0xFFFEF3C7)), // amber-100
                        shape = RoundedCornerShape(14.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Row(
                            modifier = Modifier.padding(14.dp),
                            verticalAlignment = Alignment.Top,
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Text("✨", fontSize = 15.sp)
                            Text(
                                text = "Protein timing matters: try to eat high-quality protein every 3-4 hours to optimize muscle recovery.",
                                color = Color(0xFF92400E), // amber-800
                                fontSize = 12.sp,
                                fontWeight = FontWeight.SemiBold,
                                lineHeight = 16.sp
                            )
                        }
                    }

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
                                snackbarMessage = "Please add a meal description"
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = Indigo500),
                        modifier = Modifier.fillMaxWidth().height(48.dp).pressClickEffect(),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Text("+ Log Entry Now", fontWeight = FontWeight.Bold, fontSize = 14.sp)
                    }
                }
            }
        }

        if (snackbarMessage.isNotBlank()) {
            item {
                Card(
                    colors = CardDefaults.cardColors(containerColor = Indigo50.copy(alpha = 0.5f)),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Box(modifier = Modifier.padding(12.dp), contentAlignment = Alignment.Center) {
                        Text(snackbarMessage, color = Indigo700, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun InteractiveWorkoutsForm(viewModel: LogViewModel) {
    var isWorkoutActive by remember { mutableStateOf(false) }
    var activeExerciseIndex by remember { mutableIntStateOf(0) }
    var selectedPlanDay by remember { mutableIntStateOf(1) }
    var showSuccessMessage by remember { mutableStateOf(false) }

    // Reps & Weight progress tracking state
    val workoutProgressReps = remember { mutableStateMapOf<String, Int>() }
    val workoutProgressWeight = remember { mutableStateMapOf<String, Double>() }
    val workoutProgressCompleted = remember { mutableStateMapOf<String, Boolean>() }

    val currentPlan = WEEKLY_PLAN_DATA.find { it.day == selectedPlanDay } ?: WEEKLY_PLAN_DATA[0]

    LazyColumn(
        verticalArrangement = Arrangement.spacedBy(16.dp),
        modifier = Modifier.fillMaxSize()
    ) {
        if (!isWorkoutActive) {
            // --- 1. OVERVIEW/SELECTOR MODE ---
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text(
                            text = "Daily Workout Routines",
                            fontWeight = FontWeight.Black,
                            fontSize = 20.sp,
                            color = MaterialTheme.colorScheme.onSurface
                        )
                        Text(
                            text = "Daily Consistency Workout Plan V4 — progressive overload",
                            fontSize = 11.sp,
                            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f),
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }

            // Carousel Days Selection Row
            item {
                LazyRow(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    contentPadding = PaddingValues(vertical = 4.dp)
                ) {
                    items(WEEKLY_PLAN_DATA) { plan ->
                        val isSelected = selectedPlanDay == plan.day
                        Card(
                            colors = CardDefaults.cardColors(
                                containerColor = if (isSelected) Indigo500 else MaterialTheme.colorScheme.surface
                            ),
                            shape = RoundedCornerShape(16.dp),
                            elevation = CardDefaults.cardElevation(defaultElevation = 0.5.dp),
                            modifier = Modifier
                                .width(120.dp)
                                .clickable { selectedPlanDay = plan.day }
                                .pressClickEffect()
                        ) {
                            Column(
                                modifier = Modifier.padding(12.dp),
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.spacedBy(4.dp)
                            ) {
                                Text(
                                    text = "ROUTINE",
                                    fontSize = 9.sp,
                                    fontWeight = FontWeight.Black,
                                    color = if (isSelected) Color.White.copy(alpha = 0.7f) else MaterialTheme.colorScheme.onSurface.copy(alpha = 0.4f)
                                )
                                Text(
                                    text = "Day ${plan.day}",
                                    fontSize = 16.sp,
                                    fontWeight = FontWeight.Black,
                                    color = if (isSelected) Color.White else MaterialTheme.colorScheme.onSurface
                                )
                                Text(
                                    text = plan.focus,
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = if (isSelected) Color.White.copy(alpha = 0.8f) else MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f),
                                    maxLines = 1,
                                    modifier = Modifier.padding(top = 2.dp)
                                )
                            }
                        }
                    }
                }
            }

            // Routine Details Card
            item {
                Card(
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    shape = RoundedCornerShape(24.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(
                        modifier = Modifier.padding(20.dp),
                        verticalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        Column {
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(6.dp))
                                    .background(Indigo500.copy(alpha = 0.1f))
                                    .padding(horizontal = 8.dp, vertical = 4.dp)
                            ) {
                                Text(
                                    text = "${currentPlan.category.uppercase()} TARGETS",
                                    color = Indigo500,
                                    fontSize = 9.sp,
                                    fontWeight = FontWeight.Black
                                )
                            }
                            Text(
                                text = "Day ${currentPlan.day}: ${currentPlan.focus} Routine",
                                fontSize = 18.sp,
                                fontWeight = FontWeight.Black,
                                color = MaterialTheme.colorScheme.onSurface,
                                modifier = Modifier.padding(top = 8.dp)
                            )
                        }

                        // Play/Start Button
                        Button(
                            onClick = {
                                // Initialize Workout progress states
                                workoutProgressReps.clear()
                                workoutProgressWeight.clear()
                                workoutProgressCompleted.clear()
                                currentPlan.exercises.forEach { exName ->
                                    val isBodyweight = exName.contains("Squats") || exName.contains("Stretching") || exName.contains("Crunches") || exName.contains("Leg Raises")
                                    val defaultReps = if (exName.contains("Squats")) 15 else if (exName.contains("Stretching")) 1 else if (exName.contains("Crunches")) 20 else 10
                                    val defaultWeight = if (isBodyweight) 0.0 else 15.0
                                    for (s in 0 until 3) {
                                        val key = "$exName-$s"
                                        workoutProgressReps[key] = defaultReps
                                        workoutProgressWeight[key] = defaultWeight
                                        workoutProgressCompleted[key] = false
                                    }
                                }
                                activeExerciseIndex = 0
                                isWorkoutActive = true
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = Indigo500),
                            shape = RoundedCornerShape(16.dp),
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(52.dp)
                                .pressClickEffect()
                        ) {
                            Text("▶ Start Day ${currentPlan.day} Workout", fontWeight = FontWeight.Black, fontSize = 14.sp)
                        }

                        Divider(color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.08f), thickness = 1.dp)

                        // Listed exercises
                        Text(
                            text = "TODAY'S EXERCISES",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Black,
                            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.4f),
                            letterSpacing = 0.5.sp
                        )

                        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                            currentPlan.exercises.forEachIndexed { idx, exName ->
                                val details = EXERCISES_DATABASE[exName]
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .background(Slate100, RoundedCornerShape(12.dp))
                                        .padding(12.dp)
                                ) {
                                    Box(
                                        modifier = Modifier
                                            .size(28.dp)
                                            .clip(CircleShape)
                                            .background(Indigo500),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Text("${idx + 1}", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                                    }
                                    Spacer(modifier = Modifier.width(12.dp))
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(text = exName, fontWeight = FontWeight.Bold, fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurface)
                                        Text(
                                            text = details?.volume ?: "3 sets",
                                            fontSize = 11.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = Indigo500,
                                            modifier = Modifier.padding(top = 1.dp)
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // Quick tips box
            item {
                Card(
                    colors = CardDefaults.cardColors(containerColor = Color(0xFFFEF3C7)),
                    shape = RoundedCornerShape(16.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text(
                            text = "💡 Progressive Overload Principle:",
                            fontWeight = FontWeight.Black,
                            fontSize = 13.sp,
                            color = Color(0xFF92400E)
                        )
                        Text(
                            text = "Aim to write down the weights you actually did. Try to increase weight by 1-2 kg or add 1-2 repetitions compared to your last session to stimulate muscle growth safely.",
                            fontSize = 11.sp,
                            color = Color(0xFFB45309),
                            fontWeight = FontWeight.Bold,
                            lineHeight = 15.sp
                        )
                    }
                }
            }

            if (showSuccessMessage) {
                item {
                    Card(
                        colors = CardDefaults.cardColors(containerColor = Indigo50.copy(alpha = 0.5f)),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Box(modifier = Modifier.padding(12.dp), contentAlignment = Alignment.Center) {
                            Text("✓ Workout Logged & Saved!", color = Indigo700, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                        }
                    }
                }
            }

        } else {
            // --- 2. ACTIVE PLAYER MODE ---
            val activeExerciseName = currentPlan.exercises[activeExerciseIndex]
            val details = EXERCISES_DATABASE[activeExerciseName] ?: EXERCISES_DATABASE["Bench Crunches"]!!

            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text(
                            text = "ACTIVE WORKOUT SESSION",
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Black,
                            color = Indigo500,
                            letterSpacing = 0.5.sp
                        )
                        Text(
                            text = "Day ${currentPlan.day}: ${currentPlan.focus}",
                            fontSize = 15.sp,
                            fontWeight = FontWeight.Black,
                            color = MaterialTheme.colorScheme.onSurface
                        )
                    }

                    TextButton(
                        onClick = { isWorkoutActive = false },
                        colors = ButtonDefaults.textButtonColors(contentColor = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.4f))
                    ) {
                        Text("Exit Session", fontWeight = FontWeight.Bold, fontSize = 12.sp)
                    }
                }
            }

            // Horizontal Steps Bar
            item {
                LazyRow(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Slate100, RoundedCornerShape(16.dp))
                        .padding(4.dp),
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    itemsIndexed(currentPlan.exercises) { idx, exName ->
                        val isCurrent = idx == activeExerciseIndex
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(12.dp))
                                .background(if (isCurrent) Color.White else Color.Transparent)
                                .clickable { activeExerciseIndex = idx }
                                .padding(horizontal = 12.dp, vertical = 6.dp)
                        ) {
                            Text(
                                text = "${idx + 1}. ${if (exName.length > 12) exName.take(10) + "..." else exName}",
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold,
                                color = if (isCurrent) Indigo500 else MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f)
                            )
                        }
                    }
                }
            }

            // Form Guide Details
            item {
                Card(
                    colors = CardDefaults.cardColors(containerColor = Slate100),
                    shape = RoundedCornerShape(20.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(
                        modifier = Modifier.padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(6.dp))
                                    .background(Indigo500.copy(alpha = 0.1f))
                                    .padding(horizontal = 6.dp, vertical = 3.dp)
                            ) {
                                Text(
                                    text = details.target.uppercase(),
                                    color = Indigo500,
                                    fontSize = 9.sp,
                                    fontWeight = FontWeight.Black
                                )
                            }
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = "Form Guide",
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Black,
                                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f)
                            )
                        }

                        Text(
                            text = "${details.name} Guide",
                            fontWeight = FontWeight.Black,
                            fontSize = 15.sp,
                            color = MaterialTheme.colorScheme.onSurface
                        )

                        Text(
                            text = details.description,
                            fontSize = 11.sp,
                            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f),
                            lineHeight = 15.sp
                        )

                        Divider(color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.05f))

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            // Vol block
                            Row(
                                modifier = Modifier
                                    .weight(1f)
                                    .background(Color.White, RoundedCornerShape(10.dp))
                                    .padding(8.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text("💪", fontSize = 14.sp)
                                Spacer(modifier = Modifier.width(6.dp))
                                Column {
                                    Text("ANABOLIC VOL", fontSize = 8.sp, fontWeight = FontWeight.Black, color = Color.Gray)
                                    Text(details.volume, fontSize = 10.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurface)
                                }
                            }

                            // Intensity block
                            Row(
                                modifier = Modifier
                                    .weight(1f)
                                    .background(Color.White, RoundedCornerShape(10.dp))
                                    .padding(8.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text("🎖️", fontSize = 14.sp)
                                Spacer(modifier = Modifier.width(6.dp))
                                Column {
                                    Text("INTENSITY TARGET", fontSize = 8.sp, fontWeight = FontWeight.Black, color = Color.Gray)
                                    Text(details.intensity, fontSize = 10.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurface)
                                }
                            }
                        }
                    }
                }
            }

            // Sets Log Card list
            item {
                Card(
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    shape = RoundedCornerShape(20.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(
                        modifier = Modifier.padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Text(
                            text = "LOGGED WORKING SETS (RECOMMEND: 3 SETS)",
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Black,
                            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.4f),
                            letterSpacing = 0.5.sp
                        )

                        // 3 working sets
                        for (s in 0 until 3) {
                            val key = "$activeExerciseName-$s"
                            val reps = workoutProgressReps[key] ?: 10
                            val weight = workoutProgressWeight[key] ?: 15.0
                            val completed = workoutProgressCompleted[key] ?: false
                            val isBodyweight = activeExerciseName.contains("Squats") || activeExerciseName.contains("Stretching") || activeExerciseName.contains("Crunches") || activeExerciseName.contains("Leg Raises")

                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .background(if (completed) Indigo50.copy(alpha = 0.4f) else Slate50, RoundedCornerShape(12.dp))
                                    .padding(8.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                // Custom Round Checkbox
                                Box(
                                    modifier = Modifier
                                        .size(24.dp)
                                        .clip(CircleShape)
                                        .background(if (completed) Indigo500 else Color.White)
                                        .clickable { workoutProgressCompleted[key] = !completed }
                                        .pressClickEffect(),
                                    contentAlignment = Alignment.Center
                                ) {
                                    if (completed) {
                                        Icon(Icons.Default.Check, contentDescription = "Done", tint = Color.White, modifier = Modifier.size(14.dp))
                                    }
                                }

                                Text(
                                    text = "Working Set ${s + 1}",
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 11.sp,
                                    color = if (completed) Indigo700 else MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f),
                                    modifier = Modifier.weight(1f)
                                )

                                // Reps Input
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                                ) {
                                    Text("REPS", fontSize = 8.sp, fontWeight = FontWeight.Bold, color = Color.Gray)
                                    OutlinedTextField(
                                        value = reps.toString(),
                                        onValueChange = { 
                                            it.toIntOrNull()?.let { r -> workoutProgressReps[key] = r } 
                                        },
                                        modifier = Modifier
                                            .width(54.dp)
                                            .height(44.dp),
                                        shape = RoundedCornerShape(8.dp),
                                        singleLine = true,
                                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                                        colors = TextFieldDefaults.outlinedTextFieldColors(focusedBorderColor = Indigo500)
                                    )
                                }

                                // Weight Input
                                if (!isBodyweight) {
                                    Row(
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                                    ) {
                                        Text("KG", fontSize = 8.sp, fontWeight = FontWeight.Bold, color = Color.Gray)
                                        OutlinedTextField(
                                            value = weight.toString(),
                                            onValueChange = { 
                                                it.toDoubleOrNull()?.let { w -> workoutProgressWeight[key] = w } 
                                            },
                                            modifier = Modifier
                                                .width(58.dp)
                                                .height(44.dp),
                                            shape = RoundedCornerShape(8.dp),
                                            singleLine = true,
                                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                                            colors = TextFieldDefaults.outlinedTextFieldColors(focusedBorderColor = Indigo500)
                                        )
                                    }
                                } else {
                                    Text(
                                        text = "BODYWEIGHT",
                                        fontSize = 8.sp,
                                        fontWeight = FontWeight.Black,
                                        color = Color.Gray,
                                        modifier = Modifier.padding(horizontal = 4.dp)
                                    )
                                }
                            }
                        }
                    }
                }
            }

            // Active player controls footer
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Button(
                        onClick = { activeExerciseIndex = (activeExerciseIndex - 1).coerceAtLeast(0) },
                        enabled = activeExerciseIndex > 0,
                        colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.surface),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier
                            .weight(1f)
                            .height(46.dp)
                            .pressClickEffect()
                    ) {
                        Text("◀ Previous", color = MaterialTheme.colorScheme.onSurface, fontWeight = FontWeight.Bold)
                    }

                    Button(
                        onClick = { activeExerciseIndex = (activeExerciseIndex + 1).coerceAtMost(currentPlan.exercises.size - 1) },
                        enabled = activeExerciseIndex < currentPlan.exercises.size - 1,
                        colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.surface),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier
                            .weight(1f)
                            .height(46.dp)
                            .pressClickEffect()
                    ) {
                        Text("Next ▶", color = MaterialTheme.colorScheme.onSurface, fontWeight = FontWeight.Bold)
                    }
                }
            }

            item {
                Button(
                    onClick = {
                        // Compile all exercise sets and log them
                        currentPlan.exercises.forEach { exName ->
                            val setsList = mutableListOf<Pair<Int, Double>>()
                            for (s in 0 until 3) {
                                val key = "$exName-$s"
                                val reps = workoutProgressReps[key] ?: 10
                                val weight = workoutProgressWeight[key] ?: 0.0
                                setsList.add(Pair(reps, weight))
                            }
                            viewModel.addWorkout(exName, currentPlan.category, setsList)
                        }
                        isWorkoutActive = false
                        showSuccessMessage = true
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = Indigo500),
                    shape = RoundedCornerShape(16.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(52.dp)
                        .pressClickEffect()
                ) {
                    Text("✓ Finish & Record Workout", fontWeight = FontWeight.Black, fontSize = 14.sp)
                }
            }
        }
    }
}
