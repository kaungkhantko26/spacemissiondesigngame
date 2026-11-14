import type { Evaluation } from "../engine";
import { OPS, addLog, isSunlit, rand, cruiseSeconds, type OpsState, type Phase } from "./core";

/**
 * Data-driven event system. Each event lists the phases it can occur in, a per-hour trigger rate that reads the live
 * simulation state and the spacecraft design, and 2–4 choices with visible immediate effects (hints) and some hidden
 * delayed consequences. `quality` (0 poor / 1 acceptable / 2 good) feeds the Operations score.
 */
export interface Choice {
  id: string; label: string; hint: string; quality: 0 | 1 | 2;
  /** Return a reason string when the choice is unavailable. */
  unavailable?: (n: OpsState, ev: Evaluation) => string | null;
  apply: (n: OpsState, ev: Evaluation) => string;
}
export interface EventDef {
  id: string; title: string; phases: Phase[]; once?: boolean; urgent?: boolean;
  description: (n: OpsState, ev: Evaluation) => string;
  /** Expected occurrences per simulated hour (use a huge value for "as soon as the condition holds"). */
  rate: (n: OpsState, ev: Evaluation) => number;
  choices: Choice[]; learn: string;
}
const NOW = 1e4;
const lose = (n: OpsState, why: string) => { n.phase = "lost"; n.stats.lossCause = why; addLog(n, "crit", why); };
const needDv = (m: number) => (n: OpsState) => (n.dvLeft < m ? `Needs ${m} m/s of Δv (only ${Math.round(n.dvLeft)} left).` : null);
const nextSunrise = (t: number) => Math.ceil(t / OPS.orbitPeriodS) * OPS.orbitPeriodS + 120;
const queue = (n: OpsState, at: number, kind: Parameters<typeof pushCmd>[2], arg?: number) => pushCmd(n, at, kind, arg);
function pushCmd(n: OpsState, at: number, kind: OpsState["queue"][number]["kind"], arg?: number) {
  n.queue = [...n.queue, { id: n.nextCmdId++, at, kind, arg }].sort((a, b) => a.at - b.at);
}

export const EVENTS: EventDef[] = [
  {
    id: "launch-engine-temp", title: "Engine temperature rising", phases: ["ascent"], once: true, urgent: true,
    description: () => "150 seconds into ascent, engine 3 chamber temperature is 6 % above its limit and still climbing.",
    rate: (n) => (n.flags.launchAnomaly && n.phaseT >= 140 ? NOW : 0),
    learn: "Engines are throttled to keep turbine and chamber temperatures inside limits. Lower thrust costs time and Δv (gravity losses), but protects the vehicle.",
    choices: [
      { id: "throttle", label: "Throttle down 5 %", hint: "Safe. Costs about 35 m/s of Δv.", quality: 2, apply: (n) => { n.dvLeft -= 35; return "Temperatures stabilised. The longer burn cost ~35 m/s of Δv."; } },
      { id: "continue", label: "Keep full thrust", hint: "30 % chance of losing the engine.", quality: 0, apply: (n) => { if (rand(n) < 0.3) { lose(n, "Engine failure during ascent."); return "Engine 3 failed. The vehicle was lost."; } return "Temperatures peaked, then fell. You got lucky."; } },
      { id: "stage", label: "Stage early", hint: "10 % loss risk, costs 60 m/s.", quality: 1, apply: (n) => { n.dvLeft -= 60; if (rand(n) < 0.1) { lose(n, "Early staging failed."); return "Staging failed. The vehicle was lost."; } return "Early staging worked; you gave up ~60 m/s."; } },
    ],
  },
  {
    id: "antenna-deploy", title: "Antenna deployment problem", phases: ["cruise"], once: true,
    description: (_n, ev) => `The ${ev.antenna.name} did not lock after unfolding. Larger dishes are more complex to deploy.`,
    rate: (n) => (n.flags.antennaRoll && n.phaseT >= 7200 ? NOW : 0),
    learn: "Deployables are classic single-point failures. A stuck antenna still works at a fraction of its gain through its feed horn.",
    choices: [
      { id: "retry", label: "Retry deployment", hint: "70 % to succeed. Costs $2M of operations budget.", quality: 1, apply: (n) => { n.stats.spentUsd += 2e6; if (rand(n) < 0.7) return "The antenna latched on the second attempt."; n.flags.commsMult = 0.4; return "Still stuck. Data rate permanently reduced to 40 %."; } },
      { id: "wiggle", label: "Wiggle with thrusters", hint: "55 % to succeed. Uses 8 m/s of Δv.", quality: 1, unavailable: needDv(8), apply: (n) => { n.dvLeft -= 8; if (rand(n) < 0.55) return "A gentle attitude shake freed the hinge."; n.flags.commsMult = 0.4; return "No luck. Data rate permanently reduced to 40 %."; } },
      { id: "accept", label: "Accept reduced gain", hint: "Free, but data rate drops to 40 %.", quality: 0, apply: (n) => { n.flags.commsMult = 0.4; return "You will downlink at 40 % of the planned rate."; } },
    ],
  },
  {
    id: "nav-error", title: "Navigation error", phases: ["cruise"], once: true,
    description: () => "Tracking shows the trajectory is drifting. Without a correction the lunar-orbit insertion will be off target.",
    rate: (n, ev) => (n.flags.navRoll && n.phaseT >= 0.45 * cruiseSeconds(ev) ? NOW : 0),
    learn: "Small velocity errors grow with distance. A correction burn is cheapest early, when its leverage on the arrival point is greatest.",
    choices: [
      { id: "now", label: "Correct now", hint: "Cheap: 22 m/s.", quality: 2, unavailable: needDv(22), apply: (n) => { n.dvLeft -= 22; n.flags.navError = false; return "Trajectory corrected with a 22 m/s burn."; } },
      { id: "later", label: "Correct later", hint: "Costs 45 m/s but keeps time free.", quality: 1, unavailable: needDv(45), apply: (n) => { n.dvLeft -= 45; n.flags.navError = false; return "A later, larger burn (45 m/s) fixed the error."; } },
      { id: "ignore", label: "Ignore it", hint: "Free now. Insertion will need extra Δv and may miss.", quality: 0, apply: (n) => { n.flags.navError = true; return "Left uncorrected. The insertion burn is now risky."; } },
    ],
  },
  {
    id: "solar-storm", title: "Solar storm warning", phases: ["cruise", "science"],
    description: () => "High-energy particles will reach the spacecraft in 18 minutes.",
    rate: (n) => (n.safe ? 0 : 1 / 900),
    learn: "Solar particle events can damage detectors and electronics. Safe mode protects them but costs science time; shielding mass bought during design makes storms survivable.",
    choices: [
      { id: "safe", label: "Enter safe mode", hint: "Protects everything. Science pauses until you resume.", quality: 2, apply: (n) => { enterSafe(n); return "Safe mode engaged. Resume operations after the storm passes."; } },
      { id: "shield", label: "Use design shielding", hint: "Only if you carried ≥15 % engineering margin. Science continues.", quality: 2, unavailable: (_n, ev) => (ev.design.marginPct >= 15 ? null : "Needs ≥15 % design margin."), apply: (n) => { n.health.instruments -= 0.02; n.flags.stormObserved = true; return "Margin mass absorbed the storm. Instruments lost only 2 %."; } },
      { id: "reorient", label: "Turn away from the Sun", hint: "Instruments −3 %, Earth link lost for 6 h.", quality: 1, apply: (n) => { n.health.instruments -= 0.03; n.flags.contactBlockedUntil = Math.max(n.flags.contactBlockedUntil, n.t + 6 * 3600); return "Instruments survived with minor damage. No downlink for 6 h."; } },
      { id: "observe", label: "Keep observing", hint: "Rare science, but instruments take heavy damage.", quality: 0, apply: (n, ev) => { n.health.instruments -= ev.design.marginPct >= 15 ? 0.1 : 0.25; n.flags.stormObserved = true; return "You recorded the storm, at a cost to the instruments."; } },
    ],
  },
  {
    id: "battery-overheat", title: "Battery overheating", phases: ["cruise", "science"],
    description: (n) => `Bus temperature is ${Math.round(n.tempC)} °C and the battery is above its comfort range.`,
    rate: (n) => (n.tempC > 52 ? 0.25 : 0),
    learn: "Batteries and instruments degrade quickly when hot. Reduce dissipated power or change attitude so radiators face cold sky.",
    choices: [
      { id: "shed", label: "Shed load for 6 h", hint: "Science off, spacecraft cools.", quality: 2, apply: (n) => { n.scienceOn = false; queue(n, n.t + 6 * 3600, "science-on"); return "Instruments powered down. Science resumes in 6 h."; } },
      { id: "reorient", label: "Point away from the Sun", hint: "Slews to nadir (10 min).", quality: 1, apply: (n) => { setPointing(n, "moon"); return "Arrays are off-sun, so heating drops (and so does charging)."; } },
      { id: "accept", label: "Accept the risk", hint: "No change. Battery health −10 %.", quality: 0, apply: (n) => { n.health.power -= 0.1; return "The battery aged faster than planned."; } },
    ],
  },
  {
    id: "wheel-saturation", title: "Reaction-wheel saturation", phases: ["science"],
    description: () => "The reaction wheels are near maximum speed and can no longer absorb disturbance torque.",
    rate: () => 1 / 250,
    learn: "Wheels store angular momentum. Thrusters (or magnetic torquers) must periodically 'desaturate' them, otherwise pointing drifts.",
    choices: [
      { id: "thrusters", label: "Desaturate with thrusters", hint: "6 m/s of Δv, 20 min of attitude work.", quality: 2, unavailable: needDv(6), apply: (n) => { n.dvLeft -= 6; n.slewLeft += 1200; return "Wheels unloaded. Pointing restored."; } },
      { id: "unload", label: "Slew to unload (free)", hint: "No fuel, but 8 h without observing or downlink.", quality: 1, apply: (n) => { n.slewLeft += 8 * 3600; return "Gravity-gradient unloading is slow but free."; } },
      { id: "ignore", label: "Ignore", hint: "Pointing error: science quality 70 % for 7 days.", quality: 0, apply: (n) => { n.flags.wheelBias = true; n.delayed = [...n.delayed, { at: n.t + 7 * 86400, effect: "wheel-bias-end" }]; return "Pointing jitter will blur your observations for a week."; } },
    ],
  },
  {
    id: "unexpected-target", title: "Unexpected science target", phases: ["science"], once: true,
    description: () => "Controllers spotted a strong magnetic anomaly just outside the planned ground track. The window lasts about two days.",
    rate: (n, ev) => (n.flags.targetRoll && n.t - n.sciT0 >= 0.33 * OPS.scienceDays * 86400 ? NOW : 0) * (ev.instruments.length > 0 ? 1 : 0),
    learn: "Good missions keep spare Δv and time for discoveries. Opportunity costs fuel, power or schedule.",
    choices: [
      { id: "retarget", label: "Adjust the orbit", hint: "15 m/s. Big bonus science and +5 % coverage.", quality: 2, unavailable: needDv(15), apply: (n) => { n.dvLeft -= 15; n.flags.bonusTarget = true; n.coverage = Math.min(1, n.coverage + 0.05); return "A small plane change put the anomaly under the instruments."; } },
      { id: "opportunistic", label: "Observe opportunistically", hint: "No fuel. 50 % chance to catch it.", quality: 1, apply: (n) => { if (rand(n) < 0.5) { n.flags.bonusTarget = true; return "The ground track brushed the anomaly: partial data captured."; } return "The pass was too far away."; } },
      { id: "ignore", label: "Stick to the plan", hint: "Safe and cheap. Bonus is missed.", quality: 1, apply: () => "You protected the baseline plan." },
    ],
  },
  {
    id: "storage-overflow", title: "Data storage nearly full", phases: ["science"],
    description: (n) => `Onboard storage is ${Math.round((n.dataGb / OPS.storageGb) * 100)} % full. New data will be discarded when it fills.`,
    rate: (n) => (n.dataGb > 0.85 * OPS.storageGb ? 0.33 : 0),
    learn: "Data is only valuable once it reaches Earth. Storage is a buffer: the downlink must drain it as fast as instruments fill it.",
    choices: [
      { id: "downlink", label: "Prioritise downlink", hint: "Point at Earth and pause science for 12 h.", quality: 2, apply: (n) => { setPointing(n, "earth"); n.scienceOn = false; queue(n, n.t + 12 * 3600, "point-moon"); queue(n, n.t + 12 * 3600 + 5, "science-on"); return "The recorder is draining. Observing resumes in 12 h."; } },
      { id: "delete", label: "Delete low-priority data", hint: "Frees 30 % immediately; that data is lost.", quality: 1, apply: (n) => { n.stats.lostGb += n.dataGb * 0.3; n.dataGb *= 0.7; return "You discarded 30 % of the stored data."; } },
      { id: "continue", label: "Keep going", hint: "Overflow data is simply lost.", quality: 0, apply: () => "New observations will overwrite nothing: they are dropped." },
    ],
  },
  {
    id: "eclipse-power", title: "Eclipse power shortage", phases: ["science"],
    description: (n) => `The battery is at ${Math.round((n.batteryWh / OPS.batteryWh) * 100)} % and the spacecraft is behind the Moon.`,
    rate: (n) => (!isSunlit(n.t) && n.batteryWh < 0.3 * OPS.batteryWh && !n.safe ? 1 : 0),
    learn: "In lunar eclipse the arrays make no power. Schedule high-draw activities in sunlight and size the battery for the eclipse.",
    choices: [
      { id: "shed", label: "Switch instruments off", hint: "Back on at sunrise.", quality: 2, apply: (n) => { n.scienceOn = false; queue(n, nextSunrise(n.t), "science-on"); return "Instruments off until the next sunrise."; } },
      { id: "safe", label: "Enter safe mode", hint: "Safest, but you must resume manually.", quality: 1, apply: (n) => { enterSafe(n); return "Safe mode engaged."; } },
      { id: "push", label: "Draw the battery down", hint: "40 % chance of a deep-discharge brownout.", quality: 0, apply: (n) => { if (rand(n) < 0.4) { n.batteryWh = 0; return "The battery hit empty."; } return "You squeaked through to sunrise."; } },
    ],
  },
  {
    id: "propulsion-anomaly", title: "Propulsion anomaly", phases: ["loi"], once: true, urgent: true,
    description: () => "Pressure in the propellant feed line dropped before the lunar-orbit-insertion burn. A valve may be leaking.",
    rate: (n) => (n.flags.propRoll ? NOW : 0),
    learn: "Never burn into a lunar orbit with a feed-line anomaly unexamined: insertion has no second chance without extra Δv.",
    choices: [
      { id: "isolate", label: "Isolate the valve", hint: "Loses 18 m/s of Δv. Burn is safe.", quality: 2, unavailable: needDv(18), apply: (n) => { n.dvLeft -= 18; return "The leaking branch was isolated."; } },
      { id: "wait", label: "Wait 6 h and analyse", hint: "8 m/s boil-off. Lower burn risk.", quality: 1, unavailable: needDv(8), apply: (n) => { n.dvLeft -= 8; n.flags.loiRisk = 0.1; return "Telemetry suggests a stuck sensor. Risk is lower."; } },
      { id: "burn", label: "Burn anyway", hint: "30 % extra chance the insertion fails.", quality: 0, apply: (n) => { n.flags.loiRisk = 0.3; return "You commit to the burn as-is."; } },
    ],
  },
  {
    id: "missed-contact", title: "Ground station outage", phases: ["science"],
    description: () => "The scheduled ground station went offline. Downlink passes are unavailable for about 14 hours.",
    rate: () => 1 / 120,
    learn: "Networks have limited coverage and outages. Spacecraft need storage margin and flexible schedules.",
    choices: [
      { id: "backup", label: "Switch to a backup station", hint: "Needs a ≥1 m dish. Outage drops to 4 h.", quality: 2, unavailable: (_n, ev) => (ev.antenna.dishM >= 1 ? null : "Patch antenna is too weak for the backup station."), apply: (n) => { n.flags.contactBlockedUntil = Math.max(n.flags.contactBlockedUntil, n.t + 4 * 3600); return "A larger station took over after 4 h."; } },
      { id: "wait", label: "Wait for the next pass", hint: "No downlink for 14 h.", quality: 1, apply: (n) => { n.flags.contactBlockedUntil = Math.max(n.flags.contactBlockedUntil, n.t + 14 * 3600); return "Passes resume in 14 h."; } },
      { id: "reduce", label: "Pause science while waiting", hint: "Science off 14 h to avoid filling storage.", quality: 1, apply: (n) => { n.flags.contactBlockedUntil = Math.max(n.flags.contactBlockedUntil, n.t + 14 * 3600); n.scienceOn = false; queue(n, n.t + 14 * 3600, "science-on"); return "You preserved storage margin and resume in 14 h."; } },
    ],
  },
];
export const eventById = (id: string) => EVENTS.find((e) => e.id === id);

/* ---- shared state helpers used by events and commands ---- */
export function setPointing(n: OpsState, p: OpsState["pointing"]) {
  if (n.pointing === p) return;
  n.pointing = p; n.slewLeft = Math.max(n.slewLeft, OPS.slewS);
}
export function enterSafe(n: OpsState) { n.safe = true; n.scienceOn = false; setPointing(n, "sun"); addLog(n, "warn", "Safe mode: science stopped, arrays pointed at the Sun."); }
