import React from 'react';
import { Play, Info, Award, Dumbbell } from 'lucide-react';

interface FormVisualizerProps {
  exerciseName: string;
}

export interface ExerciseDetails {
  name: string;
  target: string;
  volume: string;
  intensity: string;
  description: string;
  youtubeVideoId?: string;
}

export const EXERCISES_DATABASE: Record<string, ExerciseDetails> = {
  'Bench Crunches': {
    name: 'Bench Crunches',
    target: 'Core / Stomach',
    volume: '3 sets of 20 repetitions',
    intensity: 'Moderate, controlled pace',
    description: 'Lie flat on your back on the workout bench with your feet planted firmly on the ground or hooked into the foot pads. Place your hands gently behind your head or crossed over your chest. Contract your abdominal muscles to lift your shoulders and upper torso off the bench. Focus on squeezing your stomach at the top, then slowly lower yourself back down. Do not pull on your neck.',
    youtubeVideoId: 'MKs7Gv_9Ghc'
  },
  'Dumbbell Flat Bench Press': {
    name: 'Dumbbell Flat Bench Press',
    target: 'Chest & Arms',
    volume: '3 sets of 20 repetitions',
    intensity: 'Comfortable weight',
    description: 'Lie flat on the bench holding a dumbbell in each hand at chest level, palms facing forward. Press the weights straight up toward the ceiling until your arms are fully extended but not locked. Slowly lower the weights back down to chest level, keeping your elbows at a 45-degree angle to your body.',
    youtubeVideoId: 'VmB1G1K7v94'
  },
  'Flat Bench Leg Raises': {
    name: 'Flat Bench Leg Raises',
    target: 'Lower Abs',
    volume: '3 sets of 8-10 repetitions',
    intensity: 'Slow, steady speed',
    description: 'Lie flat on your back on the bench, gripping the top of the bench behind your head for stability. Keeping your legs straight (or slightly bent if it strains your back), slowly lift them up until they are perpendicular to the floor. Lower them back down slowly until they are just above the bench level.',
    youtubeVideoId: '2o1bwZT5nE0'
  },
  'Seated Dumbbell Shoulder Press': {
    name: 'Seated Dumbbell Shoulder Press',
    target: 'Shoulders',
    volume: '3 sets of 10 repetitions',
    intensity: 'Controlled overhead press',
    description: 'Adjust your bench to an upright seated position. Sit with your back firmly against the pad. Bring the dumbbells up to shoulder height, palms facing away from you. Press the weights straight up overhead until your arms are extended, then slowly lower them back to your shoulders.',
    youtubeVideoId: 'qEwKCR5JCog'
  },
  'Bicep Curls': {
    name: 'Bicep Curls',
    target: 'Arms (Biceps)',
    volume: '3 sets of 12 repetitions',
    intensity: 'Controlled, strict form',
    description: 'Stand with dumbbells in hands, elbows pinned to your sides. Squeeze biceps to curl dumbbells to shoulder height. Slow, 2-second eccentric lower. No body swinging.',
    youtubeVideoId: 'ykJgrb560_Y'
  },
  'Dumbbell Rows': {
    name: 'Dumbbell Rows',
    target: 'Core & Back (Lats)',
    volume: '3 sets of 12 repetitions',
    intensity: 'Moderate weight with hold',
    description: 'Place one knee and one hand on your workout bench for stability. With other hand, pull the dumbbell up to your hip pocket. Squeeze your mid-back at the top, then extend arm fully down.',
    youtubeVideoId: 'dFzUjzfih7k'
  },
  'Bodyweight Bench Squats': {
    name: 'Bodyweight Bench Squats',
    target: 'Legs (Quads & Glutes)',
    volume: '3 sets of 15 repetitions',
    intensity: 'Fluid, explosive stand',
    description: 'Stand with feet shoulder-width apart in front of the bench. Lower your hips back and down until your glutes lightly tap the bench pad. Instantly drive through your heels to return to standing.',
    youtubeVideoId: 'aclHkVaku9U'
  },
  'Light Stretching': {
    name: 'Light Stretching',
    target: 'Active Recovery',
    volume: '10-15 minutes total',
    intensity: 'Relaxed, deep breathing',
    description: 'Perform light dynamic and static stretches. Reach for your toes, stretch your shoulders, chest, and hip flexors. Hold stretch positions without pain, breathing deeply.',
    youtubeVideoId: 'g_tea8ZNk5A'
  }
};

export default function FormVisualizer({ exerciseName }: FormVisualizerProps) {
  // Safe lookup with fallback
  const normalizedKey = Object.keys(EXERCISES_DATABASE).find(
    k => k.toLowerCase().includes(exerciseName.toLowerCase()) || exerciseName.toLowerCase().includes(k.toLowerCase())
  ) || 'Bench Crunches';

  const details = EXERCISES_DATABASE[normalizedKey];

  // Render self-contained animated SVGs demonstrating proper form
  const renderVisual = () => {
    switch (normalizedKey) {
      case 'Bench Crunches':
        return (
          <svg viewBox="0 0 240 160" className="w-full h-full text-indigo-600" fill="none" xmlns="http://www.w3.org/2000/svg">
            <style>{`
              @keyframes crunchAnim {
                0%, 100% { transform: rotate(0deg); }
                50% { transform: rotate(22deg); }
              }
              .torso {
                animation: crunchAnim 2.8s ease-in-out infinite;
                transform-origin: 120px 90px;
              }
            `}</style>
            {/* Gym Floor and Bench */}
            <line x1="20" y1="130" x2="220" y2="130" stroke="#cbd5e1" strokeWidth="4" strokeLinecap="round" />
            {/* Bench legs */}
            <line x1="70" y1="95" x2="70" y2="130" stroke="#64748b" strokeWidth="6" strokeLinecap="round" />
            <line x1="170" y1="95" x2="170" y2="130" stroke="#64748b" strokeWidth="6" strokeLinecap="round" />
            {/* Bench cushion */}
            <rect x="50" y="85" width="140" height="10" rx="3" fill="#334155" />
            
            {/* Legs bent on bench/feet down */}
            <path d="M 170 90 L 195 90 L 205 130" stroke="#94a3b8" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
            
            {/* Torso & Head that moves */}
            <g className="torso">
              {/* Back / Upper body */}
              <line x1="120" y1="90" x2="70" y2="90" stroke="#4f46e5" strokeWidth="8" strokeLinecap="round" />
              {/* Head */}
              <circle cx="55" cy="88" r="8" fill="#4f46e5" />
              {/* Arms crossed on chest */}
              <path d="M 90 90 C 85 75, 75 75, 70 85" stroke="#818cf8" strokeWidth="4" strokeLinecap="round" fill="none" />
            </g>
            {/* Target indicator */}
            <circle cx="110" cy="80" r="14" fill="#ef4444" fillOpacity="0.1" stroke="#ef4444" strokeWidth="1" strokeDasharray="2 2" />
            <text x="110" y="83" fill="#ef4444" fontSize="8" fontWeight="bold" textAnchor="middle">ABS</text>
          </svg>
        );

      case 'Dumbbell Flat Bench Press':
        return (
          <svg viewBox="0 0 240 160" className="w-full h-full text-indigo-600" fill="none" xmlns="http://www.w3.org/2000/svg">
            <style>{`
              @keyframes pressAnim {
                0%, 100% { transform: translateY(0); }
                50% { transform: translateY(-35px); }
              }
              .weights {
                animation: pressAnim 2.5s ease-in-out infinite;
              }
            `}</style>
            {/* Floor and Bench */}
            <line x1="20" y1="130" x2="220" y2="130" stroke="#cbd5e1" strokeWidth="4" strokeLinecap="round" />
            <line x1="70" y1="95" x2="70" y2="130" stroke="#64748b" strokeWidth="6" strokeLinecap="round" />
            <line x1="170" y1="95" x2="170" y2="130" stroke="#64748b" strokeWidth="6" strokeLinecap="round" />
            <rect x="50" y="85" width="140" height="10" rx="3" fill="#334155" />

            {/* Flat Torso and Head */}
            <line x1="70" y1="90" x2="160" y2="90" stroke="#4f46e5" strokeWidth="8" strokeLinecap="round" />
            <circle cx="60" cy="90" r="8" fill="#4f46e5" />
            <path d="M 150 90 L 165 110 L 175 130" stroke="#94a3b8" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />

            {/* Arms and weights */}
            <g className="weights">
              {/* Forearms extending up */}
              <line x1="110" y1="85" x2="110" y2="60" stroke="#818cf8" strokeWidth="5" strokeLinecap="round" />
              {/* Dumbbell bar */}
              <line x1="95" y1="60" x2="125" y2="60" stroke="#334155" strokeWidth="4" />
              {/* Plates */}
              <rect x="91" y="50" width="8" height="20" rx="2" fill="#1e293b" />
              <rect x="121" y="50" width="8" height="20" rx="2" fill="#1e293b" />
            </g>
            {/* Target indicator */}
            <circle cx="110" cy="96" r="14" fill="#3b82f6" fillOpacity="0.1" stroke="#3b82f6" strokeWidth="1" strokeDasharray="2 2" />
            <text x="110" y="99" fill="#3b82f6" fontSize="7" fontWeight="bold" textAnchor="middle">CHEST</text>
          </svg>
        );

      case 'Flat Bench Leg Raises':
        return (
          <svg viewBox="0 0 240 160" className="w-full h-full text-indigo-600" fill="none" xmlns="http://www.w3.org/2000/svg">
            <style>{`
              @keyframes legRaiseAnim {
                0%, 100% { transform: rotate(0deg); }
                50% { transform: rotate(-75deg); }
              }
              .legs {
                animation: legRaiseAnim 3s ease-in-out infinite;
                transform-origin: 135px 90px;
              }
            `}</style>
            {/* Floor and Bench */}
            <line x1="20" y1="130" x2="220" y2="130" stroke="#cbd5e1" strokeWidth="4" strokeLinecap="round" />
            <line x1="70" y1="95" x2="70" y2="130" stroke="#64748b" strokeWidth="6" strokeLinecap="round" />
            <line x1="170" y1="95" x2="170" y2="130" stroke="#64748b" strokeWidth="6" strokeLinecap="round" />
            <rect x="50" y="85" width="140" height="10" rx="3" fill="#334155" />

            {/* Head and back flat on bench */}
            <circle cx="65" cy="90" r="8" fill="#4f46e5" />
            {/* Hands holding bench */}
            <path d="M 65 90 L 53 85" stroke="#818cf8" strokeWidth="4" strokeLinecap="round" />
            <line x1="70" y1="90" x2="135" y2="90" stroke="#4f46e5" strokeWidth="8" strokeLinecap="round" />

            {/* Legs raising up */}
            <g className="legs">
              <line x1="135" y1="90" x2="200" y2="90" stroke="#818cf8" strokeWidth="7" strokeLinecap="round" />
            </g>
            {/* Target indicator */}
            <circle cx="115" cy="85" r="14" fill="#ef4444" fillOpacity="0.1" stroke="#ef4444" strokeWidth="1" strokeDasharray="2 2" />
            <text x="115" y="88" fill="#ef4444" fontSize="7" fontWeight="bold" textAnchor="middle">LOW ABS</text>
          </svg>
        );

      case 'Seated Dumbbell Shoulder Press':
        return (
          <svg viewBox="0 0 240 160" className="w-full h-full text-indigo-600" fill="none" xmlns="http://www.w3.org/2000/svg">
            <style>{`
              @keyframes shoulderPressAnim {
                0%, 100% { transform: scaleY(0.7) translateY(12px); }
                50% { transform: scaleY(1.3) translateY(-10px); }
              }
              .dumbbells {
                animation: shoulderPressAnim 2.4s ease-in-out infinite;
                transform-origin: 128px 52px;
              }
            `}</style>
            {/* Floor and Bench */}
            <line x1="40" y1="140" x2="200" y2="140" stroke="#cbd5e1" strokeWidth="4" strokeLinecap="round" />
            {/* Seated Bench */}
            <rect x="115" y="105" width="40" height="35" fill="#64748b" />
            <rect x="110" y="100" width="40" height="6" rx="2" fill="#334155" />
            <rect x="110" y="55" width="6" height="50" rx="2" fill="#334155" />

            {/* Seated Figure */}
            <circle cx="128" cy="42" r="8" fill="#4f46e5" />
            <line x1="128" y1="50" x2="128" y2="100" stroke="#4f46e5" strokeWidth="8" strokeLinecap="round" />
            {/* Shoulders */}
            <line x1="110" y1="52" x2="146" y2="52" stroke="#4f46e5" strokeWidth="6" strokeLinecap="round" />
            {/* Thighs */}
            <line x1="128" y1="100" x2="160" y2="100" stroke="#94a3b8" strokeWidth="6" strokeLinecap="round" />
            {/* Shins */}
            <line x1="160" y1="100" x2="160" y2="140" stroke="#94a3b8" strokeWidth="5" strokeLinecap="round" />

            {/* Dumbbells pressing up */}
            <g className="dumbbells">
              {/* Left arm: shoulder to elbow to hand */}
              <path d="M 110 52 L 100 70 L 100 35" stroke="#818cf8" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              <line x1="90" y1="35" x2="110" y2="35" stroke="#1e293b" strokeWidth="3" />
              <circle cx="90" cy="35" r="5" fill="#1e293b" />
              <circle cx="110" cy="35" r="5" fill="#1e293b" />

              {/* Right arm: shoulder to elbow to hand */}
              <path d="M 146 52 L 156 70 L 156 35" stroke="#818cf8" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              <line x1="146" y1="35" x2="166" y2="35" stroke="#1e293b" strokeWidth="3" />
              <circle cx="146" cy="35" r="5" fill="#1e293b" />
              <circle cx="166" cy="35" r="5" fill="#1e293b" />
            </g>
            {/* Target indicator */}
            <circle cx="128" cy="62" r="14" fill="#f43f5e" fillOpacity="0.1" stroke="#f43f5e" strokeWidth="1" strokeDasharray="2 2" />
            <text x="128" y="65" fill="#f43f5e" fontSize="7" fontWeight="bold" textAnchor="middle">DELTS</text>
          </svg>
        );

      case 'Bicep Curls':
        return (
          <svg viewBox="0 0 240 160" className="w-full h-full text-indigo-600" fill="none" xmlns="http://www.w3.org/2000/svg">
            <style>{`
              @keyframes curlAnim {
                0%, 100% { transform: rotate(10deg); }
                50% { transform: rotate(-100deg); }
              }
              .forearm {
                animation: curlAnim 2.2s ease-in-out infinite;
                transform-origin: 124px 75px;
              }
            `}</style>
            {/* Floor */}
            <line x1="40" y1="140" x2="200" y2="140" stroke="#cbd5e1" strokeWidth="4" strokeLinecap="round" />

            {/* Standing Figure torso & head */}
            <circle cx="120" cy="40" r="8" fill="#4f46e5" />
            <line x1="120" y1="48" x2="120" y2="100" stroke="#4f46e5" strokeWidth="8" strokeLinecap="round" />
            {/* Upper arm (steady) */}
            <line x1="120" y1="52" x2="124" y2="75" stroke="#4f46e5" strokeWidth="5" strokeLinecap="round" />
            {/* Legs */}
            <line x1="115" y1="100" x2="115" y2="140" stroke="#94a3b8" strokeWidth="6" strokeLinecap="round" />
            <line x1="125" y1="100" x2="125" y2="140" stroke="#94a3b8" strokeWidth="6" strokeLinecap="round" />

            {/* Forearm and dumbbell curling */}
            <g className="forearm">
              <line x1="124" y1="75" x2="144" y2="90" stroke="#818cf8" strokeWidth="4" strokeLinecap="round" />
              {/* Dumbbell */}
              <line x1="138" y1="95" x2="150" y2="85" stroke="#1e293b" strokeWidth="3" />
              <circle cx="138" cy="95" r="5" fill="#1e293b" />
              <circle cx="150" cy="85" r="5" fill="#1e293b" />
            </g>
            {/* Target indicator */}
            <circle cx="134" cy="72" r="14" fill="#f59e0b" fillOpacity="0.1" stroke="#f59e0b" strokeWidth="1" strokeDasharray="2 2" />
            <text x="134" y="75" fill="#f59e0b" fontSize="7" fontWeight="bold" textAnchor="middle">BICEPS</text>
          </svg>
        );

      case 'Dumbbell Rows':
        return (
          <svg viewBox="0 0 240 160" className="w-full h-full text-indigo-600" fill="none" xmlns="http://www.w3.org/2000/svg">
            <style>{`
              @keyframes rowAnim {
                0%, 100% { transform: rotate(0deg); }
                50% { transform: rotate(-40deg); }
              }
              .rowWeight {
                animation: rowAnim 2.3s ease-in-out infinite;
                transform-origin: 110px 65px;
              }
            `}</style>
            {/* Floor and Bench */}
            <line x1="20" y1="130" x2="220" y2="130" stroke="#cbd5e1" strokeWidth="4" strokeLinecap="round" />
            <rect x="60" y="90" width="100" height="8" fill="#334155" />
            <line x1="80" y1="98" x2="80" y2="130" stroke="#64748b" strokeWidth="5" />
            <line x1="140" y1="98" x2="140" y2="130" stroke="#64748b" strokeWidth="5" />

            {/* Flat back supported torso */}
            {/* Knee on bench */}
            <path d="M 130 90 L 150 90 L 150 130" stroke="#94a3b8" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
            {/* Supporting hand */}
            <line x1="80" y1="90" x2="80" y2="65" stroke="#94a3b8" strokeWidth="5" strokeLinecap="round" />
            {/* Torso */}
            <line x1="80" y1="65" x2="150" y2="65" stroke="#4f46e5" strokeWidth="8" strokeLinecap="round" />
            <circle cx="158" cy="63" r="8" fill="#4f46e5" />
            {/* Stand leg */}
            <line x1="110" y1="65" x2="105" y2="130" stroke="#4f46e5" strokeWidth="5" strokeLinecap="round" />

            {/* Arm rowing dumbbell up */}
            <g className="rowWeight">
              <line x1="110" y1="65" x2="110" y2="90" stroke="#818cf8" strokeWidth="4" strokeLinecap="round" />
              {/* Dumbbell */}
              <line x1="100" y1="90" x2="120" y2="90" stroke="#1e293b" strokeWidth="3" />
              <circle cx="100" cy="90" r="5" fill="#1e293b" />
              <circle cx="120" cy="90" r="5" fill="#1e293b" />
            </g>
            {/* Target indicator */}
            <circle cx="115" cy="55" r="14" fill="#0ea5e9" fillOpacity="0.1" stroke="#0ea5e9" strokeWidth="1" strokeDasharray="2 2" />
            <text x="115" y="58" fill="#0ea5e9" fontSize="7" fontWeight="bold" textAnchor="middle">LATS</text>
          </svg>
        );

      case 'Bodyweight Bench Squats':
        return (
          <svg viewBox="0 0 240 160" className="w-full h-full text-indigo-600" fill="none" xmlns="http://www.w3.org/2000/svg">
            <style>{`
              @keyframes squatAnim {
                0%, 100% { transform: scaleY(1); }
                50% { transform: scaleY(0.72); }
              }
              .squattingFigure {
                animation: squatAnim 2.6s ease-in-out infinite;
                transform-origin: 125px 130px;
              }
            `}</style>
            {/* Floor and Bench */}
            <line x1="20" y1="130" x2="220" y2="130" stroke="#cbd5e1" strokeWidth="4" strokeLinecap="round" />
            {/* Bench */}
            <rect x="60" y="95" width="40" height="35" rx="2" fill="#64748b" />
            <rect x="55" y="90" width="50" height="6" rx="2" fill="#334155" />

            {/* Squatting Figure */}
            <g className="squattingFigure">
              {/* Head */}
              <circle cx="125" cy="50" r="8" fill="#4f46e5" />
              {/* Torso */}
              <line x1="125" y1="58" x2="125" y2="95" stroke="#4f46e5" strokeWidth="8" strokeLinecap="round" />
              {/* Thighs */}
              <line x1="125" y1="95" x2="145" y2="105" stroke="#818cf8" strokeWidth="6" strokeLinecap="round" />
              {/* Shins / Calf to floor */}
              <line x1="145" y1="105" x2="125" y2="130" stroke="#94a3b8" strokeWidth="6" strokeLinecap="round" />
              {/* Hands extended for balance */}
              <line x1="125" y1="70" x2="150" y2="70" stroke="#818cf8" strokeWidth="4" strokeLinecap="round" />
            </g>
            {/* Target indicator */}
            <circle cx="125" cy="110" r="14" fill="#6366f1" fillOpacity="0.1" stroke="#6366f1" strokeWidth="1" strokeDasharray="2 2" />
            <text x="125" y="113" fill="#6366f1" fontSize="7" fontWeight="bold" textAnchor="middle">LEGS</text>
          </svg>
        );

      case 'Light Stretching':
      default:
        return (
          <svg viewBox="0 0 240 160" className="w-full h-full text-indigo-600" fill="none" xmlns="http://www.w3.org/2000/svg">
            <style>{`
              @keyframes stretchAnim {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.04); }
              }
              .stretchBody {
                animation: stretchAnim 3s ease-in-out infinite;
                transform-origin: 120px 100px;
              }
            `}</style>
            {/* Floor */}
            <line x1="20" y1="130" x2="220" y2="130" stroke="#cbd5e1" strokeWidth="4" strokeLinecap="round" />
            {/* Yoga mat */}
            <line x1="40" y1="128" x2="200" y2="128" stroke="#10b981" strokeWidth="3" strokeLinecap="round" opacity="0.4" />

            {/* Stretching figure */}
            <g className="stretchBody">
              <circle cx="100" cy="55" r="8" fill="#10b981" />
              {/* Torso bending forward */}
              <path d="M 120 125 L 120 95 C 120 80, 110 70, 100 65" stroke="#10b981" strokeWidth="7" strokeLinecap="round" fill="none" />
              {/* Arm reaching for toes */}
              <path d="M 112 75 L 85 95 L 75 125" stroke="#6ee7b7" strokeWidth="4" strokeLinecap="round" fill="none" />
              {/* Leg flat */}
              <line x1="120" y1="125" x2="60" y2="125" stroke="#0ea5e9" strokeWidth="6" strokeLinecap="round" />
            </g>
            {/* Target indicator */}
            <circle cx="100" cy="100" r="14" fill="#10b981" fillOpacity="0.1" stroke="#10b981" strokeWidth="1" strokeDasharray="2 2" />
            <text x="100" y="103" fill="#10b981" fontSize="7" fontWeight="bold" textAnchor="middle">RECOVER</text>
          </svg>
        );
    }
  };

  return (
    <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 sm:p-6 shadow-xs flex flex-col md:flex-row gap-6 items-center" id="form-visualizer-widget">
      {/* Visual Animation Player Frame */}
      <div className="w-full md:w-1/2 aspect-video bg-white rounded-xl border border-slate-150 shadow-inner flex items-center justify-center p-3 relative overflow-hidden group">
        <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-lg text-[10px] font-bold border border-indigo-100">
          <Play className="w-3 h-3 text-indigo-600 animate-pulse fill-indigo-600" />
          <span>LIVE FORM PREVIEW</span>
        </div>
        <div className="w-full h-full max-w-[200px] flex items-center justify-center">
          {renderVisual()}
        </div>
      </div>

      {/* Guide details panel */}
      <div className="flex-1 space-y-3.5">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100">
            {details.target}
          </span>
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Target</span>
        </div>

        <h3 className="text-base font-extrabold text-slate-900 tracking-tight leading-snug">
          {details.name} Form Guide
        </h3>

        <p className="text-xs text-slate-600 leading-relaxed font-medium">
          {details.description}
        </p>

        {/* Volume badge summary */}
        <div className="grid grid-cols-2 gap-3.5 pt-1.5 border-t border-slate-200/80">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
              <Dumbbell className="w-3.5 h-3.5" />
            </div>
            <div>
              <span className="text-[9px] text-slate-400 block font-bold uppercase">Anabolic Vol</span>
              <span className="text-xs font-bold text-slate-800 block">{details.volume}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-amber-50 text-amber-600 rounded-lg">
              <Award className="w-3.5 h-3.5" />
            </div>
            <div>
              <span className="text-[9px] text-slate-400 block font-bold uppercase">Intensity Target</span>
              <span className="text-xs font-bold text-slate-800 block">{details.intensity}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
