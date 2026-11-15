import { describe, expect, it } from "vitest";
import { DATASET, GAME } from "@/game/data";
import { DEFAULT_DESIGN, evaluate, type Design } from "@/game/engine";
import { useDesignStore } from "@/game/store";
import { LaunchSession } from "@/game/launch/session";
import { buildReport, createOps, startLaunch, step, OPS } from "@/game/ops/sim";

const ins = (name: string) => DATASET.instruments.find((i) => i.name.includes(name))!.id;
const LP_MAG = ins("Lunar Prospector Magnetometer"), LP_ER = ins("Lunar Prospector Electron Reflectometer");
const MAG = ins("Magnetometer (OMAG)"), REFL = ins("Electron Reflectometer"), CAM = ins("Imaging and Navigation Camera");
const moon = (o: Partial<Design>): Design => ({ ...DEFAULT_DESIGN, propellantKg: 1000, antennaId: "medium", marginPct: 10, ...o });
const state = (ev: ReturnType<typeof evaluate>, over: object) => { const s = startLaunch(createOps(ev, 1)); return { ...s, ...over } as typeof s; };

describe("review #1 — launch simulation speed is independent of frame rate", () => {
  const simTime = (fps: number, warp = 1) => {
    const s = new LaunchSession("easy", "ll2_pad_87", "ll2_cfg_164", 1); s.start(); s.setWarp(warp);
    for (let i = 0; i < fps * 2; i++) s.tick(1 / fps);
    return s.flight.t + 10; // two real seconds
  };
  it("30, 60, 120 and 144 FPS all advance ≈ 2 s per 2 real seconds at 1×", () => {
    for (const fps of [30, 60, 120, 144]) expect(Math.abs(simTime(fps) - 2)).toBeLessThan(0.1);
  });
  it("time warp scales exactly", () => { expect(Math.abs(simTime(60, 5) - 10)).toBeLessThan(0.15); });
});

describe("review #2 — RTGs keep generating in eclipse", () => {
  it("a four-RTG, zero-array design makes its RTG power in eclipse and in sunlight", () => {
    const ev = evaluate(moon({ solarAreaM2: 0, rtgUnits: 4, instrumentIds: [MAG] }));
    expect(ev.rtgGenW).toBe(4 * GAME.rtg.watts); expect(ev.solarGenW).toBe(0);
    const eclipse = step(state(ev, { phase: "science", t: OPS.orbitPeriodS * 0.9 }), ev, 1);
    expect(eclipse.sunlit).toBe(false); expect(eclipse.powerGenW).toBeCloseTo(ev.rtgGenW, 0);
    const sun = step(state(ev, { phase: "science", t: 100 }), ev, 1);
    expect(sun.sunlit).toBe(true); expect(sun.powerGenW).toBeCloseTo(ev.rtgGenW, 0); // no solar derating on nuclear power
  });
  it("arrays still go dark in eclipse", () => {
    const ev = evaluate(moon({ solarAreaM2: 30, rtgUnits: 0, instrumentIds: [MAG] }));
    expect(step(state(ev, { phase: "science", t: OPS.orbitPeriodS * 0.9 }), ev, 1).powerGenW).toBe(0);
  });
});

describe("review #3 — readiness uses the operations power and data model", () => {
  it("the reported 6 m² camera design (GO before) is no longer GO: operations deficit is caught", () => {
    const ev = evaluate(moon({ solarAreaM2: 6, instrumentIds: [MAG, CAM] }));
    expect(ev.ops.science.load).toBeGreaterThan(ev.ops.science.gen); // while observing in sunlight the load exceeds generation
    expect(ev.checks.find((c) => c.id === "ops-power")!.state).toBe("bad"); expect(ev.goNoGo).toBe(false);
  });
  it("enough array area passes and the by-mode numbers are exposed", () => {
    const ev = evaluate(moon({ solarAreaM2: 30, instrumentIds: [MAG] }));
    expect(ev.checks.find((c) => c.id === "ops-power")!.state).not.toBe("bad");
    expect(ev.ops.avgGen).toBeGreaterThan(ev.ops.avgLoad);
  });
  it("eclipse battery and sustained-data checks exist; a patch antenna cannot sustain the survey", () => {
    const ev = evaluate(moon({ solarAreaM2: 30, antennaId: "patch", instrumentIds: [MAG, REFL] }));
    expect(ev.checks.find((c) => c.id === "ops-battery")).toBeDefined();
    expect(ev.checks.find((c) => c.id === "ops-data")!.state).toBe("bad");
    expect(evaluate(moon({ solarAreaM2: 30, antennaId: "medium", instrumentIds: [MAG] })).checks.find((c) => c.id === "ops-data")!.state).not.toBe("bad");
  });
});

describe("review #4 — the contract's mandatory payload blocks launch", () => {
  it("Moon without the contract measurements is No-go and says why", () => {
    const ev = evaluate(moon({ solarAreaM2: 30, instrumentIds: [CAM] }));
    const c = ev.checks.find((x) => x.id === "contract")!;
    expect(c.state).toBe("bad"); expect(c.detail).toMatch(/magnetic/); expect(ev.goNoGo).toBe(false);
  });
  it("a magnetometer alone is not enough: the contract also needs an electron measurement", () => {
    expect(evaluate(moon({ solarAreaM2: 30, instrumentIds: [MAG] })).checks.find((x) => x.id === "contract")!.state).toBe("bad");
    expect(evaluate(moon({ solarAreaM2: 30, instrumentIds: [LP_MAG, LP_ER] })).checks.find((x) => x.id === "contract")!.state).toBe("ok");
  });
});

describe("review #5 — cruise safe mode does not distort science scoring", () => {
  it("safe time before science is excluded from the science-phase safe share", () => {
    const ev = evaluate(moon({ solarAreaM2: 30, instrumentIds: [MAG] }));
    const s = state(ev, { phase: "complete" });
    s.stats = { ...s.stats, scienceS: 10 * 86400, safeS: 25 * 86400, safeScienceS: 0 };
    const ops = buildReport(s, ev).categories.find((c) => c.id === "operations")!;
    expect(ops.why).toMatch(/safe mode 0 %/);
    s.stats = { ...s.stats, safeScienceS: 2 * 86400 };
    expect(buildReport(s, ev).categories.find((c) => c.id === "operations")!.why).toMatch(/safe mode 20 %/);
  });
  it("safe-mode seconds in science are counted separately by the simulation", () => {
    const ev = evaluate(moon({ solarAreaM2: 30, instrumentIds: [MAG] }));
    let cruise = state(ev, { phase: "cruise", safe: true }); cruise = step(cruise, ev, 60);
    expect(cruise.stats.safeS).toBeGreaterThan(0); expect(cruise.stats.safeScienceS).toBe(0);
    let sci = state(ev, { phase: "science", safe: true }); sci = step(sci, ev, 60);
    expect(sci.stats.safeScienceS).toBeGreaterThan(0);
  });
});

describe("review #7/#9 — quick start meets the science goal; ion thrust is power-limited", () => {
  it("Moon quick start is GO, carries the required payload and meets the contract science target", () => {
    expect(useDesignStore.getState().quickStart("moon")).toBe(true);
    const ev = evaluate(useDesignStore.getState().design);
    expect(ev.goNoGo).toBe(true); expect(ev.instruments.some((i) => i.tag === "fields")).toBe(true); expect(ev.instruments.some((i) => i.name.includes("Electron Reflectometer"))).toBe(true);
    expect(ev.science).toBeGreaterThanOrEqual(ev.destination.scienceGoal);
  });
  it("a small array at Mars throttles the ion thrusters and lengthens the cruise", () => {
    const base = { ...DEFAULT_DESIGN, destinationId: "mars", vehicleId: "ll2_cfg_164", propulsionId: "next", thrusters: 2, propellantKg: 300, instrumentIds: [CAM], antennaId: "high" };
    const small = evaluate({ ...base, solarAreaM2: 50 }), big = evaluate({ ...base, solarAreaM2: 120 });
    expect(small.electricThrottle).toBeLessThan(1); expect(small.electricThrottle).toBeLessThan(big.electricThrottle);
    expect(small.cruiseDays).toBeGreaterThan(small.plan.transferDays); // low-thrust burn time is added on top of the coast
  });
});
