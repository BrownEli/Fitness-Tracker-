import React, { useState } from 'react';
import { Workout, SetLog } from '../types';
import FormVisualizer, { EXERCISES_DATABASE } from './FormVisualizer';
import { PlayCircle, CheckCircle2, ChevronRight, ChevronLeft, Award, Dumbbell, Clock, Info, Check, Plus, AlertCircle } from 'lucide-react';

interface WorkoutLoggerProps {
  onAddWorkout: (workout: Omit<Workout, 'id'>) => void;
  weightUnit: string;
}

interface WorkoutDayPlan {
  day: number;
  focus: string;
  category: string;
  exercises: string[];
}

const WEEKLY_PLAN_DATA: WorkoutDayPlan[] = [
  { day: 1, focus: 'Core & Chest', category: 'Chest', exercises: ['Bench Crunches', 'Dumbbell Flat Bench Press'] },
  { day: 2, focus: 'Arms & Shoulders', category: 'Shoulders', exercises: ['Bicep Curls', 'Seated Dumbbell Shoulder Press'] },
  { day: 3, focus: 'Core & Back', category: 'Back', exercises: ['Flat Bench Leg Raises', 'Dumbbell Rows'] },
  { day: 4, focus: 'Active Recovery & Legs', category: 'Legs', exercises: ['Bodyweight Bench Squats', 'Light Stretching'] },
  { day: 5, focus: 'Repeat & Overload Cycle', category: 'Legs', exercises: ['Bench Crunches', 'Dumbbell Flat Bench Press', 'Seated Dumbbell Shoulder Press'] }
];

export default function WorkoutLogger({ onAddWorkout, weightUnit }: WorkoutLoggerProps) {
  const [selectedPlanDay, setSelectedPlanDay] = useState<number>(1);
  const [isWorkoutActive, setIsWorkoutActive] = useState(false);
  const [activeExerciseIndex, setActiveExerciseIndex] = useState(0);
  
  // Track inputs for each set in the active workout
  // Key: "exerciseName-setIndex"
  const [workoutProgress, setWorkoutProgress] = useState<Record<string, { reps: number; weight: number; completed: boolean }>>({});
  const [completedSuccessMsg, setCompletedSuccessMsg] = useState(false);

  // Quick helper to fetch the plan day object
  const currentPlan = WEEKLY_PLAN_DATA.find(p => p.day === selectedPlanDay) || WEEKLY_PLAN_DATA[0];

  // Initialize progress state when starting workout
  const handleStartWorkout = () => {
    const initialProgress: Record<string, { reps: number; weight: number; completed: boolean }> = {};
    
    currentPlan.exercises.forEach(exName => {
      const dbEntry = EXERCISES_DATABASE[exName];
      const setsCount = 3; // Default is 3 working sets as per PDF guidelines
      
      // Extract target reps
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
          weight: exName.includes('Bodyweight') || exName.includes('Stretching') || exName.includes('Crunches') || exName.includes('Leg Raises') ? 0 : 30, // reasonable starting weight
          completed: false
        };
      }
    });

    setWorkoutProgress(initialProgress);
    setActiveExerciseIndex(0);
    setIsWorkoutActive(true);
  };

  // Log and save active workout to today's log
  const handleFinishAndSaveWorkout = () => {
    // Record each exercise in the current plan day as logged
    currentPlan.exercises.forEach(exName => {
      const setsForExercise: Omit<SetLog, 'id'>[] = [];
      const setsCount = 3;
      
      for (let s = 0; s < setsCount; s++) {
        const setKey = `${exName}-${s}`;
        const p = workoutProgress[setKey] || { reps: 10, weight: 30, completed: true };
        setsForExercise.push({
          reps: p.reps,
          weight: p.weight,
          completed: true // Mark completed so it feeds properly into progress charts!
        });
      }

      onAddWorkout({
        name: exName,
        category: currentPlan.category as any,
        completed: true,
        sets: setsForExercise.map((s, idx) => ({
          ...s,
          id: `set-${Date.now()}-${exName}-${idx}`
        }))
      });
    });

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

  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-10 shadow-sm" id="daily-workout-module">
      
      {!isWorkoutActive ? (
        // --- 1. OVERVIEW SCREEN ---
        <div className="space-y-8" id="workout-selector-panel">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-6">
            <div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                <Dumbbell className="w-7 h-7 text-indigo-600 animate-pulse" />
                Daily Workout Routines
              </h2>
              <p className="text-slate-500 text-sm mt-2 font-semibold">Daily Consistency Workout Plan V4 — designed for progressive overload</p>
            </div>
            
            {completedSuccessMsg && (
              <span className="text-sm bg-emerald-50 text-emerald-700 px-4 py-2 rounded-xl border border-emerald-100 font-bold flex items-center gap-1.5 animate-bounce shadow-sm">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                Workout Logged & Saved!
              </span>
            )}
          </div>

          {/* Quick interactive Day Buttons */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4" id="workout-days-carousel">
            {WEEKLY_PLAN_DATA.map((plan) => (
              <button
                type="button"
                key={plan.day}
                onClick={() => setSelectedPlanDay(plan.day)}
                className={`flex flex-col items-center justify-center p-5 rounded-2xl border transition-all cursor-pointer relative ${
                  selectedPlanDay === plan.day
                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-150 scale-102 font-bold'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100/70 hover:border-slate-300'
                }`}
              >
                <span className={`text-[11px] font-black uppercase tracking-widest ${selectedPlanDay === plan.day ? 'text-indigo-100' : 'text-slate-400'}`}>
                  Routine
                </span>
                <span className="text-2xl font-black mt-2">Day {plan.day}</span>
                <span className={`text-xs mt-2 font-semibold text-center line-clamp-1 max-w-[90%] ${selectedPlanDay === plan.day ? 'text-indigo-200' : 'text-slate-500'}`}>
                  {plan.focus}
                </span>
              </button>
            ))}
          </div>

          {/* Selected Routine Details Card */}
          <div className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-6 sm:p-8 space-y-6">
            <div className="flex flex-col gap-5">
              <div>
                <span className="text-xs uppercase font-black px-3 py-1 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-150">
                  {currentPlan.category} TARGETS
                </span>
                <h3 className="text-xl font-black text-slate-800 mt-3">
                  Day {currentPlan.day}: {currentPlan.focus} Routine
                </h3>
              </div>

              {/* Start button */}
              <button
                type="button"
                onClick={handleStartWorkout}
                className="w-full flex items-center justify-center gap-2 px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-base rounded-2xl transition-all shadow-md hover:shadow-lg shadow-indigo-150 cursor-pointer active:scale-95"
                id="start-workout-btn"
              >
                <PlayCircle className="w-5.5 h-5.5" />
                Start Day {currentPlan.day} Workout
              </button>
            </div>

            <div className="border-t border-slate-200/60 pt-6 space-y-4">
              <span className="text-sm font-black text-slate-400 uppercase tracking-wider block">Today's Exercises:</span>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {currentPlan.exercises.map((exName, idx) => {
                  const dbEntry = EXERCISES_DATABASE[exName];
                  return (
                    <div key={idx} className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-4 shadow-xs">
                      <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 font-mono font-black text-base flex items-center justify-center">
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-bold text-slate-800 truncate">{exName}</h4>
                        <span className="text-xs text-indigo-600 font-extrabold block mt-1">{dbEntry?.volume || '3 sets'}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Quick tips */}
          <div className="flex gap-3 items-start bg-amber-50/50 border border-amber-200/60 p-5 rounded-2xl text-xs sm:text-sm text-amber-800">
            <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">Progressive Overload Principle:</span>
              <p className="mt-1 leading-relaxed font-medium">
                Aim to write down the weights you actually did. Try to increase weight by 2.5-5 lbs or add 1-2 repetitions compared to your last session to stimulate lean muscle growth safely without extreme soreness.
              </p>
            </div>
          </div>
        </div>
      ) : (
        // --- 2. ACTIVE WORKOUT PLAYER ---
        <div className="space-y-6" id="workout-player-panel">
          
          {/* Header */}
          <div className="flex justify-between items-center border-b border-slate-100 pb-4">
            <div>
              <span className="text-[10px] text-indigo-600 font-black uppercase tracking-widest">Active Workout Session</span>
              <h3 className="text-base font-black text-slate-900 mt-0.5">Day {currentPlan.day}: {currentPlan.focus}</h3>
            </div>
            
            <button
              onClick={() => {
                if (window.confirm('Are you sure you want to exit active workout mode? Your set entries will be lost.')) {
                  setIsWorkoutActive(false);
                }
              }}
              className="text-xs font-bold text-slate-400 hover:text-slate-600 py-1.5 px-3 rounded-lg hover:bg-slate-100 transition-all cursor-pointer"
              id="exit-workout-btn"
            >
              Exit Workout
            </button>
          </div>

          {/* Steps Navigator Bar */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-2xl border border-slate-200" id="workout-steps-bar">
            {currentPlan.exercises.map((exName, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setActiveExerciseIndex(idx)}
                className={`flex-1 text-center py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
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

          {/* Dynamic Interactive Sets Entry */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Logged Working Sets (Recommend: 3 Sets)</h4>
              <span className="text-[10px] text-slate-400 font-semibold flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> Check the boxes as you finish each set
              </span>
            </div>

            <div className="space-y-3">
              {[0, 1, 2].map((setIdx) => {
                const exName = currentPlan.exercises[activeExerciseIndex];
                const key = `${exName}-${setIdx}`;
                const setProgress = workoutProgress[key] || { reps: 10, weight: 30, completed: false };
                
                const isBodyweight = exName.includes('Bodyweight') || exName.includes('Stretching') || exName.includes('Crunches') || exName.includes('Leg Raises');

                return (
                  <div
                    key={setIdx}
                    className={`grid grid-cols-12 gap-3 items-center p-3 rounded-xl border transition-all ${
                      setProgress.completed
                        ? 'bg-indigo-50/20 border-indigo-200/70'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    {/* Checkbox */}
                    <div className="col-span-2 sm:col-span-1 flex justify-center">
                      <button
                        type="button"
                        onClick={() => handleToggleSetCompleted(exName, setIdx)}
                        className={`w-6 h-6 rounded-lg border flex items-center justify-center transition-all cursor-pointer ${
                          setProgress.completed
                            ? 'bg-indigo-600 border-indigo-600 text-white'
                            : 'bg-white border-slate-300 hover:border-indigo-500'
                        }`}
                      >
                        {setProgress.completed && <Check className="w-4 h-4 stroke-[3]" />}
                      </button>
                    </div>

                    {/* Label */}
                    <div className="col-span-3 sm:col-span-2">
                      <span className={`text-xs font-bold font-mono ${setProgress.completed ? 'text-indigo-700' : 'text-slate-400'}`}>
                        Working Set {setIdx + 1}
                      </span>
                    </div>

                    {/* Reps Input */}
                    <div className="col-span-3 col-start-6 sm:col-span-3 flex items-center gap-2">
                      <label className="text-[10px] text-slate-400 uppercase font-bold font-mono">Reps</label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={setProgress.reps}
                        onChange={(e) => handleUpdateSetField(exName, setIdx, 'reps', Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-16 bg-white border border-slate-200 text-center py-1.5 text-xs font-bold rounded-lg focus:outline-none focus:border-indigo-500 font-mono"
                      />
                    </div>

                    {/* Weight Input (Hide if pure bodyweight recovery) */}
                    <div className="col-span-4 sm:col-span-3 flex items-center gap-2">
                      {!isBodyweight ? (
                        <>
                          <label className="text-[10px] text-slate-400 uppercase font-bold font-mono">{weightUnit}</label>
                          <input
                            type="number"
                            min="0"
                            max="1000"
                            value={setProgress.weight}
                            onChange={(e) => handleUpdateSetField(exName, setIdx, 'weight', Math.max(0, parseInt(e.target.value) || 0))}
                            className="w-16 bg-white border border-slate-200 text-center py-1.5 text-xs font-bold rounded-lg focus:outline-none focus:border-indigo-500 font-mono"
                          />
                        </>
                      ) : (
                        <span className="text-[10px] font-bold text-slate-400 uppercase font-mono tracking-wider italic">Bodyweight</span>
                      )}
                    </div>

                  </div>
                );
              })}
            </div>
          </div>

          {/* Navigation & Submit footer */}
          <div className="flex flex-col gap-5 border-t border-slate-100 pt-6">
            <div className="flex gap-4 w-full">
              <button
                type="button"
                disabled={activeExerciseIndex === 0}
                onClick={() => setActiveExerciseIndex(prev => prev - 1)}
                className={`flex-1 flex items-center justify-center gap-2 py-3.5 px-5 rounded-2xl text-sm font-bold border transition-colors cursor-pointer ${
                  activeExerciseIndex === 0
                    ? 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <ChevronLeft className="w-5 h-5" />
                Previous
              </button>

              <button
                type="button"
                disabled={activeExerciseIndex === currentPlan.exercises.length - 1}
                onClick={() => setActiveExerciseIndex(prev => prev + 1)}
                className={`flex-1 flex items-center justify-center gap-2 py-3.5 px-5 rounded-2xl text-sm font-bold border transition-colors cursor-pointer ${
                  activeExerciseIndex === currentPlan.exercises.length - 1
                    ? 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Next
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            <button
              type="button"
              onClick={handleFinishAndSaveWorkout}
              className="w-full flex items-center justify-center gap-2 px-8 py-4.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-base rounded-2xl transition-all shadow-md hover:shadow-lg shadow-indigo-150 cursor-pointer active:scale-95 border border-indigo-500"
              id="finish-workout-log-btn"
            >
              <CheckCircle2 className="w-5.5 h-5.5" />
              Finish & Record Workout
            </button>
          </div>

        </div>
      )}

    </div>
  );
}
