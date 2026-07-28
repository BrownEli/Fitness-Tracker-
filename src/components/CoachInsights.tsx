import React, { useState } from 'react';
import { CoachingInsight, DailyLog, UserGoals } from '../types';
import { Sparkles, MessageSquare, Flame, Trophy, Send, BrainCircuit } from 'lucide-react';

interface CoachInsightsProps {
  insights: CoachingInsight[];
  logs: DailyLog[];
  goals: UserGoals;
  onAddInsight: (insight: CoachingInsight) => void;
}

export default function CoachInsights({ insights, logs, goals, onAddInsight }: CoachInsightsProps) {
  const [userQuery, setUserQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeInsight, setActiveInsight] = useState<CoachingInsight | null>(insights[0] || null);

  // Request general analysis insight from Gemini
  const handleTriggerAnalysis = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/coach/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goals,
          recentLogs: logs.slice(-7), // Send trailing week of logs
          queryType: 'general_assessment'
        })
      });

      if (!response.ok) throw new Error('Failed to fetch coaching insights');
      const data = await response.json();
      
      const newInsight: CoachingInsight = {
        timestamp: 'Just now',
        summary: data.summary || 'Hypertrophy Assessment Generated',
        text: data.text || 'Keep pushing hard and maintaining optimal protein balance!',
        type: data.type || 'hypertrophy'
      };

      onAddInsight(newInsight);
      setActiveInsight(newInsight);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Submit custom coaching question to Gemini
  const handleAskQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userQuery.trim() || loading) return;

    setLoading(true);
    const queryText = userQuery;
    setUserQuery('');

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

      if (!response.ok) throw new Error('Failed to ask coach');
      const data = await response.json();

      const newInsight: CoachingInsight = {
        timestamp: 'Just now',
        summary: `Answered: ${queryText.length > 30 ? queryText.substring(0, 30) + '...' : queryText}`,
        text: data.text || 'Here is what we advise...',
        type: data.type || 'general'
      };

      onAddInsight(newInsight);
      setActiveInsight(newInsight);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="coach-insights-section">
      {/* Sidebar: Available Insights List */}
      <div className="lg:col-span-4 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col lg:h-[600px]">
        <div className="mb-4">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <BrainCircuit className="w-5 h-5 text-indigo-600" />
            Coach Archives
          </h2>
          <p className="text-slate-500 text-xs mt-0.5">Past evaluations & custom insights</p>
        </div>

        <button
          onClick={handleTriggerAnalysis}
          disabled={loading}
          className="w-full mb-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-100 disabled:text-slate-400 text-white font-bold text-xs sm:text-sm py-3 rounded-xl shadow-md shadow-indigo-100 hover:shadow-indigo-200 transition-all cursor-pointer flex items-center justify-center gap-2"
          id="trigger-ai-analysis-btn"
        >
          <Sparkles className="w-4 h-4" />
          {loading ? 'Evaluating Logs...' : 'Generate AI Coach Tip'}
        </button>

        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 min-h-[220px]" id="insights-list">
          {insights.map((insight, idx) => {
            const isActive = activeInsight?.summary === insight.summary;
            return (
              <button
                key={idx}
                onClick={() => setActiveInsight(insight)}
                className={`w-full text-left p-3.5 rounded-xl border transition-all cursor-pointer ${
                  isActive
                    ? 'bg-indigo-50/70 border-indigo-400/40 text-indigo-950 font-semibold shadow-sm'
                    : 'bg-slate-50/80 border-slate-150 hover:border-slate-300 hover:bg-slate-50 text-slate-600'
                }`}
              >
                <div className="flex justify-between items-center mb-1.5">
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md ${
                    insight.type === 'hypertrophy'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                      : insight.type === 'nutrition'
                      ? 'bg-sky-50 text-sky-700 border border-sky-100'
                      : 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                  }`}>
                    {insight.type}
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono font-medium">{insight.timestamp}</span>
                </div>
                <p className="text-sm font-bold line-clamp-1">{insight.summary}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Panel: Insight details & interactive chat */}
      <div className="lg:col-span-8 flex flex-col gap-5 lg:h-[600px]">
        {/* Detail view of active insight */}
        <div className="flex-1 bg-white border border-slate-200 rounded-2xl p-6 sm:p-7 shadow-sm flex flex-col overflow-hidden min-h-[320px]">
          {activeInsight ? (
            <div className="flex flex-col h-full overflow-y-auto pr-2" id="active-insight-card">
              <div className="flex items-center gap-3.5 border-b border-slate-150 pb-4 mb-5">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700 shadow-sm shrink-0">
                  <Trophy className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-extrabold text-slate-900 leading-snug">{activeInsight.summary}</h3>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                    Coach evaluation • {activeInsight.timestamp}
                  </p>
                </div>
              </div>

              <div className="flex-1 text-base sm:text-lg text-slate-800 leading-relaxed whitespace-pre-wrap font-sans font-normal" id="insight-text-content">
                {activeInsight.text}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col justify-center items-center text-center p-6">
              <Sparkles className="w-12 h-12 text-slate-300 animate-pulse mb-3" />
              <p className="text-sm text-slate-600 font-bold">No insights loaded yet.</p>
              <p className="text-xs text-slate-400 mt-1 max-w-sm">
                Click "Generate AI Coach Tip" to have Gemini review your trailing logs and body metrics.
              </p>
            </div>
          )}
        </div>

        {/* Interactive custom questioning input */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm">
          <form onSubmit={handleAskQuestion} className="flex gap-3 items-center" id="ask-coach-form">
            <div className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 sm:py-3.5 flex items-center gap-3 focus-within:border-indigo-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-indigo-100 transition-all">
              <MessageSquare className="w-5 h-5 text-indigo-500 shrink-0" />
              <input
                type="text"
                placeholder="Ask Coach: 'How much protein should I eat in the morning?'"
                value={userQuery}
                onChange={(e) => setUserQuery(e.target.value)}
                disabled={loading}
                className="w-full bg-transparent text-sm sm:text-base text-slate-900 placeholder-slate-400 focus:outline-none font-medium"
                id="coach-question-input"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !userQuery.trim()}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-100 disabled:text-slate-400 text-white px-5 py-3.5 rounded-xl cursor-pointer transition-all shadow-md hover:shadow-indigo-100 flex items-center justify-center gap-2 font-bold text-sm shrink-0"
              id="send-question-btn"
            >
              <Send className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden sm:inline">Ask</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
