import { DailyLog, UserGoals, ParsedWorkoutDay } from '../types';
import { Calendar as CalendarIcon, Check, Dumbbell, Sparkles, Coffee, Footprints } from 'lucide-react';

interface CalendarViewProps {
  logs: DailyLog[];
  goals: UserGoals;
  selectedDate: string;
  onSelectDate: (date: string) => void;
  parsedWorkouts?: ParsedWorkoutDay[];
}

export default function CalendarView({ logs, goals, selectedDate, onSelectDate, parsedWorkouts = [] }: CalendarViewProps) {
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
          const totalProtein = log?.meals.reduce((sum, meal) => sum + (meal.protein || 0), 0) || 0;
          const totalCarbs = log?.meals.reduce((sum, meal) => sum + (meal.carbs || 0), 0) || 0;
          const totalFiber = log?.meals.reduce((sum, meal) => sum + (meal.fiber || 0), 0) || 0;
          const totalCalories = log?.meals.reduce((sum, meal) => sum + (meal.calories || 0), 0) || 0;

          const targetCarbs = goals.dailyCarbsTarget || 250;
          const targetFiber = goals.dailyFiberTarget || 30;

          const hasWorkout = Boolean(log?.workouts && log.workouts.some(w => w.category !== 'Rest' && !w.name?.toLowerCase().includes('rest') && w.category !== 'Cardio' && !w.id?.startsWith('jog-') && !w.name?.toLowerCase().includes('jog') && !w.name?.toLowerCase().includes('walk')));
          const workoutCompleted = Boolean(log?.workouts && log.workouts.some(w => w.completed && w.category !== 'Rest' && !w.name?.toLowerCase().includes('rest') && w.category !== 'Cardio' && !w.id?.startsWith('jog-') && !w.name?.toLowerCase().includes('jog') && !w.name?.toLowerCase().includes('walk')));
          const hasJog = Boolean((log?.jogs && log.jogs.length > 0) || (log?.workouts && log.workouts.some(w => w.category === 'Cardio' || w.id?.startsWith('jog-') || w.name?.toLowerCase().includes('jog') || w.name?.toLowerCase().includes('walk'))));

          const DAYS_ORDER = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
          const dateObj = new Date(dateString + 'T12:00:00');
          const dayOfWeekName = DAYS_ORDER[dateObj.getDay()];

          const matchingPlanDay = parsedWorkouts.find((pw) => 
            (pw.dayOfWeek && pw.dayOfWeek.toLowerCase() === dayOfWeekName.toLowerCase()) ||
            (pw.day && pw.day.toLowerCase().includes(dayOfWeekName.toLowerCase()))
          );

          const isRestDay = log?.isRestDay || 
            log?.oneTimeScheduleOverride?.isRestDay || 
            Boolean(matchingPlanDay?.isRestDay || (matchingPlanDay?.focusArea && matchingPlanDay.focusArea.toLowerCase().includes('rest')));

          const proteinGoalMet = totalProtein >= goals.dailyProteinTarget;
          const carbsGoalMet = totalCarbs >= targetCarbs;
          const fiberGoalMet = totalFiber >= targetFiber;
          const calorieGoalMet = totalCalories >= goals.dailyCalorieTarget;

          return (
            <button
              key={day}
              onClick={() => onSelectDate(dateString)}
              className={`w-full aspect-square relative rounded-xl border flex flex-col items-center justify-between p-1.5 transition-all duration-200 cursor-pointer text-center ${
                isSelected
                  ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm scale-105 z-10 font-bold'
                  : isToday
                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100/70 font-semibold'
                  : isRestDay
                  ? 'bg-amber-50/50 text-slate-700 border-amber-200/70 hover:bg-amber-100/60'
                  : 'bg-slate-50 text-slate-700 border-slate-200/80 hover:bg-slate-100 hover:border-slate-300'
              }`}
            >
              {/* Day Number */}
              <span className="text-xs font-mono self-start">{day}</span>

              {/* Badges for macros and workouts */}
              <div className="flex items-center gap-1 mt-auto mb-0.5 flex-wrap justify-center">
                {/* Protein Goal Indicator */}
                {log && totalProtein > 0 && (
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isSelected
                        ? 'bg-white'
                        : proteinGoalMet
                        ? 'bg-indigo-500'
                        : 'bg-indigo-300'
                    }`}
                    title={`Protein: ${totalProtein}g / ${goals.dailyProteinTarget}g`}
                  ></span>
                )}

                {/* Carbs Goal Indicator */}
                {log && totalCarbs > 0 && (
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isSelected
                        ? 'bg-sky-200'
                        : carbsGoalMet
                        ? 'bg-sky-500'
                        : 'bg-sky-300'
                    }`}
                    title={`Carbs: ${totalCarbs}g / ${targetCarbs}g`}
                  ></span>
                )}

                {/* Fiber Goal Indicator */}
                {log && totalFiber > 0 && (
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isSelected
                        ? 'bg-emerald-200'
                        : fiberGoalMet
                        ? 'bg-emerald-500'
                        : 'bg-emerald-300'
                    }`}
                    title={`Fiber: ${totalFiber}g / ${targetFiber}g`}
                  ></span>
                )}

                {/* Calories Indicator */}
                {log && totalCalories > 0 && (
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isSelected
                        ? 'bg-amber-200'
                        : calorieGoalMet
                        ? 'bg-amber-500'
                        : 'bg-amber-300'
                    }`}
                    title={`Calories: ${totalCalories} / ${goals.dailyCalorieTarget} kcal`}
                  ></span>
                )}

                {/* Workout / Rest / Jog Indicator */}
                {workoutCompleted || (hasWorkout && !isRestDay) ? (
                  <Dumbbell
                    className={`w-3 h-3 ${
                      isSelected
                        ? 'text-white'
                        : workoutCompleted
                        ? 'text-violet-600'
                        : 'text-slate-400'
                    }`}
                    title="Hypertrophy Lifting Logged"
                  />
                ) : isRestDay ? (
                  <Coffee
                    className={`w-3 h-3 ${
                      isSelected ? 'text-white' : 'text-amber-600'
                    }`}
                    title="Rest & Recovery Day (Automatically Logged)"
                  />
                ) : null}

                {/* Jog / Cardio Indicator */}
                {hasJog && (
                  <Footprints
                    className={`w-3 h-3 ${
                      isSelected ? 'text-emerald-200' : 'text-emerald-600'
                    }`}
                    title="Jog / Cardio Session Logged"
                  />
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Calendar Legend */}
      <div className="mt-6 pt-5 border-t border-slate-150 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 text-[11px]" id="calendar-legend">
        <div className="flex items-center gap-1.5 text-slate-600 font-medium">
          <span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span>
          <span>Protein Met</span>
        </div>
        <div className="flex items-center gap-1.5 text-slate-600 font-medium">
          <span className="w-2.5 h-2.5 rounded-full bg-sky-500"></span>
          <span>Carbs Met</span>
        </div>
        <div className="flex items-center gap-1.5 text-slate-600 font-medium">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
          <span>Fiber Met</span>
        </div>
        <div className="flex items-center gap-1.5 text-slate-600 font-medium">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
          <span>Calorie Target</span>
        </div>
        <div className="flex items-center gap-1.5 text-slate-600 font-medium">
          <Dumbbell className="w-3.5 h-3.5 text-violet-600" />
          <span>Hypertrophy Lift</span>
        </div>
        <div className="flex items-center gap-1.5 text-slate-600 font-medium">
          <Footprints className="w-3.5 h-3.5 text-emerald-600" />
          <span>Jog / Run</span>
        </div>
        <div className="flex items-center gap-1.5 text-slate-600 font-medium">
          <Coffee className="w-3.5 h-3.5 text-amber-600" />
          <span>Rest & Recovery</span>
        </div>
      </div>
    </div>
  );
}
