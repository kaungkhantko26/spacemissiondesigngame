"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, HelpCircle, Volume2, VolumeX, X } from "lucide-react";
import { GameButton, GlassPanel } from "@/components/ui";
import { useUIStore } from "@/stores";

/** Speak through the browser's speech synthesis (no assets). Silent when muted or unsupported. */
export function speak(text: string, muted: boolean) {
  if (muted || typeof window === "undefined" || !("speechSynthesis" in window)) return;
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1; u.pitch = 1; window.speechSynthesis.cancel(); window.speechSynthesis.speak(u);
  } catch { /* speech unavailable */ }
}
export const stopSpeaking = () => { try { window.speechSynthesis?.cancel(); } catch { /* ignore */ } };

const GREETING = "Hi, and welcome aboard Space Mission Design! I'm your astronaut. Launch a real rocket, send Apollo to the Moon, or design your own mission. New here? Press the tutorial button and I'll show you how to play.";

export const TUTORIAL: { title: string; body: string; tips: string[] }[] = [
  { title: "Welcome, commander", body: "This game has three parts: Launch Control (fly the rocket yourself), Design Mission (build a spacecraft and check it will survive), and Team Up (fly a mission with a crew).", tips: ["Start with Launch Control on Cadet difficulty.", "Press 1 to 9 on the menu to jump to any screen."] },
  { title: "1 · Set up your launch", body: "In Launch Control pick a mission: reach orbit, or the Mission to the Moon with the Saturn V. Then choose a difficulty, a spaceport and a rocket, and press Roll out to the pad.", tips: ["Cadet: the autopilot flies the climb for you.", "Pilot: you steer the climb. Commander: you do everything."] },
  { title: "2 · Countdown and liftoff", body: "Press Start countdown. The launch director counts down by voice. At zero the engines light. Your job is to climb, then slowly tip the rocket over towards the horizon to build sideways speed.", tips: ["Space: separate the stage when fuel runs out.", "P pauses and resumes. The speaker button mutes the voice."] },
  { title: "3 · Fly the climb", body: "Watch max-Q, the moment of peak air pressure, and keep the angle of attack small. Pitch with the up and down arrows, and change thrust with W and S. Autopilot (A) can fly it for you.", tips: ["Up and down arrows tip the nose.", "X cuts the engine, R restarts it."] },
  { title: "4 · Reach orbit", body: "You need to go fast sideways, not only high. Cut the engine when your orbit is circular at about 180 kilometres. The checklist on the right shows each milestone.", tips: ["Use the Warp menu to skip the quiet parts.", "Watch the orbit readout: low by high, in kilometres."] },
  { title: "5 · Mission to the Moon", body: "After parking orbit, wait for the TLI window, then ignite the third stage for the translunar injection burn. Autopilot does it for you on Cadet. Then coast for days to the Moon and brake into lunar orbit.", tips: ["R ignites the burn when the window is open.", "A well-centred window gives a better score."] },
  { title: "6 · Design Mission and Team Up", body: "In Design Mission you pick a destination, rocket, instruments, power and an antenna, then check that the design closes: mass, power, data and budget. In Team Up your crew picks roles and characters, then flies the launch together.", tips: ["The survival odds show what your design can handle.", "Your choices carry through to the results screen."] },
];

export function Tutorial({ onClose }: { onClose: () => void }) {
  const muted = useUIStore((s) => s.muted);
  const [i, setI] = useState(0);
  const [voice, setVoice] = useState(!muted);
  const step = TUTORIAL[i];
  const last = i === TUTORIAL.length - 1;
  const read = useCallback((n: number, on: boolean) => { const t = TUTORIAL[n]; speak(`${t.title}. ${t.body}`, !on); }, []);
  useEffect(() => { read(i, voice); }, [i, voice, read]);
  useEffect(() => () => stopSpeaking(), []);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") setI((n) => Math.min(TUTORIAL.length - 1, n + 1));
      else if (e.key === "ArrowLeft") setI((n) => Math.max(0, n - 1));
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/65 p-4" role="dialog" aria-modal="true" aria-label="How to play">
      <GlassPanel active className="enter w-full max-w-xl p-6 outline-none" >
        <div ref={ref} tabIndex={-1} className="outline-none">
          <div className="flex items-center justify-between">
            <p className="hud-label">Tutorial · step {i + 1} of {TUTORIAL.length}</p>
            <div className="flex gap-2">
              <button aria-label={voice ? "Mute narration" : "Unmute narration"} aria-pressed={voice} onClick={() => { if (voice) stopSpeaking(); setVoice((v) => !v); }} className="rounded-md border border-white/15 p-1.5 text-ink2 hover:text-ink">{voice ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}</button>
              <button aria-label="Close tutorial" onClick={onClose} className="rounded-md border border-white/15 p-1.5 text-ink2 hover:text-ink"><X className="size-4" /></button>
            </div>
          </div>
          <h2 className="mt-3 font-display text-3xl font-bold text-orange">{step.title}</h2>
          <p className="mt-3 text-ink2">{step.body}</p>
          <ul className="mt-4 grid gap-1.5 text-sm">{step.tips.map((t) => <li key={t} className="rounded-md bg-white/5 px-3 py-1.5 text-ink2">💡 {t}</li>)}</ul>
          <div className="mt-5 flex items-center gap-1" aria-hidden>{TUTORIAL.map((_, n) => <span key={n} className={`h-1 flex-1 rounded-full ${n <= i ? "bg-orange" : "bg-white/15"}`} />)}</div>
          <div className="mt-5 flex justify-between gap-2">
            <GameButton variant="outline" disabled={i === 0} icon={<ChevronLeft className="size-4" />} onClick={() => setI(i - 1)}>Back</GameButton>
            {last ? <GameButton variant="primary" onClick={onClose}>Let&apos;s fly</GameButton> : <GameButton variant="primary" onClick={() => setI(i + 1)}>Next <ChevronRight className="ml-1 inline size-4" /></GameButton>}
          </div>
        </div>
      </GlassPanel>
    </div>
  );
}

/** Speech bubble + hover/click greeting for the menu astronaut. */
export function AstronautGuide({ children }: { children: React.ReactNode }) {
  const muted = useUIStore((s) => s.muted);
  const [open, setOpen] = useState(false);
  const [tour, setTour] = useState(false);
  const spoke = useRef(false);
  const hide = useRef<ReturnType<typeof setTimeout> | null>(null);
  const greet = () => {
    if (hide.current) clearTimeout(hide.current);
    setOpen(true);
    if (!spoke.current) { spoke.current = true; speak(GREETING, muted); }
  };
  const leave = () => { hide.current = setTimeout(() => { setOpen(false); spoke.current = false; stopSpeaking(); }, 600); };
  useEffect(() => () => { if (hide.current) clearTimeout(hide.current); stopSpeaking(); }, []);
  return (
    <div className="relative h-full" onMouseEnter={greet} onMouseLeave={leave} onClick={greet} onFocus={greet}>
      {children}
      {open && !tour && (
        <div role="status" className="enter absolute left-1/2 top-[6%] z-20 w-[min(22rem,90%)] -translate-x-1/2 rounded-2xl border border-orange/60 bg-panel/95 p-4 text-sm shadow-xl backdrop-blur">
          <p className="font-semibold text-orange">Astronaut</p>
          <p className="mt-1 text-ink2">Hi, welcome to Space Mission Design! Launch real rockets, fly Apollo to the Moon, or design your own mission. New here?</p>
          <GameButton className="mt-3" variant="primary" icon={<HelpCircle className="size-4" />} onClick={(e) => { e.stopPropagation(); stopSpeaking(); setTour(true); }}>Show me how to play</GameButton>
          <span aria-hidden className="absolute -bottom-2 left-1/2 size-4 -translate-x-1/2 rotate-45 border-b border-r border-orange/60 bg-panel/95" />
        </div>
      )}
      {tour && <Tutorial onClose={() => setTour(false)} />}
    </div>
  );
}

/** Always-available entry point (keyboard friendly). */
export function TutorialButton() {
  const [on, setOn] = useState(false);
  return (<><GameButton variant="outline" icon={<HelpCircle className="size-4" />} onClick={() => setOn(true)}>How to play</GameButton>{on && <Tutorial onClose={() => setOn(false)} />}</>);
}
