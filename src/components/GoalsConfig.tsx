import React, { useState, useMemo } from 'react';
import { UserGoals, DailyLog } from '../types';
import { Settings, Check, Sparkles, Scale, Calendar, Plus, Trash2, History } from 'lucide-react';

interface GoalsConfigProps {
  goals: UserGoals;
  onUpdateGoals: (goals: UserGoals) => void;
  onLogWeight?: (date: string, weight: number) => void;
  onDeleteWeight?: (date: string) => void;
  logs?: DailyLog[];
}

const getTodayString = () => new Date().toISOString().split('T')[0];

export default function GoalsConfig({ goals, onUpdateGoals, onLogWeight, onDeleteWeight, logs = [] }: GoalsConfigProps) {
  const [currentWeight, setCurrentWeight] = useState(goals.currentWeight.toString());
  const [targetWeight, setTargetWeight] = useState(goals.targetWeight.toString());
  const [weightUnit, setWeightUnit] = useState<UserGoals['weightUnit']>(goals.weightUnit);
  const [currentHeight, setCurrentHeight] = useState((goals.currentHeight || 178).toString());
  const [protein, setProtein] = useState(goals.dailyProteinTarget.toString());
  const [calories, setCalories] = useState(goals.dailyCalorieTarget.toString());
  const [workoutDays, setWorkoutDays] = useState(goals.weeklyWorkoutDaysTarget.toString());
  const [saved, setSaved] = useState(false);

  // Weight entry logging state in settings
  const [logWeightInput, setLogWeightInput] = useState(() => goals.currentWeight.toString());
  const [logDateInput, setLogDateInput] = useState(() => getTodayString());
  const [showHistoryList, setShowHistoryList] = useState(false);
  const [weightSavedAlert, setWeightSavedAlert] = useState<string | null>(null);

  // Compute all recorded weight entries sorted chronologically
  const allWeightEntries = useMemo(() => {
    return logs
      .filter((l) => typeof l.weight === 'number' && !isNaN(l.weight) && l.weight! > 0)
      .map((l) => ({ date: l.date, weight: l.weight! }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [logs]);

  // Synchronize local state with props when goals change
  React.useEffect(() => {
    setCurrentWeight(goals.currentWeight.toString());
    setTargetWeight(goals.targetWeight.toString());
    setWeightUnit(goals.weightUnit);
    setCurrentHeight((goals.currentHeight || 178).toString());
    setProtein(goals.dailyProteinTarget.toString());
    setCalories(goals.dailyCalorieTarget.toString());
    setWorkoutDays(goals.weeklyWorkoutDaysTarget.toString());
    setLogWeightInput(goals.currentWeight.toString());
  }, [goals]);

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

  const handleSaveSpecificWeight = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(logWeightInput);
    if (isNaN(val) || val <= 0) return;

    if (onLogWeight) {
      onLogWeight(logDateInput, val);
      // Also sync current weight goal if logging for today
      if (logDateInput === getTodayString()) {
        setCurrentWeight(val.toString());
        onUpdateGoals({
          ...goals,
          currentWeight: val,
          weightUnit
        });
      }
      setWeightSavedAlert(`✓ Recorded ${val} ${weightUnit} for ${logDateInput}`);
      setTimeout(() => setWeightSavedAlert(null), 3000);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedCurrentWeight = parseFloat(currentWeight) || 75;
    
    onUpdateGoals({
      ...goals,
      currentWeight: parsedCurrentWeight,
      targetWeight: parseFloat(targetWeight) || 80,
      weightUnit,
      currentHeight: parseFloat(currentHeight) || 178,
      dailyProteinTarget: parseFloat(protein) || 150,
      dailyCalorieTarget: parseInt(calories) || 2500,
      weeklyWorkoutDaysTarget: parseInt(workoutDays) || 5
    });

    // Also auto-record current weight for today's log if handler is provided
    if (onLogWeight && parsedCurrentWeight > 0) {
      onLogWeight(getTodayString(), parsedCurrentWeight);
    }

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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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

          {/* Current Height */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Current Height</label>
            <div className="relative">
              <input
                type="number"
                step="1"
                required
                value={currentHeight}
                onChange={(e) => setCurrentHeight(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl px-3.5 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none transition-all"
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">cm</span>
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

        <div className="flex items-center justify-end gap-3 pt-2 border-b border-slate-100 pb-5">
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

      {/* Bodyweight Logger & History in Settings */}
      {onLogWeight && (
        <div className="mt-6 pt-5 border-t border-slate-100 space-y-4" id="settings-bodyweight-logger">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Scale className="w-4 h-4 text-purple-600" />
                Scale Weight Log & History
              </h3>
              <p className="text-slate-500 text-xs mt-0.5">Record or edit scale weight entries for specific dates</p>
            </div>

            <button
              type="button"
              onClick={() => setShowHistoryList(!showHistoryList)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                showHistoryList
                  ? 'bg-purple-50 text-purple-700 border-purple-200'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              {showHistoryList ? 'Hide Log History' : `View Log History (${allWeightEntries.length})`}
            </button>
          </div>

          <form onSubmit={handleSaveSpecificWeight} className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3 sm:space-y-0 sm:flex sm:items-center sm:gap-3">
            <div className="flex-1">
              <label className="block text-[10px] font-extrabold text-slate-500 uppercase mb-1">Entry Date</label>
              <input
                type="date"
                required
                value={logDateInput}
                onChange={(e) => setLogDateInput(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-purple-500"
              />
            </div>

            <div className="flex-1">
              <label className="block text-[10px] font-extrabold text-slate-500 uppercase mb-1">Scale Weight ({weightUnit})</label>
              <input
                type="number"
                step="0.1"
                required
                min="20"
                max="500"
                value={logWeightInput}
                onChange={(e) => setLogWeightInput(e.target.value)}
                placeholder={`e.g. ${goals.currentWeight}`}
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-purple-500"
              />
            </div>

            <div className="pt-2 sm:pt-4">
              <button
                type="submit"
                className="w-full sm:w-auto px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Record Reading
              </button>
            </div>
          </form>

          {weightSavedAlert && (
            <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-xl flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600" />
              {weightSavedAlert}
            </div>
          )}

          {/* Weight history records */}
          {showHistoryList && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
              <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Weight History Records</h5>
              {allWeightEntries.length > 0 ? (
                <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                  {allWeightEntries.map((entry) => (
                    <div key={entry.date} className="flex items-center justify-between bg-white border border-slate-200 rounded-lg p-2.5 text-xs">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span className="font-bold text-slate-700">{entry.date}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-black text-purple-700">{entry.weight} {weightUnit}</span>
                        {onDeleteWeight && (
                          <button
                            type="button"
                            onClick={() => onDeleteWeight(entry.date)}
                            className="text-slate-400 hover:text-red-600 p-1 rounded-md transition-colors cursor-pointer"
                            title="Delete weight entry for this date"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400">No weight entries logged yet.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
