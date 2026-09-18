import React, { useState, useEffect } from 'react';
import { Workout, SetLog, ParsedWorkoutDay, ParsedWorkoutExercise, JogSession, UserGoals } from '../types';
import FormVisualizer, { EXERCISES_DATABASE, matchExerciseKey } from './FormVisualizer';
import { ConfirmModal } from './ConfirmModal';
import JogTracker, { formatDuration } from './JogTracker';
import { formatDateDDMMYYYY } from '../dateUtils';
import { normalizeWorkoutCategory } from '../workoutCategories';
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
  Settings2,
  Coffee,
  Moon,
  Sun,
  Activity,
  HeartPulse,
  Calendar,
  ChevronUp,
  ChevronDown,
  Copy,
  MoreVertical,
  Footprints,
  Navigation,
  Pencil,
  GripVertical,
  Minus
} from 'lucide-react';

interface WorkoutLoggerProps {
  onAddWorkout: (workout: Omit<Workout, 'id'>) => void;
  onAddWorkouts?: (workouts: Omit<Workout, 'id'>[]) => void;
  weightUnit: string;
  selectedDate?: string;
  logs?: any[];
  parsedWorkouts?: any[];
  onUpdateParsedWorkouts?: (updated: any[]) => void;
  onUpdateDailyLog?: (date: string, updateFn: (log: any) => any) => void;
  goals?: UserGoals;
}

const calculateStreak = (logs: any[] = [], activeDate: string, parsedWorkouts: any[] = []): number => {
  const activeDateStr = activeDate || new Date().toISOString().split('T')[0];
  const DAYS_ORDER = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  // Helper to check if a date (YYYY-MM-DD) is a scheduled Rest Day
  const isDateRestDay = (dateStr: string): boolean => {
    const log = logs ? logs.find((l: any) => l.date === dateStr) : null;
    if (log?.isRestDay || log?.oneTimeScheduleOverride?.isRestDay) {
      return true;
    }
    if (parsedWorkouts && parsedWorkouts.length > 0) {
      const d = new Date(dateStr + 'T12:00:00');
      const dow = DAYS_ORDER[d.getDay()];
      const match = parsedWorkouts.find((pw: any) => 
        (pw.dayOfWeek && pw.dayOfWeek.toLowerCase() === dow.toLowerCase()) ||
        (pw.day && pw.day.toLowerCase().includes(dow.toLowerCase()))
      );
      if (match) {
        return Boolean(match.isRestDay || (match.focusArea && match.focusArea.toLowerCase().includes('rest')));
      }
    }
    return false;
  };

  // Helper to check if a date (YYYY-MM-DD) had a completed or logged workout or activity
  const isDateWorkoutCompleted = (dateStr: string): boolean => {
    const log = logs ? logs.find((l: any) => l.date === dateStr) : null;
    if (!log) return false;
    const hasWorkout = log.workouts && log.workouts.some((w: any) => w.completed || (w.exercises && w.exercises.length > 0));
    const hasFood = log.meals && log.meals.length > 0;
    return Boolean(hasWorkout || hasFood);
  };

  const formatDate = (d: Date) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  // Check if today/activeDate is a Rest Day or has completed activity
  const todayIsRest = isDateRestDay(activeDateStr);
  const todayIsWorkoutDone = isDateWorkoutCompleted(activeDateStr);
  const todaySatisfied = todayIsRest || todayIsWorkoutDone;

  let streak = 1;
  let checkDate = new Date(activeDateStr + 'T12:00:00');

  if (todaySatisfied) {
    checkDate.setDate(checkDate.getDate() - 1);
    while (true) {
      const checkStr = formatDate(checkDate);
      const isRest = isDateRestDay(checkStr);
      const isDone = isDateWorkoutCompleted(checkStr);
      if (isRest || isDone) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        // Missed a workout day! Streak breaks here.
        break;
      }
    }
  } else {
    // Today not yet completed. Check yesterday:
    checkDate.setDate(checkDate.getDate() - 1);
    const yesterdayStr = formatDate(checkDate);
    const yesterdayIsRest = isDateRestDay(yesterdayStr);
    const yesterdayIsDone = isDateWorkoutCompleted(yesterdayStr);

    if (yesterdayIsRest || yesterdayIsDone) {
      let yesterdayStreak = 0;
      while (true) {
        const checkStr = formatDate(checkDate);
        const isRest = isDateRestDay(checkStr);
        const isDone = isDateWorkoutCompleted(checkStr);
        if (isRest || isDone) {
          yesterdayStreak++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          break;
        }
      }
      streak = yesterdayStreak + 1; // Today is day (yesterdayStreak + 1)
    } else {
      // Missed yesterday's workout! Reset streak and start again at 1!
      streak = 1;
    }
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


const addDaysToDateString = (dateStr: string, days: number): string => {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const getDayNameFromDateString = (dateStr: string): string => {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long' });
};

export default function WorkoutLogger({
  onAddWorkout,
  onAddWorkouts,
  weightUnit,
  selectedDate,
  logs = [],
  parsedWorkouts = [],
  onUpdateParsedWorkouts,
  onUpdateDailyLog,
  goals
}: WorkoutLoggerProps) {
  const STORAGE_KEY_ACTIVE_WORKOUT = 'active_workout_session_state_v1';

  const [isWorkoutActive, setIsWorkoutActive] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('active_workout_session_state_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        return Boolean(parsed.isWorkoutActive);
      }
    } catch (e) {
      console.error('Failed to load active workout session', e);
    }
    return false;
  });

  const [activeExerciseIndex, setActiveExerciseIndex] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('active_workout_session_state_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        return typeof parsed.activeExerciseIndex === 'number' ? parsed.activeExerciseIndex : 0;
      }
    } catch (e) {}
    return 0;
  });

  // Track inputs for each set in active workout
  const [workoutProgress, setWorkoutProgress] = useState<Record<string, { reps: number; weight: number; completed: boolean }>>(() => {
    try {
      const saved = localStorage.getItem('active_workout_session_state_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.workoutProgress && typeof parsed.workoutProgress === 'object') {
          return parsed.workoutProgress;
        }
      }
    } catch (e) {}
    return {};
  });

  const [hasRestoredSession, setHasRestoredSession] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('active_workout_session_state_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        return Boolean(parsed.isWorkoutActive);
      }
    } catch (e) {}
    return false;
  });

  // Automatically persist active workout state to localStorage
  useEffect(() => {
    if (isWorkoutActive) {
      try {
        localStorage.setItem(
          STORAGE_KEY_ACTIVE_WORKOUT,
          JSON.stringify({
            isWorkoutActive: true,
            activeExerciseIndex,
            workoutProgress,
            savedAt: new Date().toISOString()
          })
        );
      } catch (e) {
        console.error('Failed to save workout session to localStorage', e);
      }
    } else {
      localStorage.removeItem(STORAGE_KEY_ACTIVE_WORKOUT);
    }
  }, [isWorkoutActive, activeExerciseIndex, workoutProgress]);

  const handleExitWorkout = () => {
    localStorage.removeItem(STORAGE_KEY_ACTIVE_WORKOUT);
    setIsWorkoutActive(false);
    setWorkoutProgress({});
    setActiveExerciseIndex(0);
    setHasRestoredSession(false);
  };

  // Active view tab when workout is not active: 'session' | 'jog' | 'manage'
  const [activeTabMode, setActiveTabMode] = useState<'session' | 'jog' | 'manage'>('session');

  // Collapsible dropdown state for routine days list in session view
  const [isRoutineScheduleOpen, setIsRoutineScheduleOpen] = useState(false);

  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  const [shiftSuccessMsg, setShiftSuccessMsg] = useState<string | null>(null);


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
  const [editExIsBodyweightInput, setEditExIsBodyweightInput] = useState(false);
  const [editExCategoriesInput, setEditExCategoriesInput] = useState<string[]>(['Chest']);
  const [editExRepsInput, setEditExRepsInput] = useState<number | string>(10);
  const [editExSetsInput, setEditExSetsInput] = useState<number | string>(3);
  const [editExWeightInput, setEditExWeightInput] = useState<number | string>(30);

  // State for adding a new exercise to a day
  const [addingExToDayIdx, setAddingExToDayIdx] = useState<number | null>(null);
  const [newExName, setNewExName] = useState('');
  const [newExUrl, setNewExUrl] = useState('');
  const [newExIsBodyweight, setNewExIsBodyweight] = useState(false);
  const [newExCategories, setNewExCategories] = useState<string[]>(['Chest']);
  const [newExReps, setNewExReps] = useState<number | string>(10);
  const [newExSets, setNewExSets] = useState<number | string>(3);
  const [newExWeight, setNewExWeight] = useState<number | string>(30);

  // Selected Day state for manual day selection / schedule view
  const [selectedDayIdx, setSelectedDayIdx] = useState<number | null>(null);

  // State for adding a brand new workout day
  const [isAddingDay, setIsAddingDay] = useState(false);
  const [newDayTitle, setNewDayTitle] = useState('');
  const [newDayFocus, setNewDayFocus] = useState('');
  const [newDayIsRest, setNewDayIsRest] = useState(false);
  const [newDayOfWeek, setNewDayOfWeek] = useState<string>('Unassigned');
  const [firstExName, setFirstExName] = useState('');
  const [firstExUrl, setFirstExUrl] = useState('');
  const [firstExIsBodyweight, setFirstExIsBodyweight] = useState(false);
  const [firstExReps, setFirstExReps] = useState(10);
  const [firstExSets, setFirstExSets] = useState(3);
  const [firstExWeight, setFirstExWeight] = useState(30);

  // State for editing day header
  const [editingDayHeaderIdx, setEditingDayHeaderIdx] = useState<number | null>(null);
  const [editDayTitle, setEditDayTitle] = useState('');
  const [editDayFocus, setEditDayFocus] = useState('');

  // 3-dots exercise context menu state
  const [activeMenuKey, setActiveMenuKey] = useState<string | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (activeMenuKey) {
        const target = e.target as HTMLElement;
        if (!target.closest(`.ex-menu-container-${activeMenuKey.replace(/[^a-zA-Z0-9-]/g, '_')}`)) {
          setActiveMenuKey(null);
        }
      }
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, [activeMenuKey]);

  // Duplicate exercise modal state & long-press handling
  const [duplicateModalEx, setDuplicateModalEx] = useState<{ exercise: ParsedWorkoutExercise; sourceDayIdx: number } | null>(null);
  const [duplicateToastMsg, setDuplicateToastMsg] = useState<string | null>(null);
  const longPressTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  // Exercise Drag and Drop Reordering State
  const [draggedDayIdx, setDraggedDayIdx] = useState<number | null>(null);
  const [draggedExIdx, setDraggedExIdx] = useState<number | null>(null);
  const [dragOverDayIdx, setDragOverDayIdx] = useState<number | null>(null);
  const [dragOverExIdx, setDragOverExIdx] = useState<number | null>(null);

  // Routine Day Drag and Drop Reordering State
  const [draggedDaySlotIdx, setDraggedDaySlotIdx] = useState<number | null>(null);
  const [dragOverDaySlotIdx, setDragOverDaySlotIdx] = useState<number | null>(null);
  const [reorderSuccessMsg, setReorderSuccessMsg] = useState<string | null>(null);

  const handleLongPressStart = (exercise: ParsedWorkoutExercise, sourceDayIdx: number) => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }
    longPressTimerRef.current = setTimeout(() => {
      if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
        window.navigator.vibrate(50);
      }
      setDuplicateModalEx({ exercise, sourceDayIdx });
    }, 500);
  };

  const handleLongPressEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleDuplicateToDay = (targetDayIdx: number) => {
    if (!duplicateModalEx) return;
    const { exercise } = duplicateModalEx;
    const targetDay = displayDays[targetDayIdx];
    if (!targetDay || targetDay.isRestDay) return;

    const updatedDays = JSON.parse(JSON.stringify(displayDays));
    if (!updatedDays[targetDayIdx].exercises) {
      updatedDays[targetDayIdx].exercises = [];
    }
    updatedDays[targetDayIdx].exercises.push({ ...exercise });

    saveDisplayDays(updatedDays);

    const targetName = targetDay.dayOfWeek && targetDay.dayOfWeek !== 'Unassigned'
      ? `${targetDay.day || `Day ${targetDayIdx + 1}`} (${targetDay.dayOfWeek})`
      : (targetDay.day || `Day ${targetDayIdx + 1}`);

    setDuplicateToastMsg(`Copied "${exercise.name}" to ${targetName}!`);
    setTimeout(() => setDuplicateToastMsg(null), 3000);

    setDuplicateModalEx(null);
  };

  const selectedDateStr = selectedDate || new Date().toISOString().split('T')[0];
  const todayStr = new Date().toISOString().split('T')[0];
  const isPreviousDay = selectedDateStr < todayStr;

  const getWeekDateForDisplayIndex = (index: number): string => {
    const baseDate = new Date(selectedDateStr + 'T12:00:00');
    const dayOfWeekIdx = baseDate.getDay();
    const sundayDate = new Date(baseDate);
    sundayDate.setDate(baseDate.getDate() - dayOfWeekIdx);
    const targetDate = new Date(sundayDate);
    targetDate.setDate(sundayDate.getDate() + index);
    const yyyy = targetDate.getFullYear();
    const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
    const dd = String(targetDate.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  // Calculate consistency streak
  const streak = calculateStreak(logs, selectedDateStr, parsedWorkouts);

  const [completedSuccessMsg, setCompletedSuccessMsg] = useState(false);

  // Helper for today's day of week
  const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const getTodayDayOfWeek = (): string => {
    const d = selectedDate ? new Date(selectedDate + 'T12:00:00') : new Date();
    return DAYS_OF_WEEK[d.getDay()];
  };
  const todayDayOfWeek = getTodayDayOfWeek();

  const WEEKDAY_ORDER = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

  const getDayWeekdayOrder = (item: ParsedWorkoutDay, originalIdx: number): number => {
    if (item.dayOfWeek) {
      const dowLower = item.dayOfWeek.trim().toLowerCase();
      const idx = WEEKDAY_ORDER.indexOf(dowLower);
      if (idx !== -1) return idx;
    }
    if (item.day) {
      const dayLower = item.day.trim().toLowerCase();
      for (let i = 0; i < WEEKDAY_ORDER.length; i++) {
        if (dayLower.includes(WEEKDAY_ORDER[i])) {
          return i;
        }
      }
    }
    if (item.focusArea) {
      const focusLower = item.focusArea.trim().toLowerCase();
      for (let i = 0; i < WEEKDAY_ORDER.length; i++) {
        if (focusLower.includes(WEEKDAY_ORDER[i])) {
          return i;
        }
      }
    }
    return 100 + originalIdx;
  };

  // Normalized Display Days (uses parsedWorkouts if present, else empty array)
  const getDisplayDays = (): ParsedWorkoutDay[] => {
    if (parsedWorkouts && parsedWorkouts.length > 0) {
      const mapped = parsedWorkouts.map((item, idx) => {
        const focusStr = item.focusArea || item.category || 'Full Body';
        const isRest = Boolean(item.isRestDay || focusStr.toLowerCase().includes('rest'));
        const dayTitle = item.day || `Day ${idx + 1}`;
        if (item && item.exercises && Array.isArray(item.exercises)) {
          return {
            ...item,
            day: dayTitle,
            focusArea: isRest ? 'Rest & Recovery' : focusStr,
            isRestDay: isRest,
            dayOfWeek: item.dayOfWeek
          } as ParsedWorkoutDay;
        }
        return {
          day: dayTitle,
          focusArea: isRest ? 'Rest & Recovery' : focusStr,
          exercises: item.name ? [{ name: item.name, youtubeUrl: item.youtubeUrl }] : [],
          isRestDay: isRest,
          dayOfWeek: item.dayOfWeek
        };
      });

      const DAYS_ORDER = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const resultDays = mapped.map((d, idx) => ({
        ...d,
        dayOfWeek: d.dayOfWeek || DAYS_ORDER[idx % 7]
      }));

      // Ensure constant size of 7 days
      while (resultDays.length < 7) {
        const nextIdx = resultDays.length;
        const assignedDow = DAYS_ORDER[nextIdx] || undefined;
        resultDays.push({
          day: `Day ${nextIdx + 1}`,
          focusArea: 'Rest & Recovery',
          isRestDay: true,
          dayOfWeek: assignedDow,
          exercises: []
        });
      }

      return resultDays.slice(0, 7);
    }

    // Default 7 days if empty
    const DAYS_ORDER = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return DAYS_ORDER.map((dow, idx) => ({
      day: `Day ${idx + 1}`,
      focusArea: 'Rest & Recovery',
      isRestDay: true,
      dayOfWeek: dow,
      exercises: []
    }));
  };

  const displayDays = getDisplayDays();

  // Save updated days to parent state / persistence
  const saveDisplayDays = (updatedDays: ParsedWorkoutDay[]) => {
    const cleanedDays = JSON.parse(JSON.stringify(updatedDays));
    if (onUpdateParsedWorkouts) {
      onUpdateParsedWorkouts(cleanedDays);
    }
  };

  // Determine active day index: selected tab > selected date's day of week match > streak rotation
  const getActiveDayIndex = (): number => {
    if (displayDays.length === 0) return 0;

    if (selectedDayIdx !== null && selectedDayIdx >= 0 && selectedDayIdx < displayDays.length) {
      return selectedDayIdx;
    }

    const selectedDateDow = new Date(selectedDateStr + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long' });

    // Try to match selected date's Day of Week (e.g. 'Monday' or 'Monday' in day title)
    const matchDowIdx = displayDays.findIndex(d => 
      (d.dayOfWeek && d.dayOfWeek.toLowerCase() === selectedDateDow.toLowerCase()) ||
      (d.day && d.day.toLowerCase().includes(selectedDateDow.toLowerCase()))
    );
    if (matchDowIdx !== -1) {
      return matchDowIdx;
    }

    return (streak - 1) % displayDays.length;
  };

  const selectedDateLog = logs ? logs.find((l: any) => l.date === selectedDateStr) : null;
  const dateOverride = selectedDateLog?.oneTimeScheduleOverride;

  const currentDayIndex = getActiveDayIndex();
  const defaultDayObj = displayDays.length > 0 ? (displayDays[currentDayIndex] || displayDays[0]) : null;

  let isCurrentDayRest = false;
  let currentPlan: any = null;

  if (dateOverride) {
    if (dateOverride.isRestDay) {
      isCurrentDayRest = true;
      currentPlan = {
        day: currentDayIndex + 1,
        title: 'Rest & Recovery',
        focus: 'Rest & Recovery',
        category: 'Rest',
        rawExercises: [],
        exercises: [],
        isRestDay: true,
        dayOfWeek: defaultDayObj?.dayOfWeek,
        isOneTimeShift: true,
        shiftedToDate: dateOverride.shiftedToDate,
        shiftedFromDate: dateOverride.shiftedFromDate,
        overrideLabel: dateOverride.shiftedToDate
          ? `One-Time Shift: Rest Day today (Session moved to ${getDayNameFromDateString(dateOverride.shiftedToDate)}, ${dateOverride.shiftedToDate})`
          : 'One-Time Shift: Rest Day today'
      };
    } else {
      isCurrentDayRest = false;
      const targetRoutineDay = dateOverride.assignedRoutineDayIndex !== undefined && displayDays[dateOverride.assignedRoutineDayIndex]
        ? displayDays[dateOverride.assignedRoutineDayIndex]
        : null;

      const rawExs = dateOverride.customExercises || targetRoutineDay?.exercises || defaultDayObj?.exercises || [];
      const focusArea = dateOverride.customFocus || targetRoutineDay?.focusArea || defaultDayObj?.focusArea || 'Full Body';
      const titleStr = dateOverride.customTitle || targetRoutineDay?.day || defaultDayObj?.day || `Day ${currentDayIndex + 1}`;

      currentPlan = {
        day: (dateOverride.assignedRoutineDayIndex !== undefined ? dateOverride.assignedRoutineDayIndex : currentDayIndex) + 1,
        title: titleStr,
        focus: focusArea,
        category: focusArea.split('&')[0].trim(),
        rawExercises: rawExs,
        exercises: rawExs.map((e: any) => e.name),
        isRestDay: false,
        dayOfWeek: defaultDayObj?.dayOfWeek,
        isOneTimeShift: true,
        shiftedFromDate: dateOverride.shiftedFromDate,
        overrideLabel: dateOverride.shiftedFromDate
          ? `One-Time Shifted Session (from ${getDayNameFromDateString(dateOverride.shiftedFromDate)}, ${dateOverride.shiftedFromDate})`
          : 'One-Time Custom Session'
      };
    }
  } else {
    isCurrentDayRest = Boolean(defaultDayObj && (defaultDayObj.isRestDay || defaultDayObj.focusArea?.toLowerCase().includes('rest')));
    currentPlan = defaultDayObj ? {
      day: currentDayIndex + 1,
      title: defaultDayObj.day || `Day ${currentDayIndex + 1}`,
      focus: isCurrentDayRest ? 'Rest & Recovery' : (defaultDayObj.focusArea || 'Full Body'),
      category: isCurrentDayRest ? 'Rest' : (defaultDayObj.focusArea ? defaultDayObj.focusArea.split('&')[0].trim() : 'Full Body'),
      rawExercises: defaultDayObj.exercises || [],
      exercises: (defaultDayObj.exercises || []).map(e => e.name),
      isRestDay: isCurrentDayRest,
      dayOfWeek: defaultDayObj.dayOfWeek,
      isOneTimeShift: false
    } : null;
  }

  // Find next non-rest workout day in sequence for preview / smooth progression
  const getNextNonRestDay = () => {
    if (displayDays.length === 0) return { idx: -1, dayObj: null };
    for (let i = 1; i <= displayDays.length; i++) {
      const checkIdx = (currentDayIndex + i) % displayDays.length;
      const d = displayDays[checkIdx];
      const isRest = Boolean(d && (d.isRestDay || d.focusArea?.toLowerCase().includes('rest')));
      if (!isRest) {
        return { idx: checkIdx, dayObj: d };
      }
    }
    return { idx: -1, dayObj: null };
  };
  const { idx: nextNonRestDayIdx, dayObj: nextNonRestDayObj } = getNextNonRestDay();

  // Log Rest Day Handler (creates completed Rest entry to preserve counting/streak)
  const handleLogRestDay = () => {
    const restWorkout: Omit<Workout, 'id'> = {
      name: `${currentPlan?.title || 'Rest Day'} (Rest & Recovery)`,
      category: 'Rest',
      completed: true,
      sets: []
    };
    onAddWorkout(restWorkout);
    setCompletedSuccessMsg(true);
    setTimeout(() => setCompletedSuccessMsg(false), 4000);
  };


  // Move today's session to tomorrow and make today a Rest Day (one-time only)
  const handleMoveSessionToTomorrow = () => {
    if (!onUpdateDailyLog || !currentPlan) return;
    const tomorrowStr = addDaysToDateString(selectedDateStr, 1);

    // Today becomes a Rest Day
    onUpdateDailyLog(selectedDateStr, (log: any) => ({
      ...log,
      oneTimeScheduleOverride: {
        isRestDay: true,
        shiftedToDate: tomorrowStr
      }
    }));

    // Tomorrow receives today's workout session
    onUpdateDailyLog(tomorrowStr, (log: any) => ({
      ...log,
      oneTimeScheduleOverride: {
        assignedRoutineDayIndex: currentDayIndex,
        customTitle: currentPlan.title,
        customFocus: currentPlan.focus,
        customExercises: currentPlan.rawExercises,
        shiftedFromDate: selectedDateStr
      }
    }));

    setIsShiftModalOpen(false);
    setShiftSuccessMsg(`Session moved to tomorrow (${getDayNameFromDateString(tomorrowStr)})! Today is set as a Rest Day.`);
    setTimeout(() => setShiftSuccessMsg(null), 5000);
  };

  // Swap today's session with a Rest Day in the current week
  const handleSwapWithRestDay = (targetDateStr: string, targetDayName: string) => {
    if (!onUpdateDailyLog || !currentPlan) return;

    // Today becomes a Rest Day
    onUpdateDailyLog(selectedDateStr, (log: any) => ({
      ...log,
      oneTimeScheduleOverride: {
        isRestDay: true,
        shiftedToDate: targetDateStr
      }
    }));

    // Target date receives today's workout session
    onUpdateDailyLog(targetDateStr, (log: any) => ({
      ...log,
      oneTimeScheduleOverride: {
        assignedRoutineDayIndex: currentDayIndex,
        customTitle: currentPlan.title,
        customFocus: currentPlan.focus,
        customExercises: currentPlan.rawExercises,
        shiftedFromDate: selectedDateStr
      }
    }));

    setIsShiftModalOpen(false);
    setShiftSuccessMsg(`Swapped today's session with ${targetDayName} (${targetDateStr})! Today is set as a Rest Day.`);
    setTimeout(() => setShiftSuccessMsg(null), 5000);
  };

  // Set today as Rest Day only
  const handleMakeTodayRestDayOnly = () => {
    if (!onUpdateDailyLog) return;

    onUpdateDailyLog(selectedDateStr, (log: any) => ({
      ...log,
      oneTimeScheduleOverride: {
        isRestDay: true
      }
    }));

    setIsShiftModalOpen(false);
    setShiftSuccessMsg(`Set today (${formatDateDDMMYYYY(selectedDateStr)}) as a one-time Rest Day.`);
    setTimeout(() => setShiftSuccessMsg(null), 5000);
  };

  // Undo shift and revert schedule to master weekly program
  const handleUndoShift = () => {
    if (!onUpdateDailyLog || !selectedDateLog) return;
    const override = selectedDateLog.oneTimeScheduleOverride;

    // Remove override from current date
    onUpdateDailyLog(selectedDateStr, (log: any) => {
      const copy = { ...log };
      delete copy.oneTimeScheduleOverride;
      return copy;
    });

    // Remove override from linked date if present
    const linkedDate = override?.shiftedToDate || override?.shiftedFromDate;
    if (linkedDate) {
      onUpdateDailyLog(linkedDate, (log: any) => {
        const copy = { ...log };
        delete copy.oneTimeScheduleOverride;
        return copy;
      });
    }

    setShiftSuccessMsg(`Schedule reset to standard weekly routine.`);
    setTimeout(() => setShiftSuccessMsg(null), 4000);
  };

  const isRestDayToday = Boolean(
    isCurrentDayRest ||
    selectedDateLog?.isRestDay ||
    selectedDateLog?.oneTimeScheduleOverride?.isRestDay
  );

  const currentDateJogs: JogSession[] = selectedDateLog?.jogs || [];

  const handleSaveJogSession = (session: JogSession) => {
    if (onUpdateDailyLog) {
      onUpdateDailyLog(selectedDateStr, (log: any) => {
        const existingJogs = log?.jogs || [];
        const activityLabel = session.activityType === 'fast_walk' ? 'Fast Walk' : 'Outdoor Jog';
        const cardioWorkout: Workout = {
          id: `jog-${session.id}`,
          name: `${activityLabel} - ${session.distanceKm.toFixed(2)} km`,
          category: 'Cardio',
          sets: [
            {
              id: `set-jog-${Date.now()}`,
              reps: Math.max(1, Math.round(session.durationSeconds / 60)),
              weight: session.caloriesBurned,
              completed: true,
            }
          ],
          completed: true,
        };

        return {
          ...log,
          jogs: [...existingJogs, session],
          workouts: [...(log?.workouts || []), cardioWorkout]
        };
      });
    }
    setActiveTabMode('session');
    setCompletedSuccessMsg(true);
    setTimeout(() => setCompletedSuccessMsg(false), 4000);
  };

  const handleUpdateJogSession = (session: JogSession) => {
    if (onUpdateDailyLog) {
      onUpdateDailyLog(selectedDateStr, (log: any) => {
        const activityLabel = session.activityType === 'fast_walk' ? 'Fast Walk' : 'Outdoor Jog';
        const updatedJogs = (log?.jogs || []).map((j: any) => (j.id === session.id ? session : j));
        const updatedWorkouts = (log?.workouts || []).map((w: any) => {
          if (w.id === `jog-${session.id}`) {
            return {
              ...w,
              name: `${activityLabel} - ${session.distanceKm.toFixed(2)} km`,
              sets: [
                {
                  id: w.sets?.[0]?.id || `set-jog-${Date.now()}`,
                  reps: Math.max(1, Math.round(session.durationSeconds / 60)),
                  weight: session.caloriesBurned,
                  completed: true,
                }
              ]
            };
          }
          return w;
        });
        return {
          ...log,
          jogs: updatedJogs,
          workouts: updatedWorkouts
        };
      });
    }
  };

  const handleDeleteJogSession = (jogId: string) => {
    if (onUpdateDailyLog) {
      onUpdateDailyLog(selectedDateStr, (log: any) => {
        const updatedJogs = (log?.jogs || []).filter((j: any) => j.id !== jogId);
        const updatedWorkouts = (log?.workouts || []).filter((w: any) => w.id !== `jog-${jogId}`);
        return {
          ...log,
          jogs: updatedJogs,
          workouts: updatedWorkouts
        };
      });
    }
  };

  // Toggle Rest Day for a day in routine editor
  const handleToggleRestDay = (dayIdx: number) => {
    const currentDays = getDisplayDays();
    if (!currentDays[dayIdx]) return;

    const updated = [...currentDays];
    const target = updated[dayIdx];
    const newIsRest = !target.isRestDay;

    updated[dayIdx] = {
      ...target,
      isRestDay: newIsRest,
      focusArea: newIsRest ? 'Rest & Recovery' : (target.focusArea === 'Rest & Recovery' ? 'Full Body' : target.focusArea)
    };
    saveDisplayDays(updated);
  };

  // Set Day of Week for a day in routine editor
  const handleChangeDayOfWeek = (dayIdx: number, newDow: string) => {
    const currentDays = getDisplayDays();
    if (!currentDays[dayIdx]) return;

    const updated = [...currentDays];
    updated[dayIdx] = {
      ...updated[dayIdx],
      dayOfWeek: newDow === 'Unassigned' ? undefined : newDow
    };
    saveDisplayDays(updated);
  };

  // Helper to accurately find YouTube URL matching an exercise name (Exact Match Only)
  const findMatchingYoutubeUrl = (exerciseName: string): string | null => {
    if (!exerciseName || !displayDays || displayDays.length === 0) return null;
    const target = exerciseName.toLowerCase().trim();

    for (const dayItem of displayDays) {
      if (dayItem && dayItem.exercises && Array.isArray(dayItem.exercises)) {
        for (const ex of dayItem.exercises) {
          if (ex && ex.name && ex.youtubeUrl) {
            if (ex.name.toLowerCase().trim() === target) {
              return ex.youtubeUrl;
            }
          }
        }
      }
    }

    return null;
  };

  const getActiveYoutubeId = (): string | null => {
    if (!currentPlan) return null;
    const rawEx = currentPlan.rawExercises[activeExerciseIndex];
    if (!rawEx) return null;

    // 1. First priority: Direct YouTube URL on active exercise object
    if (rawEx.youtubeUrl && rawEx.youtubeUrl.trim() !== '') {
      const videoId = extractYoutubeVideoId(rawEx.youtubeUrl);
      if (videoId) return videoId;
    }

    // 2. Second priority: Database lookup by exercise name
    const matchedKey = matchExerciseKey(rawEx.name);
    const dbEntry = EXERCISES_DATABASE[matchedKey];
    if (dbEntry && dbEntry.youtubeVideoId) {
      return dbEntry.youtubeVideoId;
    }

    // 3. Fallback: Search exact exercise name match across days
    const matchUrl = findMatchingYoutubeUrl(rawEx.name);
    if (matchUrl) {
      const videoId = extractYoutubeVideoId(matchUrl);
      if (videoId) return videoId;
    }

    return null;
  };

  const activeYoutubeId = getActiveYoutubeId();

  // Helper filters to strictly distinguish resistance lifting from jogs/cardio/rest
  const isJogWorkout = (w: any) => {
    if (!w) return false;
    const cat = (w.category || '').toLowerCase();
    const name = (w.name || '').toLowerCase();
    const id = (w.id || '').toLowerCase();
    return cat === 'cardio' || id.startsWith('jog-') || name.includes('jog') || name.includes('walk') || name.includes('running');
  };

  const isRestWorkout = (w: any) => {
    if (!w) return false;
    const cat = (w.category || '').toLowerCase();
    const name = (w.name || '').toLowerCase();
    return cat === 'rest' || name.includes('rest');
  };

  const isLiftingWorkout = (w: any) => {
    return !isRestWorkout(w) && !isJogWorkout(w);
  };

  const loggedWorkouts = selectedDateLog?.workouts || [];
  const loggedLiftingWorkouts = loggedWorkouts.filter(isLiftingWorkout);
  const loggedJogWorkouts = loggedWorkouts.filter(isJogWorkout);
  
  const hasLiftingWorkoutsLogged = loggedLiftingWorkouts.length > 0;
  const hasRestDayLogged = loggedWorkouts.some(isRestWorkout);
  const hasJogsLogged = (selectedDateLog?.jogs && selectedDateLog.jogs.length > 0) || loggedJogWorkouts.length > 0;
  
  // Daily lift is considered completed ONLY if actual lifting / resistance workouts are logged
  const isLiftingCompletedToday = hasLiftingWorkoutsLogged;

  // Should we render the Rest Day UI? If it's a rest day and no lifting workouts were logged, render Rest Day UI
  const showRestDayView = Boolean(currentPlan?.isRestDay) && !hasLiftingWorkoutsLogged;

  // Initialize progress state when starting workout
  const handleStartWorkout = () => {
    if (isPreviousDay) return; // Cannot start live guided session for past days
    if (!currentPlan || currentPlan.exercises.length === 0) return;
    const initialProgress: Record<string, { reps: number; weight: number; completed: boolean }> = {};
    
    currentPlan.rawExercises.forEach((rawEx) => {
      const exName = rawEx.name;
      const dbEntry = EXERCISES_DATABASE[matchExerciseKey(exName)];
      
      const isBodyweight = rawEx.isBodyweight !== undefined
        ? rawEx.isBodyweight
        : (exName.toLowerCase().includes('bodyweight') || exName.toLowerCase().includes('stretching') || exName.toLowerCase().includes('crunch') || exName.toLowerCase().includes('leg raise') || exName.toLowerCase().includes('pushup') || exName.toLowerCase().includes('pullup'));

      let defaultReps = rawEx.reps || 10;
      if (!rawEx.reps && dbEntry) {
        const matches = dbEntry.volume.match(/(\d+)\s+repetitions/i) || dbEntry.volume.match(/(\d+)-(\d+)\s+repetitions/i);
        if (matches) {
          defaultReps = parseInt(matches[1]);
        }
      }

      const setsCount = rawEx.sets || 3;
      const initialWeight = isBodyweight ? 0 : (rawEx.weight !== undefined ? rawEx.weight : 30);

      for (let s = 0; s < setsCount; s++) {
        initialProgress[`${exName}-${s}`] = {
          reps: defaultReps,
          weight: initialWeight,
          completed: false
        };
      }
    });

    setWorkoutProgress(initialProgress);
    setActiveExerciseIndex(0);
    setIsWorkoutActive(true);
  };

  const handleAddExtraSetToExercise = (exName: string, rawEx: any) => {
    const setKeysForEx = Object.keys(workoutProgress)
      .filter(k => k.startsWith(`${exName}-`))
      .map(k => parseInt(k.replace(`${exName}-`, ''), 10))
      .filter(n => !isNaN(n));
    const maxSetIdx = setKeysForEx.length > 0 ? Math.max(...setKeysForEx) : (rawEx?.sets ? rawEx.sets - 1 : 2);
    const newIdx = maxSetIdx + 1;
    const newSetKey = `${exName}-${newIdx}`;

    const isBodyweight = rawEx?.isBodyweight !== undefined
      ? rawEx.isBodyweight
      : (exName.toLowerCase().includes('bodyweight') ||
         exName.toLowerCase().includes('stretching') ||
         exName.toLowerCase().includes('crunch') ||
         exName.toLowerCase().includes('leg raise') ||
         exName.toLowerCase().includes('pushup') ||
         exName.toLowerCase().includes('pullup'));

    setWorkoutProgress(prev => ({
      ...prev,
      [newSetKey]: {
        reps: rawEx?.reps || 10,
        weight: isBodyweight ? 0 : (rawEx?.weight !== undefined ? rawEx.weight : 30),
        completed: false
      }
    }));

    // Update routine day in parsedWorkouts as well so set count is stored permanently in user routine
    const currentDays = getDisplayDays();
    if (currentDays[currentDayIndex]) {
      const updated = [...currentDays];
      const dayObj = { ...updated[currentDayIndex] };
      const exercises = [...(dayObj.exercises || [])];
      const targetExIdx = exercises.findIndex(e => e.name === exName);
      if (targetExIdx >= 0) {
        exercises[targetExIdx] = {
          ...exercises[targetExIdx],
          sets: newIdx + 1
        };
        dayObj.exercises = exercises;
        updated[currentDayIndex] = dayObj;
        saveDisplayDays(updated);
      }
    }
  };

  const handleDeleteSetFromExercise = (exName: string, setIdxToDelete: number, rawEx: any) => {
    const setKeysForEx = Object.keys(workoutProgress)
      .filter(k => k.startsWith(`${exName}-`))
      .map(k => parseInt(k.replace(`${exName}-`, ''), 10))
      .filter(n => !isNaN(n));
    const maxSetIdx = setKeysForEx.length > 0 ? Math.max(...setKeysForEx) : (rawEx?.sets ? rawEx.sets - 1 : 2);
    const currentTotalSets = Math.max(rawEx?.sets || 1, maxSetIdx + 1);
    if (currentTotalSets <= 1) return; // Keep at least 1 working set

    const newTotalSets = currentTotalSets - 1;

    setWorkoutProgress(prev => {
      const next = { ...prev };
      // Delete old indexed keys for this exercise
      for (let i = 0; i <= maxSetIdx; i++) {
        delete next[`${exName}-${i}`];
      }
      // Re-index remaining sets sequentially
      let newIdx = 0;
      for (let i = 0; i < currentTotalSets; i++) {
        if (i === setIdxToDelete) continue;
        const oldKey = `${exName}-${i}`;
        if (prev[oldKey]) {
          next[`${exName}-${newIdx}`] = prev[oldKey];
        } else {
          next[`${exName}-${newIdx}`] = {
            reps: rawEx?.reps || 10,
            weight: rawEx?.weight !== undefined ? rawEx.weight : 30,
            completed: false
          };
        }
        newIdx++;
      }
      return next;
    });

    // Update routine day in displayDays as well
    const currentDays = getDisplayDays();
    if (currentDays[currentDayIndex]) {
      const updated = [...currentDays];
      const dayObj = { ...updated[currentDayIndex] };
      const exercises = [...(dayObj.exercises || [])];
      const targetExIdx = exercises.findIndex(e => e.name === exName);
      if (targetExIdx >= 0) {
        exercises[targetExIdx] = {
          ...exercises[targetExIdx],
          sets: Math.max(1, newTotalSets)
        };
        dayObj.exercises = exercises;
        updated[currentDayIndex] = dayObj;
        saveDisplayDays(updated);
      }
    }
  };

  const MUSCLE_GROUP_OPTIONS = ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core', 'Cardio'];

  const inferMuscleGroups = (name?: string, dayFocus?: string, categoryStr?: string): string[] => {
    const results = new Set<string>();
    const cat = categoryStr?.trim().toLowerCase() || '';

    if (cat) {
      cat.split(/[,/&]+/).forEach((p) => {
        const match = MUSCLE_GROUP_OPTIONS.find((m) => m.toLowerCase() === p.trim());
        if (match) results.add(match);
      });
      if (results.size > 0) return Array.from(results);
    }

    const nm = name?.trim().toLowerCase() || '';
    const focus = dayFocus?.trim().toLowerCase() || '';

    if (nm.includes('pushup') || nm.includes('push-up')) {
      results.add('Chest');
      results.add('Arms');
    } else if (nm.includes('bench') || nm.includes('chest') || nm.includes('fly') || nm.includes('pec')) {
      results.add('Chest');
      if (nm.includes('press') || nm.includes('bench')) results.add('Arms');
    }

    if (nm.includes('pullup') || nm.includes('pull-up') || nm.includes('row') || nm.includes('pulldown') || nm.includes('deadlift') || nm.includes('lat')) {
      results.add('Back');
      if (nm.includes('pull') || nm.includes('row')) results.add('Arms');
    }

    if (nm.includes('squat') || nm.includes('lunge') || (nm.includes('leg') && !nm.includes('leg raise')) || nm.includes('quad') || nm.includes('hamstring') || nm.includes('calf')) {
      results.add('Legs');
    }

    if (nm.includes('shoulder') || nm.includes('delt') || nm.includes('overhead') || nm.includes('lateral raise') || nm.includes('front raise')) {
      results.add('Shoulders');
      if (nm.includes('overhead')) results.add('Arms');
    }

    if (nm.includes('curl') || nm.includes('bicep') || nm.includes('tricep') || nm.includes('dip') || nm.includes('arm')) {
      results.add('Arms');
      if (nm.includes('dip')) results.add('Chest');
    }

    if (nm.includes('plank') || nm.includes('crunch') || nm.includes('abs') || nm.includes('core') || nm.includes('leg raise')) {
      results.add('Core');
    }

    if (nm.includes('cardio') || nm.includes('run') || nm.includes('treadmill') || nm.includes('cycle')) {
      results.add('Cardio');
    }

    if (results.size === 0) {
      if (focus.includes('chest')) results.add('Chest');
      if (focus.includes('back')) results.add('Back');
      if (focus.includes('leg')) results.add('Legs');
      if (focus.includes('shoulder')) results.add('Shoulders');
      if (focus.includes('arm') || focus.includes('bicep') || focus.includes('tricep')) results.add('Arms');
      if (focus.includes('core') || focus.includes('ab')) results.add('Core');
      if (focus.includes('cardio')) results.add('Cardio');
    }

    if (results.size === 0) results.add('Chest');
    return Array.from(results);
  };

  const handleFinishAndSaveWorkout = () => {
    if (!currentPlan) return;
    const workoutsToSave: Omit<Workout, 'id'>[] = [];

    currentPlan.exercises.forEach((exName, exIdx) => {
      const rawEx = currentPlan.rawExercises[exIdx];
      const setKeysForEx = Object.keys(workoutProgress)
        .filter(k => k.startsWith(`${exName}-`))
        .map(k => parseInt(k.replace(`${exName}-`, ''), 10))
        .filter(n => !isNaN(n));
      const maxSetIdx = setKeysForEx.length > 0 ? Math.max(...setKeysForEx) : -1;
      const setsCount = Math.max(rawEx?.sets || 3, maxSetIdx + 1);

      const setsForExercise: Omit<SetLog, 'id'>[] = [];
      
      for (let s = 0; s < setsCount; s++) {
        const setKey = `${exName}-${s}`;
        const p = workoutProgress[setKey] || { reps: rawEx?.reps || 10, weight: rawEx?.isBodyweight ? 0 : (rawEx?.weight !== undefined ? rawEx.weight : 30), completed: true };
        setsForExercise.push({
          reps: p.reps,
          weight: p.weight,
          completed: true
        });
      }

      const rawCategory = rawEx?.category || inferMuscleGroups(rawEx?.name || exName, currentPlan.focus).join(', ');
      const exCategory = normalizeWorkoutCategory(rawCategory, rawEx?.name || exName);

      workoutsToSave.push({
        name: exName,
        category: exCategory as any,
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

    localStorage.removeItem(STORAGE_KEY_ACTIVE_WORKOUT);
    setIsWorkoutActive(false);
    setWorkoutProgress({});
    setActiveExerciseIndex(0);
    setHasRestoredSession(false);
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
    for (let i = 0; i < currentPlan.exercises.length; i++) {
      const exName = currentPlan.exercises[i];
      const rawEx = currentPlan.rawExercises?.[i];
      const setKeysForEx = Object.keys(workoutProgress)
        .filter(k => k.startsWith(`${exName}-`))
        .map(k => parseInt(k.replace(`${exName}-`, ''), 10))
        .filter(n => !isNaN(n));
      const maxSetIdx = setKeysForEx.length > 0 ? Math.max(...setKeysForEx) : -1;
      const setsCount = Math.max(rawEx?.sets || 3, maxSetIdx + 1);

      for (let s = 0; s < setsCount; s++) {
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

    const targetCategories = newExCategories.length > 0 ? newExCategories : inferMuscleGroups(newExName.trim(), dayObj.focusArea);

    exercises.push({
      name: newExName.trim(),
      category: targetCategories.join(', '),
      youtubeUrl: newExUrl.trim() || undefined,
      isBodyweight: newExIsBodyweight,
      reps: Number(newExReps) > 0 ? Number(newExReps) : 10,
      sets: Number(newExSets) > 0 ? Number(newExSets) : 3,
      weight: !newExIsBodyweight ? (Number(newExWeight) >= 0 ? Number(newExWeight) : 30) : 0
    });

    dayObj.exercises = exercises;
    updated[dayIdx] = dayObj;
    saveDisplayDays(updated);

    setNewExName('');
    setNewExUrl('');
    setNewExIsBodyweight(false);
    setNewExCategories(['Chest']);
    setNewExReps(10);
    setNewExSets(3);
    setNewExWeight(30);
    setAddingExToDayIdx(null);
  };

  const handleSaveExerciseEdit = (dayIdx: number, exIdx: number) => {
    if (!editExNameInput.trim()) return;
    const currentDays = getDisplayDays();
    const updated = [...currentDays];
    const dayObj = { ...updated[dayIdx] };
    const exercises = [...(dayObj.exercises || [])];

    const targetCategories = editExCategoriesInput.length > 0 ? editExCategoriesInput : inferMuscleGroups(editExNameInput.trim(), dayObj.focusArea);

    exercises[exIdx] = {
      ...exercises[exIdx],
      name: editExNameInput.trim(),
      category: targetCategories.join(', '),
      youtubeUrl: editExUrlInput.trim() || undefined,
      isBodyweight: editExIsBodyweightInput,
      reps: Number(editExRepsInput) > 0 ? Number(editExRepsInput) : 10,
      sets: Number(editExSetsInput) > 0 ? Number(editExSetsInput) : 3,
      weight: !editExIsBodyweightInput ? (Number(editExWeightInput) >= 0 ? Number(editExWeightInput) : 30) : 0
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
    const focus = newDayIsRest ? 'Rest & Recovery' : (newDayFocus.trim() || 'Full Body');

    const initialEx = (!newDayIsRest && firstExName.trim())
      ? [{
          name: firstExName.trim(),
          youtubeUrl: firstExUrl.trim() || undefined,
          isBodyweight: firstExIsBodyweight,
          reps: firstExReps > 0 ? firstExReps : 10,
          sets: firstExSets > 0 ? firstExSets : 3,
          weight: !firstExIsBodyweight ? (firstExWeight >= 0 ? firstExWeight : 30) : 0
        }]
      : [];

    const newDayObj: ParsedWorkoutDay = {
      day: title,
      focusArea: focus,
      isRestDay: newDayIsRest,
      dayOfWeek: newDayOfWeek === 'Unassigned' ? undefined : newDayOfWeek,
      exercises: initialEx
    };

    saveDisplayDays([...currentDays, newDayObj]);

    setNewDayTitle('');
    setNewDayFocus('');
    setNewDayIsRest(false);
    setNewDayOfWeek('Unassigned');
    setFirstExName('');
    setFirstExUrl('');
    setFirstExIsBodyweight(false);
    setFirstExReps(10);
    setFirstExSets(3);
    setFirstExWeight(30);
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

  const handleReorderDays = (fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx) return;
    const currentDays = getDisplayDays();
    if (fromIdx < 0 || fromIdx >= currentDays.length || toIdx < 0 || toIdx >= currentDays.length) return;

    const reordered = [...currentDays];
    const [movedDay] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, movedDay);

    const DAYS_ORDER = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    // Update weekday assignment to match the new slot order in the weekly routine
    // so that today's date and the calendar seamlessly reflect the new day for each routine!
    const updated = reordered.map((d, idx) => ({
      ...d,
      dayOfWeek: DAYS_ORDER[idx % 7],
      day: d.day && /^Day \d+$/i.test(d.day.trim()) ? `Day ${idx + 1}` : d.day
    }));

    saveDisplayDays(updated);

    // Keep active selection aligned with the user's focus
    if (selectedDayIdx === fromIdx) {
      setSelectedDayIdx(toIdx);
    } else if (selectedDayIdx !== null) {
      if (fromIdx < selectedDayIdx && toIdx >= selectedDayIdx) {
        setSelectedDayIdx(selectedDayIdx - 1);
      } else if (fromIdx > selectedDayIdx && toIdx <= selectedDayIdx) {
        setSelectedDayIdx(selectedDayIdx + 1);
      }
    }

    setReorderSuccessMsg(`Schedule updated: ${movedDay.focusArea || movedDay.day || 'Day'} moved to ${DAYS_ORDER[toIdx % 7]}.`);
    setTimeout(() => setReorderSuccessMsg(null), 3500);
  };

  const handleMoveDay = (dayIdx: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? dayIdx - 1 : dayIdx + 1;
    const currentDays = getDisplayDays();
    if (targetIdx < 0 || targetIdx >= currentDays.length) return;
    handleReorderDays(dayIdx, targetIdx);
  };

  const handleDayDragStart = (e: React.DragEvent, idx: number) => {
    setDraggedDaySlotIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
    try {
      e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'day', daySlotIdx: idx }));
    } catch {
      // fallback
    }
  };

  const handleDayDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverDaySlotIdx !== idx) {
      setDragOverDaySlotIdx(idx);
    }
  };

  const handleDayDragEnd = () => {
    setDraggedDaySlotIdx(null);
    setDragOverDaySlotIdx(null);
  };

  const handleDayDrop = (e: React.DragEvent, targetIdx: number) => {
    e.preventDefault();
    if (draggedDaySlotIdx !== null && draggedDaySlotIdx !== targetIdx) {
      handleReorderDays(draggedDaySlotIdx, targetIdx);
    }
    handleDayDragEnd();
  };

  const handleReorderExercise = (dayIdx: number, fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx) return;
    const currentDays = getDisplayDays();
    if (!currentDays[dayIdx]) return;
    const updated = [...currentDays];
    const dayObj = { ...updated[dayIdx] };
    const exercises = [...(dayObj.exercises || [])];
    if (fromIdx < 0 || fromIdx >= exercises.length || toIdx < 0 || toIdx >= exercises.length) return;
    const [movedEx] = exercises.splice(fromIdx, 1);
    exercises.splice(toIdx, 0, movedEx);
    dayObj.exercises = exercises;
    updated[dayIdx] = dayObj;
    saveDisplayDays(updated);
  };

  const handleMoveExercise = (dayIdx: number, exIdx: number, direction: 'up' | 'down') => {
    const currentDays = getDisplayDays();
    const dayObj = currentDays[dayIdx];
    if (!dayObj || !dayObj.exercises) return;
    const targetIdx = direction === 'up' ? exIdx - 1 : exIdx + 1;
    if (targetIdx < 0 || targetIdx >= dayObj.exercises.length) return;
    handleReorderExercise(dayIdx, exIdx, targetIdx);
  };

  const handleDragStart = (e: React.DragEvent, dayIdx: number, exIdx: number) => {
    setDraggedDayIdx(dayIdx);
    setDraggedExIdx(exIdx);
    e.dataTransfer.effectAllowed = 'move';
    try {
      e.dataTransfer.setData('text/plain', JSON.stringify({ dayIdx, exIdx }));
    } catch {
      // safe fallback
    }
  };

  const handleDragOver = (e: React.DragEvent, dayIdx: number, exIdx: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverDayIdx !== dayIdx || dragOverExIdx !== exIdx) {
      setDragOverDayIdx(dayIdx);
      setDragOverExIdx(exIdx);
    }
  };

  const handleDragEnd = () => {
    setDraggedDayIdx(null);
    setDraggedExIdx(null);
    setDragOverDayIdx(null);
    setDragOverExIdx(null);
  };

  const handleDrop = (e: React.DragEvent, targetDayIdx: number, targetExIdx: number) => {
    e.preventDefault();
    if (draggedDayIdx !== null && draggedExIdx !== null && draggedDayIdx === targetDayIdx) {
      handleReorderExercise(targetDayIdx, draggedExIdx, targetExIdx);
    }
    handleDragEnd();
  };

  const handleSortDaysSundayToSaturday = () => {
    const currentDays = getDisplayDays();
    if (currentDays.length === 0) return;

    const DAYS_ORDER = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

    const getOrder = (d: ParsedWorkoutDay, originalIdx: number): number => {
      if (d.dayOfWeek) {
        const idx = DAYS_ORDER.indexOf(d.dayOfWeek.toLowerCase());
        if (idx !== -1) return idx;
      }
      if (d.day) {
        const dayLower = d.day.toLowerCase();
        for (let i = 0; i < DAYS_ORDER.length; i++) {
          if (dayLower.includes(DAYS_ORDER[i])) return i;
        }
      }
      return 100 + originalIdx;
    };

    const sorted = [...currentDays].sort((a, b) => {
      const idxA = currentDays.indexOf(a);
      const idxB = currentDays.indexOf(b);
      return getOrder(a, idxA) - getOrder(b, idxB);
    });

    saveDisplayDays(sorted);
  };

  const handleAutoAssignDaysOfWeek = () => {
    const currentDays = getDisplayDays();
    if (currentDays.length === 0) return;
    const updated = currentDays.map((d, idx) => ({
      ...d,
      dayOfWeek: DAYS_OF_WEEK[idx % 7]
    }));
    saveDisplayDays(updated);
  };

  const handleClearDaysOfWeek = () => {
    const currentDays = getDisplayDays();
    if (currentDays.length === 0) return;
    const updated = currentDays.map(d => ({
      ...d,
      dayOfWeek: undefined
    }));
    saveDisplayDays(updated);
  };

  const handleClearAllDays = () => {
    setConfirmConfig({
      isOpen: true,
      title: 'Clear All Routine Days?',
      message: 'Are you sure you want to remove all routine days? This will wipe the stored routine so you can create or paste your own custom workouts completely fresh.',
      confirmText: 'Clear All Days',
      variant: 'danger',
      onConfirm: () => {
        saveDisplayDays([]);
        setSelectedDayIdx(null);
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
      }
    });
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
            <div className="grid grid-cols-3 border-b border-slate-200 gap-2 pb-0.5 pt-2 w-full">
              {[
                { id: 'session', label: "Today's Session", icon: Dumbbell },
                { id: 'jog', label: 'Walk & Jog', icon: Footprints },
                { id: 'manage', label: 'Add & Edit', icon: Settings2 }
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTabMode(tab.id as any)}
                  className={`w-full flex items-center justify-center gap-1.5 px-2 sm:px-4 py-2.5 rounded-t-xl text-xs sm:text-sm font-black whitespace-nowrap transition-all cursor-pointer border-b-2 ${
                    activeTabMode === tab.id
                      ? 'border-indigo-600 text-indigo-600 font-black'
                      : 'border-transparent text-slate-400 hover:text-slate-700'
                  }`}
                >
                  <tab.icon className="w-4 h-4 shrink-0" />
                  <span className="hidden sm:inline">{tab.label}</span>
                  <span className="sm:hidden">{tab.id === 'session' ? 'Session' : tab.id === 'jog' ? 'Walk/Jog' : 'Edit'}</span>
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
                  <div className="pt-2 flex flex-wrap justify-center gap-3 w-full">
                    <button
                      type="button"
                      onClick={() => setActiveTabMode('manage')}
                      className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-xl shadow-xs transition-all flex items-center justify-center text-center gap-2 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" /> Create Routine Days
                    </button>
                  </div>
                </div>
              ) : currentPlan ? (
                <>
                  {/* 7-Day Weekly Schedule & Day Navigation Bar */}
                  <div className="space-y-4 w-full" id="weekly-schedule-section">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-200/80 pb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl">
                          <Calendar className="w-5 h-5 shrink-0" />
                        </div>
                        <div>
                          <span className="text-sm font-black text-slate-900 uppercase tracking-wider block">
                            Weekly Schedule & Routine Order
                          </span>
                          <span className="text-sm text-slate-500 font-medium">
                            Drag items to reorder your workout schedule
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-slate-600 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
                          Today is <strong className="text-indigo-600 font-black">{todayDayOfWeek}</strong>
                        </span>
                        {selectedDayIdx !== null && (
                          <button
                            type="button"
                            onClick={() => setSelectedDayIdx(null)}
                            aria-label="Reset to Today's Scheduled Day"
                            className="text-sm text-indigo-600 font-black hover:bg-indigo-100/70 flex items-center gap-1.5 cursor-pointer bg-indigo-50 px-3 py-1.5 rounded-xl border border-indigo-200 transition-colors"
                          >
                            <RotateCcw className="w-4 h-4" /> Reset to Today
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={handleSortDaysSundayToSaturday}
                          title="Reset days to standard calendar order"
                          className="text-sm text-slate-700 font-bold hover:bg-slate-200/80 flex items-center gap-1.5 cursor-pointer bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200 transition-colors"
                        >
                          <RotateCcw className="w-4 h-4 text-slate-500" /> Default Order
                        </button>
                      </div>
                    </div>

                    {reorderSuccessMsg && (
                      <div className="text-sm bg-emerald-50 text-emerald-800 px-4 py-2.5 rounded-xl border border-emerald-200 font-bold flex items-center gap-2.5 shadow-2xs">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>{reorderSuccessMsg}</span>
                      </div>
                    )}

                    {/* Collapsible Dropdown: ONLY the tiles are in the dropdown */}
                    <div className="bg-white border border-slate-200/90 rounded-2xl shadow-2xs overflow-hidden w-full transition-all" id="routine-tiles-dropdown-card">
                      <button
                        type="button"
                        onClick={() => setIsRoutineScheduleOpen((prev) => !prev)}
                        className="w-full p-3.5 sm:p-4 flex items-center justify-between text-left hover:bg-slate-50/70 transition-colors cursor-pointer"
                        id="routine-tiles-dropdown-toggle"
                        aria-expanded={isRoutineScheduleOpen}
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl shrink-0">
                            <Calendar className="w-5 h-5 text-indigo-600" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-black text-slate-900">Weekly Routine Days</span>
                              <span className="text-xs font-bold text-indigo-600 bg-indigo-50/90 border border-indigo-100/80 px-2 py-0.5 rounded-md">
                                {displayDays.length} Days
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 font-medium mt-0.5 truncate">
                              Tap to expand and reorder workout routine days
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-3">
                          <span className="text-xs font-bold text-slate-400 hidden sm:inline">
                            {isRoutineScheduleOpen ? 'Collapse' : 'Expand'}
                          </span>
                          <div className="p-1.5 rounded-lg text-slate-500 bg-slate-100 hover:bg-slate-200 transition-colors">
                            <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isRoutineScheduleOpen ? 'rotate-180' : ''}`} />
                          </div>
                        </div>
                      </button>

                      {isRoutineScheduleOpen && (
                        <div className="p-3.5 sm:p-4 pt-1 border-t border-slate-100">
                          {/* Draggable Routine Days List - all tiles match full width */}
                          <div className="flex flex-col gap-2 w-full pt-1" id="weekly-schedule-days-list" role="list">
                            {displayDays.map((d, idx) => {
                              const isSelected = idx === currentDayIndex;
                              const isRest = Boolean(d.isRestDay || d.focusArea?.toLowerCase().includes('rest'));
                              const isTodayMatch = Boolean(
                                (d.dayOfWeek && d.dayOfWeek.toLowerCase() === todayDayOfWeek.toLowerCase()) ||
                                (d.day && d.day.toLowerCase().includes(todayDayOfWeek.toLowerCase()))
                              );
                              const isDragging = draggedDaySlotIdx === idx;
                              const isDragOver = dragOverDaySlotIdx === idx;

                              return (
                                <div
                                  key={`day-list-row-${idx}`}
                                  role="button"
                                  tabIndex={0}
                                  draggable
                                  onDragStart={(e) => handleDayDragStart(e, idx)}
                                  onDragOver={(e) => handleDayDragOver(e, idx)}
                                  onDragEnd={handleDayDragEnd}
                                  onDrop={(e) => handleDayDrop(e, idx)}
                                  onClick={() => setSelectedDayIdx(idx)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                      e.preventDefault();
                                      setSelectedDayIdx(idx);
                                    }
                                  }}
                                  className={`group relative rounded-2xl border transition-all duration-150 px-3 sm:px-4 py-2.5 flex items-center justify-between gap-2.5 sm:gap-3 cursor-pointer select-none w-full min-h-[60px] ${
                                    isDragging
                                      ? 'opacity-40 scale-[0.99] border-dashed border-indigo-400 bg-indigo-50/70 shadow-inner'
                                      : isDragOver
                                      ? 'ring-2 ring-indigo-500 bg-indigo-50/80 border-indigo-400 shadow-md'
                                      : isSelected
                                      ? isRest
                                        ? 'bg-amber-50/90 border-amber-400 ring-2 ring-amber-300 shadow-xs'
                                        : 'bg-indigo-50/90 border-indigo-300 ring-2 ring-indigo-400/40 shadow-xs'
                                      : 'bg-slate-50/70 hover:bg-slate-100/80 border-slate-200 shadow-2xs'
                                  }`}
                                >
                                  {/* Left: Drag Handle */}
                                  <div
                                    className="p-1 -ml-0.5 text-slate-400 group-hover:text-slate-700 hover:bg-slate-200/70 rounded-xl cursor-grab active:cursor-grabbing transition-colors shrink-0 self-center"
                                    title="Drag to reorder this day"
                                    aria-label="Drag to reorder day"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <GripVertical className="w-5 h-5" />
                                  </div>

                                  {/* Main content: 2 rows for full data visibility without increasing height */}
                                  <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5 py-0.5">
                                    {/* Top Row: Day Pill, Today Tag, Shifted Tag & Status Badge */}
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span
                                          className={`px-2.5 py-0.5 rounded-lg font-black text-sm shrink-0 ${
                                            isRest
                                              ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                              : isSelected
                                              ? 'bg-indigo-600 text-white border border-indigo-700'
                                              : 'bg-white text-slate-800 border border-slate-200'
                                          }`}
                                        >
                                          {d.dayOfWeek || (d.day || `Day ${idx + 1}`)}
                                        </span>

                                        {isTodayMatch && (
                                          <span className="px-2 py-0.5 text-sm font-black uppercase rounded-lg bg-emerald-600 text-white shadow-2xs shrink-0">
                                            Today
                                          </span>
                                        )}

                                        {Boolean(logs?.find((l: any) => l.date === getWeekDateForDisplayIndex(idx))?.oneTimeScheduleOverride) && (
                                          <span className="text-sm font-bold uppercase px-2 py-0.5 rounded-lg bg-violet-600 text-white shadow-2xs shrink-0">
                                            Shifted
                                          </span>
                                        )}
                                      </div>

                                      {/* Right Status Badge */}
                                      <div className="flex items-center gap-1 shrink-0">
                                        {isRest ? (
                                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-amber-100 text-amber-900 font-bold text-sm border border-amber-300 shrink-0">
                                            <Coffee className="w-3.5 h-3.5 text-amber-700" /> Rest
                                          </span>
                                        ) : isSelected ? (
                                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-indigo-100 text-indigo-800 font-black text-sm border border-indigo-200 shrink-0">
                                            <Check className="w-3.5 h-3.5 text-indigo-600" /> Active
                                          </span>
                                        ) : null}
                                      </div>
                                    </div>

                                    {/* Bottom Row: Full Routine Focus & Exercise Count */}
                                    <div className="flex items-center gap-2 pt-0.5 flex-wrap">
                                      <span className={`text-sm font-black tracking-tight ${isRest ? 'text-amber-800/90 italic' : 'text-slate-800'}`}>
                                        {isRest ? 'Rest & Recovery' : (d.focusArea || 'Workout')}
                                      </span>
                                      {d.exercises && d.exercises.length > 0 && (
                                        <span className="text-sm font-semibold text-slate-400">
                                          • {d.exercises.length} {d.exercises.length === 1 ? 'exercise' : 'exercises'}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Consistency Streak Hero Box */}
                  <div
                    className="w-full bg-linear-to-r from-indigo-500 to-violet-600 rounded-3xl p-6 sm:p-8 text-white shadow-lg shadow-indigo-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 min-h-[140px]"
                    id="workout-streak-box"
                  >
                    <div className="space-y-2">
                      <span className="text-[10px] font-black uppercase tracking-widest bg-white/20 text-white px-3 py-1 rounded-full border border-white/10 inline-block">
                        Consistency Calendar Streak
                      </span>
                      <h3 className="text-3xl font-black tracking-tight">Day {streak} Active</h3>
                      <p className="text-indigo-100 text-sm font-semibold">
                        Today's Focus: <span className="text-white font-black">{currentPlan.focus}</span> &bull; {currentPlan.title}
                      </p>
                    </div>

                    <div className="shrink-0 bg-white/10 border border-white/15 px-4.5 py-3 rounded-2xl">
                      <span className="text-xs font-black text-indigo-100 uppercase tracking-widest block mb-1">
                        Routine Schedule
                      </span>
                      <span className="font-mono text-xs font-black text-white bg-slate-950/30 px-3.5 py-1.5 rounded-xl inline-block">
                        {displayDays.length}-Day Plan &bull; Day {currentPlan.day}
                      </span>
                    </div>
                  </div>

                  {/* Main Day Content: Rest Day OR Workout Lifts Card */}
                  {showRestDayView ? (
                    /* --- REST & RECOVERY DAY VIEW --- */
                    <div className="bg-gradient-to-br from-amber-50 via-orange-50/40 to-indigo-50/30 border border-amber-200 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xs">
                      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-black uppercase tracking-widest bg-amber-500 text-white px-3 py-1 rounded-full shadow-xs flex items-center gap-1.5">
                              <Coffee className="w-4 h-4" /> Rest Day
                            </span>
                            {currentPlan.dayOfWeek && (
                              <span className="text-sm font-extrabold text-amber-900 bg-amber-100 border border-amber-250 px-3 py-0.5 rounded-lg">
                                {currentPlan.dayOfWeek}
                              </span>
                            )}
                          </div>
                          <h3 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                            {currentPlan.title} — Rest & Muscle Repair
                          </h3>
                          <p className="text-slate-600 text-sm font-medium max-w-xl leading-relaxed">
                            Hypertrophy and recovery occur during rest days. Taking today as scheduled allows your central nervous system to reset, muscle glycogen to replenish, and protein synthesis to rebuild lean tissue. No workouts or cardio should be logged today.
                          </p>
                        </div>

                        {/* Informative Rest Day Status Indicator (Non-clickable Badge) */}
                        <div className="flex flex-col items-start md:items-end gap-2 w-full md:w-auto shrink-0">
                          <div
                            className="flex items-center gap-2.5 px-4 py-2.5 bg-amber-100/90 text-amber-950 border border-amber-300 rounded-2xl font-black text-sm select-none shadow-2xs"
                            id="rest-day-status-badge"
                          >
                            <Coffee className="w-4 h-4 text-amber-700 shrink-0" />
                            <span className="whitespace-nowrap">Scheduled Rest Day</span>
                          </div>
                          <span className="text-xs font-bold text-amber-800/90">
                            Cardio & Lift Logging Disabled for Recovery
                          </span>
                        </div>
                      </div>

                      {/* Rest Day Recovery Targets */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                        <div className="bg-white/90 border border-amber-200/90 rounded-2xl p-4.5 space-y-1.5 shadow-xs">
                          <div className="flex items-center gap-2 text-amber-800 font-bold text-sm">
                            <Activity className="w-4 h-4 text-amber-600" />
                            <span>Hydration Target</span>
                          </div>
                          <p className="text-sm font-extrabold text-slate-800">3.5 - 4.0 Liters Water</p>
                          <p className="text-xs text-slate-500 font-medium leading-normal">Flushes metabolic waste products and aids nutrient transport into muscle tissue.</p>
                        </div>

                        <div className="bg-white/90 border border-amber-200/90 rounded-2xl p-4.5 space-y-1.5 shadow-xs">
                          <div className="flex items-center gap-2 text-amber-800 font-bold text-sm">
                            <Moon className="w-4 h-4 text-indigo-600" />
                            <span>Sleep & Growth Hormone</span>
                          </div>
                          <p className="text-sm font-extrabold text-slate-800">8+ Hours Quality Sleep</p>
                          <p className="text-xs text-slate-500 font-medium leading-normal">Natural Growth Hormone spikes during deep slow-wave sleep cycles.</p>
                        </div>

                        <div className="bg-white/90 border border-amber-200/90 rounded-2xl p-4.5 space-y-1.5 shadow-xs">
                          <div className="flex items-center gap-2 text-amber-800 font-bold text-sm">
                            <Sun className="w-4 h-4 text-amber-500" />
                            <span>Mobility & Recovery</span>
                          </div>
                          <p className="text-sm font-extrabold text-slate-800">Light Mobility & Stretching</p>
                          <p className="text-xs text-slate-500 font-medium leading-normal">Promotes soft tissue blood flow and gentle joint mobility.</p>
                        </div>
                      </div>

                      {/* Next Workout in Sequence Preview */}
                      {nextNonRestDayObj && (
                        <div className="border-t border-amber-200/80 pt-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                          <div>
                            <span className="text-xs font-black uppercase text-amber-800 tracking-wider block">
                              Next Scheduled Workout Session Up in Order
                            </span>
                            <p className="text-sm font-bold text-slate-800">
                              {nextNonRestDayObj.day} ({nextNonRestDayObj.focusArea}) — {nextNonRestDayObj.exercises?.length || 0} exercises
                            </p>
                          </div>
                          <div className="w-full sm:w-auto">
                            <button
                              type="button"
                              onClick={() => setSelectedDayIdx(nextNonRestDayIdx)}
                              className="w-full px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center text-center gap-1.5 cursor-pointer shadow-xs"
                            >
                              <span>Preview Next Workout</span>
                              <ChevronRight className="w-4 h-4 text-slate-500" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* --- WORKOUT DAY VIEW (Standard Lifting Card) --- */
                    <div className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-6 sm:p-8 space-y-6">
                      {currentPlan?.isOneTimeShift && (
                        <div className="bg-indigo-50/90 border border-indigo-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-indigo-900 font-bold text-xs shadow-2xs">
                          <div className="flex items-center gap-2.5">
                            <Sparkles className="w-4 h-4 text-indigo-600 shrink-0 animate-pulse" />
                            <span>{currentPlan.overrideLabel}</span>
                          </div>
                          <div className="w-full sm:w-auto">
                            <button
                              type="button"
                              onClick={handleUndoShift}
                              className="w-full px-3.5 py-2 bg-white hover:bg-indigo-100 border border-indigo-300 text-indigo-700 rounded-xl font-black text-xs cursor-pointer shadow-2xs transition-all active:scale-95 flex items-center justify-center text-center"
                            >
                              Revert Schedule
                            </button>
                          </div>
                        </div>
                      )}
                      <div className="flex flex-col gap-4 w-full">
                        <div>
                          <span className="text-xs uppercase font-black px-3 py-1 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-150">
                            {hasLiftingWorkoutsLogged && isPreviousDay
                              ? `LOGGED LIFTS (${formatDateDDMMYYYY(selectedDateStr)})`
                              : `${currentPlan.category} TARGETS`}
                          </span>
                          <h3 className="text-lg font-black text-slate-800 mt-2">
                            {isPreviousDay
                              ? hasLiftingWorkoutsLogged
                                ? `Completed Workout for ${formatDateDDMMYYYY(selectedDateStr)}`
                                : `Scheduled Routine (${currentPlan.title}) — ${formatDateDDMMYYYY(selectedDateStr)}`
                              : `Today's Workout (${currentPlan.title})`}
                          </h3>
                        </div>

                        {isPreviousDay ? (
                          hasLiftingWorkoutsLogged ? (
                            <div className="w-full flex items-center justify-center text-center gap-2 px-5 py-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl font-black text-xs">
                              <CheckCircle2 className="w-5 h-5 text-emerald-600 animate-pulse" />
                              <span>{loggedLiftingWorkouts.length} Lifts Logged</span>
                            </div>
                          ) : (
                            <div className="w-full px-4 py-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs font-bold flex items-center justify-center text-center gap-2">
                              <Info className="w-4 h-4 text-amber-600 shrink-0" />
                              <span>Past Date — Use '+ Add Lift' to log past exercises.</span>
                            </div>
                          )
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                            {/* Workout Session Button: Enabled or Disabled if already completed */}
                            {isLiftingCompletedToday ? (
                              <button
                                type="button"
                                disabled
                                className="w-full flex items-center justify-center text-center gap-2 px-5 py-3.5 bg-slate-100 border border-slate-200 text-slate-500 font-bold text-xs sm:text-sm rounded-2xl cursor-not-allowed opacity-80"
                                id="workout-completed-disabled-btn"
                                title="Today's workout session is already logged (1 workout per day)"
                              >
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                <span className="truncate">Workout Logged ({loggedLiftingWorkouts.length} exercises)</span>
                              </button>
                            ) : currentPlan.exercises.length > 0 ? (
                              <button
                                type="button"
                                onClick={handleStartWorkout}
                                className="w-full flex items-center justify-center text-center gap-2 px-5 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs sm:text-sm rounded-2xl transition-all shadow-md hover:shadow-lg shadow-indigo-150 cursor-pointer active:scale-95"
                                id="start-workout-btn"
                              >
                                <PlayCircle className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                                <span className="truncate">Start Workout</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setActiveTabMode('manage')}
                                className="w-full flex items-center justify-center text-center gap-2 px-5 py-3.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs sm:text-sm rounded-2xl transition-all cursor-pointer"
                              >
                                <Plus className="w-4 h-4 shrink-0" />
                                <span className="truncate">Add Exercises</span>
                              </button>
                            )}

                            {/* Jog Session Button: Enabled or navigate to tracker */}
                            {hasJogsLogged ? (
                              <button
                                type="button"
                                onClick={() => setActiveTabMode('jog')}
                                className="w-full flex items-center justify-center text-center gap-2 px-5 py-3.5 bg-emerald-50 border border-emerald-300 text-emerald-800 font-bold text-sm rounded-2xl hover:bg-emerald-100 transition-all cursor-pointer shadow-xs"
                                id="jog-completed-open-btn"
                                title="View or manage today's walk and jog sessions"
                              >
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                <span className="truncate">Cardio Completed &bull; Open Tracker</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setActiveTabMode('jog')}
                                className="w-full flex items-center justify-center text-center gap-2 px-5 py-3.5 font-black text-sm rounded-2xl transition-all shadow-md bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200 hover:shadow-lg cursor-pointer active:scale-95"
                                id="start-jog-btn"
                                title="Start an outdoor jog or fast walk with live GPS mapping and calorie calculation"
                              >
                                <Footprints className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                                <span className="truncate">Start Walk or Jog</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Jogs / Walks logged for the day */}
                      {hasJogsLogged && (
                        <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4 sm:p-5 space-y-3 shadow-xs">
                          <div className="flex flex-wrap justify-between items-center gap-2">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                                <Footprints className="w-4 h-4" />
                              </div>
                              <div>
                                <h4 className="text-sm font-black text-emerald-950">
                                  Cardio Session Logged
                                </h4>
                                <p className="text-xs font-semibold text-emerald-700">
                                  Tracked separately from your lifting routine.
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                            {currentDateJogs.length > 0 ? (
                              currentDateJogs.map((jog, jIdx) => (
                                <div key={jog.id || jIdx} className="bg-white border border-emerald-200/80 rounded-xl p-3.5 flex items-center justify-between shadow-xs">
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm font-black text-slate-800 font-mono">
                                        {jog.distanceKm.toFixed(2)} km
                                      </span>
                                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                                        {jog.activityType === 'fast_walk' ? 'Fast Walk' : 'Outdoor Jog'}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-slate-500 font-semibold mt-1">
                                      <span className="font-mono">{formatDuration(jog.durationSeconds)}</span>
                                      <span>&bull;</span>
                                      <span className="text-amber-700 font-bold">{jog.caloriesBurned} kcal</span>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => setActiveTabMode('jog')}
                                      className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                                      title="Open in Tracker"
                                    >
                                      <Pencil className="w-4 h-4" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteJogSession(jog.id)}
                                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                      title="Delete this cardio entry"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>
                              ))
                            ) : (
                              loggedJogWorkouts.map((w: any, jIdx: number) => (
                                <div key={w.id || jIdx} className="bg-white border border-emerald-200/80 rounded-xl p-3 flex items-center justify-between shadow-xs">
                                  <div>
                                    <h5 className="text-sm font-bold text-slate-800">{w.name}</h5>
                                    <span className="text-xs text-emerald-700 font-semibold">Cardio session logged</span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteJogSession(w.id.replace('jog-', ''))}
                                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                    title="Delete this jog entry"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      )}

                      <div className="border-t border-slate-200/60 pt-6 space-y-4">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-black text-slate-400 uppercase tracking-wider block">
                            {hasLiftingWorkoutsLogged ? `Logged Lifts for ${formatDateDDMMYYYY(selectedDateStr)}:` : 'Exercises for this routine:'}
                          </span>
                          <button
                            type="button"
                            onClick={() => setActiveTabMode('manage')}
                            className="text-xs text-indigo-600 font-extrabold hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" /> Edit Routine
                          </button>
                        </div>

                        {hasLiftingWorkoutsLogged ? (
                          <div className="space-y-3">
                            {loggedLiftingWorkouts.map((w: any, idx: number) => {
                              const matchUrl = findMatchingYoutubeUrl(w.name);
                              return (
                                <div key={w.id || idx} className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 shadow-xs">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                      <span className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-700 font-mono font-black text-xs flex items-center justify-center">
                                        {idx + 1}
                                      </span>
                                      <div>
                                        <h4 className="text-sm font-bold text-slate-800">{w.name}</h4>
                                        <span className="text-[10px] font-black uppercase text-indigo-600 bg-indigo-50/70 px-2 py-0.5 rounded border border-indigo-100 mt-0.5 inline-block">
                                          {w.category || 'Exercise'}
                                        </span>
                                      </div>
                                    </div>
                                    {matchUrl && (
                                      <a
                                        href={matchUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-[10px] font-extrabold flex items-center gap-1 transition-colors"
                                      >
                                        <PlayCircle className="w-3.5 h-3.5 text-red-600" />
                                        Video
                                      </a>
                                    )}
                                  </div>

                                  {w.sets && w.sets.length > 0 && (
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-100">
                                      {w.sets.map((s: any, sIdx: number) => (
                                        <div key={s.id || sIdx} className="bg-slate-50 border border-slate-150 p-2 rounded-xl text-center">
                                          <span className="text-[9px] font-mono font-bold text-slate-400 uppercase block">Set {sIdx + 1}</span>
                                          <span className="text-xs font-black font-mono text-slate-800">
                                            {s.weight > 0 ? `${s.weight} ${weightUnit}` : 'BW'} × {s.reps} reps
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : currentPlan.rawExercises.length > 0 ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {currentPlan.rawExercises.map((rawEx, idx) => {
                              const dbEntry = EXERCISES_DATABASE[matchExerciseKey(rawEx.name)];
                              const matchUrl = rawEx.youtubeUrl || findMatchingYoutubeUrl(rawEx.name);
                              const isFirst = idx === 0;
                              const isLast = idx === currentPlan.rawExercises.length - 1;

                              return (
                                <div
                                  key={idx}
                                  draggable
                                  onDragStart={(e) => handleDragStart(e, currentDayIndex, idx)}
                                  onDragOver={(e) => handleDragOver(e, currentDayIndex, idx)}
                                  onDrop={(e) => handleDrop(e, currentDayIndex, idx)}
                                  onDragEnd={handleDragEnd}
                                  className={`bg-white border rounded-xl p-4 flex items-start justify-between gap-3 shadow-xs transition-all ${
                                    draggedDayIdx === currentDayIndex && draggedExIdx === idx
                                      ? 'opacity-40 border-indigo-400 border-dashed'
                                      : dragOverDayIdx === currentDayIndex && dragOverExIdx === idx
                                      ? 'border-indigo-600 border-2 bg-indigo-50/40'
                                      : 'border-slate-200 hover:border-indigo-300'
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    {/* Reorder Buttons & Drag Handle */}
                                    <div className="flex items-center gap-0.5 shrink-0">
                                      <div
                                        className="p-1 text-slate-400 hover:text-slate-700 cursor-grab active:cursor-grabbing rounded hover:bg-slate-100 transition-colors"
                                        title="Drag to reorder exercise"
                                      >
                                        <GripVertical className="w-4 h-4" />
                                      </div>
                                      <div className="flex flex-col">
                                        <button
                                          type="button"
                                          onClick={() => handleMoveExercise(currentDayIndex, idx, 'up')}
                                          disabled={isFirst}
                                          className="p-0.5 text-slate-400 hover:text-indigo-600 disabled:opacity-20 disabled:hover:text-slate-400 cursor-pointer disabled:cursor-not-allowed transition-colors"
                                          title="Move Up"
                                        >
                                          <ChevronUp className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleMoveExercise(currentDayIndex, idx, 'down')}
                                          disabled={isLast}
                                          className="p-0.5 text-slate-400 hover:text-indigo-600 disabled:opacity-20 disabled:hover:text-slate-400 cursor-pointer disabled:cursor-not-allowed transition-colors"
                                          title="Move Down"
                                        >
                                          <ChevronDown className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </div>

                                    <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 font-mono font-black text-sm flex items-center justify-center shrink-0">
                                      {idx + 1}
                                    </div>
                                    <div className="min-w-0">
                                      <h4 className="text-sm font-bold text-slate-800 truncate">{rawEx.name}</h4>
                                      <span className="text-xs text-indigo-600 font-extrabold block mt-0.5">
                                        {rawEx.sets || dbEntry?.volume || 3} sets × {rawEx.reps || 10} reps
                                      </span>
                                    </div>
                                  </div>

                                  {matchUrl && (
                                    <a
                                      href={matchUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-xs font-extrabold flex items-center gap-1 shrink-0 transition-colors"
                                      title="Watch Video"
                                    >
                                      <PlayCircle className="w-4 h-4 text-red-600" />
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
                  )}

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
          ) : activeTabMode === 'jog' ? (
            // --- SUB-TAB B: OUTDOOR JOG (GPS MAP & CALORIE TRACKER) ---
            <div id="outdoor-jog-panel" className="space-y-6">
              <JogTracker
                selectedDate={selectedDateStr}
                goals={goals || { currentWeight: 75, weightUnit: weightUnit === 'lbs' ? 'lbs' : 'kg', targetWeight: 75, dailyCalorieTarget: 2500, dailyProteinTarget: 160, weeklyWorkoutDaysTarget: 5 }}
                isRestDay={isRestDayToday}
                onBack={() => setActiveTabMode('session')}
                onSaveJog={handleSaveJogSession}
                onUpdateJog={handleUpdateJogSession}
                existingJogs={currentDateJogs}
                onDeleteJog={handleDeleteJogSession}
              />
            </div>
          ) : (
            // --- SUB-TAB C: MANAGE ROUTINES & DAYS ---
            <div className="space-y-6" id="routine-manager-panel">
              <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-indigo-50/70 border border-indigo-100 p-5 rounded-2xl shadow-xs">
                <div>
                  <h3 className="text-base font-extrabold text-indigo-950 flex items-center gap-2">
                    <ListPlus className="w-5 h-5 text-indigo-600" />
                    Custom Workout Routines & Weekly Schedule Manager
                  </h3>
                  <p className="text-xs text-indigo-800 mt-1">
                    Manage your 7-day weekly schedule, exercises, rest days, and assigned weekdays.
                  </p>
                </div>
              </div>

              {/* List of Days */}
              <div className="space-y-6">
                {displayDays.length === 0 && (
                  <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-slate-500 space-y-2">
                    <p className="text-xs font-bold text-slate-700">No Routine Days Added Yet</p>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                      Use the "+ Add New Day" button above to create your custom routine days, or paste your plan into the AI Workout Routine Builder above.
                    </p>
                  </div>
                )}
                {displayDays.map((dayObj, dayIdx) => {
                  const isEditingHeader = editingDayHeaderIdx === dayIdx;
                  const isAddingEx = addingExToDayIdx === dayIdx;

                  return (
                    <div
                      key={`day-${dayIdx}`}
                      draggable
                      onDragStart={(e) => handleDayDragStart(e, dayIdx)}
                      onDragOver={(e) => handleDayDragOver(e, dayIdx)}
                      onDragEnd={handleDayDragEnd}
                      onDrop={(e) => handleDayDrop(e, dayIdx)}
                      className={`bg-slate-50 border rounded-2xl p-5 sm:p-6 space-y-4 shadow-xs transition-all ${
                        draggedDaySlotIdx === dayIdx
                          ? 'opacity-40 border-dashed border-indigo-400 bg-indigo-50/60'
                          : dragOverDaySlotIdx === dayIdx
                          ? 'ring-2 ring-indigo-500 border-indigo-400 bg-indigo-50/80'
                          : 'border-slate-200/90'
                      }`}
                    >
                      {/* Day Header */}
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-200 pb-3">
                        {isEditingHeader ? (
                          <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
                            <input
                              type="text"
                              value={editDayTitle}
                              onChange={e => setEditDayTitle(e.target.value)}
                              placeholder="Day Title"
                              className="px-3 py-1.5 bg-white border border-indigo-300 rounded-xl text-sm font-bold text-slate-900"
                            />
                            <input
                              type="text"
                              value={editDayFocus}
                              onChange={e => setEditDayFocus(e.target.value)}
                              placeholder="Focus Area"
                              className="px-3 py-1.5 bg-white border border-indigo-300 rounded-xl text-sm font-bold text-slate-900"
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveDayHeader(dayIdx)}
                              className="px-3.5 py-1.5 bg-indigo-600 text-white rounded-xl text-sm font-bold cursor-pointer flex items-center justify-center text-center"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingDayHeaderIdx(null)}
                              className="px-3.5 py-1.5 bg-slate-200 text-slate-700 rounded-xl text-sm font-bold cursor-pointer flex items-center justify-center text-center"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2.5 flex-wrap">
                            {/* Grip Drag Handle */}
                            <div
                              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg cursor-grab active:cursor-grabbing transition-colors shrink-0"
                              title="Drag to reorder day"
                              aria-label="Drag to reorder day"
                            >
                              <GripVertical className="w-5 h-5" />
                            </div>

                            <span className={`px-3 py-1 font-extrabold text-sm rounded-xl shadow-xs flex items-center gap-1.5 ${
                              dayObj.isRestDay ? 'bg-amber-500 text-white' : 'bg-indigo-600 text-white'
                            }`}>
                              {dayObj.isRestDay && <Coffee className="w-3.5 h-3.5" />}
                              {dayObj.day || `Day ${dayIdx + 1}`}
                            </span>
                            <div>
                              <h4 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                                <span>{dayObj.focusArea || 'Full Body'}</span>
                                {dayObj.isRestDay && (
                                  <span className="px-2.5 py-0.5 bg-amber-100 text-amber-800 text-sm font-black rounded-lg border border-amber-200">
                                    REST DAY 🧘
                                  </span>
                                )}
                              </h4>
                              {dayObj.dayOfWeek && (
                                <span className="text-sm text-slate-500 font-medium block">
                                  Scheduled for {dayObj.dayOfWeek}
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        {!isEditingHeader && (
                          <div className="flex items-center gap-2 flex-wrap self-end sm:self-center">
                            {/* Rest Day Toggle Button */}
                            <button
                              type="button"
                              onClick={() => handleToggleRestDay(dayIdx)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-extrabold transition-all flex items-center justify-center text-center gap-1 cursor-pointer border ${
                                dayObj.isRestDay
                                  ? 'bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200'
                                  : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                              }`}
                            >
                              <Coffee className="w-3.5 h-3.5 text-amber-600" />
                              <span>{dayObj.isRestDay ? 'Rest' : 'Mark Rest'}</span>
                            </button>

                            {/* Day of Week Dropdown */}
                            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-2 py-0.5 text-xs font-bold text-slate-700">
                              <Calendar className="w-3 h-3 text-slate-400" />
                              <select
                                value={dayObj.dayOfWeek || 'Unassigned'}
                                onChange={e => handleChangeDayOfWeek(dayIdx, e.target.value)}
                                className="bg-transparent font-bold text-slate-800 focus:outline-none cursor-pointer py-0.5"
                              >
                                <option value="Unassigned">Day: None</option>
                                {DAYS_OF_WEEK.map(dow => (
                                  <option key={dow} value={dow}>{dow}</option>
                                ))}
                              </select>
                            </div>

                            {/* Rename / Edit Header */}
                            <button
                              type="button"
                              onClick={() => {
                                setEditingDayHeaderIdx(dayIdx);
                                setEditDayTitle(dayObj.day || `Day ${dayIdx + 1}`);
                                setEditDayFocus(dayObj.focusArea || 'Full Body');
                              }}
                              className="px-2.5 py-1 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 rounded-lg text-[11px] font-bold transition-colors flex items-center justify-center text-center gap-1 cursor-pointer"
                            >
                              <Edit3 className="w-3 h-3 text-slate-500" />
                              Rename
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
                            const isBodyweight = ex.isBodyweight !== undefined
                              ? ex.isBodyweight
                              : (ex.name.toLowerCase().includes('bodyweight') ||
                                 ex.name.toLowerCase().includes('stretching') ||
                                 ex.name.toLowerCase().includes('crunch') ||
                                 ex.name.toLowerCase().includes('leg raise') ||
                                 ex.name.toLowerCase().includes('pushup') ||
                                 ex.name.toLowerCase().includes('pullup'));

                            return (
                              <div
                                key={`ex-item-${exKey}`}
                                draggable={!isEditing}
                                onDragStart={(e) => handleDragStart(e, dayIdx, exIdx)}
                                onDragOver={(e) => handleDragOver(e, dayIdx, exIdx)}
                                onDrop={(e) => handleDrop(e, dayIdx, exIdx)}
                                onDragEnd={handleDragEnd}
                                className={`bg-white p-3.5 rounded-xl border space-y-2 transition-all relative group ${
                                  draggedDayIdx === dayIdx && draggedExIdx === exIdx
                                    ? 'opacity-40 border-indigo-400 border-dashed scale-98'
                                    : dragOverDayIdx === dayIdx && dragOverExIdx === exIdx
                                    ? 'border-indigo-600 border-2 bg-indigo-50/40'
                                    : 'border-slate-200/90 hover:border-indigo-300'
                                }`}
                              >
                                {isEditing ? (
                                  <div className="space-y-3 bg-slate-50/80 p-3 rounded-xl border border-indigo-200">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                      <div>
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Exercise Name</label>
                                        <input
                                          type="text"
                                          value={editExNameInput}
                                          onChange={e => setEditExNameInput(e.target.value)}
                                          onFocus={e => e.target.select()}
                                          placeholder="Exercise Name"
                                          className="w-full px-3 py-1.5 bg-white border border-indigo-300 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">YouTube Demonstration URL</label>
                                        <input
                                          type="text"
                                          value={editExUrlInput}
                                          onChange={e => setEditExUrlInput(e.target.value)}
                                          onFocus={e => e.target.select()}
                                          placeholder="YouTube Demonstration URL"
                                          className="w-full px-3 py-1.5 bg-white border border-indigo-300 rounded-lg text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        />
                                      </div>
                                    </div>

                                    <div className={`grid grid-cols-1 ${!editExIsBodyweightInput ? 'sm:grid-cols-4' : 'sm:grid-cols-3'} gap-2 pt-1 border-t border-slate-200`}>
                                      <div>
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Workout Type</label>
                                        <div className="flex bg-slate-200/80 p-0.5 rounded-lg">
                                          <button
                                            type="button"
                                            onClick={() => setEditExIsBodyweightInput(false)}
                                            className={`flex-1 py-1 text-[11px] font-extrabold rounded-md transition-all cursor-pointer ${
                                              !editExIsBodyweightInput ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                                            }`}
                                          >
                                            Weight
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => setEditExIsBodyweightInput(true)}
                                            className={`flex-1 py-1 text-[11px] font-extrabold rounded-md transition-all cursor-pointer ${
                                              editExIsBodyweightInput ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                                            }`}
                                          >
                                            Bodyweight
                                          </button>
                                        </div>
                                      </div>

                                      <div className="sm:col-span-2">
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Target Muscle Group(s) — Select all that apply</label>
                                        <div className="flex flex-wrap gap-1">
                                          {MUSCLE_GROUP_OPTIONS.map(m => {
                                            const isSelected = editExCategoriesInput.includes(m);
                                            return (
                                              <button
                                                key={`edit-m-${m}`}
                                                type="button"
                                                onClick={() => {
                                                  if (isSelected) {
                                                    if (editExCategoriesInput.length > 1) {
                                                      setEditExCategoriesInput(editExCategoriesInput.filter(x => x !== m));
                                                    }
                                                  } else {
                                                    setEditExCategoriesInput([...editExCategoriesInput, m]);
                                                  }
                                                }}
                                                className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                                                  isSelected
                                                    ? 'bg-indigo-600 text-white shadow-sm'
                                                    : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                                                }`}
                                              >
                                                {m}
                                              </button>
                                            );
                                          })}
                                        </div>
                                      </div>

                                      <div>
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Target Sets</label>
                                        <input
                                          type="number"
                                          min={1}
                                          max={20}
                                          value={editExSetsInput}
                                          onChange={e => {
                                            const v = e.target.value;
                                            setEditExSetsInput(v === '' ? '' : Math.max(1, parseInt(v, 10) || 1));
                                          }}
                                          onBlur={() => {
                                            if (editExSetsInput === '' || Number(editExSetsInput) < 1) setEditExSetsInput(1);
                                          }}
                                          onFocus={e => e.target.select()}
                                          className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        />
                                      </div>

                                      <div>
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Target Reps / Set</label>
                                        <input
                                          type="number"
                                          min={1}
                                          max={200}
                                          value={editExRepsInput}
                                          onChange={e => {
                                            const v = e.target.value;
                                            setEditExRepsInput(v === '' ? '' : Math.max(1, parseInt(v, 10) || 1));
                                          }}
                                          onBlur={() => {
                                            if (editExRepsInput === '' || Number(editExRepsInput) < 1) setEditExRepsInput(1);
                                          }}
                                          onFocus={e => e.target.select()}
                                          className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        />
                                      </div>

                                      {!editExIsBodyweightInput && (
                                        <div>
                                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Target Weight (lbs)</label>
                                          <input
                                            type="number"
                                            min={0}
                                            max={1000}
                                            value={editExWeightInput}
                                            onChange={e => {
                                              const v = e.target.value;
                                              setEditExWeightInput(v === '' ? '' : Math.max(0, parseFloat(v) || 0));
                                            }}
                                            onBlur={() => {
                                              if (editExWeightInput === '' || Number(editExWeightInput) < 0) setEditExWeightInput(0);
                                            }}
                                            onFocus={e => e.target.select()}
                                            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                          />
                                        </div>
                                      )}
                                    </div>

                                    <div className="flex flex-col sm:flex-row justify-end gap-2 pt-1 w-full">
                                      <button
                                        type="button"
                                        onClick={() => handleSaveExerciseEdit(dayIdx, exIdx)}
                                        className="w-full sm:w-auto px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg shadow-sm transition-colors cursor-pointer flex items-center justify-center text-center"
                                      >
                                        Save Changes
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setEditingExKey(null)}
                                        className="w-full sm:w-auto px-3 py-1.5 bg-white border border-slate-200 text-slate-600 font-bold text-xs rounded-lg cursor-pointer flex items-center justify-center text-center"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex justify-between items-center gap-2">
                                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                                      {/* Drag Handle & Move Up/Down Controls */}
                                      <div className="flex items-center gap-0.5 shrink-0">
                                        <div
                                          className="p-1 text-slate-400 hover:text-slate-700 cursor-grab active:cursor-grabbing rounded hover:bg-slate-100 transition-colors"
                                          title="Drag to reorder"
                                        >
                                          <GripVertical className="w-4 h-4" />
                                        </div>
                                        <div className="flex flex-col">
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleMoveExercise(dayIdx, exIdx, 'up');
                                            }}
                                            disabled={exIdx === 0}
                                            className="p-0.5 text-slate-400 hover:text-indigo-600 disabled:opacity-20 disabled:hover:text-slate-400 cursor-pointer disabled:cursor-not-allowed transition-colors"
                                            title="Move Up"
                                          >
                                            <ChevronUp className="w-3.5 h-3.5" />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleMoveExercise(dayIdx, exIdx, 'down');
                                            }}
                                            disabled={!dayObj.exercises || exIdx === dayObj.exercises.length - 1}
                                            className="p-0.5 text-slate-400 hover:text-indigo-600 disabled:opacity-20 disabled:hover:text-slate-400 cursor-pointer disabled:cursor-not-allowed transition-colors"
                                            title="Move Down"
                                          >
                                            <ChevronDown className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      </div>

                                      <div className="space-y-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <span className="w-6 h-6 rounded-md bg-indigo-50 text-indigo-700 font-mono font-black text-xs flex items-center justify-center shrink-0">
                                            {exIdx + 1}
                                          </span>
                                          <h5 className="text-xs font-extrabold text-slate-900">{ex.name}</h5>
                                          {inferMuscleGroups(ex.name, dayObj.focusArea, ex.category).map((catTag) => (
                                            <span key={`ex-tag-${exKey}-${catTag}`} className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full text-[10px] font-extrabold uppercase border border-indigo-200">
                                              {catTag}
                                            </span>
                                          ))}
                                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                                            isBodyweight ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-slate-100 text-slate-700 border border-slate-200'
                                          }`}>
                                            {isBodyweight ? 'Bodyweight' : 'Weight Workout'}
                                          </span>
                                          <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-full text-[10px] font-bold border border-slate-200">
                                            {ex.sets || 3} Sets × {ex.reps || 10} Reps
                                          </span>
                                          {!isBodyweight && (
                                            <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full text-[10px] font-bold border border-indigo-200/80">
                                              {ex.weight !== undefined ? ex.weight : 30} lbs
                                            </span>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono">
                                          <Link2 className="w-3 h-3 text-indigo-500 shrink-0" />
                                          <span className="truncate max-w-[280px]">
                                            {ex.youtubeUrl || <em className="text-slate-400">No YouTube URL linked</em>}
                                          </span>
                                        </div>
                                      </div>
                                    </div>

                                    {/* 3-Dots Context Menu */}
                                    <div className={`relative shrink-0 ex-menu-container-${exKey.replace(/[^a-zA-Z0-9-]/g, '_')}`}>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                                                                    setActiveMenuKey(activeMenuKey === exKey ? null : exKey);
                                        }}
                                        className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                                        title="Exercise Options"
                                      >
                                        <MoreVertical className="w-4 h-4" />
                                      </button>

                                      {activeMenuKey === exKey && (
                                        <div className="absolute right-0 top-8 z-30 bg-white border border-slate-200 shadow-xl rounded-2xl p-1.5 w-48 text-xs font-bold space-y-0.5 animate-fadeIn">
                                          {ex.youtubeUrl && (
                                            <a
                                              href={ex.youtubeUrl}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              onClick={() => setActiveMenuKey(null)}
                                              className="w-full flex items-center gap-2.5 px-3 py-2 text-indigo-700 hover:bg-indigo-50 rounded-xl transition-colors"
                                            >
                                              <ExternalLink className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                                              <span>Open YouTube Demo</span>
                                            </a>
                                          )}
                                          {exIdx > 0 && (
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setActiveMenuKey(null);
                                                handleMoveExercise(dayIdx, exIdx, 'up');
                                              }}
                                              className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-700 hover:bg-slate-100 rounded-xl transition-colors text-left cursor-pointer"
                                            >
                                              <ChevronUp className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                              <span>Move Up</span>
                                            </button>
                                          )}
                                          {dayObj.exercises && exIdx < dayObj.exercises.length - 1 && (
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setActiveMenuKey(null);
                                                handleMoveExercise(dayIdx, exIdx, 'down');
                                              }}
                                              className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-700 hover:bg-slate-100 rounded-xl transition-colors text-left cursor-pointer"
                                            >
                                              <ChevronDown className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                              <span>Move Down</span>
                                            </button>
                                          )}
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setActiveMenuKey(null);
                                              setDuplicateModalEx({ exercise: ex, sourceDayIdx: dayIdx });
                                            }}
                                            className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-700 hover:bg-slate-100 rounded-xl transition-colors text-left cursor-pointer"
                                          >
                                            <Copy className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                            <span>Duplicate to Day</span>
                                          </button>
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setActiveMenuKey(null);
                                              setEditingExKey(exKey);
                                              setEditExNameInput(ex.name);
                                              setEditExCategoriesInput(inferMuscleGroups(ex.name, dayObj.focusArea, ex.category));
                                              setEditExUrlInput(ex.youtubeUrl || '');
                                              setEditExIsBodyweightInput(isBodyweight);
                                              setEditExSetsInput(ex.sets || 3);
                                              setEditExRepsInput(ex.reps || 10);
                                              setEditExWeightInput(ex.weight !== undefined ? ex.weight : 30);
                                            }}
                                            className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-700 hover:bg-slate-100 rounded-xl transition-colors text-left cursor-pointer"
                                          >
                                            <Edit3 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                            <span>Edit Exercise</span>
                                          </button>
                                          <div className="border-t border-slate-100 my-1" />
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setActiveMenuKey(null);
                                              handleRemoveExercise(dayIdx, exIdx);
                                            }}
                                            className="w-full flex items-center gap-2.5 px-3 py-2 text-rose-600 hover:bg-rose-50 rounded-xl transition-colors text-left cursor-pointer"
                                          >
                                            <Trash2 className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                                            <span>Delete Exercise</span>
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })
                        ) : (
                          <div className="p-3 bg-white border border-dashed border-slate-200 rounded-xl text-xs text-slate-400 text-center font-medium">
                            {dayObj.isRestDay ? 'Scheduled Rest Day' : 'No exercises added to this day yet. Add one below!'}
                          </div>
                        )}
                      </div>

                      {/* Add Exercise Form to this day OR Rest Day Notice */}
                      {dayObj.isRestDay ? (
                        <div className="p-3 bg-amber-50/80 border border-amber-200/80 rounded-xl text-xs text-amber-900 font-medium flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <span className="flex items-center gap-2 font-bold">
                            <Coffee className="w-4 h-4 text-amber-600 shrink-0" />
                            Scheduled Rest Day — Active recovery & muscle synthesis
                          </span>
                          <span className="text-[11px] text-amber-700/90 font-semibold">Uncheck "Rest" above to add exercises</span>
                        </div>
                      ) : isAddingEx ? (
                        <div className="p-3.5 bg-indigo-50/80 border border-indigo-200 rounded-xl space-y-3">
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

                          <div className={`grid grid-cols-1 ${!newExIsBodyweight ? 'sm:grid-cols-4' : 'sm:grid-cols-3'} gap-2`}>
                            <div>
                              <label className="block text-[10px] font-bold text-indigo-800 uppercase mb-1">Workout Type</label>
                              <div className="flex bg-white/80 p-0.5 rounded-lg border border-slate-200">
                                <button
                                  type="button"
                                  onClick={() => setNewExIsBodyweight(false)}
                                  className={`flex-1 py-1 text-[11px] font-extrabold rounded-md transition-all cursor-pointer ${
                                    !newExIsBodyweight ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                                  }`}
                                >
                                  Weight
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setNewExIsBodyweight(true)}
                                  className={`flex-1 py-1 text-[11px] font-extrabold rounded-md transition-all cursor-pointer ${
                                    newExIsBodyweight ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                                  }`}
                                >
                                  Bodyweight
                                </button>
                              </div>
                            </div>

                            <div>
                              <label className="block text-[10px] font-bold text-indigo-800 uppercase mb-1">Target Muscle Group(s) — Select all that apply</label>
                              <div className="flex flex-wrap gap-1">
                                {MUSCLE_GROUP_OPTIONS.map(m => {
                                  const isSelected = newExCategories.includes(m);
                                  return (
                                    <button
                                      key={`new-m-${m}`}
                                      type="button"
                                      onClick={() => {
                                        if (isSelected) {
                                          if (newExCategories.length > 1) {
                                            setNewExCategories(newExCategories.filter(x => x !== m));
                                          }
                                        } else {
                                          setNewExCategories([...newExCategories, m]);
                                        }
                                      }}
                                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all cursor-pointer ${isSelected ? "bg-indigo-600 text-white shadow-sm" : "bg-white hover:bg-slate-100 text-slate-700 border border-slate-200"}`}
                                    >
                                      {m}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            <div>
                              <label className="block text-[10px] font-bold text-indigo-800 uppercase mb-1">Target Sets</label>
                              <input
                                type="number"
                                min={1}
                                max={20}
                                value={newExSets}
                                onChange={e => {
                                  const v = e.target.value;
                                  setNewExSets(v === '' ? '' : Math.max(1, parseInt(v, 10) || 1));
                                }}
                                onBlur={() => {
                                  if (newExSets === '' || Number(newExSets) < 1) setNewExSets(1);
                                }}
                                onFocus={e => e.target.select()}
                                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-bold text-indigo-800 uppercase mb-1">Target Reps / Set</label>
                              <input
                                type="number"
                                min={1}
                                max={200}
                                value={newExReps}
                                onChange={e => {
                                  const v = e.target.value;
                                  setNewExReps(v === '' ? '' : Math.max(1, parseInt(v, 10) || 1));
                                }}
                                onBlur={() => {
                                  if (newExReps === '' || Number(newExReps) < 1) setNewExReps(1);
                                }}
                                onFocus={e => e.target.select()}
                                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              />
                            </div>

                            {!newExIsBodyweight && (
                              <div>
                                <label className="block text-[10px] font-bold text-indigo-800 uppercase mb-1">Target Weight (lbs)</label>
                                <input
                                  type="number"
                                  min={0}
                                  max={1000}
                                  value={newExWeight}
                                  onChange={e => {
                                    const v = e.target.value;
                                    setNewExWeight(v === '' ? '' : Math.max(0, parseFloat(v) || 0));
                                  }}
                                  onBlur={() => {
                                    if (newExWeight === '' || Number(newExWeight) < 0) setNewExWeight(0);
                                  }}
                                  onFocus={e => e.target.select()}
                                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                              </div>
                            )}
                          </div>

                          <div className="flex flex-col sm:flex-row justify-end gap-2 w-full">
                            <button
                              type="button"
                              onClick={() => handleAddExerciseToDay(dayIdx)}
                              disabled={!newExName.trim()}
                              className="w-full sm:w-auto px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer flex items-center justify-center text-center"
                            >
                              Add Exercise
                            </button>
                            <button
                              type="button"
                              onClick={() => setAddingExToDayIdx(null)}
                              className="w-full sm:w-auto px-3 py-1.5 bg-white border border-slate-200 text-slate-600 font-bold text-xs rounded-lg cursor-pointer flex items-center justify-center text-center"
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
                            setNewExCategories(inferMuscleGroups('', dayObj.focusArea));
                            setNewExUrl('');
                            setNewExIsBodyweight(false);
                            setNewExSets(3);
                            setNewExReps(10);
                            setNewExWeight(30);
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
                  'Are you sure you want to exit active workout mode? Your set entries for this session will be cleared.',
                  handleExitWorkout,
                  'Exit Workout',
                  'warning'
                );
              }}
              className="text-xs font-bold text-slate-400 hover:text-slate-600 py-1.5 px-3 rounded-lg hover:bg-slate-100 transition-all cursor-pointer flex items-center justify-center text-center"
              id="exit-workout-btn"
            >
              Exit Workout
            </button>
          </div>

          {hasRestoredSession && (
            <div className="bg-indigo-50 border border-indigo-200/80 rounded-2xl p-4 flex items-center justify-between gap-3 text-indigo-950 text-xs font-semibold shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-indigo-600 text-white rounded-xl flex items-center justify-center shrink-0 shadow-xs">
                  <RotateCcw className="w-4.5 h-4.5" />
                </div>
                <div>
                  <span className="font-extrabold text-indigo-900 block text-xs">Active Workout Restored</span>
                  <span className="text-indigo-700 text-[11px]">
                    Your completed sets, reps, and weights were automatically recovered from your session.
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setHasRestoredSession(false)}
                className="px-3 py-1 bg-white hover:bg-indigo-100 text-indigo-700 font-bold text-[11px] rounded-lg border border-indigo-200 transition-colors shrink-0 cursor-pointer flex items-center justify-center text-center"
              >
                Got It
              </button>
            </div>
          )}

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
            {(() => {
              const activeExName = currentPlan.exercises[activeExerciseIndex];
              const activeRawEx = currentPlan.rawExercises?.[activeExerciseIndex];
              const setKeysForEx = Object.keys(workoutProgress)
                .filter(k => k.startsWith(`${activeExName}-`))
                .map(k => parseInt(k.replace(`${activeExName}-`, ''), 10))
                .filter(n => !isNaN(n));
              const maxSetIdx = setKeysForEx.length > 0 ? Math.max(...setKeysForEx) : -1;
              const targetSetsCount = Math.max(activeRawEx?.sets || 3, maxSetIdx + 1);
              const targetRepsCount = activeRawEx?.reps || 10;
              const isBodyweight = activeRawEx?.isBodyweight !== undefined
                ? activeRawEx.isBodyweight
                : (activeExName.toLowerCase().includes('bodyweight') ||
                   activeExName.toLowerCase().includes('stretching') ||
                   activeExName.toLowerCase().includes('crunch') ||
                   activeExName.toLowerCase().includes('leg raise') ||
                   activeExName.toLowerCase().includes('pushup') ||
                   activeExName.toLowerCase().includes('pullup'));
              const setIndices = Array.from({ length: targetSetsCount }, (_, i) => i);

              return (
                <>
                  <div className="flex justify-between items-center flex-wrap gap-2">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <span>Logged Working Sets</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200 font-extrabold">
                        Target: {targetSetsCount} Sets × {targetRepsCount} Reps
                      </span>
                    </h4>
                    <span className="text-[10px] text-slate-400 font-semibold flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" /> Check the boxes as you finish each set
                    </span>
                  </div>

                  <div className="space-y-3">
                    {setIndices.map(setIdx => {
                      const exName = activeExName;
                      const key = `${exName}-${setIdx}`;
                      const setProgress = workoutProgress[key] || { reps: targetRepsCount, weight: isBodyweight ? 0 : 30, completed: false };

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

                          <div className="flex items-center gap-2 sm:gap-3">
                            {/* Weight Input */}
                            {!isBodyweight ? (
                              <div className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200">
                                <input
                                  type="number"
                                  value={setProgress.weight === 0 ? '' : setProgress.weight}
                                  placeholder="0"
                                  onChange={e =>
                                    handleUpdateSetField(exName, setIdx, 'weight', e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)
                                  }
                                  onFocus={e => e.target.select()}
                                  className="w-12 text-sm font-bold text-slate-800 text-center focus:outline-none"
                                  step="2.5"
                                />
                                <span className="text-xs font-extrabold text-slate-400 uppercase">{weightUnit}</span>
                              </div>
                            ) : (
                              <span className="text-xs font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                                Bodyweight
                              </span>
                            )}

                            {/* Reps Input */}
                            <div className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200">
                              <input
                                type="number"
                                value={setProgress.reps === 0 ? '' : setProgress.reps}
                                placeholder="0"
                                onChange={e =>
                                  handleUpdateSetField(exName, setIdx, 'reps', e.target.value === '' ? 0 : parseInt(e.target.value, 10) || 0)
                                }
                                onFocus={e => e.target.select()}
                                className="w-10 text-sm font-bold text-slate-800 text-center focus:outline-none"
                              />
                              <span className="text-xs font-extrabold text-slate-400 uppercase">reps</span>
                            </div>

                            {/* Delete Set Button */}
                            {targetSetsCount > 1 && (
                              <button
                                type="button"
                                onClick={() => handleDeleteSetFromExercise(exName, setIdx, activeRawEx)}
                                className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer shrink-0"
                                title="Delete this set"
                                aria-label={`Delete Set ${setIdx + 1}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="pt-2 flex items-center justify-end gap-2.5 w-full flex-wrap">
                    {targetSetsCount > 1 && (
                      <button
                        type="button"
                        onClick={() => handleDeleteSetFromExercise(activeExName, targetSetsCount - 1, activeRawEx)}
                        className="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-extrabold text-sm rounded-xl border border-rose-200 transition-colors flex items-center justify-center text-center gap-1.5 cursor-pointer shadow-2xs"
                      >
                        <Minus className="w-4 h-4 text-rose-600" />
                        <span>Delete Last Set</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleAddExtraSetToExercise(activeExName, activeRawEx)}
                      className="px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-extrabold text-sm rounded-xl border border-indigo-200/80 transition-colors flex items-center justify-center text-center gap-1.5 cursor-pointer shadow-2xs"
                    >
                      <Plus className="w-4 h-4 text-indigo-600" />
                      <span>Add Extra Set</span>
                    </button>
                  </div>
                </>
              );
            })()}

            {/* Next / Finish Navigation Buttons */}
            <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 w-full">
              <button
                type="button"
                onClick={() => setActiveExerciseIndex(prev => Math.max(0, prev - 1))}
                disabled={activeExerciseIndex === 0}
                className="w-full sm:w-auto px-4 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700 font-bold text-xs rounded-xl transition-colors flex items-center justify-center text-center gap-1 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                Prev Exercise
              </button>

              {activeExerciseIndex < currentPlan.exercises.length - 1 ? (
                <button
                  type="button"
                  onClick={() => setActiveExerciseIndex(prev => Math.min(currentPlan.exercises.length - 1, prev + 1))}
                  className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-colors flex items-center justify-center text-center gap-1 cursor-pointer"
                >
                  <span>Next Exercise</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleFinishAndSaveWorkout}
                  className="w-full sm:w-auto px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-colors flex items-center justify-center text-center gap-1.5 cursor-pointer animate-pulse"
                >
                  <Award className="w-4 h-4" />
                  <span>Finish Workout</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Duplicate Exercise to Another Day Modal */}
      {duplicateModalEx && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-100 text-indigo-600 rounded-xl">
                  <Copy className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">Duplicate Workout Exercise</h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Copy <span className="font-bold text-slate-800">"{duplicateModalEx.exercise.name}"</span> to another routine day
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDuplicateModalEx(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Select Target Day:</p>
              {displayDays.map((dayObj, dIdx) => {
                const isSource = dIdx === duplicateModalEx.sourceDayIdx;
                const isRest = Boolean(dayObj.isRestDay);

                return (
                  <button
                    key={`dup-target-day-${dIdx}`}
                    type="button"
                    disabled={isRest}
                    onClick={() => handleDuplicateToDay(dIdx)}
                    className={`w-full p-3.5 rounded-2xl border text-left transition-all flex items-center justify-between gap-3 ${
                      isRest
                        ? 'bg-slate-100/70 border-slate-200 text-slate-400 cursor-not-allowed opacity-60'
                        : 'bg-slate-50 hover:bg-indigo-50/70 border-slate-200 hover:border-indigo-300 text-slate-900 cursor-pointer active:scale-[0.98]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`w-8 h-8 rounded-xl font-black text-xs flex items-center justify-center shrink-0 ${
                        isRest ? 'bg-amber-100 text-amber-700' : 'bg-indigo-600 text-white'
                      }`}>
                        {dIdx + 1}
                      </span>
                      <div>
                        <div className="text-xs font-extrabold flex items-center gap-2">
                          <span>{dayObj.day || `Day ${dIdx + 1}`}</span>
                          {dayObj.dayOfWeek && dayObj.dayOfWeek !== 'Unassigned' && (
                            <span className="text-[10px] text-slate-500 font-bold">({dayObj.dayOfWeek})</span>
                          )}
                        </div>
                        <div className="text-[11px] font-semibold text-slate-500">
                          {dayObj.focusArea || 'Full Body'} • {dayObj.exercises?.length || 0} exercises
                        </div>
                      </div>
                    </div>

                    <div>
                      {isRest ? (
                        <span className="px-2.5 py-1 bg-amber-100 text-amber-800 text-[10px] font-black rounded-lg border border-amber-200">
                          Rest Day
                        </span>
                      ) : isSource ? (
                        <span className="px-2.5 py-1 bg-indigo-100 text-indigo-800 text-[10px] font-black rounded-lg border border-indigo-200">
                          Same Day +
                        </span>
                      ) : (
                        <span className="px-3 py-1 bg-indigo-600 text-white text-[11px] font-bold rounded-lg shadow-2xs">
                          Copy Here
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="pt-2 border-t border-slate-100 w-full">
              <button
                type="button"
                onClick={() => setDuplicateModalEx(null)}
                className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-extrabold rounded-xl transition-colors cursor-pointer flex items-center justify-center text-center"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {duplicateToastMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-3 animate-fadeIn">
          <Check className="w-5 h-5 text-emerald-400 stroke-[3]" />
          <span className="text-xs font-black">{duplicateToastMsg}</span>
        </div>
      )}


      {/* Toast Notification for Shift Success */}
      {shiftSuccessMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-indigo-950 text-white px-5 py-3.5 rounded-2xl shadow-2xl border border-indigo-700 flex items-center gap-3 animate-fadeIn">
          <Sparkles className="w-5 h-5 text-indigo-400 stroke-[2.5]" />
          <span className="text-xs font-black">{shiftSuccessMsg}</span>
        </div>
      )}

      {/* One-Time Schedule Shift Modal */}
      {isShiftModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full max-h-[85vh] flex flex-col shadow-2xl relative overflow-hidden">
            {/* Header */}
            <div className="p-5 sm:p-6 pb-4 border-b border-slate-100 flex justify-between items-start shrink-0">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-indigo-600 font-black text-xs uppercase tracking-wider">
                  <Calendar className="w-4 h-4" /> One-Time Schedule Adjustment
                </div>
                <h3 className="text-lg sm:text-xl font-black text-slate-900">Move Session or Swap Days</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsShiftModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
              <p className="text-xs font-semibold text-slate-600 leading-relaxed bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80">
                Need to take today off or shift your workout? This will adjust your schedule for <strong>this week only</strong> without changing your master weekly routines (e.g. next week's schedule stays untouched!).
              </p>

              <div className="space-y-3">
                {/* Option 1: Move to Tomorrow */}
                <button
                  type="button"
                  onClick={handleMoveSessionToTomorrow}
                  className="w-full text-left p-3.5 sm:p-4 rounded-2xl border border-indigo-200 bg-indigo-50/60 hover:bg-indigo-100/80 transition-all cursor-pointer group flex items-start gap-3"
                >
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                    <ChevronRight className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-black text-indigo-950 flex flex-wrap items-center gap-1.5">
                      Move Today's Session to Tomorrow
                      <span className="text-[10px] font-extrabold bg-indigo-200/80 text-indigo-900 px-2 py-0.5 rounded-md">
                        {getDayNameFromDateString(addDaysToDateString(selectedDateStr, 1))} ({formatDateDDMMYYYY(addDaysToDateString(selectedDateStr, 1))})
                      </span>
                    </div>
                    <p className="text-[11px] font-medium text-slate-600 mt-1">
                      Makes today ({getDayNameFromDateString(selectedDateStr)}) a Rest Day and schedules today's <strong>{currentPlan?.title || 'Workout'}</strong> for tomorrow.
                    </p>
                  </div>
                </button>

                {/* Option 2: Swap with a Rest Day in this week */}
                <div className="space-y-2 pt-1">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">
                    Or Swap with a Rest Day in Current Week:
                  </span>
                  <div className="grid grid-cols-1 gap-2">
                    {displayDays.map((d, idx) => {
                      const dateForIdx = getWeekDateForDisplayIndex(idx);
                      const isRest = Boolean(d.isRestDay || d.focusArea?.toLowerCase().includes('rest'));
                      const isToday = dateForIdx === selectedDateStr;

                      if (!isRest || isToday) return null;

                      return (
                        <button
                          key={`swap-rest-${idx}`}
                          type="button"
                          disabled
                          className="w-full text-left p-3 rounded-xl border border-slate-200 bg-slate-50 opacity-60 cursor-not-allowed flex items-center justify-between"
                          title="Swapping days is temporarily disabled"
                        >
                          <div className="flex items-center gap-2.5">
                            <Coffee className="w-4 h-4 text-amber-600 shrink-0" />
                            <div>
                              <span className="text-xs font-black text-slate-700">
                                Swap with {d.dayOfWeek || d.day} ({dateForIdx})
                              </span>
                              <span className="text-[10px] text-slate-400 font-bold block">
                                Currently scheduled Rest Day
                              </span>
                            </div>
                          </div>
                          <span className="text-[10px] font-black bg-slate-200 text-slate-500 px-2.5 py-1 rounded-lg">
                            Disabled
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Option 3: Make Today Rest Day Only */}
                <button
                  type="button"
                  onClick={handleMakeTodayRestDayOnly}
                  className="w-full text-left p-3.5 rounded-2xl border border-slate-200 hover:border-slate-300 bg-slate-50 hover:bg-slate-100 transition-all cursor-pointer flex items-center gap-3"
                >
                  <Coffee className="w-5 h-5 text-amber-700 shrink-0" />
                  <div>
                    <div className="text-xs font-black text-slate-800">
                      Rest Today Only (Skip Today's Session)
                    </div>
                    <p className="text-[11px] font-medium text-slate-500 mt-0.5">
                      Marks today as a Rest Day to keep your streak alive without re-scheduling.
                    </p>
                  </div>
                </button>
              </div>
            </div>

            {/* Sticky Footer */}
            <div className="p-4 sm:px-6 bg-slate-50 border-t border-slate-100 w-full shrink-0">
              <button
                type="button"
                onClick={() => setIsShiftModalOpen(false)}
                className="w-full py-3 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-extrabold rounded-xl transition-colors cursor-pointer flex items-center justify-center text-center"
              >
                Cancel
              </button>
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
