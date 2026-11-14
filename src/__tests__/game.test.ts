import { describe, expect, it } from "vitest";
import { DEFAULT_DESIGN, evaluate, mulberry32, simulate, solvePropellant, type Design } from "@/game/engine";
import { DATASET, DESTINATIONS } from "@/game/data";
import { planTransfer } from "@/game/physics";

const inst = (tag: string) => DATASET.instruments.find((i) => i.tag === tag)!.id;
const moonDesign = (): Design => ({ ...DEFAULT_DESIGN, instrumentIds: [inst("fields"), inst("particles")], propellantKg: 1 });
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
  it("outer targets cost more delta-v than the Moon", () => {
    const dv = (id: string) => planTransfer(DESTINATIONS.find((d) => d.id === id)!).totalDv;
    expect(dv("jupiter")).toBeGreaterThan(dv("mars")); expect(dv("mars")).toBeGreaterThan(dv("moon"));
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
  it("chemical Jupiter is impossible; ion thrusters need solar arrays", () => {
    const j: Design = { ...moonDesign(), destinationId: "jupiter", vehicleId: "ll2_cfg_161" };
    expect(evaluate(j).propellantNeededKg).toBe(Infinity);
    const rtgOnly = evaluate({ ...j, propulsionId: "next", solarAreaM2: 0, rtgUnits: 4 });
    expect(rtgOnly.checks.find((c) => c.id === "thruster-power")!.state).toBe("bad");
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
