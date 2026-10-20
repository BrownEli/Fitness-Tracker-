import React, { useState, useMemo } from 'react';
import {
  Sliders,
  Plus,
  Search,
  Dumbbell,
  PlayCircle,
  Edit3,
  Trash2,
  Calendar,
  Check,
  X,
  Sparkles,
  Link2,
  FolderPlus,
  BookmarkPlus
} from 'lucide-react';
import { ConfiguredExercise, ParsedWorkoutDay } from '../types';
import { ConfirmModal } from './ConfirmModal';

const MUSCLE_GROUP_OPTIONS = [
  'Chest',
  'Back',
  'Legs',
  'Shoulders',
  'Arms',
  'Core',
  'Cardio'
] as const;

interface ConfigureExercisesProps {
  configuredExercises: ConfiguredExercise[];
  onSaveConfiguredExercises: (exercises: ConfiguredExercise[]) => void;
  weightUnit: string;
  routineDays: ParsedWorkoutDay[];
  onAddExerciseToRoutineDay: (dayIdx: number, exercise: ConfiguredExercise) => void;
  onAddExerciseToTodaySession: (exercise: ConfiguredExercise) => void;
  onUpdateExerciseInRoutineDays?: (updatedExercise: ConfiguredExercise) => void;
}

export default function ConfigureExercises({
  configuredExercises,
  onSaveConfiguredExercises,
  weightUnit,
  routineDays,
  onAddExerciseToRoutineDay,
  onAddExerciseToTodaySession,
  onUpdateExerciseInRoutineDays
}: ConfigureExercisesProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  // Modal / Form state for Add or Edit
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingExerciseId, setEditingExerciseId] = useState<string | null>(null);

  // Form Fields
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState<string>('Chest');
  const [formCategories, setFormCategories] = useState<string[]>(['Chest']);
  const [formIsBodyweight, setFormIsBodyweight] = useState(false);
  const [formSets, setFormSets] = useState<number>(3);
  const [formReps, setFormReps] = useState<number>(10);
  const [formWeight, setFormWeight] = useState<number>(30);
  const [formYoutubeUrl, setFormYoutubeUrl] = useState('');

  // Day Picker Modal State (for adding configured exercise to routine day)
  const [dayPickerExercise, setDayPickerExercise] = useState<ConfiguredExercise | null>(null);

  // Success Feedback
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  // Deletion Confirmation Modal State
  const [deleteConfirmExercise, setDeleteConfirmExercise] = useState<ConfiguredExercise | null>(null);

  const showFeedback = (msg: string) => {
    setFeedbackMessage(msg);
    setTimeout(() => setFeedbackMessage(null), 3000);
  };

  // Filtered exercises
  const filteredExercises = useMemo(() => {
    return configuredExercises.filter((ex) => {
      const matchesSearch =
        ex.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (ex.category && ex.category.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (ex.categories && ex.categories.some((c) => c.toLowerCase().includes(searchQuery.toLowerCase())));

      const matchesCategory =
        selectedCategory === 'All' ||
        ex.category === selectedCategory ||
        (ex.categories && ex.categories.includes(selectedCategory));

      return matchesSearch && matchesCategory;
    });
  }, [configuredExercises, searchQuery, selectedCategory]);

  const handleOpenAdd = () => {
    setEditingExerciseId(null);
    setFormName('');
    setFormCategory('Chest');
    setFormCategories(['Chest']);
    setFormIsBodyweight(false);
    setFormSets(3);
    setFormReps(10);
    setFormWeight(weightUnit === 'kg' ? 14 : 30);
    setFormYoutubeUrl('');
    setIsEditorOpen(true);
  };

  const handleOpenEdit = (ex: ConfiguredExercise) => {
    setEditingExerciseId(ex.id);
    setFormName(ex.name);
    setFormCategory(ex.category || 'Chest');
    setFormCategories(ex.categories && ex.categories.length > 0 ? ex.categories : [ex.category || 'Chest']);
    setFormIsBodyweight(Boolean(ex.isBodyweight));
    setFormSets(ex.sets || 3);
    setFormReps(ex.reps || 10);
    setFormWeight(ex.weight !== undefined ? ex.weight : (weightUnit === 'kg' ? 14 : 30));
    setFormYoutubeUrl(ex.youtubeUrl || '');
    setIsEditorOpen(true);
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    const cleanCategories = formCategories.length > 0 ? formCategories : [formCategory];
    const targetCategory = cleanCategories[0] || 'Chest';

    if (editingExerciseId) {
      // Editing existing exercise
      const updatedExercise: ConfiguredExercise = {
        id: editingExerciseId,
        name: formName.trim(),
        category: targetCategory,
        categories: cleanCategories,
        isBodyweight: formIsBodyweight,
        sets: Math.max(1, Number(formSets) || 3),
        reps: Math.max(1, Number(formReps) || 10),
        weight: !formIsBodyweight ? Math.max(0, Number(formWeight) || 0) : 0,
        youtubeUrl: formYoutubeUrl.trim() || undefined,
        notes: editingExerciseId ? configuredExercises.find((x) => x.id === editingExerciseId)?.notes : undefined,
        updatedAt: new Date().toISOString()
      };

      const updatedList = configuredExercises.map((ex) =>
        ex.id === editingExerciseId ? updatedExercise : ex
      );
      onSaveConfiguredExercises(updatedList);

      if (onUpdateExerciseInRoutineDays) {
        onUpdateExerciseInRoutineDays(updatedExercise);
      }

      showFeedback(`Exercise "${updatedExercise.name}" updated successfully`);
    } else {
      // Adding new exercise
      const newExercise: ConfiguredExercise = {
        id: `cfg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        name: formName.trim(),
        category: targetCategory,
        categories: cleanCategories,
        isBodyweight: formIsBodyweight,
        sets: Math.max(1, Number(formSets) || 3),
        reps: Math.max(1, Number(formReps) || 10),
        weight: !formIsBodyweight ? Math.max(0, Number(formWeight) || 0) : 0,
        youtubeUrl: formYoutubeUrl.trim() || undefined,
        updatedAt: new Date().toISOString()
      };

      onSaveConfiguredExercises([newExercise, ...configuredExercises]);
      showFeedback(`New exercise "${newExercise.name}" saved to library`);
    }

    setIsEditorOpen(false);
  };

  const handleDeleteConfirmed = () => {
    if (!deleteConfirmExercise) return;
    const filtered = configuredExercises.filter((ex) => ex.id !== deleteConfirmExercise.id);
    onSaveConfiguredExercises(filtered);
    showFeedback(`Exercise "${deleteConfirmExercise.name}" removed from library`);
    setDeleteConfirmExercise(null);
  };

  const routineHasExercises = useMemo(() => {
    return routineDays.some((d) => d.exercises && d.exercises.length > 0);
  }, [routineDays]);

  const handleImportAllFromRoutine = () => {
    let importedCount = 0;
    const currentList = [...configuredExercises];

    for (const d of routineDays) {
      if (!d.exercises) continue;
      for (const ex of d.exercises) {
        const normName = ex.name.trim();
        if (!normName) continue;
        const exists = currentList.some(
          (c) => c.name.trim().toLowerCase() === normName.toLowerCase()
        );
        if (!exists) {
          currentList.push({
            id: `cfg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            name: normName,
            category: ex.category || 'Chest',
            categories: [ex.category || 'Chest'],
            sets: ex.sets || 3,
            reps: ex.reps || 10,
            weight: ex.weight !== undefined ? ex.weight : (ex.isBodyweight ? 0 : (weightUnit === 'kg' ? 14 : 30)),
            isBodyweight: Boolean(ex.isBodyweight),
            youtubeUrl: ex.youtubeUrl || '',
            notes: `Imported from ${d.day || 'Routine'}`,
            updatedAt: new Date().toISOString()
          });
          importedCount++;
        }
      }
    }

    if (importedCount > 0) {
      onSaveConfiguredExercises(currentList);
      showFeedback(`Imported ${importedCount} exercises from routine days`);
    } else {
      showFeedback('All exercises from routine days are already in your configuration library');
    }
  };

  const handleAddToToday = (ex: ConfiguredExercise) => {
    onAddExerciseToTodaySession(ex);
    showFeedback(`Added "${ex.name}" to today's session`);
  };

  const handleAddToDay = (dayIdx: number) => {
    if (!dayPickerExercise) return;
    onAddExerciseToRoutineDay(dayIdx, dayPickerExercise);
    const dayName = routineDays[dayIdx]?.day || `Day ${dayIdx + 1}`;
    showFeedback(`Added "${dayPickerExercise.name}" to ${dayName}`);
    setDayPickerExercise(null);
  };

  return (
    <div className="space-y-6" id="configure-exercises-panel">
      {/* Header Banner */}
      <div className="bg-indigo-50/70 border border-indigo-100 p-5 rounded-2xl shadow-xs space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-extrabold text-indigo-950 flex items-center gap-2">
              <Sliders className="w-5 h-5 text-indigo-600" />
              <span>Exercise Library Configuration</span>
            </h3>
            <p className="text-sm text-indigo-800 mt-1 font-medium">
              Configure every exercise you do with default sets, reps, and weights. When added to any session or routine day, exercises are automatically populated with your configured values.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleOpenAdd}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 min-h-[48px] bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-black text-sm rounded-xl shadow-sm transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create New Exercise</span>
            </button>
          </div>
        </div>
      </div>

      {/* Success Notification */}
      {feedbackMessage && (
        <div className="text-sm bg-emerald-50 text-emerald-800 px-4 py-3 rounded-xl border border-emerald-200 font-bold flex items-center gap-2 animate-fadeIn shadow-2xs">
          <Check className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{feedbackMessage}</span>
        </div>
      )}

      {/* Search and Category Filters */}
      <div className="space-y-3">
        <div className="relative w-full">
          <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search exercises by name or muscle group"
            className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          {['All', ...MUSCLE_GROUP_OPTIONS].map((cat) => {
            const isSelected = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-2 min-h-[40px] rounded-xl text-sm font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 border ${
                  isSelected
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* Exercises List */}
      <div className="space-y-4">
        {filteredExercises.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-slate-500 space-y-3">
            <Dumbbell className="w-8 h-8 text-slate-400 mx-auto" />
            <p className="text-sm font-bold text-slate-700">No Configured Exercises Found</p>
            <p className="text-sm text-slate-500 max-w-sm mx-auto">
              Your configuration area is currently empty. Click &quot;Save as Configuration&quot; on any of your routine days to add exercises here, or create a custom exercise.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleOpenAdd}
                className="inline-flex items-center gap-2 px-5 py-3 min-h-[48px] bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold cursor-pointer transition-colors shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>Create New Exercise</span>
              </button>
              {routineHasExercises && (
                <button
                  type="button"
                  onClick={handleImportAllFromRoutine}
                  className="inline-flex items-center gap-2 px-5 py-3 min-h-[48px] bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-xl text-sm font-bold cursor-pointer transition-colors shadow-2xs"
                >
                  <BookmarkPlus className="w-4 h-4 text-indigo-600" />
                  <span>Import All from Routine Days</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          filteredExercises.map((ex) => {
            return (
              <div
                key={ex.id}
                className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col space-y-4 shadow-xs hover:border-indigo-200 transition-all"
              >
                {/* 1. Top Metadata / Category and Weight Type Tags */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-3 py-1 rounded-lg bg-indigo-50 text-indigo-700 font-mono font-black text-sm border border-indigo-100">
                    {ex.category}
                  </span>
                  {ex.categories &&
                    ex.categories
                      .filter((c) => c !== ex.category)
                      .map((subCat) => (
                        <span
                          key={subCat}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-bold text-sm border border-slate-200"
                        >
                          {subCat}
                        </span>
                      ))}
                  <span
                    className={`px-3 py-1 rounded-lg text-sm font-bold border ${
                      ex.isBodyweight
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    {ex.isBodyweight ? 'Bodyweight Movement' : 'Weighted Lift'}
                  </span>
                </div>

                {/* 2. Full-Width Item Title */}
                <div className="w-full">
                  <h4 className="text-base font-black text-slate-900 leading-snug break-words">
                    {ex.name}
                  </h4>
                </div>

                {/* 3. Secondary Description / Video Demo / Notes */}
                {(ex.notes || ex.youtubeUrl) && (
                  <div className="space-y-1.5 bg-slate-50/70 p-3 rounded-xl border border-slate-100">
                    {ex.notes && (
                      <p className="text-sm text-slate-600 font-medium leading-relaxed">
                        {ex.notes}
                      </p>
                    )}
                    {ex.youtubeUrl && (
                      <a
                        href={ex.youtubeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm text-red-600 hover:text-red-700 font-bold transition-colors"
                      >
                        <PlayCircle className="w-4 h-4 shrink-0 text-red-500" />
                        <span>Watch Video Demonstration</span>
                      </a>
                    )}
                  </div>
                )}

                {/* 4. Metrics / Values in Dedicated Vertical Section */}
                <div className="flex flex-wrap items-center gap-2 pt-0.5">
                  <span className="px-3.5 py-1.5 bg-indigo-50 border border-indigo-200 rounded-xl font-black text-sm text-indigo-800">
                    {ex.sets} Sets
                  </span>
                  <span className="px-3.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-black text-sm text-slate-800">
                    {ex.reps} Reps
                  </span>
                  {!ex.isBodyweight && (
                    <span className="px-3.5 py-1.5 bg-indigo-50 border border-indigo-200 rounded-xl font-black text-sm text-indigo-800">
                      {ex.weight} {weightUnit}
                    </span>
                  )}
                </div>

                {/* 5. Action Buttons in Dedicated Vertical Section with >= 48px touch targets */}
                <div className="pt-2 border-t border-slate-200/70 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full">
                  <button
                    type="button"
                    onClick={() => handleAddToToday(ex)}
                    className="flex-1 py-3 px-4 min-h-[48px] bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs"
                  >
                    <Plus className="w-5 h-5" />
                    <span>Add to Today</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDayPickerExercise(ex)}
                    className="flex-1 py-3 px-4 min-h-[48px] bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-800 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer border border-slate-200"
                  >
                    <Calendar className="w-5 h-5 text-indigo-600" />
                    <span>Add to Day</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenEdit(ex)}
                    className="py-3 px-4 min-h-[48px] bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <Edit3 className="w-4 h-4 text-slate-500" />
                    <span>Edit</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDeleteConfirmExercise(ex)}
                    className="py-3 px-4 min-h-[48px] bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4 text-rose-600" />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Day Picker Modal (Add configured exercise to a routine day) */}
      {dayPickerExercise && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-5 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-100 text-indigo-700 rounded-2xl">
                  <FolderPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Add to Routine Day</h3>
                  <p className="text-sm text-slate-500 font-medium">{dayPickerExercise.name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDayPickerExercise(null)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-semibold text-slate-600 mb-2">
                Select which routine day to add this exercise to:
              </p>
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {routineDays.map((dayObj, dayIdx) => (
                  <button
                    key={`pick-day-${dayIdx}`}
                    type="button"
                    onClick={() => handleAddToDay(dayIdx)}
                    className="w-full text-left p-3.5 min-h-[48px] bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 rounded-xl transition-all cursor-pointer flex items-center justify-between group"
                  >
                    <div>
                      <span className="text-sm font-black text-slate-900 group-hover:text-indigo-900 block">
                        {dayObj.day || `Day ${dayIdx + 1}`}
                      </span>
                      <span className="text-sm font-medium text-slate-500">
                        {dayObj.focusArea || 'Full Body'} {dayObj.dayOfWeek ? `• ${dayObj.dayOfWeek}` : ''}
                      </span>
                    </div>
                    <Plus className="w-5 h-5 text-indigo-600 shrink-0" />
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDayPickerExercise(null)}
                className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-xl transition-colors cursor-pointer min-h-[48px]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Exercise Form Modal */}
      {isEditorOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full h-[620px] max-h-[90vh] shadow-2xl border border-slate-100 flex flex-col overflow-hidden animate-scaleUp">
            {/* Constant-size Fixed Header */}
            <div className="flex items-center justify-between border-b border-slate-100 p-5 sm:p-6 pb-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-100 text-indigo-700 rounded-2xl">
                  {editingExerciseId ? <Edit3 className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    {editingExerciseId ? 'Edit Configured Exercise' : 'Configure New Exercise'}
                  </h3>
                  <p className="text-sm text-slate-500 font-medium">
                    Permanent exercise definition in your library
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditorOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form onSubmit={handleSaveForm} className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
                <div>
                  <label className="block text-sm font-black text-slate-700 uppercase mb-1">
                    Exercise Name
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Barbell Bench Press"
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    autoFocus
                  />
                </div>

                {/* Movement Type: Weighted vs Bodyweight */}
                <div>
                  <label className="block text-sm font-black text-slate-700 uppercase mb-1">
                    Movement Type
                  </label>
                  <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setFormIsBodyweight(false)}
                      className={`py-2.5 min-h-[44px] rounded-lg text-sm font-extrabold transition-all cursor-pointer ${
                        !formIsBodyweight
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Weighted Lift
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormIsBodyweight(true)}
                      className={`py-2.5 min-h-[44px] rounded-lg text-sm font-extrabold transition-all cursor-pointer ${
                        formIsBodyweight
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Bodyweight
                    </button>
                  </div>
                </div>

                {/* Target Muscle Groups */}
                <div>
                  <label className="block text-sm font-black text-slate-700 uppercase mb-1">
                    Target Muscle Groups
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {MUSCLE_GROUP_OPTIONS.map((m) => {
                      const isSelected = formCategories.includes(m);
                      return (
                        <button
                          key={`form-m-${m}`}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              if (formCategories.length > 1) {
                                setFormCategories(formCategories.filter((x) => x !== m));
                              }
                            } else {
                              setFormCategories([...formCategories, m]);
                            }
                          }}
                          className={`px-3 py-1.5 min-h-[40px] rounded-xl text-sm font-bold transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-indigo-600 text-white shadow-xs'
                              : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                          }`}
                        >
                          {m}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Target Sets, Reps, Weight */}
                <div className={`grid ${!formIsBodyweight ? 'grid-cols-3' : 'grid-cols-2'} gap-3`}>
                  <div>
                    <label className="block text-sm font-black text-slate-700 uppercase mb-1">
                      Target Sets
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={formSets}
                      onChange={(e) => setFormSets(Math.max(1, parseInt(e.target.value, 10) || 1))}
                      className="w-full px-3 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-900 text-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-black text-slate-700 uppercase mb-1">
                      Target Reps
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={200}
                      value={formReps}
                      onChange={(e) => setFormReps(Math.max(1, parseInt(e.target.value, 10) || 1))}
                      className="w-full px-3 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-900 text-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  {!formIsBodyweight && (
                    <div>
                      <label className="block text-sm font-black text-slate-700 uppercase mb-1">
                        Weight in {weightUnit.toUpperCase()}
                      </label>
                      <input
                        type="number"
                        min={0}
                        step={0.5}
                        value={formWeight}
                        onChange={(e) => setFormWeight(Math.max(0, parseFloat(e.target.value) || 0))}
                        className="w-full px-3 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-900 text-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  )}
                </div>

                {/* YouTube Video URL */}
                <div>
                  <label className="block text-sm font-black text-slate-700 uppercase mb-1">
                    YouTube Demonstration URL
                  </label>
                  <input
                    type="text"
                    value={formYoutubeUrl}
                    onChange={(e) => setFormYoutubeUrl(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=..."
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Constant-size Fixed Footer */}
              <div className="flex items-center gap-3 p-4 sm:p-5 border-t border-slate-100 bg-slate-50/50 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsEditorOpen(false)}
                  className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-xl transition-colors cursor-pointer text-center min-h-[48px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm rounded-xl transition-colors cursor-pointer text-center min-h-[48px] shadow-sm"
                >
                  Save Exercise
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Deletion Confirmation Modal */}
      {deleteConfirmExercise && (
        <ConfirmModal
          isOpen={Boolean(deleteConfirmExercise)}
          title="Delete Configured Exercise?"
          message={`Are you sure you want to permanently delete "${deleteConfirmExercise.name}" from your configured exercises library?`}
          confirmText="Delete Exercise"
          variant="danger"
          onConfirm={handleDeleteConfirmed}
          onCancel={() => setDeleteConfirmExercise(null)}
        />
      )}
    </div>
  );
}
