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
      <div className="lg:col-span-4 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col h-[520px]">
        <div className="mb-4">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <BrainCircuit className="w-4 h-4 text-indigo-600" />
            Coach Archives
          </h2>
          <p className="text-slate-500 text-xs mt-0.5">Past evaluations & custom insights</p>
        </div>

        <button
          onClick={handleTriggerAnalysis}
          disabled={loading}
          className="w-full mb-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-100 disabled:text-slate-400 text-white font-bold text-xs py-2.5 rounded-xl shadow-md shadow-indigo-100 hover:shadow-indigo-200 transition-all cursor-pointer flex items-center justify-center gap-2"
          id="trigger-ai-analysis-btn"
        >
          <Sparkles className="w-3.5 h-3.5" />
          {loading ? 'Evaluating Logs...' : 'Generate AI Coach Tip'}
        </button>

        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1" id="insights-list">
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
                  <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                    insight.type === 'hypertrophy'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                      : insight.type === 'nutrition'
                      ? 'bg-sky-50 text-sky-700 border border-sky-100'
                      : 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                  }`}>
                    {insight.type}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono font-medium">{insight.timestamp}</span>
                </div>
                <p className="text-xs font-bold line-clamp-1">{insight.summary}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Panel: Insight details & interactive chat */}
      <div className="lg:col-span-8 flex flex-col gap-6 h-[520px]">
        {/* Detail view of active insight */}
        <div className="flex-1 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col overflow-hidden">
          {activeInsight ? (
            <div className="flex flex-col h-full overflow-y-auto pr-1" id="active-insight-card">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-4">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700 shadow-sm">
                  <Trophy className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 leading-snug">{activeInsight.summary}</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                    Coach evaluation • {activeInsight.timestamp}
                  </p>
                </div>
              </div>

              <div className="flex-1 text-xs sm:text-sm text-slate-755 leading-relaxed whitespace-pre-wrap font-sans" id="insight-text-content">
                {activeInsight.text}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col justify-center items-center text-center p-6">
              <Sparkles className="w-10 h-10 text-slate-300 animate-pulse mb-3" />
              <p className="text-xs text-slate-500 font-semibold">No insights loaded yet.</p>
              <p className="text-[11px] text-slate-400 mt-1 max-w-sm">
                Click "Generate AI Coach Tip" to have Gemini review your trailing logs and body metrics.
              </p>
            </div>
          )}
        </div>

        {/* Interactive custom questioning input */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <form onSubmit={handleAskQuestion} className="flex gap-2.5 items-center" id="ask-coach-form">
            <div className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 flex items-center gap-2.5 focus-within:border-indigo-500/50 focus-within:bg-white transition-all">
              <MessageSquare className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                type="text"
                placeholder="Ask Coach: 'How much protein should I eat in the morning?'"
                value={userQuery}
                onChange={(e) => setUserQuery(e.target.value)}
                disabled={loading}
                className="w-full bg-transparent text-xs text-slate-800 placeholder-slate-400 focus:outline-none font-medium"
                id="coach-question-input"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !userQuery.trim()}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-100 disabled:text-slate-400 text-white p-2.5 rounded-xl cursor-pointer transition-all shadow-md hover:shadow-lg flex items-center justify-center shrink-0"
              id="send-question-btn"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
