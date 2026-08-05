import React, { useMemo } from 'react';
import { UserGoals } from '../types';
import {
  Flame,
  Zap,
  Target,
  Dumbbell,
  Sparkles,
  Calendar,
  Bed,
  Info
} from 'lucide-react';

interface BmrCalculatorProps {
  goals: UserGoals;
  onNavigateToSettings?: () => void;
}

type ActivityLevelKey = 'sedentary' | 'light' | 'moderate' | 'active' | 'extreme';

interface ActivityOption {
  key: ActivityLevelKey;
  label: string;
  multiplier: number;
  description: string;
}

const ACTIVITY_LEVELS: Record<ActivityLevelKey, ActivityOption> = {
  sedentary: {
    key: 'sedentary',
    label: 'Sedentary',
    multiplier: 1.2,
    description: 'Desk job, little/no exercise'
  },
  light: {
    key: 'light',
    label: 'Lightly Active',
    multiplier: 1.375,
    description: 'Light exercise 1-3 days/week'
  },
  moderate: {
    key: 'moderate',
    label: 'Moderately Active',
    multiplier: 1.55,
    description: 'Moderate lifting / sports 3-5 days/week'
  },
  active: {
    key: 'active',
    label: 'Very Active',
    multiplier: 1.725,
    description: 'Heavy training 6-7 days/week'
  },
  extreme: {
    key: 'extreme',
    label: 'Extra Active',
    multiplier: 1.9,
    description: 'Intense 2x daily training or physical labor job'
  }
};

export default function BmrCalculator({ goals, onNavigateToSettings }: BmrCalculatorProps) {
  // All parameters derived strictly from Settings (goals)
  const gender = goals.gender || 'male';
  const age = goals.age || 25;
  const weight = goals.currentWeight || 75;
  const weightUnit = goals.weightUnit || 'kg';
  const heightCm = goals.currentHeight || 178;
  const activityKey: ActivityLevelKey = (goals.activityLevel as ActivityLevelKey) || 'moderate';
  const bodyFat = goals.bodyFat;

  // Convert weight to kg for standardized scientific formulas
  const weightKg = useMemo(() => {
    return weightUnit === 'lbs' ? weight * 0.45359237 : weight;
  }, [weight, weightUnit]);

  // Convert weight to lbs for protein scaling standards
  const weightLbs = useMemo(() => {
    return weightUnit === 'lbs' ? weight : weight * 2.20462;
  }, [weight, weightUnit]);

  // 1. Clinical Mifflin-St Jeor Formula
  const bmrMifflin = useMemo(() => {
    if (weightKg <= 0 || heightCm <= 0 || age <= 0) return 0;
    const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
    return Math.round(gender === 'male' ? base + 5 : base - 161);
  }, [gender, age, weightKg, heightCm]);

  // 2. Katch-McArdle Formula (if Body Fat % is recorded in settings)
  const bmrKatch = useMemo(() => {
    if (typeof bodyFat !== 'number' || isNaN(bodyFat) || bodyFat <= 3 || bodyFat >= 60 || weightKg <= 0) {
      return null;
    }
    const leanMassKg = weightKg * (1 - bodyFat / 100);
    return Math.round(370 + 21.6 * leanMassKg);
  }, [weightKg, bodyFat]);

  // Effective BMR: Uses Katch-McArdle if body fat is provided, otherwise Mifflin-St Jeor
  const effectiveBmr = bmrKatch ?? bmrMifflin;

  const selectedActivity = ACTIVITY_LEVELS[activityKey] || ACTIVITY_LEVELS.moderate;

  // Total Daily Energy Expenditure (TDEE) - Weekly Average
  const tdee = Math.round(effectiveBmr * selectedActivity.multiplier);

  // Training vs Rest Day Calorie Breakdown based on weekly workout target
  const workoutDaysTarget = Math.min(7, Math.max(1, goals.weeklyWorkoutDaysTarget || 4));
  const restDaysTarget = Math.max(0, 7 - workoutDaysTarget);

  const restDayTdee = Math.round(effectiveBmr * 1.25); // Sedentary baseline on non-training days
  const weeklyTotalKcal = tdee * 7;
  const trainingDayTdee = restDaysTarget > 0 
    ? Math.round((weeklyTotalKcal - restDayTdee * restDaysTarget) / workoutDaysTarget)
    : tdee;

  // Goal Calorie Scenarios
  const leanBulkCalories = Math.round(tdee + 350); // Hypertrophy surplus (+350 kcal)
  const maintenanceCalories = tdee;
  const fatLossCalories = Math.round(tdee - 400); // Caloric deficit (-400 kcal)

  // Recommended Macro Split for Hypertrophy Lean Bulk
  const targetProteinGrams = Math.round(weightLbs * 1.0); // 1.0g per lb bodyweight
  const targetProteinKcal = targetProteinGrams * 4;
  const targetFatKcal = Math.round(leanBulkCalories * 0.25); // 25% fats
  const targetFatGrams = Math.round(targetFatKcal / 9);
  const targetCarbsKcal = Math.max(0, leanBulkCalories - targetProteinKcal - targetFatKcal);
  const targetCarbsGrams = Math.round(targetCarbsKcal / 4);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6" id="bmr-calculator-card">
      {/* Headline Results: BMR and TDEE */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* BMR Card */}
        <div className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white rounded-2xl p-5 shadow-md relative overflow-hidden">
          <div className="absolute top-3 right-3 text-indigo-400/30">
            <Flame className="w-16 h-16 stroke-[1]" />
          </div>
          <span className="text-[10px] font-black uppercase text-indigo-300 tracking-wider block">
            Basal Metabolic Rate (BMR)
          </span>
          <div className="flex items-baseline gap-1.5 mt-2">
            <span className="text-3xl font-black font-mono text-white tracking-tight">{effectiveBmr}</span>
            <span className="text-xs font-bold text-indigo-200">kcal / day</span>
          </div>
          <p className="text-[11px] text-indigo-200/80 font-medium mt-2 leading-snug">
            Baseline metabolic cost at complete rest (sleeping, organ function).
            {bmrKatch ? ' (Katch-McArdle Lean Mass Formula)' : ' (Mifflin-St Jeor Formula)'}
          </p>
        </div>

        {/* TDEE Card */}
        <div className="bg-gradient-to-br from-violet-600 to-indigo-700 text-white rounded-2xl p-5 shadow-md relative overflow-hidden">
          <div className="absolute top-3 right-3 text-white/20">
            <Zap className="w-16 h-16 stroke-[1]" />
          </div>
          <span className="text-[10px] font-black uppercase text-violet-200 tracking-wider block">
            Total Daily Expenditure (TDEE)
          </span>
          <div className="flex items-baseline gap-1.5 mt-2">
            <span className="text-3xl font-black font-mono text-white tracking-tight">{tdee}</span>
            <span className="text-xs font-bold text-violet-100">kcal / day</span>
          </div>
          <p className="text-[11px] text-violet-100/90 font-medium mt-2 leading-snug">
            Total energy burned per day with your {selectedActivity.multiplier}x {selectedActivity.label} activity multiplier.
          </p>
        </div>
      </div>

      {/* Training Days vs Rest Days TDEE Breakdown */}
      <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
        <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
          <span className="text-xs font-black uppercase text-slate-800 tracking-wider flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-indigo-600" />
            Training Days vs. Rest Days TDEE
          </span>
          <span className="text-[10px] font-mono font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md">
            {workoutDaysTarget} Workout Days / {restDaysTarget} Rest Days
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Training Day Maintenance */}
          <div className="p-3.5 bg-white border border-indigo-200 rounded-xl flex items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                <Dumbbell className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-black text-slate-900 block">Workout Day TDEE</span>
                <span className="text-[10px] text-slate-500 font-medium">Includes workout energy expenditure</span>
              </div>
            </div>
            <div className="text-right shrink-0">
              <span className="text-base font-black font-mono text-indigo-700">{trainingDayTdee}</span>
              <span className="text-[9px] font-bold text-slate-400 block">kcal/day</span>
            </div>
          </div>

          {/* Rest Day Maintenance */}
          <div className="p-3.5 bg-white border border-slate-200 rounded-xl flex items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                <Bed className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-black text-slate-900 block">Rest Day TDEE</span>
                <span className="text-[10px] text-slate-500 font-medium">Baseline non-exercise expenditure</span>
              </div>
            </div>
            <div className="text-right shrink-0">
              <span className="text-base font-black font-mono text-slate-800">{restDayTdee}</span>
              <span className="text-[9px] font-bold text-slate-400 block">kcal/day</span>
            </div>
          </div>
        </div>

        <div className="text-[11px] text-slate-500 font-medium flex items-start gap-2 bg-indigo-50/50 p-2.5 rounded-xl border border-indigo-100/70">
          <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
          <span>
            <strong>Scientific Note:</strong> Standard TDEE averages activity over 7 days. On rest days, you burn closer to your baseline rest rate ({restDayTdee} kcal), while workout days burn higher ({trainingDayTdee} kcal).
          </span>
        </div>
      </div>

      {/* Calorie Goal Scenarios */}
      <div className="space-y-3">
        <h4 className="text-xs font-black uppercase text-slate-500 tracking-wider flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Target className="w-4 h-4 text-indigo-600" />
            Energy & Calorie Scenarios
          </span>
          <span className="text-[11px] text-slate-400 font-normal">Reference Energy Benchmarks</span>
        </h4>

        <div className="grid grid-cols-1 gap-3">
          {/* Lean Bulk / Hypertrophy (RECOMMENDED) */}
          <div className="p-4 bg-indigo-50/70 border-2 border-indigo-200 rounded-2xl flex items-center justify-between gap-3 shadow-xs">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-indigo-900">Hypertrophy Lean Bulk</span>
                <span className="px-2 py-0.5 bg-indigo-600 text-white text-[9px] font-black uppercase rounded-md flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> +350 kcal
                </span>
              </div>
              <p className="text-xs text-slate-600 font-semibold mt-1">
                Optimizes muscle protein synthesis and gym recovery with minimal fat storage.
              </p>
            </div>
            <div className="text-right shrink-0">
              <span className="text-xl font-black font-mono text-indigo-700">{leanBulkCalories}</span>
              <span className="text-[10px] font-bold text-slate-500 block">kcal/day</span>
            </div>
          </div>

          {/* Maintenance */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between gap-3">
            <div>
              <span className="text-xs font-bold text-slate-800">Weight Maintenance</span>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Maintains scale weight steady while recomping body composition over time.
              </p>
            </div>
            <div className="text-right shrink-0">
              <span className="text-lg font-black font-mono text-slate-800">{maintenanceCalories}</span>
              <span className="text-[10px] font-bold text-slate-400 block">kcal/day</span>
            </div>
          </div>

          {/* Moderate Fat Loss / Cutting */}
          <div className="p-4 bg-amber-50/50 border border-amber-200/80 rounded-2xl flex items-center justify-between gap-3">
            <div>
              <span className="text-xs font-bold text-amber-950">Moderate Fat Loss Cut</span>
              <p className="text-xs text-amber-800/80 font-medium mt-0.5">
                -400 kcal deficit designed to burn body fat while preserving lean muscle mass.
              </p>
            </div>
            <div className="text-right shrink-0">
              <span className="text-lg font-black font-mono text-amber-900">{fatLossCalories}</span>
              <span className="text-[10px] font-bold text-amber-700 block">kcal/day</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recommended Macro Split for Hypertrophy */}
      <div className="p-5 bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-2xl space-y-3">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
          <span className="text-xs font-black uppercase text-indigo-400 tracking-wider flex items-center gap-1.5">
            <Dumbbell className="w-4 h-4" /> Recommended Macro Split for Hypertrophy
          </span>
          <span className="text-[10px] font-mono text-slate-400 font-bold">Based on {leanBulkCalories} kcal</span>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-white/10 backdrop-blur-xs p-3 rounded-xl border border-white/10">
            <span className="text-[10px] font-extrabold uppercase text-indigo-300 block">Protein</span>
            <span className="text-base font-black font-mono text-white mt-0.5 block">{targetProteinGrams}g</span>
            <span className="text-[9px] text-slate-400 font-medium block mt-0.5">{targetProteinKcal} kcal</span>
          </div>

          <div className="bg-white/10 backdrop-blur-xs p-3 rounded-xl border border-white/10">
            <span className="text-[10px] font-extrabold uppercase text-sky-300 block">Carbs</span>
            <span className="text-base font-black font-mono text-white mt-0.5 block">{targetCarbsGrams}g</span>
            <span className="text-[9px] text-slate-400 font-medium block mt-0.5">{targetCarbsKcal} kcal</span>
          </div>

          <div className="bg-white/10 backdrop-blur-xs p-3 rounded-xl border border-white/10">
            <span className="text-[10px] font-extrabold uppercase text-emerald-300 block">Healthy Fats</span>
            <span className="text-base font-black font-mono text-white mt-0.5 block">{targetFatGrams}g</span>
            <span className="text-[9px] text-slate-400 font-medium block mt-0.5">{targetFatKcal} kcal</span>
          </div>
        </div>
      </div>
    </div>
  );
}
