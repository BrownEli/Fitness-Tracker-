import { DailyLog, UserGoals, CoachingInsight } from './types';

export const INITIAL_GOALS: UserGoals = {
  currentWeight: 75,
  targetWeight: 80,
  weightUnit: 'kg',
  currentHeight: 178,
  dailyProteinTarget: 165, // grams
  dailyCalorieTarget: 2800, // Surplus for lean bulk
  weeklyWorkoutDaysTarget: 5
};

export const INITIAL_LOGS: DailyLog[] = [];

export const INITIAL_INSIGHTS: CoachingInsight[] = [];

