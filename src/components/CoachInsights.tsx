import React, { useState, useRef, useEffect } from 'react';
import { CoachingInsight, DailyLog, UserGoals, CoachingChatMessage } from '../types';
import { formatDateDDMMYYYY } from '../dateUtils';
import {
  Sparkles,
  MessageSquare,
  Trophy,
  Send,
  BrainCircuit,
  Trash2,
  X,
  ArrowRight,
  Bot,
  User,
  CornerDownLeft,
  Loader2,
  MessageCircle,
  AlertCircle,
  Camera,
  Image as ImageIcon,
  ShieldCheck,
  StopCircle,
  Eye,
  AlertTriangle,
  RotateCcw
} from 'lucide-react';

interface CoachInsightsProps {
  insights: CoachingInsight[];
  logs: DailyLog[];
  goals: UserGoals;
  onAddInsight: (insight: CoachingInsight) => void;
  onUpdateInsight?: (index: number, insight: CoachingInsight) => void;
  onDeleteInsight?: (index: number) => void;
}

// Helper to format timestamps nicely without micro-copy or parentheticals
export function formatInsightTimestamp(rawTimestamp?: string, createdAt?: string): string {
  const timeVal = createdAt || rawTimestamp;
  if (!timeVal) return 'Recent';

  const date = new Date(timeVal);
  if (!isNaN(date.getTime()) && !/^\d{1,2}:\d{2}$/.test(timeVal.trim())) {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();

    if (diffMs < 0 && diffMs > -60000) return 'Just now';

    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHours = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSec < 60) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) {
      return `Yesterday, ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
    }
    if (diffDays < 7) {
      return `${diffDays}d ago`;
    }

    const dateFormatted = formatDateDDMMYYYY(date);
    const timeFormatted = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    return `${dateFormatted}, ${timeFormatted}`;
  }

  return rawTimestamp || 'Recent';
}

// Helper to compress and format image on device
function processImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Selected file must be an image'));
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 1280;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(event.target?.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const compressed = canvas.toDataURL('image/jpeg', 0.84);
        resolve(compressed);
      };
      img.onerror = () => resolve(event.target?.result as string);
      img.src = event.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.readAsDataURL(file);
  });
}

function FormattedInsightContent({ content }: { content: string }) {
  const normalized = content
    .replace(/\$\\rightarrow\$/g, '→')
    .replace(/\\rightarrow/g, '→')
    .replace(/->/g, '→');

  const lines = normalized.split('\n');

  return (
    <div className="space-y-3.5 text-slate-800 text-sm sm:text-base leading-relaxed">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={i} className="h-1" />;

        if (trimmed === '---' || trimmed === '***') {
          return <hr key={i} className="my-4 border-slate-200" />;
        }

        if (trimmed.startsWith('### ') || trimmed.startsWith('## ')) {
          const headingText = trimmed.replace(/^#+\s*/, '').replace(/\*\*/g, '');
          return (
            <h4 key={i} className="text-base sm:text-lg font-black text-slate-900 pt-2 pb-1 border-b border-slate-100">
              {headingText}
            </h4>
          );
        }

        if (trimmed.startsWith('* ') || trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
          const bulletText = trimmed.replace(/^[\*\-•]\s*/, '');
          const parts = bulletText.split(/(\*\*[^*]+\*\*)/g);
          return (
            <div key={i} className="flex items-start gap-2.5 pl-2 py-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 mt-2 shrink-0" />
              <div className="flex-1">
                {parts.map((part, pIdx) => {
                  if (part.startsWith('**') && part.endsWith('**')) {
                    return (
                      <strong key={pIdx} className="font-black text-slate-900">
                        {part.slice(2, -2)}
                      </strong>
                    );
                  }
                  return <span key={pIdx}>{part}</span>;
                })}
              </div>
            </div>
          );
        }

        const parts = trimmed.split(/(\*\*[^*]+\*\*)/g);
        return (
          <p key={i} className="text-slate-700 font-normal">
            {parts.map((part, pIdx) => {
              if (part.startsWith('**') && part.endsWith('**')) {
                return (
                  <strong key={pIdx} className="font-black text-slate-900">
                    {part.slice(2, -2)}
                  </strong>
                );
              }
              return <span key={pIdx}>{part}</span>;
            })}
          </p>
        );
      })}
    </div>
  );
}

export default function CoachInsights({
  insights,
  logs,
  goals,
  onAddInsight,
  onUpdateInsight,
  onDeleteInsight
}: CoachInsightsProps) {
  const [userQuery, setUserQuery] = useState('');
  const [questionImage, setQuestionImage] = useState<string | null>(null);
  const [isGeneratingTip, setIsGeneratingTip] = useState(false);
  const [isAskingQuestion, setIsAskingQuestion] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedModalInsight, setSelectedModalInsight] = useState<{ insight: CoachingInsight; index: number } | null>(null);

  // Anti-spam UI state
  const [antiSpamCooldown, setAntiSpamCooldown] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [lastSentText, setLastSentText] = useState('');
  const [lastSentTime, setLastSentTime] = useState(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Modal chat state
  const [chatInput, setChatInput] = useState('');
  const [chatImage, setChatImage] = useState<string | null>(null);
  const [chatSending, setChatSending] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Lightbox enlarged image view
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);

  // Confirmation dialogs
  const [pendingDeleteInsightIndex, setPendingDeleteInsightIndex] = useState<number | null>(null);
  const [pendingDiscardImageType, setPendingDiscardImageType] = useState<'question' | 'chat' | null>(null);

  // File input refs for camera capture and file selection
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const modalCameraInputRef = useRef<HTMLInputElement>(null);
  const modalGalleryInputRef = useRef<HTMLInputElement>(null);

  // Cooldown timer tick down
  useEffect(() => {
    if (antiSpamCooldown <= 0) return;
    const timer = setInterval(() => {
      setAntiSpamCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [antiSpamCooldown]);

  // Elapsed seconds timer during active in-flight requests
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isAskingQuestion || isGeneratingTip || chatSending) {
      setElapsedSeconds(0);
      interval = setInterval(() => {
        setElapsedSeconds((s) => s + 1);
      }, 1000);
    } else {
      setElapsedSeconds(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isAskingQuestion, isGeneratingTip, chatSending]);

  // Scroll chat to bottom when new messages arrive or modal opens
  useEffect(() => {
    if (selectedModalInsight?.insight.chatMessages && selectedModalInsight.insight.chatMessages.length > 0) {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [selectedModalInsight?.insight.chatMessages?.length]);

  const startCooldown = (seconds = 5) => {
    setAntiSpamCooldown(seconds);
  };

  const handleStopActiveRequest = () => {
    if (abortControllerRef.current) {
      try {
        abortControllerRef.current.abort();
      } catch {
        // ignore
      }
      abortControllerRef.current = null;
    }
    setIsAskingQuestion(false);
    setIsGeneratingTip(false);
    setChatSending(false);
    setErrorMessage('Consultation canceled by user');
  };

  // Image handlers for top Question Box (Strictly enforces single image per response)
  const handleCameraCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (cameraInputRef.current) cameraInputRef.current.value = '';
    if (!file) return;

    try {
      const base64 = await processImageFile(file);
      setQuestionImage(base64);
      setErrorMessage(null);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Could not load camera picture.');
    }
  };

  const handleGallerySelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (galleryInputRef.current) galleryInputRef.current.value = '';
    if (!file) return;

    try {
      const base64 = await processImageFile(file);
      setQuestionImage(base64);
      setErrorMessage(null);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Could not load chosen picture.');
    }
  };

  // Image handlers for Modal Chat (Strictly enforces single image per response)
  const handleModalCameraCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (modalCameraInputRef.current) modalCameraInputRef.current.value = '';
    if (!file) return;

    try {
      const base64 = await processImageFile(file);
      setChatImage(base64);
      setErrorMessage(null);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Could not load camera picture.');
    }
  };

  const handleModalGallerySelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (modalGalleryInputRef.current) modalGalleryInputRef.current.value = '';
    if (!file) return;

    try {
      const base64 = await processImageFile(file);
      setChatImage(base64);
      setErrorMessage(null);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Could not load chosen picture.');
    }
  };

  const confirmDiscardImage = () => {
    if (pendingDiscardImageType === 'question') {
      setQuestionImage(null);
    } else if (pendingDiscardImageType === 'chat') {
      setChatImage(null);
    }
    setPendingDiscardImageType(null);
  };

  // Request general analysis insight from Gemini
  const handleTriggerAnalysis = async () => {
    if (isGeneratingTip || isAskingQuestion || antiSpamCooldown > 0) return;

    setIsGeneratingTip(true);
    setErrorMessage(null);
    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch('/api/coach/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortControllerRef.current.signal,
        body: JSON.stringify({
          goals,
          recentLogs: logs.slice(-7),
          queryType: 'general_assessment'
        })
      });

      if (!response.ok) {
        throw new Error('Could not reach the coach service. Please check connection and try again.');
      }
      const data = await response.json();

      const nowIso = new Date().toISOString();
      const newInsight: CoachingInsight = {
        timestamp: nowIso,
        createdAt: nowIso,
        summary: data.summary || 'Hypertrophy Assessment Generated',
        text: data.text || 'Keep pushing hard and maintaining optimal protein balance.',
        type: data.type || 'hypertrophy',
        chatMessages: []
      };

      onAddInsight(newInsight);
      setSelectedModalInsight({ insight: newInsight, index: 0 });
      startCooldown(5);
    } catch (error: any) {
      if (error?.name === 'AbortError') return;
      console.error('Error generating coach tip:', error);
      setErrorMessage(error?.message || 'Failed to generate coach advice. Please try again.');
    } finally {
      setIsGeneratingTip(false);
      abortControllerRef.current = null;
    }
  };

  // Submit custom coaching question to Gemini (with optional single image)
  const handleAskQuestion = async (e?: React.FormEvent, directQuestion?: string) => {
    if (e) e.preventDefault();
    const queryText = (directQuestion || userQuery).trim();
    if ((!queryText && !questionImage) || isAskingQuestion || isGeneratingTip || antiSpamCooldown > 0) return;

    // Anti-spam duplicate check
    const nowTime = Date.now();
    if (queryText === lastSentText && nowTime - lastSentTime < 10000 && !questionImage) {
      setErrorMessage('Anti-Spam Guard: Duplicate question detected. Please wait or rephrase.');
      return;
    }

    setIsAskingQuestion(true);
    setErrorMessage(null);
    setLastSentText(queryText);
    setLastSentTime(nowTime);

    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch('/api/coach/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortControllerRef.current.signal,
        body: JSON.stringify({
          goals,
          recentLogs: logs.slice(-5),
          queryType: queryText || 'Photo Coaching Evaluation',
          image: questionImage || undefined
        })
      });

      if (!response.ok) {
        throw new Error('Coach service did not respond. Please try again.');
      }
      const data = await response.json();

      const nowIso = new Date().toISOString();
      const newInsight: CoachingInsight = {
        timestamp: nowIso,
        createdAt: nowIso,
        summary: data.summary || (queryText.length > 50 ? queryText.substring(0, 50) + '...' : queryText || 'Photo Coaching Evaluation'),
        text: data.text || 'Here is your custom coaching recommendation.',
        type: data.type || 'general',
        imageUrl: questionImage || undefined,
        chatMessages: []
      };

      // Clear input and single image only upon successful response
      setUserQuery('');
      setQuestionImage(null);
      onAddInsight(newInsight);
      setSelectedModalInsight({ insight: newInsight, index: 0 });
      startCooldown(5);
    } catch (error: any) {
      if (error?.name === 'AbortError') return;
      console.error('Error asking coach question:', error);
      setErrorMessage(error?.message || 'Could not fetch response from coach. Please retry.');
    } finally {
      setIsAskingQuestion(false);
      abortControllerRef.current = null;
    }
  };

  // Send a follow-up chat message regarding the currently opened recommendation (with optional single image)
  const handleSendChatMessage = async (e?: React.FormEvent, directText?: string) => {
    if (e) e.preventDefault();
    const textToSend = (directText || chatInput).trim();
    if ((!textToSend && !chatImage) || chatSending || !selectedModalInsight || antiSpamCooldown > 0) return;

    const targetIndex = selectedModalInsight.index;
    const currentInsight = selectedModalInsight.insight;
    const existingMessages = currentInsight.chatMessages || [];

    const userMsg: CoachingChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: textToSend || 'Attached follow-up photo for advice.',
      timestamp: new Date().toISOString(),
      imageUrl: chatImage || undefined
    };

    const updatedWithUserMsg: CoachingInsight = {
      ...currentInsight,
      chatMessages: [...existingMessages, userMsg]
    };

    setSelectedModalInsight({ insight: updatedWithUserMsg, index: targetIndex });
    if (onUpdateInsight) {
      onUpdateInsight(targetIndex, updatedWithUserMsg);
    }

    const imageToSend = chatImage;
    setChatInput('');
    setChatImage(null);
    setChatSending(true);

    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch('/api/coach/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortControllerRef.current.signal,
        body: JSON.stringify({
          insightSummary: currentInsight.summary,
          insightText: currentInsight.text,
          insightType: currentInsight.type,
          chatHistory: existingMessages.map((m) => ({ sender: m.sender, text: m.text })),
          userMessage: textToSend || 'Please evaluate this attached photo.',
          goals,
          image: imageToSend || undefined
        })
      });

      if (!response.ok) throw new Error('Failed to send follow-up message');
      const data = await response.json();

      let replyText = data.reply || 'Focus on consistent protein intake and progressive overload for best results.';
      if (replyText.length > 500) {
        replyText = replyText.slice(0, 497) + '...';
      }

      const aiMsg: CoachingChatMessage = {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: replyText,
        timestamp: data.timestamp || new Date().toISOString()
      };

      const updatedWithAiReply: CoachingInsight = {
        ...updatedWithUserMsg,
        chatMessages: [...updatedWithUserMsg.chatMessages!, aiMsg]
      };

      setSelectedModalInsight({ insight: updatedWithAiReply, index: targetIndex });
      if (onUpdateInsight) {
        onUpdateInsight(targetIndex, updatedWithAiReply);
      }
      startCooldown(5);
    } catch (error: any) {
      if (error?.name === 'AbortError') return;
      console.error('Error sending chat message:', error);
      const errorMsg: CoachingChatMessage = {
        id: `ai-err-${Date.now()}`,
        sender: 'ai',
        text: 'Sorry, I could not process your question right now. Please try again.',
        timestamp: new Date().toISOString()
      };
      const updatedWithError: CoachingInsight = {
        ...updatedWithUserMsg,
        chatMessages: [...updatedWithUserMsg.chatMessages!, errorMsg]
      };
      setSelectedModalInsight({ insight: updatedWithError, index: targetIndex });
      if (onUpdateInsight) {
        onUpdateInsight(targetIndex, updatedWithError);
      }
    } finally {
      setChatSending(false);
      abortControllerRef.current = null;
    }
  };

  // Close modal if the viewed insight was deleted externally
  useEffect(() => {
    if (selectedModalInsight) {
      const currentId = selectedModalInsight.insight.createdAt || selectedModalInsight.insight.timestamp;
      const stillExists = insights.some(
        (ins) => (ins.createdAt || ins.timestamp) === currentId
      );
      if (!stillExists) {
        setSelectedModalInsight(null);
      }
    }
  }, [insights]);

  // Safe delete handler with mandatory confirmation
  const handleDeleteInsightClick = (index: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (onDeleteInsight) {
      onDeleteInsight(index);
    } else {
      setPendingDeleteInsightIndex(index);
    }
  };

  const confirmDeleteInsight = () => {
    if (pendingDeleteInsightIndex !== null) {
      if (onDeleteInsight) {
        onDeleteInsight(pendingDeleteInsightIndex);
      }
      if (selectedModalInsight?.index === pendingDeleteInsightIndex) {
        setSelectedModalInsight(null);
      }
      setPendingDeleteInsightIndex(null);
    }
  };

  const starterQuestions = [
    'How do I break through a bench press plateau?',
    'What should I eat for optimal post-workout recovery?',
    'How many sets per muscle group per week are optimal?'
  ];

  const chatSuggestions = [
    'How should I apply this today?',
    'What food swaps do you recommend?',
    'How does this affect my rest days?'
  ];

  return (
    <div className="space-y-6" id="coach-insights-section">
      {/* Hidden File Inputs for AI Photo Captures */}
      <input
        type="file"
        accept="image/*"
        capture="environment"
        ref={cameraInputRef}
        onChange={handleCameraCapture}
        className="hidden"
        id="coach-camera-input"
      />
      <input
        type="file"
        accept="image/*"
        ref={galleryInputRef}
        onChange={handleGallerySelect}
        className="hidden"
        id="coach-gallery-input"
      />

      <input
        type="file"
        accept="image/*"
        capture="environment"
        ref={modalCameraInputRef}
        onChange={handleModalCameraCapture}
        className="hidden"
        id="modal-coach-camera-input"
      />
      <input
        type="file"
        accept="image/*"
        ref={modalGalleryInputRef}
        onChange={handleModalGallerySelect}
        className="hidden"
        id="modal-coach-gallery-input"
      />

      {/* Top Action & Question Box */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
              <BrainCircuit className="w-5 h-5 text-indigo-600" />
              AI Hypertrophy Coach
            </h3>
            <p className="text-sm text-slate-500 font-medium mt-0.5">
              Ask any fitness question, upload a progress or meal photo, or generate recommendations from your logged data
            </p>
          </div>

          <button
            type="button"
            onClick={handleTriggerAnalysis}
            disabled={isGeneratingTip || isAskingQuestion || antiSpamCooldown > 0}
            className="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-sm rounded-2xl shadow-xs transition-all cursor-pointer flex items-center justify-center gap-2 shrink-0 min-h-[48px] disabled:cursor-not-allowed"
            id="trigger-ai-analysis-btn"
          >
            {isGeneratingTip ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Evaluating Logs</span>
              </>
            ) : antiSpamCooldown > 0 ? (
              <span>Cooldown Active &bull; {antiSpamCooldown}s</span>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Generate Routine Tip</span>
              </>
            )}
          </button>
        </div>

        {/* Anti-Spam Guard Status Banner */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-3 bg-indigo-50/70 border border-indigo-100 rounded-2xl">
          <div className="flex items-center gap-2 text-indigo-900 text-sm font-bold">
            <ShieldCheck className="w-5 h-5 text-indigo-600 shrink-0" />
            <span>Anti-Spam Guard Active</span>
            <span className="text-indigo-300 font-normal">&bull;</span>
            <span className="text-indigo-700 font-medium">Single Image Protected</span>
          </div>
          {antiSpamCooldown > 0 && (
            <span className="text-sm font-black text-amber-800 bg-amber-100 px-3 py-1 rounded-xl">
              Cooldown Active &bull; {antiSpamCooldown}s remaining
            </span>
          )}
        </div>

        {/* Error message alert if any */}
        {errorMessage && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-center justify-between gap-3 text-sm text-rose-700 font-medium animate-fade-in">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="text-rose-500 hover:text-rose-700 p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Active In-flight request box with cancel action */}
        {(isAskingQuestion || isGeneratingTip) && (
          <div className="p-4 bg-slate-900 text-white rounded-2xl flex flex-col items-center justify-center gap-2.5 text-center shadow-md animate-fade-in">
            <div className="flex items-center gap-2.5">
              <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
              <span className="text-sm font-bold">
                {isAskingQuestion ? 'Consulting Hypertrophy Coach' : 'Evaluating Tracking Logs'}
              </span>
            </div>
            <p className="text-sm text-slate-400 font-medium">
              {elapsedSeconds}s elapsed &bull; Anti-Spam Protected
            </p>
            <button
              type="button"
              onClick={handleStopActiveRequest}
              className="mt-1 px-5 py-2.5 min-h-[48px] bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm rounded-xl transition-colors cursor-pointer flex items-center gap-2"
            >
              <StopCircle className="w-5 h-5" />
              <span>Cancel Request</span>
            </button>
          </div>
        )}

        {/* Custom Question Form */}
        <div className="space-y-3.5">
          <form onSubmit={(e) => handleAskQuestion(e)} className="flex flex-col gap-3 items-stretch" id="ask-coach-form">
            <div className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 flex items-center gap-3 focus-within:border-indigo-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-indigo-100 transition-all min-h-[48px]">
              <MessageSquare className="w-5 h-5 text-indigo-500 shrink-0" />
              <input
                type="text"
                placeholder="Ask any question: 'What to eat before heavy leg day?' or upload photo"
                value={userQuery}
                onChange={(e) => setUserQuery(e.target.value)}
                disabled={isAskingQuestion || isGeneratingTip || antiSpamCooldown > 0}
                className="w-full bg-transparent text-sm text-slate-900 placeholder-slate-400 focus:outline-none font-medium"
                id="coach-question-input"
              />
            </div>

            {/* Photo Selection / Preview Area (Single Image per Response) */}
            {questionImage ? (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col space-y-3">
                <div className="flex flex-col space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-slate-900">Attached Photo</span>
                    <span className="px-2.5 py-0.5 bg-indigo-50 text-indigo-700 font-bold text-sm rounded-lg border border-indigo-100">
                      1 Image Attached
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 font-medium">
                    Single image limit enforced for focused coaching analysis
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                  <div
                    onClick={() => setEnlargedImage(questionImage)}
                    className="relative w-28 h-28 rounded-2xl overflow-hidden border border-slate-200 bg-slate-900 group cursor-pointer shrink-0 shadow-xs"
                  >
                    <img src={questionImage} alt="Question preview" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Eye className="w-5 h-5 text-white" />
                    </div>
                  </div>

                  <div className="flex flex-col space-y-2 w-full sm:w-auto flex-1">
                    <button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      disabled={isAskingQuestion || isGeneratingTip || antiSpamCooldown > 0}
                      className="w-full min-h-[48px] px-4 py-2.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 transition-colors cursor-pointer flex items-center justify-center gap-2"
                    >
                      <Camera className="w-4 h-4 text-indigo-600" />
                      <span>Retake Photo</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPendingDiscardImageType('question')}
                      disabled={isAskingQuestion || isGeneratingTip}
                      className="w-full min-h-[48px] px-4 py-2.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 rounded-xl text-sm font-bold transition-colors cursor-pointer flex items-center justify-center gap-2"
                    >
                      <Trash2 className="w-4 h-4 text-rose-600" />
                      <span>Remove Photo</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  disabled={isAskingQuestion || isGeneratingTip || antiSpamCooldown > 0}
                  className="min-h-[48px] px-4 py-3 bg-slate-50 hover:bg-indigo-50/70 border border-slate-200 hover:border-indigo-300 rounded-2xl transition-all cursor-pointer flex items-center justify-center gap-2.5 text-slate-700 font-bold text-sm disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                >
                  <Camera className="w-5 h-5 text-indigo-600 shrink-0" />
                  <span>Take Photo</span>
                </button>

                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  disabled={isAskingQuestion || isGeneratingTip || antiSpamCooldown > 0}
                  className="min-h-[48px] px-4 py-3 bg-slate-50 hover:bg-indigo-50/70 border border-slate-200 hover:border-indigo-300 rounded-2xl transition-all cursor-pointer flex items-center justify-center gap-2.5 text-slate-700 font-bold text-sm disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                >
                  <ImageIcon className="w-5 h-5 text-indigo-600 shrink-0" />
                  <span>Choose Photo</span>
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={isAskingQuestion || isGeneratingTip || antiSpamCooldown > 0 || (!userQuery.trim() && !questionImage)}
              className="bg-slate-900 hover:bg-black disabled:bg-slate-200 disabled:text-slate-400 text-white px-6 py-3 rounded-2xl cursor-pointer transition-all flex items-center justify-center gap-2 font-bold text-sm w-full min-h-[48px] disabled:cursor-not-allowed"
              id="send-question-btn"
            >
              {isAskingQuestion ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Consulting Coach</span>
                </>
              ) : antiSpamCooldown > 0 ? (
                <span>Cooldown Active &bull; {antiSpamCooldown}s</span>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Ask Coach</span>
                </>
              )}
            </button>
          </form>

          {/* Quick starter question chips */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-sm font-semibold text-slate-400">Try asking:</span>
            {starterQuestions.map((q, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleAskQuestion(undefined, q)}
                disabled={isAskingQuestion || isGeneratingTip || antiSpamCooldown > 0}
                className="text-sm bg-slate-50 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 text-slate-700 font-medium px-3.5 py-2 rounded-xl border border-slate-200 transition-all cursor-pointer flex items-center gap-1.5 min-h-[44px] disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
              >
                <span>{q}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Recommendations Archive List - Vertical-First Column Alignment */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-black text-slate-900">Coach Recommendations</h3>
            <span className="font-mono text-sm font-black bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-lg border border-indigo-100">
              {insights.length}
            </span>
          </div>
          <span className="text-sm text-slate-500 font-medium">Click any recommendation to view full advice and chat</span>
        </div>

        {insights.length === 0 ? (
          <div className="p-10 text-center bg-white border border-dashed border-slate-200 rounded-3xl space-y-3">
            <Trophy className="w-10 h-10 text-slate-300 mx-auto" />
            <h4 className="text-sm font-black text-slate-700">No Recommendations Yet</h4>
            <p className="text-sm text-slate-500 font-medium max-w-sm mx-auto">
              Type a fitness question above or tap Generate Routine Tip to receive personalized hypertrophy guidance.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4" id="insights-list">
            {insights.map((insight, idx) => {
              const cleanPreview = insight.text
                .replace(/^#+\s*/gm, '')
                .replace(/\*\*/g, '')
                .replace(/\$\\rightarrow\$/g, '→')
                .replace(/\\rightarrow/g, '→')
                .replace(/---/g, '')
                .trim();

              const messageCount = insight.chatMessages?.length || 0;

              return (
                <div
                  key={idx}
                  className="bg-white border border-slate-200 hover:border-indigo-300 hover:shadow-md rounded-2xl p-5 transition-all flex flex-col space-y-3.5 group relative"
                >
                  {/* 1. Top metadata / timestamp / type tag */}
                  <div className="flex flex-col space-y-1.5 pb-2 border-b border-slate-100 w-full">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`text-sm font-black uppercase px-2.5 py-1 rounded-lg ${
                          insight.type === 'hypertrophy'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                            : insight.type === 'nutrition'
                            ? 'bg-sky-50 text-sky-700 border border-sky-100'
                            : 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                        }`}
                      >
                        {insight.type}
                      </span>

                      {messageCount > 0 && (
                        <span className="flex items-center gap-1.5 text-sm font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100">
                          <MessageCircle className="w-4 h-4" />
                          <span>{messageCount} Follow-up messages</span>
                        </span>
                      )}

                      {insight.imageUrl && (
                        <span className="flex items-center gap-1.5 text-sm font-bold text-violet-700 bg-violet-50 px-2.5 py-1 rounded-lg border border-violet-100">
                          <ImageIcon className="w-4 h-4" />
                          <span>1 Photo Analyzed</span>
                        </span>
                      )}
                    </div>
                    <span className="text-sm text-slate-400 font-mono font-medium">
                      {formatInsightTimestamp(insight.timestamp, insight.createdAt)}
                    </span>
                  </div>

                  {/* 2. Full-width item title / name */}
                  <h4 className="text-base font-black text-slate-900 group-hover:text-indigo-600 transition-colors leading-snug w-full">
                    {insight.summary}
                  </h4>

                  {/* 3. Secondary description / details / subtitle */}
                  <p className="text-sm text-slate-600 line-clamp-3 leading-relaxed w-full">
                    {cleanPreview}
                  </p>

                  {/* 4. Metrics, values, or attached image thumbnail */}
                  {insight.imageUrl && (
                    <div className="w-full pt-1">
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          setEnlargedImage(insight.imageUrl || null);
                        }}
                        className="relative w-28 h-28 rounded-2xl overflow-hidden border border-slate-200 bg-slate-900 group/img cursor-pointer shadow-xs"
                      >
                        <img
                          src={insight.imageUrl}
                          alt="Attached photo"
                          className="w-full h-full object-cover group-hover/img:scale-105 transition-transform"
                        />
                        <div className="absolute inset-0 bg-black/25 flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity">
                          <Eye className="w-5 h-5 text-white" />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 5. Action buttons in their own dedicated vertical action section */}
                  <div className="w-full pt-2 flex flex-col space-y-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setSelectedModalInsight({ insight, index: idx })}
                      className="w-full min-h-[48px] px-5 py-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-sm rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2"
                    >
                      <span>{messageCount > 0 ? 'Continue Discussion' : 'Read Advice and Discuss'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                    {onDeleteInsight && (
                      <button
                        type="button"
                        onClick={(e) => handleDeleteInsightClick(idx, e)}
                        className="w-full min-h-[48px] px-4 py-3 rounded-xl text-rose-600 hover:text-rose-700 bg-rose-50/60 hover:bg-rose-100 border border-rose-200/80 transition-colors cursor-pointer flex items-center justify-center gap-2 font-bold text-sm"
                        id={`delete-insight-btn-${idx}`}
                      >
                        <Trash2 className="w-4 h-4 text-rose-600" />
                        <span>Delete Recommendation</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pop-up Modal for Recommendation Advice & Follow-up Chat */}
      {selectedModalInsight && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div
            className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-100 overflow-hidden my-auto animate-fade-in"
            onClick={(e) => e.stopPropagation()}
            id="coach-insight-popup-modal"
          >
            {/* Modal Header */}
            <div className="p-5 sm:p-6 border-b border-slate-100 flex items-start justify-between gap-4 bg-slate-50/70 shrink-0">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-sm font-black uppercase px-2.5 py-0.5 rounded-lg ${
                      selectedModalInsight.insight.type === 'hypertrophy'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                        : selectedModalInsight.insight.type === 'nutrition'
                        ? 'bg-sky-50 text-sky-700 border border-sky-100'
                        : 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                    }`}
                  >
                    {selectedModalInsight.insight.type}
                  </span>
                  <span className="text-sm text-slate-400 font-mono font-medium">
                    {formatInsightTimestamp(selectedModalInsight.insight.timestamp, selectedModalInsight.insight.createdAt)}
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-black text-slate-900 leading-snug">
                  {selectedModalInsight.insight.summary}
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setSelectedModalInsight(null)}
                className="p-2.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer min-w-[48px] min-h-[48px] flex items-center justify-center shrink-0"
                id="close-insight-modal-btn"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body: Scrollable Original Content + Follow-up Chat */}
            <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-6">
              {/* Original Recommendation Box */}
              <div className="bg-slate-50/60 rounded-2xl p-4 sm:p-5 border border-slate-100 space-y-3">
                <div className="text-sm font-black text-slate-400 uppercase tracking-wider">
                  Coach Guidance
                </div>
                {selectedModalInsight.insight.imageUrl && (
                  <div className="w-full pb-2">
                    <div
                      onClick={() => setEnlargedImage(selectedModalInsight.insight.imageUrl || null)}
                      className="relative w-36 h-36 rounded-2xl overflow-hidden border border-slate-200 bg-slate-900 group cursor-pointer shadow-xs"
                    >
                      <img
                        src={selectedModalInsight.insight.imageUrl}
                        alt="Initial question attachment"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                      <div className="absolute inset-0 bg-black/25 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Eye className="w-5 h-5 text-white" />
                      </div>
                    </div>
                  </div>
                )}
                <FormattedInsightContent content={selectedModalInsight.insight.text} />
              </div>

              {/* Follow-up Discussion Thread */}
              <div className="space-y-4 pt-2">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-slate-100 pb-2 gap-1">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-indigo-600" />
                    <h4 className="text-sm font-black text-slate-900">Follow-up Discussion</h4>
                  </div>
                  <span className="text-sm text-slate-400 font-medium">AI replies capped at 500 characters</span>
                </div>

                {/* Messages List */}
                {selectedModalInsight.insight.chatMessages && selectedModalInsight.insight.chatMessages.length > 0 ? (
                  <div className="space-y-3.5" id="coach-chat-thread">
                    {selectedModalInsight.insight.chatMessages.map((msg) => {
                      const isUser = msg.sender === 'user';
                      return (
                        <div
                          key={msg.id}
                          className={`flex items-start gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}
                        >
                          {!isUser && (
                            <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                              <Bot className="w-4 h-4" />
                            </div>
                          )}

                          <div
                            className={`max-w-[85%] rounded-2xl p-3.5 space-y-2 ${
                              isUser
                                ? 'bg-slate-900 text-white rounded-tr-xs'
                                : 'bg-indigo-50/80 border border-indigo-100 text-slate-900 rounded-tl-xs'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-4 text-sm">
                              <span className={`font-bold ${isUser ? 'text-slate-300' : 'text-indigo-700'}`}>
                                {isUser ? 'You' : 'AI Coach'}
                              </span>
                              <span className={`font-mono text-sm ${isUser ? 'text-slate-400' : 'text-slate-400'}`}>
                                {formatInsightTimestamp(msg.timestamp)}
                              </span>
                            </div>

                            {msg.imageUrl && (
                              <div
                                onClick={() => setEnlargedImage(msg.imageUrl || null)}
                                className="relative w-32 h-32 rounded-xl overflow-hidden border border-white/20 bg-black/40 group cursor-pointer shadow-xs my-1"
                              >
                                <img
                                  src={msg.imageUrl}
                                  alt="Follow-up photo"
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                />
                                <div className="absolute inset-0 bg-black/25 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Eye className="w-4 h-4 text-white" />
                                </div>
                              </div>
                            )}

                            <p
                              className={`text-sm leading-relaxed whitespace-pre-wrap ${
                                isUser ? 'text-white font-medium' : 'text-slate-800'
                              }`}
                            >
                              {msg.text}
                            </p>
                          </div>

                          {isUser && (
                            <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                              <User className="w-4 h-4" />
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {chatSending && (
                      <div className="flex items-start gap-2.5 justify-start">
                        <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                          <Bot className="w-4 h-4" />
                        </div>
                        <div className="bg-indigo-50/80 border border-indigo-100 rounded-2xl rounded-tl-xs p-3.5 flex items-center gap-2 text-indigo-700 text-sm font-medium">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Coach is replying</span>
                        </div>
                      </div>
                    )}
                    <div ref={chatBottomRef} />
                  </div>
                ) : (
                  <div className="bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-4 text-center space-y-2">
                    <p className="text-sm font-medium text-slate-600">
                      Have a question or need clarity on this advice?
                    </p>
                    {/* Quick suggestion chips */}
                    <div className="flex flex-wrap gap-2 justify-center pt-1">
                      {chatSuggestions.map((suggestion, sIdx) => (
                        <button
                          key={sIdx}
                          type="button"
                          onClick={() => handleSendChatMessage(undefined, suggestion)}
                          disabled={chatSending || antiSpamCooldown > 0}
                          className="text-sm bg-white hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 text-slate-700 font-semibold px-3 py-1.5 rounded-xl border border-slate-200 transition-all cursor-pointer min-h-[44px] flex items-center gap-1.5 disabled:bg-slate-100 disabled:text-slate-400"
                        >
                          <CornerDownLeft className="w-3.5 h-3.5 text-indigo-500" />
                          <span>{suggestion}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Follow-up Attached Image Preview if selected */}
                {chatImage && (
                  <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-2xl flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        onClick={() => setEnlargedImage(chatImage)}
                        className="relative w-16 h-16 rounded-xl overflow-hidden border border-slate-200 bg-slate-900 group cursor-pointer shrink-0 shadow-xs"
                      >
                        <img src={chatImage} alt="Follow-up preview" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/25 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <Eye className="w-4 h-4 text-white" />
                        </div>
                      </div>
                      <div className="flex flex-col space-y-0.5">
                        <span className="text-sm font-bold text-indigo-950">1 Photo Attached</span>
                        <span className="text-sm text-indigo-700 font-medium">Ready to send with follow-up message</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPendingDiscardImageType('chat')}
                      className="px-3 py-2 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 rounded-xl font-bold text-sm transition-colors cursor-pointer min-h-[48px] flex items-center gap-1.5"
                    >
                      <Trash2 className="w-4 h-4 text-rose-600" />
                      <span>Remove</span>
                    </button>
                  </div>
                )}

                {/* Follow-up chat input and camera triggers */}
                <form onSubmit={handleSendChatMessage} className="flex flex-col gap-2.5 pt-2" id="recommendation-chat-form">
                  <div className="flex gap-2">
                    <div className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 flex items-center gap-2 focus-within:border-indigo-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-indigo-100 transition-all min-h-[48px]">
                      <input
                        type="text"
                        placeholder="Ask follow-up: 'Can I swap rice for sweet potatoes?'"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        disabled={chatSending || antiSpamCooldown > 0}
                        maxLength={300}
                        className="w-full bg-transparent text-sm text-slate-900 placeholder-slate-400 focus:outline-none font-medium"
                        id="recommendation-chat-input"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={chatSending || antiSpamCooldown > 0 || (!chatInput.trim() && !chatImage)}
                      className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white px-5 py-3 rounded-2xl cursor-pointer transition-all flex items-center justify-center gap-2 font-bold text-sm shrink-0 min-h-[48px] disabled:cursor-not-allowed"
                      id="send-chat-msg-btn"
                    >
                      {chatSending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : antiSpamCooldown > 0 ? (
                        <span>{antiSpamCooldown}s</span>
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                      <span>Reply</span>
                    </button>
                  </div>

                  {/* Photo buttons for chat */}
                  {!chatImage && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => modalCameraInputRef.current?.click()}
                        disabled={chatSending || antiSpamCooldown > 0}
                        className="flex-1 min-h-[48px] px-3 py-2 bg-slate-50 hover:bg-indigo-50/70 border border-slate-200 rounded-xl text-slate-700 font-bold text-sm flex items-center justify-center gap-2 cursor-pointer transition-colors disabled:bg-slate-100 disabled:text-slate-400"
                      >
                        <Camera className="w-4 h-4 text-indigo-600" />
                        <span>Take Photo</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => modalGalleryInputRef.current?.click()}
                        disabled={chatSending || antiSpamCooldown > 0}
                        className="flex-1 min-h-[48px] px-3 py-2 bg-slate-50 hover:bg-indigo-50/70 border border-slate-200 rounded-xl text-slate-700 font-bold text-sm flex items-center justify-center gap-2 cursor-pointer transition-colors disabled:bg-slate-100 disabled:text-slate-400"
                      >
                        <ImageIcon className="w-4 h-4 text-indigo-600" />
                        <span>Choose Photo</span>
                      </button>
                    </div>
                  )}
                </form>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3 shrink-0">
              {onDeleteInsight ? (
                <button
                  type="button"
                  onClick={() => handleDeleteInsightClick(selectedModalInsight.index)}
                  className="px-4 py-3 min-h-[48px] bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-sm rounded-xl border border-rose-200 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  id="modal-delete-insight-btn"
                >
                  <Trash2 className="w-4 h-4 text-rose-600" />
                  <span>Delete</span>
                </button>
              ) : (
                <div />
              )}

              <button
                type="button"
                onClick={() => setSelectedModalInsight(null)}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl transition-colors cursor-pointer min-h-[48px]"
                id="modal-close-insight-btn"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog: Delete Insight */}
      {pendingDeleteInsightIndex !== null && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 flex flex-col space-y-4 animate-fade-in">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-6 h-6 text-rose-600" />
            </div>
            <div className="flex flex-col space-y-1">
              <h4 className="text-base font-black text-slate-900">Delete Coaching Advice?</h4>
              <p className="text-sm font-medium text-slate-600">
                This recommendation and all follow-up chat messages will be permanently removed.
              </p>
            </div>
            <div className="flex flex-col space-y-2 pt-2">
              <button
                type="button"
                onClick={confirmDeleteInsight}
                className="w-full min-h-[48px] px-5 py-3 bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm rounded-xl cursor-pointer transition-colors"
                id="confirm-delete-insight-btn"
              >
                Confirm Delete
              </button>
              <button
                type="button"
                onClick={() => setPendingDeleteInsightIndex(null)}
                className="w-full min-h-[48px] px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-xl cursor-pointer transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog: Discard Attached Image */}
      {pendingDiscardImageType !== null && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 flex flex-col space-y-4 animate-fade-in">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-6 h-6 text-amber-600" />
            </div>
            <div className="flex flex-col space-y-1">
              <h4 className="text-base font-black text-slate-900">Remove Attached Image?</h4>
              <p className="text-sm font-medium text-slate-600">
                The attached photo will be removed from this response.
              </p>
            </div>
            <div className="flex flex-col space-y-2 pt-2">
              <button
                type="button"
                onClick={confirmDiscardImage}
                className="w-full min-h-[48px] px-5 py-3 bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm rounded-xl cursor-pointer transition-colors"
                id="confirm-discard-photo-btn"
              >
                Remove Photo
              </button>
              <button
                type="button"
                onClick={() => setPendingDiscardImageType(null)}
                className="w-full min-h-[48px] px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-xl cursor-pointer transition-colors"
              >
                Keep Photo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox / Enlarged Image Modal */}
      {enlargedImage && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setEnlargedImage(null)}
        >
          <div
            className="relative max-w-3xl w-full max-h-[90vh] flex flex-col items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setEnlargedImage(null)}
              className="absolute -top-12 right-0 p-2 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-xl transition-colors cursor-pointer min-h-[48px] min-w-[48px] flex items-center justify-center"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={enlargedImage}
              alt="Enlarged view"
              className="max-h-[80vh] w-auto max-w-full rounded-2xl shadow-2xl object-contain border border-white/10"
            />
            <div className="mt-3">
              <button
                type="button"
                onClick={() => setEnlargedImage(null)}
                className="px-6 py-2.5 min-h-[48px] bg-white text-slate-900 font-bold text-sm rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
