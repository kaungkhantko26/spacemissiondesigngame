import type { Evaluation } from "../engine";
import { hardware, measuresOf } from "../instruments";

/**
 * Mission-operations simulation core: types, balance constants and pure helpers.
 * Everything here is SIMPLIFIED and GAME-BALANCED (not NASA-certified). Real inputs come from the Mission Architect's
 * Evaluation (dataset-derived Δv, transfer time, link rate, instruments); the constants below are game values.
 */
export const OPS = {
  /** 1× = one simulated minute per real second. */
  simSecPerRealSec: 60,
  speeds: [0, 1, 10, 100] as const,
  /** Cruise has nothing to manage but events, so it runs this many times faster than the selected speed. */
  cruiseWarp: 10,
  ascentS: 600,
  scienceDays: 30,
  orbitPeriodS: 7080,       // ~118 min, 100 km lunar orbit
  eclipseFrac: 0.38,        // share of each orbit spent behind the Moon (no sunlight)
  earthVisFrac: 0.55,       // share of each orbit with Earth above the horizon
  stationUpFrac: 0.45,      // share of each day a ground station can see the Moon
  slewS: 600,               // time to re-point the spacecraft
  arrayDerate: 0.12,        // off-pointing, dust, temperature and wiring losses on the arrays
  loadScale: 10,            // scales instrument power draw so power is a real constraint
  batteryWh: 500,
  storageGb: 64,
  dataScale: 80,            // instrument data rate multiplier over the Architect's kbps estimate
  linkScale: 0.25,          // fraction of the Architect's link rate usable (protocol, pointing, margins)
  coverageDays: 20,         // observing days for a full global survey
  goalCoverage: 0.8,
  goalDataGb: 60,
  stretchDataGb: 150,
  hotC: 55, coldC: -25, safeHotC: 75,
  budgetMarginUsd: 0,
} as const;

export type Phase = "prelaunch" | "ascent" | "cruise" | "loi" | "science" | "complete" | "lost";
export type Pointing = "earth" | "moon" | "sun";
export type CmdKind = "point-earth" | "point-moon" | "point-sun" | "science-on" | "science-off" | "burn" | "safe-mode" | "resume";
export interface Command { id: number; at: number; kind: CmdKind; arg?: number }
export type LogLevel = "info" | "warn" | "crit" | "good";
export interface LogEntry { t: number; level: LogLevel; text: string }
export interface Health { power: number; comms: number; instruments: number; propulsion: number }
export type DelayedEffect = "wheel-bias-end" | "target-window-close";
export interface Delayed { at: number; effect: DelayedEffect }
export interface Decision { eventId: string; choiceId: string; quality: 0 | 1 | 2; t: number }

export interface Flags {
  launchAnomaly: boolean; antennaRoll: boolean; navRoll: boolean; propRoll: boolean; targetRoll: boolean;
  navError: boolean; wheelBias: boolean; commsMult: number; contactBlockedUntil: number; loiRisk: number;
  bonusTarget: boolean; stormObserved: boolean; targetWindow: boolean;
}
export interface Stats {
  generatedGb: number; returnedGb: number; usefulReturnedGb: number; lostGb: number;
  activeObsS: number; downlinkS: number; safeS: number; safeScienceS: number; blackouts: number; scienceS: number;
  decisions: Decision[]; spentUsd: number; lossCause: string | null;
}
export interface OpsState {
  t: number; phase: Phase; phaseT: number; sciT0: number;
  pointing: Pointing; slewLeft: number; scienceOn: boolean; safe: boolean;
  dvLeft: number; batteryWh: number; tempC: number; dataGb: number; dataQuality: number; coverage: number;
  health: Health; flags: Flags; stats: Stats;
  powerGenW: number; powerUseW: number; linkMbps: number; sunlit: boolean; contact: boolean; observing: boolean; downlinking: boolean;
  queue: Command[]; nextCmdId: number; log: LogEntry[]; delayed: Delayed[];
  event: { id: string; at: number } | null; fired: Record<string, number>; lastEventAt: number;
  rng: number;
}

export const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
export function rand(n: { rng: number }): number {
  n.rng = (n.rng + 0x6d2b79f5) >>> 0;
  let t = n.rng; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export function addLog(n: OpsState, level: LogLevel, text: string) { n.log = [...n.log.slice(-119), { t: n.t, level, text }]; }

/* ---- orbit geometry (deterministic functions of time) ---- */
export const orbitPhase = (t: number) => (t / OPS.orbitPeriodS) % 1;
export const isSunlit = (t: number) => orbitPhase(t) < 1 - OPS.eclipseFrac;
export const earthVisible = (t: number) => ((t / OPS.orbitPeriodS + 0.2) % 1) < OPS.earthVisFrac;
export const stationUp = (t: number) => ((t / 86400) % 1) < OPS.stationUpFrac;
export const contactAt = (n: Pick<OpsState, "phase" | "flags">, t: number) =>
  t >= n.flags.contactBlockedUntil && stationUp(t) && (n.phase !== "science" || earthVisible(t));

/* ---- derived design numbers ---- */
export const instrumentPowerW = (ev: Evaluation) => hardware(ev.instruments).powerW * OPS.loadScale; // shared packages count once
export const dataRateMbps = (ev: Evaluation) => hardware(ev.instruments).kbps * OPS.dataScale / 1000;
export const downlinkMbps = (ev: Evaluation) => (ev.linkBps / 1e6) * OPS.linkScale;
export const hasFields = (ev: Evaluation) => ev.instruments.some((i) => measuresOf(i).includes("magnetic-vector")); // an actual magnetometer, not any "fields" tag
export const cruiseSeconds = (ev: Evaluation) => ev.cruiseDays * 86400;

export const fmtMet = (s: number) => {
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return `T+${d}d ${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m`;
};
