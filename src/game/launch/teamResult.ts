import { create } from "zustand";
/** Outcome of the Team Up flight, shown on the results screen. */
export interface TeamResult { missionId: string; ok: boolean; /** the launch itself succeeded (orbit, or translunar injection for the Moon) */ ascentOk?: boolean; score: number; max: number; grade: string; rocket: string; maxQ: number; maxG: number; flightS: number; kind: "orbit" | "moon"; /** Moon missions only: reaching translunar injection is a launch achievement, the lunar leg decides the mission */ lunar?: "captured" | "lost" | "not-flown" }
export const useTeamResult = create<{ result: TeamResult | null; set: (r: TeamResult | null) => void }>((set) => ({ result: null, set: (result) => set({ result }) }));
