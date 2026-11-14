"use client";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

/** The player's chosen display name; saved in this browser. */
export const MAX_NAME = 20;
interface Store { name: string | null; setName: (n: string) => void }
const storage = createJSONStorage(() => { try { return window.localStorage; } catch { return { getItem: () => null, setItem: () => undefined, removeItem: () => undefined }; } });
export const useIdentity = create<Store>()(persist((set) => ({ name: null, setName: (n) => set({ name: n.replace(/\s+/g, " ").trim().slice(0, MAX_NAME) || null }) }), { name: "smd-identity", storage, skipHydration: true }));
