import { ConfiguredExercise } from '../types';

export const LEGACY_DEFAULT_EXERCISE_IDS = [
  'cfg-bench-press',
  'cfg-incline-db-press',
  'cfg-overhead-press',
  'cfg-lateral-raise',
  'cfg-barbell-squat',
  'cfg-romanian-deadlift',
  'cfg-leg-press',
  'cfg-pullups',
  'cfg-barbell-row',
  'cfg-lat-pulldown',
  'cfg-bicep-curl',
  'cfg-hammer-curl',
  'cfg-tricep-pushdown',
  'cfg-skull-crushers',
  'cfg-hanging-leg-raise',
  'cfg-plank',
  'cfg-pushups',
  'cfg-lunges'
];

// Defaults removed per user specification: if nothing is configured, nothing should show up.
export const DEFAULT_CONFIGURED_EXERCISES: ConfiguredExercise[] = [];
