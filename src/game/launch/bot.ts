import { LAUNCH, defaultInput, guidancePitch, orbitElements, stepFlight, type Flight, type Input } from "./core";

/**
 * A "competent human" test pilot: follows the reference pitch cue with a reaction delay, throttles through max-Q,
 * stages and cuts the engine itself. Used by tests/balancing to prove each difficulty is winnable without the autopilot.
 */
export function flyWithBot(f: Flight, opts: { maxT?: number; reaction?: number } = {}): Flight {
  const input: Input = { ...defaultInput(f.rules), autopilot: false, upperGuidance: f.rules.autopilot === "upper" };
  const maxT = opts.maxT ?? 1800, lag = opts.reaction ?? 0.4;
  let cue = 90;
  while (f.phase !== "orbit" && f.phase !== "failed" && f.t < maxT) {
    cue += (guidancePitch(f) - cue) * Math.min(1, LAUNCH.dt / lag);
    input.pitchRate = Math.max(-1, Math.min(1, (cue - f.pitch) / (LAUNCH.pitchSlewDegS * 0.5)));
    const q = f.tel.q;
    const full = f.stage === 1 ? f.rocket.s1.thrustVacN : f.rocket.s2.thrustVacN;
    input.throttle = f.stage === 1 ? (q > LAUNCH.qDesignPa * 0.72 ? 0.7 : 1) : Math.max(0.36, Math.min(1, (3.5 * LAUNCH.g0 * f.m) / full));
    input.stage = f.stage === 1 && f.prop1 <= 0 && f.phase === "stage1" || (f.phase === "coast" && f.coastLeft <= 0);
    input.cut = false; input.restart = false;
    if (f.stage === 2 && f.engineOn) {
      const el = orbitElements(f.x, f.y, f.vx, f.vy), r = Math.hypot(f.x, f.y);
      const vc = Math.sqrt(LAUNCH_MU / r), vt = (f.vx * f.y - f.vy * f.x) / r, vr = (f.vx * f.x + f.vy * f.y) / r;
      if ((el.bound && el.peri / 1000 >= f.rules.minPerigeeKm + 12 && (el.apo - el.peri) / 1000 < 150) || (vt >= vc && Math.abs(vr) < 80)) input.cut = true;
    }
    stepFlight(f, input);
  }
  return f;
}
import { MU_E } from "./core";
const LAUNCH_MU = MU_E();
