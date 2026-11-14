import { create } from "zustand";
import { seedFromDesign, type Evaluation } from "../engine";
import {
  OPS, advance, applyPlan, buildReport, cancelCommand, createOps, planNextDay, queueCommand, resolveEvent, startLaunch,
  type Command, type OpsState, type Report,
} from "./sim";

export type ResourceId = "power" | "battery" | "fuel" | "data" | "comms" | "thermal";
export type Speed = (typeof OPS.speeds)[number];
interface OpsStore {
  stage: "briefing" | "running" | "report";
  s: OpsState | null; ev: Evaluation | null; report: Report | null;
  speed: Speed; selected: ResourceId; attempt: number;
  begin: (ev: Evaluation, attempt?: number) => void;
  setSpeed: (v: Speed) => void;
  select: (r: ResourceId) => void;
  tick: (realDt: number) => void;
  command: (kind: Command["kind"], delayS: number, arg?: number) => void;
  cancel: (id: number) => void;
  choose: (choiceId: string) => void;
  assist: () => void;
  reset: () => void;
}
/** In-memory mission state (no persistence: saving belongs to the backend). */
export const useOps = create<OpsStore>((set, get) => ({
  stage: "briefing", s: null, ev: null, report: null, speed: 10, selected: "power", attempt: 0,
  begin: (ev, attempt) => {
    const a = attempt ?? get().attempt;
    set({ stage: "running", ev, s: startLaunch(createOps(ev, seedFromDesign(ev.design, a))), report: null, speed: 10, attempt: a });
  },
  setSpeed: (speed) => set({ speed }),
  select: (selected) => set({ selected }),
  tick: (realDt) => {
    const { s, ev, speed, stage } = get();
    if (stage !== "running" || !s || !ev || speed === 0 || s.event) return;
    const warp = s.phase === "cruise" ? OPS.cruiseWarp : 1;
    const next = advance(s, ev, realDt * OPS.simSecPerRealSec * speed * warp);
    if (next.phase === "complete" || next.phase === "lost") set({ s: next, stage: "report", report: buildReport(next, ev) });
    else set({ s: next, speed: next.event ? 0 : speed });
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
