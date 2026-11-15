"use client";
import { useEffect } from "react";
import { useUIStore } from "@/stores";
import { installVoiceUnlock, primeVoice } from "@/lib/voice";
import { playSfx, preloadSfx } from "@/lib/sfx";

/** App-wide UI sound: a soft click on buttons and links. No background sound on the menus. Follows the mute switch. */
export function GlobalSound() {
  const muted = useUIStore((s) => s.muted);

  useEffect(() => {
    installVoiceUnlock();
    if (muted) return;
    const interactive = (t: EventTarget | null) => (t as HTMLElement | null)?.closest?.("button, a[href], select, [role=button], [role=radio], summary") as HTMLElement | null;
    const quiet = (el: HTMLElement) => el.closest("[data-nosound]") !== null || el.hasAttribute("disabled") || el.getAttribute("aria-disabled") === "true";
    const click = (e: MouseEvent) => { primeVoice(); void preloadSfx(); const el = interactive(e.target); if (el && !quiet(el)) playSfx("click"); };
    document.addEventListener("click", click, true);
    return () => { document.removeEventListener("click", click, true); };
  }, [muted]);

  return null;
}
