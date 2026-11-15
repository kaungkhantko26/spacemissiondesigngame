import { create } from "zustand";
import type { Difficulty, MissionKind } from "./core";

interface Setup { difficulty: Difficulty; siteId: string; vehicleId: string; mission: MissionKind; /** payload as a share of the default (0.2 to 1) */ payloadPct: number; /** propellant loaded (0.6 to 1) */ fuelPct: number; /** engine throttle limit (0.5 to 1) */ throttleCap: number; set: (p: Partial<Pick<Setup, "difficulty" | "siteId" | "vehicleId" | "mission" | "payloadPct" | "fuelPct" | "throttleCap">>) => void }
export const useLaunchSetup = create<Setup>((set) => ({
  difficulty: "easy", siteId: "ll2_pad_87", vehicleId: "ll2_cfg_164", mission: "orbit", payloadPct: 1, fuelPct: 1, throttleCap: 1,
  set: (p) => set(p),
}));
