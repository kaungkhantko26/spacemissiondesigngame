import type { Flight } from "./core";

export interface FailureCoach { title: string; why: string; steps: string[] }

/** Turns a failed flight into plain advice: what went wrong, and exactly what to do differently next time (with the keys). */
export function explainFailure(f: Flight): FailureCoach {
  const why = f.failure ?? "The mission did not reach its goal.";
  const t = f.t, atTime = `T+${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
  const manual = f.rules.autopilot !== "full";
  const cue = f.rules.guideCue ? "Follow the Cue line on the left: it shows the pitch to hold." : "No cue on this difficulty: keep the nose aligned with where you are going.";
  const auto = f.rules.autopilot === "full" ? ["Or press A to let the autopilot fly the climb, then learn from what it does."] : [];
  const has = (re: RegExp) => re.test(why);

  if (has(/dynamic pressure .* exceeded/i)) return { title: `Structural failure at max-Q (${atTime})`, why, steps: [
    "Max-Q is the moment of peak air pressure, around T+1:00 to T+1:30. The rocket is strongest when it flies slowly there.",
    "Watch the Dynamic pressure bar. When it climbs into yellow, press S a few times to cut the throttle to about 70%.",
    "Open the throttle again (W, or Shift+W for full) once the bar is falling.", ...auto] };
  if (has(/angle of attack|broke up/i)) return { title: `Vehicle broke up (${atTime})`, why, steps: [
    "The rocket must fly along its direction of travel. If the nose points too far off the airflow it is torn apart.",
    "Pitch over gradually with ↓: a few degrees at a time, never a sharp turn. Keep the Angle of attack bar green.",
    cue, ...auto] };
  if (has(/acceleration above|payload damaged/i)) return { title: "Too many g-forces on the payload", why, steps: [
    "As the upper stage burns fuel it gets lighter, so the same thrust pushes harder.",
    "Watch the G-load readout. Near 4 g, press S to lower the throttle and keep it under the limit.", ...auto] };
  if (has(/fell back and crashed/i)) return { title: "The rocket fell back to Earth", why, steps: [
    "The rocket needs sideways speed, not just height. Straight up always falls back down.",
    "Start pitching over with ↓ after the tower clears, and keep following the cue toward the horizon.", cue, ...auto] };
  if (has(/stage separation too early|upper stage fell back/i)) return { title: "Separated the stage too early", why, steps: [
    "Press Space for stage separation only when stage 1 fuel reaches 0%.", "Wait for the Stage button to light up: it is only available when it is safe.", ...auto] };
  if (has(/re-entered|cut the engine before/i)) return { title: "Engine cut too early", why, steps: [
    "X cuts the engine. Only cut when the orbit readout shows the lowest point above the target, and you are fast enough to stay up.",
    "If you cut too early, press R to restart the engine and keep burning.", ...auto] };
  if (has(/out of propellant/i)) return { title: "Ran out of fuel before reaching orbit", why, steps: [
    "Fuel is wasted by climbing straight up for too long, or by pitching over too late.",
    "Pitch over steadily from the start so the rocket gains sideways speed early (↓ gently).",
    cue, "Do not hold the throttle low for long: slow flying through the air wastes fuel.", ...auto] };
  if (has(/orbit too high|elongated/i)) return { title: "Orbit too high and stretched", why, steps: [
    "The engine kept burning too long. Press X to cut it as soon as the orbit readout reaches a low point above the target.",
    "A circular orbit needs the nose near the horizon at the end of the burn.", ...auto] };
  if (has(/off the TLI window/i)) return { title: "Missed the Moon window", why, steps: [
    "Wait in parking orbit. Use time warp (keys 1-5), then slow down when the window countdown nears zero.",
    "Press R (Ignite TLI) when the window reads 0, not before. Cadet difficulty does this for you."] };
  if (has(/TLI burn ran too long|overshoot|overspeed/i)) return { title: "Translunar burn ran too long", why, steps: [
    "Watch Apogee on the left during the burn. Press X to cut the engine when it reaches the Moon's distance (384,400 km).", ...auto] };
  if (has(/TLI/i) || has(/apogee/i)) return { title: "Translunar burn fell short", why, steps: [
    "Burn until Apogee on the left reaches the Moon's distance. If the stage runs out of fuel first, a lighter payload helps.", ...auto] };
  if (has(/time exceeded/i)) return { title: "Out of time", why, steps: [
    "Raise the time warp with keys 1-5 during the quiet parts, and keep the burn going: do not leave the engine off for long.", ...auto] };
  return { title: "Mission lost", why, steps: [manual ? "Re-read the controls with H, then fly again." : "Try the autopilot with A.", cue, ...auto] };
}
