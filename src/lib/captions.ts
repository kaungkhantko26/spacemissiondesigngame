"use client";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

/** On-screen captions for every spoken line (accessibility). The text is the same line that is spoken. */
interface Store { text: string; on: boolean; show: (t: string) => void; setOn: (v: boolean) => void }
let timer: ReturnType<typeof setTimeout> | null = null;
const storage = createJSONStorage(() => { try { return window.localStorage; } catch { return { getItem: () => null, setItem: () => undefined, removeItem: () => undefined }; } });
export const useCaptions = create<Store>()(persist((set, get) => ({
  text: "", on: false, // off unless the player turns them on in Settings
  show: (t) => { if (!get().on) return; set({ text: t }); if (timer) clearTimeout(timer); timer = setTimeout(() => set({ text: "" }), Math.min(9000, 2200 + t.length * 55)); },
  setOn: (on) => set({ on, text: on ? get().text : "" }),
}), { name: "smd-captions", storage, partialize: (s) => ({ on: s.on }), skipHydration: true, version: 2, migrate: () => ({ on: false }) as never }));
