import { create } from "zustand";
import type { Difficulty, MissionKind } from "./core";

interface Setup { difficulty: Difficulty; siteId: string; vehicleId: string; mission: MissionKind; set: (p: Partial<Pick<Setup, "difficulty" | "siteId" | "vehicleId" | "mission">>) => void }
export const useLaunchSetup = create<Setup>((set) => ({
  difficulty: "easy", siteId: "ll2_pad_87", vehicleId: "ll2_cfg_164", mission: "orbit",
  set: (p) => set(p),
}));
