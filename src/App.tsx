import React, { useState, useEffect, useRef } from 'react';
import { DailyLog, UserGoals, CoachingInsight, Meal, Workout, SetLog, ParsedWorkoutDay } from './types';
import { INITIAL_GOALS, INITIAL_LOGS, INITIAL_INSIGHTS } from './data';
import MealLogger from './components/MealLogger';
import WorkoutLogger from './components/WorkoutLogger';
import Analytics from './components/Analytics';
import CalendarView from './components/CalendarView';
import CoachInsights from './components/CoachInsights';
import GoalsConfig from './components/GoalsConfig';
import WorkspaceHub from './components/WorkspaceHub';
import { ConfirmModal } from './components/ConfirmModal';
import { auth, initAuth, getAccessToken, isTokenExpired, googleSignIn } from './lib/googleAuth';
import { backupDataToDrive, extractFolderId, fetchGoogleDocText, parseFoodsFromText, parseWorkoutsFromText, restoreDataFromDrive } from './lib/googleApi';

import {
  Dumbbell,
  Flame,
  Award,
  Plus,
  Trash2,
  CheckCircle2,
  Calendar,
  Sparkles,
  TrendingUp,
  RotateCcw,
  Weight,
  Cloud,
  ArrowRight,
  PlusCircle,
  FileText,
  Menu,
  X,
  Pencil,
  Check,
  Loader2,
  Lock,
  ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

function formatTime12Hour(timeStr: string): string {
  if (!timeStr) return '';
  if (timeStr.toLowerCase().includes('am') || timeStr.toLowerCase().includes('pm')) {
    return timeStr;
  }
  const parts = timeStr.split(':');
  if (parts.length >= 2) {
    let hours = parseInt(parts[0], 10);
    const minutes = parts[1].trim();
    if (!isNaN(hours)) {
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12; // the hour '0' should be '12'
      return `${hours}:${minutes} ${ampm}`;
    }
  }
  return timeStr;
}

export default function App() {
  // Navigation Tabs state: Expanded to separate Nutrition, Workouts, Analytics, AI Coach, Settings, and Google Sync Hubs
  const [activeTab, setActiveTab] = useState<
    'nutrition' | 'workouts' | 'analytics' | 'coach' | 'settings' | 'workspace'
  >('nutrition');

  // Sub-tabs state inside Analytics section (Graphs & Calendar)
  const [analyticsSubTab, setAnalyticsSubTab] = useState<'graphs' | 'calendar'>('graphs');

  // Hamburger drawer open/close state
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Track if we have already auto-synced upon opening the app
  const hasSyncedOnOpen = useRef(false);
  const isAutoSyncReady = useRef(false);
  const lastSavedSignature = useRef<string>('');
  const [syncingActionMessage, setSyncingActionMessage] = useState('Restoring logged foods & workouts from Google Drive...');


  // Selected date for logging, defaults to today in YYYY-MM-DD
  const [selectedDate, setSelectedDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  // Load goals from LocalStorage, fallback to Initial
  const [goals, setGoals] = useState<UserGoals>(() => {
    const saved = localStorage.getItem('hypertrophy_goals');
    if (saved) {
      try {
        let parsed = JSON.parse(saved);
        // Force migration to kg and cm as explicitly requested by user:
        if (parsed.weightUnit === 'lbs') {
          parsed.currentWeight = Math.round((parsed.currentWeight * 0.45359237) * 10) / 10;
          parsed.targetWeight = Math.round((parsed.targetWeight * 0.45359237) * 10) / 10;
          parsed.weightUnit = 'kg';
        }
        if (!parsed.currentHeight) {
          parsed.currentHeight = 178; // Default in cm
        }
        return { ...INITIAL_GOALS, ...parsed };
      } catch (e) {
        return INITIAL_GOALS;
      }
    }
    return INITIAL_GOALS;
  });

  // Load daily logs from LocalStorage, fallback to Initial (with auto-purge for legacy mock data)
  const [logs, setLogs] = useState<DailyLog[]>(() => {
    const saved = localStorage.getItem('hypertrophy_logs');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const containsMockData = parsed.some((log: any) => 
          log.meals?.some((meal: any) => meal.id === 'm1')
        );
        if (containsMockData) {
          localStorage.removeItem('hypertrophy_logs');
          return INITIAL_LOGS;
        }
        return parsed;
      } catch (e) {
        return INITIAL_LOGS;
      }
    }
    return INITIAL_LOGS;
  });

  // Load coaching insights from LocalStorage, fallback to Initial (with auto-purge for legacy mock insights)
  const [insights, setInsights] = useState<CoachingInsight[]>(() => {
    const saved = localStorage.getItem('hypertrophy_insights');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const containsMockInsights = parsed.some((insight: any) => 
          insight.summary === 'Optimizing Protein Timing for Anabolism'
        );
        if (containsMockInsights) {
          localStorage.removeItem('hypertrophy_insights');
          return INITIAL_INSIGHTS;
        }
        return parsed;
      } catch (e) {
        return INITIAL_INSIGHTS;
      }
    }
    return INITIAL_INSIGHTS;
  });

  // Parsed documents state lifted to App level so they can be logged from Nutrition or Workouts
  const [parsedFoods, setParsedFoods] = useState<Omit<Meal, 'id' | 'timestamp'>[]>(() => {
    try {
      const saved = localStorage.getItem('hypertrophy_parsed_foods');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });
  const [parsedWorkouts, setParsedWorkouts] = useState<ParsedWorkoutDay[]>(() => {
    try {
      const saved = localStorage.getItem('hypertrophy_parsed_workouts');
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        return parsed;
      }
      return [];
    } catch (e) {
      return [];
    }
  });
  const [rawPlanText, setRawPlanText] = useState('');

  // Food/Meal selected logging time
  const [mealTimeInput, setMealTimeInput] = useState(() => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  });

  // State for editing an existing logged meal
  const [editingMealId, setEditingMealId] = useState<string | null>(null);
  const [editMealName, setEditMealName] = useState('');
  const [editMealProtein, setEditMealProtein] = useState('');
  const [editMealCalories, setEditMealCalories] = useState('');
  const [editMealTime, setEditMealTime] = useState('');

  // State for adding or editing logged workouts manually on selected date
  const [isAddingWorkoutModal, setIsAddingWorkoutModal] = useState(false);
  const [editingWorkoutId, setEditingWorkoutId] = useState<string | null>(null);
  const [workoutFormName, setWorkoutFormName] = useState('');
  const [workoutFormCategory, setWorkoutFormCategory] = useState<'Chest' | 'Back' | 'Legs' | 'Shoulders' | 'Arms' | 'Core' | 'Cardio'>('Chest');
  const [workoutFormSets, setWorkoutFormSets] = useState<Array<{ reps: number; weight: number; completed: boolean }>>([
    { reps: 10, weight: 30, completed: true },
    { reps: 10, weight: 30, completed: true },
    { reps: 10, weight: 30, completed: true }
  ]);

  // Authentication & session expiration states
  const [googleToken, setGoogleToken] = useState<string | null>(() => (!isTokenExpired() ? getAccessToken() : null));
  const [sessionExpired, setSessionExpired] = useState<boolean>(() => isTokenExpired() || !getAccessToken());
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isSyncingDrive, setIsSyncingDrive] = useState(false);
  const [syncStatusMessage, setSyncStatusMessage] = useState<string | null>(null);

  // State to manage entering today's bodyweight and height
  const [weightInput, setWeightInput] = useState('');
  const [heightInput, setHeightInput] = useState(() => (goals.currentHeight || 178).toString());

  // Custom confirmation modal state
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

  // Sync to LocalStorage whenever state changes
  useEffect(() => {
    localStorage.setItem('hypertrophy_goals', JSON.stringify(goals));
  }, [goals]);

  useEffect(() => {
    localStorage.setItem('hypertrophy_logs', JSON.stringify(logs));
  }, [logs]);

  useEffect(() => {
    localStorage.setItem('hypertrophy_insights', JSON.stringify(insights));
  }, [insights]);

  useEffect(() => {
    localStorage.setItem('hypertrophy_parsed_foods', JSON.stringify(parsedFoods));
  }, [parsedFoods]);

  useEffect(() => {
    localStorage.setItem('hypertrophy_parsed_workouts', JSON.stringify(parsedWorkouts));
  }, [parsedWorkouts]);

  // Automatic Backup and Sync to Google Drive & connected Docs upon opening the app or logging in
  const triggerAutoSyncOnOpen = async (overrideToken?: string) => {
    if (hasSyncedOnOpen.current) return;

    const accessToken = overrideToken || getAccessToken();
    if (!accessToken) return;

    if (isTokenExpired()) {
      console.log('Skipping background auto-sync on load: Google Access Token is expired.');
      return;
    }

    hasSyncedOnOpen.current = true;
    setSyncingActionMessage('Restoring logged foods & workouts from Google Drive...');
    setIsSyncingDrive(true);
    console.log('Initiating auto-sync on app open...');
    try {
      const folderId = goals.driveFolderLink ? extractFolderId(goals.driveFolderLink) : undefined;
      
      // Try to restore first
      const restored = await restoreDataFromDrive(accessToken, folderId);
      
      if (restored) {
        console.log('Found existing backup on Google Drive, restoring data...', restored);
        let finalGoals = goals;
        let finalLogs = logs;
        let finalInsights = insights;
        let finalFoods = parsedFoods;
        let finalWorkouts = parsedWorkouts;

        if (restored.goals) {
          finalGoals = restored.goals;
          setGoals(restored.goals);
        }
        if (restored.logs) {
          setLogs((prevLocalLogs) => {
            // Intelligently merge restored logs with local logs so no local additions or edits are lost
            const dateMap = new Map<string, DailyLog>();
            restored.logs.forEach((l: DailyLog) => dateMap.set(l.date, l));
            prevLocalLogs.forEach((localLog) => {
              const existing = dateMap.get(localLog.date);
              if (!existing) {
                dateMap.set(localLog.date, localLog);
              } else {
                // Merge meals by ID, prioritizing local edited versions
                const localMealMap = new Map(localLog.meals.map((m) => [m.id, m]));
                const existingMealIds = new Set(existing.meals.map((m) => m.id));
                const mergedMeals = [
                  ...existing.meals.map((m) => localMealMap.get(m.id) || m),
                  ...localLog.meals.filter((m) => !existingMealIds.has(m.id))
                ];

                // Merge workouts by ID, prioritizing local edited versions
                const localWorkoutMap = new Map(localLog.workouts.map((w) => [w.id, w]));
                const existingWorkoutIds = new Set(existing.workouts.map((w) => w.id));
                const mergedWorkouts = [
                  ...existing.workouts.map((w) => localWorkoutMap.get(w.id) || w),
                  ...localLog.workouts.filter((w) => !existingWorkoutIds.has(w.id))
                ];

                dateMap.set(localLog.date, {
                  ...existing,
                  ...localLog,
                  meals: mergedMeals,
                  workouts: mergedWorkouts
                });
              }
            });
            const merged = Array.from(dateMap.values());
            finalLogs = merged;
            try {
              localStorage.setItem('hypertrophy_logs', JSON.stringify(merged));
            } catch (e) {}
            return merged;
          });
        }
        if (restored.insights) {
          finalInsights = restored.insights;
          setInsights(restored.insights);
          try {
            localStorage.setItem('hypertrophy_insights', JSON.stringify(restored.insights));
          } catch (e) {}
        }
        if (restored.parsedFoods) {
          finalFoods = restored.parsedFoods;
          setParsedFoods(restored.parsedFoods);
          try {
            localStorage.setItem('hypertrophy_parsed_foods', JSON.stringify(restored.parsedFoods));
          } catch (e) {}
        }
        if (restored.parsedWorkouts && Array.isArray(restored.parsedWorkouts) && restored.parsedWorkouts.length > 0) {
          setParsedWorkouts((prevLocal) => {
            if (!prevLocal || prevLocal.length === 0) {
              finalWorkouts = restored.parsedWorkouts;
              return restored.parsedWorkouts;
            }

            // Intelligently merge restored days with local days to preserve local workout edits and YouTube links
            const mergedDays = restored.parsedWorkouts.map((restoredDay: ParsedWorkoutDay, idx: number) => {
              const localDay = prevLocal[idx] || prevLocal.find((d) => d.day === restoredDay.day);
              if (!localDay) return restoredDay;

              const restoredExMap = new Map((restoredDay.exercises || []).map((e: any) => [e.name.toLowerCase().trim(), e]));
              const localExList = localDay.exercises || [];

              const mergedExercises = localExList.map((localEx: any) => {
                const key = localEx.name.toLowerCase().trim();
                const restoredEx = restoredExMap.get(key);
                return {
                  name: localEx.name,
                  youtubeUrl: localEx.youtubeUrl || restoredEx?.youtubeUrl || ''
                };
              });

              const localNames = new Set(localExList.map((e: any) => e.name.toLowerCase().trim()));
              (restoredDay.exercises || []).forEach((restoredEx: any) => {
                if (!localNames.has(restoredEx.name.toLowerCase().trim())) {
                  mergedExercises.push(restoredEx);
                }
              });

              return {
                ...restoredDay,
                day: localDay.day || restoredDay.day,
                focusArea: localDay.focusArea || restoredDay.focusArea,
                exercises: mergedExercises
              };
            });

            if (prevLocal.length > restored.parsedWorkouts.length) {
              for (let i = restored.parsedWorkouts.length; i < prevLocal.length; i++) {
                mergedDays.push(prevLocal[i]);
              }
            }

            finalWorkouts = mergedDays;
            try {
              localStorage.setItem('hypertrophy_parsed_workouts', JSON.stringify(mergedDays));
            } catch (e) {}
            return mergedDays;
          });
        }

        const nowStr = new Date().toLocaleString();
        const restoredDriveFolderLink = restored._resolvedFolderId
          ? `https://drive.google.com/drive/folders/${restored._resolvedFolderId}`
          : (restored.goals?.driveFolderLink || goals.driveFolderLink);

        setGoals((prev) => {
          const updated = {
            ...prev,
            ...restored.goals,
            lastSyncTime: nowStr,
            driveFolderLink: restoredDriveFolderLink
          };
          try {
            localStorage.setItem('hypertrophy_goals', JSON.stringify(updated));
          } catch (e) {}
          return updated;
        });

        // Set initial signature so restored state doesn't re-trigger background save
        lastSavedSignature.current = JSON.stringify({
          goals: { ...finalGoals, lastSyncTime: undefined },
          logs: finalLogs,
          insights: finalInsights,
          parsedFoods: finalFoods,
          parsedWorkouts: finalWorkouts
        });

        console.log('Auto-sync / restore on app open successful:', nowStr);
        setSyncStatusMessage('Google Drive data restored & up to date!');
        setTimeout(() => setSyncStatusMessage(null), 3500);
      } else {
        // No backup found. Perform initial backup of current local state only if we have actual data
        const hasLocalData = logs.length > 0 || parsedFoods.length > 0 || parsedWorkouts.length > 0;
        if (hasLocalData) {
          console.log('No backup found on Google Drive. Performing initial backup of local data...');
          const payload = {
            goals,
            logs,
            insights,
            parsedFoods,
            parsedWorkouts,
            backupVersion: '1.0',
            exportedAt: new Date().toISOString()
          };
          const { fileId, folderId: resolvedFolderId } = await backupDataToDrive(payload, accessToken, folderId);
          
          const nowStr = new Date().toLocaleString();
          setGoals((prev) => ({
            ...prev,
            lastSyncTime: nowStr,
            driveFolderLink: resolvedFolderId ? `https://drive.google.com/drive/folders/${resolvedFolderId}` : prev.driveFolderLink
          }));
          lastSavedSignature.current = JSON.stringify({
            goals: { ...goals, lastSyncTime: undefined },
            logs,
            insights,
            parsedFoods,
            parsedWorkouts
          });
          console.log('Initial backup successful on open:', nowStr);
          setSyncStatusMessage('Google Drive sync active.');
          setTimeout(() => setSyncStatusMessage(null), 3000);
        } else {
          console.log('No backup found and no local data to back up. Skipping initial backup.');
          setSyncStatusMessage(null);
        }
      }
    } catch (err) {
      console.error('Auto-sync / restore on app open failed:', err);
      setSyncStatusMessage(null);
    } finally {
      setIsSyncingDrive(false);
      isAutoSyncReady.current = true;
    }
  };

  useEffect(() => {

    // Listen to Google Auth status changes to trigger sync immediately
    const unsubscribe = initAuth(
      (user, activeToken) => {
        const expired = isTokenExpired();
        if (!expired && activeToken) {
          setGoogleToken(activeToken);
          setSessionExpired(false);
          triggerAutoSyncOnOpen(activeToken);
        } else {
          setGoogleToken(null);
          setSessionExpired(true);
        }
        isAutoSyncReady.current = true;
      },
      () => {
        setGoogleToken(null);
        setSessionExpired(true);
        isAutoSyncReady.current = true;
      }
    );
    return () => unsubscribe();
  }, []);

  // Real-time automatic background save to Google Drive on any state change
  useEffect(() => {
    if (!isAutoSyncReady.current) return;

    const accessToken = getAccessToken();
    if (!accessToken || isTokenExpired()) return;

    // Check signature excluding lastSyncTime to prevent infinite loop
    const currentGoals = { ...goals, lastSyncTime: undefined };
    const currentSignature = JSON.stringify({
      goals: currentGoals,
      logs,
      insights,
      parsedFoods,
      parsedWorkouts
    });

    if (lastSavedSignature.current === currentSignature) {
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setSyncingActionMessage('Saving changes to Google Drive...');
        setIsSyncingDrive(true);
        const folderId = goals.driveFolderLink ? extractFolderId(goals.driveFolderLink) : undefined;
        const payload = {
          goals,
          logs,
          insights,
          parsedFoods,
          parsedWorkouts,
          backupVersion: '1.0',
          exportedAt: new Date().toISOString()
        };
        const { fileId, folderId: resolvedFolderId } = await backupDataToDrive(payload, accessToken, folderId);
        const nowStr = new Date().toLocaleString();

        lastSavedSignature.current = currentSignature;

        setGoals((prev) => ({
          ...prev,
          lastSyncTime: nowStr,
          driveFolderLink: resolvedFolderId ? `https://drive.google.com/drive/folders/${resolvedFolderId}` : prev.driveFolderLink
        }));
        setSyncStatusMessage('Auto-saved to Google Drive');
        setTimeout(() => setSyncStatusMessage(null), 2500);
      } catch (err) {
        console.error('Real-time Google Drive auto-save failed:', err);
      } finally {
        setIsSyncingDrive(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [logs, parsedWorkouts, parsedFoods, goals, insights]);

  // Monitor Google Access Token Expiration globally
  useEffect(() => {
    if (googleToken) {
      const checkExpiry = () => {
        if (isTokenExpired()) {
          setGoogleToken(null);
          setSessionExpired(true);
        }
      };
      checkExpiry();
      const interval = setInterval(checkExpiry, 15000);
      return () => clearInterval(interval);
    }
  }, [googleToken]);

  // Handle Google Sign In from full-screen overlay gate
  const handleLoginFromOverlay = async () => {
    setIsLoggingIn(true);
    setLoginError(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setGoogleToken(result.accessToken);
        setSessionExpired(false);
        hasSyncedOnOpen.current = false;
        triggerAutoSyncOnOpen(result.accessToken);
      }
    } catch (err: any) {
      console.error('Failed overlay Google sign in:', err);
      setLoginError(err.message || 'Google authentication failed. Please try again.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Retrieve log for currently selected date
  const currentLog = logs.find((l) => l.date === selectedDate) || {
    date: selectedDate,
    meals: [],
    workouts: [],
    weight: undefined,
    notes: ''
  };

  // Setup current bodyweight and height inputs
  useEffect(() => {
    if (currentLog.weight) {
      setWeightInput(currentLog.weight.toString());
    } else {
      setWeightInput('');
    }
    setHeightInput((goals.currentHeight || 178).toString());
  }, [selectedDate, currentLog.weight, goals.currentHeight]);

  // Helper to update log for a specific date safely with functional state updates
  const updateDailyLog = (date: string, updateFn: (log: DailyLog) => DailyLog) => {
    setLogs((prevLogs) => {
      const existingLogIndex = prevLogs.findIndex((l) => l.date === date);
      const existingLog = existingLogIndex >= 0 ? prevLogs[existingLogIndex] : {
        date,
        meals: [],
        workouts: [],
        weight: undefined,
        notes: ''
      };
      const updatedLog = updateFn(existingLog);
      const filtered = prevLogs.filter((l) => l.date !== date);
      return [...filtered, updatedLog];
    });
  };

  // Add meal to selected date
  const handleAddMeal = (newMeal: Omit<Meal, 'id' | 'timestamp'> & { timestamp?: string }) => {
    const rawTimestamp = newMeal.timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const timestamp = formatTime12Hour(rawTimestamp);
    const mealWithMeta: Meal = {
      ...newMeal,
      id: `meal-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp
    };

    updateDailyLog(selectedDate, (log) => ({
      ...log,
      meals: [...log.meals, mealWithMeta]
    }));
  };

  // Remove meal from selected date
  const handleRemoveMeal = (mealId: string) => {
    updateDailyLog(selectedDate, (log) => ({
      ...log,
      meals: log.meals.filter((m) => m.id !== mealId)
    }));
    if (editingMealId === mealId) {
      setEditingMealId(null);
    }
  };

  const startEditingMeal = (meal: Meal) => {
    setEditingMealId(meal.id);
    setEditMealName(meal.name);
    setEditMealProtein(meal.protein.toString());
    setEditMealCalories(meal.calories.toString());
    setEditMealTime(meal.timestamp || '');
  };

  const cancelEditingMeal = () => {
    setEditingMealId(null);
    setEditMealName('');
    setEditMealProtein('');
    setEditMealCalories('');
    setEditMealTime('');
  };

  const saveEditingMeal = (mealId: string) => {
    if (!editMealName.trim()) return;
    const updatedMeal: Meal = {
      id: mealId,
      name: editMealName.trim(),
      protein: Number(editMealProtein) || 0,
      calories: Number(editMealCalories) || 0,
      timestamp: editMealTime ? formatTime12Hour(editMealTime) : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    
    updateDailyLog(selectedDate, (log) => ({
      ...log,
      meals: log.meals.map((m) => (m.id === mealId ? updatedMeal : m))
    }));
    cancelEditingMeal();
  };

  // Add multiple workouts to selected date as a batch
  const handleAddWorkouts = (newWorkouts: Omit<Workout, 'id'>[]) => {
    const workoutsWithIds: Workout[] = newWorkouts.map((w, idx) => ({
      ...w,
      id: `workout-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`
    }));

    updateDailyLog(selectedDate, (log) => ({
      ...log,
      workouts: [...log.workouts, ...workoutsWithIds]
    }));
  };

  // Add workout template to selected date
  const handleAddWorkout = (newWorkout: Omit<Workout, 'id'>) => {
    handleAddWorkouts([newWorkout]);
  };

  // Toggle set completion state
  const handleToggleSet = (workoutId: string, setId: string) => {
    updateDailyLog(selectedDate, (log) => {
      const updatedWorkouts = log.workouts.map((w) => {
        if (w.id !== workoutId) return w;

        const updatedSets = w.sets.map((s) => {
          if (s.id !== setId) return s;
          return { ...s, completed: !s.completed };
        });

        // Workout is fully completed if all sets are completed
        const completed = updatedSets.length > 0 && updatedSets.every((s) => s.completed);

        return {
          ...w,
          sets: updatedSets,
          completed
        };
      });

      return {
        ...log,
        workouts: updatedWorkouts
      };
    });
  };

  // Toggle full workout completion checkmark
  const handleToggleWorkoutCompletion = (workoutId: string) => {
    updateDailyLog(selectedDate, (log) => {
      const updatedWorkouts = log.workouts.map((w) => {
        if (w.id !== workoutId) return w;
        const targetState = !w.completed;
        const updatedSets = w.sets.map((s) => ({ ...s, completed: targetState }));
        return {
          ...w,
          completed: targetState,
          sets: updatedSets
        };
      });

      return {
        ...log,
        workouts: updatedWorkouts
      };
    });
  };

  // Remove full workout
  const handleRemoveWorkout = (workoutId: string) => {
    updateDailyLog(selectedDate, (log) => ({
      ...log,
      workouts: log.workouts.filter((w) => w.id !== workoutId)
    }));
  };

  // Update existing workout on selected date
  const handleUpdateWorkout = (workoutId: string, updatedWorkout: Omit<Workout, 'id'>) => {
    updateDailyLog(selectedDate, (log) => ({
      ...log,
      workouts: log.workouts.map((w) =>
        w.id === workoutId ? { ...updatedWorkout, id: workoutId } : w
      )
    }));
  };

  const handleOpenAddWorkoutForm = () => {
    setEditingWorkoutId(null);
    setWorkoutFormName('');
    setWorkoutFormCategory('Chest');
    setWorkoutFormSets([
      { reps: 10, weight: 30, completed: true },
      { reps: 10, weight: 30, completed: true },
      { reps: 10, weight: 30, completed: true }
    ]);
    setIsAddingWorkoutModal(true);
  };

  const handleOpenEditWorkoutForm = (workout: Workout) => {
    setEditingWorkoutId(workout.id);
    setWorkoutFormName(workout.name);
    setWorkoutFormCategory(workout.category || 'Chest');
    setWorkoutFormSets(
      workout.sets && workout.sets.length > 0
        ? workout.sets.map((s) => ({ reps: s.reps, weight: s.weight, completed: s.completed }))
        : [
            { reps: 10, weight: 30, completed: true },
            { reps: 10, weight: 30, completed: true },
            { reps: 10, weight: 30, completed: true }
          ]
    );
    setIsAddingWorkoutModal(true);
  };

  const handleUpdateFormSetField = (idx: number, field: 'reps' | 'weight' | 'completed', value: any) => {
    setWorkoutFormSets((prev) => prev.map((s, i) => (i === idx ? { ...s, [field]: value } : s)));
  };

  const handleSaveWorkoutForm = () => {
    if (!workoutFormName.trim()) return;

    const setsWithIds: SetLog[] = workoutFormSets.map((s, idx) => ({
      id: `set-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
      reps: Number(s.reps) || 0,
      weight: Number(s.weight) || 0,
      completed: s.completed ?? true
    }));

    const workoutData: Omit<Workout, 'id'> = {
      name: workoutFormName.trim(),
      category: workoutFormCategory,
      sets: setsWithIds,
      completed: true
    };

    if (editingWorkoutId) {
      handleUpdateWorkout(editingWorkoutId, workoutData);
    } else {
      handleAddWorkout(workoutData);
    }

    setIsAddingWorkoutModal(false);
    setEditingWorkoutId(null);
  };

  // Save body weight and height for selected date and goals
  const handleSaveWeightAndHeight = (e: React.FormEvent) => {
    e.preventDefault();
    const weightNum = parseFloat(weightInput);
    const heightNum = parseFloat(heightInput);

    setGoals((prev) => {
      const updated = { ...prev };
      if (!isNaN(weightNum)) updated.currentWeight = weightNum;
      if (!isNaN(heightNum)) updated.currentHeight = heightNum;
      return updated;
    });

    if (!isNaN(weightNum)) {
      updateDailyLog(selectedDate, (log) => ({
        ...log,
        weight: weightNum
      }));
    }
  };

  // Clear all tracking logs to reset data
  const handleResetData = () => {
    requestConfirm(
      'Reset All Application Data',
      'Are you sure you want to reset all workout and nutrition logs, goals, and insights to defaults? This action cannot be undone.',
      () => {
        localStorage.removeItem('hypertrophy_goals');
        localStorage.removeItem('hypertrophy_logs');
        localStorage.removeItem('hypertrophy_insights');
        setGoals(INITIAL_GOALS);
        setLogs(INITIAL_LOGS);
        setInsights(INITIAL_INSIGHTS);
        setSelectedDate(new Date().toISOString().split('T')[0]);
        setActiveTab('dashboard');
      },
      'Reset All Data',
      'danger'
    );
  };

  // Add newly generated custom coaching insight
  const handleAddInsight = (newInsight: CoachingInsight) => {
    setInsights((prev) => [newInsight, ...prev]);
  };

  // Compute stats for current selected date
  const todayProtein = currentLog.meals.reduce((sum, m) => sum + m.protein, 0);
  const todayCalories = currentLog.meals.reduce((sum, m) => sum + m.calories, 0);
  const completedWorkouts = currentLog.workouts.filter((w) => w.completed).length;

  const proteinPercentage = Math.min(100, Math.round((todayProtein / goals.dailyProteinTarget) * 100));
  const caloriePercentage = Math.min(100, Math.round((todayCalories / goals.dailyCalorieTarget) * 100));

  // Determine date label
  const getFriendlyDateLabel = () => {
    const todayStr = new Date().toISOString().split('T')[0];
    const logDateObj = new Date(selectedDate + 'T00:00:00');

    const formattedDate = logDateObj.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });

    if (selectedDate === todayStr) {
      return `Today, ${formattedDate}`;
    }
    return formattedDate;
  };

  if (!googleToken || sessionExpired || isTokenExpired()) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col items-center justify-center p-4 sm:p-6 overflow-y-auto font-sans" id="full-screen-login-gate">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 text-slate-100 my-auto">
          {/* Logo & App Name Header */}
          <div className="flex flex-col items-center text-center space-y-3">
            <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-xl ring-4 ring-indigo-500/20">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" className="w-full h-full">
                <rect width="512" height="512" rx="120" fill="#0f172a"/>
                <circle cx="256" cy="256" r="140" stroke="#4f46e5" strokeWidth="24" fill="none" opacity="0.3" />
                <circle cx="256" cy="256" r="100" stroke="#6366f1" strokeWidth="24" fill="none" strokeDasharray="400" strokeDashoffset="100" strokeLinecap="round" />
                <path d="M 200 256 L 312 256" stroke="#ffffff" strokeWidth="28" strokeLinecap="round" />
                <rect x="176" y="216" width="24" height="80" rx="12" fill="#ffffff" />
                <rect x="312" y="216" width="24" height="80" rx="12" fill="#ffffff" />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-black tracking-tight text-white">Fitness Tracker</h2>
              <p className="text-xs text-indigo-400 font-extrabold uppercase tracking-widest mt-1">Google Workspace Cloud Sync</p>
            </div>
          </div>

          {/* Session Expired / Lock Card */}
          <div className="bg-slate-850 border border-slate-800/80 rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-white">Google Session Expired</h3>
                <p className="text-[11px] text-slate-400 font-semibold">Fresh sign in required to unlock app</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed font-medium">
              To guarantee that your food logs, workout routines, and targets stay 100% synchronized with Google Drive and prevent out-of-sync conflicts across devices, you must sign in with Google to use the app.
            </p>

            <div className="space-y-2 border-t border-slate-800 pt-3 text-xs text-slate-300 font-medium">
              <div className="flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>Real-time automatic saving directly to Google Drive</span>
              </div>
              <div className="flex items-start gap-2">
                <Cloud className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <span>Multi-device parity with zero stale cache conflicts</span>
              </div>
            </div>
          </div>

          {/* Login Action Button */}
          <div className="space-y-3">
            <button
              onClick={handleLoginFromOverlay}
              disabled={isLoggingIn}
              type="button"
              className="w-full py-3.5 px-6 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white font-black text-sm rounded-2xl shadow-lg shadow-indigo-950/60 flex items-center justify-center gap-2.5 transition-all active:scale-95 cursor-pointer"
            >
              {isLoggingIn ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Connecting to Google...</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4 text-indigo-200" />
                  <span>Sign In with Google</span>
                </>
              )}
            </button>

            {loginError && (
              <div className="p-3 bg-rose-950/50 border border-rose-800/80 rounded-xl text-rose-300 text-xs font-semibold leading-relaxed">
                <p className="font-bold text-rose-200">Sign-in Error:</p>
                <p className="mt-0.5">{loginError}</p>
                <p className="mt-1.5 text-[11px] text-rose-400">
                  Note: If using the preview frame, click <strong>"Open in New Tab"</strong> at top right if popup is blocked by preview iframe policy.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans selection:bg-indigo-600 selection:text-white pb-24" id="app-root-view">
      {/* 1. Sticky Navigation Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-6 sm:px-8 py-4.5 flex justify-between items-center shadow-xs">
        <div className="flex items-start gap-4.5">
          <div className="w-12 h-12 rounded-2xl overflow-hidden shadow-md flex-shrink-0 mt-0.5">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" className="w-full h-full">
              <rect width="512" height="512" rx="120" fill="#0f172a"/>
              <circle cx="256" cy="256" r="140" stroke="#4f46e5" strokeWidth="24" fill="none" opacity="0.3" />
              <circle cx="256" cy="256" r="100" stroke="#6366f1" strokeWidth="24" fill="none" strokeDasharray="400" strokeDashoffset="100" strokeLinecap="round" />
              <path d="M 200 256 L 312 256" stroke="#ffffff" strokeWidth="28" strokeLinecap="round" />
              <rect x="176" y="216" width="24" height="80" rx="12" fill="#ffffff" />
              <rect x="312" y="216" width="24" height="80" rx="12" fill="#ffffff" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight leading-none">Fitness Tracker</h1>
            <p className="text-xs text-indigo-600 font-extrabold uppercase tracking-widest mt-1.5">Simple Personal progression & nutrition</p>
          </div>
        </div>

        {/* Hamburger Menu Button with no background on the right */}
        <button
          onClick={() => setIsMenuOpen(true)}
          className="p-3 bg-transparent hover:bg-slate-100 text-slate-700 hover:text-indigo-600 rounded-2xl transition-all cursor-pointer flex items-center justify-center active:scale-95"
          title="Open Menu"
        >
          <Menu className="w-7 h-7 stroke-[2.5]" />
        </button>
      </header>

      {/* Top Banner Indicator for Google Drive Sync */}
      <AnimatePresence>
        {isSyncingDrive && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-indigo-600 text-white text-xs sm:text-sm font-bold py-2.5 px-4 flex items-center justify-center gap-2.5 shadow-md overflow-hidden"
          >
            <Loader2 className="w-4 h-4 animate-spin text-indigo-200 flex-shrink-0" />
            <span>{syncingActionMessage}</span>
          </motion.div>
        )}
        {!isSyncingDrive && syncStatusMessage && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-emerald-600 text-white text-xs sm:text-sm font-bold py-2.5 px-4 flex items-center justify-center gap-2.5 shadow-md overflow-hidden"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-200 flex-shrink-0" />
            <span>{syncStatusMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. Slide-out Drawer Menu overlay */}
      <AnimatePresence>
        {isMenuOpen && (
          <>
            {/* Backdrop Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMenuOpen(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-45"
            />

            {/* Sidebar Slide-out Panel */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="fixed inset-y-0 right-0 w-80 bg-white border-l border-slate-200 shadow-2xl z-50 flex flex-col justify-between"
            >
              <div>
                {/* Menu Header with Logo, Name & Close Button */}
                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl overflow-hidden shadow-md flex-shrink-0">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" className="w-full h-full">
                        <rect width="512" height="512" rx="120" fill="#0f172a"/>
                        <circle cx="256" cy="256" r="140" stroke="#4f46e5" strokeWidth="24" fill="none" opacity="0.3" />
                        <circle cx="256" cy="256" r="100" stroke="#6366f1" strokeWidth="24" fill="none" strokeDasharray="400" strokeDashoffset="100" strokeLinecap="round" />
                        <path d="M 200 256 L 312 256" stroke="#ffffff" strokeWidth="28" strokeLinecap="round" />
                        <rect x="176" y="216" width="24" height="80" rx="12" fill="#ffffff" />
                        <rect x="312" y="216" width="24" height="80" rx="12" fill="#ffffff" />
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-lg font-black text-slate-900 tracking-tight leading-none">Fitness Tracker</h2>
                      <p className="text-[10px] text-indigo-600 font-extrabold uppercase tracking-widest mt-1">Personal Dashboard</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsMenuOpen(false)}
                    className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                {/* Navigation Menu Links */}
                <nav className="p-4 space-y-2">
                  {[
                    { id: 'nutrition', label: 'Log Food', desc: 'Track daily meals and proteins' },
                    { id: 'workouts', label: 'Daily Workout', desc: 'Log exercises and routines' },
                    { id: 'analytics', label: 'Analytics & Records', desc: 'Progress graphs & consistency calendar' },
                    { id: 'coach', label: 'AI Coach', desc: 'Personalized hypertrophy & diet advice' },
                    { id: 'settings', label: 'Settings', desc: 'Target goals and unit preferences' },
                    { id: 'workspace', label: 'Google Sync', desc: 'Import and export with Google Docs' }
                  ].map((item) => {
                    const isActive = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          setActiveTab(item.id as any);
                          setIsMenuOpen(false);
                        }}
                        className={`w-full text-left p-4 rounded-2xl transition-all flex flex-col gap-1 cursor-pointer ${
                          isActive
                            ? 'bg-indigo-50/85 border border-indigo-150 text-indigo-600 font-bold shadow-xs'
                            : 'border border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50/70'
                        }`}
                      >
                        <span className="text-base font-black">{item.label}</span>
                        <span className={`text-xs ${isActive ? 'text-indigo-400 font-medium' : 'text-slate-400'}`}>{item.desc}</span>
                      </button>
                    );
                  })}
                </nav>
              </div>

              {/* Menu Footer with targets/profile summary */}
              <div className="p-6 border-t border-slate-100 bg-slate-50/50 space-y-4">
                <div className="space-y-2">
                  <span className="text-[9px] text-slate-400 uppercase tracking-widest font-black block">Fitness Targets</span>
                  <div className="grid grid-cols-3 gap-1.5">
                    <div className="bg-white border border-slate-200/60 p-2 rounded-xl text-center">
                      <span className="text-[8px] text-slate-400 font-bold block leading-tight">Weight Goal</span>
                      <span className="text-[11px] font-black text-indigo-600 font-mono mt-0.5 block">{goals.targetWeight}{goals.weightUnit}</span>
                    </div>
                    <div className="bg-white border border-slate-200/60 p-2 rounded-xl text-center">
                      <span className="text-[8px] text-slate-400 font-bold block leading-tight">Height</span>
                      <span className="text-[11px] font-black text-violet-600 font-mono mt-0.5 block">{goals.currentHeight || 178}cm</span>
                    </div>
                    <div className="bg-white border border-slate-200/60 p-2 rounded-xl text-center">
                      <span className="text-[8px] text-slate-400 font-bold block leading-tight">Protein Goal</span>
                      <span className="text-[11px] font-black text-emerald-600 font-mono mt-0.5 block">{goals.dailyProteinTarget}g</span>
                    </div>
                  </div>
                </div>

                <div className="text-[10px] text-slate-400 font-semibold flex items-center justify-between border-t border-slate-100 pt-3">
                  <span>Sync status:</span>
                  <span className="font-bold text-indigo-500 font-mono">{goals.lastSyncTime ? 'Synced' : 'Not configured'}</span>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main Spacious Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        
        {/* Unified Active Day Context & Date Picker (Visible only in Log Area) */}
        {(activeTab === 'nutrition' || activeTab === 'workouts') && (
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs flex items-center justify-between gap-4" id="global-metrics-bar">
            {/* Active Day selection */}
            <div className="flex items-center gap-4">
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl shrink-0">
                <Calendar className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <span className="text-[10px] text-slate-400 uppercase tracking-widest font-black block">Active Logging Day</span>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="text-lg font-black text-slate-900 bg-transparent border-b-2 border-dashed border-indigo-200 hover:border-indigo-400 focus:border-indigo-500 focus:outline-none focus:ring-0 pb-1 cursor-pointer font-mono transition-colors"
                  id="global-date-selector"
                />
                <p className="text-[11px] text-slate-500 font-medium">Changing the date will update logs and graphs below.</p>
              </div>
            </div>
          </div>
        )}

        {/* Tab Router Switch */}
        <div className="transition-all duration-300">
          
          {/* TAB 1: LOG FOOD */}
          {activeTab === 'nutrition' && (
            <div className="space-y-6" id="nutrition-view-panel">
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
                
                {/* Left/Main Form and Preset Guide Grid */}
                <div className="xl:col-span-8">
                  <MealLogger
                    onAddMeal={handleAddMeal}
                    timestamp={mealTimeInput}
                    setTimestamp={setMealTimeInput}
                  />
                </div>

                {/* Right Panel: Daily Logs History List */}
                <div className="xl:col-span-4 bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                    <h3 className="text-sm font-black text-slate-800">Eaten Today</h3>
                    <span className="text-xs font-mono font-bold text-slate-400">{currentLog.meals.length} items logged</span>
                  </div>

                  {currentLog.meals.length > 0 ? (
                    <div className="space-y-2.5 max-h-[480px] overflow-y-auto pr-1" id="logged-meals-list">
                      {currentLog.meals.map((meal) => {
                        if (editingMealId === meal.id) {
                          return (
                            <div key={meal.id} className="p-3.5 bg-indigo-50/70 border border-indigo-200 rounded-2xl space-y-3 shadow-xs">
                              <div className="flex items-center justify-between border-b border-indigo-100 pb-2">
                                <span className="text-[10px] font-black uppercase text-indigo-700 tracking-wider">Edit Food Item</span>
                                <button
                                  type="button"
                                  onClick={cancelEditingMeal}
                                  className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-white transition-colors cursor-pointer"
                                  title="Cancel"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                              <div className="space-y-2">
                                <div>
                                  <label className="text-[9px] font-black text-slate-500 block mb-0.5">Name</label>
                                  <input
                                    type="text"
                                    value={editMealName}
                                    onChange={(e) => setEditMealName(e.target.value)}
                                    placeholder="Food Name"
                                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
                                  />
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                  <div>
                                    <label className="text-[9px] font-black text-slate-500 block mb-0.5">Protein (g)</label>
                                    <input
                                      type="number"
                                      value={editMealProtein}
                                      onChange={(e) => setEditMealProtein(e.target.value)}
                                      className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[9px] font-black text-slate-500 block mb-0.5">Calories (kcal)</label>
                                    <input
                                      type="number"
                                      value={editMealCalories}
                                      onChange={(e) => setEditMealCalories(e.target.value)}
                                      className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[9px] font-black text-slate-500 block mb-0.5">Time</label>
                                    <input
                                      type="text"
                                      value={editMealTime}
                                      onChange={(e) => setEditMealTime(e.target.value)}
                                      placeholder="e.g. 08:30"
                                      className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
                                    />
                                  </div>
                                </div>
                              </div>
                              <div className="flex justify-end gap-2 pt-1 border-t border-indigo-100">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveMeal(meal.id)}
                                  className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 font-black text-[10px] rounded-lg border border-rose-200 transition-colors flex items-center gap-1 cursor-pointer"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  Delete
                                </button>
                                <button
                                  type="button"
                                  onClick={() => saveEditingMeal(meal.id)}
                                  className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[10px] rounded-lg transition-colors flex items-center gap-1 cursor-pointer shadow-xs"
                                >
                                  <Check className="w-3 h-3" />
                                  Save
                                </button>
                              </div>
                            </div>
                          );
                        }

                        return (
                          <div
                            key={meal.id}
                            className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-xl hover:border-slate-300 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-[10px] text-slate-400 font-bold font-mono bg-white px-2 py-1 rounded-lg border border-slate-150">
                                {meal.timestamp}
                              </span>
                              <div>
                                <h4 className="text-xs font-bold text-slate-800 leading-tight">{meal.name}</h4>
                                <div className="flex gap-2.5 mt-1">
                                  <span className="text-[10px] text-emerald-600 font-black">{meal.protein}g protein</span>
                                  <span className="text-[10px] text-slate-400 font-bold font-mono">• {meal.calories} kcal</span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => startEditingMeal(meal)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                                title="Edit Meal"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleRemoveMeal(meal.id)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                title="Delete Meal"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="py-12 text-center text-slate-400">
                      <Flame className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                      <p className="text-xs font-bold">No meals recorded yet.</p>
                      <p className="text-[10px] text-slate-400 mt-1">Use the manual form to add meals.</p>
                    </div>
                  )}
                </div>

              </div>
            </div>
          )}

          {/* TAB 2: DAILY WORKOUT */}
          {activeTab === 'workouts' && (
            <div className="space-y-6" id="workouts-view-panel">
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
                
                {/* Workout Guide and Player Panel */}
                <div className="xl:col-span-8">
                  <WorkoutLogger
                    onAddWorkout={handleAddWorkout}
                    onAddWorkouts={handleAddWorkouts}
                    weightUnit={goals.weightUnit}
                    selectedDate={selectedDate}
                    logs={logs}
                    parsedWorkouts={parsedWorkouts}
                    onUpdateParsedWorkouts={setParsedWorkouts}
                  />
                </div>

                {/* Workout Logs List panel */}
                <div className="xl:col-span-4 bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                    <div>
                      <h3 className="text-sm font-black text-slate-800">
                        {selectedDate === new Date().toISOString().split('T')[0] ? 'Exercises Today' : `Exercises (${selectedDate})`}
                      </h3>
                      <span className="text-[10px] text-slate-400 font-bold font-mono">{currentLog.workouts.length} logged</span>
                    </div>
                    <button
                      onClick={handleOpenAddWorkoutForm}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shadow-xs"
                      title="Add Lift for selected date"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Lift
                    </button>
                  </div>

                  {/* Manual Workout Form (Add or Edit) */}
                  {isAddingWorkoutModal && (
                    <div className="p-4 bg-indigo-50/80 border border-indigo-200 rounded-2xl space-y-3.5">
                      <div className="flex justify-between items-center">
                        <h4 className="text-xs font-black text-indigo-950 uppercase tracking-wider">
                          {editingWorkoutId ? 'Edit Logged Exercise' : `Add Exercise for ${selectedDate}`}
                        </h4>
                        <button
                          onClick={() => {
                            setIsAddingWorkoutModal(false);
                            setEditingWorkoutId(null);
                          }}
                          className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="space-y-2.5">
                        <div>
                          <label className="block text-[10px] font-black text-slate-600 uppercase mb-1">
                            Exercise Name
                          </label>
                          <input
                            type="text"
                            value={workoutFormName}
                            onChange={(e) => setWorkoutFormName(e.target.value)}
                            placeholder="e.g. Incline Dumbbell Press"
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            autoFocus
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-black text-slate-600 uppercase mb-1">
                            Category
                          </label>
                          <select
                            value={workoutFormCategory}
                            onChange={(e) => setWorkoutFormCategory(e.target.value as any)}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                          >
                            {['Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core', 'Cardio'].map((cat) => (
                              <option key={cat} value={cat}>
                                {cat}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Sets Editor */}
                        <div className="space-y-2 pt-1">
                          <div className="flex justify-between items-center">
                            <label className="block text-[10px] font-black text-slate-600 uppercase">
                              Working Sets ({workoutFormSets.length})
                            </label>
                            <button
                              type="button"
                              onClick={() =>
                                setWorkoutFormSets((prev) => [
                                  ...prev,
                                  { reps: 10, weight: prev[prev.length - 1]?.weight || 30, completed: true }
                                ])
                              }
                              className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                            >
                              <Plus className="w-3 h-3" /> Add Set
                            </button>
                          </div>

                          <div className="space-y-1.5 max-h-[180px] overflow-y-auto pr-1">
                            {workoutFormSets.map((set, sIdx) => (
                              <div key={sIdx} className="flex items-center gap-2 bg-white p-2 rounded-xl border border-slate-200">
                                <span className="text-[10px] font-mono font-bold text-slate-400 w-10">Set {sIdx + 1}</span>
                                <div className="flex-1 grid grid-cols-2 gap-2">
                                  <div className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-lg border border-slate-200">
                                    <input
                                      type="number"
                                      value={set.weight}
                                      onChange={(e) => handleUpdateFormSetField(sIdx, 'weight', parseFloat(e.target.value) || 0)}
                                      className="w-full text-xs font-bold text-slate-800 focus:outline-none"
                                    />
                                    <span className="text-[9px] font-bold text-slate-400 uppercase">{goals.weightUnit}</span>
                                  </div>
                                  <div className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-lg border border-slate-200">
                                    <input
                                      type="number"
                                      value={set.reps}
                                      onChange={(e) => handleUpdateFormSetField(sIdx, 'reps', parseInt(e.target.value, 10) || 0)}
                                      className="w-full text-xs font-bold text-slate-800 focus:outline-none"
                                    />
                                    <span className="text-[9px] font-bold text-slate-400 uppercase">reps</span>
                                  </div>
                                </div>
                                {workoutFormSets.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => setWorkoutFormSets((prev) => prev.filter((_, i) => i !== sIdx))}
                                    className="p-1 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                                    title="Remove Set"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setIsAddingWorkoutModal(false);
                            setEditingWorkoutId(null);
                          }}
                          className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 font-bold text-xs rounded-xl cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveWorkoutForm}
                          disabled={!workoutFormName.trim()}
                          className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
                        >
                          {editingWorkoutId ? 'Save Changes' : 'Add Exercise'}
                        </button>
                      </div>
                    </div>
                  )}

                  {currentLog.workouts.length > 0 ? (
                    <div className="space-y-3.5 max-h-[480px] overflow-y-auto pr-1" id="logged-workouts-list">
                      {currentLog.workouts.map((workout) => (
                        <div
                          key={workout.id}
                          className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl hover:border-slate-300 transition-colors space-y-2"
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <span className="text-[9px] uppercase font-black px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-150">
                                {workout.category}
                              </span>
                              <h4 className="text-xs font-bold text-slate-800 mt-1 leading-snug">{workout.name}</h4>
                            </div>

                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleOpenEditWorkoutForm(workout)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                                title="Edit Exercise"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleRemoveWorkout(workout.id)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                title="Delete Lift"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Sets summary */}
                          <div className="grid grid-cols-3 gap-1 pt-1.5 border-t border-slate-200/50">
                            {workout.sets.map((set, setIdx) => (
                              <div key={set.id} className="text-center bg-white border border-slate-150 py-1.5 px-1 rounded-lg">
                                <span className="text-[8px] text-slate-400 font-black uppercase font-mono block">Set {setIdx + 1}</span>
                                <span className="text-[10px] font-bold font-mono text-slate-700">
                                  {set.weight > 0 ? `${set.weight}${goals.weightUnit}` : 'BW'} × {set.reps}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-12 text-center text-slate-400">
                      <Dumbbell className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                      <p className="text-xs font-bold">
                        {selectedDate === new Date().toISOString().split('T')[0]
                          ? 'No exercises recorded today.'
                          : `No exercises recorded for ${selectedDate}.`}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-1">
                        Click "+ Add Lift" above to manually log exercises for this date.
                      </p>
                    </div>
                  )}
                </div>

              </div>
            </div>
          )}

          {/* TAB 3: ANALYTICS & RECORDS */}
          {activeTab === 'analytics' && (
            <div className="space-y-6" id="analytics-master-panel">

              {/* Global Budgets Overview Widgets */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4" id="budgets-overview-bar">
                
                {/* Protein budget status card */}
                <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-between shadow-xs">
                  <div className="flex items-center gap-3.5">
                    <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
                      <Flame className="w-5 h-5 text-emerald-500" />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider block">Today's Protein</span>
                      <span className="text-sm font-black text-slate-800 font-mono mt-0.5 block">{todayProtein}g / {goals.dailyProteinTarget}g</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-black font-mono text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">
                      {proteinPercentage}%
                    </span>
                  </div>
                </div>

                {/* Calories widget */}
                <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-between shadow-xs">
                  <div className="flex items-center gap-3.5">
                    <div className="p-2.5 bg-sky-50 text-sky-600 rounded-xl">
                      <Flame className="w-5 h-5 text-sky-600" />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider block">Calorie Surplus</span>
                      <span className="text-sm font-black text-slate-800 font-mono mt-0.5 block">{todayCalories} / {goals.dailyCalorieTarget} kcal</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-black font-mono text-sky-600 bg-sky-50 px-2 py-1 rounded-lg">
                      {caloriePercentage}%
                    </span>
                  </div>
                </div>

                {/* Workout completed exercises widget */}
                <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-between shadow-xs">
                  <div className="flex items-center gap-3.5">
                    <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                      <Dumbbell className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider block">Completed Exercises</span>
                      <span className="text-sm font-black text-slate-800 mt-0.5 block">
                        {completedWorkouts} / {currentLog.workouts.length} Lifts Today
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-black font-mono text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg">
                      {currentLog.workouts.length > 0 ? Math.round((completedWorkouts / currentLog.workouts.length) * 100) : 0}%
                    </span>
                  </div>
                </div>

              </div>

              {/* Inner Tabs Selector - 2 Tabs splitting full width */}
              <div className="grid grid-cols-2 border-b border-slate-200 gap-2 pb-0.5 w-full">
                {[
                  { id: 'graphs', label: 'Progress Graphs' },
                  { id: 'calendar', label: 'Consistency Calendar' }
                ].map((subTab) => (
                  <button
                    key={subTab.id}
                    onClick={() => setAnalyticsSubTab(subTab.id as any)}
                    className={`w-full text-center px-4 py-2.5 rounded-t-xl text-xs sm:text-sm font-black whitespace-nowrap transition-all cursor-pointer border-b-2 ${
                      analyticsSubTab === subTab.id
                        ? 'border-indigo-600 text-indigo-600 font-black'
                        : 'border-transparent text-slate-400 hover:text-slate-700'
                    }`}
                  >
                    {subTab.label}
                  </button>
                ))}
              </div>

              {/* Inner Tab Panels */}
              <div className="transition-all duration-200">
                
                {analyticsSubTab === 'graphs' && (
                  <div className="space-y-6">
                    <div className="mb-4">
                      <h3 className="text-base font-black text-slate-900">Performance Over Time</h3>
                      <p className="text-slate-400 text-xs mt-1">Review protein, calories, lean muscle metrics, and weight gains</p>
                    </div>
                    <Analytics logs={logs} goals={goals} />
                  </div>
                )}

                {analyticsSubTab === 'calendar' && (
                  <div className="space-y-6">
                    <div className="mb-4">
                      <h3 className="text-base font-black text-slate-900">Consistency Calendar Records</h3>
                      <p className="text-slate-400 text-xs mt-1">Tap any date to log foods or exercises for that past day</p>
                    </div>
                    <CalendarView
                      logs={logs}
                      goals={goals}
                      selectedDate={selectedDate}
                      onSelectDate={(date) => {
                        setSelectedDate(date);
                        setActiveTab('workouts'); // Bring to workout & exercise logging view for selected date!
                      }}
                    />
                  </div>
                )}

              </div>

            </div>
          )}

          {/* TAB 4: AI COACH */}
          {activeTab === 'coach' && (
            <div className="space-y-6 animate-fade-in" id="coach-view-panel">
              <div className="mb-4">
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-indigo-500" />
                  AI Coach Advice Insights
                </h3>
                <p className="text-slate-400 text-xs mt-1">Generates hypertrophy and caloric timing summaries from your daily metrics</p>
              </div>
              <CoachInsights
                insights={insights}
                logs={logs}
                goals={goals}
                onAddInsight={handleAddInsight}
              />
            </div>
          )}

          {/* TAB 5: SETTINGS */}
          {activeTab === 'settings' && (
            <div className="space-y-6 animate-fade-in" id="settings-view-panel">
              <div className="mb-4">
                <h3 className="text-base font-black text-slate-900">Anabolic Target Settings</h3>
                <p className="text-slate-400 text-xs mt-1">Change your targets, daily protein thresholds, and weight units</p>
              </div>
              <div className="max-w-2xl space-y-6">
                <GoalsConfig goals={goals} onUpdateGoals={setGoals} />
                
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                  <h4 className="text-xs font-black text-rose-500 uppercase tracking-widest mb-2.5">Data Reset Center</h4>
                  <button
                    onClick={handleResetData}
                    className="w-full py-3.5 border border-rose-200 hover:bg-rose-50 hover:border-rose-300 text-rose-600 font-bold text-xs rounded-xl transition-all cursor-pointer text-center"
                  >
                    Reset App Storage Data
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: GOOGLE WORKSPACE SYNC */}
          {activeTab === 'workspace' && (
            <div className="space-y-6 animate-fade-in" id="workspace-view-panel">
              <div className="mb-4">
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <Cloud className="w-5 h-5 text-indigo-500" />
                  Google Docs & Drive Sync Hub
                </h3>
                <p className="text-slate-400 text-xs mt-1">Configure target document IDs, back up application data, and fetch custom meal or exercise plans directly from Google Docs.</p>
              </div>
              <WorkspaceHub
                goals={goals}
                logs={logs}
                insights={insights}
                onUpdateGoals={setGoals}
                onUpdateLogs={setLogs}
                onUpdateInsights={setInsights}
                onLogMeal={handleAddMeal}
                onLogWorkout={handleAddWorkout}
                parsedFoods={parsedFoods}
                parsedWorkouts={parsedWorkouts}
                onUpdateParsedFoods={setParsedFoods}
                onUpdateParsedWorkouts={setParsedWorkouts}
              />
            </div>
          )}

        </div>

      </main>

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
