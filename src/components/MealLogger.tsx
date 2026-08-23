import React, { useState, useRef, useMemo } from 'react';
import { Meal, DailyLog } from '../types';
import { Plus, Clock, Check, Utensils, Camera, Sparkles, Loader2, X, Image as ImageIcon, Trash2, FolderPlus, History, Search, ArrowRight, Zap, Edit3, Flame, TrendingUp } from 'lucide-react';

interface MealLoggerProps {
  onAddMeal: (meal: Omit<Meal, 'id' | 'timestamp'> & { timestamp?: string }) => void;
  timestamp?: string;
  setTimestamp?: (time: string) => void;
  logs?: DailyLog[];
}

interface FrequentMealItem {
  name: string;
  count: number;
  protein: number;
  carbs: number;
  fiber: number;
  calories: number;
  lastLoggedDate: string;
}

const getNowTimeString = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export default function MealLogger({ onAddMeal, timestamp, setTimestamp, logs = [] }: MealLoggerProps) {
  // Log Feedback Notice
  const [logNotice, setLogNotice] = useState<string | null>(null);

  // 1. Recent Meals Modal State
  const [isRecentMealsModalOpen, setIsRecentMealsModalOpen] = useState(false);
  const [recentMealSearch, setRecentMealSearch] = useState('');

  // 2. All Suggested/Frequent Meals Modal State
  const [isAllFrequentModalOpen, setIsAllFrequentModalOpen] = useState(false);
  const [frequentMealSearch, setFrequentMealSearch] = useState('');

  // 3. AI Scanner Modal State
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [foodHint, setFoodHint] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [detectedData, setDetectedData] = useState<{ name: string; protein: number; carbs: number; fiber: number; calories: number } | null>(null);
  
  // Editable fields for AI detected data
  const [editDetectedName, setEditDetectedName] = useState('');
  const [editDetectedProtein, setEditDetectedProtein] = useState('');
  const [editDetectedCarbs, setEditDetectedCarbs] = useState('');
  const [editDetectedFiber, setEditDetectedFiber] = useState('');
  const [editDetectedCalories, setEditDetectedCalories] = useState('');

  // 4. Manual Log Entry Modal State
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualProtein, setManualProtein] = useState('');
  const [manualCarbs, setManualCarbs] = useState('');
  const [manualFiber, setManualFiber] = useState('');
  const [manualCalories, setManualCalories] = useState('');
  const [manualTime, setManualTime] = useState(timestamp || getNowTimeString());

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // Extract past 5 days of logged meals from logs
  const recentMeals = useMemo(() => {
    if (!logs || logs.length === 0) return [];

    // Sort logs by date descending
    const sortedLogs = [...logs].sort((a, b) => b.date.localeCompare(a.date));

    // Get logs that actually have recorded meals
    const logsWithMeals = sortedLogs.filter(log => log.meals && log.meals.length > 0);

    // Keep up to 5 most recent logged days with foods
    const recentDays = logsWithMeals.slice(0, 5);

    const items: Array<{
      id: string;
      meal: Meal;
      date: string;
      formattedDate: string;
    }> = [];

    const todayStr = new Date().toISOString().split('T')[0];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    recentDays.forEach(log => {
      let formattedDate = log.date;
      if (log.date === todayStr) {
        formattedDate = 'Today';
      } else if (log.date === yesterdayStr) {
        formattedDate = 'Yesterday';
      } else {
        try {
          const [year, month, day] = log.date.split('-').map(Number);
          const d = new Date(year, month - 1, day);
          formattedDate = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
        } catch (e) {
          formattedDate = log.date;
        }
      }

      // Add meals in reverse chronological order
      [...log.meals].reverse().forEach(meal => {
        items.push({
          id: `${log.date}-${meal.id}`,
          meal,
          date: log.date,
          formattedDate
        });
      });
    });

    return items;
  }, [logs]);

  // 1. Compute most eaten / frequent meals from the past 90 days for top suggestions on the card
  const frequentMeals90Days = useMemo(() => {
    if (!logs || logs.length === 0) return [];

    // Calculate cutoff date for 90 days ago
    const today = new Date();
    const cutoffDate = new Date(today);
    cutoffDate.setDate(today.getDate() - 90);
    const cutoffDateStr = cutoffDate.toISOString().split('T')[0];

    // Filter logs to only those within the past 90 days
    const recentNinetyDaysLogs = logs.filter(log => log.date >= cutoffDateStr);

    const map = new Map<string, {
      count: number;
      displayName: string;
      protein: number;
      carbs: number;
      fiber: number;
      calories: number;
      lastLoggedDate: string;
    }>();

    recentNinetyDaysLogs.forEach(log => {
      if (!log.meals || log.meals.length === 0) return;
      log.meals.forEach(meal => {
        if (!meal.name || !meal.name.trim()) return;
        const key = meal.name.trim().toLowerCase();
        const existing = map.get(key);
        if (existing) {
          existing.count += 1;
          // If this record is more recent, update display name and macros to latest
          if (log.date >= existing.lastLoggedDate) {
            existing.displayName = meal.name.trim();
            existing.protein = meal.protein ?? existing.protein;
            existing.carbs = meal.carbs ?? existing.carbs;
            existing.fiber = meal.fiber ?? existing.fiber;
            existing.calories = meal.calories ?? existing.calories;
            existing.lastLoggedDate = log.date;
          }
        } else {
          map.set(key, {
            count: 1,
            displayName: meal.name.trim(),
            protein: meal.protein ?? 0,
            carbs: meal.carbs ?? 0,
            fiber: meal.fiber ?? 0,
            calories: meal.calories ?? 0,
            lastLoggedDate: log.date || ''
          });
        }
      });
    });

    const items: FrequentMealItem[] = Array.from(map.values()).map(item => ({
      name: item.displayName,
      count: item.count,
      protein: item.protein,
      carbs: item.carbs,
      fiber: item.fiber,
      calories: item.calories,
      lastLoggedDate: item.lastLoggedDate
    }));

    // Sort by count descending (most eaten at the top), then by recency
    items.sort((a, b) => {
      if (b.count !== a.count) {
        return b.count - a.count;
      }
      return b.lastLoggedDate.localeCompare(a.lastLoggedDate);
    });

    return items;
  }, [logs]);

  // 2. Compute frequent meals from the past 30 days specifically for the "View All Frequent" pop-up
  const frequentMeals30Days = useMemo(() => {
    if (!logs || logs.length === 0) return [];

    // Calculate cutoff date for 30 days ago
    const today = new Date();
    const cutoffDate = new Date(today);
    cutoffDate.setDate(today.getDate() - 30);
    const cutoffDateStr = cutoffDate.toISOString().split('T')[0];

    // Filter logs to only those within the past 30 days
    const recentThirtyDaysLogs = logs.filter(log => log.date >= cutoffDateStr);

    const map = new Map<string, {
      count: number;
      displayName: string;
      protein: number;
      carbs: number;
      fiber: number;
      calories: number;
      lastLoggedDate: string;
    }>();

    recentThirtyDaysLogs.forEach(log => {
      if (!log.meals || log.meals.length === 0) return;
      log.meals.forEach(meal => {
        if (!meal.name || !meal.name.trim()) return;
        const key = meal.name.trim().toLowerCase();
        const existing = map.get(key);
        if (existing) {
          existing.count += 1;
          if (log.date >= existing.lastLoggedDate) {
            existing.displayName = meal.name.trim();
            existing.protein = meal.protein ?? existing.protein;
            existing.carbs = meal.carbs ?? existing.carbs;
            existing.fiber = meal.fiber ?? existing.fiber;
            existing.calories = meal.calories ?? existing.calories;
            existing.lastLoggedDate = log.date;
          }
        } else {
          map.set(key, {
            count: 1,
            displayName: meal.name.trim(),
            protein: meal.protein ?? 0,
            carbs: meal.carbs ?? 0,
            fiber: meal.fiber ?? 0,
            calories: meal.calories ?? 0,
            lastLoggedDate: log.date || ''
          });
        }
      });
    });

    const items: FrequentMealItem[] = Array.from(map.values()).map(item => ({
      name: item.displayName,
      count: item.count,
      protein: item.protein,
      carbs: item.carbs,
      fiber: item.fiber,
      calories: item.calories,
      lastLoggedDate: item.lastLoggedDate
    }));

    // Sort by count descending (most eaten at the top), then by recency
    items.sort((a, b) => {
      if (b.count !== a.count) {
        return b.count - a.count;
      }
      return b.lastLoggedDate.localeCompare(a.lastLoggedDate);
    });

    return items;
  }, [logs]);

  // Filter recent meals search
  const filteredRecentMeals = useMemo(() => {
    if (!recentMealSearch.trim()) return recentMeals;
    const q = recentMealSearch.toLowerCase().trim();
    return recentMeals.filter(item =>
      item.meal.name.toLowerCase().includes(q) ||
      item.formattedDate.toLowerCase().includes(q)
    );
  }, [recentMeals, recentMealSearch]);

  // Filter 30-day frequent meals search for the pop-up modal
  const filteredFrequentMeals = useMemo(() => {
    if (!frequentMealSearch.trim()) return frequentMeals30Days;
    const q = frequentMealSearch.toLowerCase().trim();
    return frequentMeals30Days.filter(item =>
      item.name.toLowerCase().includes(q)
    );
  }, [frequentMeals30Days, frequentMealSearch]);

  // Handler for 1-click logging of recent meal
  const handleSelectAndLogRecentMeal = (meal: Meal) => {
    onAddMeal({
      name: meal.name,
      protein: meal.protein || 0,
      carbs: meal.carbs || 0,
      fiber: meal.fiber || 0,
      calories: meal.calories || 0,
      timestamp: getNowTimeString()
    });

    setIsRecentMealsModalOpen(false);
    setLogNotice(`Added "${meal.name}" • ${meal.calories || 0} kcal • ${meal.protein || 0}g protein`);
    setTimeout(() => setLogNotice(null), 4000);
  };

  // Handler for 1-click logging of frequent suggested meal
  const handleSelectAndLogFrequentMeal = (item: FrequentMealItem) => {
    onAddMeal({
      name: item.name,
      protein: item.protein || 0,
      carbs: item.carbs || 0,
      fiber: item.fiber || 0,
      calories: item.calories || 0,
      timestamp: getNowTimeString()
    });

    setIsAllFrequentModalOpen(false);
    setLogNotice(`Added "${item.name}" • ${item.calories || 0} kcal • ${item.protein || 0}g protein`);
    setTimeout(() => setLogNotice(null), 4000);
  };

  // Process files for AI analysis
  const processFiles = (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    const oversized = fileArray.filter(f => f.size > 10 * 1024 * 1024);
    if (oversized.length > 0) {
      setAiError('One or more images exceed the 10MB limit. Please choose smaller images.');
      return;
    }

    const newPreviews: string[] = [];
    let loadedCount = 0;

    fileArray.forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        if (reader.result) {
          newPreviews.push(reader.result as string);
        }
        loadedCount++;
        if (loadedCount === fileArray.length) {
          setImagePreviews(prev => [...prev, ...newPreviews]);
          setDetectedData(null);
          setAiError(null);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleCameraCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processFiles(e.target.files);
    }
  };

  const handleGallerySelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processFiles(e.target.files);
    }
  };

  const handleRemoveImage = (indexToRemove: number) => {
    setImagePreviews(prev => prev.filter((_, idx) => idx !== indexToRemove));
    setDetectedData(null);
  };

  const handleResetModalImages = () => {
    setImagePreviews([]);
    setDetectedData(null);
    setAiError(null);
    if (cameraInputRef.current) cameraInputRef.current.value = '';
    if (galleryInputRef.current) galleryInputRef.current.value = '';
  };

  const runFoodAnalysis = async (images: string[], hintText: string) => {
    if (images.length === 0 && (!hintText || !hintText.trim())) {
      setAiError('Please attach photo or enter a text description of your meal to analyze.');
      return;
    }

    setIsAnalyzing(true);
    setAiError(null);
    setDetectedData(null);

    try {
      const res = await fetch('/api/analyze-food', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images, hint: hintText })
      });

      if (!res.ok) {
        throw new Error('Failed to analyze food.');
      }

      const data = await res.json();
      if (data.error) {
        throw new Error(data.error);
      }

      const parsedData = {
        name: data.name || (hintText.trim() ? hintText.trim().slice(0, 40) : 'Detected Meal'),
        protein: data.protein ?? 0,
        carbs: data.carbs ?? 0,
        fiber: data.fiber ?? 0,
        calories: data.calories ?? 0
      };

      setDetectedData(parsedData);
      setEditDetectedName(parsedData.name);
      setEditDetectedProtein(String(parsedData.protein));
      setEditDetectedCarbs(String(parsedData.carbs));
      setEditDetectedFiber(String(parsedData.fiber));
      setEditDetectedCalories(String(parsedData.calories));
    } catch (err: any) {
      console.error('AI Food Analysis Error:', err);
      setAiError(err.message || 'Error analyzing meal. Please try again or fill in manually.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Handler for logging AI detected meal
  const handleLogAiDetectedMeal = () => {
    if (!detectedData) return;

    const finalName = (editDetectedName || detectedData.name || 'AI Analyzed Meal').trim();
    const finalProtein = Math.max(0, parseFloat(editDetectedProtein) || 0);
    const finalCarbs = Math.max(0, parseFloat(editDetectedCarbs) || 0);
    const finalFiber = Math.max(0, parseFloat(editDetectedFiber) || 0);
    const finalCalories = Math.max(0, parseInt(editDetectedCalories) || 0);

    onAddMeal({
      name: finalName,
      protein: finalProtein,
      carbs: finalCarbs,
      fiber: finalFiber,
      calories: finalCalories,
      timestamp: getNowTimeString()
    });

    setIsAiModalOpen(false);
    setImagePreviews([]);
    setFoodHint('');
    setDetectedData(null);
    setAiError(null);
    if (cameraInputRef.current) cameraInputRef.current.value = '';
    if (galleryInputRef.current) galleryInputRef.current.value = '';

    setLogNotice(`Added "${finalName}" • ${finalCalories} kcal • ${finalProtein}g protein`);
    setTimeout(() => setLogNotice(null), 4000);
  };

  // Handler for manual meal modal submission
  const isManualFormValid =
    manualName.trim().length > 0 &&
    manualProtein.trim() !== '' && !isNaN(Number(manualProtein)) && Number(manualProtein) >= 0 &&
    manualCarbs.trim() !== '' && !isNaN(Number(manualCarbs)) && Number(manualCarbs) >= 0 &&
    manualFiber.trim() !== '' && !isNaN(Number(manualFiber)) && Number(manualFiber) >= 0 &&
    manualCalories.trim() !== '' && !isNaN(Number(manualCalories)) && Number(manualCalories) >= 0;

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isManualFormValid) return;

    const mealName = manualName.trim();
    const prot = Math.max(0, parseFloat(manualProtein) || 0);
    const cb = Math.max(0, parseFloat(manualCarbs) || 0);
    const fb = Math.max(0, parseFloat(manualFiber) || 0);
    const cal = Math.max(0, parseInt(manualCalories) || 0);
    const timeVal = manualTime || getNowTimeString();

    onAddMeal({
      name: mealName,
      protein: prot,
      carbs: cb,
      fiber: fb,
      calories: cal,
      timestamp: timeVal
    });

    if (setTimestamp) {
      setTimestamp(getNowTimeString());
    }

    setIsManualModalOpen(false);
    setManualName('');
    setManualProtein('');
    setManualCarbs('');
    setManualFiber('');
    setManualCalories('');
    setManualTime(getNowTimeString());

    setLogNotice(`Added "${mealName}" • ${cal} kcal • ${prot}g protein`);
    setTimeout(() => setLogNotice(null), 4000);
  };

  // Quick top suggested frequent meals from 90 days to display directly on card (limited to 3 items)
  const topSuggestedMeals = useMemo(() => {
    return frequentMeals90Days.slice(0, 3);
  }, [frequentMeals90Days]);

  return (
    <div className="space-y-6" id="meal-logger-section">
      
      {/* Food Logger Card with 3 Action Buttons and Suggested Meals */}
      <div className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl shrink-0 mt-0.5">
              <Utensils className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-tight">
                Log Food
              </h2>
              <p className="text-slate-500 text-xs sm:text-sm mt-1 font-semibold">
                Quick nutrition tracking
              </p>
            </div>
          </div>
        </div>

        {/* Log Success Notice Banner */}
        {logNotice && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between text-xs sm:text-sm font-black text-emerald-800 animate-fadeIn shadow-2xs">
            <div className="flex items-center gap-2.5">
              <Check className="w-5 h-5 text-emerald-600 stroke-[3] shrink-0" />
              <span>{logNotice}</span>
            </div>
            <button
              type="button"
              onClick={() => setLogNotice(null)}
              className="text-emerald-500 hover:text-emerald-700 p-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* 3 Main Action Buttons Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4" id="log-food-3-buttons-grid">
          
          {/* Button 1: Recent Meals */}
          <button
            type="button"
            onClick={() => {
              setRecentMealSearch('');
              setIsRecentMealsModalOpen(true);
            }}
            className="w-full text-left p-5 sm:p-6 bg-slate-50/80 hover:bg-indigo-50/50 active:scale-98 border border-slate-200/90 hover:border-indigo-300 rounded-2xl transition-all cursor-pointer group shadow-2xs hover:shadow-md flex flex-col justify-between min-h-[140px]"
            id="recent-meals-btn"
          >
            <div className="flex items-start justify-between w-full">
              <div className="p-3 bg-white group-hover:bg-indigo-600 group-hover:text-white text-indigo-600 rounded-xl border border-slate-200 group-hover:border-indigo-600 shadow-2xs transition-colors">
                <History className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-black uppercase tracking-wider text-indigo-700 bg-indigo-100/70 px-2.5 py-1 rounded-full font-mono">
                {recentMeals.length} logged
              </span>
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-black text-slate-900 group-hover:text-indigo-600 transition-colors">
                  Recent Meals
                </h3>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" />
              </div>
              <p className="text-xs text-slate-500 font-semibold mt-1">
                Past 5 days history
              </p>
            </div>
          </button>

          {/* Button 2: Scan with AI */}
          <button
            type="button"
            onClick={() => {
              setIsAiModalOpen(true);
              setAiError(null);
            }}
            className="w-full text-left p-5 sm:p-6 bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-700 hover:from-indigo-700 hover:to-violet-800 active:scale-98 text-white rounded-2xl shadow-md hover:shadow-xl hover:shadow-indigo-500/20 transition-all cursor-pointer group flex flex-col justify-between min-h-[140px]"
            id="scan-with-ai-btn"
          >
            <div className="flex items-start justify-between w-full">
              <div className="p-3 bg-white/15 text-white rounded-xl backdrop-blur-xs border border-white/20 shadow-2xs group-hover:scale-105 transition-transform flex items-center gap-1">
                <Camera className="w-5 h-5" />
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              </div>
              <span className="text-[10px] font-black uppercase tracking-wider text-indigo-100 bg-white/20 px-2.5 py-1 rounded-full backdrop-blur-xs">
                Gemini AI
              </span>
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-black text-white">
                  Scan with AI
                </h3>
                <ArrowRight className="w-4 h-4 text-indigo-200 group-hover:translate-x-1 transition-all" />
              </div>
              <p className="text-xs text-indigo-100/90 font-semibold mt-1">
                Photo or text description
              </p>
            </div>
          </button>

          {/* Button 3: Log Entry Now */}
          <button
            type="button"
            onClick={() => {
              setManualTime(timestamp || getNowTimeString());
              setIsManualModalOpen(true);
            }}
            className="w-full text-left p-5 sm:p-6 bg-slate-50/80 hover:bg-emerald-50/50 active:scale-98 border border-slate-200/90 hover:border-emerald-300 rounded-2xl transition-all cursor-pointer group shadow-2xs hover:shadow-md flex flex-col justify-between min-h-[140px]"
            id="log-entry-now-btn"
          >
            <div className="flex items-start justify-between w-full">
              <div className="p-3 bg-white group-hover:bg-emerald-600 group-hover:text-white text-emerald-600 rounded-xl border border-slate-200 group-hover:border-emerald-600 shadow-2xs transition-colors">
                <Plus className="w-5 h-5 stroke-[2.5]" />
              </div>
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-100/70 px-2.5 py-1 rounded-full font-mono">
                Manual
              </span>
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-black text-slate-900 group-hover:text-emerald-700 transition-colors">
                  Log Entry Now
                </h3>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-1 transition-all" />
              </div>
              <p className="text-xs text-slate-500 font-semibold mt-1">
                Manual macros entry
              </p>
            </div>
          </button>

        </div>

        {/* ------------------------------------------------------------- */}
        {/* SUGGESTED MEALS SECTION (BASED ON MOST EATEN FOODS)           */}
        {/* ------------------------------------------------------------- */}
        <div className="pt-6 border-t border-slate-100 space-y-4" id="suggested-frequent-meals-section">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                <Flame className="w-4 h-4 fill-amber-500 text-amber-500" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                  <span>Suggested Meals</span>
                  {frequentMeals90Days.length > 0 && (
                    <span className="text-[10px] font-black text-amber-700 bg-amber-100/80 px-2 py-0.5 rounded-full font-mono">
                      Most Eaten • 90 Days
                    </span>
                  )}
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Quick 1-click logging based on your most frequently eaten foods over the past 90 days
                </p>
              </div>
            </div>

            {(frequentMeals90Days.length > 3 || frequentMeals30Days.length > 0) && (
              <button
                type="button"
                onClick={() => {
                  setFrequentMealSearch('');
                  setIsAllFrequentModalOpen(true);
                }}
                className="text-xs font-black text-indigo-600 hover:text-indigo-800 bg-indigo-50/70 hover:bg-indigo-100/80 px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1 self-start sm:self-auto shrink-0"
              >
                <span>View All Frequent</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Suggested Items Grid (limited to top 3) */}
          {topSuggestedMeals.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5" id="top-suggested-meals-grid">
              {topSuggestedMeals.map((item) => (
                <div
                  key={item.name}
                  onClick={() => handleSelectAndLogFrequentMeal(item)}
                  className="p-4 bg-slate-50 hover:bg-amber-50/60 border border-slate-200/80 hover:border-amber-300 rounded-2xl transition-all cursor-pointer group shadow-2xs hover:shadow-sm flex flex-col justify-between gap-3"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-sm font-black text-slate-900 group-hover:text-amber-900 truncate">
                        {item.name}
                      </h4>
                      <span className="text-[10px] font-black font-mono text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-md shrink-0">
                        {item.count}x
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold flex-wrap">
                      <span className="text-amber-700 bg-white px-2 py-0.5 rounded-lg border border-slate-200/80 shadow-2xs">
                        {item.calories} kcal
                      </span>
                      <span className="text-indigo-600 bg-white px-2 py-0.5 rounded-lg border border-slate-200/80 shadow-2xs">
                        {item.protein}g protein
                      </span>
                      <span className="text-sky-600 bg-white px-2 py-0.5 rounded-lg border border-slate-200/80 shadow-2xs">
                        {item.carbs}g carbs
                      </span>
                      {item.fiber > 0 && (
                        <span className="text-emerald-600 bg-white px-2 py-0.5 rounded-lg border border-slate-200/80 shadow-2xs">
                          {item.fiber}g fiber
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-400 group-hover:text-amber-700 transition-colors">
                      Click to log now
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectAndLogFrequentMeal(item);
                      }}
                      className="px-3 py-1.5 bg-amber-500 group-hover:bg-amber-600 active:scale-95 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1 shadow-2xs cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5 stroke-[3]" />
                      <span>Log</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-center space-y-1.5">
              <Utensils className="w-6 h-6 text-slate-300 mx-auto" />
              <p className="text-xs font-black text-slate-700">No Frequent Meals Yet</p>
              <p className="text-[11px] text-slate-500 font-medium max-w-md mx-auto">
                As you log your daily foods, your most frequently eaten meals from the past 90 days will automatically show up here for fast 1-click logging.
              </p>
            </div>
          )}

        </div>

      </div>

      {/* Hidden File Inputs for AI Photo Captures */}
      <input
        type="file"
        accept="image/*"
        capture="environment"
        ref={cameraInputRef}
        onChange={handleCameraCapture}
        className="hidden"
        id="camera-file-input"
      />
      <input
        type="file"
        accept="image/*"
        multiple
        ref={galleryInputRef}
        onChange={handleGallerySelect}
        className="hidden"
        id="gallery-file-input"
      />

      {/* ------------------------------------------------------------- */}
      {/* POPUP 1: Recent Meals Modal                                    */}
      {/* ------------------------------------------------------------- */}
      {isRecentMealsModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden my-auto">
            
            {/* Modal Header */}
            <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-2xl shrink-0">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 leading-snug">Recent Meals</h3>
                  <p className="text-xs font-semibold text-slate-500 mt-0.5">
                    Click any meal from the past 5 days to add it to today
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsRecentMealsModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Search Bar */}
            <div className="p-4 sm:p-5 border-b border-slate-100 bg-white">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={recentMealSearch}
                  onChange={(e) => setRecentMealSearch(e.target.value)}
                  placeholder="Filter recent meals by name or date..."
                  className="w-full pl-10 pr-9 py-2.5 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none transition-all"
                  id="recent-meals-search-input"
                />
                {recentMealSearch && (
                  <button
                    type="button"
                    onClick={() => setRecentMealSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Recent Meals List */}
            <div className="max-h-[380px] overflow-y-auto p-4 sm:p-5 space-y-3" id="recent-meals-modal-list">
              {recentMeals.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-2xl space-y-2">
                  <Utensils className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="text-sm font-black text-slate-700">No Recent Meals Found</p>
                  <p className="text-xs text-slate-500 font-medium max-w-sm mx-auto">
                    Meals logged in the past 5 days will show up here for quick 1-click logging.
                  </p>
                </div>
              ) : filteredRecentMeals.length === 0 ? (
                <div className="p-6 text-center text-slate-500 text-xs font-bold">
                  No recent meals found matching "{recentMealSearch}".
                </div>
              ) : (
                filteredRecentMeals.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleSelectAndLogRecentMeal(item.meal)}
                    className="group p-4 bg-white hover:bg-indigo-50/50 border border-slate-200 hover:border-indigo-300 rounded-2xl transition-all cursor-pointer shadow-2xs hover:shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] font-black font-mono text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                          {item.formattedDate}
                        </span>
                        {item.meal.timestamp && (
                          <span className="text-[11px] font-mono text-slate-400 font-semibold flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400" /> {item.meal.timestamp}
                          </span>
                        )}
                      </div>
                      <h4 className="text-sm font-black text-slate-900 group-hover:text-indigo-900 truncate">
                        {item.meal.name}
                      </h4>
                      <div className="flex items-center gap-2 text-xs font-mono font-bold flex-wrap">
                        <span className="text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-100/50">
                          {item.meal.protein || 0}g protein
                        </span>
                        <span className="text-sky-600 bg-sky-50 px-2 py-0.5 rounded-lg border border-sky-100/50">
                          {item.meal.carbs || 0}g carbs
                        </span>
                        <span className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-100/50">
                          {item.meal.fiber || 0}g fiber
                        </span>
                        <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-100/50">
                          {item.meal.calories || 0} kcal
                        </span>
                      </div>
                    </div>

                    <div className="shrink-0 w-full sm:w-auto">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectAndLogRecentMeal(item.meal);
                        }}
                        className="w-full sm:w-auto px-4 py-2.5 bg-indigo-600 group-hover:bg-indigo-700 active:scale-95 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center text-center gap-1.5 shadow-2xs cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Log Meal</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50/50 w-full">
              <button
                type="button"
                onClick={() => setIsRecentMealsModalOpen(false)}
                className="w-full py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-extrabold text-xs rounded-xl transition-colors cursor-pointer flex items-center justify-center text-center"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* POPUP 2: View All Frequent / Suggested Meals Modal             */}
      {/* ------------------------------------------------------------- */}
      {isAllFrequentModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden my-auto">
            
            {/* Modal Header */}
            <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-50 text-amber-600 rounded-2xl shrink-0">
                  <Flame className="w-5 h-5 fill-amber-500 text-amber-500" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 leading-snug">Suggested Meals</h3>
                  <p className="text-xs font-semibold text-slate-500 mt-0.5">
                    Frequently eaten meals from the past 30 days
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAllFrequentModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Search Bar */}
            <div className="p-4 sm:p-5 border-b border-slate-100 bg-white">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={frequentMealSearch}
                  onChange={(e) => setFrequentMealSearch(e.target.value)}
                  placeholder="Filter suggested meals by name..."
                  className="w-full pl-10 pr-9 py-2.5 bg-slate-50 border border-slate-200 focus:border-amber-500 focus:bg-white rounded-xl text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none transition-all"
                  id="frequent-meals-search-input"
                />
                {frequentMealSearch && (
                  <button
                    type="button"
                    onClick={() => setFrequentMealSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Frequent Meals List */}
            <div className="max-h-[380px] overflow-y-auto p-4 sm:p-5 space-y-3" id="frequent-meals-modal-list">
              {frequentMeals30Days.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-2xl space-y-2">
                  <Utensils className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="text-sm font-black text-slate-700">No Frequent Meals Found</p>
                  <p className="text-xs text-slate-500 font-medium max-w-sm mx-auto">
                    Meals logged in the past 30 days will appear here sorted by frequency.
                  </p>
                </div>
              ) : filteredFrequentMeals.length === 0 ? (
                <div className="p-6 text-center text-slate-500 text-xs font-bold">
                  No suggested meals found matching "{frequentMealSearch}".
                </div>
              ) : (
                filteredFrequentMeals.map((item) => (
                  <div
                    key={item.name}
                    onClick={() => handleSelectAndLogFrequentMeal(item)}
                    className="group p-4 bg-white hover:bg-amber-50/50 border border-slate-200 hover:border-amber-300 rounded-2xl transition-all cursor-pointer shadow-2xs hover:shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] font-black font-mono text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-md">
                          Logged {item.count} times
                        </span>
                      </div>
                      <h4 className="text-sm font-black text-slate-900 group-hover:text-amber-900 truncate">
                        {item.name}
                      </h4>
                      <div className="flex items-center gap-2 text-xs font-mono font-bold flex-wrap">
                        <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-100/50">
                          {item.calories} kcal
                        </span>
                        <span className="text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-100/50">
                          {item.protein}g protein
                        </span>
                        <span className="text-sky-600 bg-sky-50 px-2 py-0.5 rounded-lg border border-sky-100/50">
                          {item.carbs}g carbs
                        </span>
                        {item.fiber > 0 && (
                          <span className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-100/50">
                            {item.fiber}g fiber
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0 w-full sm:w-auto">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectAndLogFrequentMeal(item);
                        }}
                        className="w-full sm:w-auto px-4 py-2.5 bg-amber-500 group-hover:bg-amber-600 active:scale-95 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center text-center gap-1.5 shadow-2xs cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Log Meal</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50/50 w-full">
              <button
                type="button"
                onClick={() => setIsAllFrequentModalOpen(false)}
                className="w-full py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-extrabold text-xs rounded-xl transition-colors cursor-pointer flex items-center justify-center text-center"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* POPUP 3: Gemini AI Scanner Modal                               */}
      {/* ------------------------------------------------------------- */}
      {isAiModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/85 backdrop-blur-md flex flex-col p-3 sm:p-6 md:p-8 overflow-y-auto animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-3xl w-full mx-auto p-6 sm:p-8 shadow-2xl border border-slate-100 relative space-y-6 my-auto">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-2xl shadow-md">
                  <Camera className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">Gemini AI Food Analyzer</h3>
                  <p className="text-xs sm:text-sm text-slate-500 font-medium">Attach photos or describe food to estimate and log</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsAiModalOpen(false);
                  setAiError(null);
                }}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-2xl transition-colors cursor-pointer"
                title="Close"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Scanner Body */}
            <div className="space-y-6">
              
              {/* Text Description Box */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-600 mb-2">
                  Food Description or Ingredients
                </label>
                <textarea
                  rows={4}
                  placeholder="Describe what you ate (e.g., 2 scrambled eggs with 1 slice sourdough toast and black coffee)..."
                  value={foodHint}
                  onChange={(e) => setFoodHint(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-2xl p-4 text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 min-h-[7rem] max-h-[14rem] resize-y transition-all"
                  id="ai-food-hint-textarea"
                />
              </div>

              {/* Photo Area */}
              {imagePreviews.length === 0 ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      className="w-full border-2 border-dashed border-indigo-200 hover:border-indigo-400 bg-indigo-50/40 hover:bg-indigo-50/80 rounded-2xl p-5 text-center cursor-pointer transition-all space-y-2 group flex flex-col items-center justify-center"
                      id="ai-open-camera-btn"
                    >
                      <div className="w-11 h-11 bg-indigo-600 text-white rounded-2xl mx-auto flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                        <Camera className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-900">Take Live Photo</p>
                        <p className="text-xs text-slate-500 font-medium mt-0.5">Launches camera directly</p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => galleryInputRef.current?.click()}
                      className="w-full border-2 border-dashed border-purple-200 hover:border-purple-400 bg-purple-50/40 hover:bg-purple-50/80 rounded-2xl p-5 text-center cursor-pointer transition-all space-y-2 group flex flex-col items-center justify-center"
                      id="ai-open-gallery-btn"
                    >
                      <div className="w-11 h-11 bg-purple-600 text-white rounded-2xl mx-auto flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                        <ImageIcon className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-900">Choose from Photos</p>
                        <p className="text-xs text-slate-500 font-medium mt-0.5">Select saved photos</p>
                      </div>
                    </button>
                  </div>

                  {/* Text-Only Analyze Action */}
                  {isAnalyzing ? (
                    <div className="p-6 bg-slate-900 text-white rounded-2xl flex flex-col items-center justify-center gap-3 text-center">
                      <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
                      <span className="text-sm font-black tracking-wide">
                        Analyzing food description...
                      </span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => runFoodAnalysis([], foodHint)}
                      disabled={!foodHint.trim()}
                      className={`w-full py-3.5 rounded-2xl text-sm font-black shadow-lg transition-all flex items-center justify-center text-center gap-2 ${
                        foodHint.trim()
                          ? 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white cursor-pointer active:scale-98'
                          : 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none border border-slate-200'
                      }`}
                      id="ai-analyze-text-btn"
                    >
                      <Sparkles className="w-5 h-5" />
                      <span>
                        {foodHint.trim()
                          ? 'Analyze Text Description'
                          : 'Type a Food Description to Analyze'}
                      </span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase text-slate-500 tracking-wider">
                      Attached Photos: {imagePreviews.length}
                    </span>
                    {!isAnalyzing && (
                      <button
                        type="button"
                        onClick={handleResetModalImages}
                        className="text-xs font-bold text-rose-600 hover:text-rose-700 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Clear All
                      </button>
                    )}
                  </div>

                  {/* Photo Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {imagePreviews.map((imgSrc, idx) => (
                      <div key={idx} className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-900 aspect-square group shadow-xs">
                        <img src={imgSrc} alt={`Meal photo ${idx + 1}`} className="w-full h-full object-cover" />
                        <span className="absolute top-2 left-2 px-2 py-0.5 bg-slate-900/80 text-white rounded-md text-[10px] font-extrabold backdrop-blur-xs">
                          #{idx + 1}
                        </span>
                        {!isAnalyzing && (
                          <button
                            type="button"
                            onClick={() => handleRemoveImage(idx)}
                            className="absolute top-2 right-2 p-1.5 bg-rose-600/90 hover:bg-rose-600 text-white rounded-xl backdrop-blur-xs transition-colors cursor-pointer shadow-md opacity-90 hover:opacity-100"
                            title="Remove photo"
                          >
                            <X className="w-3.5 h-3.5 stroke-[2.5]" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Add More Photos Buttons */}
                  {!isAnalyzing && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1 w-full">
                      <button
                        type="button"
                        onClick={() => cameraInputRef.current?.click()}
                        className="w-full px-3.5 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center justify-center text-center gap-1.5"
                      >
                        <Camera className="w-3.5 h-3.5" /> + Add Another Photo
                      </button>
                      <button
                        type="button"
                        onClick={() => galleryInputRef.current?.click()}
                        className="w-full px-3.5 py-2.5 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center justify-center text-center gap-1.5"
                      >
                        <FolderPlus className="w-3.5 h-3.5" /> + Add From Gallery
                      </button>
                    </div>
                  )}

                  {/* Scan Plate / Analyze Button */}
                  {isAnalyzing ? (
                    <div className="p-6 bg-slate-900 text-white rounded-2xl flex flex-col items-center justify-center gap-3 text-center">
                      <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
                      <span className="text-sm font-black tracking-wide">
                        Analyzing {imagePreviews.length} photo{imagePreviews.length > 1 ? 's' : ''}...
                      </span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => runFoodAnalysis(imagePreviews, foodHint)}
                      className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 active:scale-98 text-white text-sm font-black rounded-2xl shadow-lg transition-all flex items-center justify-center text-center gap-2 cursor-pointer"
                      id="ai-scan-photos-btn"
                    >
                      <Sparkles className="w-5 h-5" />
                      <span>
                        {detectedData
                          ? `Re-Analyze Photos`
                          : `Scan Photos with AI`}
                      </span>
                    </button>
                  )}
                </div>
              )}

              {/* Error Display */}
              {aiError && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-xs sm:text-sm font-bold text-red-700 flex items-center gap-2">
                  <X className="w-5 h-5 text-red-500 shrink-0" />
                  <span>{aiError}</span>
                </div>
              )}

              {/* Detected Results Summary */}
              {detectedData && !isAnalyzing && (
                <div className="p-5 bg-emerald-50/90 border border-emerald-200 rounded-2xl space-y-4 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-emerald-900 font-black text-xs uppercase tracking-wider">
                      <Check className="w-4 h-4 text-emerald-600 stroke-[3]" />
                      <span>AI Detection Complete — Verify or Adjust</span>
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-2xl border border-emerald-100 shadow-2xs space-y-3">
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Detected Meal Name</label>
                      <input
                        type="text"
                        value={editDetectedName}
                        onChange={(e) => setEditDetectedName(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl text-sm font-bold text-slate-900"
                      />
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      <div>
                        <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Protein (g)</label>
                        <input
                          type="number"
                          step="any"
                          value={editDetectedProtein}
                          onChange={(e) => setEditDetectedProtein(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl text-sm font-mono font-bold text-indigo-700"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Carbs (g)</label>
                        <input
                          type="number"
                          step="any"
                          value={editDetectedCarbs}
                          onChange={(e) => setEditDetectedCarbs(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl text-sm font-mono font-bold text-sky-700"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Fiber (g)</label>
                        <input
                          type="number"
                          step="any"
                          value={editDetectedFiber}
                          onChange={(e) => setEditDetectedFiber(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl text-sm font-mono font-bold text-emerald-700"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Calories (kcal)</label>
                        <input
                          type="number"
                          step="any"
                          value={editDetectedCalories}
                          onChange={(e) => setEditDetectedCalories(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl text-sm font-mono font-bold text-amber-700"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* Bottom Actions: Cancel & Log Meal */}
            <div className="pt-4 border-t border-slate-100 grid grid-cols-2 gap-4 w-full">
              <button
                type="button"
                onClick={() => {
                  setIsAiModalOpen(false);
                  setAiError(null);
                }}
                className="w-full py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs sm:text-sm rounded-xl transition-colors cursor-pointer flex items-center justify-center text-center"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleLogAiDetectedMeal}
                disabled={!detectedData || isAnalyzing}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-black text-xs sm:text-sm rounded-xl shadow-md transition-all flex items-center justify-center text-center gap-2 cursor-pointer disabled:cursor-not-allowed"
                id="confirm-log-ai-detected-meal-btn"
              >
                <Plus className="w-4 h-4" />
                <span>Log Meal</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* POPUP 4: Manual Food Entry Modal                               */}
      {/* ------------------------------------------------------------- */}
      {isManualModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden my-auto">
            
            {/* Header */}
            <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-2xl shrink-0">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 leading-snug">Log Food Entry</h3>
                  <p className="text-xs font-semibold text-slate-500 mt-0.5">
                    Enter details below to add to today's log
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsManualModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Manual Form */}
            <form onSubmit={handleManualSubmit} className="p-5 sm:p-6 space-y-5" id="manual-meal-popup-form">
              
              {/* Name */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5">
                  Food Name *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="e.g. Grilled Chicken Salad with Olive Oil"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-2xl px-4 py-3 text-sm font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
                  id="manual-meal-name-input"
                />
              </div>

              {/* Macros Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">
                    Protein *
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      required
                      step="any"
                      min="0"
                      max="300"
                      placeholder="35"
                      value={manualProtein}
                      onChange={(e) => setManualProtein(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl pl-3 pr-7 py-2.5 text-xs sm:text-sm font-mono font-bold text-slate-900 focus:outline-none transition-all"
                      id="manual-meal-protein-input"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400 font-mono">g</span>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">
                    Carbs *
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      required
                      step="any"
                      min="0"
                      max="500"
                      placeholder="40"
                      value={manualCarbs}
                      onChange={(e) => setManualCarbs(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl pl-3 pr-7 py-2.5 text-xs sm:text-sm font-mono font-bold text-slate-900 focus:outline-none transition-all"
                      id="manual-meal-carbs-input"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400 font-mono">g</span>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">
                    Fiber
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      max="100"
                      placeholder="6"
                      value={manualFiber}
                      onChange={(e) => setManualFiber(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl pl-3 pr-7 py-2.5 text-xs sm:text-sm font-mono font-bold text-slate-900 focus:outline-none transition-all"
                      id="manual-meal-fiber-input"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400 font-mono">g</span>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">
                    Calories *
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      required
                      step="any"
                      min="0"
                      max="4000"
                      placeholder="450"
                      value={manualCalories}
                      onChange={(e) => setManualCalories(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl pl-3 pr-10 py-2.5 text-xs sm:text-sm font-mono font-bold text-slate-900 focus:outline-none transition-all"
                      id="manual-meal-calories-input"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400 font-mono">kcal</span>
                  </div>
                </div>
              </div>

              {/* Time */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-500">
                    Time of Meal
                  </label>
                  <button
                    type="button"
                    onClick={() => setManualTime(getNowTimeString())}
                    className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-100 cursor-pointer"
                  >
                    <Clock className="w-3 h-3 text-indigo-600" /> Set to Now
                  </button>
                </div>
                <div className="relative">
                  <input
                    type="time"
                    required
                    value={manualTime}
                    onChange={(e) => setManualTime(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl pl-10 pr-4 py-2.5 text-sm font-mono font-bold text-slate-900 focus:outline-none cursor-pointer"
                    id="manual-meal-time-input"
                  />
                  <Clock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              {/* Popup Buttons */}
              <div className="pt-3 border-t border-slate-100 grid grid-cols-2 gap-3 w-full">
                <button
                  type="button"
                  onClick={() => setIsManualModalOpen(false)}
                  className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs sm:text-sm rounded-xl transition-colors cursor-pointer flex items-center justify-center text-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!isManualFormValid}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-black text-xs sm:text-sm rounded-xl shadow-md transition-all flex items-center justify-center text-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
                  id="submit-manual-meal-btn"
                >
                  <Plus className="w-4 h-4" />
                  <span>Log Meal</span>
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
}
