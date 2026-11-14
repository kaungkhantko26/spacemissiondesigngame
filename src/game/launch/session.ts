import { LAUNCH, buildRocket, createFlight, defaultInput, stepFlight, type Difficulty, type Flight, type Input, type MissionKind } from "./core";
import { RULES } from "./core";
import { DATASET, vehicleById } from "../data";

/** Default payload: orbit = a share of LEO capacity; Moon mission = the Apollo 11 spacecraft (Saturn V) or a lighter lunar payload for other rockets. */
export function payloadFor(v: { leo_capacity_kg: number; tli_payload_kg?: number }, frac: number, mission: MissionKind): number {
  if (mission === "moon") return v.tli_payload_kg ?? Math.round(v.leo_capacity_kg * frac * 0.45);
  return v.leo_capacity_kg * frac;
}
/** Real-time wrapper around a Flight: input state, held keys and time warp. Lives outside React; the UI polls it. */
export class LaunchSession {
  flight: Flight; input: Input; warp = 1; running = false; private acc = 0; held = { up: false, down: false };
  constructor(public difficulty: Difficulty, siteId: string, vehicleId: string, seed: number, payloadKg?: number, public mission: MissionKind = "orbit") {
    const rules = RULES[difficulty];
    const v = vehicleById(vehicleId) ?? DATASET.vehicles[0];
    const site = DATASET.launch_sites.find((s) => s.id === siteId) ?? DATASET.launch_sites[0];
    this.flight = createFlight(buildRocket(v, payloadKg ?? payloadFor(v, rules.payloadFrac, mission)), rules, site, seed, mission);
    this.input = defaultInput(rules);
  }
  get done() { return this.flight.phase === "orbit" || this.flight.phase === "translunar" || this.flight.phase === "failed"; }
  tick(dtReal: number) {
    if (!this.running || this.done) return;
    this.input.pitchRate = (this.held.up ? 1 : 0) - (this.held.down ? 1 : 0);
    // Fixed-step accumulator: simulated time advances exactly dtReal × warp on any display refresh rate.
    this.acc = Math.min(this.acc + dtReal * this.warp, LAUNCH.dt * 600); // cap catch-up work (e.g. after a hidden tab)
    const steps = Math.floor(this.acc / LAUNCH.dt + 1e-9);
    this.acc -= steps * LAUNCH.dt;
    for (let i = 0; i < steps && !this.done; i++) {
      stepFlight(this.flight, this.input);
      this.input.stage = false; this.input.cut = false; this.input.restart = false;
    }
  }
  hold(key: "up" | "down", on: boolean) { this.held[key] = on; }
  start() { this.running = true; }
  toggleRun() { this.running = !this.running; }
  setWarp(w: number) { this.warp = w; }
  /** Autopilot (easy) / upper-stage guidance (medium) toggle; hard has neither. */
  toggleAssist() { if (this.flight.rules.autopilot === "full") this.input.autopilot = !this.input.autopilot; else if (this.flight.rules.autopilot === "upper") this.input.upperGuidance = !this.input.upperGuidance; }
  setThrottle(v: number) { this.input.throttle = Math.min(1, Math.max(0, v)); }
  stage() { this.input.stage = true; }
  cut() { this.input.cut = true; }
  restart() { this.input.restart = true; }
}
