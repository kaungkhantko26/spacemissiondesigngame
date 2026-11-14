"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { HelpCircle } from "lucide-react";
import { preloadAstronaut, useAstronautReady } from "@/components/three/lazy";
import { asset } from "@/lib/asset";
import { GameButton } from "@/components/ui";
import { useUIStore } from "@/stores";
import { Tour, setPendingTour, type TourStep } from "@/components/game/Tour";
import { installVoiceUnlock, playVoice, primeVoice, stopVoice, voiceStatus } from "@/lib/voice";
import { playSfx } from "@/lib/sfx";

const MENU_TOUR: TourStep[] = [
  { target: "[data-tour=astronaut]", title: "Meet your astronaut", body: "Hover over me any time for a hello. I'll walk you through the game." },
  { target: "[data-tour=profile]", title: "Your profile", body: "Your name, level and XP. Finish missions to level up." },
  { target: "[data-tour=menu-launch]", title: "Launch Control", body: "The main game. Pick a rocket and a spaceport, then fly the real ascent yourself, all the way to orbit or the Moon." },
  { target: "[data-tour=menu-design]", title: "Design Mission", body: "Build a spacecraft for a destination: choose the rocket, instruments, power and antenna, then check it closes on mass, power, data and budget." },
  { target: "[data-tour=menu-team]", title: "Team Up", body: "Pick a mission and a difficulty, give each crew member a role and a character, then fly it together." },
  { target: "[data-tour=menu-more]", title: "More options", body: "Profile, Cosmetics for your astronaut's suit, Stats and Settings are in here. Keys 1 to 9 jump to any screen." },
  { title: "Ready for your first flight?", body: "Press the button to open Launch Control. A second short tour there explains the setup and the flight screen." },
];

/** Hover greeting (spoken once per visit) and the guided tour entry point for the menu astronaut. */
export function AstronautGuide({ children, spin }: { children: React.ReactNode; spin?: { down(x: number): void; move(x: number): void; up(): void } }) {
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
  const ready = useAstronautReady((st) => st.ready);
  useEffect(() => { preloadAstronaut(); installVoiceUnlock(); return () => { if (hide.current) clearTimeout(hide.current); stopVoice(); }; }, []);
  return (
    <div data-tour="astronaut" className="relative h-full cursor-grab touch-pan-y select-none active:cursor-grabbing" onMouseEnter={greet} onMouseLeave={leave} onClick={greet}
      onPointerDown={(e) => { if ((e.target as HTMLElement).closest("button,a")) return; spin?.down(e.clientX); (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); }}
      onPointerMove={(e) => spin?.move(e.clientX)} onPointerUp={() => spin?.up()} onPointerCancel={() => spin?.up()}>
      {children}
      {!ready && (
        // eslint-disable-next-line @next/next/no-img-element -- static export, tiny poster shown until the live 3D model has downloaded
        <img src={asset("/models/astronaut-poster.webp")} alt="" aria-hidden className="pointer-events-none absolute inset-0 h-full w-full object-contain object-right-bottom" />
      )}
      {open && !tour && (
        <div role="status" className="absolute right-[53%] top-[20%] z-20 w-[min(17rem,50%)] rounded-2xl border border-orange/60 bg-[#10182b] p-4 text-sm shadow-xl max-md:inset-x-0 max-md:right-auto max-md:top-[1%] max-md:mx-auto max-md:w-[min(20rem,92%)]">
          <span aria-hidden className="absolute -right-2 top-10 size-4 rotate-45 border-r border-t border-orange/60 bg-[#10182b] max-md:hidden" />
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
    playSfx("blip"); window.setTimeout(() => playSfx("ignite2"), 350);
    void playVoice("cd-10", false).then((ok) => setMsg(ok ? "Playing… (" + voiceStatus() + ")" : "Blocked: " + voiceStatus()));
  };
  return (<span className="inline-flex items-center gap-2"><GameButton variant="outline" onClick={run}>Test sound</GameButton>{(msg || muted) && <span role="status" className="text-xs text-muted">{muted ? "Sound is muted in the top bar. " : ""}{msg}</span>}</span>);
}
