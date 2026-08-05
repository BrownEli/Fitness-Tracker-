import React, { useState, useMemo } from 'react';
import { DailyLog, UserGoals } from '../types';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  ReferenceLine
} from 'recharts';
import { Dumbbell, Flame, Award, Scale, Plus, Trash2, Calendar, TrendingUp, History, Check, Utensils, Sparkles } from 'lucide-react';

interface AnalyticsProps {
  logs: DailyLog[];
  goals: UserGoals;
  onLogWeight?: (date: string, weight: number) => void;
  onDeleteWeight?: (date: string) => void;
  onUpdateGoals?: (goals: UserGoals) => void;
}

type RangePreset = '7d' | '30d' | '90d';

interface DateRangeState {
  preset: RangePreset;
  startDate: string;
  endDate: string;
}

function getTodayString() {
  return new Date().toISOString().split('T')[0];
}

function getPresetDates(days: number) {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - (days - 1));
  return {
    startDate: start.toISOString().split('T')[0],
    endDate: getTodayString()
  };
}

export default function Analytics({ logs, goals, onLogWeight, onDeleteWeight, onUpdateGoals }: AnalyticsProps) {
  // Compute all recorded weight entries sorted chronologically
  const allWeightEntries = useMemo(() => {
    return logs
      .filter((l) => typeof l.weight === 'number' && !isNaN(l.weight) && l.weight! > 0)
      .map((l) => ({ date: l.date, weight: l.weight! }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [logs]);

  // Determine initial weight & date
  const initialWeight = goals.initialWeight || (allWeightEntries.length > 0 ? allWeightEntries[0].weight : goals.currentWeight);
  const initialWeightDate = goals.initialWeightDate || (allWeightEntries.length > 0 ? allWeightEntries[0].date : 'Baseline');
  const latestWeight = allWeightEntries.length > 0 ? allWeightEntries[allWeightEntries.length - 1].weight : goals.currentWeight;
  const netWeightChange = Math.round((latestWeight - initialWeight) * 10) / 10;

  // Individual date range state for each graph
  const [proteinRange, setProteinRange] = useState<DateRangeState>(() => ({
    preset: '7d',
    ...getPresetDates(7)
  }));

  const [carbsRange, setCarbsRange] = useState<DateRangeState>(() => ({
    preset: '7d',
    ...getPresetDates(7)
  }));

  const [fiberRange, setFiberRange] = useState<DateRangeState>(() => ({
    preset: '7d',
    ...getPresetDates(7)
  }));

  const [calorieRange, setCalorieRange] = useState<DateRangeState>(() => ({
    preset: '7d',
    ...getPresetDates(7)
  }));

  const [volumeRange, setVolumeRange] = useState<DateRangeState>(() => ({
    preset: '7d',
    ...getPresetDates(7)
  }));

  const [weightRange, setWeightRange] = useState<DateRangeState>(() => ({
    preset: '7d',
    ...getPresetDates(7)
  }));

  // Filter weight entries based on selected date range (7d, 30d, 90d)
  const filteredWeightEntries = useMemo(() => {
    return allWeightEntries.filter(
      (entry) => entry.date >= weightRange.startDate && entry.date <= weightRange.endDate
    );
  }, [allWeightEntries, weightRange]);

  // Prepare chart data for line plot based on filtered weight entries
  const weightChartPoints = useMemo(() => {
    if (filteredWeightEntries.length === 0) return [];
    return filteredWeightEntries.map((entry) => {
      const d = new Date(entry.date + 'T00:00:00');
      const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      return {
        date: entry.date,
        label,
        Weight: entry.weight
      };
    });
  }, [filteredWeightEntries]);

  // Helper to filter and sort logs for a specific range state
  const getFilteredLogs = (range: DateRangeState) => {
    return [...logs]
      .filter((l) => l.date >= range.startDate && l.date <= range.endDate)
      .sort((a, b) => a.date.localeCompare(b.date));
  };

  // Helper to format chart X-axis label
  const formatChartData = (filteredLogs: DailyLog[]) => {
    return filteredLogs.map((log) => {
      const totalProtein = log.meals.reduce((sum, meal) => sum + (meal.protein || 0), 0);
      const totalCarbs = log.meals.reduce((sum, meal) => sum + (meal.carbs || 0), 0);
      const totalFiber = log.meals.reduce((sum, meal) => sum + (meal.fiber || 0), 0);
      const totalCalories = log.meals.reduce((sum, meal) => sum + (meal.calories || 0), 0);

      const dateObj = new Date(log.date + 'T00:00:00');
      const isMultiWeek = filteredLogs.length > 14;
      const label = isMultiWeek
        ? dateObj.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' })
        : dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' });

      return {
        date: log.date,
        label,
        Protein: totalProtein,
        Carbs: totalCarbs,
        Fiber: totalFiber,
        ProteinGoal: goals.dailyProteinTarget,
        CarbsGoal: goals.dailyCarbsTarget || 250,
        FiberGoal: goals.dailyFiberTarget || 30,
        Calories: totalCalories,
        CalorieGoal: goals.dailyCalorieTarget,
        Weight: log.weight || null
      };
    });
  };

  const proteinLogs = useMemo(() => getFilteredLogs(proteinRange), [logs, proteinRange]);
  const proteinChartData = useMemo(() => formatChartData(proteinLogs), [proteinLogs, goals]);

  const carbsLogs = useMemo(() => getFilteredLogs(carbsRange), [logs, carbsRange]);
  const carbsChartData = useMemo(() => formatChartData(carbsLogs), [carbsLogs, goals]);

  const fiberLogs = useMemo(() => getFilteredLogs(fiberRange), [logs, fiberRange]);
  const fiberChartData = useMemo(() => formatChartData(fiberLogs), [fiberLogs, goals]);

  const calorieLogs = useMemo(() => getFilteredLogs(calorieRange), [logs, calorieRange]);
  const calorieChartData = useMemo(() => formatChartData(calorieLogs), [calorieLogs, goals]);

  const volumeLogs = useMemo(() => getFilteredLogs(volumeRange), [logs, volumeRange]);

  const weightLogs = useMemo(() => getFilteredLogs(weightRange), [logs, weightRange]);
  const weightChartData = useMemo(() => formatChartData(weightLogs), [weightLogs, goals]);

  // Overall last 7 days overview for top metric badges
  const default7dLogs = useMemo(() => getFilteredLogs({ preset: '7d', ...getPresetDates(7) }), [logs]);
  const default7dChartData = useMemo(() => formatChartData(default7dLogs), [default7dLogs, goals]);

  // Muscle Volume Tracker calculation
  const muscleGroups = ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core', 'Cardio'];

  // Category normalizer for robust exercise matching
  const mapExerciseCategory = (category?: string, name?: string): string => {
    const cat = category?.trim().toLowerCase() || '';
    const nm = name?.trim().toLowerCase() || '';

    if (cat.includes('chest') || cat.includes('pec') || nm.includes('bench') || nm.includes('chest') || nm.includes('fly') || nm.includes('pushup') || nm.includes('push-up')) {
      return 'Chest';
    }
    if (cat.includes('back') || cat.includes('lat') || nm.includes('row') || nm.includes('pullup') || nm.includes('pull-up') || nm.includes('pulldown') || nm.includes('deadlift')) {
      return 'Back';
    }
    if (cat.includes('leg') || cat.includes('quad') || cat.includes('hamstring') || cat.includes('glute') || cat.includes('calf') || nm.includes('squat') || nm.includes('lunge') || nm.includes('leg press')) {
      return 'Legs';
    }
    if (cat.includes('shoulder') || cat.includes('delt') || nm.includes('overhead') || nm.includes('press') || nm.includes('lateral raise') || nm.includes('front raise')) {
      return 'Shoulders';
    }
    if (cat.includes('arm') || cat.includes('bicep') || cat.includes('tricep') || nm.includes('curl') || nm.includes('tricep') || nm.includes('dip')) {
      return 'Arms';
    }
    if (cat.includes('core') || cat.includes('ab') || nm.includes('plank') || nm.includes('crunch') || nm.includes('leg raise')) {
      return 'Core';
    }
    if (cat.includes('cardio') || nm.includes('treadmill') || nm.includes('run') || nm.includes('cycle') || nm.includes('stair')) {
      return 'Cardio';
    }

    // Capitalize first letter if matches standard group
    const capitalized = cat.charAt(0).toUpperCase() + cat.slice(1);
    if (muscleGroups.includes(capitalized)) return capitalized;

    return 'Chest'; // Fallback
  };

  const volumeData = useMemo(() => {
    const counts: Record<string, number> = {
      Chest: 0,
      Back: 0,
      Legs: 0,
      Shoulders: 0,
      Arms: 0,
      Core: 0,
      Cardio: 0
    };

    volumeLogs.forEach((log) => {
      log.workouts?.forEach((workout) => {
        const resolvedCategory = mapExerciseCategory(workout.category, workout.name);
        if (workout.sets && workout.sets.length > 0) {
          // Count completed sets, or all logged sets if completed isn't explicitly false
          const completedCount = workout.sets.filter((s) => s.completed !== false).length;
          counts[resolvedCategory] = (counts[resolvedCategory] || 0) + (completedCount || workout.sets.length);
        } else if (workout.completed) {
          counts[resolvedCategory] = (counts[resolvedCategory] || 0) + 1;
        }
      });
    });

    return muscleGroups
      .map((group) => ({
        name: group,
        value: counts[group] || 0
      }))
      .filter((item) => item.value > 0);
  }, [volumeLogs]);

  // Colors for the muscle volume pie chart
  const COLORS = {
    Chest: '#3b82f6',      // blue-500
    Back: '#0ea5e9',       // sky-500
    Legs: '#6366f1',       // indigo-500
    Shoulders: '#f43f5e',  // rose-500
    Arms: '#f59e0b',       // amber-500
    Core: '#10b981',       // emerald-500
    Cardio: '#64748b'      // slate-500
  };

  const totalVolumeSets = useMemo(() => {
    return volumeData.reduce((acc, curr) => acc + curr.value, 0);
  }, [volumeData]);

  const totalWeeklySets = useMemo(() => {
    return default7dLogs.reduce((acc, log) => {
      return acc + log.workouts.reduce((wAcc, w) => wAcc + w.sets.filter((s) => s.completed !== false).length, 0);
    }, 0);
  }, [default7dLogs]);

  // Custom Tooltip component for consistent light mode theme
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-md">
          <p className="text-slate-400 text-[11px] font-bold uppercase tracking-wider mb-1">{label}</p>
          {payload.map((p: any, index: number) => (
            <p key={index} className="text-xs font-bold" style={{ color: p.color }}>
              {p.name}: {p.value} {p.name.includes('Protein') || p.name.includes('Carb') || p.name.includes('Fiber') ? 'g' : p.name.includes('Weight') ? goals.weightUnit : p.name.includes('Intake') || p.name.includes('Calorie') ? 'kcal' : 'sets'}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  // Reusable Date Range Selector component for each graph card
  const DateRangeSelector = ({
    state,
    onChange,
    idPrefix
  }: {
    state: DateRangeState;
    onChange: (newState: DateRangeState) => void;
    idPrefix: string;
  }) => {
    const handlePresetChange = (preset: RangePreset) => {
      const days = preset === '7d' ? 7 : preset === '30d' ? 30 : 90;
      const { startDate, endDate } = getPresetDates(days);
      onChange({ preset, startDate, endDate });
    };

    return (
      <div className="grid grid-cols-3 gap-1 bg-slate-100/90 p-1 rounded-xl border border-slate-200/80 text-xs w-full sm:w-64">
        {(['7d', '30d', '90d'] as RangePreset[]).map((p) => {
          const label = p === '7d' ? '7 Days' : p === '30d' ? '30 Days' : '90 Days';
          const isActive = state.preset === p;
          return (
            <button
              key={p}
              type="button"
              id={`${idPrefix}-preset-${p}`}
              onClick={() => handlePresetChange(p)}
              className={`w-full py-1.5 rounded-lg font-bold text-xs transition-all text-center ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6" id="analytics-panel">
      {/* Overview Metric Badges */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5" id="analytics-badges-grid">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm shrink-0">
            <Award className="w-4 h-4" />
          </div>
          <div>
            <span className="text-indigo-600 text-[10px] uppercase tracking-wider font-extrabold block">Protein Success</span>
            <h3 className="text-base font-black text-slate-900 mt-0.5">
              {default7dChartData.filter((d) => d.Protein >= d.ProteinGoal).length}/7 <span className="text-slate-500 text-xs font-bold">Days</span>
            </h3>
            <p className="text-[10px] font-semibold text-slate-500 mt-0.5 truncate">Protein target</p>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-600 shadow-sm shrink-0">
            <Utensils className="w-4 h-4" />
          </div>
          <div>
            <span className="text-sky-600 text-[10px] uppercase tracking-wider font-extrabold block">Carbs Target</span>
            <h3 className="text-base font-black text-slate-900 mt-0.5">
              {default7dChartData.filter((d) => d.Carbs >= d.CarbsGoal).length}/7 <span className="text-slate-500 text-xs font-bold">Days</span>
            </h3>
            <p className="text-[10px] font-semibold text-slate-500 mt-0.5 truncate">Glycogen target</p>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shadow-sm shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <span className="text-emerald-600 text-[10px] uppercase tracking-wider font-extrabold block">Fiber Target</span>
            <h3 className="text-base font-black text-slate-900 mt-0.5">
              {default7dChartData.filter((d) => d.Fiber >= d.FiberGoal).length}/7 <span className="text-slate-500 text-xs font-bold">Days</span>
            </h3>
            <p className="text-[10px] font-semibold text-slate-500 mt-0.5 truncate">Gut health target</p>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 shadow-sm shrink-0">
            <Flame className="w-4 h-4" />
          </div>
          <div>
            <span className="text-amber-600 text-[10px] uppercase tracking-wider font-extrabold block">Caloric Surplus</span>
            <h3 className="text-base font-black text-slate-900 mt-0.5">
              {default7dChartData.filter((d) => d.Calories >= d.CalorieGoal).length}/7 <span className="text-slate-500 text-xs font-bold">Days</span>
            </h3>
            <p className="text-[10px] font-semibold text-slate-500 mt-0.5 truncate">Bulking surplus</p>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-50 border border-violet-100 flex items-center justify-center text-violet-600 shadow-sm shrink-0">
            <Dumbbell className="w-4 h-4" />
          </div>
          <div>
            <span className="text-violet-600 text-[10px] uppercase tracking-wider font-extrabold block">Hypertrophy Sets</span>
            <h3 className="text-base font-black text-slate-900 mt-0.5">
              {totalWeeklySets} <span className="text-slate-500 text-xs font-bold">Sets</span>
            </h3>
            <p className="text-[10px] font-semibold text-slate-500 mt-0.5 truncate">Completed volume</p>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 shadow-sm shrink-0">
            <Scale className="w-4 h-4" />
          </div>
          <div>
            <span className="text-purple-600 text-[10px] uppercase tracking-wider font-extrabold block">Scale Weight</span>
            <h3 className="text-base font-black text-slate-900 mt-0.5 truncate">
              {default7dChartData[default7dChartData.length - 1]?.Weight ? (
                `${default7dChartData[default7dChartData.length - 1].Weight} ${goals.weightUnit}`
              ) : 'No log'}
            </h3>
            <p className="text-[10px] text-purple-600 font-extrabold mt-0.5 truncate">
              Goal: {goals.targetWeight} {goals.weightUnit}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly Protein Balance */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h4 className="text-sm font-bold text-slate-900">Anabolic Protein Balance</h4>
              <p className="text-slate-500 text-xs mt-0.5">Tracks daily protein (g) against hypertrophy goals</p>
            </div>
            <DateRangeSelector state={proteinRange} onChange={setProteinRange} idPrefix="protein" />
          </div>

          <div className="h-72" id="protein-progress-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={proteinChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" stroke="#64748b" fontSize={10} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                <ReferenceLine y={goals.dailyProteinTarget} stroke="#ef4444" strokeDasharray="5 5" label={{ value: 'Protein Goal', position: 'top', fill: '#ef4444', fontSize: 9 }} />
                <Bar dataKey="Protein" name="Actual Protein (g)" fill="#4f46e5" radius={[6, 6, 0, 0]} maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Caloric Intake Analytics */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h4 className="text-sm font-bold text-slate-900">Anabolic Calorie Tracker</h4>
              <p className="text-slate-500 text-xs mt-0.5">Ensures calorie surplus to optimize lean mass</p>
            </div>
            <DateRangeSelector state={calorieRange} onChange={setCalorieRange} idPrefix="calorie" />
          </div>

          <div className="h-72" id="calories-progress-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={calorieChartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" stroke="#64748b" fontSize={10} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                <ReferenceLine y={goals.dailyCalorieTarget} stroke="#f59e0b" strokeDasharray="5 5" label={{ value: 'Surplus Target', position: 'top', fill: '#f59e0b', fontSize: 9 }} />
                <Bar dataKey="Calories" name="Intake (kcal)" fill="#0ea5e9" radius={[6, 6, 0, 0]} maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Carbohydrate Intake Analytics */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h4 className="text-sm font-bold text-slate-900">Carbohydrate Intake Tracker</h4>
              <p className="text-slate-500 text-xs mt-0.5">Monitors daily carbohydrates (g) for workout energy</p>
            </div>
            <DateRangeSelector state={carbsRange} onChange={setCarbsRange} idPrefix="carbs" />
          </div>

          <div className="h-72" id="carbs-progress-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={carbsChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" stroke="#64748b" fontSize={10} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                <ReferenceLine y={goals.dailyCarbsTarget || 250} stroke="#0284c7" strokeDasharray="5 5" label={{ value: `Carbs Target (${goals.dailyCarbsTarget || 250}g)`, position: 'top', fill: '#0284c7', fontSize: 9 }} />
                <Bar dataKey="Carbs" name="Carbohydrates (g)" fill="#0284c7" radius={[6, 6, 0, 0]} maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Dietary Fiber Intake Analytics */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h4 className="text-sm font-bold text-slate-900">Dietary Fiber Tracker</h4>
              <p className="text-slate-500 text-xs mt-0.5">Tracks daily dietary fiber (g) for gut health & digestion</p>
            </div>
            <DateRangeSelector state={fiberRange} onChange={setFiberRange} idPrefix="fiber" />
          </div>

          <div className="h-72" id="fiber-progress-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={fiberChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" stroke="#64748b" fontSize={10} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                <ReferenceLine y={goals.dailyFiberTarget || 30} stroke="#059669" strokeDasharray="5 5" label={{ value: `Fiber Target (${goals.dailyFiberTarget || 30}g)`, position: 'top', fill: '#059669', fontSize: 9 }} />
                <Bar dataKey="Fiber" name="Dietary Fiber (g)" fill="#059669" radius={[6, 6, 0, 0]} maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Hypertrophic Volume split - Pie Chart */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h4 className="text-sm font-bold text-slate-900">Muscle Group Volume Distribution</h4>
              <p className="text-slate-500 text-xs mt-0.5">Completed working sets ({totalVolumeSets} sets logged in date range)</p>
            </div>
            <DateRangeSelector state={volumeRange} onChange={setVolumeRange} idPrefix="volume" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
            <div className="col-span-1 md:col-span-6 h-60" id="muscle-volume-pie-chart">
              {volumeData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={volumeData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={75}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {volumeData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[entry.name as keyof typeof COLORS] || '#10b981'}
                        />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="w-full h-full flex flex-col justify-center items-center text-center p-4">
                  <Dumbbell className="w-8 h-8 text-slate-300 mb-2" />
                  <span className="text-xs text-slate-400 font-semibold">No Working Sets Recorded In Selected Date Range</span>
                </div>
              )}
            </div>

            <div className="col-span-1 md:col-span-6 space-y-2 max-h-[220px] overflow-y-auto pr-2" id="muscle-volume-legend">
              {volumeData.length > 0 ? (
                volumeData.map((data, index) => {
                  const targetMin = 10;
                  const pct = Math.min(100, Math.round((data.value / targetMin) * 100));
                  const muscleColor = COLORS[data.name as keyof typeof COLORS] || '#10b981';

                  return (
                    <div key={index} className="flex flex-col text-xs">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-bold text-slate-700 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: muscleColor }}></span>
                          {data.name}
                        </span>
                        <span className="font-mono text-slate-500 font-extrabold">
                          {data.value} sets <span className="text-slate-400 font-medium">/ 10+</span>
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: muscleColor
                          }}
                        ></div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-slate-400 text-xs text-center py-6">Add exercise sets in the workout logger to see your muscle group volume distribution.</p>
              )}
            </div>
          </div>
        </div>

        {/* Body Weight Progress Graph */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5" id="bodyweight-logger-section">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Scale className="w-4 h-4 text-purple-600" />
                Bodyweight Progress Graph
              </h4>
              <p className="text-slate-500 text-xs mt-0.5">Scale weight progression over time</p>
            </div>
            
            <DateRangeSelector state={weightRange} onChange={setWeightRange} idPrefix="weight" />
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-50 border border-slate-150 rounded-xl p-3">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Initial Baseline</span>
              <span className="text-sm font-black text-slate-800 font-mono mt-0.5 block">{initialWeight} {goals.weightUnit}</span>
              <span className="text-[10px] text-slate-400 mt-0.5 block truncate">{initialWeightDate}</span>
            </div>

            <div className="bg-purple-50/60 border border-purple-100 rounded-xl p-3">
              <span className="text-[10px] font-extrabold text-purple-600 uppercase tracking-wider block">Current Scale</span>
              <span className="text-sm font-black text-purple-900 font-mono mt-0.5 block">{latestWeight} {goals.weightUnit}</span>
              <span className="text-[10px] text-purple-500 mt-0.5 block">Latest reading</span>
            </div>

            <div className="bg-indigo-50/60 border border-indigo-100 rounded-xl p-3">
              <span className="text-[10px] font-extrabold text-indigo-600 uppercase tracking-wider block">Target Goal</span>
              <span className="text-sm font-black text-indigo-900 font-mono mt-0.5 block">{goals.targetWeight} {goals.weightUnit}</span>
              <span className="text-[10px] text-indigo-500 mt-0.5 block">Target goal</span>
            </div>

            <div className="bg-slate-50 border border-slate-150 rounded-xl p-3">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Net Change</span>
              <span className={`text-sm font-black font-mono mt-0.5 block ${
                netWeightChange >= 0 ? 'text-emerald-600' : 'text-amber-600'
              }`}>
                {netWeightChange >= 0 ? `+${netWeightChange}` : netWeightChange} {goals.weightUnit}
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5 block">Since starting</span>
            </div>
          </div>

          {/* Chart Display */}
          <div className="h-72" id="weight-progress-chart">
            {weightChartPoints.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weightChartPoints} margin={{ top: 15, right: 15, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="label" stroke="#64748b" fontSize={10} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={11} tickLine={false} domain={['auto', 'auto']} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                  <ReferenceLine y={goals.targetWeight} stroke="#10b981" strokeDasharray="4 4" label={{ value: `Goal (${goals.targetWeight} ${goals.weightUnit})`, position: 'top', fill: '#10b981', fontSize: 10 }} />
                  <Line
                    type="monotone"
                    dataKey="Weight"
                    name={`Weight (${goals.weightUnit})`}
                    stroke="#8b5cf6"
                    strokeWidth={2.5}
                    dot={{ r: 5, strokeWidth: 2, fill: '#ffffff' }}
                    activeDot={{ r: 7 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full border-2 border-dashed border-slate-200 rounded-xl flex flex-col justify-center items-center text-center p-6">
                <Scale className="w-10 h-10 text-slate-300 mb-2" />
                <h5 className="text-xs font-bold text-slate-700">No Weight Entries Logged for Selected Period</h5>
                <p className="text-slate-400 text-xs mt-1 max-w-sm">Use Settings to update your current scale weight or record entries for past dates.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

