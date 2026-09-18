export const STANDARD_WORKOUT_CATEGORIES = [
  'Chest',
  'Back',
  'Legs',
  'Shoulders',
  'Arms',
  'Core',
  'Cardio'
] as const;

export type StandardWorkoutCategory = typeof STANDARD_WORKOUT_CATEGORIES[number];

/**
 * Normalizes any compound or non-standard workout category into a single,
 * unified standard muscle group (e.g., "Core, Legs", "Legs, Core" -> "Core" or "Legs").
 */
export function normalizeWorkoutCategory(rawCategory?: string, workoutName?: string): StandardWorkoutCategory {
  const cat = (rawCategory || '').trim().toLowerCase();
  const name = (workoutName || '').trim().toLowerCase();

  // 1. Check exercise name first for direct, high-confidence anatomical mapping
  // Core / Abdominals
  if (
    name.includes('crunch') ||
    name.includes('plank') ||
    name.includes('situp') ||
    name.includes('sit-up') ||
    name.includes('abs') ||
    name.includes('ab wheel') ||
    name.includes('hollow') ||
    name.includes('deadbug') ||
    name.includes('russian twist') ||
    name.includes('flutter kick') ||
    name.includes('hanging leg') ||
    name.includes('leg raise') ||
    name.includes('knee raise') ||
    name.includes('oblique')
  ) {
    return 'Core';
  }

  // Legs / Lower Body
  if (
    name.includes('squat') ||
    name.includes('lunge') ||
    name.includes('leg press') ||
    name.includes('leg extension') ||
    name.includes('leg curl') ||
    name.includes('hamstring') ||
    name.includes('quad') ||
    name.includes('calf') ||
    name.includes('calves') ||
    name.includes('rdl') ||
    name.includes('deadlift') ||
    name.includes('hip thrust') ||
    name.includes('glute') ||
    name.includes('step up') ||
    name.includes('step-up')
  ) {
    return 'Legs';
  }

  // Chest / Pectorals
  if (
    name.includes('bench press') ||
    name.includes('pushup') ||
    name.includes('push-up') ||
    name.includes('chest fly') ||
    name.includes('pec fly') ||
    name.includes('pec deck') ||
    name.includes('cable fly') ||
    name.includes('chest press') ||
    name.includes('incline press') ||
    name.includes('decline press')
  ) {
    return 'Chest';
  }

  // Back / Lats
  if (
    name.includes('pullup') ||
    name.includes('pull-up') ||
    name.includes('pulldown') ||
    name.includes('lat pull') ||
    name.includes('barbell row') ||
    name.includes('dumbbell row') ||
    name.includes('cable row') ||
    name.includes('seated row') ||
    name.includes('t-bar') ||
    name.includes('hyperextension') ||
    name.includes('back extension') ||
    name.includes('shrug')
  ) {
    return 'Back';
  }

  // Shoulders / Deltoids
  if (
    name.includes('shoulder press') ||
    name.includes('overhead press') ||
    name.includes('military press') ||
    name.includes('lateral raise') ||
    name.includes('front raise') ||
    name.includes('rear delt') ||
    name.includes('arnold press') ||
    name.includes('face pull') ||
    name.includes('upright row')
  ) {
    return 'Shoulders';
  }

  // Arms / Biceps / Triceps
  if (
    name.includes('bicep') ||
    name.includes('curl') ||
    name.includes('tricep') ||
    name.includes('pushdown') ||
    name.includes('skull crusher') ||
    name.includes('hammer curl') ||
    name.includes('preacher') ||
    name.includes('concentration') ||
    name.includes('dips')
  ) {
    return 'Arms';
  }

  // Cardio / Conditioning
  if (
    name.includes('cardio') ||
    name.includes('run') ||
    name.includes('jog') ||
    name.includes('walk') ||
    name.includes('treadmill') ||
    name.includes('cycle') ||
    name.includes('elliptical')
  ) {
    return 'Cardio';
  }

  // 2. Parse compound category string (e.g., "Core, Legs", "Legs, Core", "Chest, Arms", etc.)
  const tokens = cat.split(/[,/&+\-_]+/).map((t) => t.trim()).filter(Boolean);
  const matchedCats: StandardWorkoutCategory[] = [];

  tokens.forEach((t) => {
    if (t.includes('chest')) matchedCats.push('Chest');
    else if (t.includes('back')) matchedCats.push('Back');
    else if (t.includes('leg')) matchedCats.push('Legs');
    else if (t.includes('shoulder') || t.includes('delt')) matchedCats.push('Shoulders');
    else if (t.includes('arm') || t.includes('bicep') || t.includes('tricep')) matchedCats.push('Arms');
    else if (t.includes('core') || t.includes('ab')) matchedCats.push('Core');
    else if (t.includes('cardio') || t.includes('aerobic')) matchedCats.push('Cardio');
  });

  if (matchedCats.length > 0) {
    // Specifically handle mixed "Core" and "Legs" (e.g. "Core, Legs" or "Legs, Core")
    if (matchedCats.includes('Legs') && matchedCats.includes('Core')) {
      if (
        name.includes('leg') ||
        name.includes('squat') ||
        name.includes('lunge') ||
        name.includes('calf') ||
        name.includes('quad') ||
        name.includes('thigh')
      ) {
        return 'Legs';
      }
      return 'Core';
    }

    // Return the first matched standard category
    return matchedCats[0];
  }

  // 3. Fallback direct substring checks
  if (cat.includes('chest')) return 'Chest';
  if (cat.includes('back')) return 'Back';
  if (cat.includes('leg')) return 'Legs';
  if (cat.includes('shoulder') || cat.includes('delt')) return 'Shoulders';
  if (cat.includes('arm') || cat.includes('bicep') || cat.includes('tricep')) return 'Arms';
  if (cat.includes('core') || cat.includes('ab')) return 'Core';
  if (cat.includes('cardio') || cat.includes('aerobic')) return 'Cardio';

  // Absolute fallback: default to Chest or Core
  return 'Chest';
}
