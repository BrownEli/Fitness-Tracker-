import React, { useState, useRef, useEffect } from 'react';
import { CoachingInsight, DailyLog, UserGoals, CoachingChatMessage } from '../types';
import { formatDateDDMMYYYY } from '../dateUtils';
import { Sparkles, MessageSquare, Trophy, Send, BrainCircuit, Trash2, X, ArrowRight, Bot, User, CornerDownLeft, Loader2, MessageCircle, AlertCircle } from 'lucide-react';

interface CoachInsightsProps {
  insights: CoachingInsight[];
  logs: DailyLog[];
  goals: UserGoals;
  onAddInsight: (insight: CoachingInsight) => void;
  onUpdateInsight?: (index: number, insight: CoachingInsight) => void;
  onDeleteInsight?: (index: number) => void;
}

// Helper to format timestamps nicely
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

export default function CoachInsights({ insights, logs, goals, onAddInsight, onUpdateInsight, onDeleteInsight }: CoachInsightsProps) {
  const [userQuery, setUserQuery] = useState('');
  const [isGeneratingTip, setIsGeneratingTip] = useState(false);
  const [isAskingQuestion, setIsAskingQuestion] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedModalInsight, setSelectedModalInsight] = useState<{ insight: CoachingInsight; index: number } | null>(null);

  // Modal chat state
  const [chatInput, setChatInput] = useState('');
  const [chatSending, setChatSending] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Scroll chat to bottom when new messages arrive or modal opens
  useEffect(() => {
    if (selectedModalInsight?.insight.chatMessages && selectedModalInsight.insight.chatMessages.length > 0) {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [selectedModalInsight?.insight.chatMessages?.length]);

  // Request general analysis insight from Gemini
  const handleTriggerAnalysis = async () => {
    setIsGeneratingTip(true);
    setErrorMessage(null);
    try {
      const response = await fetch('/api/coach/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
    } catch (error: any) {
      console.error('Error generating coach tip:', error);
      setErrorMessage(error?.message || 'Failed to generate coach advice. Please try again.');
    } finally {
      setIsGeneratingTip(false);
    }
  };

  // Submit custom coaching question to Gemini
  const handleAskQuestion = async (e?: React.FormEvent, directQuestion?: string) => {
    if (e) e.preventDefault();
    const queryText = (directQuestion || userQuery).trim();
    if (!queryText || isAskingQuestion || isGeneratingTip) return;

    setIsAskingQuestion(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/coach/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goals,
          recentLogs: logs.slice(-5),
          queryType: queryText
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
        summary: data.summary || (queryText.length > 50 ? queryText.substring(0, 50) + '...' : queryText),
        text: data.text || 'Here is your custom coaching recommendation.',
        type: data.type || 'general',
        chatMessages: []
      };

      // Clear input only upon successful response
      setUserQuery('');
      onAddInsight(newInsight);
      setSelectedModalInsight({ insight: newInsight, index: 0 });
    } catch (error: any) {
      console.error('Error asking coach question:', error);
      setErrorMessage(error?.message || 'Could not fetch response from coach. Please retry.');
    } finally {
      setIsAskingQuestion(false);
    }
  };

  // Send a follow-up chat message regarding the currently opened recommendation
  const handleSendChatMessage = async (e?: React.FormEvent, directText?: string) => {
    if (e) e.preventDefault();
    const textToSend = (directText || chatInput).trim();
    if (!textToSend || chatSending || !selectedModalInsight) return;

    const targetIndex = selectedModalInsight.index;
    const currentInsight = selectedModalInsight.insight;
    const existingMessages = currentInsight.chatMessages || [];

    const userMsg: CoachingChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toISOString()
    };

    const updatedWithUserMsg: CoachingInsight = {
      ...currentInsight,
      chatMessages: [...existingMessages, userMsg]
    };

    setSelectedModalInsight({ insight: updatedWithUserMsg, index: targetIndex });
    if (onUpdateInsight) {
      onUpdateInsight(targetIndex, updatedWithUserMsg);
    }

    setChatInput('');
    setChatSending(true);

    try {
      const response = await fetch('/api/coach/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          insightSummary: currentInsight.summary,
          insightText: currentInsight.text,
          insightType: currentInsight.type,
          chatHistory: existingMessages.map(m => ({ sender: m.sender, text: m.text })),
          userMessage: textToSend,
          goals
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
    } catch (error) {
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
    }
  };

  const handleDelete = (index: number, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    if (onDeleteInsight) {
      onDeleteInsight(index);
    }
    if (selectedModalInsight?.index === index) {
      setSelectedModalInsight(null);
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
      {/* Top Action & Question Box */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
              <BrainCircuit className="w-5 h-5 text-indigo-600" />
              AI Hypertrophy Coach
            </h3>
            <p className="text-sm text-slate-500 font-medium mt-0.5">
              Ask any fitness or nutrition question, or generate recommendations from your logged data
            </p>
          </div>

          <button
            type="button"
            onClick={handleTriggerAnalysis}
            disabled={isGeneratingTip || isAskingQuestion}
            className="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-sm rounded-2xl shadow-xs transition-all cursor-pointer flex items-center justify-center gap-2 shrink-0 min-h-[48px]"
            id="trigger-ai-analysis-btn"
          >
            {isGeneratingTip ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Evaluating Logs...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Generate Routine Tip</span>
              </>
            )}
          </button>
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
              className="text-rose-500 hover:text-rose-700 p-1.5 rounded-lg cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Custom Question Form */}
        <div className="space-y-2.5">
          <form onSubmit={(e) => handleAskQuestion(e)} className="flex flex-col sm:flex-row gap-2.5 items-stretch" id="ask-coach-form">
            <div className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 flex items-center gap-3 focus-within:border-indigo-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-indigo-100 transition-all min-h-[48px]">
              <MessageSquare className="w-5 h-5 text-indigo-500 shrink-0" />
              <input
                type="text"
                placeholder="Ask any question: 'What to eat before heavy leg day?'"
                value={userQuery}
                onChange={(e) => setUserQuery(e.target.value)}
                disabled={isAskingQuestion || isGeneratingTip}
                className="w-full bg-transparent text-sm text-slate-900 placeholder-slate-400 focus:outline-none font-medium"
                id="coach-question-input"
              />
            </div>
            <button
              type="submit"
              disabled={isAskingQuestion || isGeneratingTip || !userQuery.trim()}
              className="bg-slate-900 hover:bg-black disabled:bg-slate-200 disabled:text-slate-400 text-white px-6 py-3 rounded-2xl cursor-pointer transition-all flex items-center justify-center gap-2 font-bold text-sm shrink-0 min-h-[48px]"
              id="send-question-btn"
            >
              {isAskingQuestion ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Consulting Coach...</span>
                </>
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
                disabled={isAskingQuestion || isGeneratingTip}
                className="text-sm bg-slate-50 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 text-slate-700 font-medium px-3 py-1.5 rounded-xl border border-slate-200 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <span>{q}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Recommendations Archive List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-black text-slate-900">Coach Recommendations</h3>
            <span className="font-mono text-sm font-black bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-lg border border-indigo-100">
              {insights.length}
            </span>
          </div>
          <span className="text-sm text-slate-400 font-medium">Click any recommendation to view full advice & chat</span>
        </div>

        {insights.length === 0 ? (
          <div className="p-10 text-center bg-white border border-dashed border-slate-200 rounded-3xl space-y-3">
            <Trophy className="w-10 h-10 text-slate-300 mx-auto" />
            <h4 className="text-sm font-black text-slate-700">No Recommendations Yet</h4>
            <p className="text-sm text-slate-500 font-medium max-w-sm mx-auto">
              Type a fitness question above or tap "Generate Routine Tip" to receive personalized hypertrophy guidance.
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
                  onClick={() => setSelectedModalInsight({ insight, index: idx })}
                  className="bg-white border border-slate-200 hover:border-indigo-300 hover:shadow-md rounded-2xl p-5 transition-all cursor-pointer flex flex-col justify-between space-y-3.5 group relative"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-sm font-black uppercase px-2.5 py-1 rounded-lg ${
                          insight.type === 'hypertrophy'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                            : insight.type === 'nutrition'
                            ? 'bg-sky-50 text-sky-700 border border-sky-100'
                            : 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                        }`}>
                          {insight.type}
                        </span>

                        {messageCount > 0 && (
                          <span className="flex items-center gap-1 text-sm font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-100">
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span>{messageCount}</span>
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className="text-sm text-slate-400 font-mono font-medium">
                          {formatInsightTimestamp(insight.timestamp, insight.createdAt)}
                        </span>
                        {onDeleteInsight && (
                          <button
                            type="button"
                            onClick={(e) => handleDelete(idx, e)}
                            className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer min-w-[36px] min-h-[36px] flex items-center justify-center"
                            title="Delete Recommendation"
                            id={`delete-insight-btn-${idx}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    <h4 className="text-sm font-black text-slate-900 group-hover:text-indigo-600 transition-colors leading-snug line-clamp-2">
                      {insight.summary}
                    </h4>

                    <p className="text-sm text-slate-600 line-clamp-3 leading-relaxed">
                      {cleanPreview}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-sm font-bold text-indigo-600 group-hover:text-indigo-700">
                    <span>{messageCount > 0 ? 'Continue discussion' : 'Read advice & discuss'}</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
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
                  <span className={`text-sm font-black uppercase px-2.5 py-0.5 rounded-lg ${
                    selectedModalInsight.insight.type === 'hypertrophy'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                      : selectedModalInsight.insight.type === 'nutrition'
                      ? 'bg-sky-50 text-sky-700 border border-sky-100'
                      : 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                  }`}>
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
                className="p-2.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer min-w-[44px] min-h-[44px] flex items-center justify-center shrink-0"
                id="close-insight-modal-btn"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body: Scrollable Original Content + Follow-up Chat */}
            <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-6">
              {/* Original Recommendation Box */}
              <div className="bg-slate-50/60 rounded-2xl p-4 sm:p-5 border border-slate-100">
                <div className="text-sm font-black text-slate-400 uppercase tracking-wider mb-2.5">
                  Coach Guidance
                </div>
                <FormattedInsightContent content={selectedModalInsight.insight.text} />
              </div>

              {/* Follow-up Discussion Thread */}
              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
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

                          <div className={`max-w-[85%] rounded-2xl p-3.5 space-y-1 ${
                            isUser
                              ? 'bg-slate-900 text-white rounded-tr-xs'
                              : 'bg-indigo-50/80 border border-indigo-100 text-slate-900 rounded-tl-xs'
                          }`}>
                            <div className="flex items-center justify-between gap-4 text-sm">
                              <span className={`font-bold ${isUser ? 'text-slate-300' : 'text-indigo-700'}`}>
                                {isUser ? 'You' : 'AI Coach'}
                              </span>
                              <span className={`font-mono text-sm ${isUser ? 'text-slate-400' : 'text-slate-400'}`}>
                                {formatInsightTimestamp(msg.timestamp)}
                              </span>
                            </div>
                            <p className={`text-sm leading-relaxed whitespace-pre-wrap ${isUser ? 'text-white font-medium' : 'text-slate-800'}`}>
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
                          <span>Coach is replying...</span>
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
                          disabled={chatSending}
                          className="text-sm bg-white hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 text-slate-700 font-semibold px-3 py-1.5 rounded-xl border border-slate-200 transition-all cursor-pointer min-h-[36px] flex items-center gap-1.5"
                        >
                          <CornerDownLeft className="w-3.5 h-3.5 text-indigo-500" />
                          <span>{suggestion}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Follow-up chat input */}
                <form onSubmit={handleSendChatMessage} className="flex gap-2 pt-2" id="recommendation-chat-form">
                  <div className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 flex items-center gap-2 focus-within:border-indigo-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-indigo-100 transition-all min-h-[48px]">
                    <input
                      type="text"
                      placeholder="Ask follow-up: 'Can I swap rice for sweet potatoes?'"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      disabled={chatSending}
                      maxLength={300}
                      className="w-full bg-transparent text-sm text-slate-900 placeholder-slate-400 focus:outline-none font-medium"
                      id="recommendation-chat-input"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={chatSending || !chatInput.trim()}
                    className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white px-5 py-3 rounded-2xl cursor-pointer transition-all flex items-center justify-center gap-2 font-bold text-sm shrink-0 min-h-[48px]"
                    id="send-chat-msg-btn"
                  >
                    {chatSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    <span>Reply</span>
                  </button>
                </form>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3 shrink-0">
              {onDeleteInsight ? (
                <button
                  type="button"
                  onClick={() => handleDelete(selectedModalInsight.index)}
                  className="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-sm rounded-xl border border-rose-200 transition-colors flex items-center gap-1.5 cursor-pointer min-h-[44px]"
                  id="modal-delete-insight-btn"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete</span>
                </button>
              ) : (
                <div />
              )}

              <button
                type="button"
                onClick={() => setSelectedModalInsight(null)}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl transition-colors cursor-pointer min-h-[44px]"
                id="modal-close-insight-btn"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
