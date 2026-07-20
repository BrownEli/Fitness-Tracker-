import { DailyLog, UserGoals } from '../types';
import { Calendar as CalendarIcon, Check, Dumbbell, Sparkles } from 'lucide-react';

interface CalendarViewProps {
  logs: DailyLog[];
  goals: UserGoals;
  selectedDate: string;
  onSelectDate: (date: string) => void;
}

export default function CalendarView({ logs, goals, selectedDate, onSelectDate }: CalendarViewProps) {
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();

  // Get name of the month
  const monthName = today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  // Get total days in current month
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  // Get starting day of the week (0 = Sunday, 1 = Monday, etc.)
  const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();

  // Generate blank spaces for days of previous month
  const blanks = Array(firstDayIndex).fill(null);

  // Generate array for actual calendar days
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const getFullDateString = (day: number): string => {
    const mm = String(currentMonth + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    return `${currentYear}-${mm}-${dd}`;
  };

  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm" id="calendar-view-container">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6 border-b border-slate-100 pb-5">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <CalendarIcon className="w-5.5 h-5.5 text-indigo-600" />
            Consistency Calendar
          </h2>
          <p className="text-slate-500 text-xs mt-1">Select a day to review and log workouts or nutrition</p>
        </div>
        <div className="bg-indigo-50/75 px-4.5 py-1.5 rounded-xl border border-indigo-100 inline-flex items-center justify-center self-start sm:self-auto">
          <span className="text-sm font-black text-indigo-700 font-mono tracking-tight">{monthName}</span>
        </div>
      </div>

      {/* Calendar Grid Header */}
      <div className="grid grid-cols-7 gap-2 text-center text-slate-400 font-bold text-[11px] uppercase tracking-wider mb-2.5">
        {daysOfWeek.map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar Grid Body */}
      <div className="grid grid-cols-7 gap-2" id="calendar-days-grid">
        {/* Render preceding blank cells */}
        {blanks.map((_, index) => (
          <div key={`blank-${index}`} className="aspect-square bg-transparent rounded-xl"></div>
        ))}

        {/* Render calendar days */}
        {days.map((day) => {
          const dateString = getFullDateString(day);
          const log = logs.find((l) => l.date === dateString);
          
          const isSelected = selectedDate === dateString;
          const isToday = today.toISOString().split('T')[0] === dateString;

          // Compute stats for the day
          const totalProtein = log?.meals.reduce((sum, meal) => sum + meal.protein, 0) || 0;
          const hasWorkout = log?.workouts && log.workouts.length > 0;
          const workoutCompleted = log?.workouts && log.workouts.some(w => w.completed);
          const proteinGoalMet = totalProtein >= goals.dailyProteinTarget;

          return (
            <button
              key={day}
              onClick={() => onSelectDate(dateString)}
              className={`aspect-square relative rounded-xl border flex flex-col items-center justify-between p-1.5 transition-all duration-200 cursor-pointer ${
                isSelected
                  ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm scale-105 z-10 font-bold'
                  : isToday
                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100/70 font-semibold'
                  : 'bg-slate-50 text-slate-700 border-slate-200/80 hover:bg-slate-100 hover:border-slate-300'
              }`}
            >
              {/* Day Number */}
              <span className="text-xs font-mono self-start">{day}</span>

              {/* Badges for protein and workouts */}
              <div className="flex gap-1.5 mt-auto mb-0.5">
                {/* Protein Goal Indicator */}
                {log && totalProtein > 0 && (
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isSelected
                        ? 'bg-white'
                        : proteinGoalMet
                        ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]'
                        : 'bg-amber-500'
                    }`}
                    title={`Protein: ${totalProtein}g`}
                  ></span>
                )}

                {/* Workout Indicator */}
                {hasWorkout && (
                  <Dumbbell
                    className={`w-3 h-3 ${
                      isSelected
                        ? 'text-white'
                        : workoutCompleted
                        ? 'text-indigo-600'
                        : 'text-slate-400'
                    }`}
                  />
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Calendar Legend */}
      <div className="mt-6 pt-5 border-t border-slate-150 grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11px]" id="calendar-legend">
        <div className="flex items-center gap-2 text-slate-500 font-medium">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
          <span>Protein Met (≥ {goals.dailyProteinTarget}g)</span>
        </div>
        <div className="flex items-center gap-2 text-slate-500 font-medium">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
          <span>Protein Below Target</span>
        </div>
        <div className="flex items-center gap-2 text-slate-500 font-medium">
          <Dumbbell className="w-3.5 h-3.5 text-indigo-600" />
          <span>Hypertrophy Lift Logged</span>
        </div>
      </div>
    </div>
  );
}
