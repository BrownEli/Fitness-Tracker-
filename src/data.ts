import { DailyLog, UserGoals, CoachingInsight } from './types';

export const INITIAL_GOALS: UserGoals = {
  currentWeight: 165,
  targetWeight: 175,
  weightUnit: 'lbs',
  dailyProteinTarget: 160, // 1g per lb of bodyweight is standard for hypertrophy
  dailyCalorieTarget: 2800, // Surplus for lean bulk
  weeklyWorkoutDaysTarget: 5
};

export const INITIAL_LOGS: DailyLog[] = [];

export const INITIAL_INSIGHTS: CoachingInsight[] = [];

