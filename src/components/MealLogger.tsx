import React, { useState } from 'react';
import { Meal } from '../types';
import { Plus, Flame, Clock, PlusCircle, Check, HelpCircle, Utensils } from 'lucide-react';

interface MealLoggerProps {
  onAddMeal: (meal: Omit<Meal, 'id' | 'timestamp'> & { timestamp?: string }) => void;
}

interface NutritionPreset {
  name: string;
  protein: number;
  calories: number;
  category: string;
  icon: string;
  desc: string;
}

const NUTRITION_GUIDE_PRESETS: NutritionPreset[] = [
  // Lean Proteins
  { name: 'Chicken Breast & Jasmine Rice', protein: 48, calories: 580, category: 'Lean Proteins', icon: '🍗', desc: 'Provides essential amino acids for muscle repair.' },
  { name: 'Salmon Fillet & Sweet Potato', protein: 38, calories: 610, category: 'Lean Proteins', icon: '🐟', desc: 'Rich in healthy omega-3 fats & repair blocks.' },
  { name: 'Scrambled Eggs (3 Whole)', protein: 18, calories: 220, category: 'Lean Proteins', icon: '🍳', desc: 'High-quality complete protein & energy source.' },
  
  // Complex Carbs
  { name: 'Sweet Potato Bowl with Honey', protein: 3, calories: 210, category: 'Complex Carbs', icon: '🍠', desc: 'Replenishes muscle glycogen stores.' },
  { name: 'Brown Rice & Olive Oil Bowl', protein: 5, calories: 280, category: 'Complex Carbs', icon: '🍚', desc: 'Steady energy for intense workouts.' },

  // Dairy & Shakes
  { name: 'Muscle-Building Protein Shake', protein: 30, calories: 380, category: 'Muscle Shakes', icon: '🥤', desc: 'Fast-digesting proteins post-workout.' },
  { name: 'Greek Yogurt Bowl', protein: 22, calories: 190, category: 'Dairy & Alternatives', icon: '🥛', desc: 'Rich in sustained-release casein protein.' },

  // Calorie-Dense Options
  { name: 'Anabolic Cheese Pizza Slice', protein: 15, calories: 320, category: 'Calorie-Dense Options', icon: '🍕', desc: 'Provides a substantial calorie & carb boost.' },
  { name: 'Peanut Butter Oatmeal Bowl', protein: 16, calories: 450, category: 'Healthy Fats', icon: '🥜', desc: 'Healthy calorie multiplier.' }
];

export default function MealLogger({ onAddMeal }: MealLoggerProps) {
  const [name, setName] = useState('');
  const [protein, setProtein] = useState('');
  const [calories, setCalories] = useState('');
  
  // Set default timestamp to current HH:MM in 24h format
  const [timestamp, setTimestamp] = useState(() => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  });

  const [logSuccess, setLogSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !protein || !calories) return;

    onAddMeal({
      name: name.trim(),
      protein: Math.max(0, parseFloat(protein) || 0),
      calories: Math.max(0, parseInt(calories) || 0),
      timestamp: timestamp || undefined
    });

    // Flash success
    setLogSuccess(true);
    setTimeout(() => setLogSuccess(false), 2000);

    // Reset simple form fields (keep current time or let them change it)
    setName('');
    setProtein('');
    setCalories('');
  };

  const handlePresetClick = (preset: NutritionPreset) => {
    onAddMeal({
      name: preset.name,
      protein: preset.protein,
      calories: preset.calories,
      timestamp: timestamp || undefined
    });

    // Flash success
    setLogSuccess(true);
    setTimeout(() => setLogSuccess(false), 2000);
  };

  return (
    <div className="space-y-8" id="meal-logger-section">
      
      {/* 1. Direct clear input card */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-10 shadow-sm">
        <div className="flex items-center gap-4 mb-8">
          <div className="p-3.5 bg-indigo-50 text-indigo-600 rounded-2xl">
            <Utensils className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight leading-none">Log Food & Fuel</h2>
            <p className="text-slate-500 text-sm mt-2 font-semibold">Add what you ate and at what time to track protein timing</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6" id="custom-meal-form">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
            
            {/* Meal Name Input - Prominent */}
            <div className="md:col-span-5">
              <label className="block text-sm font-black text-slate-500 uppercase tracking-wider mb-2">What did you eat?</label>
              <input
                type="text"
                required
                placeholder="e.g. Scrambled eggs and whole-wheat toast"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-2xl px-5 py-3.5 text-base text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all"
                id="meal-name-input"
              />
            </div>

            {/* Protein Input */}
            <div className="md:col-span-2">
              <label className="block text-sm font-black text-slate-500 uppercase tracking-wider mb-2">Protein</label>
              <div className="relative">
                <input
                  type="number"
                  required
                  min="0"
                  max="300"
                  placeholder="e.g. 25"
                  value={protein}
                  onChange={(e) => setProtein(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-2xl pl-5 pr-10 py-3.5 text-base text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all font-mono font-bold"
                  id="meal-protein-input"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-black text-slate-400 font-mono">g</span>
              </div>
            </div>

            {/* Calories Input */}
            <div className="md:col-span-2">
              <label className="block text-sm font-black text-slate-500 uppercase tracking-wider mb-2">Calories</label>
              <div className="relative">
                <input
                  type="number"
                  required
                  min="0"
                  max="3000"
                  placeholder="e.g. 400"
                  value={calories}
                  onChange={(e) => setCalories(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-2xl pl-5 pr-12 py-3.5 text-base text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all font-mono font-bold"
                  id="meal-calories-input"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-black text-slate-400 font-mono">kcal</span>
              </div>
            </div>

            {/* Time of Meal Input */}
            <div className="md:col-span-3">
              <label className="block text-sm font-black text-slate-500 uppercase tracking-wider mb-2">What time?</label>
              <div className="relative">
                <input
                  type="time"
                  required
                  value={timestamp}
                  onChange={(e) => setTimestamp(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-2xl pl-12 pr-5 py-3.5 text-base text-slate-900 focus:outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all font-mono font-bold cursor-pointer"
                  id="meal-time-input"
                />
                <Clock className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
              </div>
            </div>

          </div>

          <div className="flex flex-col gap-5 pt-4 border-t border-slate-100">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <span className="text-sm text-slate-500 font-bold italic">
                ✨ Protein timing matters: try to eat high-quality protein every 3-4 hours.
              </span>
              {logSuccess && (
                <span className="text-sm font-black text-emerald-600 flex items-center justify-center gap-1.5 animate-pulse py-1">
                  <Check className="w-5 h-5 stroke-[3]" /> Logged Successfully!
                </span>
              )}
            </div>
            
            <button
              type="submit"
              className="w-full px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-base rounded-2xl shadow-md hover:shadow-lg transition-all cursor-pointer active:scale-95 flex items-center justify-center gap-2"
              id="submit-custom-meal-btn"
            >
              <Plus className="w-5.5 h-5.5 stroke-[3]" />
              Log Entry Now
            </button>
          </div>
        </form>
      </div>

      {/* 2. Presets Grid - From PDF Nutrition Guide */}
      <div className="space-y-4">
        <div className="flex justify-between items-center px-1">
          <div>
            <h3 className="text-base font-black text-slate-800 uppercase tracking-wider">Muscle-Building Guide Quick Presets</h3>
            <p className="text-slate-400 text-sm mt-1">Quick-tap any high-quality food from your nutrition plan to instantly record it</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" id="meal-presets-grid">
          {NUTRITION_GUIDE_PRESETS.map((preset, index) => (
            <button
              key={index}
              onClick={() => handlePresetClick(preset)}
              className="group relative flex text-left p-5 rounded-2xl bg-white hover:bg-indigo-50/20 border border-slate-200 hover:border-indigo-500/30 transition-all duration-200 overflow-hidden cursor-pointer shadow-sm active:scale-98"
            >
              {/* Giant watermarked Emoji back-layer */}
              <span className="absolute right-3 bottom-0 text-6xl opacity-10 select-none pointer-events-none group-hover:scale-110 transition-transform duration-300">
                {preset.icon}
              </span>

              <div className="flex items-start gap-4 z-10 w-full">
                <div className="text-4xl p-2.5 bg-slate-50 group-hover:bg-white rounded-xl border border-slate-100 transition-colors shadow-xs">
                  {preset.icon}
                </div>
                
                <div className="flex-1 min-w-0 pr-6">
                  <span className="text-[11px] font-black uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md">
                    {preset.category}
                  </span>
                  <h4 className="text-base font-black text-slate-800 mt-2 group-hover:text-indigo-950 transition-colors truncate">
                    {preset.name}
                  </h4>
                  <p className="text-xs text-slate-400 mt-1 leading-tight font-medium line-clamp-1">
                    {preset.desc}
                  </p>

                  <div className="flex items-center gap-3 mt-4">
                    <span className="text-xs bg-slate-100 group-hover:bg-indigo-500/10 group-hover:text-indigo-700 px-2.5 py-1 rounded-md font-black font-mono transition-colors">
                      {preset.protein}g Protein
                    </span>
                    <span className="text-xs text-slate-500 font-mono font-bold flex items-center gap-1">
                      <Flame className="w-3.5 h-3.5 text-amber-500/70 fill-amber-500/10" />
                      {preset.calories} kcal
                    </span>
                  </div>
                </div>
              </div>

              {/* Instant Tap Icon */}
              <PlusCircle className="absolute top-5 right-5 w-5.5 h-5.5 text-slate-300 group-hover:text-indigo-600 transition-colors" />
            </button>
          ))}
        </div>
      </div>

    </div>
  );
}
