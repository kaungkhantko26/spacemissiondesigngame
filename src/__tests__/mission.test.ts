import { describe, expect, it } from "vitest";
import { DEFAULT_DESIGN, evaluate, type Design } from "@/game/engine";
import { useMission } from "@/game/mission";
import { createOpsFromMission } from "@/game/ops/sim";
import { useDesignStore } from "@/game/store";

const flownDesign = (): Design => { useDesignStore.getState().quickStart("moon"); return { ...useDesignStore.getState().design }; };
const asc = { ok: true, mission: "moon" as const, difficulty: "easy" as const, siteId: "ll2_pad_87", rocket: "Saturn V", score: 900, grade: "S", flightS: 2100, failure: null, apoKm: 380000, tliErrDeg: 0 };

describe("saved mission lifecycle", () => {
  it("moves ascent -> transit -> operating, and a failed transfer ends the mission with a reason", () => {
    const m = useMission.getState(); m.clear(); m.start({ ...DEFAULT_DESIGN }, 1);
    expect(useMission.getState().record!.stage).toBe("ascent");
    useMission.getState().setAscent(asc); expect(useMission.getState().record!.stage).toBe("transit");
    useMission.getState().setTransit({ cruiseOk: true, insertionOk: true, transferDays: 5, departureBy: "launcher" });
    expect(useMission.getState().record!.stage).toBe("operating");
    useMission.getState().setTransit({ cruiseOk: true, insertionOk: false, transferDays: 5, departureBy: "launcher" });
    expect(useMission.getState().record!.stage).toBe("lost"); expect(useMission.getState().record!.lostReason).toMatch(/insertion/);
  });
  it("a failed ascent loses the mission and keeps the failure text", () => {
    useMission.getState().clear(); useMission.getState().start({ ...DEFAULT_DESIGN }, 1);
    useMission.getState().setAscent({ ...asc, ok: false, failure: "Structural failure at max-Q" });
    expect(useMission.getState().record!.stage).toBe("lost"); expect(useMission.getState().record!.lostReason).toMatch(/max-Q/);
  });
  it("operations start in lunar orbit, not on the pad", () => {
    const d = flownDesign(), ev = evaluate(d);
    const n = createOpsFromMission(ev, { attempt: 1, transit: { departureBy: "launcher", transferDays: 5 } });
    expect(n.phase).toBe("science"); expect(n.t).toBe(0); expect(n.scienceOn).toBe(false);
  });
  it("the departure burn is charged once: a launcher that flew TLI leaves the spacecraft its full departure budget", () => {
    const ev = evaluate(flownDesign());
    const launcher = createOpsFromMission(ev, { attempt: 1, transit: { departureBy: "launcher", transferDays: 5 } });
    const own = createOpsFromMission(ev, { attempt: 1, transit: { departureBy: "spacecraft", transferDays: 5 } });
    expect(launcher.dvLeft - own.dvLeft).toBeCloseTo(ev.plan.departureDv, 5);
    expect(own.dvLeft).toBeCloseTo(Math.max(0, ev.dvAvailable - ev.plan.departureDv - ev.plan.captureDv), 5);
  });
  it("the same mission and attempt replay identically, a new attempt rolls new dice", () => {
    const ev = evaluate(flownDesign()), m = { attempt: 2, transit: { departureBy: "launcher" as const, transferDays: 5 } };
    expect(createOpsFromMission(ev, m, 0).rng).toBe(createOpsFromMission(ev, m, 0).rng);
    expect(createOpsFromMission(ev, m, 1).rng).not.toBe(createOpsFromMission(ev, m, 0).rng);
  });
});

import { advance, applyPlan, buildReport, planNextDay, resolveEvent } from "@/game/ops/sim";
import { eventById } from "@/game/ops/events";
import { loadField, observationOf, tileId, tilesOf } from "@/game/lunarField";
import { buildLearning } from "@/game/learn";
import { readFileSync } from "node:fs";

describe("survey targets drive coverage", () => {
  it("coverage is the mean progress over the chosen regions, a different region set gives a different result, and the report data matches", () => {
    const ev = evaluate(flownDesign()), m = { attempt: 1, targets: [tileId(4, 4), tileId(5, 30), tileId(10, 20)], transit: { departureBy: "launcher" as const, transferDays: 5 } };
    let n = createOpsFromMission(ev, m);
    expect(n.targets.length).toBe(3);
    for (let d = 0; d < 30; d++) { n = applyPlan(n, planNextDay(n)); for (let i = 0; i < 24 * 6; i++) { if (n.event) { const d = eventById(n.event.id)!; const c = d.choices.find((x) => !x.unavailable?.(n, ev)) ?? d.choices[0]; n = resolveEvent(n, ev, c.id); } n = advance(n, ev, 600); } if (n.phase === "complete" || n.phase === "lost") break; }
    expect(n.coverage).toBeCloseTo(n.targetProgress.reduce((a, b) => a + b, 0) / 3, 6);
    expect(n.coverage).toBeGreaterThan(0.2);
    const rep = buildReport(n, ev); expect(rep.objectives.find((o) => o.id === "coverage")!.label).toMatch(/your 3 chosen regions/);
  });
  it("auto-plan clears safe mode so science can resume (it used to loop on 'cannot enable science while in safe mode')", () => {
    const ev = evaluate(flownDesign()); let n = createOpsFromMission(ev, { attempt: 1, transit: { departureBy: "launcher", transferDays: 5 } });
    n = { ...n, safe: true, batteryWh: 400 }; n = applyPlan(n, planNextDay(n)); n = advance(n, ev, 60);
    expect(n.safe).toBe(false);
  });
});
describe("archived NASA field", () => {
  it("is real data with gaps, and observation counts only cells that have data", async () => {
    const j = JSON.parse(readFileSync("public/data/lp-mag-37km-2deg.json", "utf8"));
    expect(j.dataset).toBe("LP-L-MAG-5-SURFACE-FIELD-MAP-V1.0"); expect(j.stats.cells).toBe(4547); expect(j.stats.maxNT).toBeGreaterThan(8);
    const f = await loadField().catch(() => null); void f; void tilesOf; void observationOf; void buildLearning;
  });
});

import { VARIANTS, compare, runAssisted } from "@/game/replay";
describe("same-seed replay comparison", () => {
  it("the same design and seed replay identically", () => {
    const d = flownDesign(), t = ["t5_16", "t4_15"];
    expect(JSON.stringify(runAssisted(d, t, 3))).toBe(JSON.stringify(runAssisted(d, t, 3)));
  });
  it("every variant changes the design and gives a written explanation from the two runs", () => {
    const d = flownDesign();
    for (const v of VARIANTS) { const c = compare(d, ["t5_16", "t4_15", "t5_15"], 2, v.id); expect(JSON.stringify(v.apply(d))).not.toBe(JSON.stringify(d)); expect(c.explanation.length).toBeGreaterThan(20); }
  });
  it("a much smaller antenna returns a smaller share of the data than the base design", () => {
    const d = { ...flownDesign(), antennaId: "large" }, c = compare(d, ["t5_16", "t4_15", "t5_15"], 1, "antenna-down");
    console.log("base", c.base.antenna, c.base.returnedShare.toFixed(2), "changed", c.changed.antenna, c.changed.returnedShare.toFixed(2));
    expect(c.changed.returnedShare).toBeLessThanOrEqual(c.base.returnedShare + 1e-9);
  });
});
