export interface SetLog {
  id: string;
  reps: number;
  weight: number;
  completed: boolean;
}

export interface Workout {
  id: string;
  name: string;
  category: 'Chest' | 'Back' | 'Legs' | 'Shoulders' | 'Arms' | 'Core' | 'Cardio' | 'Rest';
  sets: SetLog[];
  completed: boolean;
  youtubeUrl?: string;
}

export interface Meal {
  id: string;
  name: string;
  protein: number; // in grams
  calories: number;
  carbs?: number; // in grams
  fiber?: number; // in grams
  timestamp: string; // e.g. "08:30"
}

export interface OneTimeScheduleOverride {
  isRestDay?: boolean;
  assignedRoutineDayIndex?: number;
  customTitle?: string;
  customFocus?: string;
  customExercises?: ParsedWorkoutExercise[];
  shiftedFromDate?: string;
  shiftedToDate?: string;
}

export interface JogPoint {
  lat: number;
  lng: number;
  timestamp: number;
}

export interface JogSession {
  id: string;
  date: string; // YYYY-MM-DD
  startTime: string; // ISO string
  endTime?: string;
  durationSeconds: number;
  distanceKm: number; // in kilometers
  caloriesBurned: number; // in kcal
  avgPaceMinPerKm?: number; // minutes per km
  route?: JogPoint[];
  completed: boolean;
}

export interface DailyLog {
  date: string; // YYYY-MM-DD
  meals: Meal[];
  workouts: Workout[];
  jogs?: JogSession[];
  weight?: number; // in kg or lbs
  notes?: string;
  isRestDay?: boolean;
  oneTimeScheduleOverride?: OneTimeScheduleOverride;
}

export interface UserGoals {
  currentWeight: number;
  targetWeight: number;
  weightUnit: 'lbs' | 'kg';
  initialWeight?: number;
  initialWeightDate?: string;
  currentHeight?: number; // in cm
  gender?: 'male' | 'female';
  age?: number;
  activityLevel?: 'sedentary' | 'light' | 'moderate' | 'active' | 'extreme';
  bodyFat?: number; // percentage
  dailyProteinTarget: number; // grams
  dailyCarbsTarget?: number; // grams
  dailyFiberTarget?: number; // grams
  dailyCalorieTarget: number; // kcal
  weeklyWorkoutDaysTarget: number;
  foodsDocId?: string;
  workoutsDocId?: string;
  driveFolderLink?: string;
  lastSyncTime?: string;
  syncDocsOnBackup?: boolean;
  backupReminderEnabled?: boolean;
  backupReminderTime?: string; // e.g. "22:00"
}

export interface ParsedWorkoutExercise {
  name: string;
  youtubeUrl?: string;
  sets?: number;
  reps?: number;
  weight?: number;
  category?: string;
  isBodyweight?: boolean;
}

export interface ParsedWorkoutDay {
  day: string; // e.g. "Day 1" or "Monday"
  focusArea: string; // e.g. "Core & Chest" or "Rest & Recovery"
  exercises: ParsedWorkoutExercise[];
  isRestDay?: boolean;
  dayOfWeek?: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday' | string;
}

export interface CoachingInsight {
  timestamp: string;
  summary: string;
  text: string;
  type: 'hypertrophy' | 'nutrition' | 'recovery' | 'general';
}
