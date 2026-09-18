import React, { useState, useMemo, useEffect } from 'react';
import { UserGoals, DailyLog } from '../types';
import { formatDateDDMMYYYY, getTodayString } from '../dateUtils';
import {
  Settings,
  Check,
  Sparkles,
  Scale,
  Calendar,
  Plus,
  Trash2,
  History,
  Flame,
  Zap,
  User,
  Target,
  Dumbbell,
  Activity,
  ShieldCheck,
  RefreshCw,
  Info,
  X,
  AlertTriangle,
  Utensils,
  Layers
} from 'lucide-react';

interface GoalsConfigProps {
  goals: UserGoals;
  onUpdateGoals: (goals: UserGoals) => void;
  onLogWeight?: (date: string, weight: number) => void;
  onDeleteWeight?: (date: string) => void;
  logs?: DailyLog[];
}

const ACTIVITY_OPTIONS = [
  {
    id: 'sedentary',
    title: 'Sedentary',
    mult: '1.2x',
    desc: 'Desk job, sitting most of the day, no heavy physical labor',
    icon: User,
    badge: 'Desk Job Baseline'
  },
  {
    id: 'light',
    title: 'Lightly Active',
    mult: '1.375x',
    desc: 'Desk job + 3–5 lifting or light cardio sessions/week',
    icon: Activity,
    badge: 'Recommended for Desk + Gym',
    isBestFit: true
  },
  {
    id: 'moderate',
    title: 'Moderately Active',
    mult: '1.55x',
    desc: 'Standing job (waiter/nurse) or daily intense athletic training (60+ mins)',
    icon: Dumbbell
  },
  {
    id: 'active',
    title: 'Very Active',
    mult: '1.725x',
    desc: 'Heavy physical labor job (construction) + daily training',
    icon: Zap
  },
  {
    id: 'extreme',
    title: 'Extra Active',
    mult: '1.9x',
    desc: 'Endurance athlete or 2x daily intense double sessions',
    icon: Flame
  }
];

export default function GoalsConfig({ goals, onUpdateGoals, onLogWeight, onDeleteWeight, logs = [] }: GoalsConfigProps) {
  // Physical & Metabolic Parameters (Card 1)
  const [currentWeight, setCurrentWeight] = useState(goals.currentWeight.toString());
  const [targetWeight, setTargetWeight] = useState(goals.targetWeight.toString());
  const [weightUnit, setWeightUnit] = useState<UserGoals['weightUnit']>(goals.weightUnit);
  const [currentHeight, setCurrentHeight] = useState((goals.currentHeight || 178).toString());
  const [gender, setGender] = useState<'male' | 'female'>(goals.gender || 'male');
  const [age, setAge] = useState((goals.age || 25).toString());
  const [activityLevel, setActivityLevel] = useState<NonNullable<UserGoals['activityLevel']>>(goals.activityLevel || 'moderate');
  const [bodyFat, setBodyFat] = useState(goals.bodyFat ? goals.bodyFat.toString() : '');

  // Modal toggle state for activity selection
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [card1Saved, setCard1Saved] = useState(false);

  // Prevent background scrolling when the activity modal is open
  useEffect(() => {
    if (showActivityModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [showActivityModal]);

  // Daily Anabolic Macro Targets (Card 2)
  const [protein, setProtein] = useState(goals.dailyProteinTarget.toString());
  const [carbs, setCarbs] = useState((goals.dailyCarbsTarget || 250).toString());
  const [fat, setFat] = useState((goals.dailyFatTarget || 78).toString());
  const [fiber, setFiber] = useState((goals.dailyFiberTarget || 30).toString());
  const [calories, setCalories] = useState(goals.dailyCalorieTarget.toString());
  const [workoutDays, setWorkoutDays] = useState(goals.weeklyWorkoutDaysTarget.toString());
  
  const [saved, setSaved] = useState(false);
  const [isAutoSyncing, setIsAutoSyncing] = useState(false);

  // Weight entry logging state (Card 3)
  const [logWeightInput, setLogWeightInput] = useState(() => goals.currentWeight.toString());
  const [logDateInput, setLogDateInput] = useState(() => getTodayString());
  const [showHistoryList, setShowHistoryList] = useState(false);
  const [weightSavedAlert, setWeightSavedAlert] = useState<string | null>(null);

  // Compute weight logs history
  const allWeightEntries = useMemo(() => {
    return logs
      .filter((l) => typeof l.weight === 'number' && !isNaN(l.weight) && l.weight! > 0)
      .map((l) => ({ date: l.date, weight: l.weight! }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [logs]);

  // Sync state with props on change
  useEffect(() => {
    setCurrentWeight(goals.currentWeight.toString());
    setTargetWeight(goals.targetWeight.toString());
    setWeightUnit(goals.weightUnit);
    setCurrentHeight((goals.currentHeight || 178).toString());
    setGender(goals.gender || 'male');
    setAge((goals.age || 25).toString());
    setActivityLevel(goals.activityLevel || 'moderate');
    setBodyFat(goals.bodyFat ? goals.bodyFat.toString() : '');
    setProtein(goals.dailyProteinTarget.toString());
    setCarbs((goals.dailyCarbsTarget || 250).toString());
    setFat((goals.dailyFatTarget || 78).toString());
    setFiber((goals.dailyFiberTarget || 30).toString());
    setCalories(goals.dailyCalorieTarget.toString());
    setWorkoutDays(goals.weeklyWorkoutDaysTarget.toString());
    setLogWeightInput(goals.currentWeight.toString());
  }, [goals]);

  // Scientific BMR and TDEE calculations engine
  const liveMetabolicStats = useMemo(() => {
    const weightNum = parseFloat(currentWeight) || 75;
    const heightNum = parseFloat(currentHeight) || 178;
    const ageNum = parseInt(age) || 25;
    const bfNum = parseFloat(bodyFat);

    const weightKg = weightUnit === 'lbs' ? weightNum * 0.45359237 : weightNum;
    const weightLbs = weightUnit === 'lbs' ? weightNum : weightNum * 2.20462;

    if (weightKg <= 0 || heightNum <= 0 || ageNum <= 0) {
      return { bmr: 1750, tdee: 2400, leanBulkCalories: 2750, targetProtein: 165, targetCarbs: 320, targetFiber: 33, targetFat: 76, targetFatKcal: 688 };
    }

    let bmr = 0;
    let formulaName = 'Mifflin-St Jeor';
    if (!isNaN(bfNum) && bfNum > 3 && bfNum < 60) {
      const leanMassKg = weightKg * (1 - bfNum / 100);
      bmr = Math.round(370 + 21.6 * leanMassKg);
      formulaName = 'Katch-McArdle (Lean Mass)';
    } else {
      const base = 10 * weightKg + 6.25 * heightNum - 5 * ageNum;
      bmr = Math.round(gender === 'male' ? base + 5 : base - 161);
    }

    const multMap: Record<string, number> = {
      sedentary: 1.2,
      light: 1.375,
      moderate: 1.55,
      active: 1.725,
      extreme: 1.9
    };

    const multiplier = multMap[activityLevel] || 1.55;
    const tdee = Math.round(bmr * multiplier);
    const leanBulkCalories = Math.round(tdee + 350); // Hypertrophy surplus (+350 kcal)

    // Recommended Macro Split for Hypertrophy
    const targetProtein = Math.round(weightLbs * 1.0); // 1.0g per lb bodyweight
    const targetFatKcal = Math.round(leanBulkCalories * 0.25);
    const targetFat = Math.round(targetFatKcal / 9); // 9 kcal per gram of fat
    const targetProteinKcal = targetProtein * 4;
    const targetCarbsKcal = Math.max(0, leanBulkCalories - targetProteinKcal - targetFatKcal);
    const targetCarbs = Math.round(targetCarbsKcal / 4);
    const targetFiber = Math.round((leanBulkCalories / 1000) * 12);

    return {
      bmr,
      tdee,
      multiplier,
      formulaName,
      leanBulkCalories,
      targetProtein,
      targetCarbs,
      targetFiber,
      targetFat,
      targetFatKcal
    };
  }, [gender, age, currentHeight, currentWeight, weightUnit, activityLevel, bodyFat]);

  // Auto-calculate macro targets whenever Card 1 physical parameters change
  const applyBmrCalculations = () => {
    setProtein(liveMetabolicStats.targetProtein.toString());
    setCarbs(liveMetabolicStats.targetCarbs.toString());
    setFat(liveMetabolicStats.targetFat.toString());
    setFiber(liveMetabolicStats.targetFiber.toString());
    setCalories(liveMetabolicStats.leanBulkCalories.toString());

    setIsAutoSyncing(true);
    setTimeout(() => setIsAutoSyncing(false), 2000);
  };

  // Automatically sync targets when physical inputs change
  useEffect(() => {
    setProtein(liveMetabolicStats.targetProtein.toString());
    setCarbs(liveMetabolicStats.targetCarbs.toString());
    setFat(liveMetabolicStats.targetFat.toString());
    setFiber(liveMetabolicStats.targetFiber.toString());
    setCalories(liveMetabolicStats.leanBulkCalories.toString());
  }, [liveMetabolicStats.targetProtein, liveMetabolicStats.targetCarbs, liveMetabolicStats.targetFat, liveMetabolicStats.targetFiber, liveMetabolicStats.leanBulkCalories]);

  const handleSaveSpecificWeight = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(logWeightInput);
    if (isNaN(val) || val <= 0) return;

    if (onLogWeight) {
      onLogWeight(logDateInput, val);
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
    const parsedBodyFat = parseFloat(bodyFat);

    onUpdateGoals({
      ...goals,
      currentWeight: parsedCurrentWeight,
      targetWeight: parseFloat(targetWeight) || 80,
      weightUnit,
      currentHeight: parseFloat(currentHeight) || 178,
      gender,
      age: parseInt(age) || 25,
      activityLevel,
      bodyFat: !isNaN(parsedBodyFat) && parsedBodyFat > 0 ? parsedBodyFat : undefined,
      dailyProteinTarget: parseFloat(protein) || 150,
      dailyCarbsTarget: parseFloat(carbs) || 250,
      dailyFatTarget: parseFloat(fat) || 78,
      dailyFiberTarget: parseFloat(fiber) || 30,
      dailyCalorieTarget: parseInt(calories) || 2500,
      weeklyWorkoutDaysTarget: parseInt(workoutDays) || 5
    });

    if (onLogWeight && parsedCurrentWeight > 0) {
      onLogWeight(getTodayString(), parsedCurrentWeight);
    }

    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="space-y-6" id="goals-config-cards-wrapper">
      {/* CARD 1: Physical Profile & BMR Parameters */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5" id="card-physical-profile">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
              <User className="w-5 h-5 text-indigo-600" />
              1. Physical Profile & Metabolic Parameters
            </h2>
            <p className="text-slate-500 text-xs mt-0.5">
              Input sex, age, height, weight, and activity level to calculate baseline BMR & TDEE
            </p>
          </div>
          <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 text-[11px] font-black rounded-lg border border-indigo-100 flex items-center gap-1 shrink-0">
            <Sparkles className="w-3.5 h-3.5" /> Direct BMR Source
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Sex / Gender */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Sex</label>
            <div className="grid grid-cols-2 gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setGender('male')}
                className={`w-full py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center text-center ${
                  gender === 'male'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Male
              </button>
              <button
                type="button"
                onClick={() => setGender('female')}
                className={`w-full py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center text-center ${
                  gender === 'female'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Female
              </button>
            </div>
          </div>

          {/* Age */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Age (Years)</label>
            <input
              type="number"
              min={12}
              max={100}
              required
              value={age}
              onChange={(e) => setAge(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl px-3.5 py-2 text-sm font-bold text-slate-900 focus:outline-none transition-all"
            />
          </div>

          {/* Height */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Height (cm)</label>
            <div className="relative">
              <input
                type="number"
                step="1"
                required
                value={currentHeight}
                onChange={(e) => setCurrentHeight(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl px-3.5 py-2 text-sm font-bold text-slate-900 focus:outline-none transition-all"
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">cm</span>
            </div>
          </div>

          {/* Weight Unit */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Weight Unit</label>
            <div className="grid grid-cols-2 gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setWeightUnit('lbs')}
                className={`w-full py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center text-center ${
                  weightUnit === 'lbs'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                lbs
              </button>
              <button
                type="button"
                onClick={() => setWeightUnit('kg')}
                className={`w-full py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center text-center ${
                  weightUnit === 'kg'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                kg
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Current Weight */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Current Weight</label>
            <div className="relative">
              <input
                type="number"
                step="0.1"
                required
                value={currentWeight}
                onChange={(e) => setCurrentWeight(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl px-3.5 py-2 text-sm font-bold text-slate-900 focus:outline-none transition-all"
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">{weightUnit}</span>
            </div>
          </div>

          {/* Target Weight */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Target Weight</label>
            <div className="relative">
              <input
                type="number"
                step="0.1"
                required
                value={targetWeight}
                onChange={(e) => setTargetWeight(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl px-3.5 py-2 text-sm font-bold text-slate-900 focus:outline-none transition-all"
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">{weightUnit}</span>
            </div>
          </div>

          {/* Body Fat % */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Body Fat %
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.5"
                min="3"
                max="60"
                placeholder="e.g. 15"
                value={bodyFat}
                onChange={(e) => setBodyFat(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl px-3.5 py-2 text-sm font-bold text-slate-900 focus:outline-none transition-all"
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">%</span>
            </div>
          </div>
        </div>

        {/* Daily Activity Level Compact Selector */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-slate-700">
            Daily Activity Level & TDEE Multiplier
          </label>
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-indigo-300 transition-all">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 border border-indigo-200 text-indigo-700 flex items-center justify-center font-black shrink-0">
                <Activity className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-slate-900 capitalize">
                    {ACTIVITY_OPTIONS.find((a) => a.id === activityLevel)?.title || activityLevel}
                  </span>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-indigo-100 text-indigo-700">
                    {liveMetabolicStats.multiplier}x Multiplier
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  {ACTIVITY_OPTIONS.find((a) => a.id === activityLevel)?.desc || 'Selected activity multiplier'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowActivityModal(true)}
              className="w-full sm:w-auto px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center text-center gap-1.5 shrink-0"
              id="open-activity-modal-btn"
            >
              <Settings className="w-3.5 h-3.5" />
              Change Activity Level
            </button>
          </div>
        </div>

        {/* Live BMR & TDEE Calculated Indicator Badge */}
        <div className="pt-2 border-t border-slate-100">
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase text-indigo-400 tracking-wider flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-indigo-400" />
                Live Metabolic Calculations &bull; {liveMetabolicStats.formulaName}
              </span>
              <p className="text-xs text-slate-300 font-medium">
                Target calories and macros below auto-update from these scientific metrics
              </p>
            </div>

            <div className="flex items-center gap-4 text-center shrink-0">
              <div className="bg-white/10 px-3 py-1.5 rounded-lg border border-white/10">
                <span className="text-[9px] uppercase font-bold text-indigo-300 block">BMR</span>
                <span className="text-sm font-black font-mono">{liveMetabolicStats.bmr} kcal</span>
              </div>
              <div className="bg-white/10 px-3 py-1.5 rounded-lg border border-white/10">
                <span className="text-[9px] uppercase font-bold text-violet-300 block">TDEE</span>
                <span className="text-sm font-black font-mono">{liveMetabolicStats.tdee} kcal</span>
              </div>
              <div className="bg-indigo-600/80 px-3 py-1.5 rounded-lg border border-indigo-400/40">
                <span className="text-[9px] uppercase font-black text-indigo-100 block">Hypertrophy Goal</span>
                <span className="text-sm font-black font-mono text-white">{liveMetabolicStats.leanBulkCalories} kcal</span>
              </div>
            </div>
          </div>
        </div>

        {/* Safe Save BMR & Physical Settings Button on Card 1 */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100">
          <div className="text-xs font-medium text-slate-500">
            {card1Saved && (
              <span className="text-emerald-600 font-extrabold flex items-center gap-1.5 animate-fadeIn" id="card1-saved-alert">
                <Check className="w-4 h-4 text-emerald-600" />
                BMR & Physical Profile Settings Saved!
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              const parsedCurrentWeight = parseFloat(currentWeight) || 75;
              const parsedBodyFat = parseFloat(bodyFat);

              onUpdateGoals({
                ...goals,
                currentWeight: parsedCurrentWeight,
                targetWeight: parseFloat(targetWeight) || 80,
                weightUnit,
                currentHeight: parseFloat(currentHeight) || 178,
                gender,
                age: parseInt(age) || 25,
                activityLevel,
                bodyFat: !isNaN(parsedBodyFat) && parsedBodyFat > 0 ? parsedBodyFat : undefined,
                dailyProteinTarget: parseFloat(protein) || 150,
                dailyCarbsTarget: parseFloat(carbs) || 250,
                dailyFiberTarget: parseFloat(fiber) || 30,
                dailyCalorieTarget: parseInt(calories) || 2500,
                weeklyWorkoutDaysTarget: parseInt(workoutDays) || 5
              });

              setCard1Saved(true);
              setTimeout(() => setCard1Saved(false), 3000);
            }}
            className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-100 transition-all cursor-pointer flex items-center justify-center text-center gap-2"
            id="save-bmr-settings-btn"
          >
            <Check className="w-4 h-4" />
            Save BMR Settings
          </button>
        </div>
      </div>

      {/* POP-UP MODAL: Daily Activity Level Selection */}
      {showActivityModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-5 shadow-2xl flex flex-col max-h-[85vh] relative">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                  <Activity className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 tracking-tight">Daily Activity Level</h3>
                  <p className="text-[11px] text-slate-500 font-medium">Select multiplier to update your TDEE</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowActivityModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-all cursor-pointer"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Activity Level Options List (Scrollable) */}
            <div className="space-y-2 py-3 overflow-y-auto pr-1 flex-1">
              {ACTIVITY_OPTIONS.map((option) => {
                const isSelected = activityLevel === option.id;
                const IconComponent = option.icon;

                return (
                  <button
                    type="button"
                    key={option.id}
                    onClick={() => setActivityLevel(option.id as any)}
                    className={`w-full p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      isSelected
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className={`p-2 rounded-lg shrink-0 mt-0.5 ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-200/80 text-slate-700'}`}>
                        <IconComponent className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`text-xs font-black ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                            {option.title}
                          </span>
                          <span
                            className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-md ${
                              isSelected ? 'bg-white/20 text-white' : 'bg-indigo-100 text-indigo-800'
                            }`}
                          >
                            {option.mult}
                          </span>
                          {option.badge && (
                            <span
                              className={`text-[9px] font-black uppercase px-1.5 py-0.2 rounded-md ${
                                isSelected ? 'bg-indigo-800 text-indigo-100' : 'bg-indigo-100 text-indigo-700'
                              }`}
                            >
                              {option.badge}
                            </span>
                          )}
                        </div>
                        <p className={`text-[11px] mt-0.5 font-medium leading-snug ${isSelected ? 'text-indigo-100' : 'text-slate-500'}`}>
                          {option.desc}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0 ml-1">
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                          isSelected ? 'border-white bg-white text-indigo-600' : 'border-slate-300'
                        }`}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end border-t border-slate-100 pt-3 shrink-0 w-full">
              <button
                type="button"
                onClick={() => setShowActivityModal(false)}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center text-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CARD 2: Daily Anabolic & Macro Targets */}
      <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5" id="card-macro-targets">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Target className="w-5 h-5 text-indigo-600" />
              2. Daily Anabolic & Macro Targets
            </h2>
            <p className="text-slate-500 text-xs mt-0.5">
              Automatically calculated from your BMR & activity profile above (or fine-tune manually)
            </p>
          </div>

          <button
            type="button"
            onClick={applyBmrCalculations}
            className="w-full sm:w-auto flex items-center justify-center text-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition-all cursor-pointer shrink-0"
            id="recalculate-bmr-btn"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isAutoSyncing ? 'animate-spin' : ''}`} />
            Recalculate from BMR
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {/* Daily Protein Goal */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1.5">Daily Protein Target</label>
            <div className="relative">
              <input
                type="number"
                required
                min="30"
                max="400"
                value={protein}
                onChange={(e) => setProtein(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl px-3.5 py-2 text-sm font-bold text-slate-900 focus:outline-none transition-all"
                id="daily-protein-target-input"
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">g</span>
            </div>
          </div>

          {/* Daily Carbs Goal */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1.5">Daily Carbs Target</label>
            <div className="relative">
              <input
                type="number"
                required
                min="10"
                max="1000"
                value={carbs}
                onChange={(e) => setCarbs(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl px-3.5 py-2 text-sm font-bold text-slate-900 focus:outline-none transition-all"
                id="daily-carbs-target-input"
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">g</span>
            </div>
          </div>

          {/* Daily Fat Goal */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1.5">Daily Fat Target</label>
            <div className="relative">
              <input
                type="number"
                required
                min="10"
                max="300"
                value={fat}
                onChange={(e) => setFat(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl px-3.5 py-2 text-sm font-bold text-slate-900 focus:outline-none transition-all"
                id="daily-fat-target-input"
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">g</span>
            </div>
            <p className="text-xs font-semibold text-slate-500 mt-1">
              Red alert triggers when exceeding this target to help you stay within your fat limits.
            </p>
          </div>

          {/* Daily Fiber Goal */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1.5">Daily Fiber Target</label>
            <div className="relative">
              <input
                type="number"
                required
                min="5"
                max="150"
                value={fiber}
                onChange={(e) => setFiber(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl px-3.5 py-2 text-sm font-bold text-slate-900 focus:outline-none transition-all"
                id="daily-fiber-target-input"
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">g</span>
            </div>
          </div>

          {/* Daily Calorie Goal */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1.5">Daily Calorie Target</label>
            <div className="relative">
              <input
                type="number"
                required
                min="1000"
                max="8000"
                value={calories}
                onChange={(e) => setCalories(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl px-3.5 py-2 text-sm font-bold text-slate-900 focus:outline-none transition-all"
                id="daily-calories-target-input"
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">kcal</span>
            </div>
            <p className="text-xs font-semibold text-slate-500 mt-1">
              Red alert triggers when exceeding this target by 50 or more calories to keep your fat loss on track.
            </p>
          </div>

          {/* Weekly Workouts Goal */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1.5">Weekly Workouts Goal</label>
            <div className="relative">
              <input
                type="number"
                required
                min="1"
                max="7"
                value={workoutDays}
                onChange={(e) => setWorkoutDays(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl px-3.5 py-2 text-sm font-bold text-slate-900 focus:outline-none transition-all"
                id="weekly-workouts-target-input"
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">days</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100">
          <div className="text-sm text-slate-500 font-medium">
            {saved && (
              <span className="text-emerald-600 font-extrabold flex items-center gap-1.5 animate-fadeIn" id="goals-saved-alert">
                <Check className="w-4 h-4 text-emerald-600" />
                All Settings & Macro Targets Saved Successfully!
              </span>
            )}
          </div>

          <button
            type="submit"
            className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl shadow-md shadow-indigo-100 hover:shadow-indigo-200 transition-all cursor-pointer flex items-center justify-center text-center gap-2"
            id="save-goals-btn"
          >
            <Check className="w-4 h-4" />
            Save Profile & Targets
          </button>
        </div>
      </form>

      {/* CARD 3: Scale Weight Log & History */}
      {onLogWeight && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4" id="card-scale-weight-log">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                <Scale className="w-5 h-5 text-purple-600" />
                3. Scale Weight Log and History
              </h2>
              <p className="text-slate-500 text-sm mt-0.5">Record or edit scale weight entries for specific dates</p>
            </div>

            <button
              type="button"
              onClick={() => setShowHistoryList(!showHistoryList)}
              className={`w-full sm:w-auto flex items-center justify-center text-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                showHistoryList
                  ? 'bg-purple-50 text-purple-700 border-purple-200'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              {showHistoryList ? 'Hide Log History' : `View Log History (${allWeightEntries.length})`}
            </button>
          </div>

          <form onSubmit={handleSaveSpecificWeight} className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 sm:space-y-0 sm:flex sm:items-center sm:gap-3">
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

            <div className="pt-2 sm:pt-4 w-full sm:w-auto">
              <button
                type="submit"
                className="w-full sm:w-auto px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all cursor-pointer flex items-center justify-center text-center gap-1.5"
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
                        <span className="font-bold text-slate-700 font-mono">{formatDateDDMMYYYY(entry.date)}</span>
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
