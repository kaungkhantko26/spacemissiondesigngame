/* Generated astronaut portrait, seeded from a character id. Placeholder until real art lands. */
const SKIN = ["#f1c9a5", "#e0ac84", "#c68863", "#a8683f", "#8a4f2e", "#6b3a22"];
const HAIR = ["#1b1b1f", "#3a2a1c", "#6b4423", "#b8863b", "#8f8f95", "#a33a2a"];
const SUIT = { lead: "#e8693a", engineer: "#3aa0e8", science: "#6dd38a", comms: "#b58af0" } as const;

function hash(s: string) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

export function Portrait({ id, role, size = 96 }: { id: string; role: keyof typeof SUIT; size?: number }) {
  const h = hash(id); const pick = <T,>(a: T[], shift: number) => a[(h >>> shift) % a.length];
  const skin = pick(SKIN, 0), hair = pick(HAIR, 3), style = (h >>> 6) % 5, eyes = (h >>> 9) % 3, brow = (h >>> 11) % 2, mouth = (h >>> 13) % 3;
  const suit = SUIT[role] ?? "#888", glasses = (h >>> 15) % 4 === 0, beard = (h >>> 17) % 5 === 0, patch = (h >>> 19) % 3;
  return (
    <svg viewBox="0 0 100 110" width={size} height={size * 1.1} role="img" aria-label="Crew portrait" className="shrink-0 rounded-lg bg-[#0c1626]">
      <defs><radialGradient id={`g${h}`} cx="50%" cy="40%" r="70%"><stop offset="0" stopColor="#1d3556" /><stop offset="1" stopColor="#09111e" /></radialGradient></defs>
      <rect width="100" height="110" fill={`url(#g${h})`} />
      {/* suit + collar ring */}
      <path d="M8 110c2-22 18-30 42-30s40 8 42 30z" fill={suit} />
      <path d="M30 84c6 6 34 6 40 0l2 6c-8 8-36 8-44 0z" fill="#d9dee6" />
      {patch === 0 && <circle cx="24" cy="98" r="5" fill="#fff" opacity=".85" />}
      {patch === 1 && <rect x="70" y="94" width="12" height="6" rx="1" fill="#fff" opacity=".85" />}
      {/* neck + head */}
      <rect x="43" y="68" width="14" height="16" rx="5" fill={skin} />
      <ellipse cx="50" cy="48" rx="21" ry="24" fill={skin} />
      {/* hair */}
      {style === 0 && <path d="M28 44c0-20 14-26 22-26s22 6 22 26c-6-10-14-12-22-12s-16 2-22 12z" fill={hair} />}
      {style === 1 && <path d="M29 46c-2-24 12-30 21-30s23 6 21 30c-2-8-6-14-21-14s-19 6-21 14z" fill={hair} />}
      {style === 2 && <g fill={hair}><circle cx="50" cy="20" r="9" /><path d="M29 44c0-16 10-22 21-22s21 6 21 22c-6-8-12-10-21-10s-15 2-21 10z" /></g>}
      {style === 3 && <path d="M28 50c-4-30 14-34 22-34s26 4 22 34c-2-12-8-18-22-18s-20 6-22 18z M28 50l-3 26 8-8z M72 50l3 26-8-8z" fill={hair} />}
      {style === 4 && <path d="M30 40c4-10 12-12 20-12s16 2 20 12c-6-4-12-5-20-5s-14 1-20 5z" fill={hair} />}
      {/* face */}
      <g fill="#14161c">
        {eyes === 0 && <><circle cx="42" cy="50" r="2.4" /><circle cx="58" cy="50" r="2.4" /></>}
        {eyes === 1 && <><ellipse cx="42" cy="50" rx="3" ry="1.8" /><ellipse cx="58" cy="50" rx="3" ry="1.8" /></>}
        {eyes === 2 && <><circle cx="42" cy="50" r="2" /><circle cx="58" cy="50" r="2" /><path d="M38 46q4-3 8 0M54 46q4-3 8 0" stroke="#14161c" strokeWidth="1.2" fill="none" /></>}
      </g>
      <path d={brow ? "M37 44l9-2M63 44l-9-2" : "M37 43h9M54 43h9"} stroke={hair} strokeWidth="2" strokeLinecap="round" />
      <path d={mouth === 0 ? "M43 62q7 5 14 0" : mouth === 1 ? "M44 63h12" : "M43 61q7 8 14 0"} stroke="#5a2a2a" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      {beard && <path d="M33 56c2 14 10 20 17 20s15-6 17-20c-4 8-10 10-17 10s-13-2-17-10z" fill={hair} opacity=".9" />}
      {glasses && <g stroke="#cfd6e4" strokeWidth="1.6" fill="rgba(160,200,255,.15)"><rect x="35" y="45" width="12" height="9" rx="3" /><rect x="53" y="45" width="12" height="9" rx="3" /><path d="M47 49h6" /></g>}
    </svg>
  );
}
