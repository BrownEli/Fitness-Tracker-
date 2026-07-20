import React, { useState, useEffect, useRef } from 'react';
import { DailyLog, UserGoals, CoachingInsight, Meal, Workout } from './types';
import { INITIAL_GOALS, INITIAL_LOGS, INITIAL_INSIGHTS } from './data';
import MealLogger from './components/MealLogger';
import WorkoutLogger from './components/WorkoutLogger';
import Analytics from './components/Analytics';
import CalendarView from './components/CalendarView';
import CoachInsights from './components/CoachInsights';
import GoalsConfig from './components/GoalsConfig';
import WorkspaceHub from './components/WorkspaceHub';
import { auth, initAuth, getAccessToken, isTokenExpired, googleSignIn } from './lib/googleAuth';
import { backupDataToDrive, extractFolderId, fetchGoogleDocText, parseFoodsFromText, parseWorkoutsFromText } from './lib/googleApi';

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
  X
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
  // Navigation Tabs state: Expanded to separate Nutrition, Workouts, and Workspace Hubs
  const [activeTab, setActiveTab] = useState<
    'dashboard' | 'nutrition' | 'workouts' | 'workspace' | 'analytics' | 'coach' | 'calendar' | 'goals'
  >('nutrition');

  // Sub-tabs state inside the unified Analytics & Records section
  const [analyticsSubTab, setAnalyticsSubTab] = useState<'graphs' | 'calendar' | 'coach' | 'settings'>('graphs');

  // Hamburger drawer open/close state
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Track if we have already auto-synced upon opening the app
  const hasSyncedOnOpen = useRef(false);


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
  const [parsedWorkouts, setParsedWorkouts] = useState<Omit<Workout, 'id'>[]>(() => {
    try {
      const saved = localStorage.getItem('hypertrophy_parsed_workouts');
      return saved ? JSON.parse(saved) : [];
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

  // Authentication & session expiration states
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);

  // State to manage entering today's bodyweight and height
  const [weightInput, setWeightInput] = useState('');
  const [heightInput, setHeightInput] = useState(() => (goals.currentHeight || 178).toString());

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

  // Automatic Backup and Sync to Google Drive & connected Docs upon opening the app
  useEffect(() => {
    const triggerAutoSyncOnOpen = async () => {
      if (hasSyncedOnOpen.current) return;

      const accessToken = getAccessToken();
      if (!accessToken) return;

      if (isTokenExpired()) {
        console.log('Skipping background auto-sync on load: Google Access Token is expired.');
        return;
      }

      hasSyncedOnOpen.current = true;
      console.log('Initiating auto-sync on app open...');
      try {
        const payload = {
          goals,
          logs,
          insights,
          backupVersion: '1.0',
          exportedAt: new Date().toISOString()
        };
        const folderId = goals.driveFolderLink ? extractFolderId(goals.driveFolderLink) : undefined;
        await backupDataToDrive(payload, accessToken, folderId);

        // Automatically sync connected Google Docs if preference enabled
        if (goals.syncDocsOnBackup) {
          console.log('Syncing connected Google Docs during auto-sync...');
          if (goals.foodsDocId) {
            try {
              const text = await fetchGoogleDocText(goals.foodsDocId, accessToken);
              const foods = parseFoodsFromText(text);
              setParsedFoods(foods);
            } catch (foodsErr) {
              console.error('Failed to auto-sync foods doc:', foodsErr);
            }
          }
          if (goals.workoutsDocId) {
            try {
              const text = await fetchGoogleDocText(goals.workoutsDocId, accessToken);
              const workouts = parseWorkoutsFromText(text);
              setParsedWorkouts(workouts);
            } catch (workoutsErr) {
              console.error('Failed to auto-sync workouts doc:', workoutsErr);
            }
          }
        }

        const nowStr = new Date().toLocaleString();
        setGoals((prev) => ({
          ...prev,
          lastSyncTime: nowStr
        }));
        console.log('Auto-sync on app open successful:', nowStr);
      } catch (err) {
        console.error('Auto-sync on app open failed:', err);
      }
    };

    // Listen to Google Auth status changes to trigger sync
    const unsubscribe = initAuth(
      (user, activeToken) => {
        setGoogleToken(activeToken);
        setSessionExpired(isTokenExpired());
        // Silently wait then run auto check
        setTimeout(triggerAutoSyncOnOpen, 3000);
      },
      () => {
        setGoogleToken(null);
        setSessionExpired(false);
      }
    );
    return () => unsubscribe();
  }, [goals.foodsDocId, goals.workoutsDocId, goals.syncDocsOnBackup, goals.driveFolderLink, logs, insights]);

  // Monitor Google Access Token Expiration globally
  useEffect(() => {
    if (googleToken) {
      setSessionExpired(isTokenExpired());
      const interval = setInterval(() => {
        setSessionExpired(isTokenExpired());
      }, 30000); // Check every 30 seconds
      return () => clearInterval(interval);
    } else {
      setSessionExpired(false);
    }
  }, [googleToken]);

  // Renew secure Google session
  const handleRenewSession = async () => {
    try {
      const result = await googleSignIn();
      if (result) {
        setGoogleToken(result.accessToken);
        setSessionExpired(false);
      }
    } catch (err) {
      console.error('Failed to renew session from global banner:', err);
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

  // Helper to update logs safely
  const saveDailyLog = (updatedLog: DailyLog) => {
    setLogs((prev) => {
      const filtered = prev.filter((l) => l.date !== updatedLog.date);
      return [...filtered, updatedLog];
    });
  };

  // Add meal to selected date
  const handleAddMeal = (newMeal: Omit<Meal, 'id' | 'timestamp'> & { timestamp?: string }) => {
    const rawTimestamp = newMeal.timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const timestamp = formatTime12Hour(rawTimestamp);
    const mealWithMeta: Meal = {
      ...newMeal,
      id: `meal-${Date.now()}`,
      timestamp
    };

    const updatedLog: DailyLog = {
      ...currentLog,
      meals: [...currentLog.meals, mealWithMeta]
    };

    saveDailyLog(updatedLog);
  };

  // Remove meal from selected date
  const handleRemoveMeal = (mealId: string) => {
    const updatedLog: DailyLog = {
      ...currentLog,
      meals: currentLog.meals.filter((m) => m.id !== mealId)
    };
    saveDailyLog(updatedLog);
  };

  // Add workout template to selected date
  const handleAddWorkout = (newWorkout: Omit<Workout, 'id'>) => {
    const workoutWithId: Workout = {
      ...newWorkout,
      id: `workout-${Date.now()}`
    };

    const updatedLog: DailyLog = {
      ...currentLog,
      workouts: [...currentLog.workouts, workoutWithId]
    };

    saveDailyLog(updatedLog);
  };

  // Toggle set completion state
  const handleToggleSet = (workoutId: string, setId: string) => {
    const updatedWorkouts = currentLog.workouts.map((w) => {
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

    const updatedLog: DailyLog = {
      ...currentLog,
      workouts: updatedWorkouts
    };

    saveDailyLog(updatedLog);
  };

  // Toggle full workout completion checkmark
  const handleToggleWorkoutCompletion = (workoutId: string) => {
    const updatedWorkouts = currentLog.workouts.map((w) => {
      if (w.id !== workoutId) return w;
      const targetState = !w.completed;
      const updatedSets = w.sets.map((s) => ({ ...s, completed: targetState }));
      return {
        ...w,
        completed: targetState,
        sets: updatedSets
      };
    });

    const updatedLog: DailyLog = {
      ...currentLog,
      workouts: updatedWorkouts
    };

    saveDailyLog(updatedLog);
  };

  // Remove full workout
  const handleRemoveWorkout = (workoutId: string) => {
    const updatedLog: DailyLog = {
      ...currentLog,
      workouts: currentLog.workouts.filter((w) => w.id !== workoutId)
    };
    saveDailyLog(updatedLog);
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
      const updatedLog: DailyLog = {
        ...currentLog,
        weight: weightNum
      };
      saveDailyLog(updatedLog);
    }
  };

  // Clear all tracking logs to reset data
  const handleResetData = () => {
    if (window.confirm('Are you sure you want to reset all workout and nutrition logs to defaults?')) {
      localStorage.removeItem('hypertrophy_goals');
      localStorage.removeItem('hypertrophy_logs');
      localStorage.removeItem('hypertrophy_insights');
      setGoals(INITIAL_GOALS);
      setLogs(INITIAL_LOGS);
      setInsights(INITIAL_INSIGHTS);
      setSelectedDate(new Date().toISOString().split('T')[0]);
      setActiveTab('dashboard');
    }
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
                    { id: 'nutrition', label: '🍽️ Log Food', desc: 'Track daily meals and proteins' },
                    { id: 'workouts', label: '🏋️ Daily Workout', desc: 'Log exercises and routines' },
                    { id: 'analytics', label: '📊 Analytics & Records', desc: 'View progress and calendar' },
                    { id: 'workspace', label: '🌐 Google Sync', desc: 'Import and export with Google Docs' }
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
        
        {/* Global Google Session Expiration Warning */}
        {sessionExpired && (
          <div className="bg-amber-50 border border-amber-200 text-amber-900 px-6 py-5 rounded-3xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-sm animate-fade-in" id="global-session-expired-banner">
            <div>
              <h4 className="text-base font-black flex items-center gap-2 text-amber-800">
                <span className="inline-flex items-center justify-center w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
                Google Session Expired
              </h4>
              <p className="text-xs text-amber-700 font-semibold mt-1 max-w-2xl leading-relaxed">
                Your secure Google Workspace access session has expired. Click renew to keep syncing your foods list and workout plans seamlessly from Google Docs.
              </p>
            </div>
            <button
              onClick={handleRenewSession}
              type="button"
              className="w-full sm:w-auto px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-black rounded-xl transition-all shadow-md hover:shadow-lg active:scale-95 cursor-pointer shrink-0 text-center"
            >
              Renew Session Now
            </button>
          </div>
        )}
        
        {/* Unified Active Day context, Date Picker & Today's Body Metrics (Visible only in Log Area) */}
        {(activeTab === 'nutrition' || activeTab === 'workouts') && (
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs flex flex-col md:flex-row justify-between gap-6" id="global-metrics-bar">
            {/* Left: Active Day selection */}
            <div className="flex items-start gap-4">
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

            {/* Right: Weight & Height Quick-Form */}
            <form onSubmit={handleSaveWeightAndHeight} className="flex flex-col gap-4 w-full md:w-80">
              <div className="border-b border-slate-100 pb-2">
                <span className="text-[10px] text-slate-400 uppercase tracking-widest font-black block">Log Metrics today</span>
              </div>
              {/* Weight Line */}
              <div className="flex flex-col gap-1.5 w-full">
                <label className="text-xs text-slate-600 font-bold flex items-center gap-1.5">
                  <Weight className="w-4 h-4 text-indigo-500" />
                  <span>Body Weight</span>
                </label>
                <div className="relative w-full flex items-center">
                  <input
                    type="number"
                    step="0.1"
                    placeholder={goals.currentWeight.toString()}
                    value={weightInput}
                    onChange={(e) => setWeightInput(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 py-2.5 px-4 pr-14 text-sm font-bold text-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 focus:bg-white font-mono"
                    id="global-weight-input"
                  />
                  <span className="absolute right-4 text-xs text-slate-400 font-mono font-black uppercase">{goals.weightUnit}</span>
                </div>
              </div>

              {/* Height Line */}
              <div className="flex flex-col gap-1.5 w-full">
                <label className="text-xs text-slate-600 font-bold flex items-center gap-1.5">
                  <span className="text-sm">📏</span>
                  <span>Current Height</span>
                </label>
                <div className="relative w-full flex items-center">
                  <input
                    type="number"
                    step="1"
                    placeholder={(goals.currentHeight || 178).toString()}
                    value={heightInput}
                    onChange={(e) => setHeightInput(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 py-2.5 px-4 pr-14 text-sm font-bold text-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 focus:bg-white font-mono"
                    id="global-height-input"
                  />
                  <span className="absolute right-4 text-xs text-slate-400 font-mono font-black uppercase font-bold">cm</span>
                </div>
              </div>

              {/* Save Button Underneath */}
              <button
                type="submit"
                className="w-full py-2.5 text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 shadow-sm shadow-indigo-150"
                id="global-save-metrics-btn"
              >
                <span>Save Today's Metrics</span>
              </button>
            </form>
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
                      {currentLog.meals.map((meal) => (
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

                          <button
                            onClick={() => handleRemoveMeal(meal.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Delete Meal"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-12 text-center text-slate-400">
                      <Flame className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                      <p className="text-xs font-bold">No meals recorded yet.</p>
                      <p className="text-[10px] text-slate-400 mt-1">Use the quick presets or manual form to add meals.</p>
                    </div>
                  )}
                </div>

              </div>

              {/* Connected Google Doc: Click to Log food list */}
              {parsedFoods.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xs space-y-4">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                    <h4 className="text-sm font-black text-slate-800 flex items-center gap-2">
                      <FileText className="w-4.5 h-4.5 text-indigo-500" />
                      Foods Extracted from your Google Doc
                    </h4>
                    <span className="text-[10px] font-black uppercase text-slate-400 bg-slate-100 px-2 py-1 rounded-md">Click to Log Item</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {parsedFoods.map((meal, idx) => (
                      <button
                        key={`doc-meal-${idx}`}
                        onClick={() => handleAddMeal({ ...meal, timestamp: mealTimeInput })}
                        className="p-3.5 bg-slate-50 hover:bg-emerald-55/20 border border-slate-200 hover:border-emerald-500/20 rounded-2xl transition-all cursor-pointer flex justify-between items-center text-left"
                      >
                        <div>
                          <h5 className="text-xs font-bold text-slate-800">{meal.name}</h5>
                          <p className="text-[10px] text-emerald-600 font-black mt-1">
                            {meal.protein}g Protein • <span className="text-slate-400 font-bold">{meal.calories} kcal</span>
                          </p>
                        </div>
                        <PlusCircle className="w-4.5 h-4.5 text-slate-400 hover:text-emerald-600 transition-colors" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: DAILY WORKOUT */}
          {activeTab === 'workouts' && (
            <div className="space-y-6" id="workouts-view-panel">
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
                
                {/* Workout Guide and Player Panel */}
                <div className="xl:col-span-8">
                  <WorkoutLogger onAddWorkout={handleAddWorkout} weightUnit={goals.weightUnit} selectedDate={selectedDate} logs={logs} parsedWorkouts={parsedWorkouts} />
                </div>

                {/* Workout Logs List panel */}
                <div className="xl:col-span-4 bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                    <h3 className="text-sm font-black text-slate-800">Exercises Today</h3>
                    <span className="text-xs font-mono font-bold text-slate-400">{currentLog.workouts.length} logged</span>
                  </div>

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

                            <button
                              onClick={() => handleRemoveWorkout(workout.id)}
                              className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                              title="Delete Lift"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
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
                      <p className="text-xs font-bold">No exercises recorded today.</p>
                      <p className="text-[10px] text-slate-400 mt-1">Select your Day routine and hit Start Workout above.</p>
                    </div>
                  )}
                </div>

              </div>

              {/* Connected Google Doc: Click to Log workouts */}
              {parsedWorkouts.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xs space-y-4">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                    <h4 className="text-sm font-black text-slate-800 flex items-center gap-2">
                      <FileText className="w-4.5 h-4.5 text-indigo-500" />
                      Workout Routines Extracted from your Google Doc
                    </h4>
                    <span className="text-[10px] font-black uppercase text-slate-400 bg-slate-100 px-2 py-1 rounded-md">Click to Log Workout</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {parsedWorkouts.map((workout, idx) => (
                      <button
                        key={`doc-workout-${idx}`}
                        onClick={() => handleAddWorkout(workout)}
                        className="p-3.5 bg-slate-50 hover:bg-violet-55/20 border border-slate-200 hover:border-violet-200 rounded-2xl transition-all cursor-pointer flex justify-between items-center text-left"
                      >
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] uppercase font-black px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 border border-violet-150">
                              {workout.category}
                            </span>
                            <h5 className="text-xs font-bold text-slate-800">{workout.name}</h5>
                          </div>
                          <p className="text-[10px] text-slate-400 mt-1 font-semibold">
                            {workout.sets.length} working sets • target {workout.sets[0]?.reps || 10} reps
                          </p>
                        </div>
                        <PlusCircle className="w-4.5 h-4.5 text-slate-400 hover:text-violet-600 transition-colors" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
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

              {/* Inner Tabs Selector */}
              <div className="flex border-b border-slate-200 gap-1.5 pb-0.5 overflow-x-auto">
                {[
                  { id: 'graphs', label: '📈 Progress Graphs' },
                  { id: 'calendar', label: '📅 Consistency Calendar' },
                  { id: 'coach', label: '💡 AI Coach Advice' },
                  { id: 'settings', label: '⚙️ Settings & Google Sync' }
                ].map((subTab) => (
                  <button
                    key={subTab.id}
                    onClick={() => setAnalyticsSubTab(subTab.id as any)}
                    className={`px-4.5 py-2.5 rounded-t-xl text-xs sm:text-sm font-black whitespace-nowrap transition-all cursor-pointer border-b-2 ${
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
                        setActiveTab('nutrition'); // Bring back to logging screen directly!
                      }}
                    />
                  </div>
                )}

                {analyticsSubTab === 'coach' && (
                  <div className="space-y-6">
                    <div className="mb-4">
                      <h3 className="text-base font-black text-slate-900">AI Coach Advice Insights</h3>
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

                {analyticsSubTab === 'settings' && (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    
                    {/* Goal Configuration settings */}
                    <div className="lg:col-span-6 space-y-6">
                      <div className="mb-4">
                        <h3 className="text-base font-black text-slate-900">Anabolic Target Settings</h3>
                        <p className="text-slate-400 text-xs mt-1">Change your targets, daily protein thresholds, and weight units</p>
                      </div>
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

                    {/* Google Workspace backing/Sync */}
                    <div className="lg:col-span-6">
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

                  </div>
                )}

              </div>

            </div>
          )}

          {/* TAB 4: GOOGLE WORKSPACE SYNC */}
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
    </div>
  );
}
