import { create } from "zustand";
/** Outcome of the Team Up flight, shown on the results screen. */
export interface TeamResult { missionId: string; ok: boolean; score: number; max: number; grade: string; rocket: string; maxQ: number; maxG: number; flightS: number; kind: "orbit" | "moon" }
export const useTeamResult = create<{ result: TeamResult | null; set: (r: TeamResult | null) => void }>((set) => ({ result: null, set: (result) => set({ result }) }));
