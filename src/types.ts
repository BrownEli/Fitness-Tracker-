export interface SetLog {
  id: string;
  reps: number;
  weight: number;
  completed: boolean;
}

export interface Workout {
  id: string;
  name: string;
  category: 'Chest' | 'Back' | 'Legs' | 'Shoulders' | 'Arms' | 'Core' | 'Cardio';
  sets: SetLog[];
  completed: boolean;
  youtubeUrl?: string;
}

export interface Meal {
  id: string;
  name: string;
  protein: number; // in grams
  calories: number;
  timestamp: string; // e.g. "08:30"
}

export interface DailyLog {
  date: string; // YYYY-MM-DD
  meals: Meal[];
  workouts: Workout[];
  weight?: number; // in kg or lbs
  notes?: string;
}

export interface UserGoals {
  currentWeight: number;
  targetWeight: number;
  weightUnit: 'lbs' | 'kg';
  currentHeight?: number; // in cm
  dailyProteinTarget: number; // grams
  dailyCalorieTarget: number; // kcal
  weeklyWorkoutDaysTarget: number;
  foodsDocId?: string;
  workoutsDocId?: string;
  driveFolderLink?: string;
  lastSyncTime?: string;
  syncDocsOnBackup?: boolean;
}

export interface ParsedWorkoutExercise {
  name: string;
  youtubeUrl?: string;
  sets?: number;
  reps?: number;
  weight?: number;
  category?: string;
}

export interface ParsedWorkoutDay {
  day: string; // e.g. "Day 1"
  focusArea: string; // e.g. "Core & Chest"
  exercises: ParsedWorkoutExercise[];
}

export interface CoachingInsight {
  timestamp: string;
  summary: string;
  text: string;
  type: 'hypertrophy' | 'nutrition' | 'recovery' | 'general';
}
