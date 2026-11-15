import { LAUNCH, MOON_DIST_M, MU_E, R_E, defaultInput, guidancePitch, orbitElements, stepFlight, tliWindowRemain, type Flight, type Input } from "./core";

/**
 * A "competent human" test pilot: follows the reference pitch cue with a reaction delay, throttles through max-Q,
 * stages and cuts the engine itself. Used by tests/balancing to prove each difficulty is winnable without the autopilot.
 */
export function flyWithBot(f: Flight, opts: { maxT?: number; reaction?: number } = {}): Flight {
  const input: Input = { ...defaultInput(f.rules), autopilot: false, upperGuidance: f.rules.autopilot === "upper" };
  const maxT = opts.maxT ?? (f.mission === "moon" ? 9000 : 1800), lag = opts.reaction ?? 0.4;
  let cue = 90;
  while (f.phase !== "orbit" && f.phase !== "translunar" && f.phase !== "failed" && f.t < maxT) {
    cue += (guidancePitch(f) - cue) * Math.min(1, LAUNCH.dt / lag);
    input.pitchRate = Math.max(-1, Math.min(1, (cue - f.pitch) / (LAUNCH.pitchSlewDegS * 0.5)));
    const q = f.tel.q;
    const spec = f.stage === 1 ? f.rocket.s1 : f.stage === 2 ? f.rocket.s2 : f.rocket.s3!, full = spec.thrustVacN;
    input.throttle = f.stage === 1 ? (q > LAUNCH.qDesignPa * 0.72 ? 0.7 : 1) : Math.max(0.36, Math.min(1, (3.5 * LAUNCH.g0 * f.m) / full));
    const upperPropGone = (f.stage === 1 && f.prop1 <= 0 && f.phase === "stage1") || (f.stage === 2 && !!f.rocket.s3 && f.prop2 <= 0 && f.phase === "stage2" && !f.engineOn);
    input.stage = upperPropGone || (f.phase === "coast" && f.coastLeft <= 0);
    input.cut = false; input.restart = false;
    const lastStage = f.rocket.s3 ? 3 : 2, r = Math.hypot(f.x, f.y);
    if (f.stage === lastStage && f.engineOn && f.phase === "stage2") {
      const el = orbitElements(f.x, f.y, f.vx, f.vy);
      const vc = Math.sqrt(MU_E() / r), vt = (f.vx * f.y - f.vy * f.x) / r, vr = (f.vx * f.x + f.vy * f.y) / r;
      if ((el.bound && el.peri / 1000 >= f.rules.minPerigeeKm + 12 && (el.apo - el.peri) / 1000 < 150) || (vt >= vc && Math.abs(vr) < 80)) input.cut = true;
    }
    if (f.phase === "parking" && tliWindowRemain(f) <= 0.02 && tliWindowRemain(f) > -1) input.restart = true; // ignite at the window
    if (f.phase === "tli" && f.engineOn) { const el = orbitElements(f.x, f.y, f.vx, f.vy); if (!el.bound || el.apo >= MOON_DIST_M() - R_E()) input.cut = true; }
    stepFlight(f, input);
  }
  return f;
}
