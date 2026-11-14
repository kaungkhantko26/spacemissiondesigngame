"use client";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

/** Profile-picture templates the player can customise. Saved in this browser (localStorage). */
export const AVATAR_TEMPLATES = [
  { id: "initial", label: "Initial" }, { id: "helmet", label: "Helmet" }, { id: "rocket", label: "Rocket" }, { id: "planet", label: "Planet" },
  { id: "moon", label: "Moon" }, { id: "star", label: "Star" }, { id: "satellite", label: "Satellite" }, { id: "comet", label: "Comet" }, { id: "alien", label: "Alien" },
] as const;
export type AvatarTemplate = (typeof AVATAR_TEMPLATES)[number]["id"];
export const AVATAR_BGS = ["#168BFF", "#FF8C42", "#36D399", "#7C3AED", "#E8363D", "#FFC857", "#0B3D91", "#1b2a48"] as const;
export const AVATAR_FGS = ["#FFFFFF", "#0B1220", "#FFC857", "#4FC3F7", "#FF8C42", "#36D399"] as const;
export const AVATAR_FRAMES = ["none", "ring", "double", "orbit"] as const;
export const AVATAR_SHAPES = ["circle", "rounded", "hex"] as const;
export interface AvatarStyle { template: AvatarTemplate; bg: string; fg: string; frame: (typeof AVATAR_FRAMES)[number]; shape: (typeof AVATAR_SHAPES)[number] }
export const DEFAULT_AVATAR: AvatarStyle = { template: "initial", bg: "#168BFF", fg: "#04101F", frame: "none", shape: "circle" };

interface Store extends AvatarStyle { patch: (p: Partial<AvatarStyle>) => void; reset: () => void }
const storage = createJSONStorage(() => { try { return window.localStorage; } catch { return { getItem: () => null, setItem: () => undefined, removeItem: () => undefined }; } });
export const useAvatar = create<Store>()(persist((set) => ({ ...DEFAULT_AVATAR, patch: (p) => set(p), reset: () => set(DEFAULT_AVATAR) }), { name: "smd-avatar", storage, skipHydration: true }));
