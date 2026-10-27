export const avatarColors = [
  "from-emerald-400 to-emerald-700",
  "from-sky-400 to-blue-700",
  "from-amber-300 to-orange-600",
  "from-rose-400 to-red-700",
  "from-violet-400 to-purple-700",
  "from-lime-300 to-green-700",
  "from-pink-400 to-fuchsia-700",
  "from-cyan-300 to-teal-700",
];

const faces = [
  <g key="0"><circle cx="35" cy="42" r="5" /><circle cx="65" cy="42" r="5" /><path d="M30 62c10 12 30 12 40 0" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" /></g>,
  <g key="1"><rect x="28" y="38" width="12" height="8" rx="3" /><rect x="60" y="38" width="12" height="8" rx="3" /><path d="M36 66h28" stroke="currentColor" strokeWidth="6" strokeLinecap="round" /></g>,
  <g key="2"><circle cx="35" cy="42" r="6" /><circle cx="65" cy="42" r="6" /><ellipse cx="50" cy="66" rx="9" ry="7" /></g>,
  <g key="3"><path d="M28 44c4-6 10-6 14 0M58 44c4-6 10-6 14 0" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" /><path d="M32 60c10 14 26 14 36 0z" /></g>,
];

export default function Avatar({ index, className = "h-24 w-24", kids = false }: { index: number; className?: string; kids?: boolean }) {
  const color = avatarColors[index % avatarColors.length];
  const face = faces[index % faces.length];
  return (
    <div className={`relative overflow-hidden rounded-md bg-gradient-to-br ${color} ${className}`}>
      <svg viewBox="0 0 100 100" className="h-full w-full text-white/95" fill="currentColor" aria-hidden>
        {face}
      </svg>
      {kids && (
        <span className="absolute inset-x-0 bottom-0 bg-black/40 py-0.5 text-center text-[10px] font-bold uppercase tracking-wider text-white">
          Kids
        </span>
      )}
    </div>
  );
}
