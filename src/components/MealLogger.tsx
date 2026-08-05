import React, { useState, useRef } from 'react';
import { Meal } from '../types';
import { Plus, Clock, Check, Utensils, Camera, Sparkles, Loader2, X, RefreshCw, CheckCircle2, Image as ImageIcon, Trash2, FolderPlus } from 'lucide-react';

interface MealLoggerProps {
  onAddMeal: (meal: Omit<Meal, 'id' | 'timestamp'> & { timestamp?: string }) => void;
  timestamp: string;
  setTimestamp: (time: string) => void;
}

export default function MealLogger({ onAddMeal, timestamp, setTimestamp }: MealLoggerProps) {
  const [name, setName] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fiber, setFiber] = useState('');
  const [calories, setCalories] = useState('');
  
  const [logSuccess, setLogSuccess] = useState(false);

  // AI Modal & Analysis State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [foodHint, setFoodHint] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [detectedData, setDetectedData] = useState<{ name: string; protein: number; carbs: number; fiber: number; calories: number } | null>(null);
  const [isFieldsHighlighted, setIsFieldsHighlighted] = useState(false);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const handleOpenModal = () => {
    setIsModalOpen(true);
    setAiError(null);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

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
      setAiError('Please attach photo(s) OR enter a text description of your meal to analyze.');
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

      setDetectedData({
        name: data.name || (hintText.trim() ? hintText.trim().slice(0, 40) : 'Detected Meal'),
        protein: data.protein ?? 0,
        carbs: data.carbs ?? 0,
        fiber: data.fiber ?? 0,
        calories: data.calories ?? 0
      });
    } catch (err: any) {
      console.error('AI Food Analysis Error:', err);
      setAiError(err.message || 'Error analyzing meal. Please try again or fill in manually.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleApplyDetectedData = () => {
    if (!detectedData) return;

    setName(detectedData.name);
    setProtein(String(detectedData.protein));
    setCarbs(String(detectedData.carbs));
    setFiber(String(detectedData.fiber));
    setCalories(String(detectedData.calories));

    setIsModalOpen(false);
    setIsFieldsHighlighted(true);
    setTimeout(() => setIsFieldsHighlighted(false), 2500);
  };

  const handleResetModalImage = () => {
    setImagePreviews([]);
    setDetectedData(null);
    setAiError(null);
    if (cameraInputRef.current) {
      cameraInputRef.current.value = '';
    }
    if (galleryInputRef.current) {
      galleryInputRef.current.value = '';
    }
  };

  const isFormValid =
    name.trim().length > 0 &&
    protein.trim() !== '' && !isNaN(Number(protein)) && Number(protein) >= 0 &&
    carbs.trim() !== '' && !isNaN(Number(carbs)) && Number(carbs) >= 0 &&
    fiber.trim() !== '' && !isNaN(Number(fiber)) && Number(fiber) >= 0 &&
    calories.trim() !== '' && !isNaN(Number(calories)) && Number(calories) >= 0 &&
    timestamp.trim().length > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;

    onAddMeal({
      name: name.trim(),
      protein: Math.max(0, parseFloat(protein) || 0),
      carbs: Math.max(0, parseFloat(carbs) || 0),
      fiber: Math.max(0, parseFloat(fiber) || 0),
      calories: Math.max(0, parseInt(calories) || 0),
      timestamp: timestamp || undefined
    });

    // Flash success
    setLogSuccess(true);
    setTimeout(() => setLogSuccess(false), 2000);

    // Reset simple form fields
    setName('');
    setProtein('');
    setCarbs('');
    setFiber('');
    setCalories('');
    setImagePreviews([]);
    setFoodHint('');
    setDetectedData(null);
    setAiError(null);
    if (cameraInputRef.current) cameraInputRef.current.value = '';
    if (galleryInputRef.current) galleryInputRef.current.value = '';
  };

  return (
    <div className="space-y-8" id="meal-logger-section">
      
      {/* Main Food Logger Card */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-10 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-start gap-4">
            <div className="p-3.5 bg-indigo-50 text-indigo-600 rounded-2xl shrink-0 mt-0.5">
              <Utensils className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight leading-none">Log Food & Fuel</h2>
              <p className="text-slate-500 text-sm mt-2 font-semibold">
                Snap or upload plate photos with Gemini AI or enter details manually below
              </p>
            </div>
          </div>

          {/* Single AI Photo Scan Button */}
          <button
            type="button"
            onClick={handleOpenModal}
            className="px-5 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 active:scale-95 text-white rounded-2xl text-xs font-black shadow-md hover:shadow-indigo-500/20 transition-all flex items-center justify-center gap-2.5 cursor-pointer shrink-0"
            id="ai-plate-scan-btn"
          >
            <Camera className="w-4 h-4" />
            <Sparkles className="w-3.5 h-3.5" />
            <span>Scan Plate(s) with AI</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6" id="custom-meal-form">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-5">
            
            {/* Meal Name Input */}
            <div className="sm:col-span-2 lg:col-span-4">
              <label className="block text-sm font-black text-slate-500 uppercase tracking-wider mb-2">What did you eat?</label>
              <input
                type="text"
                required
                placeholder="e.g. Scrambled eggs and whole-wheat toast"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={`w-full bg-slate-50 border transition-all duration-300 rounded-2xl px-5 py-3.5 text-base text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/5 ${
                  isFieldsHighlighted
                    ? 'border-indigo-500 ring-4 ring-indigo-500/20 bg-indigo-50/30'
                    : 'border-slate-200 focus:border-indigo-500 focus:bg-white'
                }`}
                id="meal-name-input"
              />
            </div>

            {/* Protein Input */}
            <div className="lg:col-span-2">
              <label className="block text-sm font-black text-slate-500 uppercase tracking-wider mb-2">Protein</label>
              <div className="relative">
                <input
                  type="number"
                  required
                  step="any"
                  min="0"
                  max="300"
                  placeholder="e.g. 25"
                  value={protein}
                  onChange={(e) => setProtein(e.target.value)}
                  className={`w-full bg-slate-50 border transition-all duration-300 rounded-2xl pl-5 pr-10 py-3.5 text-base text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/5 font-mono font-bold ${
                    isFieldsHighlighted
                      ? 'border-indigo-500 ring-4 ring-indigo-500/20 bg-indigo-50/30'
                      : 'border-slate-200 focus:border-indigo-500 focus:bg-white'
                  }`}
                  id="meal-protein-input"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-black text-slate-400 font-mono">g</span>
              </div>
            </div>

            {/* Carbs Input */}
            <div className="lg:col-span-2">
              <label className="block text-sm font-black text-slate-500 uppercase tracking-wider mb-2">Carbs</label>
              <div className="relative">
                <input
                  type="number"
                  step="any"
                  min="0"
                  max="500"
                  placeholder="e.g. 45"
                  value={carbs}
                  onChange={(e) => setCarbs(e.target.value)}
                  className={`w-full bg-slate-50 border transition-all duration-300 rounded-2xl pl-5 pr-10 py-3.5 text-base text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/5 font-mono font-bold ${
                    isFieldsHighlighted
                      ? 'border-indigo-500 ring-4 ring-indigo-500/20 bg-indigo-50/30'
                      : 'border-slate-200 focus:border-indigo-500 focus:bg-white'
                  }`}
                  id="meal-carbs-input"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-black text-slate-400 font-mono">g</span>
              </div>
            </div>

            {/* Fiber Input */}
            <div className="lg:col-span-2">
              <label className="block text-sm font-black text-slate-500 uppercase tracking-wider mb-2">Fiber</label>
              <div className="relative">
                <input
                  type="number"
                  step="any"
                  min="0"
                  max="100"
                  placeholder="e.g. 6"
                  value={fiber}
                  onChange={(e) => setFiber(e.target.value)}
                  className={`w-full bg-slate-50 border transition-all duration-300 rounded-2xl pl-5 pr-10 py-3.5 text-base text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/5 font-mono font-bold ${
                    isFieldsHighlighted
                      ? 'border-indigo-500 ring-4 ring-indigo-500/20 bg-indigo-50/30'
                      : 'border-slate-200 focus:border-indigo-500 focus:bg-white'
                  }`}
                  id="meal-fiber-input"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-black text-slate-400 font-mono">g</span>
              </div>
            </div>

            {/* Calories Input */}
            <div className="lg:col-span-2">
              <label className="block text-sm font-black text-slate-500 uppercase tracking-wider mb-2">Calories</label>
              <div className="relative">
                <input
                  type="number"
                  required
                  step="any"
                  min="0"
                  max="3000"
                  placeholder="e.g. 400"
                  value={calories}
                  onChange={(e) => setCalories(e.target.value)}
                  className={`w-full bg-slate-50 border transition-all duration-300 rounded-2xl pl-5 pr-12 py-3.5 text-base text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/5 font-mono font-bold ${
                    isFieldsHighlighted
                      ? 'border-indigo-500 ring-4 ring-indigo-500/20 bg-indigo-50/30'
                      : 'border-slate-200 focus:border-indigo-500 focus:bg-white'
                  }`}
                  id="meal-calories-input"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-black text-slate-400 font-mono">kcal</span>
              </div>
            </div>

          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-5 pt-2">
            {/* Time of Meal Input */}
            <div className="md:col-span-4">
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
              disabled={!isFormValid}
              className="w-full px-8 py-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-black text-base rounded-2xl shadow-md hover:shadow-lg disabled:shadow-none transition-all cursor-pointer active:scale-95 flex items-center justify-center gap-2"
              id="submit-custom-meal-btn"
            >
              <Plus className="w-5.5 h-5.5 stroke-[3]" />
              Log Entry Now
            </button>
          </div>
        </form>
      </div>

      {/* Hidden File Inputs for Camera and Photo Library Selection */}
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

      {/* Full-Screen Page Overlay for AI Plate Scanning */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/85 backdrop-blur-md flex flex-col p-3 sm:p-6 md:p-8 overflow-y-auto animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-3xl w-full mx-auto p-6 sm:p-8 shadow-2xl border border-slate-100 relative space-y-6 my-auto">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-2xl shadow-md">
                  <Camera className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">Gemini AI Food & Meal Analyzer</h3>
                  <p className="text-xs sm:text-sm text-slate-500 font-medium">Attach photo(s) of your meal OR type a text description to auto-estimate macros & calories</p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCloseModal}
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
                  Food Description / Ingredients (Text Analysis or Photo Hint)
                </label>
                <textarea
                  rows={5}
                  placeholder="Describe your meal in detail to analyze via text (e.g. 2 scrambled eggs, 2 slices whole wheat toast with butter, 1 cup orange juice) or add hints for photo analysis..."
                  value={foodHint}
                  onChange={(e) => setFoodHint(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-2xl p-4 text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 min-h-[8rem] max-h-[16rem] resize-y transition-all"
                  id="food-hint-textarea"
                />
              </div>

              {/* Photo Area */}
              {imagePreviews.length === 0 ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      className="border-2 border-dashed border-indigo-200 hover:border-indigo-400 bg-indigo-50/40 hover:bg-indigo-50/80 rounded-2xl p-5 text-center cursor-pointer transition-all space-y-2 group"
                      id="open-camera-btn"
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
                      className="border-2 border-dashed border-purple-200 hover:border-purple-400 bg-purple-50/40 hover:bg-purple-50/80 rounded-2xl p-5 text-center cursor-pointer transition-all space-y-2 group"
                      id="open-gallery-btn"
                    >
                      <div className="w-11 h-11 bg-purple-600 text-white rounded-2xl mx-auto flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                        <ImageIcon className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-900">Choose from Photo Library</p>
                        <p className="text-xs text-slate-500 font-medium mt-0.5">Select 1 or multiple saved photos</p>
                      </div>
                    </button>
                  </div>

                  {/* Text-Only Analyze Action */}
                  {isAnalyzing ? (
                    <div className="p-6 bg-slate-900 text-white rounded-2xl flex flex-col items-center justify-center gap-3 text-center">
                      <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
                      <span className="text-sm font-black tracking-wide">
                        Gemini AI is analyzing your text description...
                      </span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => runFoodAnalysis([], foodHint)}
                      disabled={!foodHint.trim()}
                      className={`w-full py-3.5 rounded-2xl text-sm font-black shadow-lg transition-all flex items-center justify-center gap-2 ${
                        foodHint.trim()
                          ? 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white cursor-pointer active:scale-98'
                          : 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none border border-slate-200'
                      }`}
                      id="analyze-text-only-btn"
                    >
                      <Sparkles className="w-5 h-5" />
                      <span>
                        {foodHint.trim()
                          ? 'Analyze Text Description with AI'
                          : 'Type a Food Description Above to Analyze via Text'}
                      </span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase text-slate-500 tracking-wider">
                      Attached Photos ({imagePreviews.length})
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
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => cameraInputRef.current?.click()}
                        className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                      >
                        <Camera className="w-3.5 h-3.5" /> + Take Another Photo
                      </button>
                      <button
                        type="button"
                        onClick={() => galleryInputRef.current?.click()}
                        className="px-3.5 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                      >
                        <FolderPlus className="w-3.5 h-3.5" /> + Add Gallery Photo(s)
                      </button>
                    </div>
                  )}

                  {/* Scan Plate / Analyze Button */}
                  {isAnalyzing ? (
                    <div className="p-6 bg-slate-900 text-white rounded-2xl flex flex-col items-center justify-center gap-3 text-center">
                      <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
                      <span className="text-sm font-black tracking-wide">
                        Gemini AI is analyzing {imagePreviews.length} photo{imagePreviews.length > 1 ? 's' : ''} together...
                      </span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => runFoodAnalysis(imagePreviews, foodHint)}
                      className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 active:scale-98 text-white text-sm font-black rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
                      id="analyze-food-btn"
                    >
                      <Sparkles className="w-5 h-5" />
                      <span>
                        {detectedData
                          ? `Re-Analyze ${imagePreviews.length} Photo${imagePreviews.length > 1 ? 's' : ''}`
                          : `Scan ${imagePreviews.length} Photo${imagePreviews.length > 1 ? 's' : ''} with AI`}
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

              {/* Detected Results Summary Card */}
              {detectedData && !isAnalyzing && (
                <div className="p-5 bg-emerald-50/80 border border-emerald-200 rounded-2xl space-y-3 animate-fadeIn">
                  <div className="flex items-center gap-2 text-emerald-800 font-black text-xs uppercase tracking-wider">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 stroke-[3]" />
                    <span>Gemini Multi-Photo Detection Complete</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center bg-white p-4 rounded-xl border border-emerald-100 shadow-2xs">
                    <div className="col-span-2 sm:col-span-4 text-left border-b border-slate-100 pb-2">
                      <span className="text-[10px] font-black uppercase text-slate-400 block">Combined Meal Detection</span>
                      <span className="text-base font-extrabold text-slate-900">{detectedData.name}</span>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-xl">
                      <span className="text-[10px] font-black uppercase text-slate-400 block">Total Protein</span>
                      <span className="text-base font-black text-indigo-600 font-mono">{detectedData.protein}g</span>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-xl">
                      <span className="text-[10px] font-black uppercase text-slate-400 block">Total Carbs</span>
                      <span className="text-base font-black text-sky-600 font-mono">{detectedData.carbs}g</span>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-xl">
                      <span className="text-[10px] font-black uppercase text-slate-400 block">Total Fiber</span>
                      <span className="text-base font-black text-emerald-600 font-mono">{detectedData.fiber}g</span>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-xl">
                      <span className="text-[10px] font-black uppercase text-slate-400 block">Total Calories</span>
                      <span className="text-base font-black text-amber-600 font-mono">{detectedData.calories} kcal</span>
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* Bottom Navigation / Actions (OK & Cancel - 50/50 horizontal width) */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-4">
              <button
                type="button"
                onClick={handleCloseModal}
                className="w-1/2 flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs sm:text-sm rounded-xl transition-colors cursor-pointer text-center"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleApplyDetectedData}
                disabled={!detectedData || isAnalyzing}
                className="w-1/2 flex-1 py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-black text-xs sm:text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed text-center"
                id="confirm-ai-detected-meal-btn"
              >
                <Check className="w-5 h-5 stroke-[3]" />
                <span>OK</span>
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}


