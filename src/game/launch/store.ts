import { create } from "zustand";
import type { Difficulty } from "./core";

interface Setup { difficulty: Difficulty; siteId: string; vehicleId: string; set: (p: Partial<Pick<Setup, "difficulty" | "siteId" | "vehicleId">>) => void }
export const useLaunchSetup = create<Setup>((set) => ({
  difficulty: "easy", siteId: "ll2_pad_87", vehicleId: "ll2_cfg_164",
  set: (p) => set(p),
}));
