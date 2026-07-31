import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User,
  setPersistence,
  browserLocalPersistence
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  collection,
  getDocs,
  query,
  where,
  deleteDoc
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { DailyLog, UserGoals, ParsedWorkoutDay } from '../types';

// Initialize Firebase App
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialize Services with custom database ID if present
export const auth = getAuth(app);

// Use browserLocalPersistence to keep user logged in across sessions & reloads
setPersistence(auth, browserLocalPersistence).catch(err => {
  console.warn('Firebase auth persistence warning:', err);
});

export const db = firebaseConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

export const googleProvider = new GoogleAuthProvider();

export async function signInWithGoogleFirebase() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    if (user) {
      // Save user profile
      await setDoc(
        doc(db, 'users', user.uid),
        {
          uid: user.uid,
          email: user.email || '',
          displayName: user.displayName || '',
          photoURL: user.photoURL || '',
          updatedAt: new Date().toISOString()
        },
        { merge: true }
      );
    }
    return user;
  } catch (error) {
    console.error('Firebase Google Auth Sign-In Error:', error);
    throw error;
  }
}

export async function signOutFirebase() {
  return await signOut(auth);
}

// --- Firestore Sync Methods ---

export async function saveUserGoalsToFirestore(userId: string, goals: UserGoals) {
  if (!userId) return;
  const ref = doc(db, 'userGoals', userId);
  const cleanGoals = JSON.parse(JSON.stringify(goals));
  await setDoc(
    ref,
    {
      userId,
      ...cleanGoals,
      updatedAt: new Date().toISOString()
    },
    { merge: true }
  );
}

export async function getUserGoalsFromFirestore(userId: string): Promise<UserGoals | null> {
  if (!userId) return null;
  const ref = doc(db, 'userGoals', userId);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    const data = snap.data();
    const { userId: _, updatedAt: __, ...goals } = data;
    return goals as UserGoals;
  }
  return null;
}

export async function saveDailyLogToFirestore(userId: string, log: DailyLog) {
  if (!userId || !log.date) return;
  const docId = `${userId}_${log.date}`;
  const ref = doc(db, 'dailyLogs', docId);
  const cleanLog = JSON.parse(JSON.stringify(log));
  await setDoc(
    ref,
    {
      id: docId,
      userId,
      date: cleanLog.date,
      meals: cleanLog.meals || [],
      workouts: cleanLog.workouts || [],
      weight: cleanLog.weight ?? null,
      notes: cleanLog.notes ?? '',
      updatedAt: new Date().toISOString()
    },
    { merge: true }
  );
}

export async function getDailyLogsFromFirestore(userId: string): Promise<DailyLog[]> {
  if (!userId) return [];
  const q = query(collection(db, 'dailyLogs'), where('userId', '==', userId));
  const snap = await getDocs(q);
  const logs: DailyLog[] = [];
  snap.forEach(docSnap => {
    const data = docSnap.data();
    logs.push({
      date: data.date,
      meals: data.meals || [],
      workouts: data.workouts || [],
      weight: data.weight || undefined,
      notes: data.notes || undefined
    });
  });
  return logs;
}

export async function saveRoutineDaysToFirestore(userId: string, routineDays: ParsedWorkoutDay[]) {
  if (!userId) return;
  const ref = doc(db, 'routineDays', userId);
  const cleanDays = JSON.parse(JSON.stringify(routineDays));
  await setDoc(
    ref,
    {
      userId,
      days: cleanDays,
      updatedAt: new Date().toISOString()
    },
    { merge: true }
  );
}

export async function getRoutineDaysFromFirestore(userId: string): Promise<ParsedWorkoutDay[] | null> {
  if (!userId) return null;
  const ref = doc(db, 'routineDays', userId);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    const data = snap.data();
    return data.days || null;
  }
  return null;
}
