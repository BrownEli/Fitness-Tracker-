import React, { useState, useMemo } from 'react';
import { DailyLog } from '../types';
import { formatDateDDMMYYYY } from '../dateUtils';
import { formatDuration } from './JogTracker';
import { Footprints, Dumbbell, Flame, Timer, Calendar, Utensils, Star } from 'lucide-react';
import { normalizeWorkoutCategory } from '../workoutCategories';

interface ActivityRecordsProps {
  logs: DailyLog[];
  weightUnit?: 'kg' | 'lbs';
  favoriteFoods?: string[];
  onToggleFavoriteFood?: (foodName: string) => void;
}

type StrictDaysFilter = '7' | '30' | '90';

interface FlatMealRecord {
  id: string;
  date: string;
  timestamp?: string;
  name: string;
  portion?: string;
  calories: number;
  protein: number;
  carbs: number;
  fiber: number;
  isFavorite: boolean;
}

interface FlatJogRecord {
  id: string;
  date: string;
  activityType: 'fast_walk' | 'jog';
  durationSeconds: number;
  distanceKm: number;
  caloriesBurned: number;
  avgPaceMinPerKm?: number;
  startTime?: string;
}

interface FlatSetRecord {
  setNumber: number;
  reps: number;
  weight: number;
  completed: boolean;
}

interface FlatWorkoutRecord {
  id: string;
  date: string;
  workoutName: string;
  category: string;
  completed: boolean;
  sets: FlatSetRecord[];
  totalReps: number;
  totalVolume: number;
}

function formatPace(paceMin?: number, durationSec?: number, distanceKm?: number): string {
  let p = paceMin;
  if ((!p || p <= 0 || !isFinite(p)) && durationSec && distanceKm && distanceKm > 0) {
    p = (durationSec / 60) / distanceKm;
  }
  if (!p || p <= 0 || !isFinite(p)) return '—';
  const mins = Math.floor(p);
  const secs = Math.round((p - mins) * 60);
  return `${mins}'${secs.toString().padStart(2, '0')}" / km`;
}

function isWithinDays(dateStr: string, range: StrictDaysFilter): boolean {
  if (!dateStr) return false;
  const days = range === '7' ? 7 : range === '30' ? 30 : 90;
  const parts = dateStr.split('-');
  if (parts.length !== 3) return false;
  const recordDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10), 0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() - (days - 1));

  return recordDate.getTime() >= cutoff.getTime();
}

export default function ActivityRecords({ logs, weightUnit = 'kg', favoriteFoods = [], onToggleFavoriteFood }: ActivityRecordsProps) {
  const [globalTimeRange, setGlobalTimeRange] = useState<StrictDaysFilter>('30');
  const [activeSection, setActiveSection] = useState<'all' | 'jogs' | 'workouts' | 'meals'>('all');

  const [jogFilter, setJogFilter] = useState<'all' | 'jog' | 'fast_walk'>('all');
  const [jogTimeRange, setJogTimeRange] = useState<StrictDaysFilter>('30');

  const [workoutCategoryFilter, setWorkoutCategoryFilter] = useState<string>('all');
  const [workoutTimeRange, setWorkoutTimeRange] = useState<StrictDaysFilter>('30');

  const [mealFilter, setMealFilter] = useState<'all' | 'favorites'>('all');
  const [mealTimeRange, setMealTimeRange] = useState<StrictDaysFilter>('30');

  const handleGlobalRangeChange = (range: StrictDaysFilter) => {
    setGlobalTimeRange(range);
    setJogTimeRange(range);
    setWorkoutTimeRange(range);
    setMealTimeRange(range);
  };

  // 1. Extract all Jog and Fast Walk records across all daily logs
  const allJogs = useMemo<FlatJogRecord[]>(() => {
    const list: FlatJogRecord[] = [];

    logs.forEach((log) => {
      // Direct jog entries
      if (log.jogs && log.jogs.length > 0) {
        log.jogs.forEach((j) => {
          list.push({
            id: j.id,
            date: j.date || log.date,
            activityType: j.activityType === 'fast_walk' ? 'fast_walk' : 'jog',
            durationSeconds: j.durationSeconds || 0,
            distanceKm: j.distanceKm || 0,
            caloriesBurned: j.caloriesBurned || 0,
            avgPaceMinPerKm: j.avgPaceMinPerKm,
            startTime: j.startTime
          });
        });
      }

      // Also check workouts with category Cardio or jog ID
      if (log.workouts && log.workouts.length > 0) {
        log.workouts.forEach((w) => {
          if (w.category === 'Cardio' && w.id?.startsWith('jog-')) {
            const jogId = w.id.replace('jog-', '');
            const alreadyExists = list.some((it) => it.id === jogId || it.id === w.id);
            if (!alreadyExists) {
              const isWalk = w.name?.toLowerCase().includes('walk');
              const distMatch = w.name?.match(/([\d.]+)\s*km/i);
              const dist = distMatch ? parseFloat(distMatch[1]) : 0;
              const set = w.sets?.[0];
              const durationMin = set ? set.reps : 0;
              const calories = set ? set.weight : 0;

              list.push({
                id: w.id,
                date: log.date,
                activityType: isWalk ? 'fast_walk' : 'jog',
                durationSeconds: durationMin * 60,
                distanceKm: dist,
                caloriesBurned: calories
              });
            }
          }
        });
      }
    });

    return list.sort((a, b) => b.date.localeCompare(a.date));
  }, [logs]);

  // 2. Extract all workouts where user actually logged sets and repetitions
  const allWorkouts = useMemo<FlatWorkoutRecord[]>(() => {
    const list: FlatWorkoutRecord[] = [];

    logs.forEach((log) => {
      if (!log.workouts || log.workouts.length === 0) return;

      log.workouts.forEach((w) => {
        // Filter out Rest days and Cardio/Jog entries
        if (w.category === 'Rest' || w.category === 'Cardio' || w.id?.startsWith('jog-')) {
          return;
        }
        if (
          w.name?.toLowerCase().includes('rest') ||
          w.name?.toLowerCase().includes('jog') ||
          w.name?.toLowerCase().includes('walk')
        ) {
          return;
        }

        // Include workouts where user actually logged sets with repetitions
        const setsWithReps = (w.sets || []).filter(
          (s) => s && (s.completed || (Number(s.reps) > 0) || (Number(s.weight) > 0))
        );

        if (setsWithReps.length > 0 || w.completed) {
          const activeSets = setsWithReps.length > 0 ? setsWithReps : (w.sets || []);
          const mappedSets: FlatSetRecord[] = activeSets.map((s, idx) => ({
            setNumber: idx + 1,
            reps: Number(s.reps) || 0,
            weight: Number(s.weight) || 0,
            completed: s.completed ?? true
          }));

          const totalReps = mappedSets.reduce((sum, s) => sum + s.reps, 0);
          const totalVolume = mappedSets.reduce((sum, s) => sum + (s.reps * s.weight), 0);

          list.push({
            id: `${log.date}-${w.id || w.name}`,
            date: log.date,
            workoutName: w.name,
            category: normalizeWorkoutCategory(w.category, w.name),
            completed: w.completed ?? true,
            sets: mappedSets,
            totalReps,
            totalVolume
          });
        }
      });
    });

    return list.sort((a, b) => b.date.localeCompare(a.date));
  }, [logs]);

  // Filtered Jogs by Activity Type and Time Range
  const filteredJogs = useMemo(() => {
    return allJogs.filter((j) => {
      if (jogFilter !== 'all' && j.activityType !== jogFilter) return false;
      if (!isWithinDays(j.date, jogTimeRange)) return false;
      return true;
    });
  }, [allJogs, jogFilter, jogTimeRange]);

  // Clean, ordered workout categories grouped strictly into standard muscle groups
  const workoutCategories = useMemo(() => {
    const priority = ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core', 'Cardio'];
    const presentCats = new Set<string>();
    allWorkouts.forEach((w) => {
      if (w.category) presentCats.add(w.category);
    });

    return priority.filter((p) => presentCats.has(p));
  }, [allWorkouts]);

  // Filtered Workouts by Category and Time Range
  const filteredWorkouts = useMemo(() => {
    return allWorkouts.filter((w) => {
      if (workoutCategoryFilter !== 'all' && w.category !== workoutCategoryFilter) return false;
      if (!isWithinDays(w.date, workoutTimeRange)) return false;
      return true;
    });
  }, [allWorkouts, workoutCategoryFilter, workoutTimeRange]);

  // Aggregated Jog Stats for the Active Filter
  const jogTotalKm = useMemo(() => {
    return filteredJogs.reduce((acc, j) => acc + j.distanceKm, 0);
  }, [filteredJogs]);

  const jogTotalCalories = useMemo(() => {
    return filteredJogs.reduce((acc, j) => acc + j.caloriesBurned, 0);
  }, [filteredJogs]);

  // Aggregated Workout Stats for the Active Filter
  const workoutTotalSets = useMemo(() => {
    return filteredWorkouts.reduce((acc, w) => acc + w.sets.length, 0);
  }, [filteredWorkouts]);

  const workoutTotalReps = useMemo(() => {
    return filteredWorkouts.reduce((acc, w) => acc + w.totalReps, 0);
  }, [filteredWorkouts]);

  // Extract all Logged Meals across all daily logs
  const allMeals = useMemo<FlatMealRecord[]>(() => {
    const list: FlatMealRecord[] = [];
    const favSet = new Set((favoriteFoods || []).map((f) => f.toLowerCase().trim()));

    logs.forEach((log) => {
      if (log.meals && log.meals.length > 0) {
        log.meals.forEach((m) => {
          const norm = (m.name || '').toLowerCase().trim();
          const isFav = m.isFavorite === true || favSet.has(norm);
          list.push({
            id: m.id,
            date: log.date,
            timestamp: m.timestamp,
            name: m.name,
            portion: m.portion || '—',
            calories: m.calories || 0,
            protein: m.protein || 0,
            carbs: m.carbs || 0,
            fiber: m.fiber || 0,
            isFavorite: isFav
          });
        });
      }
    });

    return list.sort((a, b) => {
      const d = b.date.localeCompare(a.date);
      if (d !== 0) return d;
      return (b.timestamp || '').localeCompare(a.timestamp || '');
    });
  }, [logs, favoriteFoods]);

  // Filtered Meals by Status and Time Range (7, 30, 90 Days)
  const filteredMeals = useMemo(() => {
    return allMeals.filter((m) => {
      if (mealFilter === 'favorites' && !m.isFavorite) return false;
      if (!isWithinDays(m.date, mealTimeRange)) return false;
      return true;
    });
  }, [allMeals, mealFilter, mealTimeRange]);

  const mealTotalCalories = useMemo(() => {
    return filteredMeals.reduce((acc, m) => acc + m.calories, 0);
  }, [filteredMeals]);

  const mealTotalProtein = useMemo(() => {
    return filteredMeals.reduce((acc, m) => acc + m.protein, 0);
  }, [filteredMeals]);

  return (
    <div className="space-y-8" id="activity-records-container">
      {/* Global Time Range Filter - The Three Tab Choices Stretched Across the Whole Screen */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3" id="records-global-time-filter">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <span className="text-sm font-black text-slate-800 tracking-tight">Time Period Filter</span>
          <span className="text-sm font-semibold text-slate-500 font-mono">Showing records from the last {globalTimeRange} days</span>
        </div>

        {/* Three Tab Choices Stretched Across Whole Screen */}
        <div className="w-full grid grid-cols-3 bg-slate-100 p-1.5 rounded-xl border border-slate-200" id="global-three-tab-choices">
          {[
            { id: '7', label: '7 Days' },
            { id: '30', label: '30 Days' },
            { id: '90', label: '90 Days' }
          ].map((preset) => (
            <button
              key={preset.id}
              type="button"
              id={`global-range-${preset.id}`}
              onClick={() => handleGlobalRangeChange(preset.id as StrictDaysFilter)}
              className={`w-full py-2.5 rounded-lg text-sm font-black transition-all text-center cursor-pointer ${
                globalTimeRange === preset.id
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* Table View Switcher */}
        <div className="w-full grid grid-cols-2 sm:grid-cols-4 bg-slate-100/80 p-1 rounded-xl border border-slate-200/80 gap-1">
          {[
            { id: 'all', label: 'All Tables' },
            { id: 'jogs', label: 'Outdoor Jogs' },
            { id: 'workouts', label: 'Workouts & Sets' },
            { id: 'meals', label: 'Logged Foods' }
          ].map((sec) => (
            <button
              key={sec.id}
              type="button"
              onClick={() => setActiveSection(sec.id as any)}
              className={`w-full py-2 px-2 text-center rounded-lg text-sm font-bold transition-all cursor-pointer truncate ${
                activeSection === sec.id
                  ? 'bg-white text-indigo-700 shadow-2xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {sec.label}
            </button>
          ))}
        </div>
      </div>

      {/* CARD 1: OUTDOOR JOGS & FAST WALKS TABLE */}
      {(activeSection === 'all' || activeSection === 'jogs') && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs" id="card-jogs-table">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Footprints className="w-5 h-5 text-indigo-600" />
                </span>
                <h3 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                  Outdoor Jogs & Fast Walks
                </h3>
                <span className="bg-indigo-50 text-indigo-700 font-bold px-3 py-1 rounded-xl text-sm border border-indigo-100">
                  {filteredJogs.length} Sessions Logged
                </span>
              </div>
              <p className="text-slate-500 text-sm font-medium">
                Complete history of recorded outdoor GPS jogs, fast walks, distances, and pacing.
              </p>
            </div>

            {/* Aggregate Metrics Bar */}
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="bg-slate-50 border border-slate-200/80 px-3.5 py-2 rounded-xl text-center">
                <span className="text-sm text-slate-400 font-bold uppercase tracking-wider block">Total Distance</span>
                <span className="text-base font-black text-slate-800 font-mono">{jogTotalKm.toFixed(2)} km</span>
              </div>
              <div className="bg-slate-50 border border-slate-200/80 px-3.5 py-2 rounded-xl text-center">
                <span className="text-sm text-slate-400 font-bold uppercase tracking-wider block">Burned Calories</span>
                <span className="text-base font-black text-amber-600 font-mono">{jogTotalCalories} kcal</span>
              </div>
            </div>
          </div>

          {/* Filter Controls for Jogs */}
          <div className="space-y-3 pt-4 pb-2">
            {/* The Three Tab Choices Stretched Across Whole Screen */}
            <div className="w-full grid grid-cols-3 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
              {[
                { id: '7', label: '7 Days' },
                { id: '30', label: '30 Days' },
                { id: '90', label: '90 Days' }
              ].map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  id={`jog-range-${preset.id}`}
                  onClick={() => setJogTimeRange(preset.id as any)}
                  className={`w-full py-2.5 rounded-lg text-sm font-bold transition-all text-center cursor-pointer ${
                    jogTimeRange === preset.id
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Activity Type Filters */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
              {[
                { id: 'all', label: 'All Sessions' },
                { id: 'jog', label: 'Outdoor Jogs' },
                { id: 'fast_walk', label: 'Fast Walks' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setJogFilter(tab.id as any)}
                  className={`px-3.5 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all cursor-pointer border ${
                    jogFilter === tab.id
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-800'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Jogs Table - Fixed Height & Scrollable */}
          <div className="mt-3 max-h-[380px] sm:max-h-[420px] overflow-y-auto overflow-x-auto rounded-xl border border-slate-200 shadow-2xs">
            <table className="w-full text-left border-collapse min-w-[620px]">
              <thead className="sticky top-0 z-10 bg-slate-100/95 backdrop-blur-xs border-b border-slate-200 shadow-2xs">
                <tr className="text-slate-700 text-sm font-bold uppercase tracking-wider">
                  <th className="py-3 px-4">Activity</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Distance</th>
                  <th className="py-3 px-4">Duration</th>
                  <th className="py-3 px-4">Average Pace</th>
                  <th className="py-3 px-4 text-right">Energy Burned</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm text-slate-800 font-medium bg-white">
              {filteredJogs.length > 0 ? (
                filteredJogs.map((j) => (
                  <tr key={j.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-4">
                      {j.activityType === 'fast_walk' ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-sm font-bold">
                          <Footprints className="w-3.5 h-3.5 text-emerald-600" />
                          Fast Walk
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-xl text-sm font-bold">
                          <Footprints className="w-3.5 h-3.5 text-indigo-600" />
                          Outdoor Jog
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                        <span className="font-semibold text-slate-900 font-mono">
                          {formatDateDDMMYYYY(j.date)}
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-bold font-mono text-slate-900 text-sm">
                        {j.distanceKm.toFixed(2)} km
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5 text-slate-700">
                        <Timer className="w-4 h-4 text-slate-400 shrink-0" />
                        <span className="font-mono text-sm">{formatDuration(j.durationSeconds)}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-mono text-sm text-slate-700">
                        {formatPace(j.avgPaceMinPerKm, j.durationSeconds, j.distanceKm)}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center justify-end gap-1 font-bold font-mono text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200/60 text-sm">
                        <Flame className="w-3.5 h-3.5 text-amber-600" />
                        {j.caloriesBurned} kcal
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-400 bg-slate-50/30">
                    <Footprints className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <p className="text-sm font-semibold text-slate-600">No jogs or fast walks found</p>
                    <p className="text-sm text-slate-400 mt-1">
                      {allJogs.length === 0
                        ? 'Record an outdoor walk or jog to see it listed here.'
                        : `No sessions recorded in the selected ${jogTimeRange === 'all' ? 'filters' : `${jogTimeRange}-day window`}.`}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* CARD 2: COMPLETED STRENGTH WORKOUTS & SETS TABLE */}
      {(activeSection === 'all' || activeSection === 'workouts') && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs" id="card-workouts-table">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="p-2 bg-violet-50 text-violet-600 rounded-xl">
                  <Dumbbell className="w-5 h-5 text-violet-600" />
                </span>
                <h3 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                  Completed Workouts & Sets
                </h3>
                <span className="bg-violet-50 text-violet-700 font-bold px-3 py-1 rounded-xl text-sm border border-violet-100">
                  {filteredWorkouts.length} Exercises Performed
                </span>
              </div>
              <p className="text-slate-500 text-sm font-medium">
                Detailed log of all completed exercise workouts, individual sets, and exact repetitions performed.
              </p>
            </div>

            {/* Aggregate Metrics Bar */}
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="bg-slate-50 border border-slate-200/80 px-3.5 py-2 rounded-xl text-center">
                <span className="text-sm text-slate-400 font-bold uppercase tracking-wider block">Total Sets</span>
                <span className="text-base font-black text-slate-800 font-mono">{workoutTotalSets} Sets</span>
              </div>
              <div className="bg-slate-50 border border-slate-200/80 px-3.5 py-2 rounded-xl text-center">
                <span className="text-sm text-slate-400 font-bold uppercase tracking-wider block">Total Reps</span>
                <span className="text-base font-black text-indigo-600 font-mono">{workoutTotalReps} Reps</span>
              </div>
            </div>
          </div>

          {/* Filter Controls for Workouts */}
          <div className="space-y-3 pt-4 pb-2">
            {/* The Three Tab Choices Stretched Across Whole Screen */}
            <div className="w-full grid grid-cols-3 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
              {[
                { id: '7', label: '7 Days' },
                { id: '30', label: '30 Days' },
                { id: '90', label: '90 Days' }
              ].map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  id={`workout-range-${preset.id}`}
                  onClick={() => setWorkoutTimeRange(preset.id as any)}
                  className={`w-full py-2.5 rounded-lg text-sm font-bold transition-all text-center cursor-pointer ${
                    workoutTimeRange === preset.id
                      ? 'bg-violet-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Category Filter Chips */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 lg:pb-0">
              <button
                type="button"
                onClick={() => setWorkoutCategoryFilter('all')}
                className={`px-3.5 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all cursor-pointer border ${
                  workoutCategoryFilter === 'all'
                    ? 'bg-violet-600 text-white border-violet-600 shadow-xs'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-800'
                }`}
              >
                All Categories
              </button>
              {workoutCategories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setWorkoutCategoryFilter(cat)}
                  className={`px-3.5 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all cursor-pointer border ${
                    workoutCategoryFilter === cat
                      ? 'bg-violet-600 text-white border-violet-600 shadow-xs'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-800'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Workouts Table - Fixed Height & Scrollable */}
          <div className="mt-3 max-h-[380px] sm:max-h-[420px] overflow-y-auto overflow-x-auto rounded-xl border border-slate-200 shadow-2xs">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead className="sticky top-0 z-10 bg-slate-100/95 backdrop-blur-xs border-b border-slate-200 shadow-2xs">
                <tr className="text-slate-700 text-sm font-bold uppercase tracking-wider">
                  <th className="py-3 px-4">Exercise</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Sets & Repetitions Logged</th>
                  <th className="py-3 px-4 text-right">Volume</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm text-slate-800 font-medium bg-white">
                {filteredWorkouts.length > 0 ? (
                  filteredWorkouts.map((w) => (
                    <tr key={w.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4 align-top">
                        <span className="font-bold text-slate-900 text-sm block">
                          {w.workoutName}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 align-top">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                          <span className="font-semibold text-slate-900 font-mono">
                            {formatDateDDMMYYYY(w.date)}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 align-top">
                        <span className="inline-flex items-center px-2.5 py-0.5 bg-slate-100 text-slate-700 border border-slate-250 rounded-lg text-sm font-semibold">
                          {w.category}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 align-top">
                        {/* Detailed Sets and Repetitions Breakdown */}
                        <div className="flex flex-wrap gap-1.5 max-w-lg">
                          {w.sets.map((s, sIdx) => (
                            <span
                              key={`set-${w.id}-${sIdx}`}
                              className="inline-flex items-center px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 shadow-2xs font-medium"
                            >
                              <span className="text-violet-700 font-black mr-1.5">Set {s.setNumber}:</span>
                              <span className="font-bold text-slate-900">{s.reps} reps</span>
                              {s.weight > 0 ? (
                                <span className="text-slate-500 font-mono ml-1.5 font-semibold">
                                  × {s.weight} {weightUnit}
                                </span>
                              ) : (
                                <span className="text-slate-400 ml-1.5 font-semibold">
                                  • Bodyweight
                                </span>
                              )}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right align-top">
                        <div className="font-mono text-sm font-bold text-slate-900">
                          {w.totalReps} Reps
                        </div>
                        {w.totalVolume > 0 && (
                          <div className="text-sm text-slate-500 font-mono font-medium mt-0.5">
                            {w.totalVolume.toLocaleString()} {weightUnit} total
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-slate-400 bg-slate-50/30">
                      <Dumbbell className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                      <p className="text-sm font-semibold text-slate-600">No workout exercises found</p>
                      <p className="text-sm text-slate-400 mt-1">
                        {allWorkouts.length === 0
                          ? 'Complete sets in the Workout Logger to record your sets and repetitions here.'
                          : `No exercises recorded in the selected ${workoutTimeRange}-day window.`}
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CARD 3: LOGGED FOODS & FAVORITES TABLE */}
      {(activeSection === 'all' || activeSection === 'meals') && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs" id="card-meals-table">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                  <Utensils className="w-5 h-5 text-emerald-600" />
                </span>
                <h3 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                  Logged Foods History
                </h3>
                <span className="bg-emerald-50 text-emerald-700 font-bold px-3 py-1 rounded-xl text-sm border border-emerald-100">
                  {filteredMeals.length} Foods Logged
                </span>
              </div>
              <p className="text-slate-500 text-sm font-medium">
                Complete history of recorded foods, macronutrient breakdowns, portions, and star favorites.
              </p>
            </div>

            {/* Aggregate Metrics Bar */}
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="bg-slate-50 border border-slate-200/80 px-3.5 py-2 rounded-xl text-center">
                <span className="text-sm text-slate-400 font-bold uppercase tracking-wider block">Total Foods</span>
                <span className="text-base font-black text-slate-800 font-mono">{filteredMeals.length} Foods</span>
              </div>
              <div className="bg-slate-50 border border-slate-200/80 px-3.5 py-2 rounded-xl text-center">
                <span className="text-sm text-slate-400 font-bold uppercase tracking-wider block">Total Energy</span>
                <span className="text-base font-black text-amber-600 font-mono">{mealTotalCalories.toLocaleString()} kcal</span>
              </div>
              <div className="bg-slate-50 border border-slate-200/80 px-3.5 py-2 rounded-xl text-center">
                <span className="text-sm text-slate-400 font-bold uppercase tracking-wider block">Total Protein</span>
                <span className="text-base font-black text-emerald-600 font-mono">{mealTotalProtein}g</span>
              </div>
            </div>
          </div>

          {/* Filter Controls for Meals */}
          <div className="space-y-3 pt-4 pb-2">
            {/* The Three Tab Choices Stretched Across Whole Screen */}
            <div className="w-full grid grid-cols-3 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
              {[
                { id: '7', label: '7 Days' },
                { id: '30', label: '30 Days' },
                { id: '90', label: '90 Days' }
              ].map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  id={`meal-range-${preset.id}`}
                  onClick={() => setMealTimeRange(preset.id as any)}
                  className={`w-full py-2.5 rounded-lg text-sm font-bold transition-all text-center cursor-pointer ${
                    mealTimeRange === preset.id
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Status Filter (All vs Favorites Only) */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
              <button
                type="button"
                onClick={() => setMealFilter('all')}
                className={`px-3.5 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all cursor-pointer border ${
                  mealFilter === 'all'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-800'
                }`}
              >
                All Logged Foods
              </button>
              <button
                type="button"
                onClick={() => setMealFilter('favorites')}
                className={`px-3.5 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all cursor-pointer border flex items-center gap-1.5 ${
                  mealFilter === 'favorites'
                    ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-800'
                }`}
              >
                <Star className={`w-4 h-4 ${mealFilter === 'favorites' ? 'fill-white text-white' : 'fill-amber-400 text-amber-500'}`} />
                <span>Starred Favorites Only</span>
              </button>
            </div>
          </div>

          {/* Meals Table - Fixed Height & Scrollable */}
          <div className="mt-3 max-h-[380px] sm:max-h-[420px] overflow-y-auto overflow-x-auto rounded-xl border border-slate-200 shadow-2xs">
            <table className="w-full text-left border-collapse min-w-[650px]">
              <thead className="sticky top-0 z-10 bg-slate-100/95 backdrop-blur-xs border-b border-slate-200 shadow-2xs">
                <tr className="text-slate-700 text-sm font-bold uppercase tracking-wider">
                  <th className="py-3 px-4">Food Item</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4 text-center">Favorite</th>
                  <th className="py-3 px-4">Portion</th>
                  <th className="py-3 px-4 text-emerald-700">Protein</th>
                  <th className="py-3 px-4 text-sky-700">Carbs</th>
                  <th className="py-3 px-4 text-teal-700">Fiber</th>
                  <th className="py-3 px-4 text-right">Calories</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm text-slate-800 font-medium bg-white">
                {filteredMeals.length > 0 ? (
                  filteredMeals.map((m) => (
                    <tr key={`${m.id}-${m.date}`} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-slate-900 text-sm">
                          {m.name}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                          <span className="font-semibold text-slate-900 font-mono">
                            {formatDateDDMMYYYY(m.date)}
                          </span>
                          {m.timestamp && (
                            <span className="text-slate-400 font-mono text-sm ml-1">
                              {m.timestamp}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => onToggleFavoriteFood?.(m.name)}
                          className="p-1.5 rounded-lg hover:bg-amber-50 transition-colors cursor-pointer"
                          title={m.isFavorite ? "Remove from favorites" : "Star and add to favorites"}
                        >
                          {m.isFavorite ? (
                            <Star className="w-5 h-5 text-amber-500 fill-amber-400" />
                          ) : (
                            <Star className="w-5 h-5 text-slate-300 hover:text-amber-500 transition-colors" />
                          )}
                        </button>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="text-slate-600 font-mono text-sm">
                          {m.portion || '—'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-emerald-600 font-mono text-sm">
                          {m.protein}g
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-sky-600 font-mono text-sm">
                          {m.carbs}g
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-teal-600 font-mono text-sm">
                          {m.fiber}g
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center justify-end gap-1 font-bold font-mono text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200/60 text-sm">
                          <Flame className="w-3.5 h-3.5 text-amber-600" />
                          {m.calories} kcal
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-slate-400 bg-slate-50/30">
                      <Utensils className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                      <p className="text-sm font-semibold text-slate-600">No logged foods found</p>
                      <p className="text-sm text-slate-400 mt-1">
                        {mealFilter === 'favorites'
                          ? 'No favorite foods starred yet. Click the star on any logged food to add it to favorites.'
                          : `No meals logged in the selected ${mealTimeRange}-day window.`}
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
