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
  dailyProteinTarget: number; // grams
  dailyCalorieTarget: number; // kcal
  weeklyWorkoutDaysTarget: number;
  foodsDocId?: string;
  workoutsDocId?: string;
  lastSyncTime?: string;
}

export interface CoachingInsight {
  timestamp: string;
  summary: string;
  text: string;
  type: 'hypertrophy' | 'nutrition' | 'recovery' | 'general';
}
