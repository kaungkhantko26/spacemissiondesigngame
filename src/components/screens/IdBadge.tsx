"use client";
import { useRef, useState } from "react";
import { PlayerAvatar } from "@/components/ui";
import { useUIStore } from "@/stores";
import { FlagView } from "@/components/ui/FlagView";
import { useFlag } from "@/game/flags";
import type { PlayerProfile } from "@/types";

/** Crew ID badge hanging from a lanyard. Idles with a slow pendulum swing; drag the card sideways and let go to make it swing back. */
export function IdBadge({ profile, patch, suit }: { profile: PlayerProfile; patch?: { name: string; color: string; accent: string } | null; suit?: string }) {
  const reduced = useUIStore((s) => s.reducedMotion);
  const flagId = useFlag((s) => s.flagId), custom = useFlag((s) => s.custom);
  const [angle, setAngle] = useState(0);
  const [drag, setDrag] = useState(false);
  const start = useRef(0);
  const bars = Array.from(profile.playerCode.replace(/\D/g, "").padEnd(8, "7"), (d, i) => 1 + ((Number(d) + i) % 4));
  const onDown = (e: React.PointerEvent) => { start.current = e.clientX; setDrag(true); (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); };
  const onMove = (e: React.PointerEvent) => { if (drag) setAngle(Math.max(-18, Math.min(18, (e.clientX - start.current) * 0.16))); };
  const onUp = () => { setDrag(false); setAngle(0); };
  return (
    <section aria-label="Crew ID badge" className="relative mx-auto w-full max-w-[340px] select-none overflow-visible rounded-xl border border-[var(--border)] bg-panel/60 pb-6">
      <style>{`@keyframes idswing{0%,100%{transform:rotate(-2.6deg)}50%{transform:rotate(2.6deg)}}`}</style>
      {/* lanyard: two straps from the top corners meeting at the clip */}
      <svg aria-hidden viewBox="0 0 340 130" className="block h-[130px] w-full">
        <defs>
          <pattern id="strap" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(0)"><rect width="14" height="14" fill="#e8651a" /><rect y="6" width="14" height="2" fill="#ffb27a" opacity=".55" /></pattern>
        </defs>
        <polygon points="40,0 66,0 178,118 158,118" fill="url(#strap)" /><polygon points="274,0 300,0 182,118 162,118" fill="url(#strap)" opacity=".9" />
        <polygon points="40,0 66,0 178,118 158,118" fill="none" stroke="#7a2f08" strokeWidth="1" /><polygon points="274,0 300,0 182,118 162,118" fill="none" stroke="#7a2f08" strokeWidth="1" />
        <rect x="160" y="108" width="20" height="14" rx="3" fill="#aeb6c4" stroke="#6d7585" /><rect x="164" y="118" width="12" height="10" rx="2" fill="#8c95a6" stroke="#5c6475" />
      </svg>
      {/* swinging card, hinged at the clip */}
      <div className="-mt-[6px] flex justify-center" style={{ perspective: 900 }}>
        <div role="img" aria-label={`ID badge for ${profile.username}`} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
          className="relative w-[216px] cursor-grab touch-none active:cursor-grabbing"
          style={{ transformOrigin: "50% -14px", transform: drag ? `rotate(${angle}deg)` : undefined, animation: drag || reduced ? undefined : "idswing 4.6s ease-in-out infinite", transition: drag ? "none" : "transform .9s cubic-bezier(.2,1.6,.4,1)" }}>
          <div className="relative overflow-hidden rounded-2xl border border-white/20 shadow-[0_18px_40px_rgba(0,0,0,.55)]" style={{ background: "linear-gradient(160deg,#17233c 0%,#0d1526 55%,#1b2a48 100%)" }}>
            <div aria-hidden className="pointer-events-none absolute inset-0 opacity-40" style={{ background: "linear-gradient(115deg,transparent 30%,rgba(255,255,255,.16) 45%,transparent 60%)" }} />
            <div className="mx-auto mt-2.5 h-2 w-14 rounded-full bg-black/70 ring-1 ring-white/20" aria-hidden />
            {patch && <span role="img" aria-label={`${patch.name} patch`} title={patch.name} className="absolute right-2.5 top-[104px] grid size-9 place-items-center rounded-full border-2 text-sm" style={{ background: patch.color, borderColor: patch.accent, color: patch.accent }}>★</span>}
            <div className="flex items-center justify-center gap-1.5 pt-2 text-[9px] font-semibold uppercase tracking-[.22em] text-orange"><span aria-hidden className="size-1.5 rotate-45 bg-orange" />Space Mission Design</div>
            <div className="mt-2.5 grid place-items-center">
              <div className="rounded-full p-1" style={{ background: "conic-gradient(from 200deg,#ff8a3d,#ffd27a,#4fc3f7,#ff8a3d)" }}><div className="rounded-full bg-[#0d1526] p-1"><PlayerAvatar player={profile} size={104} /></div></div>
            </div>
            <div className="px-4 pt-3 text-center">
              <p className="font-display text-2xl font-bold leading-tight">{profile.username}</p>
              <p className="text-[10px] uppercase tracking-[.25em] text-ink2">Mission Commander</p>
              <div className="mt-1.5 flex justify-center"><FlagView id={flagId} custom={custom} width={34} label="Your flag" /></div>
            </div>
            <dl className="mx-4 mt-3 grid grid-cols-2 gap-2 text-center text-[10px]">
              <div className="rounded-md bg-white/5 py-1.5"><dt className="uppercase tracking-wider text-muted">Level</dt><dd className="font-display text-base font-bold text-gold">{profile.progression.level}</dd></div>
              <div className="rounded-md bg-white/5 py-1.5"><dt className="uppercase tracking-wider text-muted">Missions</dt><dd className="font-display text-base font-bold">{profile.history.completed}</dd></div>
            </dl>
            <div className="mx-4 mt-3 flex items-end justify-between gap-2">
              <div><p className="text-[9px] uppercase tracking-wider text-muted">Crew ID</p><p className="font-mono text-sm font-bold tracking-wider">{profile.playerCode}</p></div>
              <div aria-hidden className="flex h-7 items-end gap-[2px]">{bars.concat(bars).map((w, i) => <span key={i} className="bg-white/85" style={{ width: w, height: 14 + ((i * 7) % 14) }} />)}</div>
            </div>
            <div aria-hidden className="mt-3 h-2.5 w-full" style={{ background: `repeating-linear-gradient(135deg,${suit ?? "#ff8a3d"} 0 10px,#10182b 10px 20px)` }} />
          </div>
        </div>
      </div>
      <p className="mt-3 text-center text-[11px] text-muted">Drag the badge and let go</p>
    </section>
  );
}
