import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Meal, DailyLog, MealItemBreakdown } from '../types';
import { Plus, Clock, Check, Utensils, Camera, Sparkles, Loader2, X, Image as ImageIcon, Trash2, FolderPlus, History, Search, ArrowRight, Zap, Edit3, Flame, TrendingUp, Coffee, Layers, ChevronDown, ChevronUp, Star, AlertTriangle, StopCircle, RefreshCw } from 'lucide-react';
import { formatDateDDMMYYYY } from '../dateUtils';

interface MealLoggerProps {
  onAddMeal: (meal: Omit<Meal, 'id' | 'timestamp'> & { timestamp?: string }) => void;
  timestamp?: string;
  setTimestamp?: (time: string) => void;
  logs?: DailyLog[];
  selectedDate?: string;
  favoriteFoods?: string[];
  onToggleFavoriteFood?: (foodName: string) => void;
  dailyCalorieTarget?: number;
  dailyFatTarget?: number;
}

export interface TopFavoriteFoodItem {
  name: string;
  count: number;
  protein: number;
  carbs?: number;
  fat?: number;
  fiber?: number;
  calories: number;
  portion?: string;
}

export interface FrequentMealItem {
  name: string;
  count: number;
  protein: number;
  carbs: number;
  fat?: number;
  fiber: number;
  calories: number;
  lastLoggedDate: string;
  isProProduct?: boolean;
  productType?: 'Pro Yogurt' | 'Pro Drink' | 'Pro Smoothie' | 'Yogurt' | 'Drink' | 'Smoothie';
  proteinAmount?: number;
  flavors?: string[];
  rawNames?: string[];
}

export interface GroupingClassification {
  groupKey: string;
  canonicalName: string;
  isProProduct: boolean;
  productType?: 'Pro Yogurt' | 'Pro Drink' | 'Pro Smoothie' | 'Yogurt' | 'Drink' | 'Smoothie';
  proteinAmount?: number;
  extractedFlavor?: string;
}

/**
 * Classifies a meal name into a smart canonical group.
 * Specifically groups common recurring foods like Pro yogurts, Pro drinks, and Pro smoothies,
 * or general yogurts, drinks, and smoothies regardless of changing flavors (e.g. Vanilla, Strawberry, Blueberry, Chocolate),
 * while preserving the specific protein rating (e.g., Pro 20 vs Pro 25).
 */
export function classifyMealForGrouping(name: string): GroupingClassification {
  if (!name || !name.trim()) {
    return { groupKey: '', canonicalName: '', isProProduct: false };
  }

  const raw = name.trim();
  const lower = raw.toLowerCase();

  // Check for PRO product keywords:
  // "pro", "yopro", "danone pro", "strauss pro", "muller pro", "tara pro", "arla pro", "go pro"
  // or explicit keywords "pro drink", "pro yogurt", "pro smoothie"
  const hasExplicitPro =
    /\b(pro|yopro|danone\s*pro|strauss\s*pro|muller\s*pro|tara\s*pro|arla\s*pro|go\s*pro)\b/i.test(lower) ||
    lower.includes('pro drink') ||
    lower.includes('pro yogurt') ||
    lower.includes('pro yoghurt') ||
    lower.includes('pro smoothie') ||
    lower.includes('pro shake');

  // Extract any protein amount number: e.g. 20 from "pro 20", "20g", "25", "15", "30", etc.
  let proteinNumber: number | undefined;
  const numberMatch = lower.match(/(?:pro\s*|yopro\s*)(\d{1,2})\b|\b(\d{1,2})\s*g\b|\b(10|12|14|15|16|18|20|22|24|25|26|28|30|32|35|40)\b/i);
  if (numberMatch) {
    const numStr = numberMatch[1] || numberMatch[2] || numberMatch[3];
    if (numStr) {
      const parsed = parseInt(numStr, 10);
      if (parsed >= 10 && parsed <= 60) {
        proteinNumber = parsed;
      }
    }
  }

  const isSmoothie = lower.includes('smoothie') || lower.includes('shake');
  const isDrink = lower.includes('drink') || lower.includes('beverage') || lower.includes('bottle') || lower.includes('משקה') || lower.includes('liquid');
  const isYogurt = lower.includes('yogurt') || lower.includes('yoghurt') || lower.includes('cup') || lower.includes('pot') || lower.includes('pudding') || lower.includes('יוגורט') || lower.includes('מעדן');

  // Extract flavor if mentioned to combine flavor variations
  const flavorKeywords = [
    'vanilla', 'strawberry', 'blueberry', 'chocolate', 'coffee', 'banana', 'peach', 'mango',
    'salted caramel', 'caramel', 'cookies', 'berries', 'forest fruits', 'cherry', 'raspberry',
    'lemon', 'coconut', 'pineapple', 'apple', 'cinnamon', 'hazelnut', 'peanut butter', 'peanut',
    'unflavored', 'plain', 'original'
  ];
  let extractedFlavor = '';
  for (const f of flavorKeywords) {
    if (lower.includes(f)) {
      extractedFlavor = f.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      break;
    }
  }

  if (hasExplicitPro) {
    if (isSmoothie) {
      const key = proteinNumber ? `pro_smoothie_${proteinNumber}` : 'pro_smoothie';
      const canonical = proteinNumber ? `Pro ${proteinNumber} Smoothie` : 'Pro Smoothie';
      return {
        groupKey: key,
        canonicalName: canonical,
        isProProduct: true,
        productType: 'Pro Smoothie',
        proteinAmount: proteinNumber,
        extractedFlavor: extractedFlavor || undefined
      };
    }

    if (isDrink) {
      const key = proteinNumber ? `pro_drink_${proteinNumber}` : 'pro_drink';
      const canonical = proteinNumber ? `Pro ${proteinNumber} Drink` : 'Pro Drink';
      return {
        groupKey: key,
        canonicalName: canonical,
        isProProduct: true,
        productType: 'Pro Drink',
        proteinAmount: proteinNumber,
        extractedFlavor: extractedFlavor || undefined
      };
    }

    if (isYogurt || (!isDrink && !isSmoothie)) {
      const key = proteinNumber ? `pro_yogurt_${proteinNumber}` : 'pro_yogurt';
      const canonical = proteinNumber ? `Pro ${proteinNumber} Yogurt` : 'Pro Yogurt';
      return {
        groupKey: key,
        canonicalName: canonical,
        isProProduct: true,
        productType: 'Pro Yogurt',
        proteinAmount: proteinNumber,
        extractedFlavor: extractedFlavor || undefined
      };
    }
  }

  // Non-pro general keywords: Smoothie, Drink, Yogurt with combined flavors
  if (isSmoothie) {
    const key = proteinNumber ? `smoothie_${proteinNumber}` : 'smoothie_general';
    const canonical = proteinNumber ? `${proteinNumber}g Protein Smoothie` : 'Smoothie';
    return {
      groupKey: key,
      canonicalName: canonical,
      isProProduct: false,
      productType: 'Smoothie',
      proteinAmount: proteinNumber,
      extractedFlavor: extractedFlavor || undefined
    };
  }

  if (isDrink) {
    const key = proteinNumber ? `drink_${proteinNumber}` : 'protein_drink_general';
    const canonical = proteinNumber ? `${proteinNumber}g Protein Drink` : 'Protein Drink';
    return {
      groupKey: key,
      canonicalName: canonical,
      isProProduct: false,
      productType: 'Drink',
      proteinAmount: proteinNumber,
      extractedFlavor: extractedFlavor || undefined
    };
  }

  if (isYogurt) {
    const isGreek = lower.includes('greek');
    const prefix = isGreek ? 'Greek Yogurt' : 'Yogurt';
    const key = isGreek
      ? (proteinNumber ? `greek_yogurt_${proteinNumber}` : 'greek_yogurt')
      : (proteinNumber ? `yogurt_${proteinNumber}` : 'yogurt');
    const canonical = proteinNumber ? `${prefix} ${proteinNumber}g` : prefix;
    return {
      groupKey: key,
      canonicalName: canonical,
      isProProduct: false,
      productType: 'Yogurt',
      proteinAmount: proteinNumber,
      extractedFlavor: extractedFlavor || undefined
    };
  }

  // Non-pro standard meals: clean punctuation and normalize
  const normalizedKey = lower.replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
  return {
    groupKey: normalizedKey,
    canonicalName: raw,
    isProProduct: false
  };
}

const getNowTimeString = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export default function MealLogger({
  onAddMeal,
  timestamp,
  setTimestamp,
  logs = [],
  selectedDate,
  favoriteFoods = [],
  onToggleFavoriteFood,
  dailyCalorieTarget,
  dailyFatTarget
}: MealLoggerProps) {
  // Log Feedback Notice
  const [logNotice, setLogNotice] = useState<string | null>(null);

  // Compute daily calorie stats for selected date
  const currentDayCalories = useMemo(() => {
    const selectedLog = logs.find((l) => l.date === selectedDate);
    return (selectedLog?.meals || []).reduce((sum, m) => sum + (m.calories || 0), 0);
  }, [logs, selectedDate]);

  // Compute daily fat stats for selected date
  const currentDayFat = useMemo(() => {
    const selectedLog = logs.find((l) => l.date === selectedDate);
    return (selectedLog?.meals || []).reduce((sum, m) => sum + (m.fat || 0), 0);
  }, [logs, selectedDate]);

  const buildCalorieNotice = (mealName: string, mealCal: number, mealProt: number, mealFat?: number) => {
    const nextTotalCal = currentDayCalories + (mealCal || 0);
    const nextTotalFat = currentDayFat + (mealFat || 0);
    const isCalAlert = dailyCalorieTarget && nextTotalCal - dailyCalorieTarget >= 50;
    const isFatAlert = dailyFatTarget && nextTotalFat > dailyFatTarget;

    if (isCalAlert && isFatAlert) {
      return `⚠️ Red Alert: Exceeded both calories (+${nextTotalCal - dailyCalorieTarget} kcal) and fat (+${nextTotalFat - dailyFatTarget}g) targets! Back off!`;
    }
    if (isCalAlert) {
      const overBy = nextTotalCal - dailyCalorieTarget;
      return `⚠️ Calorie Red Alert: Added "${mealName}" (${mealCal} kcal). Total is ${nextTotalCal} kcal (+${overBy} kcal over target) — back off!`;
    }
    if (isFatAlert) {
      const overBy = nextTotalFat - dailyFatTarget;
      return `⚠️ Fat Red Alert: Added "${mealName}" (${mealFat || 0}g fat). Total is ${nextTotalFat}g (+${overBy}g over target) — back off!`;
    }
    return `Added "${mealName}" • ${mealCal} kcal • ${mealProt}g protein${mealFat !== undefined && mealFat > 0 ? ` • ${mealFat}g fat` : ''}`;
  };

  // 1. Recent Meals Modal State
  const [isRecentMealsModalOpen, setIsRecentMealsModalOpen] = useState(false);
  const [recentMealSearch, setRecentMealSearch] = useState('');

  // 2. All Suggested/Frequent Meals Modal State (90 Days Top 30)
  const [isAllFrequentModalOpen, setIsAllFrequentModalOpen] = useState(false);
  const [frequentMealSearch, setFrequentMealSearch] = useState('');

  // Dropdown states for sections on Log Food
  const [isFavoritesDropdownOpen, setIsFavoritesDropdownOpen] = useState(false);
  const [isSuggestedDropdownOpen, setIsSuggestedDropdownOpen] = useState(false);

  // 3. AI Scanner Modal State
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [foodHint, setFoodHint] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisSeconds, setAnalysisSeconds] = useState(0);
  const [aiError, setAiError] = useState<string | null>(null);
  const [detectedData, setDetectedData] = useState<{ name: string; portion?: string; protein: number; carbs: number; fat?: number; fiber: number; calories: number; items?: MealItemBreakdown[] } | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const analysisTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Editable fields for AI detected data
  const [editDetectedName, setEditDetectedName] = useState('');
  const [editDetectedPortion, setEditDetectedPortion] = useState('');
  const [editDetectedProtein, setEditDetectedProtein] = useState('');
  const [editDetectedCarbs, setEditDetectedCarbs] = useState('');
  const [editDetectedFat, setEditDetectedFat] = useState('');
  const [editDetectedFiber, setEditDetectedFiber] = useState('');
  const [editDetectedCalories, setEditDetectedCalories] = useState('');
  const [detectedItems, setDetectedItems] = useState<MealItemBreakdown[]>([]);

  // 4. Manual Log Entry Modal State
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualPortion, setManualPortion] = useState('');
  const [manualProtein, setManualProtein] = useState('');
  const [manualCarbs, setManualCarbs] = useState('');
  const [manualFat, setManualFat] = useState('');
  const [manualFiber, setManualFiber] = useState('');
  const [manualCalories, setManualCalories] = useState('');
  const [manualTime, setManualTime] = useState(timestamp || getNowTimeString());

  // 5. Quick Coffee Log State & Persistent Preference
  const [coffeeMilk, setCoffeeMilk] = useState<'with-milk' | 'no-milk'>(() => {
    try {
      const stored = localStorage.getItem('user_coffee_milk_preference');
      return stored === 'no-milk' ? 'no-milk' : 'with-milk';
    } catch {
      return 'with-milk';
    }
  });

  const handleSelectCoffeeMilk = (pref: 'with-milk' | 'no-milk') => {
    setCoffeeMilk(pref);
    try {
      localStorage.setItem('user_coffee_milk_preference', pref);
    } catch (err) {
      console.warn('Could not save coffee preference:', err);
    }
  };

  const handleQuickLogCoffee = (forcedMilk?: 'with-milk' | 'no-milk') => {
    const pref = forcedMilk || coffeeMilk;
    const isWithMilk = pref === 'with-milk';
    const mealName = isWithMilk ? 'Double Espresso with Milk' : 'Double Espresso No Milk';
    const calories = isWithMilk ? 25 : 5;
    const protein = isWithMilk ? 1 : 0;
    const carbs = isWithMilk ? 2 : 1;
    const fiber = 0;

    onAddMeal({
      name: mealName,
      portion: isWithMilk ? '180ml' : '60ml',
      protein,
      carbs,
      fiber,
      calories,
      timestamp: getNowTimeString()
    });

    if (setTimestamp) {
      setTimestamp(getNowTimeString());
    }

    setLogNotice(buildCalorieNotice(mealName, calories, protein));
    setTimeout(() => setLogNotice(null), 4500);
  };

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
      classification: GroupingClassification;
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
        formattedDate = formatDateDDMMYYYY(log.date);
      }

      // Add meals in reverse chronological order
      [...log.meals].reverse().forEach(meal => {
        items.push({
          id: `${log.date}-${meal.id}`,
          meal,
          date: log.date,
          formattedDate,
          classification: classifyMealForGrouping(meal.name)
        });
      });
    });

    return items;
  }, [logs]);

  // Helper to aggregate logs into categorized frequent meals
  const aggregateFrequentMeals = (daysCount: number) => {
    if (!logs || logs.length === 0) return [];

    const today = new Date();
    const cutoffDate = new Date(today);
    cutoffDate.setDate(today.getDate() - daysCount);
    const cutoffDateStr = cutoffDate.toISOString().split('T')[0];

    const recentLogs = logs.filter(log => log.date >= cutoffDateStr);

    const map = new Map<string, {
      count: number;
      displayName: string;
      protein: number;
      carbs: number;
      fat: number;
      fiber: number;
      calories: number;
      lastLoggedDate: string;
      isProProduct: boolean;
      productType?: 'Pro Yogurt' | 'Pro Drink' | 'Pro Smoothie' | 'Yogurt' | 'Drink' | 'Smoothie';
      proteinAmount?: number;
      flavorsSet: Set<string>;
      rawNamesSet: Set<string>;
    }>();

    recentLogs.forEach(log => {
      if (!log.meals || log.meals.length === 0) return;
      log.meals.forEach(meal => {
        if (!meal.name || !meal.name.trim()) return;
        const classification = classifyMealForGrouping(meal.name);
        if (!classification.groupKey) return;

        const mProtein = meal.protein ?? 0;
        const mCarbs = meal.carbs ?? 0;
        const mFat = meal.fat ?? 0;
        const mFiber = meal.fiber ?? 0;
        const mCalories = meal.calories ?? 0;

        const existing = map.get(classification.groupKey);
        if (existing) {
          existing.count += 1;
          if (classification.extractedFlavor) {
            existing.flavorsSet.add(classification.extractedFlavor);
          }
          existing.rawNamesSet.add(meal.name.trim());

          // If this record is more recent, update display name and macros
          if (log.date >= existing.lastLoggedDate) {
            if (!classification.isProProduct) {
              existing.displayName = meal.name.trim();
            }
            existing.protein = mProtein || existing.protein;
            existing.carbs = mCarbs || existing.carbs;
            existing.fat = mFat || existing.fat;
            existing.fiber = mFiber || existing.fiber;
            existing.calories = mCalories || existing.calories;
            existing.lastLoggedDate = log.date;
          }
        } else {
          const flavorsSet = new Set<string>();
          if (classification.extractedFlavor) {
            flavorsSet.add(classification.extractedFlavor);
          }
          const rawNamesSet = new Set<string>([meal.name.trim()]);

          map.set(classification.groupKey, {
            count: 1,
            displayName: classification.canonicalName,
            protein: mProtein,
            carbs: mCarbs,
            fat: mFat,
            fiber: mFiber,
            calories: mCalories,
            lastLoggedDate: log.date || '',
            isProProduct: classification.isProProduct,
            productType: classification.productType,
            proteinAmount: classification.proteinAmount,
            flavorsSet,
            rawNamesSet
          });
        }
      });
    });

    const items: FrequentMealItem[] = Array.from(map.values()).map(item => {
      // If it's a recognized Pro item with missing macros, apply sensible defaults
      let finalProtein = item.protein;
      let finalCalories = item.calories;
      let finalCarbs = item.carbs;
      let finalFat = item.fat || 0;
      let finalFiber = item.fiber;

      if (item.isProProduct && finalProtein === 0 && item.proteinAmount) {
        finalProtein = item.proteinAmount;
        if (item.productType === 'Pro Yogurt') {
          finalCalories = finalCalories || (item.proteinAmount === 25 ? 160 : 135);
          finalCarbs = finalCarbs || 7;
        } else if (item.productType === 'Pro Drink') {
          finalCalories = finalCalories || (item.proteinAmount === 25 ? 155 : 130);
          finalCarbs = finalCarbs || 8;
        } else if (item.productType === 'Pro Smoothie') {
          finalCalories = finalCalories || 240;
          finalCarbs = finalCarbs || 30;
          finalFiber = finalFiber || 4;
        }
      }

      return {
        name: item.displayName,
        count: item.count,
        protein: finalProtein,
        carbs: finalCarbs,
        fat: finalFat,
        fiber: finalFiber,
        calories: finalCalories,
        lastLoggedDate: item.lastLoggedDate,
        isProProduct: item.isProProduct,
        productType: item.productType,
        proteinAmount: item.proteinAmount,
        flavors: Array.from(item.flavorsSet),
        rawNames: Array.from(item.rawNamesSet)
      };
    });

    // Sort by count descending (most eaten at the top), then by recency
    items.sort((a, b) => {
      if (b.count !== a.count) {
        return b.count - a.count;
      }
      return b.lastLoggedDate.localeCompare(a.lastLoggedDate);
    });

    return items;
  };

  // 1. Compute most eaten / frequent meals from the past 90 days
  const frequentMeals90Days = useMemo(() => {
    return aggregateFrequentMeals(90);
  }, [logs]);

  // Top 30 most eaten meals from the past 90 days for the suggested meals popup
  const top30FrequentMeals = useMemo(() => {
    return frequentMeals90Days.slice(0, 30);
  }, [frequentMeals90Days]);

  // Top 3 suggested meals to display directly on the card
  const topSuggestedMeals = useMemo(() => {
    return frequentMeals90Days.slice(0, 3);
  }, [frequentMeals90Days]);

  // Top 5 favorite foods filtered and ranked by the amount of times they were eaten
  const topFiveFavorites = useMemo<TopFavoriteFoodItem[]>(() => {
    const favSet = new Set((favoriteFoods || []).map((f) => f.toLowerCase().trim()));
    const map = new Map<string, {
      name: string;
      count: number;
      protein: number;
      carbs?: number;
      fat?: number;
      fiber?: number;
      calories: number;
      portion?: string;
      lastDate: string;
    }>();

    logs.forEach((log) => {
      (log.meals || []).forEach((m) => {
        const norm = (m.name || '').trim().toLowerCase();
        if (!norm) return;

        const isFav = m.isFavorite === true || favSet.has(norm);
        if (!isFav) return;

        const existing = map.get(norm);
        if (!existing) {
          map.set(norm, {
            name: m.name.trim(),
            count: 1,
            protein: m.protein || 0,
            carbs: m.carbs || 0,
            fat: m.fat || 0,
            fiber: m.fiber || 0,
            calories: m.calories || 0,
            portion: m.portion,
            lastDate: log.date
          });
        } else {
          existing.count += 1;
          if (log.date >= existing.lastDate) {
            existing.lastDate = log.date;
            existing.name = m.name.trim();
            existing.protein = m.protein || 0;
            existing.carbs = m.carbs || 0;
            existing.fat = m.fat || 0;
            existing.fiber = m.fiber || 0;
            existing.calories = m.calories || 0;
            if (m.portion) existing.portion = m.portion;
          }
        }
      });
    });

    // Also include any favorite foods that haven't been logged in daily logs yet
    (favoriteFoods || []).forEach((fav) => {
      const norm = fav.trim().toLowerCase();
      if (norm && !map.has(norm)) {
        map.set(norm, {
          name: fav.trim(),
          count: 0,
          protein: 0,
          carbs: 0,
          fat: 0,
          fiber: 0,
          calories: 0,
          lastDate: ''
        });
      }
    });

    const list = Array.from(map.values());
    list.sort((a, b) => {
      if (b.count !== a.count) {
        return b.count - a.count;
      }
      return a.name.localeCompare(b.name);
    });

    return list.slice(0, 5);
  }, [logs, favoriteFoods]);

  const handleQuickLogFavorite = (item: TopFavoriteFoodItem) => {
    const timeStr = timestamp || getNowTimeString();
    onAddMeal({
      name: item.name,
      portion: item.portion,
      protein: item.protein,
      carbs: item.carbs,
      fat: item.fat,
      fiber: item.fiber,
      calories: item.calories,
      timestamp: timeStr,
      isFavorite: true
    });
    setLogNotice(buildCalorieNotice(item.name, item.calories, item.protein, item.fat));
    setTimeout(() => setLogNotice(null), 4500);
  };

  // Filter recent meals search
  const filteredRecentMeals = useMemo(() => {
    if (!recentMealSearch.trim()) return recentMeals;
    const q = recentMealSearch.toLowerCase().trim();
    return recentMeals.filter(item => {
      const matchName = item.meal.name.toLowerCase().includes(q);
      const matchDate = item.formattedDate.toLowerCase().includes(q);
      const matchCanonical = item.classification.canonicalName.toLowerCase().includes(q);
      const matchProductType = item.classification.productType?.toLowerCase().includes(q);
      const matchFlavor = item.classification.extractedFlavor?.toLowerCase().includes(q);
      return matchName || matchDate || matchCanonical || matchProductType || matchFlavor;
    });
  }, [recentMeals, recentMealSearch]);

  // Filter 90-day frequent meals search for the top 30 pop-up modal
  const filteredFrequentMeals = useMemo(() => {
    if (!frequentMealSearch.trim()) return top30FrequentMeals;
    const q = frequentMealSearch.toLowerCase().trim();
    return top30FrequentMeals.filter(item => {
      const matchName = item.name.toLowerCase().includes(q);
      const matchType = item.productType?.toLowerCase().includes(q);
      const matchFlavors = item.flavors?.some(f => f.toLowerCase().includes(q));
      const matchRaw = item.rawNames?.some(r => r.toLowerCase().includes(q));
      return matchName || matchType || matchFlavors || matchRaw;
    });
  }, [top30FrequentMeals, frequentMealSearch]);

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
    setLogNotice(buildCalorieNotice(meal.name, meal.calories || 0, meal.protein || 0));
    setTimeout(() => setLogNotice(null), 4500);
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
    setLogNotice(buildCalorieNotice(item.name, item.calories || 0, item.protein || 0));
    setTimeout(() => setLogNotice(null), 4500);
  };

  // Track elapsed analysis seconds for user feedback and timeout visibility
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isAnalyzing) {
      interval = setInterval(() => {
        setAnalysisSeconds(prev => prev + 1);
      }, 1000);
    } else {
      setAnalysisSeconds(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isAnalyzing]);

  const handleStopAnalysis = (message?: string) => {
    if (analysisTimeoutRef.current) {
      clearTimeout(analysisTimeoutRef.current);
      analysisTimeoutRef.current = null;
    }
    if (abortControllerRef.current) {
      try {
        abortControllerRef.current.abort();
      } catch {
        // ignore
      }
      abortControllerRef.current = null;
    }
    setIsAnalyzing(false);
    setAnalysisSeconds(0);
    if (message) {
      setAiError(message);
    }
  };

  const handleCloseAiModal = () => {
    handleStopAnalysis();
    setIsAiModalOpen(false);
    setAiError(null);
  };

  // Fast client-side image resize & compression (max 1200px, 0.82 quality)
  // Drastically speeds up network upload from 15MB down to ~150KB and prevents mobile upload timeouts
  const compressImageFile = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const maxDim = 1200;
          let { width, height } = img;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.82));
          } else {
            resolve((e.target?.result as string) || '');
          }
        };
        img.onerror = () => {
          resolve((e.target?.result as string) || '');
        };
        img.src = (e.target?.result as string) || '';
      };
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
    });
  };

  // Process files for AI analysis
  const processFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    try {
      const compressedPreviews = await Promise.all(fileArray.map(file => compressImageFile(file)));
      const validPreviews = compressedPreviews.filter(p => Boolean(p && p.length > 0));
      if (validPreviews.length > 0) {
        setImagePreviews(prev => [...prev, ...validPreviews]);
        setDetectedData(null);
        setAiError(null);
      }
    } catch (err) {
      console.error('Failed to compress images:', err);
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
    }
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
    handleStopAnalysis();
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

    // Stop and clear any previous running request
    handleStopAnalysis();

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsAnalyzing(true);
    setAnalysisSeconds(0);
    setAiError(null);
    setDetectedData(null);
    setDetectedItems([]);

    // 25s client-side safety timeout to prevent hanging forever
    analysisTimeoutRef.current = setTimeout(() => {
      if (abortControllerRef.current === controller) {
        handleStopAnalysis('Analysis timed out after 25 seconds. Tap Scan Photos to try again.');
      }
    }, 25000);

    try {
      const res = await fetch('/api/analyze-food', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images, hint: hintText }),
        signal: controller.signal
      });

      if (analysisTimeoutRef.current) {
        clearTimeout(analysisTimeoutRef.current);
        analysisTimeoutRef.current = null;
      }

      if (!res.ok) {
        throw new Error('Failed to analyze food.');
      }

      const data = await res.json();
      if (data.error) {
        throw new Error(data.error);
      }

      const rawItems = Array.isArray(data.items) && data.items.length > 1 ? data.items : [];
      const items: MealItemBreakdown[] = rawItems.map((it: any) => ({
        name: String(it.name || 'Food Item'),
        portion: it.portion ? String(it.portion) : undefined,
        carbs: Math.max(0, Math.round(Number(it.carbs) || 0)),
        protein: Math.max(0, Math.round(Number(it.protein) || 0)),
        fat: Math.max(0, Math.round(Number(it.fat) || 0)),
        fiber: Math.max(0, Math.round(Number(it.fiber) || 0)),
        calories: Math.max(0, Math.round(Number(it.calories) || 0))
      }));

      const computedProtein = items.length > 0 ? items.reduce((s, i) => s + i.protein, 0) : (data.protein ?? 0);
      const computedCarbs = items.length > 0 ? items.reduce((s, i) => s + i.carbs, 0) : (data.carbs ?? 0);
      const computedFat = items.length > 0 ? items.reduce((s, i) => s + (i.fat || 0), 0) : (data.fat ?? 0);
      const computedFiber = items.length > 0 ? items.reduce((s, i) => s + i.fiber, 0) : (data.fiber ?? 0);
      const computedCalories = items.length > 0 ? items.reduce((s, i) => s + i.calories, 0) : (data.calories ?? 0);

      const parsedData = {
        name: data.name || (hintText.trim() ? hintText.trim().slice(0, 40) : 'Detected Meal'),
        portion: data.portion ? String(data.portion) : (items.length > 0 ? '' : '200g'),
        protein: data.protein !== undefined ? data.protein : computedProtein,
        carbs: data.carbs !== undefined ? data.carbs : computedCarbs,
        fat: data.fat !== undefined ? data.fat : computedFat,
        fiber: data.fiber !== undefined ? data.fiber : computedFiber,
        calories: data.calories !== undefined ? data.calories : computedCalories,
        items
      };

      setDetectedData(parsedData);
      setDetectedItems(items);
      setEditDetectedName(parsedData.name);
      setEditDetectedPortion(parsedData.portion || '');
      setEditDetectedProtein(String(parsedData.protein));
      setEditDetectedCarbs(String(parsedData.carbs));
      setEditDetectedFat(String(parsedData.fat));
      setEditDetectedFiber(String(parsedData.fiber));
      setEditDetectedCalories(String(parsedData.calories));
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return;
      }
      console.error('AI Food Analysis Error:', err);
      setAiError(err.message || 'Error analyzing meal. Please try again or fill in manually.');
    } finally {
      if (abortControllerRef.current === controller) {
        setIsAnalyzing(false);
        abortControllerRef.current = null;
      }
      if (analysisTimeoutRef.current) {
        clearTimeout(analysisTimeoutRef.current);
        analysisTimeoutRef.current = null;
      }
    }
  };

  // Handlers for modifying itemized breakdown in AI modal
  const handleUpdateDetectedItem = (index: number, updatedFields: Partial<MealItemBreakdown>) => {
    setDetectedItems((prev) => {
      const next = prev.map((item, i) => (i === index ? { ...item, ...updatedFields } : item));
      const totalP = next.reduce((sum, it) => sum + (Number(it.protein) || 0), 0);
      const totalC = next.reduce((sum, it) => sum + (Number(it.carbs) || 0), 0);
      const totalFat = next.reduce((sum, it) => sum + (Number(it.fat) || 0), 0);
      const totalF = next.reduce((sum, it) => sum + (Number(it.fiber) || 0), 0);
      const totalCal = next.reduce((sum, it) => sum + (Number(it.calories) || 0), 0);
      setEditDetectedProtein(String(Math.round(totalP)));
      setEditDetectedCarbs(String(Math.round(totalC)));
      setEditDetectedFat(String(Math.round(totalFat)));
      setEditDetectedFiber(String(Math.round(totalF)));
      setEditDetectedCalories(String(Math.round(totalCal)));
      return next;
    });
  };

  const handleRemoveDetectedItem = (index: number) => {
    setDetectedItems((prev) => {
      const next = prev.filter((_, i) => i !== index);
      const totalP = next.reduce((sum, it) => sum + (Number(it.protein) || 0), 0);
      const totalC = next.reduce((sum, it) => sum + (Number(it.carbs) || 0), 0);
      const totalFat = next.reduce((sum, it) => sum + (Number(it.fat) || 0), 0);
      const totalF = next.reduce((sum, it) => sum + (Number(it.fiber) || 0), 0);
      const totalCal = next.reduce((sum, it) => sum + (Number(it.calories) || 0), 0);
      setEditDetectedProtein(String(Math.round(totalP)));
      setEditDetectedCarbs(String(Math.round(totalC)));
      setEditDetectedFat(String(Math.round(totalFat)));
      setEditDetectedFiber(String(Math.round(totalF)));
      setEditDetectedCalories(String(Math.round(totalCal)));
      return next;
    });
  };

  const handleAddDetectedItem = () => {
    setDetectedItems((prev) => {
      const next = [
        ...prev,
        {
          name: 'Additional Food',
          portion: '150g',
          carbs: 10,
          protein: 5,
          fat: 3,
          fiber: 1,
          calories: 70
        }
      ];
      const totalP = next.reduce((sum, it) => sum + (Number(it.protein) || 0), 0);
      const totalC = next.reduce((sum, it) => sum + (Number(it.carbs) || 0), 0);
      const totalFat = next.reduce((sum, it) => sum + (Number(it.fat) || 0), 0);
      const totalF = next.reduce((sum, it) => sum + (Number(it.fiber) || 0), 0);
      const totalCal = next.reduce((sum, it) => sum + (Number(it.calories) || 0), 0);
      setEditDetectedProtein(String(Math.round(totalP)));
      setEditDetectedCarbs(String(Math.round(totalC)));
      setEditDetectedFat(String(Math.round(totalFat)));
      setEditDetectedFiber(String(Math.round(totalF)));
      setEditDetectedCalories(String(Math.round(totalCal)));
      return next;
    });
  };

  // Handler for logging AI detected meal
  const handleLogAiDetectedMeal = () => {
    if (!detectedData) return;

    const finalName = (editDetectedName || detectedData.name || 'AI Analyzed Meal').trim();
    const finalPortion = (editDetectedPortion || detectedData.portion || '').trim() || undefined;
    const finalProtein = Math.max(0, parseFloat(editDetectedProtein) || 0);
    const finalCarbs = Math.max(0, parseFloat(editDetectedCarbs) || 0);
    const finalFat = Math.max(0, parseFloat(editDetectedFat) || 0);
    const finalFiber = Math.max(0, parseFloat(editDetectedFiber) || 0);
    const finalCalories = Math.max(0, parseInt(editDetectedCalories) || 0);

    onAddMeal({
      name: finalName,
      portion: finalPortion,
      protein: finalProtein,
      carbs: finalCarbs,
      fat: finalFat,
      fiber: finalFiber,
      calories: finalCalories,
      items: detectedItems.length > 1 ? detectedItems : undefined,
      timestamp: getNowTimeString()
    });

    setIsAiModalOpen(false);
    setImagePreviews([]);
    setFoodHint('');
    setDetectedData(null);
    setDetectedItems([]);
    setAiError(null);
    if (cameraInputRef.current) cameraInputRef.current.value = '';
    if (galleryInputRef.current) galleryInputRef.current.value = '';

    setLogNotice(buildCalorieNotice(finalName, finalCalories, finalProtein, finalFat));
    setTimeout(() => setLogNotice(null), 4500);
  };

  // Handler for manual meal modal submission
  const isManualFormValid =
    manualName.trim().length > 0 &&
    manualProtein.trim() !== '' && !isNaN(Number(manualProtein)) && Number(manualProtein) >= 0 &&
    manualCarbs.trim() !== '' && !isNaN(Number(manualCarbs)) && Number(manualCarbs) >= 0 &&
    (manualFat.trim() === '' || (!isNaN(Number(manualFat)) && Number(manualFat) >= 0)) &&
    manualFiber.trim() !== '' && !isNaN(Number(manualFiber)) && Number(manualFiber) >= 0 &&
    manualCalories.trim() !== '' && !isNaN(Number(manualCalories)) && Number(manualCalories) >= 0;

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isManualFormValid) return;

    const mealName = manualName.trim();
    const prot = Math.max(0, parseFloat(manualProtein) || 0);
    const cb = Math.max(0, parseFloat(manualCarbs) || 0);
    const ft = Math.max(0, parseFloat(manualFat) || 0);
    const fb = Math.max(0, parseFloat(manualFiber) || 0);
    const cal = Math.max(0, parseInt(manualCalories) || 0);
    const timeVal = manualTime || getNowTimeString();

    onAddMeal({
      name: mealName,
      portion: manualPortion.trim() || undefined,
      protein: prot,
      carbs: cb,
      fat: ft,
      fiber: fb,
      calories: cal,
      timestamp: timeVal
    });

    if (setTimestamp) {
      setTimestamp(getNowTimeString());
    }

    setIsManualModalOpen(false);
    setManualName('');
    setManualPortion('');
    setManualProtein('');
    setManualCarbs('');
    setManualFat('');
    setManualFiber('');
    setManualCalories('');
    setManualTime(getNowTimeString());

    setLogNotice(buildCalorieNotice(mealName, cal, prot, ft));
    setTimeout(() => setLogNotice(null), 4500);
  };

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

        {/* Log Notice Banner (Normal Success or Red Alert) */}
        {logNotice && (
          <div
            className={`p-4 rounded-2xl flex items-center justify-between text-sm font-black animate-fadeIn shadow-2xs ${
              logNotice.includes('Red Alert')
                ? 'bg-red-50 border-2 border-red-500 text-red-950 ring-2 ring-red-400/30'
                : 'bg-emerald-50 border border-emerald-200 text-emerald-800'
            }`}
            id="meal-log-notice-banner"
          >
            <div className="flex items-center gap-2.5">
              {logNotice.includes('Red Alert') ? (
                <AlertTriangle className="w-5 h-5 text-red-600 stroke-[2.5] shrink-0 animate-bounce" />
              ) : (
                <Check className="w-5 h-5 text-emerald-600 stroke-[3] shrink-0" />
              )}
              <span className="leading-snug">{logNotice}</span>
            </div>
            <button
              type="button"
              onClick={() => setLogNotice(null)}
              className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer shrink-0 ml-2"
              aria-label="Close notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Quick Coffee One-Tap Card */}
        <div
          className="bg-gradient-to-r from-amber-50/90 via-orange-50/50 to-amber-50/80 border border-amber-200/90 rounded-2xl p-5 shadow-xs"
          id="quick-coffee-card"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            {/* Left: Coffee icon and title */}
            <div className="flex items-center gap-3.5">
              <div className="p-3 bg-amber-100 text-amber-900 rounded-xl shrink-0 shadow-2xs">
                <Coffee className="w-6 h-6 text-amber-800" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-black text-slate-900 tracking-tight">
                  Daily Coffee
                </h3>
                <p className="text-sm text-slate-600 font-medium">
                  {coffeeMilk === 'with-milk'
                    ? 'Double Espresso with Milk • 25 kcal • 1g protein'
                    : 'Double Espresso No Milk • 5 kcal • 0g protein'}
                </p>
              </div>
            </div>

            {/* Right: Milk selector and Log Button */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Milk preference pills */}
              <div className="inline-flex p-1 bg-white/90 border border-amber-200 rounded-xl shadow-2xs">
                <button
                  type="button"
                  onClick={() => handleSelectCoffeeMilk('with-milk')}
                  className={`px-3.5 py-2 rounded-lg text-sm font-bold transition-all cursor-pointer min-h-[44px] flex items-center justify-center ${
                    coffeeMilk === 'with-milk'
                      ? 'bg-amber-800 text-white shadow-xs'
                      : 'text-amber-900 hover:bg-amber-100/60'
                  }`}
                  id="coffee-with-milk-toggle"
                >
                  With Milk
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectCoffeeMilk('no-milk')}
                  className={`px-3.5 py-2 rounded-lg text-sm font-bold transition-all cursor-pointer min-h-[44px] flex items-center justify-center ${
                    coffeeMilk === 'no-milk'
                      ? 'bg-amber-800 text-white shadow-xs'
                      : 'text-amber-900 hover:bg-amber-100/60'
                  }`}
                  id="coffee-no-milk-toggle"
                >
                  No Milk
                </button>
              </div>

              {/* Main Log Coffee Button */}
              <button
                type="button"
                onClick={() => handleQuickLogCoffee()}
                className="px-5 py-2.5 bg-amber-800 hover:bg-amber-900 active:scale-98 text-white rounded-xl font-black text-sm shadow-sm hover:shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 min-h-[48px]"
                id="quick-log-coffee-btn"
              >
                <Coffee className="w-5 h-5 text-amber-200" />
                <span>Log Coffee</span>
              </button>
            </div>
          </div>
        </div>

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
              handleStopAnalysis();
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
        {/* TOP 5 FAVORITE FOODS DROPDOWN                                  */}
        {/* ------------------------------------------------------------- */}
        <div className="border border-slate-200/90 rounded-2xl overflow-hidden bg-slate-50/40 shadow-2xs" id="top-favorite-foods-section">
          <button
            type="button"
            onClick={() => setIsFavoritesDropdownOpen(prev => !prev)}
            className="w-full p-4 sm:p-5 flex items-center justify-between text-left hover:bg-slate-100/70 transition-colors cursor-pointer"
            id="favorite-foods-dropdown-toggle"
            aria-expanded={isFavoritesDropdownOpen}
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="p-2.5 bg-amber-100/70 text-amber-600 rounded-xl shrink-0">
                <Star className="w-5 h-5 fill-amber-400 text-amber-500" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-base font-black text-slate-900 whitespace-nowrap">Favorite Foods</span>
                  <span className="text-sm font-bold text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full font-mono whitespace-nowrap">
                    Top 5 • Most Eaten
                  </span>
                </div>
                <p className="text-sm text-slate-500 font-medium mt-0.5 truncate">
                  Your most frequently eaten starred foods with one-action instant logging
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 ml-3">
              <span className="text-sm font-bold text-slate-400 hidden sm:inline">
                {isFavoritesDropdownOpen ? 'Collapse' : 'Expand'}
              </span>
              <div className="p-1.5 rounded-lg text-slate-500 bg-white border border-slate-200/80 shadow-2xs hover:bg-slate-100 transition-colors">
                <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isFavoritesDropdownOpen ? 'rotate-180' : ''}`} />
              </div>
            </div>
          </button>

          {isFavoritesDropdownOpen && (
            <div className="p-4 sm:p-5 pt-3 border-t border-slate-200/80 bg-white">
              {topFiveFavorites.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3.5" id="top-favorite-foods-grid">
                  {topFiveFavorites.map((item) => (
                    <div
                      key={item.name}
                      className="p-4 bg-amber-50/40 hover:bg-amber-50/70 border border-amber-200/90 rounded-2xl transition-all shadow-2xs hover:shadow-xs flex flex-col justify-between gap-3"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <Star className="w-4 h-4 fill-amber-400 text-amber-500 shrink-0" />
                            <span className="text-sm font-bold text-amber-800 bg-amber-100/90 px-2 py-0.5 rounded-md font-mono">
                              Eaten {item.count} times
                            </span>
                          </div>
                          {item.portion && (
                            <span className="text-sm font-semibold text-slate-500 font-mono">
                              {item.portion}
                            </span>
                          )}
                        </div>

                        <h4 className="text-sm font-black text-slate-900 line-clamp-2 leading-snug">
                          {item.name}
                        </h4>

                        <div className="flex flex-wrap items-center gap-1.5 pt-1 text-sm">
                          <span className="px-2 py-0.5 bg-white border border-slate-200/80 rounded-lg font-black text-emerald-700">
                            {item.protein}g P
                          </span>
                          {item.carbs !== undefined && (
                            <span className="px-2 py-0.5 bg-white border border-slate-200/80 rounded-lg font-black text-sky-700">
                              {item.carbs}g C
                            </span>
                          )}
                          {item.fiber !== undefined && (
                            <span className="px-2 py-0.5 bg-white border border-slate-200/80 rounded-lg font-black text-teal-700">
                              {item.fiber}g F
                            </span>
                          )}
                          <span className="px-2 py-0.5 bg-white border border-slate-200/80 rounded-lg font-bold text-amber-800 font-mono">
                            {item.calories} kcal
                          </span>
                        </div>
                      </div>

                      {/* One-action log button */}
                      <button
                        type="button"
                        onClick={() => handleQuickLogFavorite(item)}
                        className="w-full py-2.5 px-3.5 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 shadow-xs transition-all active:scale-95 cursor-pointer"
                      >
                        <Plus className="w-4 h-4 stroke-[3]" />
                        <span>Quick Log</span>
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-white border border-slate-200 text-amber-500 rounded-xl shrink-0">
                      <Star className="w-5 h-5 fill-amber-400 text-amber-500" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-800">No favorite foods starred yet</h4>
                      <p className="text-sm text-slate-500">
                        Click the star icon next to any logged food in the Activity Records or Daily Log to add it to your top favorites.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ------------------------------------------------------------- */}
        {/* SUGGESTED MEALS DROPDOWN (BASED ON MOST EATEN FOODS - 90 DAYS) */}
        {/* ------------------------------------------------------------- */}
        <div className="border border-slate-200/90 rounded-2xl overflow-hidden bg-slate-50/40 shadow-2xs" id="suggested-frequent-meals-section">
          <button
            type="button"
            onClick={() => setIsSuggestedDropdownOpen(prev => !prev)}
            className="w-full p-4 sm:p-5 flex items-center justify-between text-left hover:bg-slate-100/70 transition-colors cursor-pointer"
            id="suggested-meals-dropdown-toggle"
            aria-expanded={isSuggestedDropdownOpen}
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="p-2.5 bg-amber-100/70 text-amber-600 rounded-xl shrink-0">
                <Flame className="w-5 h-5 fill-amber-500 text-amber-500" />
              </div>
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-base font-black text-slate-900 whitespace-nowrap">Suggested Meals</span>
                  {frequentMeals90Days.length > 0 && (
                    <span className="text-sm font-bold text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full font-mono whitespace-nowrap inline-block">
                      Most Eaten • 90 Days
                    </span>
                  )}
                </div>

                {/* View All Frequent button placed directly under the title */}
                <div className="pt-0.5">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFrequentMealSearch('');
                      setIsAllFrequentModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 text-sm font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-xl transition-all cursor-pointer shadow-2xs active:scale-95 shrink-0"
                    id="view-all-frequent-btn"
                  >
                    <span>View All Frequent</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <p className="text-sm text-slate-500 font-medium truncate pt-0.5">
                  Quick 1-click logging based on your most frequently eaten foods
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 ml-3">
              <span className="text-sm font-bold text-slate-400 hidden sm:inline">
                {isSuggestedDropdownOpen ? 'Collapse' : 'Expand'}
              </span>
              <div className="p-1.5 rounded-lg text-slate-500 bg-white border border-slate-200/80 shadow-2xs hover:bg-slate-100 transition-colors">
                <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isSuggestedDropdownOpen ? 'rotate-180' : ''}`} />
              </div>
            </div>
          </button>

          {isSuggestedDropdownOpen && (
            <div className="p-4 sm:p-5 pt-3 border-t border-slate-200/80 bg-white">
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
                          <div className="flex items-center gap-1.5 min-w-0">
                            <h4 className="text-sm font-black text-slate-900 group-hover:text-amber-900 truncate">
                              {item.name}
                            </h4>
                            {item.isProProduct && (
                              <span className="text-sm font-black uppercase text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-md shrink-0">
                                PRO
                              </span>
                            )}
                          </div>
                          <span className="text-sm font-black font-mono text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-md shrink-0">
                            {item.count}x
                          </span>
                        </div>

                        {item.flavors && item.flavors.length > 0 && (
                          <p className="text-sm text-slate-500 font-semibold truncate">
                            Flavors: {item.flavors.slice(0, 3).join(', ')}{item.flavors.length > 3 ? '...' : ''}
                          </p>
                        )}

                        <div className="flex items-center gap-1.5 text-sm font-mono font-bold flex-wrap">
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
                        <span className="text-sm font-bold text-slate-400 group-hover:text-amber-700 transition-colors">
                          Click to log now
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectAndLogFrequentMeal(item);
                          }}
                          className="px-3.5 py-2 bg-amber-500 group-hover:bg-amber-600 active:scale-95 text-white rounded-xl text-sm font-black transition-all flex items-center gap-1 shadow-2xs cursor-pointer"
                        >
                          <Plus className="w-4 h-4 stroke-[3]" />
                          <span>Log</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-center space-y-1.5">
                  <Utensils className="w-6 h-6 text-slate-300 mx-auto" />
                  <p className="text-sm font-black text-slate-700">No Frequent Meals Yet</p>
                  <p className="text-sm text-slate-500 font-medium max-w-md mx-auto">
                    As you log your daily foods, your most frequently eaten meals from the past 90 days will automatically group together here for fast 1-click logging.
                  </p>
                </div>
              )}
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
                    Top 30 most eaten meals from the past 90 days
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
                  placeholder="Filter suggested meals by name or keyword..."
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
            <div className="max-h-[420px] overflow-y-auto p-4 sm:p-5 space-y-3" id="frequent-meals-modal-list">
              {frequentMeals90Days.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-2xl space-y-2">
                  <Utensils className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="text-sm font-black text-slate-700">No Suggested Meals Found</p>
                  <p className="text-xs text-slate-500 font-medium max-w-sm mx-auto">
                    Meals logged in the past 90 days will appear here sorted from most eaten to least.
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
                        {item.isProProduct && (
                          <span className="text-[10px] font-black uppercase text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-md">
                            {item.productType || 'Pro Item'}
                          </span>
                        )}
                      </div>
                      <h4 className="text-sm font-black text-slate-900 group-hover:text-amber-900 truncate">
                        {item.name}
                      </h4>
                      {item.flavors && item.flavors.length > 0 && (
                        <p className="text-[11px] text-slate-500 font-medium">
                          Combined flavors: <span className="text-slate-700 font-semibold">{item.flavors.join(', ')}</span>
                        </p>
                      )}
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
                onClick={handleCloseAiModal}
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
                    <div className="p-5 sm:p-6 bg-slate-900 text-white rounded-2xl flex flex-col items-center justify-center gap-3 text-center shadow-md">
                      <div className="flex items-center gap-2.5">
                        <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
                        <span className="text-sm font-bold tracking-wide">
                          Analyzing food description...
                        </span>
                      </div>
                      <p className="text-sm text-slate-400 font-medium">
                        {analysisSeconds}s elapsed &bull; Maximum timeout 25s
                      </p>
                      <button
                        type="button"
                        onClick={() => handleStopAnalysis('Analysis stopped. Tap Analyze Text Description to restart.')}
                        className="mt-1 px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-2"
                        id="ai-stop-text-analysis-btn"
                      >
                        <StopCircle className="w-5 h-5" />
                        <span>Stop Analysis</span>
                      </button>
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
                    <div className="p-5 sm:p-6 bg-slate-900 text-white rounded-2xl flex flex-col items-center justify-center gap-3 text-center shadow-md">
                      <div className="flex items-center gap-2.5">
                        <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
                        <span className="text-sm font-bold tracking-wide">
                          Analyzing {imagePreviews.length} photo{imagePreviews.length > 1 ? 's' : ''}...
                        </span>
                      </div>
                      <p className="text-sm text-slate-400 font-medium">
                        {analysisSeconds}s elapsed &bull; Maximum timeout 25s
                      </p>
                      <button
                        type="button"
                        onClick={() => handleStopAnalysis('Analysis stopped. Tap Scan Photos with AI to restart.')}
                        className="mt-1 px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-2"
                        id="ai-stop-photo-analysis-btn"
                      >
                        <StopCircle className="w-5 h-5" />
                        <span>Stop Analysis</span>
                      </button>
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
                <div className="p-4 sm:p-5 bg-emerald-50/90 border border-emerald-200 rounded-2xl space-y-4 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-emerald-950 font-black text-sm uppercase tracking-wider">
                      <Check className="w-5 h-5 text-emerald-600 stroke-[3]" />
                      <span>{detectedItems.length > 1 ? 'Plate Analysis' : 'Meal Analysis'}</span>
                    </div>
                  </div>

                  {/* Meal Name & Portion Input */}
                  <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-emerald-200 shadow-2xs space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="sm:col-span-2 space-y-1.5">
                        <label className="text-sm font-black uppercase text-slate-600 block">Meal Name</label>
                        <input
                          type="text"
                          value={editDetectedName}
                          onChange={(e) => setEditDetectedName(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl text-sm font-bold text-slate-900"
                          placeholder="Meal Name"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-sm font-black uppercase text-slate-600 block">Est. Weight / Volume</label>
                        <input
                          type="text"
                          value={editDetectedPortion}
                          onChange={(e) => setEditDetectedPortion(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl text-sm font-bold text-slate-900"
                          placeholder="e.g. 250g or 330ml"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Major Foods on Plate (ONLY shown for multi-item plates like Salmon and Rice) */}
                  {detectedItems.length > 1 && (
                    <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-emerald-200 shadow-2xs space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black text-slate-800">Foods on Plate</span>
                          <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-sm font-bold">
                            {detectedItems.length} items
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={handleAddDetectedItem}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 hover:bg-slate-100 text-emerald-700 border border-emerald-300 rounded-lg text-sm font-bold transition-colors cursor-pointer"
                          id="add-plate-item-btn"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Add Food</span>
                        </button>
                      </div>

                      <div className="space-y-2">
                        {detectedItems.map((item, idx) => (
                          <div
                            key={idx}
                            className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="font-bold text-slate-900 text-sm flex items-center gap-2 flex-1 flex-wrap">
                                <span>{item.name}</span>
                                <input
                                  type="text"
                                  value={item.portion || ''}
                                  onChange={(e) => handleUpdateDetectedItem(idx, { portion: e.target.value })}
                                  placeholder="e.g. 180g or 250ml"
                                  className="px-2 py-0.5 bg-white border border-slate-200 focus:border-indigo-500 rounded-md text-sm font-mono font-bold text-slate-700 w-32 focus:outline-none"
                                />
                              </div>
                              {detectedItems.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveDetectedItem(idx)}
                                  className="p-1 text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
                                  title="Remove item"
                                  aria-label="Remove item"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5 text-sm font-bold">
                              <span className="px-2 py-0.5 rounded-md bg-sky-50 text-sky-800 border border-sky-200">
                                {item.carbs}g carbs
                              </span>
                              <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200">
                                {item.protein}g protein
                              </span>
                              {item.fat !== undefined && (
                                <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-900 border border-amber-300">
                                  {item.fat}g fat
                                </span>
                              )}
                              <span className="px-2 py-0.5 rounded-md bg-teal-50 text-teal-800 border border-teal-200">
                                {item.fiber}g fiber
                              </span>
                              <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 font-mono">
                                {item.calories} kcal
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Nutrients (Editable) */}
                  <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-emerald-200 shadow-2xs space-y-3">
                    <div className="text-sm font-black text-slate-700">
                      {detectedItems.length > 1 ? 'Total Plate Nutrients' : 'Nutritional Values'}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                      <div className="p-2.5 bg-sky-50 border border-sky-200 rounded-xl">
                        <label className="text-sm font-bold text-sky-800 block mb-1">Carbs</label>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="0"
                            value={editDetectedCarbs}
                            onChange={(e) => setEditDetectedCarbs(e.target.value)}
                            className="w-full bg-white px-2 py-1 rounded-lg border border-sky-300 text-sm font-mono font-bold text-sky-900 text-right"
                          />
                          <span className="text-sm font-bold text-sky-700">g</span>
                        </div>
                      </div>
                      <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl">
                        <label className="text-sm font-bold text-emerald-800 block mb-1">Protein</label>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="0"
                            value={editDetectedProtein}
                            onChange={(e) => setEditDetectedProtein(e.target.value)}
                            className="w-full bg-white px-2 py-1 rounded-lg border border-emerald-300 text-sm font-mono font-bold text-emerald-900 text-right"
                          />
                          <span className="text-sm font-bold text-emerald-700">g</span>
                        </div>
                      </div>
                      <div className="p-2.5 bg-amber-50/70 border border-amber-300 rounded-xl">
                        <label className="text-sm font-bold text-amber-900 block mb-1">Fat</label>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="0"
                            value={editDetectedFat}
                            onChange={(e) => setEditDetectedFat(e.target.value)}
                            className="w-full bg-white px-2 py-1 rounded-lg border border-amber-300 text-sm font-mono font-bold text-amber-950 text-right"
                          />
                          <span className="text-sm font-bold text-amber-800">g</span>
                        </div>
                      </div>
                      <div className="p-2.5 bg-teal-50 border border-teal-200 rounded-xl">
                        <label className="text-sm font-bold text-teal-800 block mb-1">Fiber</label>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="0"
                            value={editDetectedFiber}
                            onChange={(e) => setEditDetectedFiber(e.target.value)}
                            className="w-full bg-white px-2 py-1 rounded-lg border border-teal-300 text-sm font-mono font-bold text-teal-900 text-right"
                          />
                          <span className="text-sm font-bold text-teal-700">g</span>
                        </div>
                      </div>
                      <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl col-span-2 sm:col-span-1">
                        <label className="text-sm font-bold text-amber-800 block mb-1">Calories</label>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="0"
                            value={editDetectedCalories}
                            onChange={(e) => setEditDetectedCalories(e.target.value)}
                            className="w-full bg-white px-2 py-1 rounded-lg border border-amber-300 text-sm font-mono font-bold text-amber-900 text-right"
                          />
                          <span className="text-sm font-bold text-amber-700">kcal</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Projected Red Alert Notice for Calorie or Fat Limits */}
                  {(() => {
                    const aiCal = Math.max(0, parseInt(editDetectedCalories) || 0);
                    const aiFat = Math.max(0, parseFloat(editDetectedFat) || 0);
                    const projectedCalTotal = currentDayCalories + aiCal;
                    const projectedFatTotal = currentDayFat + aiFat;
                    const isCalOver = dailyCalorieTarget && projectedCalTotal - dailyCalorieTarget >= 50;
                    const isFatOver = dailyFatTarget && projectedFatTotal > dailyFatTarget;

                    if (isCalOver || isFatOver) {
                      return (
                        <div className="p-3.5 bg-red-50 border-2 border-red-500 rounded-2xl flex items-start gap-3 text-xs font-bold text-red-950 shadow-2xs animate-fadeIn">
                          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5 animate-pulse" />
                          <div className="space-y-1">
                            <span className="block font-black uppercase tracking-wide text-red-700">
                              Red Alert Warning: Limit Exceeded
                            </span>
                            {isCalOver && (
                              <p>
                                Calories: will reach <span className="font-mono font-black">{projectedCalTotal} kcal</span> (+{projectedCalTotal - dailyCalorieTarget!} kcal over daily target).
                              </p>
                            )}
                            {isFatOver && (
                              <p>
                                Fats: will reach <span className="font-mono font-black">{projectedFatTotal}g</span> (+{projectedFatTotal - dailyFatTarget!}g over daily fat target). Back off!
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
              )}

            </div>

            {/* Bottom Actions: Cancel & Log Meal */}
            <div className="pt-4 border-t border-slate-100 grid grid-cols-2 gap-4 w-full">
              <button
                type="button"
                onClick={handleCloseAiModal}
                className="w-full py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-sm rounded-xl transition-colors cursor-pointer flex items-center justify-center text-center"
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
              
              {/* Name & Portion */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5">
                    Food Name *
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    placeholder="e.g. Grilled Chicken Salad"
                    value={manualName}
                    onChange={(e) => setManualName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-2xl px-4 py-3 text-sm font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
                    id="manual-meal-name-input"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5">
                    Est. Grams or ml
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 250g or 300ml"
                    value={manualPortion}
                    onChange={(e) => setManualPortion(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-2xl px-4 py-3 text-sm font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
                    id="manual-meal-portion-input"
                  />
                </div>
              </div>

              {/* Macros Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
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
                  <label className="block text-[11px] font-black uppercase tracking-wider text-amber-700 mb-1">
                    Fat (g)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      max="300"
                      placeholder="12"
                      value={manualFat}
                      onChange={(e) => setManualFat(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl pl-3 pr-7 py-2.5 text-xs sm:text-sm font-mono font-bold text-slate-900 focus:outline-none transition-all"
                      id="manual-meal-fat-input"
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

                <div className="col-span-2 sm:col-span-1">
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

              {/* Dynamic Red Alert Warning in Manual Meal Modal for Calories or Fat */}
              {(() => {
                const addedCal = Math.max(0, parseInt(manualCalories) || 0);
                const addedFat = Math.max(0, parseFloat(manualFat) || 0);
                const projectedCalTotal = currentDayCalories + addedCal;
                const projectedFatTotal = currentDayFat + addedFat;
                const isCalOver = Boolean(dailyCalorieTarget && manualCalories && projectedCalTotal - dailyCalorieTarget >= 50);
                const isFatOver = Boolean(dailyFatTarget && manualFat && projectedFatTotal > dailyFatTarget);

                if (isCalOver || isFatOver) {
                  return (
                    <div className="p-3.5 bg-red-50 border-2 border-red-500 rounded-2xl flex items-start gap-3 text-xs font-bold text-red-950 shadow-2xs animate-fadeIn">
                      <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5 animate-pulse" />
                      <div className="space-y-1">
                        <span className="block font-black uppercase tracking-wide text-red-700">
                          Red Alert Warning: Limit Exceeded
                        </span>
                        {isCalOver && (
                          <p>
                            Calories: will reach <span className="font-mono font-black">{projectedCalTotal} kcal</span> (+{projectedCalTotal - dailyCalorieTarget!} kcal over daily target).
                          </p>
                        )}
                        {isFatOver && (
                          <p>
                            Fats: will reach <span className="font-mono font-black">{projectedFatTotal}g</span> (+{projectedFatTotal - dailyFatTarget!}g over daily target). Going above your fat target triggers a red alert — back off!
                          </p>
                        )}
                      </div>
                    </div>
                  );
                }
                return null;
              })()}

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
