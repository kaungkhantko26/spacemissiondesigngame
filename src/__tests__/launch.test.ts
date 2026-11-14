import { describe, expect, it } from "vitest";
import { DATASET } from "@/game/data";
import { LAUNCH, RULES, buildRocket, createFlight, defaultInput, orbitElements, scoreFlight, stepFlight, type Difficulty, type Flight } from "@/game/launch/core";
import { flyWithBot } from "@/game/launch/bot";

const site = DATASET.launch_sites[0];
const vehicle = (name: string) => DATASET.vehicles.find((v) => v.name === name)!;
const make = (name: string, d: Difficulty, seed = 1, siteIdx = 0) => {
  const v = vehicle(name), rules = RULES[d];
  return createFlight(buildRocket(v, v.leo_capacity_kg * rules.payloadFrac), rules, DATASET.launch_sites[siteIdx], seed);
};
const autopilot = (f: Flight): Flight => { const i = defaultInput(f.rules); while (f.phase !== "orbit" && f.phase !== "failed" && f.t < 1800) stepFlight(f, i); return f; };

describe("rocket model (dataset-calibrated)", () => {
  it("every vehicle has a flyable thrust-to-weight and ~9.3–10 km/s of ideal Δv at full capacity", () => {
    for (const v of DATASET.vehicles) {
      const r = buildRocket(v, v.leo_capacity_kg);
      expect(r.twr0).toBeGreaterThanOrEqual(LAUNCH.twrMin - 0.001); expect(r.twr0).toBeLessThanOrEqual(LAUNCH.twrMax + 0.001);
      expect(r.dvIdeal).toBeGreaterThan(9200); expect(r.dvIdeal).toBeLessThan(LAUNCH.dvIdealMs + 60); // heavy payload fractions can't reach the target with sane structure
    }
  });
  it("lighter payloads give more Δv", () => {
    const v = vehicle("Falcon 9");
    expect(buildRocket(v, 5000).dvIdeal).toBeGreaterThan(buildRocket(v, 15000).dvIdeal);
  });
});

describe("pad and countdown", () => {
  it("sits on the pad with the Earth-spin speed of the site, then lifts off after T-0", () => {
    const f = make("Falcon 9", "easy");
    expect(Math.round(Math.hypot(f.vx, f.vy))).toBe(Math.round(site.rotation_boost_m_s));
    const i = defaultInput(f.rules);
    while (f.t < -0.5) stepFlight(f, i);
    expect(f.tel.alt).toBeLessThan(2);
    for (let k = 0; k < 400; k++) stepFlight(f, i);
    expect(f.milestones.liftoff).toBeDefined(); expect(f.tel.alt).toBeGreaterThan(5);
  });
});

describe("difficulty: Cadet (autopilot)", () => {
  it("reaches orbit on every rocket, with the milestones in order", () => {
    for (const v of DATASET.vehicles) {
      const f = autopilot(make(v.name, "easy"));
      expect(f.phase, `${v.name}: ${f.failure}`).toBe("orbit");
      const m = f.milestones;
      expect(m.liftoff).toBeLessThan(m.maxq); expect(m.maxq).toBeLessThan(m.meco); expect(m.meco).toBeLessThanOrEqual(m.sep);
      expect(m.sep).toBeLessThan(m.ignition2); expect(m.ignition2).toBeLessThan(m.karman === undefined ? Infinity : m.karman + 200);
      expect(f.tel.periKm).toBeGreaterThanOrEqual(RULES.easy.minPerigeeKm);
    }
  });
  it("a better launch site (closer to the equator) needs less propellant", () => {
    const kourou = DATASET.launch_sites.findIndex((s) => s.name.includes("Ariane")), baikonur = DATASET.launch_sites.findIndex((s) => s.name === "1/5");
    const left = (i: number) => autopilot(make("Falcon 9", "easy", 1, i)).tel.prop2;
    expect(left(kourou)).toBeGreaterThan(left(baikonur) - 0.001);
  });
});

describe("difficulty: Pilot and Commander (manual, test-pilot bot)", () => {
  it.each(["medium", "hard"] as const)("%s is winnable with winds and engine anomalies", (d) => {
    let ok = 0, n = 0;
    for (const name of ["Falcon 9", "Atlas V 401", "Electron", "Ariane 62"]) for (const seed of [1, 2, 3]) {
      const f = flyWithBot(make(name, d, seed * 7919)); n++; if (f.phase === "orbit") ok++;
    }
    expect(ok / n).toBeGreaterThanOrEqual(0.9);
  });
  it("hard requires manual staging: without STAGE the rocket never gets to orbit", () => {
    const f = make("Falcon 9", "hard"); const i = defaultInput(f.rules);
    while (f.phase !== "orbit" && f.phase !== "failed" && f.t < 400) stepFlight(f, i);
    expect(f.milestones.sep).toBeUndefined(); expect(f.phase).not.toBe("orbit");
  });
  it("rules get stricter and score more as difficulty rises", () => {
    expect(RULES.easy.payloadFrac).toBeLessThan(RULES.medium.payloadFrac); expect(RULES.medium.payloadFrac).toBeLessThan(RULES.hard.payloadFrac);
    expect(RULES.easy.minPerigeeKm).toBeLessThan(RULES.hard.minPerigeeKm);
    expect(RULES.easy.qLimitFactor).toBeGreaterThan(RULES.hard.qLimitFactor);
    expect(RULES.easy.scoreMult).toBeLessThan(RULES.hard.scoreMult);
  });
});

describe("failure modes", () => {
  it("pitching over at low altitude breaks the vehicle (angle of attack at high q)", () => {
    const f = make("Falcon 9", "medium"); const i = { ...defaultInput(f.rules), pitchRate: 0 };
    while (f.t < 12) stepFlight(f, i);
    i.pitchRate = -1;
    while (f.phase !== "failed" && f.t < 120) stepFlight(f, i);
    expect(f.phase).toBe("failed"); expect(f.failure).toMatch(/angle of attack|dynamic pressure/);
  });
  it("flying straight up never reaches orbit and is scored as a failure", () => {
    const f = make("Falcon 9", "easy"); const i = { ...defaultInput(f.rules), autopilot: false, throttle: 1 };
    while (f.phase !== "orbit" && f.phase !== "failed" && f.t < 900) stepFlight(f, i);
    expect(f.phase).not.toBe("orbit"); expect(scoreFlight(f).ok).toBe(false);
  });
  it("orbit elements are consistent for a circular LEO state", () => {
    const r = 6371000 + 400_000, v = Math.sqrt(3.986004418e14 / r);
    const el = orbitElements(r, 0, 0, -v);
    expect(el.e).toBeLessThan(0.001); expect(el.peri / 1000).toBeGreaterThan(395); expect(el.peri / 1000).toBeLessThan(405);
  });
});

describe("scoring", () => {
  it("successful flights score more with a higher difficulty multiplier", () => {
    const e = scoreFlight(autopilot(make("Falcon 9", "easy")));
    const h = scoreFlight(flyWithBot(make("Falcon 9", "hard")));
    expect(e.ok && h.ok).toBe(true);
    expect(h.score).toBeGreaterThan(e.score * 1.2);
  });
});
