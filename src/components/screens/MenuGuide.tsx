"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { HelpCircle } from "lucide-react";
import { useProgress } from "@react-three/drei";
import { preloadAstronaut } from "@/components/three/lazy";
import { GameButton } from "@/components/ui";
import { useUIStore } from "@/stores";
import { Tour, setPendingTour, type TourStep } from "@/components/game/Tour";
import { installVoiceUnlock, playVoice, primeVoice, stopVoice, voiceStatus } from "@/lib/voice";

const MENU_TOUR: TourStep[] = [
  { target: "[data-tour=astronaut]", title: "Meet your astronaut", body: "Hover over me any time for a hello. I'll walk you through the game." },
  { target: "[data-tour=profile]", title: "Your profile", body: "Your name, level and XP. Finish missions to level up." },
  { target: "[data-tour=menu-launch]", title: "Launch Control", body: "The main game. Pick a rocket and a spaceport, then fly the real ascent yourself, all the way to orbit or the Moon." },
  { target: "[data-tour=menu-design]", title: "Design Mission", body: "Build a spacecraft for a destination: choose the rocket, instruments, power and antenna, then check it closes on mass, power, data and budget." },
  { target: "[data-tour=menu-team]", title: "Team Up", body: "Pick a mission and a difficulty, give each crew member a role and a character, then fly it together." },
  { target: "[data-tour=menu-cosmetics]", title: "Cosmetics and profile", body: "Customise your astronaut's suit and look. Press 1 to 9 to jump to any screen." },
  { title: "Ready for your first flight?", body: "Press the button to open Launch Control. A second short tour there explains the setup and the flight screen." },
];

/** Hover greeting (spoken once per visit) and the guided tour entry point for the menu astronaut. */
export function AstronautGuide({ children }: { children: React.ReactNode }) {
  const muted = useUIStore((s) => s.muted);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tour, setTour] = useState(false);
  const hide = useRef<ReturnType<typeof setTimeout> | null>(null);
  const greeted = useRef(false); // the voice plays only once, but only counts once sound actually started
  const greet = () => {
    if (hide.current) clearTimeout(hide.current);
    setOpen(true);
    if (greeted.current) return;
    try { if (window.sessionStorage.getItem("smd-greeted")) { greeted.current = true; return; } } catch { /* storage unavailable */ }
    void playVoice("greeting", muted).then((ok) => {
      if (!ok) return; // blocked before a click: the next hover or click tries again
      greeted.current = true;
      try { window.sessionStorage.setItem("smd-greeted", "1"); } catch { /* ignore */ }
    });
  };
  const leave = () => { hide.current = setTimeout(() => setOpen(false), 600); };
  const { active, progress } = useProgress();
  useEffect(() => { preloadAstronaut(); installVoiceUnlock(); return () => { if (hide.current) clearTimeout(hide.current); stopVoice(); }; }, []);
  return (
    <div data-tour="astronaut" className="relative h-full" onMouseEnter={greet} onMouseLeave={leave} onClick={greet}>
      {children}
      {active && progress < 100 && <div role="status" className="pointer-events-none absolute inset-x-0 top-1/2 mx-auto w-48 -translate-y-1/2 text-center text-xs text-ink2"><div className="mb-2 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-orange transition-all" style={{ width: `${Math.round(progress)}%` }} /></div>Loading your astronaut… {Math.round(progress)}%</div>}
      {open && !tour && (
        <div role="status" className="absolute inset-x-0 top-[4%] z-20 mx-auto w-[min(22rem,90%)] rounded-2xl border border-orange/60 bg-[#10182b] p-4 text-sm shadow-xl">
          <p className="font-semibold text-orange">Astronaut</p>
          <p className="mt-1 text-ink2">Hi, welcome to Space Mission Design! Launch real rockets, fly Apollo to the Moon, or design your own mission. New here?</p>
          <GameButton className="mt-3" variant="primary" icon={<HelpCircle className="size-4" />} onClick={(e) => { e.stopPropagation(); stopVoice(); setOpen(false); setTour(true); }}>Show me how to play</GameButton>
        </div>
      )}
      {tour && <Tour steps={MENU_TOUR} doneLabel="Open Launch Control" onDone={() => { setTour(false); setPendingTour("launch"); router.push("/launch"); }} onSkip={() => setTour(false)} />}
    </div>
  );
}

/** Always-available entry point (keyboard friendly). */
export function TutorialButton() {
  const router = useRouter();
  const [on, setOn] = useState(false);
  return (<><GameButton variant="outline" icon={<HelpCircle className="size-4" />} onClick={() => setOn(true)}>How to play</GameButton>
    {on && <Tour steps={MENU_TOUR.slice(1)} doneLabel="Open Launch Control" onDone={() => { setOn(false); setPendingTour("launch"); router.push("/launch"); }} onSkip={() => setOn(false)} />}</>);
}

/** Plays the greeting on click and shows what the browser says, so a silent voice can be diagnosed. */
export function TestVoiceButton() {
  const muted = useUIStore((s) => s.muted);
  const [msg, setMsg] = useState("");
  const run = () => {
    primeVoice();
    void playVoice("cd-10", false).then((ok) => setMsg(ok ? "Playing… (" + voiceStatus() + ")" : "Blocked: " + voiceStatus()));
  };
  return (<span className="inline-flex items-center gap-2"><GameButton variant="outline" onClick={run}>Test voice</GameButton>{(msg || muted) && <span role="status" className="text-xs text-muted">{muted ? "Sound is muted in the top bar. " : ""}{msg}</span>}</span>);
}
