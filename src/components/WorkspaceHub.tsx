import React, { useState, useEffect } from 'react';
import { UserGoals, DailyLog, CoachingInsight, Meal, Workout } from '../types';
import { auth, googleSignIn, logout, initAuth } from '../lib/googleAuth';
import {
  fetchGoogleDocText,
  parseFoodsFromText,
  parseWorkoutsFromText,
  backupDataToDrive,
  restoreDataFromDrive
} from '../lib/googleApi';
import { User } from 'firebase/auth';

import {
  Cloud,
  Download,
  Upload,
  FileText,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  FileJson,
  Link2,
  Lock,
  Plus,
  Compass,
  Check,
  Calendar,
  Sparkles,
  Flame,
  Dumbbell
} from 'lucide-react';

interface WorkspaceHubProps {
  goals: UserGoals;
  logs: DailyLog[];
  insights: CoachingInsight[];
  onUpdateGoals: React.Dispatch<React.SetStateAction<UserGoals>>;
  onUpdateLogs: React.Dispatch<React.SetStateAction<DailyLog[]>>;
  onUpdateInsights: React.Dispatch<React.SetStateAction<CoachingInsight[]>>;
  onLogMeal: (newMeal: Omit<Meal, 'id' | 'timestamp'>) => void;
  onLogWorkout: (newWorkout: Omit<Workout, 'id'>) => void;
  parsedFoods: Omit<Meal, 'id' | 'timestamp'>[];
  parsedWorkouts: Omit<Workout, 'id'>[];
  onUpdateParsedFoods: React.Dispatch<React.SetStateAction<Omit<Meal, 'id' | 'timestamp'>[]>>;
  onUpdateParsedWorkouts: React.Dispatch<React.SetStateAction<Omit<Workout, 'id'>[]>>;
}

export default function WorkspaceHub({
  goals,
  logs,
  insights,
  onUpdateGoals,
  onUpdateLogs,
  onUpdateInsights,
  onLogMeal,
  onLogWorkout,
  parsedFoods,
  parsedWorkouts,
  onUpdateParsedFoods,
  onUpdateParsedWorkouts
}: WorkspaceHubProps) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  
  // Google Docs state
  const [foodsInput, setFoodsInput] = useState(goals.foodsDocId || '');
  const [workoutsInput, setWorkoutsInput] = useState(goals.workoutsDocId || '');
  const [isSavingDocIds, setIsSavingDocIds] = useState(false);

  // Loaded Google Docs contents
  const [rawFoodsText, setRawFoodsText] = useState('');
  const [rawWorkoutsText, setRawWorkoutsText] = useState('');
  
  const [isLoadingFoodsDoc, setIsLoadingFoodsDoc] = useState(false);
  const [isLoadingWorkoutsDoc, setIsLoadingWorkoutsDoc] = useState(false);
  const [docError, setDocError] = useState<string | null>(null);
  const [docSuccess, setDocSuccess] = useState<string | null>(null);

  // Sync state
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [syncMessage, setSyncMessage] = useState('');
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(!!goals.lastSyncTime);

  // Local Import / Export state
  const [fileError, setFileError] = useState<string | null>(null);
  const [fileSuccess, setFileSuccess] = useState<string | null>(null);

  // Initialize Auth state
  useEffect(() => {
    const unsubscribe = initAuth(
      (currentUser, activeToken) => {
        setUser(currentUser);
        setToken(activeToken);
      },
      () => {
        setUser(null);
        setToken(null);
      }
    );
    return () => unsubscribe();
  }, []);

  // Handle manual Google Sign In
  const handleGoogleSignIn = async () => {
    setIsLoggingIn(true);
    setSyncStatus('idle');
    setSyncMessage('');
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setToken(result.accessToken);
        setSyncStatus('success');
        setSyncMessage('Google Workspace integrated successfully!');
      }
    } catch (err: any) {
      console.error(err);
      setSyncStatus('error');
      setSyncMessage(err.message || 'Failed to authenticate with Google');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleSignOut = async () => {
    if (window.confirm('Disconnect Google Workspace connection? This clears your temporary access session.')) {
      await logout();
      setUser(null);
      setToken(null);
      setSyncStatus('idle');
      setSyncMessage('');
    }
  };

  // Helper to extract Doc ID from either a direct Google Docs URL or raw ID
  const extractDocId = (input: string): string => {
    const urlPattern = /\/document\/d\/([a-zA-Z0-9-_]+)/;
    const match = input.match(urlPattern);
    return match ? match[1] : input.trim();
  };

  // Save Document Links/IDs to goals
  const handleSaveDocIds = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingDocIds(true);
    const fId = extractDocId(foodsInput);
    const wId = extractDocId(workoutsInput);

    onUpdateGoals((prev) => ({
      ...prev,
      foodsDocId: fId,
      workoutsDocId: wId
    }));

    setIsSavingDocIds(false);
    setDocSuccess('Document ID configurations updated successfully!');
    setTimeout(() => setDocSuccess(null), 4000);
  };

  // Fetch foods Google Doc
  const handleFetchFoodsDoc = async () => {
    if (!token) {
      setDocError('Please connect to Google Workspace first to read Google Docs.');
      return;
    }
    const docId = extractDocId(foodsInput);
    if (!docId) {
      setDocError('Please enter a valid Google Doc link or ID for Foods.');
      return;
    }

    setIsLoadingFoodsDoc(true);
    setDocError(null);
    setDocSuccess(null);
    try {
      const text = await fetchGoogleDocText(docId, token);
      setRawFoodsText(text);
      const foods = parseFoodsFromText(text);
      onUpdateParsedFoods(foods);
      setDocSuccess(`Successfully loaded ${foods.length} muscle food options from your Google Doc!`);
    } catch (err: any) {
      console.error(err);
      setDocError(err.message || 'Failed to fetch Google Doc. Make sure the ID is correct and your document is accessible.');
    } finally {
      setIsLoadingFoodsDoc(false);
    }
  };

  // Fetch workouts Google Doc
  const handleFetchWorkoutsDoc = async () => {
    if (!token) {
      setDocError('Please connect to Google Workspace first to read Google Docs.');
      return;
    }
    const docId = extractDocId(workoutsInput);
    if (!docId) {
      setDocError('Please enter a valid Google Doc link or ID for Workouts.');
      return;
    }

    setIsLoadingWorkoutsDoc(true);
    setDocError(null);
    setDocSuccess(null);
    try {
      const text = await fetchGoogleDocText(docId, token);
      setRawWorkoutsText(text);
      const workouts = parseWorkoutsFromText(text);
      onUpdateParsedWorkouts(workouts);
      setDocSuccess(`Successfully extracted ${workouts.length} hypertrophy exercise routines from your Google Doc!`);
    } catch (err: any) {
      console.error(err);
      setDocError(err.message || 'Failed to fetch Google Doc. Make sure the ID is correct and your document is accessible.');
    } finally {
      setIsLoadingWorkoutsDoc(false);
    }
  };

  // Backup state payload to Google Drive
  const handleBackupToDrive = async () => {
    if (!token) {
      setSyncStatus('error');
      setSyncMessage('Please authenticate with Google before backing up.');
      return;
    }

    setIsSyncing(true);
    setSyncStatus('idle');
    setSyncMessage('');

    try {
      const payload = {
        goals,
        logs,
        insights,
        backupVersion: '1.0',
        exportedAt: new Date().toISOString()
      };

      const fileId = await backupDataToDrive(payload, token);
      const nowStr = new Date().toLocaleString();

      onUpdateGoals((prev) => ({
        ...prev,
        lastSyncTime: nowStr
      }));

      setSyncStatus('success');
      setSyncMessage(`Backup saved to your Google Drive! File ID: ${fileId}. Last synced: ${nowStr}`);
    } catch (err: any) {
      console.error(err);
      setSyncStatus('error');
      setSyncMessage(err.message || 'Drive Backup failed.');
    } finally {
      setIsSyncing(false);
    }
  };

  // Restore state payload from Google Drive
  const handleRestoreFromDrive = async () => {
    if (!token) {
      setSyncStatus('error');
      setSyncMessage('Please authenticate with Google before restoring.');
      return;
    }

    const confirmed = window.confirm(
      'Are you sure you want to download and restore your data from Google Drive? This will overwrite your current logs, goals, and insights!'
    );
    if (!confirmed) return;

    setIsSyncing(true);
    setSyncStatus('idle');
    setSyncMessage('');

    try {
      const data = await restoreDataFromDrive(token);
      if (data && data.goals && data.logs) {
        onUpdateGoals(data.goals);
        onUpdateLogs(data.logs);
        if (data.insights) onUpdateInsights(data.insights);

        setSyncStatus('success');
        setSyncMessage('Hypertrophy logs and goals successfully restored from Google Drive!');
      } else {
        throw new Error('Retrieved file is missing valid backup properties.');
      }
    } catch (err: any) {
      console.error(err);
      setSyncStatus('error');
      setSyncMessage(err.message || 'Drive Restore failed.');
    } finally {
      setIsSyncing(false);
    }
  };

  // Manual Local Export (Download JSON file)
  const handleLocalExport = () => {
    try {
      const payload = {
        goals,
        logs,
        insights,
        exportedAt: new Date().toISOString()
      };
      const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(payload, null, 2))}`;
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', jsonString);
      downloadAnchor.setAttribute('download', `hypertrophy_hub_export_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

      setFileSuccess('Data exported successfully! Check your downloads.');
      setTimeout(() => setFileSuccess(null), 4000);
    } catch (err: any) {
      setFileError('Failed to export local JSON file.');
    }
  };

  // Manual Local Import (Upload JSON file)
  const handleLocalImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    const file = e.target.files?.[0];
    if (!file) return;

    const confirmed = window.confirm(
      'Are you sure you want to import this local JSON backup? It will replace all your current daily logs, muscle profile, and history logs.'
    );
    if (!confirmed) {
      e.target.value = ''; // Reset input
      return;
    }

    fileReader.onload = (event) => {
      try {
        const importedData = JSON.parse(event.target?.result as string);
        if (importedData && importedData.goals && importedData.logs) {
          onUpdateGoals(importedData.goals);
          onUpdateLogs(importedData.logs);
          if (importedData.insights) {
            onUpdateInsights(importedData.insights);
          }
          setFileSuccess('Data backup imported and loaded successfully!');
          setFileError(null);
        } else {
          setFileError('Invalid JSON backup format. Missing goals or logs properties.');
        }
      } catch (err) {
        setFileError('Failed to parse uploaded JSON file. Please make sure it is a valid backup file.');
      }
    };

    fileReader.readAsText(file);
    e.target.value = ''; // Reset input
  };

  // Log parsed meal
  const handleLogParsedMeal = (meal: Omit<Meal, 'id' | 'timestamp'>) => {
    onLogMeal(meal);
    setDocSuccess(`Added "${meal.name}" to your daily logs!`);
    setTimeout(() => setDocSuccess(null), 3000);
  };

  // Log parsed workout
  const handleLogParsedWorkout = (workout: Omit<Workout, 'id'>) => {
    onLogWorkout(workout);
    setDocSuccess(`Added exercise routine "${workout.name}" to today's log!`);
    setTimeout(() => setDocSuccess(null), 3000);
  };

  return (
    <div className="space-y-12" id="workspace-hub-view">
      
      {/* Intro banner */}
      <div className="bg-gradient-to-r from-indigo-700 to-sky-700 text-white p-8 sm:p-10 rounded-3xl shadow-xl">
        <h2 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-3">
          <Cloud className="w-8 h-8 text-sky-300 animate-pulse" />
          Workspace Hub
        </h2>
        <p className="text-base sm:text-lg text-indigo-100 mt-3 max-w-3xl leading-relaxed">
          Unlock maximum hypertrophy progression by integrating Google Workspace. Automate backups directly to your personal 
          Google Drive and import custom nutrition strategies or workout routines directly from your Google Docs!
        </p>
      </div>

      {/* Grid: Google Connection and Local Backup */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Google Workspace Integration Card */}
        <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start mb-6 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Cloud className="w-5 h-5 text-indigo-600" />
                  Google Cloud Sync
                </h3>
                <p className="text-slate-500 text-sm mt-1">Keep your muscle history synchronized and safe</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-bold font-mono uppercase ${
                token ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-amber-50 text-amber-700 border border-amber-100'
              }`}>
                {token ? 'Connected' : 'Offline'}
              </span>
            </div>

            {/* If authenticated, show user info and action buttons */}
            {token && user ? (
              <div className="space-y-6">
                <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt={user.displayName || ''} className="w-12 h-12 rounded-full border border-indigo-200" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-lg">
                      {user.displayName ? user.displayName[0] : 'U'}
                    </div>
                  )}
                  <div>
                    <h4 className="text-base font-bold text-slate-800">{user.displayName || 'Authorized User'}</h4>
                    <p className="text-xs text-slate-500">{user.email}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <button
                    onClick={handleBackupToDrive}
                    disabled={isSyncing}
                    className="flex items-center justify-center gap-2 px-5 py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-xl text-sm font-bold cursor-pointer transition-all shadow-md shadow-indigo-100"
                  >
                    {isSyncing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    Backup to Drive
                  </button>
                  <button
                    onClick={handleRestoreFromDrive}
                    disabled={isSyncing}
                    className="flex items-center justify-center gap-2 px-5 py-3.5 bg-sky-500 hover:bg-sky-600 disabled:bg-sky-400 text-white rounded-xl text-sm font-bold cursor-pointer transition-all shadow-md shadow-sky-100"
                  >
                    {isSyncing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    Restore from Drive
                  </button>
                </div>

                {/* Last Sync Info */}
                <div className="flex justify-between items-center bg-slate-50 border border-slate-200/60 p-4 rounded-xl text-xs text-slate-600 font-medium">
                  <span>Last Sync Status:</span>
                  <span className="font-mono font-bold text-indigo-600">{goals.lastSyncTime || 'Never backed up'}</span>
                </div>

                {/* Auto Sync Toggle Explanation */}
                <div className="bg-indigo-50/50 rounded-2xl p-4 border border-indigo-100 flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-indigo-800">Automatic Weekly Sync Engaged</h4>
                    <p className="text-xs text-indigo-600/90 mt-1 leading-relaxed">
                      With Google connected, your data is checked and automatically backed up to Google Drive in the background every 7 days when you open the app.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6 py-6 text-center">
                <div className="max-w-md mx-auto">
                  <Lock className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <h4 className="text-base font-bold text-slate-800">Secure Cloud Connection Required</h4>
                  <p className="text-sm text-slate-500 mt-2 leading-relaxed">
                    Connecting your Google account provides secure direct access to your personal files for backup storage and Google Docs plans. Your credentials are never stored externally.
                  </p>
                </div>

                {/* Official Google Button */}
                <button
                  onClick={handleGoogleSignIn}
                  disabled={isLoggingIn}
                  className="mx-auto flex items-center justify-center gap-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-bold px-6 py-3 rounded-xl cursor-pointer transition-all shadow-sm max-w-sm w-full"
                >
                  <svg className="w-5 h-5" viewBox="0 0 48 48">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                  </svg>
                  <span>{isLoggingIn ? 'Connecting...' : 'Connect Google Workspace'}</span>
                </button>
              </div>
            )}
          </div>

          {/* Sync feedbacks */}
          {syncMessage && (
            <div className={`mt-6 p-4 rounded-xl border flex items-start gap-3 text-sm ${
              syncStatus === 'success' ? 'bg-emerald-50 border-emerald-150 text-emerald-800' : 'bg-rose-50 border-rose-150 text-rose-800'
            }`}>
              {syncStatus === 'success' ? <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" /> : <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />}
              <span>{syncMessage}</span>
            </div>
          )}

          {token && (
            <div className="mt-6 border-t border-slate-100 pt-4 flex justify-end">
              <button
                onClick={handleSignOut}
                className="text-xs font-bold text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
              >
                Disconnect Google Account
              </button>
            </div>
          )}
        </div>

        {/* Local Manual Backup Card */}
        <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm flex flex-col justify-between">
          <div>
            <div className="mb-6 border-b border-slate-100 pb-4">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <FileJson className="w-5 h-5 text-sky-600" />
                Local Backup & Portability
              </h3>
              <p className="text-slate-500 text-sm mt-1">Export or restore your data manually via standard JSON file transfer</p>
            </div>

            <div className="space-y-6">
              <p className="text-sm text-slate-600 leading-relaxed font-medium">
                Want to keep a copy of your muscle logs on your hard drive? You can export your full hypertrophy database as a single portable JSON file, and restore it on any device at any time.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  onClick={handleLocalExport}
                  className="flex items-center justify-center gap-2 px-5 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-bold cursor-pointer transition-all border border-slate-200"
                >
                  <Upload className="w-4 h-4 text-slate-500" />
                  Manual JSON Export
                </button>
                <label className="flex items-center justify-center gap-2 px-5 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-bold cursor-pointer transition-all border border-slate-200 border-dashed">
                  <Download className="w-4 h-4 text-slate-500" />
                  <span>Manual JSON Import</span>
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleLocalImport}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Local Feedbacks */}
          {(fileSuccess || fileError) && (
            <div className={`mt-6 p-4 rounded-xl border flex items-start gap-3 text-sm ${
              fileSuccess ? 'bg-emerald-50 border-emerald-150 text-emerald-800' : 'bg-rose-50 border-rose-150 text-rose-800'
            }`}>
              {fileSuccess ? <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" /> : <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />}
              <span>{fileSuccess || fileError}</span>
            </div>
          )}
        </div>

      </div>

      {/* Android Jetpack Compose companion blueprint banner */}
      <div className="bg-slate-900 border border-slate-800 text-white rounded-3xl p-8 shadow-md flex flex-col md:flex-row items-center justify-between gap-6" id="android-blueprint-section">
        <div className="space-y-3 max-w-2xl">
          <div className="inline-flex items-center gap-2 bg-indigo-500/15 border border-indigo-500/30 px-3 py-1 rounded-full text-xs font-bold text-indigo-400">
            <Sparkles className="w-3.5 h-3.5" />
            Android Companion Blueprint Ready
          </div>
          <h3 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
            Jetpack Compose & MVVM Companion App
          </h3>
          <p className="text-sm text-slate-300 leading-relaxed">
            Convert this web workspace into a high-performance, offline-first Android application! Includes a dynamic, date-partitioned JSON storage engine synchronizing directly with Google Drive, clean Material 3 design, and robust separation of concerns.
          </p>
        </div>
        <a
          href="/api/download-blueprint"
          download="android_blueprint.md"
          className="flex items-center justify-center gap-2.5 px-6 py-4 bg-emerald-500 hover:bg-emerald-600 active:scale-[0.98] text-slate-950 font-bold rounded-2xl text-sm transition-all shadow-lg shadow-emerald-500/10 shrink-0 w-full md:w-auto"
        >
          <Download className="w-4.5 h-4.5" />
          Download Android Blueprint (.md)
        </a>
      </div>

      {/* Google Docs Integration Panel */}
      <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm space-y-8" id="google-docs-config-panel">
        <div className="border-b border-slate-100 pb-4">
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-600" />
            Connected Food & Workout Documents
          </h3>
          <p className="text-slate-500 text-sm mt-1">
            Build your tracking experience around your own Google Docs plans
          </p>
        </div>

        {/* Inputs */}
        <form onSubmit={handleSaveDocIds} className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <Link2 className="w-3.5 h-3.5 text-indigo-500" />
              Foods to Eat Doc URL / ID
            </label>
            <input
              type="text"
              placeholder="Paste Google Doc link or ID"
              value={foodsInput}
              onChange={(e) => setFoodsInput(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 font-medium"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <Link2 className="w-3.5 h-3.5 text-indigo-500" />
              Workout Plans Doc URL / ID
            </label>
            <input
              type="text"
              placeholder="Paste Google Doc link or ID"
              value={workoutsInput}
              onChange={(e) => setWorkoutsInput(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 font-medium"
            />
          </div>

          <div className="md:col-span-2 flex justify-end">
            <button
              type="submit"
              disabled={isSavingDocIds}
              className="px-6 py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-xl text-sm font-bold cursor-pointer transition-all shadow-sm"
            >
              Save Connected Docs
            </button>
          </div>
        </form>

        {docSuccess && (
          <div className="p-4 bg-emerald-50 border border-emerald-150 text-emerald-800 rounded-xl flex items-center gap-3 text-sm">
            <CheckCircle className="w-5 h-5 text-emerald-600" />
            <span>{docSuccess}</span>
          </div>
        )}

        {docError && (
          <div className="p-4 bg-rose-50 border border-rose-150 text-rose-800 rounded-xl flex items-center gap-3 text-sm">
            <AlertCircle className="w-5 h-5 text-rose-600" />
            <span>{docError}</span>
          </div>
        )}

        {/* Action Controls for fetching */}
        {token ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
            <div className="space-y-4">
              <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Flame className="w-4 h-4 text-emerald-500" />
                Foods to Eat Plan
              </h4>
              <button
                onClick={handleFetchFoodsDoc}
                disabled={isLoadingFoodsDoc}
                className="w-full py-3 px-4 bg-emerald-50 hover:bg-emerald-100 disabled:bg-slate-50 border border-emerald-200 hover:border-emerald-300 disabled:border-slate-100 text-emerald-700 text-xs font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                {isLoadingFoodsDoc ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                Sync Foods list from Google Doc
              </button>
            </div>

            <div className="space-y-4">
              <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Dumbbell className="w-4 h-4 text-violet-500" />
                Workout Plans
              </h4>
              <button
                onClick={handleFetchWorkoutsDoc}
                disabled={isLoadingWorkoutsDoc}
                className="w-full py-3 px-4 bg-violet-50 hover:bg-violet-100 disabled:bg-slate-50 border border-violet-200 hover:border-violet-300 disabled:border-slate-100 text-violet-700 text-xs font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                {isLoadingWorkoutsDoc ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                Sync Workouts from Google Doc
              </button>
            </div>
          </div>
        ) : (
          <div className="p-6 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-center text-slate-500 text-sm font-semibold">
            Connect Google Workspace to import planning items directly.
          </div>
        )}

        {/* DISPLAY PARSED OPTIONS */}
        {(parsedFoods.length > 0 || parsedWorkouts.length > 0) && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 pt-8 border-t border-slate-100">
            
            {/* Parsed Foods Panel */}
            {parsedFoods.length > 0 && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="text-base font-bold text-slate-800 flex items-center gap-2">
                    <Flame className="w-4 h-4 text-emerald-500" />
                    Foods list from Doc ({parsedFoods.length})
                  </h4>
                  <span className="text-[10px] text-slate-400 font-extrabold uppercase bg-slate-100 px-2 py-0.5 rounded-md">Click to Eat / Log</span>
                </div>

                <div className="space-y-2 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
                  {parsedFoods.map((food, idx) => (
                    <div
                      key={`parsed-food-${idx}`}
                      onClick={() => handleLogParsedMeal(food)}
                      className="flex justify-between items-center p-3.5 bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-200 rounded-xl cursor-pointer transition-all group"
                    >
                      <div>
                        <h5 className="text-xs font-bold text-slate-800 group-hover:text-emerald-900">{food.name}</h5>
                        <p className="text-[11px] text-slate-500 mt-1">
                          {food.protein}g protein • {food.calories} kcal
                        </p>
                      </div>
                      <button className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-400 group-hover:text-emerald-600 group-hover:border-emerald-300 transition-colors">
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Parsed Workouts Panel */}
            {parsedWorkouts.length > 0 && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="text-base font-bold text-slate-800 flex items-center gap-2">
                    <Dumbbell className="w-4 h-4 text-violet-500" />
                    Exercise routines from Doc ({parsedWorkouts.length})
                  </h4>
                  <span className="text-[10px] text-slate-400 font-extrabold uppercase bg-slate-100 px-2 py-0.5 rounded-md">Click to Log Exercise</span>
                </div>

                <div className="space-y-2 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
                  {parsedWorkouts.map((workout, idx) => (
                    <div
                      key={`parsed-workout-${idx}`}
                      onClick={() => handleLogParsedWorkout(workout)}
                      className="flex justify-between items-center p-3.5 bg-slate-50 hover:bg-violet-50 border border-slate-200 hover:border-violet-200 rounded-xl cursor-pointer transition-all group"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-violet-50 text-violet-700 border border-violet-100">
                            {workout.category}
                          </span>
                          <h5 className="text-xs font-bold text-slate-800 group-hover:text-violet-900">{workout.name}</h5>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1">
                          {workout.sets.length} sets • target: {workout.sets[0]?.reps || 10} reps @ {workout.sets[0]?.weight || 135} {goals.weightUnit}
                        </p>
                      </div>
                      <button className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-400 group-hover:text-violet-600 group-hover:border-violet-300 transition-colors">
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        )}

      </div>

    </div>
  );
}
