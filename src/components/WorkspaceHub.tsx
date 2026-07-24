import React, { useState, useEffect } from 'react';
import { UserGoals, DailyLog, CoachingInsight, Meal, Workout } from '../types';
import { auth, googleSignIn, logout, initAuth, isTokenExpired } from '../lib/googleAuth';
import { ConfirmModal } from './ConfirmModal';
import {
  backupDataToDrive,
  restoreDataFromDrive,
  extractFolderId
} from '../lib/googleApi';
import { User } from 'firebase/auth';

import {
  Cloud,
  Download,
  Upload,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  FileJson,
  Lock,
  Plus,
  Flame,
  Folder,
  Trash2
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
  parsedWorkouts: any[];
  onUpdateParsedFoods: React.Dispatch<React.SetStateAction<Omit<Meal, 'id' | 'timestamp'>[]>>;
  onUpdateParsedWorkouts: React.Dispatch<React.SetStateAction<any[]>>;
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
  
  // Folder link state
  const [folderLinkInput, setFolderLinkInput] = useState(goals.driveFolderLink || '');
  const [isSavingFolder, setIsSavingFolder] = useState(false);
  const [docError, setDocError] = useState<string | null>(null);
  const [docSuccess, setDocSuccess] = useState<string | null>(null);

  // Sync state
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [syncMessage, setSyncMessage] = useState('');

  // Local Import / Export state
  const [fileError, setFileError] = useState<string | null>(null);
  const [fileSuccess, setFileSuccess] = useState<string | null>(null);

  const [sessionExpired, setSessionExpired] = useState(false);

  // Custom confirmation modal state
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    variant?: 'danger' | 'warning' | 'info';
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  const requestConfirm = (
    title: string,
    message: string,
    onConfirm: () => void,
    confirmText = 'Confirm',
    variant: 'danger' | 'warning' | 'info' = 'danger'
  ) => {
    setConfirmConfig({
      isOpen: true,
      title,
      message,
      confirmText,
      variant,
      onConfirm: () => {
        onConfirm();
        setConfirmConfig((prev) => ({ ...prev, isOpen: false }));
      }
    });
  };

  // Initialize Auth state
  useEffect(() => {
    const unsubscribe = initAuth(
      (currentUser, activeToken) => {
        setUser(currentUser);
        setToken(activeToken);
        setSessionExpired(isTokenExpired());
      },
      () => {
        setUser(null);
        setToken(null);
        setSessionExpired(false);
      }
    );
    return () => unsubscribe();
  }, []);

  // Monitor Google Access Token Expiration
  useEffect(() => {
    if (token) {
      setSessionExpired(isTokenExpired());
      const interval = setInterval(() => {
        setSessionExpired(isTokenExpired());
      }, 30000); // Check every 30 seconds
      return () => clearInterval(interval);
    } else {
      setSessionExpired(false);
    }
  }, [token]);

  // Synchronize input when parent goals change
  useEffect(() => {
    setFolderLinkInput(goals.driveFolderLink || '');
  }, [goals.driveFolderLink]);

  // Helper to ensure a fresh Google Access Token before any user-triggered operation
  const getOrRenewToken = async (): Promise<string | null> => {
    if (!token) return null;

    if (isTokenExpired()) {
      console.log('Google Access Token has expired. Silently/quickly renewing now...');
      setSyncStatus('idle');
      setSyncMessage('Renewing secure Google connection...');
      try {
        const result = await googleSignIn();
        if (result) {
          setUser(result.user);
          setToken(result.accessToken);
          setSessionExpired(false);
          return result.accessToken;
        }
      } catch (err: any) {
        console.error('Failed to automatically renew Google token:', err);
        setSyncStatus('error');
        setSyncMessage('Your secure Google session has expired. Please connect again: ' + (err.message || ''));
        return null;
      }
    }
    return token;
  };

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
    requestConfirm(
      'Disconnect Google Workspace',
      'Are you sure you want to disconnect your Google Workspace connection? This clears your temporary access session.',
      async () => {
        await logout();
        setUser(null);
        setToken(null);
        setSyncStatus('idle');
        setSyncMessage('');
      },
      'Disconnect',
      'warning'
    );
  };

  // Save Drive Folder Link
  const handleSaveFolderLink = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingFolder(true);
    const folderLink = folderLinkInput.trim();

    onUpdateGoals((prev) => ({
      ...prev,
      driveFolderLink: folderLink
    }));

    setIsSavingFolder(false);
    setDocSuccess('Google Drive folder link saved successfully!');
    setTimeout(() => setDocSuccess(null), 4000);
  };

  // Backup state payload to Google Drive
  const handleBackupToDrive = async () => {
    const activeToken = await getOrRenewToken();
    if (!activeToken) {
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
        parsedFoods,
        parsedWorkouts,
        backupVersion: '1.0',
        exportedAt: new Date().toISOString()
      };

      const folderId = goals.driveFolderLink ? extractFolderId(goals.driveFolderLink) : undefined;
      const { fileId, folderId: resolvedFolderId } = await backupDataToDrive(payload, activeToken, folderId);
      const nowStr = new Date().toLocaleString();

      onUpdateGoals((prev) => ({
        ...prev,
        lastSyncTime: nowStr,
        driveFolderLink: resolvedFolderId ? `https://drive.google.com/drive/folders/${resolvedFolderId}` : prev.driveFolderLink
      }));

      setSyncStatus('success');
      setSyncMessage(`JSON backup saved to your Google Drive! File ID: ${fileId}. Last synced: ${nowStr}`);
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
    const activeToken = await getOrRenewToken();
    if (!activeToken) {
      setSyncStatus('error');
      setSyncMessage('Please authenticate with Google before restoring.');
      return;
    }

    requestConfirm(
      'Restore from Google Drive',
      'Are you sure you want to download and restore your data from Google Drive? This will overwrite your current logs, routines, goals, and insights!',
      async () => {
        setIsSyncing(true);
        setSyncStatus('idle');
        setSyncMessage('');

        try {
          const folderId = goals.driveFolderLink ? extractFolderId(goals.driveFolderLink) : undefined;
          const data = await restoreDataFromDrive(activeToken, folderId);
          if (data && data.goals && data.logs) {
            onUpdateGoals((prev) => {
              const driveFolderLink = data._resolvedFolderId
                ? `https://drive.google.com/drive/folders/${data._resolvedFolderId}`
                : (data.goals.driveFolderLink || prev.driveFolderLink);
              return {
                ...prev,
                ...data.goals,
                driveFolderLink
              };
            });
            onUpdateLogs(data.logs);
            if (data.insights) onUpdateInsights(data.insights);
            if (data.parsedFoods) onUpdateParsedFoods(data.parsedFoods);
            if (data.parsedWorkouts) onUpdateParsedWorkouts(data.parsedWorkouts);

            setSyncStatus('success');
            setSyncMessage('Hypertrophy logs, routines, and goals successfully restored from Google Drive JSON backup!');
          } else {
            throw new Error('No backup file found, or retrieved file is missing valid properties.');
          }
        } catch (err: any) {
          console.error(err);
          setSyncStatus('error');
          setSyncMessage(err.message || 'Drive Restore failed.');
        } finally {
          setIsSyncing(false);
        }
      },
      'Restore Data',
      'warning'
    );
  };

  // Manual Local Export (Download JSON file)
  const handleLocalExport = () => {
    try {
      const payload = {
        goals,
        logs,
        insights,
        parsedFoods,
        parsedWorkouts,
        backupVersion: '1.0',
        exportedAt: new Date().toISOString()
      };
      const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(payload, null, 2))}`;
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', jsonString);
      downloadAnchor.setAttribute('download', `hypertrophy_hub_backup_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

      setFileSuccess('Data exported successfully! Check your downloads for hypertrophy_hub_backup.json');
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

    requestConfirm(
      'Import Backup File',
      'Are you sure you want to import this JSON backup file? It will update your current daily logs, routines, and goals.',
      () => {
        fileReader.onload = (event) => {
          try {
            const importedData = JSON.parse(event.target?.result as string);
            if (importedData && importedData.goals && importedData.logs) {
              onUpdateGoals(importedData.goals);
              onUpdateLogs(importedData.logs);
              if (importedData.insights) {
                onUpdateInsights(importedData.insights);
              }
              if (importedData.parsedFoods) {
                onUpdateParsedFoods(importedData.parsedFoods);
              }
              if (importedData.parsedWorkouts) {
                onUpdateParsedWorkouts(importedData.parsedWorkouts);
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
      },
      'Import Data',
      'warning'
    );

    e.target.value = ''; // Reset input
  };

  // Log parsed meal
  const handleLogParsedMeal = (meal: Omit<Meal, 'id' | 'timestamp'>) => {
    onLogMeal(meal);
    setDocSuccess(`Added "${meal.name}" to your daily logs!`);
    setTimeout(() => setDocSuccess(null), 3000);
  };

  return (
    <div className="space-y-12" id="workspace-hub-view">
      
      {/* Intro banner */}
      <div className="bg-slate-900 border border-slate-800 text-white p-8 sm:p-10 rounded-3xl shadow-md">
        <h2 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-3">
          <Cloud className="w-8 h-8 text-sky-300 animate-pulse" />
          Workspace Hub & JSON Storage
        </h2>
        <p className="text-base sm:text-lg text-slate-300 mt-3 max-w-3xl leading-relaxed">
          Manage your hypertrophy logs, custom exercise routines, and nutrition data using clean JSON storage. Backup directly to Google Drive or export and import local JSON files!
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
                  Google Drive Cloud Backup
                </h3>
                <p className="text-slate-500 text-sm mt-1">Automatically save and restore your JSON backup on Google Drive</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-sm font-extrabold font-mono uppercase ${
                token ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : 'bg-amber-50 text-amber-700 border border-amber-100'
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
                    <h4 className="text-lg font-extrabold text-slate-800">{user.displayName || 'Authorized User'}</h4>
                    <p className="text-sm font-semibold text-slate-500">{user.email}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <button
                    onClick={handleBackupToDrive}
                    disabled={isSyncing}
                    className="flex items-center justify-center gap-2 px-5 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-extrabold cursor-pointer transition-all shadow-sm"
                  >
                    {isSyncing ? <RefreshCw className="w-4 h-4 animate-spin text-white" /> : <Upload className="w-4 h-4 text-white" />}
                    Backup JSON to Drive
                  </button>
                  <button
                    onClick={handleRestoreFromDrive}
                    disabled={isSyncing}
                    className="flex items-center justify-center gap-2 px-5 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-sm font-extrabold cursor-pointer transition-all border border-slate-200 shadow-sm"
                  >
                    {isSyncing ? <RefreshCw className="w-4 h-4 animate-spin text-slate-600" /> : <Download className="w-4 h-4 text-slate-600" />}
                    Restore JSON from Drive
                  </button>
                </div>

                {/* Last Sync Info */}
                <div className="flex flex-col gap-1 bg-slate-50 border border-slate-200/60 p-4 rounded-xl text-sm text-slate-700 font-extrabold">
                  <span>Last Cloud Backup:</span>
                  <span className="font-mono font-black text-indigo-600">{goals.lastSyncTime || 'Never backed up'}</span>
                </div>
              </div>
            ) : (
              <div className="space-y-6 py-6 text-center">
                <div className="max-w-md mx-auto">
                  <Lock className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <h4 className="text-base font-bold text-slate-800">Google Workspace Backup Connection</h4>
                  <p className="text-sm text-slate-500 mt-2 leading-relaxed">
                    Connect your Google account to automatically store and restore your JSON backup files directly on your personal Google Drive.
                  </p>
                </div>

                {/* Friendly Help Information Callout for Preview Iframe limits */}
                <div className="max-w-md mx-auto text-left bg-amber-50/75 border border-amber-200 rounded-2xl p-4.5 text-xs text-amber-800 leading-relaxed shadow-xs">
                  <span className="font-extrabold text-amber-900 block mb-1">💡 Sandbox Iframe Notice</span>
                  Standard Google popup sign-in may be blocked inside the builder's preview pane due to browser safety policies regarding third-party frames. If you encounter any login blocks, simply click the <span className="font-bold">"Open in New Tab"</span> icon on the top right of your builder to open the full app directly.
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
                Local JSON File Import / Export
              </h3>
              <p className="text-slate-500 text-sm mt-1">Export or restore your full database manually as a single JSON file</p>
            </div>

            <div className="space-y-6">
              <p className="text-sm text-slate-600 leading-relaxed font-medium">
                Export your hypertrophy logs, exercise routines, and nutrition list as <span className="font-mono text-indigo-600 font-bold">hypertrophy_hub_backup.json</span>. You can restore this JSON file at any time on any device.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  onClick={handleLocalExport}
                  className="flex items-center justify-center gap-2 px-5 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-bold cursor-pointer transition-all border border-slate-200"
                >
                  <Upload className="w-4 h-4 text-slate-500" />
                  Export JSON File
                </button>
                <label className="flex items-center justify-center gap-2 px-5 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-bold cursor-pointer transition-all border border-slate-200 border-dashed">
                  <Download className="w-4 h-4 text-slate-500" />
                  <span>Import JSON File</span>
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

      {/* Google Drive Folder Configuration Panel */}
      <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm space-y-6" id="google-folder-config-panel">
        <div className="border-b border-slate-100 pb-4">
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Folder className="w-5 h-5 text-indigo-600" />
            Google Drive Storage Location
          </h3>
          <p className="text-slate-500 text-sm mt-1">
            Specify an optional target folder for your Google Drive JSON backups
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSaveFolderLink} className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <Folder className="w-3.5 h-3.5 text-indigo-500" />
              Google Drive Folder Link or ID (Optional)
            </label>
            <input
              type="text"
              placeholder="Paste Google Drive folder link or ID (e.g., https://drive.google.com/drive/folders/...)"
              value={folderLinkInput}
              onChange={(e) => setFolderLinkInput(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 font-medium"
            />
            <p className="text-[11px] text-slate-400 font-medium mt-1">
              Provide a folder link to save and restore your <span className="font-mono text-indigo-600 font-semibold">hypertrophy_hub_backup.json</span> backup file inside that specific directory. If left empty, backups default to your root Google Drive folder.
            </p>
          </div>

          <div>
            <button
              type="submit"
              disabled={isSavingFolder}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-xl text-sm font-bold cursor-pointer transition-all shadow-sm"
            >
              Save Storage Location
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

        {/* DISPLAY SAVED CUSTOM FOODS IF ANY */}
        {parsedFoods.length > 0 && (
          <div className="pt-6 border-t border-slate-100 space-y-4">
            <div className="flex justify-between items-center">
              <h4 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Flame className="w-4 h-4 text-indigo-500" />
                Custom JSON Foods ({parsedFoods.length})
              </h4>
              <button
                type="button"
                onClick={() => onUpdateParsedFoods([])}
                className="px-2 py-0.5 text-[10px] font-bold text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md border border-slate-200 hover:border-rose-200 transition-colors flex items-center gap-1 cursor-pointer"
                title="Clear custom foods list"
              >
                <Trash2 className="w-3 h-3" />
                Clear
              </button>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
              {parsedFoods.map((food, idx) => (
                <div
                  key={`parsed-food-${idx}`}
                  onClick={() => handleLogParsedMeal(food)}
                  className="flex justify-between items-center p-3.5 bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 rounded-xl cursor-pointer transition-all group"
                >
                  <div>
                    <h5 className="text-xs font-bold text-slate-800 group-hover:text-indigo-900">{food.name}</h5>
                    <p className="text-[11px] text-slate-500 mt-1">
                      {food.protein}g protein • {food.calories} kcal
                    </p>
                  </div>
                  <button className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-400 group-hover:text-indigo-600 group-hover:border-indigo-300 transition-colors">
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* Custom Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmConfig.isOpen}
        title={confirmConfig.title}
        message={confirmConfig.message}
        confirmText={confirmConfig.confirmText}
        variant={confirmConfig.variant}
        onConfirm={confirmConfig.onConfirm}
        onCancel={() => setConfirmConfig((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
