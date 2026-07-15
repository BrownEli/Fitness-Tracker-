import { DailyLog, UserGoals } from '../types';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  ReferenceLine
} from 'recharts';
import { Dumbbell, Flame, Award, Scale } from 'lucide-react';

interface AnalyticsProps {
  logs: DailyLog[];
  goals: UserGoals;
}

export default function Analytics({ logs, goals }: AnalyticsProps) {
  // 1. Get trailing 7 days sorted by date
  const sortedLogs = [...logs]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-7);

  // 2. Format daily data for charts
  const dailyChartData = sortedLogs.map((log) => {
    const totalProtein = log.meals.reduce((sum, meal) => sum + meal.protein, 0);
    const totalCalories = log.meals.reduce((sum, meal) => sum + meal.calories, 0);
    
    // Get formatted short date (e.g. "Mon" or "07/12")
    const dateObj = new Date(log.date + 'T00:00:00');
    const label = dateObj.toLocaleDateString('en-US', { weekday: 'short' });

    return {
      date: log.date,
      label,
      Protein: totalProtein,
      ProteinGoal: goals.dailyProteinTarget,
      Calories: totalCalories,
      CalorieGoal: goals.dailyCalorieTarget,
      Weight: log.weight || null
    };
  });

  // 3. Muscle Volume Tracker (sets completed per category this week)
  const muscleGroups = ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core', 'Cardio'];
  const volumeData = muscleGroups.map((group) => {
    let setsCount = 0;
    // Iterate over all logs in the last week
    sortedLogs.forEach((log) => {
      log.workouts.forEach((workout) => {
        if (workout.category === group && (workout.completed || true)) {
          // Count completed sets, or all sets if they completed the workout
          setsCount += workout.sets.filter(s => s.completed).length;
        }
      });
    });

    return {
      name: group,
      value: setsCount
    };
  }).filter(item => item.value > 0); // Only show groups that have working sets

  // Colors for the muscle volume pie chart
  const COLORS = {
    Chest: '#3b82f6',      // blue-500
    Back: '#0ea5e9',       // sky-500
    Legs: '#6366f1',       // indigo-500
    Shoulders: '#f43f5e',  // rose-500
    Arms: '#f59e0b',       // amber-500
    Core: '#10b981',       // emerald-500
    Cardio: '#64748b'      // slate-500
  };

  const totalWeeklySets = sortedLogs.reduce((acc, log) => {
    return acc + log.workouts.reduce((wAcc, w) => wAcc + w.sets.filter(s => s.completed).length, 0);
  }, 0);

  // Custom Tooltip component for consistent light mode theme
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-md">
          <p className="text-slate-400 text-[11px] font-bold uppercase tracking-wider mb-1">{label}</p>
          {payload.map((p: any, index: number) => (
            <p key={index} className="text-xs font-bold" style={{ color: p.color }}>
              {p.name}: {p.value} {p.name.includes('Protein') ? 'g' : p.name.includes('Weight') ? goals.weightUnit : 'kcal'}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6" id="analytics-panel">
      {/* Overview Metric Badges */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4" id="analytics-badges-grid">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <span className="text-slate-400 text-[11px] uppercase tracking-wider font-extrabold">Protein Success</span>
            <h3 className="text-xl font-black text-slate-900 mt-0.5">
              {dailyChartData.filter(d => d.Protein >= d.ProteinGoal).length}/7 <span className="text-slate-400 text-xs font-medium">Days</span>
            </h3>
            <p className="text-[10px] text-slate-500 mt-0.5">Achieved protein hypertrophy target</p>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm">
            <Dumbbell className="w-5 h-5" />
          </div>
          <div>
            <span className="text-slate-400 text-[11px] uppercase tracking-wider font-extrabold">Hypertrophy Sets</span>
            <h3 className="text-xl font-black text-slate-900 mt-0.5">
              {totalWeeklySets} <span className="text-slate-400 text-xs font-medium">Working Sets</span>
            </h3>
            <p className="text-[10px] text-slate-500 mt-0.5">Completed sets across muscle groups</p>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm">
            <Flame className="w-5 h-5" />
          </div>
          <div>
            <span className="text-slate-400 text-[11px] uppercase tracking-wider font-extrabold">Caloric Surplus</span>
            <h3 className="text-xl font-black text-slate-900 mt-0.5">
              {dailyChartData.filter(d => d.Calories >= d.CalorieGoal).length}/7 <span className="text-slate-400 text-xs font-medium">Days</span>
            </h3>
            <p className="text-[10px] text-slate-500 mt-0.5">Fueled bulking caloric target</p>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm">
            <Scale className="w-5 h-5" />
          </div>
          <div>
            <span className="text-slate-400 text-[11px] uppercase tracking-wider font-extrabold">Scale Weight</span>
            <h3 className="text-xl font-black text-slate-900 mt-0.5">
              {dailyChartData[dailyChartData.length - 1]?.Weight ? (
                `${dailyChartData[dailyChartData.length - 1].Weight} ${goals.weightUnit}`
              ) : 'No log'}
            </h3>
            <p className="text-[10px] text-indigo-600 font-bold mt-0.5">
              Target: {goals.targetWeight} {goals.weightUnit} for hypertrophy
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly Protein Balance */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="mb-4">
            <h4 className="text-sm font-bold text-slate-900">Anabolic Protein Balance</h4>
            <p className="text-slate-500 text-xs mt-0.5">Tracks daily protein (g) against hypertrophy goals</p>
          </div>
          <div className="h-72" id="protein-progress-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                <ReferenceLine y={goals.dailyProteinTarget} stroke="#ef4444" strokeDasharray="5 5" label={{ value: 'Protein Goal', position: 'top', fill: '#ef4444', fontSize: 9 }} />
                <Bar dataKey="Protein" name="Actual Protein (g)" fill="#4f46e5" radius={[6, 6, 0, 0]} maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Caloric Intake Analytics */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="mb-4">
            <h4 className="text-sm font-bold text-slate-900">Anabolic Calorie Tracker</h4>
            <p className="text-slate-500 text-xs mt-0.5">Ensures calorie surplus to optimize lean mass</p>
          </div>
          <div className="h-72" id="calories-progress-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyChartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                <ReferenceLine y={goals.dailyCalorieTarget} stroke="#f59e0b" strokeDasharray="5 5" label={{ value: 'Surplus Target', position: 'top', fill: '#f59e0b', fontSize: 9 }} />
                <Bar dataKey="Calories" name="Intake (kcal)" fill="#0ea5e9" radius={[6, 6, 0, 0]} maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Hypertrophic Volume split - Pie Chart */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="mb-4">
            <h4 className="text-sm font-bold text-slate-900">Muscle Group Volume Distribution</h4>
            <p className="text-slate-500 text-xs mt-0.5">Completed working sets this week (Goal: 10-20/muscle group)</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
            <div className="col-span-1 md:col-span-6 h-60" id="muscle-volume-pie-chart">
              {volumeData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={volumeData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={75}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {volumeData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[entry.name as keyof typeof COLORS] || '#10b981'}
                        />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="w-full h-full flex flex-col justify-center items-center text-center p-4">
                  <Dumbbell className="w-8 h-8 text-slate-300 mb-2" />
                  <span className="text-xs text-slate-400 font-semibold">No Working Sets Recorded Yet</span>
                </div>
              )}
            </div>

            <div className="col-span-1 md:col-span-6 space-y-2 max-h-[220px] overflow-y-auto pr-2" id="muscle-volume-legend">
              {volumeData.length > 0 ? (
                volumeData.map((data, index) => {
                  const targetMin = 10;
                  const pct = Math.min(100, Math.round((data.value / targetMin) * 100));
                  const muscleColor = COLORS[data.name as keyof typeof COLORS] || '#10b981';

                  return (
                    <div key={index} className="flex flex-col text-xs">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-bold text-slate-700 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: muscleColor }}></span>
                          {data.name}
                        </span>
                        <span className="font-mono text-slate-500 font-extrabold">
                          {data.value} sets <span className="text-slate-400 font-medium">/ 10+</span>
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: muscleColor
                          }}
                        ></div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-slate-400 text-xs text-center py-6">Add exercise sets in the workout logger to see your muscle group volume distribution.</p>
              )}
            </div>
          </div>
        </div>

        {/* Body Weight Shifts */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="mb-4">
            <h4 className="text-sm font-bold text-slate-900">Bodyweight Scale Progression</h4>
            <p className="text-slate-500 text-xs mt-0.5">Monitors progressive weight gain for muscle-building surplus</p>
          </div>
          <div className="h-72" id="weight-progress-chart">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailyChartData.filter(d => d.Weight !== null)} margin={{ top: 15, right: 15, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} domain={['auto', 'auto']} />
                <Tooltip content={<CustomTooltip />} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                <Line
                  type="monotone"
                  dataKey="Weight"
                  name={`Weight (${goals.weightUnit})`}
                  stroke="#8b5cf6"
                  strokeWidth={2.5}
                  dot={{ r: 4, strokeWidth: 1.5, fill: '#ffffff' }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
