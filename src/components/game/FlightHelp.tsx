"use client";
import { useEffect } from "react";
import { X } from "lucide-react";
import { GameButton, GlassPanel } from "@/components/ui";
import type { TourStep } from "./Tour";

export const KEY_GROUPS: { title: string; keys: [string, string][] }[] = [
  { title: "Steer", keys: [["↑", "Raise the nose"], ["↓", "Lower the nose (pitch over toward the horizon)"]] },
  { title: "Engine", keys: [["W", "More throttle (+5%)"], ["S", "Less throttle (−5%)"], ["Shift+W", "Full throttle"], ["Shift+S", "Throttle off"], ["X", "Cut the engine (2nd stage onward)"], ["R", "Relight the engine / ignite TLI"]] },
  { title: "Stages", keys: [["Space", "Separate the empty stage"]] },
  { title: "Assist & game", keys: [["A", "Autopilot or upper-stage guidance"], ["P", "Pause / resume"], ["1–5", "Time warp 1×, 2×, 5×, 10×, 50×"], ["M", "Mute sound"], ["H", "Show or hide this help"]] },
];

/** A keyboard cheat sheet that opens with H. */
export function ControlsHelp({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape" || e.key.toLowerCase() === "h") { e.preventDefault(); e.stopPropagation(); onClose(); } };
    window.addEventListener("keydown", k, true); return () => window.removeEventListener("keydown", k, true);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/65 p-4" role="dialog" aria-modal="true" aria-label="Keyboard controls">
      <GlassPanel active className="max-h-[90vh] w-full max-w-2xl overflow-auto p-5">
        <div className="flex items-center justify-between"><h2 className="font-display text-2xl font-bold">Keyboard controls</h2>
          <button aria-label="Close" onClick={onClose} className="rounded-md border border-white/15 p-1.5 text-ink2 hover:text-ink"><X className="size-4" /></button></div>
        <p className="mt-1 text-sm text-ink2">Every button on the control bar has a key. Hold ↑ or ↓ to keep turning; the rocket turns at a fixed speed.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {KEY_GROUPS.map((g) => (
            <section key={g.title}><h3 className="hud-label mb-1.5 !text-orange">{g.title}</h3>
              <ul className="grid gap-1.5">{g.keys.map(([k, d]) => (
                <li key={k} className="flex items-center gap-3 text-sm"><kbd className="min-w-14 rounded-md border border-white/25 bg-white/10 px-2 py-1 text-center font-mono text-xs shadow-[0_2px_0_rgba(255,255,255,.12)]">{k}</kbd><span className="text-ink2">{d}</span></li>))}</ul></section>))}
        </div>
        <div className="mt-5 flex justify-end"><GameButton variant="primary" onClick={onClose}>Got it</GameButton></div>
      </GlassPanel>
    </div>
  );
}

/** First-time "flight school" for the manual difficulties, as a spotlight tour on the pad. */
export const MANUAL_TOUR: TourStep[] = [
  { target: "[data-tour=pad]", title: "You are the pilot", body: "On this difficulty you fly the climb yourself. The goal: get high AND fast sideways, then stop the engine in a safe orbit. A rocket only stays up because it keeps moving sideways." },
  { target: "[data-tour=pitch]", title: "Steer with ↑ and ↓", body: "The rocket starts pointing straight up (90°). After the tower clears, hold ↓ a little at a time to tip it toward the horizon. Gradual turns only: a sharp turn tears it apart." },
  { target: "[data-tour=cue]", title: "Follow the Cue", body: "On Pilot difficulty the left panel shows a Cue: the pitch to hold. If it says ▼ lower nose, press ↓. If ▲, press ↑. When it says ✓ on target, let go." },
  { target: "[data-tour=throttle]", title: "Throttle: W and S", body: "Full throttle is fine most of the way. Around T+1:00 to T+1:30 comes max-Q, the peak air pressure: press S to ease to about 70% until the pressure bar falls, then W to open up." },
  { target: "[data-tour=stage]", title: "Stages: Space", body: "When Stage 1 fuel hits 0%, the Stage button lights up. Press Space to drop the empty stage and light the next one." },
  { target: "[data-tour=cut]", title: "Cut the engine: X", body: "Near orbit, watch the Orbit readout (lowest × highest point). Press X when the lowest point is above the target and you are fast enough. Too early falls back; too late makes the orbit too high." },
  { target: "[data-tour=controls]", title: "Keys for everything", body: "Every control has a key, shown on the buttons. Press H any time for the full keyboard sheet. If something goes wrong, the result screen tells you why and what to do." },
];
