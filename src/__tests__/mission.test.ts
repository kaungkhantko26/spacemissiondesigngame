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
