import { DailyLog, UserGoals, CoachingInsight, ParsedWorkoutDay } from './types';

export const INITIAL_GOALS: UserGoals = {
  currentWeight: 75,
  targetWeight: 80,
  weightUnit: 'kg',
  currentHeight: 178,
  gender: 'male',
  age: 25,
  activityLevel: 'moderate',
  dailyProteinTarget: 165, // grams
  dailyCarbsTarget: 250, // grams
  dailyFiberTarget: 30, // grams
  dailyCalorieTarget: 2800, // Surplus for lean bulk
  weeklyWorkoutDaysTarget: 5,
  backupReminderEnabled: true,
  backupReminderTime: '22:00'
};

export const INITIAL_LOGS: DailyLog[] = [];

export const INITIAL_INSIGHTS: CoachingInsight[] = [];

export const DEFAULT_USER_WORKOUT_PLAN: ParsedWorkoutDay[] = [];


