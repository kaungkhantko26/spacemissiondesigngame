"use client";
import type { OpsView } from "@/live/types";

/** Animated mission view: planet, orbiting spacecraft, downlink beam, storms and alerts driven by live ops state. */
export function OpsScene({ op, inc }: { op: OpsView; inc: OpsView["incident"] }) {
  const storm = inc?.id === "solar_storm"; const alert = !!inc && !inc.positive; const good = !!inc?.positive;
  const lowPower = op.res.power < 25; const full = op.res.storage > 85; const safe = op.safeNow;
  const beam = op.ctl.downlink === "boost" && !safe;
  const hue = alert ? "#ff5c5c" : good ? "#5ee6a0" : "#4fc3f7";
  return (
    <div className="relative overflow-hidden rounded-xl border border-white/10 bg-[#05080f]" style={{ height: 260 }} aria-label="Mission view">
      <style>{`
        @keyframes orbit{from{transform:rotate(0)}to{transform:rotate(360deg)}}
        @keyframes pulse{0%,100%{opacity:.25}50%{opacity:.9}}
        @keyframes rays{from{transform:translateX(-30px)}to{transform:translateX(420px)}}
        @keyframes twinkle{0%,100%{opacity:.2}50%{opacity:1}}
        @keyframes beam{from{stroke-dashoffset:0}to{stroke-dashoffset:-24}}
        .orb{transform-origin:200px 170px;animation:orbit ${safe ? 40 : 18}s linear infinite}
        .tw{animation:twinkle 3s ease-in-out infinite}
      `}</style>
      <svg viewBox="0 0 400 260" className="h-full w-full" role="img">
        <defs>
          <radialGradient id="earth" cx="40%" cy="35%"><stop offset="0%" stopColor="#4aa3ff" /><stop offset="60%" stopColor="#1b5fb4" /><stop offset="100%" stopColor="#0a2a5a" /></radialGradient>
          <radialGradient id="glow"><stop offset="60%" stopColor={hue} stopOpacity="0" /><stop offset="100%" stopColor={hue} stopOpacity=".5" /></radialGradient>
        </defs>
        {Array.from({ length: 28 }).map((_, i) => <circle key={i} className="tw" cx={(i * 53) % 400} cy={(i * 37) % 260} r={i % 5 === 0 ? 1.4 : 0.8} fill="#fff" style={{ animationDelay: `${(i % 7) * 0.4}s` }} />)}
        {storm && <g>{[0, 1, 2, 3, 4].map((i) => <line key={i} x1={-40} y1={30 + i * 45} x2={-10} y2={44 + i * 45} stroke="#ffb347" strokeWidth="3" style={{ animation: `rays ${1.2 + i * 0.2}s linear infinite`, animationDelay: `${i * 0.25}s` }} />)}</g>}
        <circle cx="200" cy="170" r="74" fill="url(#glow)" style={alert ? { animation: "pulse 1s infinite" } : undefined} />
        <circle cx="200" cy="170" r="58" fill="url(#earth)" />
        <path d="M165 155c12-10 26-6 34 4s24 6 30 18c-10 10-28 8-40 2s-24-10-24-24z" fill="#3e9b57" opacity=".85" />
        <circle cx="200" cy="170" r="104" fill="none" stroke="#ffffff22" strokeDasharray="3 5" />
        {/* ground station */}
        <g transform="translate(200 112)"><rect x="-3" y="-8" width="6" height="8" fill="#9fb3c8" /><path d="M-9 -8l9-8 9 8z" fill="#ff8c42" /></g>
        <g className="orb">
          <g transform="translate(200 66)">
            {beam && <line x1="0" y1="0" x2="0" y2="42" stroke="#ff8c42" strokeWidth="2" strokeDasharray="4 4" style={{ animation: "beam .6s linear infinite" }} />}
            <rect x="-22" y="-3" width="14" height="6" fill={lowPower ? "#6b2b2b" : "#2a6bd1"} style={lowPower ? { animation: "pulse .8s infinite" } : undefined} />
            <rect x="8" y="-3" width="14" height="6" fill={lowPower ? "#6b2b2b" : "#2a6bd1"} style={lowPower ? { animation: "pulse .8s infinite" } : undefined} />
            <rect x="-7" y="-7" width="14" height="14" rx="2" fill={safe ? "#7a8794" : "#dfe6ee"} stroke={hue} strokeWidth="1.5" />
            <circle cx="0" cy="-9" r="2.2" fill={full ? "#ff5c5c" : "#5ee6a0"} style={full ? { animation: "pulse .6s infinite" } : undefined} />
          </g>
        </g>
        {safe && <text x="200" y="22" textAnchor="middle" fill="#ffb347" fontSize="11" letterSpacing="3">SAFE MODE</text>}
        {lowPower && !safe && <text x="12" y="248" fill="#ff5c5c" fontSize="10" style={{ animation: "pulse .8s infinite" }}>LOW POWER</text>}
        {full && <text x="388" y="248" textAnchor="end" fill="#ff5c5c" fontSize="10" style={{ animation: "pulse .8s infinite" }}>MEMORY FULL</text>}
        {inc && <text x="200" y="250" textAnchor="middle" fill={hue} fontSize="12" letterSpacing="2" style={{ animation: "pulse 1s infinite" }}>{inc.positive ? "OPPORTUNITY" : "ALERT"}: {inc.label.toUpperCase()}</text>}
      </svg>
    </div>
  );
}
