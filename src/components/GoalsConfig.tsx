import React, { useState } from 'react';
import { UserGoals } from '../types';
import { Settings, Check, Sparkles } from 'lucide-react';

interface GoalsConfigProps {
  goals: UserGoals;
  onUpdateGoals: (goals: UserGoals) => void;
}

export default function GoalsConfig({ goals, onUpdateGoals }: GoalsConfigProps) {
  const [currentWeight, setCurrentWeight] = useState(goals.currentWeight.toString());
  const [targetWeight, setTargetWeight] = useState(goals.targetWeight.toString());
  const [weightUnit, setWeightUnit] = useState<UserGoals['weightUnit']>(goals.weightUnit);
  const [protein, setProtein] = useState(goals.dailyProteinTarget.toString());
  const [calories, setCalories] = useState(goals.dailyCalorieTarget.toString());
  const [workoutDays, setWorkoutDays] = useState(goals.weeklyWorkoutDaysTarget.toString());
  const [saved, setSaved] = useState(false);

  // Auto-calculate optimized target protein based on hypertrophy standards: 1.0g per lb of bodyweight
  const handleAutoOptimize = () => {
    const weightNum = parseFloat(currentWeight) || 150;
    // Standard rule: 1g protein per lb of bodyweight, or 2.2g per kg.
    const optimizedProtein = weightUnit === 'lbs' 
      ? Math.round(weightNum * 1.0) 
      : Math.round(weightNum * 2.2);

    // Standard rule for clean lean mass bulking: baseline maintenance + 300 to 500 kcal
    // Baseline TDEE estimate = weight in lbs * 15 + 400
    const lbs = weightUnit === 'lbs' ? weightNum : weightNum * 2.20462;
    const optimizedCalories = Math.round(lbs * 15 + 350);

    setProtein(optimizedProtein.toString());
    setCalories(optimizedCalories.toString());
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateGoals({
      currentWeight: parseFloat(currentWeight) || 160,
      targetWeight: parseFloat(targetWeight) || 170,
      weightUnit,
      dailyProteinTarget: parseFloat(protein) || 150,
      dailyCalorieTarget: parseInt(calories) || 2500,
      weeklyWorkoutDaysTarget: parseInt(workoutDays) || 5
    });

    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm" id="goals-config-section">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Settings className="w-5 h-5 text-indigo-600" />
            Anabolic Settings
          </h2>
          <p className="text-slate-500 text-xs mt-0.5">Customize daily anabolic targets and body metrics</p>
        </div>

        <button
          type="button"
          onClick={handleAutoOptimize}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold bg-indigo-55 hover:bg-indigo-100 text-indigo-700 border border-indigo-100 transition-all cursor-pointer"
          title="Auto-calculate protein and calories optimized for muscle building"
          id="auto-optimize-goals-btn"
        >
          <Sparkles className="w-3.5 h-3.5" />
          Auto-Optimize Targets
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5" id="goals-form">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Weight Unit */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Weight Unit</label>
            <div className="grid grid-cols-2 gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setWeightUnit('lbs')}
                className={`py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  weightUnit === 'lbs'
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                lbs (Pound)
              </button>
              <button
                type="button"
                onClick={() => setWeightUnit('kg')}
                className={`py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  weightUnit === 'kg'
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                kg (Kilo)
              </button>
            </div>
          </div>

          {/* Current Weight */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Current Weight</label>
            <div className="relative">
              <input
                type="number"
                step="0.1"
                required
                value={currentWeight}
                onChange={(e) => setCurrentWeight(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl px-3.5 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none transition-all"
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">{weightUnit}</span>
            </div>
          </div>

          {/* Target Weight */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Target Weight</label>
            <div className="relative">
              <input
                type="number"
                step="0.1"
                required
                value={targetWeight}
                onChange={(e) => setTargetWeight(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl px-3.5 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none transition-all"
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">{weightUnit}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Daily Protein Goal */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Daily Protein Goal</label>
            <div className="relative">
              <input
                type="number"
                required
                min="30"
                max="400"
                value={protein}
                onChange={(e) => setProtein(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl px-3.5 py-2 text-sm text-slate-900 focus:outline-none transition-all"
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">g</span>
            </div>
          </div>

          {/* Daily Calorie Goal */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Daily Calorie Goal</label>
            <div className="relative">
              <input
                type="number"
                required
                min="1000"
                max="8000"
                value={calories}
                onChange={(e) => setCalories(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl px-3.5 py-2 text-sm text-slate-900 focus:outline-none transition-all"
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">kcal</span>
            </div>
          </div>

          {/* Weekly Workouts Target */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Weekly Workouts Goal</label>
            <div className="relative">
              <input
                type="number"
                required
                min="1"
                max="7"
                value={workoutDays}
                onChange={(e) => setWorkoutDays(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl px-3.5 py-2 text-sm text-slate-900 focus:outline-none transition-all"
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 font-medium">days</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          {saved && (
            <span className="text-emerald-600 text-xs font-bold flex items-center gap-1" id="goals-saved-alert">
              <Check className="w-3.5 h-3.5" />
              Targets Saved & Propagated!
            </span>
          )}
          <button
            type="submit"
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-100 hover:shadow-indigo-200 transition-all cursor-pointer"
            id="save-goals-btn"
          >
            Apply Muscle Targets
          </button>
        </div>
      </form>
    </div>
  );
}
