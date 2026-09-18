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

export interface MealItemBreakdown {
  name: string;
  portion?: string;
  protein: number;
  carbs: number;
  fiber: number;
  fat: number;
  calories: number;
}

export interface Meal {
  id: string;
  name: string;
  portion?: string; // e.g. "200g" or "350ml"
  protein: number; // in grams
  calories: number;
  carbs?: number; // in grams
  fiber?: number; // in grams
  fat?: number; // in grams
  timestamp: string; // e.g. "08:30"
  items?: MealItemBreakdown[];
  isFavorite?: boolean;
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
  activityType?: 'fast_walk' | 'jog';
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
  userId?: string;
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
  dailyFatTarget?: number; // grams
  dailyCalorieTarget: number; // kcal
  weeklyWorkoutDaysTarget: number;
  foodsDocId?: string;
  workoutsDocId?: string;
  driveFolderLink?: string;
  lastSyncTime?: string;
  syncDocsOnBackup?: boolean;
  backupReminderEnabled?: boolean;
  backupReminderTime?: string; // e.g. "22:00"
  favoriteFoods?: string[]; // list of food names marked as favorite
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

export interface CoachingChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
}

export interface CoachingInsight {
  timestamp: string;
  createdAt?: string;
  summary: string;
  text: string;
  type: 'hypertrophy' | 'nutrition' | 'recovery' | 'general';
  chatMessages?: CoachingChatMessage[];
}
