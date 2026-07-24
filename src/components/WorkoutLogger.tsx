import React, { useState, useEffect } from 'react';
import { Workout, SetLog, ParsedWorkoutDay, ParsedWorkoutExercise } from '../types';
import FormVisualizer, { EXERCISES_DATABASE, matchExerciseKey } from './FormVisualizer';
import { ConfirmModal } from './ConfirmModal';
import {
  PlayCircle,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Award,
  Dumbbell,
  Clock,
  Info,
  Check,
  Plus,
  AlertCircle,
  ExternalLink,
  Edit3,
  Trash2,
  Link2,
  ListPlus,
  Save,
  X,
  RotateCcw,
  PlusCircle,
  Sparkles,
  Settings2
} from 'lucide-react';

interface WorkoutLoggerProps {
  onAddWorkout: (workout: Omit<Workout, 'id'>) => void;
  onAddWorkouts?: (workouts: Omit<Workout, 'id'>[]) => void;
  weightUnit: string;
  selectedDate?: string;
  logs?: any[];
  parsedWorkouts?: any[];
  onUpdateParsedWorkouts?: (updated: any[]) => void;
}

const calculateStreak = (logs: any[] = [], activeDate: string): number => {
  if (!logs || logs.length === 0) return 1;

  const activeDates = new Set<string>();
  logs.forEach(l => {
    const hasWorkoutCompleted = l.workouts && l.workouts.some((w: any) => w.completed);
    const hasFoodLogged = l.meals && l.meals.length > 0;
    if (hasWorkoutCompleted || hasFoodLogged) {
      activeDates.add(l.date);
    }
  });

  const activeDateStr = activeDate;
  let streak = 0;
  let checkDate = new Date(activeDate + 'T00:00:00');

  const formatDate = (d: Date) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const hasActivityToday = activeDates.has(activeDateStr);
  
  if (hasActivityToday) {
    streak = 1;
    checkDate.setDate(checkDate.getDate() - 1);
    while (activeDates.has(formatDate(checkDate))) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    }
  } else {
    let yesterday = new Date(checkDate);
    yesterday.setDate(yesterday.getDate() - 1);
    
    let yesterdayStreak = 0;
    while (activeDates.has(formatDate(yesterday))) {
      yesterdayStreak++;
      yesterday.setDate(yesterday.getDate() - 1);
    }
    streak = yesterdayStreak + 1;
  }

  return streak > 0 ? streak : 1;
};

const extractYoutubeVideoId = (url: string | undefined): string | null => {
  if (!url) return null;
  if (/^[a-zA-Z0-9_\-]{11}$/.test(url)) return url;
  
  const regExp = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([a-zA-Z0-9_\-]{11})/i;
  const match = url.match(regExp);
  if (match && match[1]) {
    return match[1];
  }
  return null;
};

export default function WorkoutLogger({
  onAddWorkout,
  onAddWorkouts,
  weightUnit,
  selectedDate,
  logs = [],
  parsedWorkouts = [],
  onUpdateParsedWorkouts
}: WorkoutLoggerProps) {
  const [isWorkoutActive, setIsWorkoutActive] = useState(false);
  const [activeExerciseIndex, setActiveExerciseIndex] = useState(0);

  // Active view tab when workout is not active: 'session' | 'manage'
  const [activeTabMode, setActiveTabMode] = useState<'session' | 'manage'>('session');

  // Confirmation modal state
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    variant?: 'danger' | 'warning' | 'info';
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  const requestConfirm = (
    title: string,
    message: string,
    onConfirm: () => void,
    confirmText = 'Confirm',
    variant: 'danger' | 'warning' | 'info' = 'danger'
  ) => {
    setConfirmConfig({
      isOpen: true,
      title,
      message,
      confirmText,
      variant,
      onConfirm: () => {
        onConfirm();
        setConfirmConfig((prev) => ({ ...prev, isOpen: false }));
      }
    });
  };

  // State for exercise editing inside Manage Routines tab
  const [editingExKey, setEditingExKey] = useState<string | null>(null); // "dayIdx-exIdx"
  const [editExNameInput, setEditExNameInput] = useState('');
  const [editExUrlInput, setEditExUrlInput] = useState('');

  // State for adding a new exercise to a day
  const [addingExToDayIdx, setAddingExToDayIdx] = useState<number | null>(null);
  const [newExName, setNewExName] = useState('');
  const [newExUrl, setNewExUrl] = useState('');

  // State for adding a brand new workout day
  const [isAddingDay, setIsAddingDay] = useState(false);
  const [newDayTitle, setNewDayTitle] = useState('');
  const [newDayFocus, setNewDayFocus] = useState('');
  const [firstExName, setFirstExName] = useState('');
  const [firstExUrl, setFirstExUrl] = useState('');

  // State for editing day header
  const [editingDayHeaderIdx, setEditingDayHeaderIdx] = useState<number | null>(null);
  const [editDayTitle, setEditDayTitle] = useState('');
  const [editDayFocus, setEditDayFocus] = useState('');

  // Calculate consistency streak
  const streak = calculateStreak(logs, selectedDate || new Date().toISOString().split('T')[0]);

  // Track inputs for each set in active workout
  const [workoutProgress, setWorkoutProgress] = useState<Record<string, { reps: number; weight: number; completed: boolean }>>({});
  const [completedSuccessMsg, setCompletedSuccessMsg] = useState(false);

  // Normalized Display Days (uses parsedWorkouts if present, else empty array)
  const getDisplayDays = (): ParsedWorkoutDay[] => {
    if (parsedWorkouts && parsedWorkouts.length > 0) {
      return parsedWorkouts.map((item, idx) => {
        if (item && item.exercises && Array.isArray(item.exercises)) {
          return item as ParsedWorkoutDay;
        }
        return {
          day: item.day || `Day ${idx + 1}`,
          focusArea: item.focusArea || item.category || 'Full Body',
          exercises: item.name ? [{ name: item.name, youtubeUrl: item.youtubeUrl }] : []
        };
      });
    }

    return [];
  };

  const displayDays = getDisplayDays();

  // Save updated days to parent state / persistence
  const saveDisplayDays = (updatedDays: ParsedWorkoutDay[]) => {
    if (onUpdateParsedWorkouts) {
      onUpdateParsedWorkouts(updatedDays);
    }
  };

  // Determine current plan day based on streak and available displayDays
  const currentDayIndex = displayDays.length > 0 ? (streak - 1) % displayDays.length : 0;
  const currentDayObj = displayDays.length > 0 ? (displayDays[currentDayIndex] || displayDays[0]) : null;

  const currentPlan = currentDayObj ? {
    day: currentDayIndex + 1,
    title: currentDayObj.day || `Day ${currentDayIndex + 1}`,
    focus: currentDayObj.focusArea || 'Full Body',
    category: currentDayObj.focusArea ? currentDayObj.focusArea.split('&')[0].trim() : 'Full Body',
    rawExercises: currentDayObj.exercises || [],
    exercises: (currentDayObj.exercises || []).map(e => e.name)
  } : null;

  // Helper to accurately find YouTube URL matching an exercise name
  const findMatchingYoutubeUrl = (exerciseName: string): string | null => {
    if (!exerciseName || !displayDays || displayDays.length === 0) return null;
    const target = exerciseName.toLowerCase().trim();

    const exerciseItems: { name: string; youtubeUrl?: string }[] = [];
    for (const dayItem of displayDays) {
      if (dayItem && dayItem.exercises && Array.isArray(dayItem.exercises)) {
        for (const ex of dayItem.exercises) {
          if (ex && ex.name) exerciseItems.push(ex);
        }
      }
    }

    for (const ex of exerciseItems) {
      if (!ex.youtubeUrl) continue;
      const exLower = ex.name.toLowerCase().trim();
      if (exLower === target) {
        return ex.youtubeUrl;
      }
    }

    const tokenize = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean);
    const stem = (w: string) => w.replace(/(es|s)$/, '');
    const targetStems = tokenize(target).map(stem);

    let bestUrl: string | null = null;
    let maxScore = 0;

    for (const ex of exerciseItems) {
      if (!ex.youtubeUrl || !ex.name) continue;
      const exStems = tokenize(ex.name).map(stem);

      let score = 0;
      for (const ts of targetStems) {
        if (exStems.includes(ts)) {
          if (['row', 'curl', 'crunch', 'squat', 'stretch', 'situp', 'press'].includes(ts)) score += 10;
          else if (['raise', 'bicep', 'shoulder', 'leg', 'lats'].includes(ts)) score += 5;
          else score += 2;
        }
      }
      if (score >= 4 && score > maxScore) {
        maxScore = score;
        bestUrl = ex.youtubeUrl;
      }
    }

    return bestUrl;
  };

  const getActiveYoutubeId = (): string | null => {
    if (!currentPlan) return null;
    const rawEx = currentPlan.rawExercises[activeExerciseIndex];
    if (!rawEx) return null;

    // 1. First priority: Direct YouTube URL on active exercise object
    if (rawEx.youtubeUrl) {
      const videoId = extractYoutubeVideoId(rawEx.youtubeUrl);
      if (videoId) return videoId;
    }

    // 2. Second priority: Database lookup by exercise name
    const matchedKey = matchExerciseKey(rawEx.name);
    const dbEntry = EXERCISES_DATABASE[matchedKey];
    if (dbEntry && dbEntry.youtubeVideoId) {
      return dbEntry.youtubeVideoId;
    }

    // 3. Fallback: Search across other days if no direct URL or DB match found
    const matchUrl = findMatchingYoutubeUrl(rawEx.name);
    if (matchUrl) {
      const videoId = extractYoutubeVideoId(matchUrl);
      if (videoId) return videoId;
    }

    return null;
  };

  const activeYoutubeId = getActiveYoutubeId();

  const selectedDateStr = selectedDate || new Date().toISOString().split('T')[0];
  const isWorkoutCompletedToday = logs && logs.some(l => l.date === selectedDateStr && l.workouts && l.workouts.length > 0);

  // Initialize progress state when starting workout
  const handleStartWorkout = () => {
    if (!currentPlan || currentPlan.exercises.length === 0) return;
    const initialProgress: Record<string, { reps: number; weight: number; completed: boolean }> = {};
    
    currentPlan.exercises.forEach(exName => {
      const dbEntry = EXERCISES_DATABASE[exName];
      const setsCount = 3;
      
      let defaultReps = 10;
      if (dbEntry) {
        const matches = dbEntry.volume.match(/(\d+)\s+repetitions/i) || dbEntry.volume.match(/(\d+)-(\d+)\s+repetitions/i);
        if (matches) {
          defaultReps = parseInt(matches[1]);
        }
      }

      for (let s = 0; s < setsCount; s++) {
        initialProgress[`${exName}-${s}`] = {
          reps: defaultReps,
          weight: exName.includes('Bodyweight') || exName.includes('Stretching') || exName.includes('Crunches') || exName.includes('Leg Raises') ? 0 : 30,
          completed: false
        };
      }
    });

    setWorkoutProgress(initialProgress);
    setActiveExerciseIndex(0);
    setIsWorkoutActive(true);
  };

  const handleFinishAndSaveWorkout = () => {
    if (!currentPlan) return;
    const workoutsToSave: Omit<Workout, 'id'>[] = [];

    currentPlan.exercises.forEach((exName, exIdx) => {
      const setsForExercise: Omit<SetLog, 'id'>[] = [];
      const setsCount = 3;
      
      for (let s = 0; s < setsCount; s++) {
        const setKey = `${exName}-${s}`;
        const p = workoutProgress[setKey] || { reps: 10, weight: 30, completed: true };
        setsForExercise.push({
          reps: p.reps,
          weight: p.weight,
          completed: true
        });
      }

      workoutsToSave.push({
        name: exName,
        category: currentPlan.category as any,
        completed: true,
        sets: setsForExercise.map((s, idx) => ({
          ...s,
          id: `set-${Date.now()}-${exIdx}-${idx}`
        }))
      });
    });

    if (onAddWorkouts) {
      onAddWorkouts(workoutsToSave);
    } else {
      workoutsToSave.forEach(w => onAddWorkout(w));
    }

    setIsWorkoutActive(false);
    setCompletedSuccessMsg(true);
    setTimeout(() => setCompletedSuccessMsg(false), 3000);
  };

  const handleUpdateSetField = (exName: string, setIdx: number, field: 'reps' | 'weight', val: number) => {
    const key = `${exName}-${setIdx}`;
    setWorkoutProgress(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        [field]: val
      }
    }));
  };

  const handleToggleSetCompleted = (exName: string, setIdx: number) => {
    const key = `${exName}-${setIdx}`;
    setWorkoutProgress(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        completed: !prev[key].completed
      }
    }));
  };

  const allSetsCompleted = React.useMemo(() => {
    if (!currentPlan || !currentPlan.exercises || currentPlan.exercises.length === 0) return false;
    for (const exName of currentPlan.exercises) {
      for (let s = 0; s < 3; s++) {
        const setKey = `${exName}-${s}`;
        if (!workoutProgress[setKey]?.completed) {
          return false;
        }
      }
    }
    return true;
  }, [currentPlan, workoutProgress]);

  // Routine Manager Handlers
  const handleAddExerciseToDay = (dayIdx: number) => {
    if (!newExName.trim()) return;
    const currentDays = getDisplayDays();
    const updated = [...currentDays];
    const dayObj = { ...updated[dayIdx] };
    const exercises = [...(dayObj.exercises || [])];

    exercises.push({
      name: newExName.trim(),
      youtubeUrl: newExUrl.trim() || undefined
    });

    dayObj.exercises = exercises;
    updated[dayIdx] = dayObj;
    saveDisplayDays(updated);

    setNewExName('');
    setNewExUrl('');
    setAddingExToDayIdx(null);
  };

  const handleSaveExerciseEdit = (dayIdx: number, exIdx: number) => {
    if (!editExNameInput.trim()) return;
    const currentDays = getDisplayDays();
    const updated = [...currentDays];
    const dayObj = { ...updated[dayIdx] };
    const exercises = [...(dayObj.exercises || [])];

    exercises[exIdx] = {
      ...exercises[exIdx],
      name: editExNameInput.trim(),
      youtubeUrl: editExUrlInput.trim() || undefined
    };

    dayObj.exercises = exercises;
    updated[dayIdx] = dayObj;
    saveDisplayDays(updated);
    setEditingExKey(null);
  };

  const handleRemoveExercise = (dayIdx: number, exIdx: number) => {
    const currentDays = getDisplayDays();
    const updated = [...currentDays];
    const dayObj = { ...updated[dayIdx] };
    dayObj.exercises = dayObj.exercises.filter((_, i) => i !== exIdx);
    updated[dayIdx] = dayObj;
    saveDisplayDays(updated);
  };

  const handleAddNewDay = () => {
    const currentDays = getDisplayDays();
    const title = newDayTitle.trim() || `Day ${currentDays.length + 1}`;
    const focus = newDayFocus.trim() || 'Full Body';

    const initialEx = firstExName.trim()
      ? [{ name: firstExName.trim(), youtubeUrl: firstExUrl.trim() || undefined }]
      : [];

    const newDayObj: ParsedWorkoutDay = {
      day: title,
      focusArea: focus,
      exercises: initialEx
    };

    saveDisplayDays([...currentDays, newDayObj]);

    setNewDayTitle('');
    setNewDayFocus('');
    setFirstExName('');
    setFirstExUrl('');
    setIsAddingDay(false);
  };

  const handleRemoveDay = (dayIdx: number) => {
    requestConfirm(
      'Delete Workout Day',
      'Are you sure you want to delete this entire workout day? This action cannot be undone.',
      () => {
        const currentDays = getDisplayDays();
        const updated = currentDays.filter((_, i) => i !== dayIdx);
        saveDisplayDays(updated);
      },
      'Delete Day',
      'danger'
    );
  };

  const handleSaveDayHeader = (dayIdx: number) => {
    const currentDays = getDisplayDays();
    const updated = [...currentDays];
    updated[dayIdx] = {
      ...updated[dayIdx],
      day: editDayTitle.trim() || updated[dayIdx].day,
      focusArea: editDayFocus.trim() || updated[dayIdx].focusArea
    };
    saveDisplayDays(updated);
    setEditingDayHeaderIdx(null);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-10 shadow-sm" id="daily-workout-module">
      {!isWorkoutActive ? (
        // --- 1. OVERVIEW / ROUTINE MANAGER SCREEN ---
        <div className="space-y-8" id="workout-selector-panel">
          
          {/* Header with Sub-Tabs */}
          <div className="space-y-4 border-b border-slate-100 pb-2">
            <div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-start gap-3">
                <Dumbbell className="w-7 h-7 text-indigo-600 animate-pulse shrink-0 mt-0.5" />
                <span>Daily Workout Routines</span>
              </h2>
              <p className="text-slate-500 text-sm mt-1 font-semibold">
                Daily Consistency Workout Plan — track your lifts & manage custom routine days
              </p>
            </div>

            {/* Sub-Tabs Selector splitting full width */}
            <div className="grid grid-cols-2 border-b border-slate-200 gap-2 pb-0.5 pt-2 w-full">
              {[
                { id: 'session', label: "Today's Session" },
                { id: 'manage', label: 'Add & Edit' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTabMode(tab.id as any)}
                  className={`w-full text-center px-4 py-2.5 rounded-t-xl text-xs sm:text-sm font-black whitespace-nowrap transition-all cursor-pointer border-b-2 ${
                    activeTabMode === tab.id
                      ? 'border-indigo-600 text-indigo-600 font-black'
                      : 'border-transparent text-slate-400 hover:text-slate-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {completedSuccessMsg && (
            <div className="text-sm bg-emerald-50 text-emerald-700 px-4 py-3 rounded-xl border border-emerald-100 font-bold flex items-center gap-2 animate-bounce shadow-sm">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>Workout Logged & Saved to Daily Progress!</span>
            </div>
          )}

          {activeTabMode === 'session' ? (
            // --- SUB-TAB A: TODAY'S SESSION ---
            <div className="space-y-8">
              {displayDays.length === 0 ? (
                <div className="bg-slate-50 border border-slate-200/80 rounded-3xl p-8 sm:p-12 text-center space-y-4">
                  <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto">
                    <Dumbbell className="w-7 h-7" />
                  </div>
                  <div className="max-w-md mx-auto space-y-1.5">
                    <h3 className="text-base font-black text-slate-800">No Workout Routine Set Up</h3>
                    <p className="text-xs font-semibold text-slate-500 leading-relaxed">
                      You don't have any routine days in your program yet. You can paste a workout plan in the input box at the top, create custom routine days in the <span className="text-indigo-600 font-bold">'Add & Edit'</span> tab, or log individual lifts directly on the right using <span className="text-indigo-600 font-bold">'+ Add Lift'</span>.
                    </p>
                  </div>
                  <div className="pt-2 flex flex-wrap justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => setActiveTabMode('manage')}
                      className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" /> Create Routine Days
                    </button>
                  </div>
                </div>
              ) : currentPlan ? (
                <>
                  {/* Consistency Streak Hero Box */}
                  <div
                    className="w-full bg-linear-to-r from-indigo-500 to-violet-600 rounded-3xl p-6 sm:p-8 text-white shadow-lg shadow-indigo-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 min-h-[150px]"
                    id="workout-streak-box"
                  >
                    <div className="space-y-2">
                      <span className="text-[10px] font-black uppercase tracking-widest bg-white/20 text-white px-3 py-1 rounded-full border border-white/10 inline-block">
                        Consistency Calendar Streak
                      </span>
                      <h3 className="text-3xl font-black tracking-tight">Day {streak}</h3>
                      <p className="text-indigo-100 text-sm font-semibold">
                        Today's Focus: <span className="text-white font-black">{currentPlan.focus}</span> ({currentPlan.title})
                      </p>
                    </div>

                    <div className="shrink-0 bg-white/10 border border-white/15 px-4.5 py-3 rounded-2xl">
                      <span className="text-[9px] font-black text-indigo-100 uppercase tracking-widest block mb-1">
                        Routine Schedule
                      </span>
                      <span className="font-mono text-xs font-black text-white bg-slate-950/30 px-3.5 py-1.5 rounded-xl inline-block">
                        {displayDays.length}-Day Rotation (Plan #{currentPlan.day})
                      </span>
                    </div>
                  </div>

                  {/* Routine Actions and Targets Card */}
                  <div className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-6 sm:p-8 space-y-6">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div>
                        <span className="text-xs uppercase font-black px-3 py-1 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-150">
                          {currentPlan.category} TARGETS
                        </span>
                        <h3 className="text-lg font-black text-slate-800 mt-2">
                          Start Today's Lift ({currentPlan.title})
                        </h3>
                      </div>

                      {isWorkoutCompletedToday ? (
                        <div
                          className="flex items-center gap-2 px-5 py-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl font-black text-xs shrink-0 self-center"
                          id="workout-already-completed-badge"
                        >
                          <CheckCircle2 className="w-5 h-5 text-emerald-600 animate-pulse" />
                          <span>Daily Lift Completed & Saved</span>
                        </div>
                      ) : currentPlan.exercises.length > 0 ? (
                        <button
                          type="button"
                          onClick={handleStartWorkout}
                          className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm rounded-2xl transition-all shadow-md hover:shadow-lg shadow-indigo-150 cursor-pointer active:scale-95"
                          id="start-workout-btn"
                        >
                          <PlayCircle className="w-5 h-5" />
                          Start Day {streak} Workout
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setActiveTabMode('manage')}
                          className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-2xl transition-all cursor-pointer"
                        >
                          <Plus className="w-4 h-4" /> Add Exercises to {currentPlan.title}
                        </button>
                      )}
                    </div>

                    <div className="border-t border-slate-200/60 pt-6 space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-black text-slate-400 uppercase tracking-wider block">
                          Exercises for this routine:
                        </span>
                        <button
                          type="button"
                          onClick={() => setActiveTabMode('manage')}
                          className="text-xs text-indigo-600 font-extrabold hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" /> Edit Exercises / Add Days
                        </button>
                      </div>

                      {currentPlan.rawExercises.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {currentPlan.rawExercises.map((rawEx, idx) => {
                            const dbEntry = EXERCISES_DATABASE[matchExerciseKey(rawEx.name)];
                            const matchUrl = rawEx.youtubeUrl || findMatchingYoutubeUrl(rawEx.name);
                            return (
                              <div
                                key={idx}
                                className="bg-white border border-slate-200 rounded-xl p-4 flex items-start justify-between gap-4 shadow-xs"
                              >
                                <div className="flex items-start gap-3 min-w-0">
                                  <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 font-mono font-black text-sm flex items-center justify-center shrink-0">
                                    {idx + 1}
                                  </div>
                                  <div className="min-w-0">
                                    <h4 className="text-sm font-bold text-slate-800 truncate">{rawEx.name}</h4>
                                    <span className="text-xs text-indigo-600 font-extrabold block mt-0.5">
                                      {dbEntry?.volume || '3 sets'}
                                    </span>
                                  </div>
                                </div>

                                {matchUrl && (
                                  <a
                                    href={matchUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-[10px] font-extrabold flex items-center gap-1 shrink-0 transition-colors"
                                    title="Watch Video"
                                  >
                                    <PlayCircle className="w-3.5 h-3.5 text-red-600" />
                                    Video
                                  </a>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="py-6 text-center text-slate-400 bg-white rounded-xl border border-dashed border-slate-200">
                          <p className="text-xs font-bold text-slate-500">No exercises added to {currentPlan.title} yet.</p>
                          <button
                            type="button"
                            onClick={() => setActiveTabMode('manage')}
                            className="mt-2 text-xs text-indigo-600 font-extrabold hover:underline inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" /> Add Exercises in Routine Manager
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Quick tips */}
                  <div className="flex gap-3 items-start bg-amber-50/50 border border-amber-200/60 p-5 rounded-2xl text-xs sm:text-sm text-amber-800">
                    <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold block">Progressive Overload Principle:</span>
                      <p className="mt-1 leading-relaxed font-medium">
                        Aim to write down the weights you actually did. Try to increase weight by 2.5-5 lbs or add 1-2
                        repetitions compared to your last session to stimulate lean muscle growth safely.
                      </p>
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          ) : (
            // --- SUB-TAB B: MANAGE ROUTINES & DAYS ---
            <div className="space-y-6" id="routine-manager-panel">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-indigo-50/60 border border-indigo-100 p-5 rounded-2xl">
                <div>
                  <h3 className="text-base font-extrabold text-indigo-950 flex items-center gap-2">
                    <ListPlus className="w-5 h-5 text-indigo-600" />
                    Custom Workout Routines & Days Manager
                  </h3>
                  <p className="text-xs text-indigo-800 mt-1">
                    Add custom workout days, insert new exercises, edit YouTube demonstration video links, or delete days.
                  </p>
                </div>

                {displayDays.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      requestConfirm(
                        'Clear All Workout Days',
                        'Are you sure you want to clear all workout routine days from your plan? This will remove all stored routine days.',
                        () => saveDisplayDays([]),
                        'Clear All Days',
                        'danger'
                      );
                    }}
                    className="px-3 py-1.5 bg-white hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-slate-200 hover:border-rose-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                    Clear All Days
                  </button>
                )}
              </div>

              {/* List of Days */}
              <div className="space-y-6">
                {displayDays.length === 0 && (
                  <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-slate-500 space-y-2">
                    <p className="text-xs font-bold text-slate-700">No Routine Days Added Yet</p>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                      Use the "+ Add New Day" button below to create your first routine day, or paste a routine plan in the text box above to auto-generate days.
                    </p>
                  </div>
                )}
                {displayDays.map((dayObj, dayIdx) => {
                  const isEditingHeader = editingDayHeaderIdx === dayIdx;
                  const isAddingEx = addingExToDayIdx === dayIdx;

                  return (
                    <div
                      key={`day-${dayIdx}`}
                      className="bg-slate-50 border border-slate-200/90 rounded-2xl p-5 sm:p-6 space-y-4 shadow-xs"
                    >
                      {/* Day Header */}
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-200 pb-3">
                        {isEditingHeader ? (
                          <div className="flex items-center gap-2 w-full sm:w-auto">
                            <input
                              type="text"
                              value={editDayTitle}
                              onChange={e => setEditDayTitle(e.target.value)}
                              placeholder="Day Title (e.g. Day 1)"
                              className="px-2.5 py-1 bg-white border border-indigo-300 rounded-lg text-xs font-bold text-slate-900"
                            />
                            <input
                              type="text"
                              value={editDayFocus}
                              onChange={e => setEditDayFocus(e.target.value)}
                              placeholder="Focus (e.g. Core & Chest)"
                              className="px-2.5 py-1 bg-white border border-indigo-300 rounded-lg text-xs font-bold text-slate-900"
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveDayHeader(dayIdx)}
                              className="px-2.5 py-1 bg-indigo-600 text-white rounded-lg text-xs font-bold cursor-pointer"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingDayHeaderIdx(null)}
                              className="px-2.5 py-1 bg-slate-200 text-slate-700 rounded-lg text-xs font-bold cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3">
                            <span className="px-3 py-1 bg-indigo-600 text-white font-extrabold text-xs rounded-lg shadow-xs">
                              {dayObj.day || `Day ${dayIdx + 1}`}
                            </span>
                            <div>
                              <h4 className="text-sm font-extrabold text-slate-900">
                                {dayObj.focusArea || 'Full Body'}
                              </h4>
                              <span className="text-[11px] text-slate-500 font-medium">
                                {dayObj.exercises ? dayObj.exercises.length : 0} Exercises
                              </span>
                            </div>
                          </div>
                        )}

                        {!isEditingHeader && (
                          <div className="flex items-center gap-2 self-end sm:self-center">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingDayHeaderIdx(dayIdx);
                                setEditDayTitle(dayObj.day || `Day ${dayIdx + 1}`);
                                setEditDayFocus(dayObj.focusArea || 'Full Body');
                              }}
                              className="px-2.5 py-1 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 rounded-lg text-[11px] font-bold transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              <Edit3 className="w-3 h-3 text-slate-500" />
                              Rename
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveDay(dayIdx)}
                              className="px-2 py-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Delete Day"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Exercises in this Day */}
                      <div className="space-y-3">
                        {dayObj.exercises && dayObj.exercises.length > 0 ? (
                          dayObj.exercises.map((ex, exIdx) => {
                            const exKey = `${dayIdx}-${exIdx}`;
                            const isEditing = editingExKey === exKey;

                            return (
                              <div
                                key={`ex-item-${exKey}`}
                                className="bg-white p-3.5 rounded-xl border border-slate-200/90 space-y-2"
                              >
                                {isEditing ? (
                                  <div className="space-y-2">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                      <input
                                        type="text"
                                        value={editExNameInput}
                                        onChange={e => setEditExNameInput(e.target.value)}
                                        placeholder="Exercise Name"
                                        className="px-3 py-1.5 border border-indigo-300 rounded-lg text-xs font-bold text-slate-900 focus:outline-none"
                                      />
                                      <input
                                        type="text"
                                        value={editExUrlInput}
                                        onChange={e => setEditExUrlInput(e.target.value)}
                                        placeholder="YouTube Demonstration URL"
                                        className="px-3 py-1.5 border border-indigo-300 rounded-lg text-xs font-mono text-slate-800 focus:outline-none"
                                      />
                                    </div>
                                    <div className="flex justify-end gap-2">
                                      <button
                                        type="button"
                                        onClick={() => handleSaveExerciseEdit(dayIdx, exIdx)}
                                        className="px-3 py-1 bg-indigo-600 text-white font-bold text-xs rounded-lg cursor-pointer"
                                      >
                                        Save Changes
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setEditingExKey(null)}
                                        className="px-3 py-1 bg-slate-100 text-slate-600 font-bold text-xs rounded-lg cursor-pointer"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                                    <div className="space-y-1 min-w-0">
                                      <h5 className="text-xs font-extrabold text-slate-900">{ex.name}</h5>
                                      <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono">
                                        <Link2 className="w-3 h-3 text-indigo-500 shrink-0" />
                                        <span className="truncate max-w-[280px]">
                                          {ex.youtubeUrl || <em className="text-slate-400">No YouTube URL linked</em>}
                                        </span>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                                      {ex.youtubeUrl && (
                                        <a
                                          href={ex.youtubeUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                                          title="Test YouTube Link"
                                        >
                                          <ExternalLink className="w-3.5 h-3.5" />
                                        </a>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingExKey(exKey);
                                          setEditExNameInput(ex.name);
                                          setEditExUrlInput(ex.youtubeUrl || '');
                                        }}
                                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
                                      >
                                        Edit
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveExercise(dayIdx, exIdx)}
                                        className="p-1 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                                        title="Remove Exercise"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })
                        ) : (
                          <div className="p-3 bg-white border border-dashed border-slate-200 rounded-xl text-xs text-slate-400 text-center font-medium">
                            No exercises added to this day yet. Add one below!
                          </div>
                        )}
                      </div>

                      {/* Add Exercise Form to this day */}
                      {isAddingEx ? (
                        <div className="p-3.5 bg-indigo-50/80 border border-indigo-200 rounded-xl space-y-2.5">
                          <h6 className="text-xs font-black text-indigo-900">Add Exercise to {dayObj.day || `Day ${dayIdx + 1}`}</h6>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <input
                              type="text"
                              value={newExName}
                              onChange={e => setNewExName(e.target.value)}
                              placeholder="Exercise Name (e.g. Incline Dumbbell Press)"
                              className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              autoFocus
                            />
                            <input
                              type="text"
                              value={newExUrl}
                              onChange={e => setNewExUrl(e.target.value)}
                              placeholder="YouTube Link (optional)"
                              className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                          </div>
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleAddExerciseToDay(dayIdx)}
                              disabled={!newExName.trim()}
                              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer"
                            >
                              Add Exercise
                            </button>
                            <button
                              type="button"
                              onClick={() => setAddingExToDayIdx(null)}
                              className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 font-bold text-xs rounded-lg cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setAddingExToDayIdx(dayIdx);
                            setNewExName('');
                            setNewExUrl('');
                          }}
                          className="w-full py-2 bg-white hover:bg-indigo-50/50 border border-dashed border-indigo-200 text-indigo-600 font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Plus className="w-4 h-4" /> Add Exercise to {dayObj.day || `Day ${dayIdx + 1}`}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Add New Workout Day Card */}
              <div className="bg-white border-2 border-dashed border-indigo-200 rounded-2xl p-6 space-y-4">
                {isAddingDay ? (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                      <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                        <PlusCircle className="w-4 h-4 text-indigo-600" /> Create a New Workout Day
                      </h4>
                      <button
                        type="button"
                        onClick={() => setIsAddingDay(false)}
                        className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                          Day Name / Number
                        </label>
                        <input
                          type="text"
                          value={newDayTitle}
                          onChange={e => setNewDayTitle(e.target.value)}
                          placeholder={`e.g. Day ${displayDays.length + 1}`}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                          Focus Area
                        </label>
                        <input
                          type="text"
                          value={newDayFocus}
                          onChange={e => setNewDayFocus(e.target.value)}
                          placeholder="e.g. Legs & Hamstrings"
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-slate-100">
                      <span className="text-xs font-bold text-slate-700 block">First Exercise (Optional):</span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <input
                          type="text"
                          value={firstExName}
                          onChange={e => setFirstExName(e.target.value)}
                          placeholder="Exercise Name (e.g. Barbell Squats)"
                          className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        <input
                          type="text"
                          value={firstExUrl}
                          onChange={e => setFirstExUrl(e.target.value)}
                          placeholder="YouTube Link (optional)"
                          className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={handleAddNewDay}
                        className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-colors cursor-pointer"
                      >
                        Save New Workout Day
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsAddingDay(false)}
                        className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center space-y-3 py-2">
                    <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 mx-auto flex items-center justify-center">
                      <Plus className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-extrabold text-slate-900">Need another workout day?</h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Add Day {displayDays.length + 1} or a custom focus routine day to your workout rotation.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsAddingDay(true)}
                      className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl transition-colors shadow-sm inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" /> Add Another Workout Day
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        // --- 2. ACTIVE WORKOUT PLAYER ---
        <div className="space-y-6" id="workout-player-panel">
          {/* Header */}
          <div className="flex justify-between items-center border-b border-slate-100 pb-4">
            <div>
              <span className="text-[10px] text-indigo-600 font-black uppercase tracking-widest">
                Active Workout Session
              </span>
              <h3 className="text-base font-black text-slate-900 mt-0.5">
                Streak Day {streak} • {currentPlan.focus}
              </h3>
            </div>

            <button
              onClick={() => {
                requestConfirm(
                  'Exit Active Workout',
                  'Are you sure you want to exit active workout mode? Your set entries for this session will be lost.',
                  () => setIsWorkoutActive(false),
                  'Exit Workout',
                  'warning'
                );
              }}
              className="text-xs font-bold text-slate-400 hover:text-slate-600 py-1.5 px-3 rounded-lg hover:bg-slate-100 transition-all cursor-pointer"
              id="exit-workout-btn"
            >
              Exit Workout
            </button>
          </div>

          {/* Steps Navigator Bar */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-2xl border border-slate-200 overflow-x-auto custom-scrollbar" id="workout-steps-bar">
            {currentPlan.exercises.map((exName, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setActiveExerciseIndex(idx)}
                className={`flex-1 min-w-[100px] text-center py-2 text-xs font-bold rounded-xl transition-all cursor-pointer shrink-0 ${
                  activeExerciseIndex === idx
                    ? 'bg-white text-indigo-600 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {idx + 1}. {exName.length > 18 ? `${exName.slice(0, 16)}...` : exName}
              </button>
            ))}
          </div>

          {/* Core Exercise Guide with animated Visualizer */}
          <FormVisualizer exerciseName={currentPlan.exercises[activeExerciseIndex]} />

          {/* YouTube Video Player */}
          {activeYoutubeId && (
            <div
              className="bg-slate-900 rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-800 space-y-3"
              id="youtube-embed-card"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-indigo-400 font-extrabold flex items-center gap-1.5 uppercase tracking-wider">
                  <PlayCircle className="w-4 h-4 text-indigo-500 animate-pulse" />
                  YouTube Video Demonstration Guide
                </span>
                <span className="text-[10px] text-slate-400 font-bold font-mono">Video ID: {activeYoutubeId}</span>
              </div>
              <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-slate-950 border border-slate-800 shadow-inner">
                <iframe
                  className="absolute top-0 left-0 w-full h-full"
                  src={`https://www.youtube.com/embed/${activeYoutubeId}?autoplay=0&rel=0`}
                  title="YouTube video player"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                ></iframe>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1 text-xs">
                <span className="text-slate-400 font-medium">Having playback issues or want to watch full-screen?</span>
                <a
                  href={`https://www.youtube.com/watch?v=${activeYoutubeId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-sm transition-colors cursor-pointer text-center"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Watch on YouTube
                </a>
              </div>
            </div>
          )}

          {/* Dynamic Interactive Sets Entry */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">
                Logged Working Sets (Recommend: 3 Sets)
              </h4>
              <span className="text-[10px] text-slate-400 font-semibold flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> Check the boxes as you finish each set
              </span>
            </div>

            <div className="space-y-3">
              {[0, 1, 2].map(setIdx => {
                const exName = currentPlan.exercises[activeExerciseIndex];
                const key = `${exName}-${setIdx}`;
                const setProgress = workoutProgress[key] || { reps: 10, weight: 30, completed: false };

                const isBodyweight =
                  exName.includes('Bodyweight') ||
                  exName.includes('Stretching') ||
                  exName.includes('Crunches') ||
                  exName.includes('Leg Raises');

                return (
                  <div
                    key={setIdx}
                    className={`flex items-center justify-between gap-3 p-3.5 rounded-xl border transition-all ${
                      setProgress.completed
                        ? 'bg-indigo-50/50 border-indigo-200'
                        : 'bg-slate-50/50 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => handleToggleSetCompleted(exName, setIdx)}
                        className={`w-7 h-7 rounded-lg border flex items-center justify-center transition-all cursor-pointer ${
                          setProgress.completed
                            ? 'bg-indigo-600 border-indigo-600 text-white'
                            : 'bg-white border-slate-300 text-transparent hover:border-indigo-400'
                        }`}
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <span className="text-xs font-bold text-slate-700">Set {setIdx + 1}</span>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Weight Input */}
                      {!isBodyweight && (
                        <div className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200">
                          <input
                            type="number"
                            value={setProgress.weight}
                            onChange={e =>
                              handleUpdateSetField(exName, setIdx, 'weight', parseFloat(e.target.value) || 0)
                            }
                            className="w-12 text-xs font-bold text-slate-800 text-center focus:outline-none"
                            step="2.5"
                          />
                          <span className="text-[10px] font-extrabold text-slate-400 uppercase">{weightUnit}</span>
                        </div>
                      )}

                      {/* Reps Input */}
                      <div className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200">
                        <input
                          type="number"
                          value={setProgress.reps}
                          onChange={e =>
                            handleUpdateSetField(exName, setIdx, 'reps', parseInt(e.target.value) || 0)
                          }
                          className="w-10 text-xs font-bold text-slate-800 text-center focus:outline-none"
                        />
                        <span className="text-[10px] font-extrabold text-slate-400 uppercase">reps</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Next / Finish Navigation Buttons */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setActiveExerciseIndex(prev => Math.max(0, prev - 1))}
                disabled={activeExerciseIndex === 0}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700 font-bold text-xs rounded-xl transition-colors flex items-center gap-1 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                Prev Exercise
              </button>

              {activeExerciseIndex < currentPlan.exercises.length - 1 ? (
                <button
                  type="button"
                  onClick={() => setActiveExerciseIndex(prev => Math.min(currentPlan.exercises.length - 1, prev + 1))}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-colors flex items-center gap-1 cursor-pointer"
                >
                  Next Exercise
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleFinishAndSaveWorkout}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-colors flex items-center gap-1.5 cursor-pointer animate-pulse"
                >
                  <Award className="w-4 h-4" />
                  Finish & Save Lifts
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Custom Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmConfig.isOpen}
        title={confirmConfig.title}
        message={confirmConfig.message}
        confirmText={confirmConfig.confirmText}
        variant={confirmConfig.variant}
        onConfirm={confirmConfig.onConfirm}
        onCancel={() => setConfirmConfig((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
