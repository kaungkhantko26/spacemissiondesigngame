import { describe, expect, it } from "vitest";
import { DATASET } from "@/game/data";
import { RULES, buildRocket, configureRocket, createFlight, defaultInput, idealDv, stepFlight } from "@/game/launch/core";
import { LaunchSession, payloadFor } from "@/game/launch/session";

const F9 = DATASET.vehicles.find((v) => v.name === "Falcon 9")!;
const base = () => buildRocket(F9, payloadFor(F9, RULES.easy.payloadFrac, "orbit"));

describe("Launch Control: configure the spacecraft", () => {
  it("full fuel and no throttle limit leave the rocket exactly as built", () => {
    const r = base(); expect(configureRocket(r, { fuelPct: 1, throttleCap: 1 })).toBe(r);
  });
  it("less fuel makes the rocket lighter and lowers its ideal delta-v", () => {
    const r = base(), c = configureRocket(r, { fuelPct: 0.8 });
    expect(c.m0).toBeLessThan(r.m0); expect(c.dvIdeal).toBeLessThan(idealDv(r)); expect(c.s1.propKg).toBeCloseTo(r.s1.propKg * 0.8, 3);
    expect(c.s1.dryKg).toBe(r.s1.dryKg); // structure does not shrink with the fuel
  });
  it("very little fuel cannot reach orbit: the flight ends short and fails with a reason", () => {
    const s = new LaunchSession("easy", "ll2_pad_87", F9.id, 1, undefined, "orbit", { fuelPct: 0.6 }); s.start();
    for (let i = 0; i < 60 * 900 && !s.done; i++) s.tick(1 / 60);
    expect(s.flight.phase).toBe("failed");
  });
  it("the throttle limit caps the engine throughout the flight and lowers liftoff thrust-to-weight", () => {
    const r = base(), c = configureRocket(r, { throttleCap: 0.7 });
    expect(c.twr0).toBeLessThan(r.twr0);
    const f = createFlight(c, RULES.hard, DATASET.launch_sites[0], 1), input = { ...defaultInput(f.rules), throttle: 1 };
    let maxThr = 0; for (let i = 0; i < 6000; i++) { stepFlight(f, input); if (f.engineOn) maxThr = Math.max(maxThr, f.throttle); }
    expect(maxThr).toBeLessThanOrEqual(0.7 + 1e-9); expect(maxThr).toBeGreaterThan(0.1);
  });
  it("the default configuration still reaches orbit on Cadet", () => {
    const s = new LaunchSession("easy", "ll2_pad_87", F9.id, 1); s.start();
    for (let i = 0; i < 60 * 900 && !s.done; i++) s.tick(1 / 60);
    expect(s.flight.phase).toBe("orbit");
  });
});
