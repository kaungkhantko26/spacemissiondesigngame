import { describe, expect, it } from "vitest";
import { DATASET } from "@/game/data";
import { LAUNCH, MOON_DIST_M, RULES, TLI, buildRocket, createFlight, defaultInput, orbitElements, scoreFlight, stepFlight, type Difficulty, type Flight, type MissionKind } from "@/game/launch/core";
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
    for (const v of DATASET.vehicles.filter((x) => !x.stages)) { // Saturn V uses its real stage data instead of the calibrated split
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

import { BIOMES, biomeFor, skyAt } from "@/components/game/launchScenery";
describe("real-environment scenery", () => {
  it("every dataset spaceport has its own biome (different terrain and light)", () => {
    const ids = DATASET.launch_sites.map((s) => biomeFor(s.id).id);
    expect(new Set(ids).size).toBe(DATASET.launch_sites.length);
    for (const s of DATASET.launch_sites) expect(BIOMES[s.id]).toBeDefined();
  });
  it("coastal sites have sea, inland sites do not", () => {
    expect(biomeFor("ll2_pad_87").sea).toBeDefined(); expect(biomeFor("ll2_pad_32").sea).toBeUndefined();
  });
  it("the sky darkens with altitude: pale at the horizon, deep blue aloft, black in space", () => {
    const b = biomeFor("ll2_pad_87"), sum = (c: number[]) => c[0] + c[1] + c[2];
    expect(sum(skyAt(0, b))).toBeGreaterThan(sum(skyAt(15000, b))); expect(sum(skyAt(15000, b))).toBeGreaterThan(sum(skyAt(120000, b)));
    expect(sum(skyAt(150000, b))).toBeLessThan(40);
  });
});

const SATURN = DATASET.vehicles.find((v) => v.name === "Saturn V")!;
const moonFlight = (v = SATURN, d: Difficulty = "easy", seed = 1, siteIdx = 0) =>
  createFlight(buildRocket(v, v.tli_payload_kg ?? Math.round(v.leo_capacity_kg * RULES[d].payloadFrac * 0.45)), RULES[d], DATASET.launch_sites[siteIdx], seed, "moon" as MissionKind);
const flyAuto = (f: Flight, maxT = 9000) => { const i = defaultInput(f.rules); while (!["orbit", "translunar", "failed"].includes(f.phase) && f.t < maxT) { stepFlight(f, i); i.stage = false; i.cut = false; i.restart = false; } return f; };

describe("Saturn V and the mission to the Moon", () => {
  it("is built from the dataset's verified three-stage data", () => {
    const r = buildRocket(SATURN, SATURN.tli_payload_kg!);
    expect(r.stageNames).toEqual(["S-IC", "S-II", "S-IVB"]); expect(r.s3).toBeDefined();
    expect(Math.round(r.s1.propKg)).toBe(Math.round(SATURN.stages![0].prop_kg)); expect(Math.round(r.s3!.dryKg)).toBe(Math.round(SATURN.stages![2].dry_kg));
    expect(r.m0).toBeGreaterThan(2.9e6); expect(r.m0).toBeLessThan(3.0e6); expect(r.twr0).toBeGreaterThan(1.15); expect(r.twr0).toBeLessThan(1.3);
  });
  it("the autopilot reaches orbit with the Saturn V, through all three stages", () => {
    const f = flyAuto(createFlight(buildRocket(SATURN, SATURN.leo_capacity_kg * 0.6), RULES.easy, site, 1));
    expect(f.phase, f.failure ?? "").toBe("orbit");
    for (const k of ["meco", "sep", "ignition2", "meco2", "sep2", "ignition3"]) expect(f.milestones[k], k).toBeDefined();
    expect(f.milestones.ignition3).toBeGreaterThan(f.milestones.ignition2);
  });
  it("Moon mission (Cadet autopilot): parking orbit → TLI window → TLI → apogee at the Moon", () => {
    const f = flyAuto(moonFlight());
    expect(f.phase, f.failure ?? "").toBe("translunar");
    expect(f.milestones.orbit).toBeLessThan(f.milestones.tliStart); expect(f.milestones.tliStart).toBeLessThan(f.milestones.tli);
    expect(f.milestones.tliStart - f.milestones.orbit).toBeGreaterThan(1000); // you really wait for the window
    const apo = orbitElements(f.x, f.y, f.vx, f.vy).apo + 6.371e6;
    expect(apo / MOON_DIST_M()).toBeGreaterThan(TLI.tolLow); expect(apo / MOON_DIST_M()).toBeLessThan(TLI.tolHigh);
    expect(f.park!.fuel).toBeGreaterThan(0.4); // S-IVB still has most of its propellant for TLI
  });
  it("Pilot and Commander test pilots complete the Moon mission", () => {
    for (const d of ["medium", "hard"] as const) for (const siteIdx of [0, 2, 4]) {
      const f = flyWithBot(moonFlight(SATURN, d, 3, siteIdx)); expect(f.phase, `${d}@${siteIdx}: ${f.failure}`).toBe("translunar");
    }
  });
  it("small rockets cannot reach the Moon and the message points to the Saturn V", () => {
    const f = flyAuto(moonFlight(vehicle("Atlas V 401")));
    expect(f.phase).toBe("failed"); expect(f.failure).toMatch(/Saturn V/);
  });
  it("igniting TLI outside the window fails the mission (the Moon is not where the burn ends)", () => {
    const f = moonFlight(SATURN), i = defaultInput(f.rules); i.autopilot = false; i.upperGuidance = false;
    // fly the ascent on autopilot, then take over in parking orbit and ignite immediately
    const auto = defaultInput(f.rules);
    while (f.phase !== "parking" && f.phase !== "failed" && f.t < 2000) { stepFlight(f, auto); auto.stage = false; }
    expect(f.phase).toBe("parking");
    auto.autopilot = false; // hand over: pitch is held, TLI must be started by hand
    auto.restart = true; stepFlight(f, auto); auto.restart = false;
    expect(f.phase).toBe("tli"); expect(Math.abs(f.tliErr!)).toBeGreaterThan(TLI.windowFailRad);
  });
  it("a completed Moon mission scores more than reaching orbit alone", () => {
    const moon = scoreFlight(flyAuto(moonFlight())), orbit = scoreFlight(flyAuto(createFlight(buildRocket(SATURN, 80000), RULES.easy, site, 1)));
    expect(moon.ok && orbit.ok).toBe(true); expect(moon.score).toBeGreaterThan(orbit.score); expect(moon.max).toBe(1300);
  });
});

describe("cut and relight from the second stage onward", () => {
  /** Fly the Saturn V (autopilot) until the middle stage has been burning for `sec` seconds, then return the input to drive it by hand. */
  const toMiddleBurn = (sec = 25) => {
    const f = moonFlight(SATURN, "easy", 1), i = defaultInput(f.rules);
    let t0: number | null = null;
    while (f.phase !== "failed" && f.t < 2000) {
      if (f.stage === 2 && f.phase === "stage2" && f.engineOn) { t0 ??= f.t; if (f.t - t0 >= sec) break; }
      stepFlight(f, i); i.stage = false; i.cut = false; i.restart = false;
    }
    return { f, i };
  };
  it("the middle stage of the Saturn V can be cut and relit; fuel is only used while it burns", () => {
    const { f, i } = toMiddleBurn();
    expect(f.stage).toBe(2); expect(f.engineOn).toBe(true); expect(f.cuts2).toBe(0);
    i.cut = true; stepFlight(f, i); i.cut = false;
    expect(f.engineOn).toBe(false); expect(f.cuts2).toBe(1); expect(f.cutoffs).toBe(0); // the upper stage keeps its own restart budget
    const left = f.prop2; for (let k = 0; k < 200; k++) stepFlight(f, i);
    expect(f.prop2).toBeCloseTo(left, 3); expect(f.phase).not.toBe("failed");
    i.restart = true; stepFlight(f, i); i.restart = false;
    expect(f.engineOn).toBe(true); for (let k = 0; k < 100; k++) stepFlight(f, i);
    expect(f.prop2).toBeLessThan(left);
  });
  it("a restart needs a previous cut, and after a manual cut the stage can be separated with fuel left", () => {
    const { f, i } = toMiddleBurn();
    i.restart = true; stepFlight(f, i); i.restart = false; expect(f.cuts2).toBe(0); // already burning: nothing to relight
    i.cut = true; stepFlight(f, i); i.cut = false;
    const manual = { ...i, autopilot: false }; f.rules = { ...f.rules, autoStaging: false } as typeof f.rules;
    manual.stage = true; stepFlight(f, manual);
    expect(f.stage).toBe(3);
  });
});
