"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { HelpCircle } from "lucide-react";
import { GameButton } from "@/components/ui";
import { useUIStore } from "@/stores";
import { Tour, setPendingTour, type TourStep } from "@/components/game/Tour";
import { playVoice, stopVoice } from "@/lib/voice";

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
  const greeted = useRef(false); // the voice plays only the first time in this visit
  const greet = () => {
    if (hide.current) clearTimeout(hide.current);
    setOpen(true);
    if (greeted.current) return;
    greeted.current = true;
    try { if (window.sessionStorage.getItem("smd-greeted")) return; window.sessionStorage.setItem("smd-greeted", "1"); } catch { /* storage unavailable */ }
    playVoice("greeting", muted);
  };
  const leave = () => { hide.current = setTimeout(() => setOpen(false), 600); };
  useEffect(() => () => { if (hide.current) clearTimeout(hide.current); stopVoice(); }, []);
  return (
    <div data-tour="astronaut" className="relative h-full" onMouseEnter={greet} onMouseLeave={leave} onClick={greet}>
      {children}
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
