import { describe, expect, it } from "vitest";
import { DEFAULT_DESIGN, evaluate, mulberry32, simulate, solvePropellant, type Design } from "@/game/engine";
import { DATASET, DESTINATIONS } from "@/game/data";
import { planTransfer } from "@/game/physics";

const inst = (tag: string) => DATASET.instruments.find((i) => i.tag === tag)!.id;
const LP_MAG = "nmc_exp_1998_001a_05", LP_ER = "nmc_exp_1998_001a_06"; // the Moon contract needs a magnetometer AND an electron reflectometer
const moonDesign = (): Design => ({ ...DEFAULT_DESIGN, instrumentIds: [LP_MAG, LP_ER], propellantKg: 1, solarAreaM2: 30, antennaId: "high" });
const filled = (d: Design): Design => {
  const probe = evaluate({ ...d, propellantKg: 0 });
  return { ...d, propellantKg: Math.ceil(solvePropellant(probe.dryKg, probe.dvRequired, probe.isp)! * 1.2) };
};

describe("transfer physics (dataset μ, radii, orbits)", () => {
  it("Moon needs ~3.9 km/s from LEO and takes ~5 days", () => {
    const p = planTransfer(DESTINATIONS.find((d) => d.id === "moon")!);
    expect(p.totalDv).toBeGreaterThan(3800); expect(p.totalDv).toBeLessThan(4100);
    expect(p.transferDays).toBeGreaterThan(4); expect(p.transferDays).toBeLessThan(6);
  });
  it("Mars Hohmann is ~259 days", () => {
    const p = planTransfer(DESTINATIONS.find((d) => d.id === "mars")!);
    expect(p.transferDays).toBeGreaterThan(250); expect(p.transferDays).toBeLessThan(270);
  });
  it("Mars costs more delta-v than the Moon", () => {
    const dv = (id: string) => planTransfer(DESTINATIONS.find((d) => d.id === id)!).totalDv;
    expect(dv("mars")).toBeGreaterThan(dv("moon"));
  });
});

describe("design review", () => {
  it("no instruments or too little propellant = no-go", () => {
    expect(evaluate({ ...DEFAULT_DESIGN, instrumentIds: [] }).goNoGo).toBe(false);
    expect(evaluate(moonDesign()).checks.find((c) => c.id === "dv")!.state).toBe("bad");
  });
  it("a properly fuelled Moon mission is go", () => {
    const ev = evaluate(filled(moonDesign()));
    expect(ev.goNoGo).toBe(true);
    expect(ev.dvAvailable).toBeGreaterThanOrEqual(ev.dvRequired);
  });
  it("a small rocket cannot lift a big spacecraft", () => {
    const ev = evaluate(filled({ ...moonDesign(), vehicleId: "ll2_cfg_26" }));
    expect(ev.checks.find((c) => c.id === "mass")!.state).toBe("bad");
  });
  it("ion thrusters cannot run on RTGs alone at Mars", () => {
    const m: Design = { ...moonDesign(), destinationId: "mars", vehicleId: "ll2_cfg_161", propulsionId: "next", solarAreaM2: 0, rtgUnits: 1 };
    expect(evaluate(m).checks.find((c) => c.id === "thruster-power")!.state).toBe("bad");
  });
});

describe("simulation", () => {
  it("is deterministic per seed and fails in order", () => {
    const ev = evaluate(filled(moonDesign()));
    expect(simulate(ev, 42)).toEqual(simulate(ev, 42));
    const r = simulate(ev, 7);
    expect(r.phases.length).toBeGreaterThan(0);
    if (!r.success) expect(r.phases[r.phases.length - 1].passed).toBe(false);
  });
  it("rng is uniform-ish in [0,1)", () => {
    const r = mulberry32(1); const xs = Array.from({ length: 1000 }, r);
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(0); expect(Math.max(...xs)).toBeLessThan(1);
  });
});

import { buildTrajectory } from "@/game/trajectory";
describe("trajectory (Earth → Moon from dataset μ)", () => {
  const moon = DESTINATIONS.find((d) => d.id === "moon")!;
  it("TLI starts ~10.9 km/s at perigee and slows to ~0.2 km/s at lunar distance", () => {
    const t = buildTrajectory(moon, null);
    const early = t.sample(t.markers.seg1 + 1e-4).telemetry.speedKmS;
    const late = t.sample(t.markers.seg2 - 1e-4).telemetry.speedKmS;
    expect(early).toBeGreaterThan(10.5); expect(early).toBeLessThan(11.2);
    expect(late).toBeGreaterThan(0.1); expect(late).toBeLessThan(0.3);
  });
  it("coast takes ~5 days and the Moon is waiting at arrival", () => {
    const t = buildTrajectory(moon, null);
    const s = t.sample(t.markers.seg2 + 1e-4);
    expect(s.telemetry.metS / 86400).toBeGreaterThan(4.5); expect(s.telemetry.metS / 86400).toBeLessThan(6);
    expect(s.telemetry.rangeKm).toBeLessThan(21000); // inside the approach offset
  });
  it("captures into a 100 km orbit on success; failures end the path early or fly past", () => {
    const ok = buildTrajectory(moon, null); const end = ok.sample(1);
    expect(end.telemetry.rangeKm).toBeLessThan(2000); expect(end.lost).toBe(false);
    expect(buildTrajectory(moon, 1).uEnd).toBeLessThan(1);
    const miss = buildTrajectory(moon, 2).sample(1);
    expect(miss.telemetry.rangeKm).toBeGreaterThan(5000);
  });
  it("planet transfers are sun-centred and arrive at the target", () => {
    const mars = DESTINATIONS.find((d) => d.id === "mars")!; const t = buildTrajectory(mars, null);
    expect(t.mode).toBe("sun");
    const arr = t.sample(t.markers.seg2 + 1e-4);
    expect(arr.telemetry.metS / 86400).toBeGreaterThan(255); expect(arr.telemetry.rangeKm).toBeLessThan(2e7);
  });
});
