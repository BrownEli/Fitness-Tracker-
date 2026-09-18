import React, { useState, useEffect } from 'react';
import { UserGoals, DailyLog, CoachingInsight, Meal, Workout } from '../types';
import { auth, googleSignIn, logout, initAuth, isTokenExpired } from '../lib/googleAuth';
import { ConfirmModal } from './ConfirmModal';
import {
  backupDataToDrive,
  extractFolderId,
  getBackupFilename
} from '../lib/googleApi';
import { sendWebNotification, registerNotificationServiceWorker } from '../lib/notifications';
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
  Trash2,
  Bell,
  Smartphone,
  Clock,
  Check
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
  onPerformDriveBackup?: (overrideToken?: string) => Promise<{ filename?: string; folderId?: string }>;
  currentUserId?: string;
  currentUserEmail?: string;
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
  onUpdateParsedWorkouts,
  onPerformDriveBackup,
  currentUserId,
  currentUserEmail
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

  // Local Export state
  const [fileError, setFileError] = useState<string | null>(null);
  const [fileSuccess, setFileSuccess] = useState<string | null>(null);

  const [sessionExpired, setSessionExpired] = useState(false);

  // Notification states
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(() => {
    return typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default';
  });
  const [reminderTimeInput, setReminderTimeInput] = useState(goals.backupReminderTime || '22:00');
  const [notifFeedback, setNotifFeedback] = useState<string | null>(null);

  const handleToggleReminder = (enabled: boolean) => {
    onUpdateGoals((prev) => ({
      ...prev,
      backupReminderEnabled: enabled
    }));
    setNotifFeedback(enabled ? 'Daily backup reminders enabled!' : 'Daily backup reminders disabled');
    setTimeout(() => setNotifFeedback(null), 3000);
  };

  const handleSaveReminderTime = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateGoals((prev) => ({
      ...prev,
      backupReminderTime: reminderTimeInput
    }));
    setNotifFeedback(`Reminder time updated to ${reminderTimeInput}!`);
    setTimeout(() => setNotifFeedback(null), 3000);
  };

  const handleRequestPermission = async () => {
    if (!('Notification' in window)) {
      setNotifFeedback('Web Notifications are not supported by this browser.');
      return;
    }
    const result = await Notification.requestPermission();
    setNotifPermission(result);
    if (result === 'granted') {
      await registerNotificationServiceWorker();
      setNotifFeedback('✓ Notification permission granted!');
    } else {
      setNotifFeedback('Notification permission was not granted.');
    }
    setTimeout(() => setNotifFeedback(null), 4000);
  };

  const triggerTestNotification = async () => {
    const res = await sendWebNotification(
      'Fitness Tracker - Time to Backup! ☁️',
      {
        body: "Don't forget to export your daily workout & nutrition logs to Google Drive.",
        icon: '/favicon.ico',
        tag: 'test-backup-reminder'
      },
      () => {
        window.focus();
        window.location.hash = 'google-sync-section';
        const el = document.getElementById('google-sync-section');
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }
    );

    if (res.success) {
      setNotifFeedback('✓ Test notification sent! Check your notification tray or phone status bar.');
    } else {
      setNotifFeedback('Failed to send notification: ' + (res.error || 'Check browser permissions'));
    }
    setTimeout(() => setNotifFeedback(null), 5000);
  };

  const handleSendTestNotification = async () => {
    if (!('Notification' in window)) {
      setNotifFeedback('Web Notifications are not supported in this browser.');
      return;
    }

    if (Notification.permission !== 'granted') {
      const res = await Notification.requestPermission();
      setNotifPermission(res);
      if (res === 'granted') {
        await registerNotificationServiceWorker();
        await triggerTestNotification();
      } else {
        setNotifFeedback('Please allow notifications in browser settings to receive test alert.');
      }
    } else {
      await triggerTestNotification();
    }
  };

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
    setDocSuccess('Google Drive storage location saved successfully!');
    setTimeout(() => setDocSuccess(null), 4000);
  };

  // Export JSON backup payload to Google Drive (creates new timestamped file every time)
  const handleExportToDrive = async () => {
    const activeToken = await getOrRenewToken();
    if (!activeToken) {
      setSyncStatus('error');
      setSyncMessage('Please authenticate with Google before exporting JSON.');
      return;
    }

    setIsSyncing(true);
    setSyncStatus('idle');
    setSyncMessage('');

    try {
      let filename: string | undefined;
      let resolvedFolderId: string | undefined;

      if (onPerformDriveBackup) {
        const res = await onPerformDriveBackup(activeToken);
        filename = res.filename;
        resolvedFolderId = res.folderId;
      } else {
        const effectiveUid = currentUserId || user?.uid;
        const userScopedLogs = effectiveUid ? logs.filter((l) => !l.userId || l.userId === effectiveUid) : logs;
        const payload = {
          userId: effectiveUid || 'user-default',
          userEmail: currentUserEmail || user?.email || undefined,
          goals,
          logs: userScopedLogs,
          insights,
          parsedFoods,
          parsedWorkouts,
          backupVersion: '1.0',
          exportedAt: new Date().toISOString()
        };

        const folderId = goals.driveFolderLink ? extractFolderId(goals.driveFolderLink) : undefined;
        const res = await backupDataToDrive(payload, activeToken, folderId, effectiveUid);
        filename = res.filename;
        resolvedFolderId = res.folderId;

        const nowStr = new Date().toLocaleString();

        onUpdateGoals((prev) => ({
          ...prev,
          lastSyncTime: nowStr,
          driveFolderLink: resolvedFolderId ? `https://drive.google.com/drive/folders/${resolvedFolderId}` : prev.driveFolderLink
        }));
      }

      setSyncStatus('success');
      setSyncMessage(`✓ New JSON backup exported to Google Drive!${filename ? ` File created: "${filename}"` : ''}`);
    } catch (err: any) {
      console.error(err);
      setSyncStatus('error');
      setSyncMessage(err.message || 'Exporting JSON to Google Drive failed.');
    } finally {
      setIsSyncing(false);
    }
  };

  // Manual Local Export (Download JSON file with timestamp)
  const handleLocalExport = () => {
    try {
      const effectiveUid = currentUserId || user?.uid;
      const userScopedLogs = effectiveUid ? logs.filter((l) => !l.userId || l.userId === effectiveUid) : logs;
      const payload = {
        userId: effectiveUid || 'user-default',
        userEmail: currentUserEmail || user?.email || undefined,
        goals,
        logs: userScopedLogs,
        insights,
        parsedFoods,
        parsedWorkouts,
        backupVersion: '1.0',
        exportedAt: new Date().toISOString()
      };
      const filename = getBackupFilename('fitness_tracker_backup');
      const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(payload, null, 2))}`;
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', jsonString);
      downloadAnchor.setAttribute('download', filename);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

      setFileSuccess(`Data exported successfully! Check downloads for "${filename}"`);
      setTimeout(() => setFileSuccess(null), 4000);
    } catch (err: any) {
      setFileError('Failed to export local JSON file.');
    }
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
          Google Sync & JSON Backup
        </h2>
        <p className="text-base sm:text-lg text-slate-300 mt-3 max-w-3xl leading-relaxed">
          Export your hypertrophy logs, custom exercise routines, and nutrition data as timestamped JSON files. Each export automatically creates a unique new file directly in your designated Google Drive storage location!
        </p>
      </div>

      {/* Grid: Google Sync Export and Local Export */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Google Workspace Integration Card */}
        <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start mb-6 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Cloud className="w-5 h-5 text-indigo-600" />
                  Google Drive Export JSON
                </h3>
                <p className="text-slate-500 text-sm mt-1">Export a timestamped JSON backup file to your Google Drive location</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-sm font-extrabold font-mono uppercase ${
                token ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : 'bg-amber-50 text-amber-700 border border-amber-100'
              }`}>
                {token ? 'Connected' : 'Offline'}
              </span>
            </div>

            {/* If authenticated, show user info and action button */}
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

                <div>
                  <button
                    onClick={handleExportToDrive}
                    disabled={isSyncing}
                    className="w-full flex items-center justify-center text-center gap-3 px-6 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-base font-extrabold cursor-pointer transition-all shadow-md shadow-indigo-100 hover:shadow-lg"
                  >
                    {isSyncing ? <RefreshCw className="w-5 h-5 animate-spin text-white" /> : <Upload className="w-5 h-5 text-white" />}
                    <span>Export JSON to Google Drive</span>
                  </button>
                  <p className="text-xs text-slate-500 text-center mt-2.5 font-medium">
                    Creates a new timestamped JSON file (e.g., <span className="font-mono text-indigo-600 font-bold">fitness_tracker_backup_YYYY-MM-DD_HH-mm-ss.json</span>) in your Google Drive storage location. Never overwrites existing files.
                  </p>
                </div>

                {/* Last Sync Info */}
                <div className="flex flex-col gap-1 bg-slate-50 border border-slate-200/60 p-4 rounded-xl text-sm text-slate-700 font-extrabold">
                  <span>Last Google Drive Export:</span>
                  <span className="font-mono font-black text-indigo-600">{goals.lastSyncTime || 'Never exported'}</span>
                </div>
              </div>
            ) : (
              <div className="space-y-6 py-6 text-center">
                <div className="max-w-md mx-auto">
                  <Lock className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <h4 className="text-base font-bold text-slate-800">Google Workspace Connection</h4>
                  <p className="text-sm text-slate-500 mt-2 leading-relaxed">
                    Connect your Google account to export timestamped JSON backup files directly to your personal Google Drive storage location.
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
                  className="mx-auto flex items-center justify-center text-center gap-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-bold px-6 py-3 rounded-xl cursor-pointer transition-all shadow-sm max-w-sm w-full"
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
                className="w-full sm:w-auto text-xs font-bold text-slate-400 hover:text-rose-600 transition-colors cursor-pointer flex items-center justify-center text-center"
              >
                Disconnect Google Account
              </button>
            </div>
          )}
        </div>

        {/* Local Manual Export Card */}
        <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm flex flex-col justify-between">
          <div>
            <div className="mb-6 border-b border-slate-100 pb-4">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <FileJson className="w-5 h-5 text-sky-600" />
                Local JSON File Export
              </h3>
              <p className="text-slate-500 text-sm mt-1">Download a timestamped JSON backup file directly to your device</p>
            </div>

            <div className="space-y-6">
              <p className="text-sm text-slate-600 leading-relaxed font-medium">
                Export your current hypertrophy logs, routines, and goals as a standalone timestamped JSON file (e.g. <span className="font-mono text-indigo-600 font-bold">fitness_tracker_backup_YYYY-MM-DD_HH-mm-ss.json</span>).
              </p>

              <div>
                <button
                  onClick={handleLocalExport}
                  className="w-full flex items-center justify-center text-center gap-3 px-6 py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl text-base font-extrabold cursor-pointer transition-all shadow-md"
                >
                  <Download className="w-5 h-5 text-slate-300" />
                  <span>Export Local JSON File</span>
                </button>
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

      {/* Google Drive Storage Location Configuration Panel */}
      <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm space-y-6" id="google-folder-config-panel">
        <div className="border-b border-slate-100 pb-4">
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Folder className="w-5 h-5 text-indigo-600" />
            Google Drive Storage Location
          </h3>
          <p className="text-slate-500 text-sm mt-1">
            Specify the Google Drive target folder where every "Export JSON" action creates a new timestamped file
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSaveFolderLink} className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <Folder className="w-3.5 h-3.5 text-indigo-500" />
              Google Drive Folder Link or ID
            </label>
            <input
              type="text"
              placeholder="Paste Google Drive folder link or ID (e.g., https://drive.google.com/drive/folders/...)"
              value={folderLinkInput}
              onChange={(e) => setFolderLinkInput(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 font-medium"
            />
            <p className="text-[11px] text-slate-400 font-medium mt-1">
              Set a folder link to store all exported timestamped <span className="font-mono text-indigo-600 font-semibold">fitness_tracker_backup_YYYY-MM-DD_HH-mm-ss.json</span> files inside that specific directory. Every export creates a brand new file and never overwrites previous files. If left empty, exports default to your <span className="font-semibold text-slate-600">Drive / Fitness Tracker / Backups</span> folder.
            </p>
          </div>

          <div>
            <button
              type="submit"
              disabled={isSavingFolder}
              className="w-full sm:w-auto px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-xl text-sm font-bold cursor-pointer transition-all shadow-sm flex items-center justify-center text-center"
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
                className="px-2 py-0.5 text-[10px] font-bold text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md border border-slate-200 hover:border-rose-200 transition-colors flex items-center justify-center text-center gap-1 cursor-pointer"
                title="Clear custom foods list"
              >
                <Trash2 className="w-3.5 h-3.5" />
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

      {/* Android & Mobile Backup Reminder Panel */}
      <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm space-y-6" id="android-notification-panel">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Bell className="w-5 h-5 text-indigo-600" />
              Daily Backup Reminder Notifications
            </h3>
            <p className="text-slate-500 text-sm mt-1">
              Sends an evening notification to your Android device or mobile browser reminding you to open the app and perform a Google Drive backup
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${
              notifPermission === 'granted'
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : notifPermission === 'denied'
                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                : 'bg-amber-50 text-amber-700 border border-amber-200'
            }`}>
              {notifPermission === 'granted' ? '✓ Device Permission Granted' : notifPermission === 'denied' ? '❌ Blocked in Browser' : '⚠️ Permission Needed'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          {/* Settings & Toggle */}
          <div className="space-y-4 bg-slate-50 border border-slate-200 rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-indigo-500" />
                  Enable 10:00 PM Android Reminder
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">Triggers daily evening backup notification</p>
              </div>

              <button
                type="button"
                onClick={() => handleToggleReminder(!goals.backupReminderEnabled)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  goals.backupReminderEnabled ? 'bg-indigo-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    goals.backupReminderEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <form onSubmit={handleSaveReminderTime} className="flex items-end gap-3 pt-2 border-t border-slate-200">
              <div className="flex-1">
                <label className="block text-[10px] font-extrabold text-slate-500 uppercase mb-1 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-slate-400" />
                  Reminder Evening Time
                </label>
                <input
                  type="time"
                  required
                  value={reminderTimeInput}
                  onChange={(e) => setReminderTimeInput(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <button
                type="submit"
                className="w-full sm:w-auto px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center text-center"
              >
                Save Time
              </button>
            </form>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 w-full">
              <button
                type="button"
                onClick={handleRequestPermission}
                className="w-full px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center text-center"
              >
                Grant Device Permission
              </button>

              <button
                type="button"
                onClick={handleSendTestNotification}
                className="w-full px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center text-center gap-1.5"
              >
                <Bell className="w-3.5 h-3.5 text-white" />
                Send Test Notification Now
              </button>
            </div>

            {notifFeedback && (
              <div className="p-3 bg-indigo-50 border border-indigo-150 text-indigo-900 text-xs font-bold rounded-xl flex items-center gap-2">
                <Check className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>{notifFeedback}</span>
              </div>
            )}
          </div>

          {/* Android How-To Card */}
          <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-5 space-y-3">
            <h4 className="text-sm font-bold text-indigo-900 flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-indigo-600" />
              How Android Reminders Work
            </h4>
            <ol className="text-xs text-slate-600 space-y-2 font-medium list-decimal list-inside leading-relaxed">
              <li>
                <span className="font-bold text-slate-800">Permission:</span> Tap <span className="font-bold text-indigo-700">"Grant Device Permission"</span> or <span className="font-bold text-emerald-700">"Send Test Notification"</span> and tap <span className="font-bold text-slate-800">Allow</span> when Chrome asks for notification permission.
              </li>
              <li>
                <span className="font-bold text-slate-800">Add to Home Screen (Recommended):</span> On Android Chrome, tap the menu (<b>⋮</b>) at top right and select <span className="font-bold text-indigo-700">"Add to Home Screen"</span> or <span className="font-bold text-indigo-700">"Install App"</span>.
              </li>
              <li>
                <span className="font-bold text-slate-800">Direct Navigation:</span> At <span className="font-bold text-purple-700">{goals.backupReminderTime || '10:00 PM'}</span>, when you tap the Android notification, it opens the app directly into this <span className="font-bold text-indigo-700">Google Sync & Backup</span> area so you can tap <span className="font-bold text-slate-800">"Export JSON to Google Drive"</span> in 1 click!
              </li>
            </ol>
          </div>
        </div>
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
