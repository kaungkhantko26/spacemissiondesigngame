"use client";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Design } from "./engine";
import type { OpsState } from "./ops/core";

/**
 * One saved mission from design to report. Architect starts it, the real ascent and lunar capture fill it in, Mission Control
 * takes over from lunar orbit (not from a second launch), and the final report closes it. Saved in this browser so a refresh
 * resumes where the player was. The Design is stored (not the Evaluation): evaluating it again is deterministic.
 */
export type MissionStage = "ascent" | "transit" | "operating" | "complete" | "lost";
export interface AscentRecord { ok: boolean; mission: "orbit" | "moon"; difficulty: "easy" | "medium" | "hard"; siteId: string; rocket: string; score: number; grade: string; flightS: number; failure: string | null; apoKm: number; tliErrDeg: number | null }
export interface TransitRecord {
  cruiseOk: boolean; insertionOk: boolean; transferDays: number;
  /** Who paid for the departure burn. The launcher's upper stage does TLI on a flown Moon ascent; the spacecraft's own propellant is then NOT charged for it again. */
  departureBy: "launcher" | "spacecraft";
}
export interface MissionSummary { outcome: "success" | "partial" | "failure"; total: number; grade: string; headline: string; coverage: number; usefulGb: number; health: number }
export interface MissionRecord {
  id: string; attempt: number; createdAt: number; updatedAt: number; stage: MissionStage; design: Design;
  ascent: AscentRecord | null; transit: TransitRecord | null; ops: OpsState | null; summary: MissionSummary | null; lostReason: string | null;
}
interface Store {
  record: MissionRecord | null;
  start: (design: Design, attempt: number) => void;
  setAscent: (a: AscentRecord) => void;
  setTransit: (t: TransitRecord) => void;
  saveOps: (s: OpsState) => void;
  finish: (summary: MissionSummary) => void;
  lose: (reason: string) => void;
  clear: () => void;
}
const storage = createJSONStorage(() => { try { return window.localStorage; } catch { return { getItem: () => null, setItem: () => undefined, removeItem: () => undefined }; } });
const id = () => `MSN-${Date.now().toString(36).toUpperCase().slice(-6)}`;
const touch = (r: MissionRecord, p: Partial<MissionRecord>): MissionRecord => ({ ...r, ...p, updatedAt: Date.now() });

export const useMission = create<Store>()(persist((set, get) => ({
  record: null,
  start: (design, attempt) => set({ record: { id: id(), attempt, createdAt: Date.now(), updatedAt: Date.now(), stage: "ascent", design, ascent: null, transit: null, ops: null, summary: null, lostReason: null } }),
  setAscent: (a) => { const r = get().record; if (r) set({ record: touch(r, { ascent: a, stage: a.ok ? "transit" : "lost", lostReason: a.ok ? null : a.failure ?? "Launch failure." }) }); },
  setTransit: (t) => { const r = get().record; if (!r) return; const ok = t.cruiseOk && t.insertionOk; set({ record: touch(r, { transit: t, stage: ok ? "operating" : "lost", lostReason: ok ? null : !t.cruiseOk ? "The spacecraft was lost during the transfer to the Moon." : "The lunar-orbit insertion burn failed." }) }); },
  saveOps: (s) => { const r = get().record; if (r && r.stage === "operating") set({ record: touch(r, { ops: s }) }); },
  finish: (summary) => { const r = get().record; if (r) set({ record: touch(r, { summary, stage: summary.outcome === "failure" && r.ops?.phase === "lost" ? "lost" : "complete" }) }); },
  lose: (reason) => { const r = get().record; if (r && r.stage !== "complete") set({ record: touch(r, { stage: "lost", lostReason: reason }) }); },
  clear: () => set({ record: null }),
}), { name: "smd-mission", storage, skipHydration: true, version: 1 }));

export const stageLabel: Record<MissionStage, string> = { ascent: "On the pad", transit: "Transfer to the Moon", operating: "In lunar orbit: operations", complete: "Report ready", lost: "Mission lost" };
