"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { GameButton } from "@/components/ui";

export interface TourStep { target?: string; title: string; body: string }
type Box = { x: number; y: number; w: number; h: number } | null;

/** Which guided tour should run next (survives the page change from the menu into the game). Session-only. */
const KEY = "smd-tour";
export const pendingTour = (): string | null => { try { return window.sessionStorage.getItem(KEY); } catch { return null; } };
export const setPendingTour = (v: string | null) => { try { if (v) window.sessionStorage.setItem(KEY, v); else window.sessionStorage.removeItem(KEY); } catch { /* storage unavailable */ } };

/** Spotlight tour: dims the screen, outlines the real component being explained and shows a card next to it. Skippable at any step (button or Esc). */
export function Tour({ steps, onDone, onSkip, doneLabel = "Done" }: { steps: TourStep[]; onDone: () => void; onSkip: () => void; doneLabel?: string }) {
  const [i, setI] = useState(0);
  const [box, setBox] = useState<Box>(null);
  const [vp, setVp] = useState({ w: 1200, h: 800 });
  const card = useRef<HTMLDivElement>(null);
  const step = steps[i], last = i === steps.length - 1;

  const measure = useCallback(() => {
    setVp({ w: window.innerWidth, h: window.innerHeight });
    const el = step.target ? document.querySelector(step.target) : null;
    if (!el) { setBox(null); return; }
    const r = el.getBoundingClientRect(), pad = 6;
    setBox((b) => (b && Math.abs(b.x - (r.left - pad)) < 0.5 && Math.abs(b.y - (r.top - pad)) < 0.5 && Math.abs(b.w - (r.width + pad * 2)) < 0.5 && Math.abs(b.h - (r.height + pad * 2)) < 0.5 ? b : { x: r.left - pad, y: r.top - pad, w: r.width + pad * 2, h: r.height + pad * 2 }));
  }, [step.target]);

  useLayoutEffect(() => {
    const el = step.target ? document.querySelector(step.target) : null;
    if (el) { const r = el.getBoundingClientRect(); if (r.top < 70 || r.bottom > window.innerHeight - 10) el.scrollIntoView({ block: "center", behavior: "auto" }); }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reads layout of the highlighted element
    measure();
  }, [step.target, measure]);
  useEffect(() => {
    const id = setInterval(measure, 150);
    window.addEventListener("resize", measure);
    return () => { clearInterval(id); window.removeEventListener("resize", measure); };
  }, [measure]);
  useEffect(() => {
    card.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onSkip();
      else if (e.key === "ArrowRight" || e.key === "Enter") { if (last) onDone(); else setI((n) => n + 1); }
      else if (e.key === "ArrowLeft") setI((n) => Math.max(0, n - 1));
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [last, onDone, onSkip]);

  // card placement: below the target if it fits, else above, else beside; centred when there is no target
  const CW = Math.min(340, vp.w - 24), CH = 210;
  let left = (vp.w - CW) / 2, top = (vp.h - CH) / 2;
  if (box) {
    left = Math.min(Math.max(12, box.x + box.w / 2 - CW / 2), vp.w - CW - 12);
    if (box.y + box.h + CH + 16 < vp.h) top = box.y + box.h + 14;
    else if (box.y - CH - 16 > 0) top = box.y - CH - 14;
    else { top = Math.min(Math.max(12, box.y), vp.h - CH - 12); left = box.x > vp.w / 2 ? Math.max(12, box.x - CW - 14) : Math.min(vp.w - CW - 12, box.x + box.w + 14); }
  }
  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="Guided tour">
      {box ? <div aria-hidden className="pointer-events-none absolute rounded-lg border-2 border-orange transition-all duration-200" style={{ left: box.x, top: box.y, width: box.w, height: box.h, boxShadow: "0 0 0 9999px rgba(3,6,14,.72)" }} /> : <div aria-hidden className="absolute inset-0 bg-[#03060e]/75" />}
      <div ref={card} tabIndex={-1} className="absolute max-h-[calc(100vh-1.5rem)] overflow-y-auto rounded-xl border border-orange/60 bg-[#10182b] p-4 text-sm shadow-2xl outline-none" style={{ left, top: Math.max(12, Math.min(top, vp.h - 120)), width: CW }}>
        <p className="hud-label !text-orange">Tour · {i + 1} / {steps.length}</p>
        <h2 className="mt-1 font-display text-xl font-bold">{step.title}</h2>
        <p className="mt-1.5 text-ink2">{step.body}</p>
        <div className="mt-4 flex items-center justify-between gap-2">
          <button type="button" onClick={onSkip} className="text-xs text-muted underline hover:text-ink">Skip tour</button>
          <div className="flex gap-2">
            {i > 0 && <GameButton variant="outline" onClick={() => setI(i - 1)}>Back</GameButton>}
            <GameButton variant="primary" onClick={() => (last ? onDone() : setI(i + 1))}>{last ? doneLabel : "Next"}</GameButton>
          </div>
        </div>
      </div>
    </div>
  );
}

export const BRIEFING_TOUR: TourStep[] = [
  { target: "[data-tour=panel-1]", title: "1 · Pick your mission", body: "Reach orbit, or fly the Saturn V on the Mission to the Moon. Click a card to choose it." },
  { target: "[data-tour=panel-2]", title: "2 · Pick a difficulty", body: "Cadet lets the autopilot fly the climb. Pilot makes you steer. Commander gives you everything, with a bigger score multiplier." },
  { target: "[data-tour=panel-3]", title: "3 · Pick a spaceport", body: "Real launch pads. Closer to the equator means a free eastward speed boost from Earth's spin." },
  { target: "[data-tour=panel-4]", title: "4 · Pick a rocket", body: "Bigger rockets carry more. For the Moon you need the Saturn V." },
  { target: "[data-tour=briefing]", title: "Your briefing", body: "Payload, mass, thrust and ideal delta-v for the choices you made, plus the controls cheat sheet." },
  { target: "[data-tour=rollout]", title: "Roll out", body: "When you are ready, roll out to the pad. A short tour of the flight screen will follow." },
];
export const FLIGHT_TOUR: TourStep[] = [
  { target: "[data-tour=telemetry]", title: "Telemetry", body: "Mission clock, altitude, speed, g-load, throttle, fuel per stage and your orbit, always on the left." },
  { target: "[data-tour=milestones]", title: "Milestones", body: "Each step of the mission ticks off here: liftoff, max-Q, stage separations, space, orbit." },
  { target: "[data-tour=controls]", title: "Controls", body: "Pause, autopilot, pitch, throttle, stage, cut and restart. Keys: arrows pitch, W/S throttle, Space stage, X cut, R restart, A autopilot, P pause." },
  { target: "[data-tour=warp]", title: "Time warp", body: "Speed up the quiet parts, such as waiting in parking orbit for the Moon window." },
  { target: "[data-tour=pad]", title: "Ready?", body: "Press Start countdown. The launch director counts it down, then you fly. Good luck, commander." },
];
