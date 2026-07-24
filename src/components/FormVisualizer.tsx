import React from 'react';
import { Award, Dumbbell } from 'lucide-react';

interface FormVisualizerProps {
  exerciseName: string;
}

export interface ExerciseDetails {
  name: string;
  target: string;
  volume: string;
  intensity: string;
  description: string;
  youtubeVideoId?: string;
}

export const EXERCISES_DATABASE: Record<string, ExerciseDetails> = {
  'Bench Press': {
    name: 'Bench Press',
    target: 'Chest & Triceps',
    volume: '3 sets of 8-12 repetitions',
    intensity: 'Progressive heavy load',
    description: 'Lie flat on the bench, grip the barbell or dumbbells slightly wider than shoulder-width. Lower the weight smoothly to your mid-chest, then press forcefully back up to full arm extension while keeping your feet flat on the floor.',
    youtubeVideoId: 'rT7DgCr-3pg'
  },
  'Bench Sit Ups': {
    name: 'Bench Sit Ups',
    target: 'Core / Abs',
    volume: '3 sets of 15-20 repetitions',
    intensity: 'Sustained abdominal contraction',
    description: 'Sit on the bench with feet hooked securely under pads or flat on floor. Lower your upper torso back toward the bench under control, then engage your core to sit all the way back up without pulling on your head or neck.',
    youtubeVideoId: 'MKs7Gv_9Ghc'
  },
  'Bench Crunches': {
    name: 'Bench Crunches',
    target: 'Core / Stomach',
    volume: '3 sets of 20 repetitions',
    intensity: 'Moderate, controlled pace',
    description: 'Lie flat on your back on the workout bench with your feet planted firmly on the ground or hooked into the foot pads. Place your hands gently behind your head or crossed over your chest. Contract your abdominal muscles to lift your shoulders and upper torso off the bench. Focus on squeezing your stomach at the top, then slowly lower yourself back down. Do not pull on your neck.',
    youtubeVideoId: 'MKs7Gv_9Ghc'
  },
  'Dumbbell Flat Bench Press': {
    name: 'Dumbbell Flat Bench Press',
    target: 'Chest & Arms',
    volume: '3 sets of 20 repetitions',
    intensity: 'Comfortable weight',
    description: 'Lie flat on the bench holding a dumbbell in each hand at chest level, palms facing forward. Press the weights straight up toward the ceiling until your arms are fully extended but not locked. Slowly lower the weights back down to chest level, keeping your elbows at a 45-degree angle to your body.',
    youtubeVideoId: 'VmB1G1K7v94'
  },
  'Flat Bench Leg Raises': {
    name: 'Flat Bench Leg Raises',
    target: 'Lower Abs',
    volume: '3 sets of 8-10 repetitions',
    intensity: 'Slow, steady speed',
    description: 'Lie flat on your back on the bench, gripping the top of the bench behind your head for stability. Keeping your legs straight (or slightly bent if it strains your back), slowly lift them up until they are perpendicular to the floor. Lower them back down slowly until they are just above the bench level.',
    youtubeVideoId: '2o1bwZT5nE0'
  },
  'Seated Dumbbell Shoulder Press': {
    name: 'Seated Dumbbell Shoulder Press',
    target: 'Shoulders',
    volume: '3 sets of 10 repetitions',
    intensity: 'Controlled overhead press',
    description: 'Adjust your bench to an upright seated position. Sit with your back firmly against the pad. Bring the dumbbells up to shoulder height, palms facing away from you. Press the weights straight up overhead until your arms are extended, then slowly lower them back to your shoulders.',
    youtubeVideoId: 'qEwKCR5JCog'
  },
  'Bicep Curls': {
    name: 'Bicep Curls',
    target: 'Arms (Biceps)',
    volume: '3 sets of 12 repetitions',
    intensity: 'Controlled, strict form',
    description: 'Stand with dumbbells in hands, elbows pinned to your sides. Squeeze biceps to curl dumbbells to shoulder height. Slow, 2-second eccentric lower. No body swinging.',
    youtubeVideoId: 'ykJgrb560_Y'
  },
  'Dumbbell Rows': {
    name: 'Dumbbell Rows',
    target: 'Core & Back (Lats)',
    volume: '3 sets of 12 repetitions',
    intensity: 'Moderate weight with hold',
    description: 'Place one knee and one hand on your workout bench for stability. With other hand, pull the dumbbell up to your hip pocket. Squeeze your mid-back at the top, then extend arm fully down.',
    youtubeVideoId: 'dFzUjzfih7k'
  },
  'Bodyweight Bench Squats': {
    name: 'Bodyweight Bench Squats',
    target: 'Legs (Quads & Glutes)',
    volume: '3 sets of 15 repetitions',
    intensity: 'Fluid, explosive stand',
    description: 'Stand with feet shoulder-width apart in front of the bench. Lower your hips back and down until your glutes lightly tap the bench pad. Instantly drive through your heels to return to standing.',
    youtubeVideoId: 'aclHkVaku9U'
  },
  'Light Stretching': {
    name: 'Light Stretching',
    target: 'Active Recovery',
    volume: '10-15 minutes total',
    intensity: 'Relaxed, deep breathing',
    description: 'Perform light dynamic and static stretches. Reach for your toes, stretch your shoulders, chest, and hip flexors. Hold stretch positions without pain, breathing deeply.',
    youtubeVideoId: 'g_tea8ZNk5A'
  }
};

export function matchExerciseKey(exerciseName: string | undefined): string {
  if (!exerciseName) return 'Bench Crunches';
  const target = exerciseName.toLowerCase().trim();
  const keys = Object.keys(EXERCISES_DATABASE);

  // 1. Exact match
  const exact = keys.find(k => k.toLowerCase().trim() === target);
  if (exact) return exact;

  const tokenize = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean);
  const stem = (w: string) => w.replace(/(es|s)$/, '');
  const targetStems = tokenize(target).map(stem);

  let bestKey = '';
  let maxScore = 0;

  for (const key of keys) {
    const keyStems = tokenize(key).map(stem);
    let score = 0;

    for (const ts of targetStems) {
      if (keyStems.includes(ts)) {
        if (['row', 'curl', 'crunch', 'squat', 'stretch', 'situp', 'sit', 'ab', 'abs'].includes(ts)) {
          score += 10;
        } else if (['raise', 'bicep', 'shoulder', 'leg', 'lats', 'chest', 'tricep'].includes(ts)) {
          score += 5;
        } else if (['press'].includes(ts)) {
          score += 3;
        } else if (['dumbbell', 'barbell', 'bench'].includes(ts)) {
          score += 1;
        } else {
          score += 2;
        }
      }
    }

    if (score > maxScore) {
      maxScore = score;
      bestKey = key;
    }
  }

  if (maxScore > 0 && bestKey) {
    return bestKey;
  }

  return 'Bench Crunches';
}

export default function FormVisualizer({ exerciseName }: FormVisualizerProps) {
  // Safe, smart lookup with fallback
  const normalizedKey = matchExerciseKey(exerciseName);

  const details = EXERCISES_DATABASE[normalizedKey];
  const displayTitle = exerciseName?.trim() || details.name;

  return (
    <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-3.5" id="form-visualizer-widget">
      {/* Guide details panel */}
      <div className="space-y-3.5">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100">
            {details.target}
          </span>
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Target</span>
        </div>

        <h3 className="text-base font-extrabold text-slate-900 tracking-tight leading-snug">
          {displayTitle} Form Guide
        </h3>

        <p className="text-xs text-slate-600 leading-relaxed font-medium">
          {details.description}
        </p>

        {/* Volume badge summary */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2 border-t border-slate-200/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <Dumbbell className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[9px] text-slate-400 block font-bold uppercase tracking-wider">Anabolic Vol</span>
              <span className="text-xs font-bold text-slate-800 block">{details.volume}</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
              <Award className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[9px] text-slate-400 block font-bold uppercase tracking-wider">Intensity Target</span>
              <span className="text-xs font-bold text-slate-800 block">{details.intensity}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
