import { beforeAll, describe, expect, it } from "vitest";
import { evaluate, seedFromDesign, type Evaluation } from "@/game/engine";
import { useDesignStore } from "@/game/store";
import { EVENTS, eventById } from "@/game/ops/events";
import { advance, applyPlan, buildReport, createOps, planNextDay, resolveEvent, startLaunch, OPS, type OpsState } from "@/game/ops/sim";

let ev: Evaluation;
beforeAll(() => { useDesignStore.getState().quickStart("moon"); ev = evaluate(useDesignStore.getState().design); });

/** Headless autopilot: best available choice for every event, auto-planned observing/downlink each day. */
function fly(seed: number, pick: (id: string, n: OpsState) => string | null = () => null): OpsState {
  let s = startLaunch(createOps(ev, seed));
  for (let i = 0; i < 200000 && s.phase !== "complete" && s.phase !== "lost"; i++) {
    if (s.event) {
      const def = eventById(s.event.id)!;
      const avail = def.choices.filter((c) => !c.unavailable?.(s, ev));
      const want = pick(def.id, s);
      const c = (want ? avail.find((x) => x.id === want) : undefined) ?? [...avail].sort((a, b) => b.quality - a.quality)[0];
      s = resolveEvent(s, ev, c.id); continue;
    }
    if (s.phase === "science" && s.queue.length < 2 && !s.safe) s = applyPlan(s, planNextDay(s));
    if (s.safe && s.batteryWh > OPS.batteryWh * 0.5) s = { ...s, queue: [...s.queue, { id: 9999 + i, at: s.t, kind: "resume" }] };
    s = advance(s, ev, 600);
  }
  return s;
}

describe("mission operations", () => {
  it("has ten-plus events with 2–4 choices each", () => {
    expect(EVENTS.length).toBeGreaterThanOrEqual(10);
    for (const e of EVENTS) { expect(e.choices.length).toBeGreaterThanOrEqual(2); expect(e.choices.length).toBeLessThanOrEqual(4); }
  });
  it("is deterministic per seed", () => {
    const a = fly(7), b = fly(7);
    expect(a.t).toBe(b.t); expect(a.stats.usefulReturnedGb).toBe(b.stats.usefulReturnedGb); expect(a.phase).toBe(b.phase);
  });
  it("a well-flown recommended design finishes and keeps resources physical", () => {
    const outcomes = [1, 2, 3, 4, 5, 6].map((seed) => fly(seed));
    for (const s of outcomes) {
      expect(["complete", "lost"]).toContain(s.phase);
      expect(s.batteryWh).toBeGreaterThanOrEqual(0); expect(s.batteryWh).toBeLessThanOrEqual(OPS.batteryWh + 1e-6);
      expect(s.dataGb).toBeGreaterThanOrEqual(0); expect(s.dataGb).toBeLessThanOrEqual(OPS.storageGb + 1e-6);
      expect(s.coverage).toBeLessThanOrEqual(1);
    }
    expect(outcomes.some((s) => s.phase === "complete")).toBe(true);
  });
  it("report explains the result and scores every category", () => {
    const s = fly(3), r = buildReport(s, ev);
    expect(r.categories).toHaveLength(7);
    for (const c of r.categories) { expect(c.score).toBeGreaterThanOrEqual(0); expect(c.score).toBeLessThanOrEqual(100); expect(c.why.length).toBeGreaterThan(5); }
    expect(r.headline.length).toBeGreaterThan(10);
  });
  it("eclipse stops solar generation and storage overflow loses data", () => {
    let s = startLaunch(createOps(ev, seedFromDesign(ev.design, 0)));
    s = { ...s, phase: "science", sciT0: 0, t: OPS.orbitPeriodS * 0.9, pointing: "moon", scienceOn: true, slewLeft: 0, dataGb: OPS.storageGb - 0.0001 };
    s = advance(s, ev, 60);
    expect(s.sunlit).toBe(false); expect(s.powerGenW).toBe(0);
    expect(s.stats.lostGb).toBeGreaterThan(0);
  });
  it("a patch antenna returns far less data than a large dish", () => {
    const run = (antennaId: string) => {
      const e2 = evaluate({ ...ev.design, antennaId });
      let s = startLaunch(createOps(e2, 11));
      s = { ...s, phase: "science", sciT0: 0, t: 0, flags: { ...s.flags, navRoll: false } };
      for (let i = 0; i < 2400 && s.phase === "science"; i++) {
        if (s.event) { s = { ...s, event: null }; continue; }
        if (s.queue.length < 2) s = applyPlan(s, planNextDay(s));
        s = advance(s, e2, 900);
      }
      return s.stats.returnedGb;
    };
    expect(run("large")).toBeGreaterThan(run("patch") * 2);
  });
});
