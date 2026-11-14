"use client";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useUIStore } from "@/stores";
import { installVoiceUnlock, primeVoice } from "@/lib/voice";
import { playSfx, preloadSfx, setAmbientBed } from "@/lib/sfx";

/** App-wide UI sound: clicks and hover ticks on interactive elements, plus a quiet ambient bed outside the flight screens. Follows the mute switch. */
export function GlobalSound() {
  const muted = useUIStore((s) => s.muted);
  const path = usePathname() ?? "";
  const inFlight = path.startsWith("/launch");
  const flightRef = useRef(inFlight);
  useEffect(() => { flightRef.current = inFlight; }, [inFlight]);

  useEffect(() => {
    installVoiceUnlock();
    if (muted) return;
    const interactive = (t: EventTarget | null) => (t as HTMLElement | null)?.closest?.("button, a[href], select, [role=button], [role=radio], summary") as HTMLElement | null;
    const quiet = (el: HTMLElement) => el.closest("[data-nosound]") !== null || el.hasAttribute("disabled") || el.getAttribute("aria-disabled") === "true";
    const click = (e: MouseEvent) => { primeVoice(); void preloadSfx(); if (!flightRef.current) setAmbientBed(true); /* the context only exists after the first gesture */ const el = interactive(e.target); if (el && !quiet(el)) playSfx("click"); };
    document.addEventListener("click", click, true);
    return () => { document.removeEventListener("click", click, true); };
  }, [muted]);

  useEffect(() => { setAmbientBed(!muted && !inFlight); return () => setAmbientBed(false); }, [muted, inFlight]);
  return null;
}
