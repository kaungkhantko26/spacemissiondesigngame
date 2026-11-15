import { create } from "zustand";
import { evaluate, seedFromDesign, type Evaluation } from "../engine";
import { useMission, type MissionRecord } from "../mission";
import {
  OPS, advance, applyPlan, buildReport, cancelCommand, createOps, createOpsFromMission, planNextDay, queueCommand, resolveEvent, startLaunch,
  type Command, type OpsState, type Report,
} from "./sim";

export type ResourceId = "power" | "battery" | "fuel" | "data" | "comms" | "thermal";
export type Speed = (typeof OPS.speeds)[number];
interface OpsStore {
  stage: "briefing" | "running" | "report";
  s: OpsState | null; ev: Evaluation | null; report: Report | null;
  speed: Speed; selected: ResourceId; attempt: number;
  begin: (ev: Evaluation, attempt?: number) => void;
  /** Take over a flown mission in lunar orbit (new dice for operations when `again` is set), or pick up its saved operations. */
  beginMission: (m: MissionRecord, again?: boolean) => void;
  resumeMission: (m: MissionRecord) => void;
  setSpeed: (v: Speed) => void;
  select: (r: ResourceId) => void;
  tick: (realDt: number) => void;
  command: (kind: Command["kind"], delayS: number, arg?: number) => void;
  cancel: (id: number) => void;
  choose: (choiceId: string) => void;
  assist: () => void;
  reset: () => void;
}
let lastSave = 0;
/** Save the running operations to the mission record at most every 3 real seconds. */
function saveSoon(s: OpsState) { const now = Date.now(); if (now - lastSave > 3000) { lastSave = now; useMission.getState().saveOps(s); } }
/** In-memory mission state (no persistence: saving belongs to the backend). */
export const useOps = create<OpsStore>((set, get) => ({
  stage: "briefing", s: null, ev: null, report: null, speed: 10, selected: "power", attempt: 0,
  begin: (ev, attempt) => {
    const a = attempt ?? get().attempt;
    set({ stage: "running", ev, s: startLaunch(createOps(ev, seedFromDesign(ev.design, a))), report: null, speed: 10, attempt: a });
  },
  beginMission: (m, again) => {
    const ev = evaluate(m.design), a = again ? get().attempt + 1 : 0;
    const s = createOpsFromMission(ev, m, a);
    set({ stage: "running", ev, s, report: null, speed: 10, attempt: a });
    useMission.getState().saveOps(s);
  },
  resumeMission: (m) => { if (!m.ops) return; const ev = evaluate(m.design); set({ stage: m.ops.phase === "complete" || m.ops.phase === "lost" ? "report" : "running", ev, s: m.ops, report: m.ops.phase === "complete" || m.ops.phase === "lost" ? buildReport(m.ops, ev) : null, speed: 10 }); },
  setSpeed: (speed) => set({ speed }),
  select: (selected) => set({ selected }),
  tick: (realDt) => {
    const { s, ev, speed, stage } = get();
    if (stage !== "running" || !s || !ev || speed === 0 || s.event) return;
    const warp = s.phase === "cruise" ? OPS.cruiseWarp : 1;
    const next = advance(s, ev, realDt * OPS.simSecPerRealSec * speed * warp);
    if (next.phase === "complete" || next.phase === "lost") {
      const report = buildReport(next, ev); set({ s: next, stage: "report", report });
      useMission.getState().saveOps(next);
      useMission.getState().finish({ outcome: report.outcome, total: report.total, grade: report.grade, headline: report.headline, coverage: next.coverage, usefulGb: next.stats.usefulReturnedGb, health: Math.min(next.health.power, next.health.comms, next.health.instruments, next.health.propulsion) });
    } else { set({ s: next, speed: next.event ? 0 : speed }); saveSoon(next); }
  },
  command: (kind, delayS, arg) => { const { s } = get(); if (s) set({ s: queueCommand(s, kind, s.t + delayS, arg) }); },
  cancel: (id) => { const { s } = get(); if (s) set({ s: cancelCommand(s, id) }); },
  choose: (choiceId) => {
    const { s, ev } = get(); if (!s || !ev) return;
    const next = resolveEvent(s, ev, choiceId);
    if (next.phase === "lost") set({ s: next, stage: "report", report: buildReport(next, ev), speed: 10 });
    else set({ s: next, speed: 10 });
  },
  assist: () => { const { s } = get(); if (s) set({ s: applyPlan(s, planNextDay(s)) }); },
  reset: () => set({ stage: "briefing", s: null, report: null }),
}));
