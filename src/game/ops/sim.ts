import { GAME } from "../data";
import type { Evaluation } from "../engine";
import {
  OPS, addLog, clamp, contactAt, cruiseSeconds, dataRateMbps, downlinkMbps, fmtMet, hasFields, instrumentPowerW, isSunlit, rand,
  type Command, type OpsState, type Phase,
} from "./core";
import { EVENTS, eventById, enterSafe, setPointing } from "./events";

export * from "./core";

export function createOps(ev: Evaluation, seed: number): OpsState {
  const n: OpsState = {
    t: 0, phase: "prelaunch", phaseT: 0, sciT0: 0,
    pointing: "sun", slewLeft: 0, scienceOn: false, safe: false,
    dvLeft: ev.dvAvailable, batteryWh: OPS.batteryWh, tempC: 15, dataGb: 0, dataQuality: 1, coverage: 0,
    health: { power: 1, comms: 1, instruments: 1, propulsion: 1 },
    flags: {
      launchAnomaly: false, antennaRoll: false, navRoll: false, propRoll: false, targetRoll: false, navError: false, wheelBias: false,
      commsMult: 1, contactBlockedUntil: 0, loiRisk: 0, bonusTarget: false, stormObserved: false, targetWindow: false,
    },
    stats: { generatedGb: 0, returnedGb: 0, usefulReturnedGb: 0, lostGb: 0, activeObsS: 0, downlinkS: 0, safeS: 0, blackouts: 0, scienceS: 0, decisions: [], spentUsd: 0, lossCause: null },
    powerGenW: 0, powerUseW: 0, linkMbps: 0, sunlit: true, contact: false, observing: false, downlinking: false,
    queue: [], nextCmdId: 1, log: [], delayed: [], event: null, fired: {}, lastEventAt: -1e9, rng: seed >>> 0,
  };
  // Design-dependent rolls are made once, up front, so a given design + seed replays identically.
  n.flags.launchAnomaly = rand(n) < 0.45;
  n.flags.antennaRoll = rand(n) < 0.08 + 0.04 * ev.antenna.dishM + (ev.design.marginPct < 8 ? 0.06 : 0);
  n.flags.navRoll = rand(n) < 0.7;
  n.flags.propRoll = rand(n) < 0.3 + (ev.electric ? 0 : 0.05);
  n.flags.targetRoll = rand(n) < 0.85;
  addLog(n, "info", "Mission Control online. All systems nominal for launch.");
  return n;
}

export function startLaunch(s: OpsState): OpsState {
  const n = { ...s };
  n.phase = "ascent"; n.phaseT = 0; n.t = 0;
  addLog(n, "good", "Liftoff!");
  return n;
}

/* ---------- commands ---------- */
export const CMD_LABEL: Record<Command["kind"], string> = {
  "point-earth": "Point at Earth (downlink)", "point-moon": "Point at Moon (observe)", "point-sun": "Point at Sun (charge)",
  "science-on": "Instruments ON", "science-off": "Instruments OFF", burn: "Orbit-correction burn", "safe-mode": "Enter safe mode", resume: "Resume from safe mode",
};
export function queueCommand(s: OpsState, kind: Command["kind"], at: number, arg?: number): OpsState {
  return { ...s, queue: [...s.queue, { id: s.nextCmdId, at, kind, arg }].sort((a, b) => a.at - b.at), nextCmdId: s.nextCmdId + 1 };
}
export const cancelCommand = (s: OpsState, id: number): OpsState => ({ ...s, queue: s.queue.filter((c) => c.id !== id) });

function execute(n: OpsState, c: Command) {
  switch (c.kind) {
    case "point-earth": case "point-moon": case "point-sun": setPointing(n, c.kind.slice(6) as OpsState["pointing"]); break;
    case "science-on":
      if (n.safe) { addLog(n, "warn", "Cannot enable science while in safe mode."); break; }
      n.scienceOn = true; break;
    case "science-off": n.scienceOn = false; break;
    case "burn": { const dv = Math.max(0, c.arg ?? 0); if (dv > n.dvLeft) addLog(n, "warn", `Burn rejected: needs ${dv} m/s, only ${Math.round(n.dvLeft)} m/s left.`); else { n.dvLeft -= dv; addLog(n, "info", `Orbit-correction burn executed (${dv} m/s).`); } break; }
    case "safe-mode": enterSafe(n); break;
    case "resume":
      if (n.batteryWh < 0.25 * OPS.batteryWh) addLog(n, "warn", "Resume denied: battery below 25 %. Let it charge first.");
      else { n.safe = false; addLog(n, "good", "Safe mode cleared."); }
      break;
  }
}
function runQueue(n: OpsState) {
  const due = n.queue.filter((c) => c.at <= n.t);
  if (!due.length) return;
  n.queue = n.queue.filter((c) => c.at > n.t);
  for (const c of due) execute(n, c);
}
function runDelayed(n: OpsState) {
  const due = n.delayed.filter((d) => d.at <= n.t);
  if (!due.length) return;
  n.delayed = n.delayed.filter((d) => d.at > n.t);
  for (const d of due) if (d.effect === "wheel-bias-end") { n.flags.wheelBias = false; addLog(n, "good", "Pointing jitter has settled."); }
}

/* ---------- physics ---------- */
function physics(n: OpsState, ev: Evaluation, dt: number) {
  const science = n.phase === "science";
  n.sunlit = science ? isSunlit(n.t) : true;
  n.contact = contactAt(n, n.t);
  if (n.slewLeft > 0) n.slewLeft = Math.max(0, n.slewLeft - dt);
  const ready = n.slewLeft <= 0 && !n.safe;
  n.observing = science && n.scienceOn && ready && n.pointing === "moon" && n.health.instruments > 0.15;
  n.downlinking = n.contact && ready && n.pointing === "earth" && n.health.comms > 0.1 && n.phase !== "ascent";

  const pf = n.pointing === "sun" ? 1 : n.pointing === "moon" ? 0.55 : 0.6;
  n.powerGenW = n.sunlit ? ev.powerGenW * OPS.arrayDerate * pf * n.health.power : 0;
  const instW = instrumentPowerW(ev);
  const heater = n.tempC < -15 ? 30 : 0;
  n.powerUseW = GAME.busPowerW + (n.observing ? instW : instW * 0.1) + (n.downlinking ? ev.antenna.txW / GAME.comms.amplifierEff : 5) + heater;
  const net = n.powerGenW - n.powerUseW;
  n.batteryWh = clamp(n.batteryWh + (net * dt) / 3600, 0, OPS.batteryWh);
  if (n.batteryWh <= 0 && net < 0 && !n.safe) {
    enterSafe(n); n.stats.blackouts++; addLog(n, "crit", "BROWNOUT: battery empty. Spacecraft entered safe mode.");
  }
  if (n.batteryWh < 0.08 * OPS.batteryWh) n.health.power = Math.max(0, n.health.power - (0.005 * dt) / 3600);

  // thermal: first-order response toward a target set by dissipation and sun exposure
  const target = 5 + 0.03 * n.powerUseW + (n.sunlit ? (n.pointing === "sun" ? 38 : 22) : -45);
  n.tempC += (target - n.tempC) * (1 - Math.exp(-dt / 2400));
  if (n.tempC > OPS.hotC) {
    const k = (n.tempC > OPS.safeHotC ? 0.03 : 0.008) * dt / 3600;
    n.health.instruments = Math.max(0, n.health.instruments - k); n.health.power = Math.max(0, n.health.power - k / 2);
  }
  if (n.tempC < OPS.coldC) n.health.comms = Math.max(0, n.health.comms - (0.004 * dt) / 3600);

  if (n.safe) n.stats.safeS += dt;
  if (science) n.stats.scienceS += dt;
  if (n.observing) {
    const q = n.health.instruments * (n.flags.wheelBias ? 0.7 : 1);
    n.coverage = Math.min(1, n.coverage + (dt / (OPS.coverageDays * 86400)) * q * (hasFields(ev) ? 1 : 0.3));
    const gb = (dataRateMbps(ev) * dt) / 8 / 1000;
    const added = Math.min(Math.max(0, OPS.storageGb - n.dataGb), gb);
    const total = n.dataGb + added;
    if (total > 0) n.dataQuality = (n.dataQuality * n.dataGb + q * added) / total;
    n.dataGb = total; n.stats.generatedGb += added; n.stats.lostGb += gb - added; n.stats.activeObsS += dt;
  }
  n.linkMbps = n.downlinking ? downlinkMbps(ev) * n.flags.commsMult * n.health.comms : 0;
  if (n.downlinking && n.dataGb > 0) {
    const gb = Math.min(n.dataGb, (n.linkMbps * dt) / 8 / 1000);
    n.dataGb -= gb; n.stats.returnedGb += gb; n.stats.usefulReturnedGb += gb * n.dataQuality; n.stats.downlinkS += dt;
  }
}

/* ---------- phases ---------- */
function setPhase(n: OpsState, p: Phase) { n.phase = p; n.phaseT = 0; }
function phaseLogic(n: OpsState, ev: Evaluation) {
  if (n.phase === "ascent" && n.phaseT >= OPS.ascentS) {
    if (rand(n) > ev.probabilities.launch) { n.phase = "lost"; n.stats.lossCause = `${ev.vehicle.name} launch failure.`; addLog(n, "crit", "Launch failure. Vehicle lost."); return; }
    n.dvLeft -= ev.plan.departureDv; setPhase(n, "cruise");
    addLog(n, "good", "Parking orbit reached; trans-lunar injection burn complete. Coasting to the Moon.");
  } else if (n.phase === "cruise" && n.phaseT >= cruiseSeconds(ev)) {
    setPhase(n, "loi"); addLog(n, "info", "Arrived at the Moon. Preparing the orbit-insertion burn.");
  } else if (n.phase === "loi") {
    const need = ev.plan.captureDv + (n.flags.navError ? 60 : 0);
    if (n.dvLeft < need) { n.phase = "lost"; n.stats.lossCause = "Not enough Δv left for lunar-orbit insertion."; addLog(n, "crit", `Insertion burn needs ${Math.round(need)} m/s but only ${Math.round(n.dvLeft)} m/s remain. Flyby.`); return; }
    const pFail = (n.flags.navError ? 0.4 : 0) + (1 - ev.probabilities.insertion) * 0.5 + (1 - n.health.propulsion) * 0.5 + n.flags.loiRisk;
    if (rand(n) < pFail) { n.phase = "lost"; n.stats.lossCause = "Lunar-orbit insertion failed."; addLog(n, "crit", "Insertion burn failed. The spacecraft flew past the Moon."); return; }
    n.dvLeft -= need; setPhase(n, "science"); n.sciT0 = n.t; n.pointing = "sun"; n.scienceOn = false;
    addLog(n, "good", "Lunar orbit achieved! Point at the Moon, switch instruments on and plan your downlinks.");
  } else if (n.phase === "science" && n.t - n.sciT0 >= OPS.scienceDays * 86400) {
    setPhase(n, "complete"); addLog(n, "good", `Prime mission complete at ${fmtMet(n.t)}.`);
  }
}

/* ---------- events ---------- */
function maybeEvent(n: OpsState, ev: Evaluation, dt: number) {
  if (n.event || n.phase === "prelaunch" || n.phase === "complete" || n.phase === "lost") return;
  for (const def of EVENTS) {
    if (!def.phases.includes(n.phase) || (def.once && n.fired[def.id])) continue;
    if (!def.urgent && n.t - n.lastEventAt < 6 * 3600) continue;
    const rate = def.rate(n, ev);
    if (rate <= 0) continue;
    if (rand(n) < 1 - Math.exp((-rate * dt) / 3600)) {
      n.event = { id: def.id, at: n.t }; n.fired = { ...n.fired, [def.id]: (n.fired[def.id] ?? 0) + 1 };
      addLog(n, "warn", `EVENT: ${def.title}`);
      return;
    }
  }
}

export function step(s: OpsState, ev: Evaluation, dt: number): OpsState {
  if (s.phase === "prelaunch" || s.phase === "complete" || s.phase === "lost" || s.event) return s;
  const n: OpsState = { ...s, health: { ...s.health }, flags: { ...s.flags }, stats: { ...s.stats }, queue: [...s.queue], delayed: [...s.delayed] };
  n.t += dt; n.phaseT += dt;
  runQueue(n); runDelayed(n);
  physics(n, ev, dt);
  phaseLogic(n, ev);
  maybeEvent(n, ev, dt);
  return n;
}

/** Advance by `dt` simulated seconds in ≤60 s substeps; stops early when an event needs the player. */
export function advance(s: OpsState, ev: Evaluation, dt: number): OpsState {
  let cur = s, left = dt;
  while (left > 1e-9 && !cur.event && cur.phase !== "complete" && cur.phase !== "lost") {
    const d = Math.min(60, left); cur = step(cur, ev, d); left -= d;
  }
  return cur;
}

export function resolveEvent(s: OpsState, ev: Evaluation, choiceId: string): OpsState {
  if (!s.event) return s;
  const def = eventById(s.event.id), choice = def?.choices.find((c) => c.id === choiceId);
  if (!def || !choice || choice.unavailable?.(s, ev)) return s;
  const n: OpsState = { ...s, health: { ...s.health }, flags: { ...s.flags }, stats: { ...s.stats }, queue: [...s.queue], delayed: [...s.delayed] };
  const msg = choice.apply(n, ev);
  n.health.instruments = clamp(n.health.instruments, 0, 1); n.health.power = clamp(n.health.power, 0, 1);
  n.stats.decisions = [...n.stats.decisions, { eventId: def.id, choiceId, quality: choice.quality, t: n.t }];
  addLog(n, choice.quality === 0 ? "warn" : "good", `${def.title}: ${msg}`);
  n.event = null; n.lastEventAt = n.t;
  return n;
}

/** Beginner assist: schedule observing, plus a downlink pass for each ground-station window in the next 24 h. */
export function planNextDay(s: OpsState): Command[] {
  const out: Omit<Command, "id">[] = [];
  const t0 = s.t, end = s.t + 86400;
  let inWin = false, a = 0;
  const wins: [number, number][] = [];
  for (let t = t0; t <= end; t += 120) {
    const c = contactAt(s, t);
    if (c && !inWin) { inWin = true; a = t; }
    if ((!c || t + 120 > end) && inWin) { inWin = false; if (t - a >= 1500) wins.push([a, t]); }
  }
  const picked = wins.filter((w, i) => i % 2 === 0 || s.dataGb > OPS.storageGb * 0.5).slice(0, 4);
  out.push({ at: t0 + 5, kind: "point-moon" }, { at: t0 + 10, kind: "science-on" });
  for (const w of picked) {
    out.push({ at: Math.max(t0 + 60, w[0] - OPS.slewS * 0.5), kind: "point-earth" }, { at: w[1] - 60, kind: "point-moon" });
  }
  let id = s.nextCmdId;
  return out.sort((x, y) => x.at - y.at).map((c) => ({ ...c, id: id++ }));
}
export function applyPlan(s: OpsState, cmds: Command[]): OpsState {
  return { ...s, queue: [...s.queue, ...cmds].sort((a, b) => a.at - b.at), nextCmdId: s.nextCmdId + cmds.length + 1 };
}

/* ---------- mission report ---------- */
export interface ReportObjective { id: string; label: string; required: boolean; met: boolean; detail: string }
export interface ReportCategory { id: string; label: string; score: number; why: string }
export interface Report {
  outcome: "success" | "partial" | "failure"; headline: string; objectives: ReportObjective[]; categories: ReportCategory[];
  total: number; grade: "S" | "A" | "B" | "C" | "D"; lessons: string[]; xp: number;
}
const pct = (x: number) => `${Math.round(x * 100)} %`;

export function buildReport(n: OpsState, ev: Evaluation): Report {
  const reachedOrbit = n.phase === "science" || n.phase === "complete";
  const days = n.stats.scienceS / 86400;
  const goalGb = OPS.goalDataGb;
  const returned = n.stats.usefulReturnedGb;
  const meanHealth = (n.health.power + n.health.comms + n.health.instruments + n.health.propulsion) / 4;
  const objectives: ReportObjective[] = [
    { id: "orbit", label: "Reach lunar orbit", required: true, met: reachedOrbit, detail: reachedOrbit ? "Orbit achieved." : n.stats.lossCause ?? "Did not reach lunar orbit." },
    { id: "mag", label: "Carry a magnetometer / fields instrument", required: true, met: hasFields(ev), detail: hasFields(ev) ? "Magnetometer aboard." : "No fields instrument: survey value is reduced to 30 %." },
    { id: "coverage", label: `Survey ≥ ${pct(OPS.goalCoverage)} of the surface`, required: true, met: n.coverage >= OPS.goalCoverage, detail: `Coverage ${pct(n.coverage)} after ${days.toFixed(1)} science days.` },
    { id: "data", label: `Return ≥ ${goalGb} GB of useful data`, required: true, met: returned >= goalGb, detail: `${returned.toFixed(1)} GB useful data reached Earth.` },
    { id: "stretch", label: `Bonus: return ≥ ${OPS.stretchDataGb} GB`, required: false, met: returned >= OPS.stretchDataGb, detail: `${returned.toFixed(1)} GB returned.` },
    { id: "health", label: "Bonus: finish with ≥ 60 % spacecraft health", required: false, met: reachedOrbit && meanHealth >= 0.6, detail: `Average health ${pct(meanHealth)}.` },
    { id: "target", label: "Bonus: observe the unexpected anomaly", required: false, met: n.flags.bonusTarget, detail: n.flags.bonusTarget ? "Anomaly observed." : "Anomaly was not observed." },
  ];
  const required = objectives.filter((o) => o.required);
  const reqMet = required.filter((o) => o.met).length;
  const outcome: Report["outcome"] = reqMet === required.length && n.phase === "complete" ? "success" : reachedOrbit && reqMet >= 2 ? "partial" : "failure";

  const dq = n.stats.decisions;
  const opsQ = dq.length ? dq.reduce((a, d) => a + d.quality, 0) / (2 * dq.length) : 0.7;
  const totalSci = Math.max(1, n.stats.scienceS);
  const lostShare = n.stats.generatedGb + n.stats.lostGb > 0 ? n.stats.lostGb / (n.stats.generatedGb + n.stats.lostGb) : 0;
  const generated = n.stats.generatedGb;
  const returnedShare = generated > 0 ? n.stats.returnedGb / generated : 0;
  const budgetUsed = (ev.costUsd + n.stats.spentUsd) / ev.destination.budgetUsd;
  const cat = (id: string, label: string, score: number, why: string): ReportCategory => ({ id, label, score: Math.round(clamp(score, 0, 100)), why });
  const categories: ReportCategory[] = [
    cat("mission", "Mission success", (reqMet / required.length) * 70 + (reachedOrbit ? Math.min(30, (n.coverage / OPS.goalCoverage) * 30) : 0),
      `${reqMet} of ${required.length} required objectives met; coverage ${pct(n.coverage)}.`),
    cat("science", "Science return", (returned / (goalGb * 1.5)) * 100,
      `${returned.toFixed(1)} GB of useful data returned from ${generated.toFixed(1)} GB recorded (${pct(returnedShare)} downlinked${lostShare > 0.02 ? `, ${pct(lostShare)} lost to full storage` : ""}).`),
    cat("engineering", "Engineering", meanHealth * 100 - n.stats.blackouts * 8,
      `Average health ${pct(meanHealth)}; ${n.stats.blackouts} brownout${n.stats.blackouts === 1 ? "" : "s"}; antenna gain ${pct(n.flags.commsMult)}.`),
    cat("efficiency", "Efficiency", 40 * clamp(1 - budgetUsed, 0, 1) + 30 * clamp(n.dvLeft / Math.max(1, ev.dvAvailable * 0.1), 0, 1) + 30 * (1 - lostShare),
      `Budget used ${pct(budgetUsed)}; ${Math.round(n.dvLeft)} m/s of Δv left; ${pct(1 - lostShare)} of recorded data kept.`),
    cat("operations", "Operations", opsQ * 70 + (1 - n.stats.safeS / totalSci) * 30,
      `${dq.length} decision${dq.length === 1 ? "" : "s"} averaged ${pct(opsQ)} quality; safe mode ${pct(n.stats.safeS / totalSci)} of science time.`),
    cat("safety", "Safety", dq.length ? (dq.filter((d) => d.quality >= 1).length / dq.length) * 100 : 80,
      `${dq.filter((d) => d.quality >= 1).length} of ${dq.length} anomalies handled safely.`),
    cat("bonus", "Bonus", (objectives.filter((o) => !o.required && o.met).length / 3) * 100, `${objectives.filter((o) => !o.required && o.met).length} of 3 optional objectives met.`),
  ];
  const w: Record<string, number> = { mission: 0.3, science: 0.2, engineering: 0.15, efficiency: 0.1, operations: 0.1, safety: 0.05, bonus: 0.1 };
  const total = Math.round(categories.reduce((a, c) => a + c.score * w[c.id], 0) * (outcome === "failure" ? 0.5 : 1));
  const grade = total >= 90 ? "S" : total >= 78 ? "A" : total >= 62 ? "B" : total >= 45 ? "C" : "D";

  const lessons: string[] = [];
  if (!reachedOrbit) lessons.push(`${n.stats.lossCause ?? "The mission was lost before reaching orbit."} Review Δv margin, launch reliability and how you handled anomalies.`);
  if (reachedOrbit && returned < goalGb) lessons.push(returnedShare < 0.5 ? `Only ${pct(returnedShare)} of recorded data was downlinked. ${ev.antenna.name} limited the rate to ${(downlinkMbps(ev) * n.flags.commsMult).toFixed(1)} Mbps — a larger antenna, or more time pointed at Earth during ground-station passes, would help.` : "Not enough observing time: schedule instruments on whenever you are pointed at the Moon.");
  if (lostShare > 0.02) lessons.push(`${pct(lostShare)} of the data was lost because storage filled up. Downlink before the recorder is 85 % full.`);
  if (n.stats.blackouts > 0) lessons.push("A brownout means the battery ran flat in eclipse. Switch instruments off before sunset or fly a bigger battery/array.");
  if (n.health.instruments < 0.6) lessons.push("Instrument health fell below 60 % (heat or radiation). Safe mode and cooler attitudes protect detectors.");
  if (!lessons.length) lessons.push("Clean mission. Try a cheaper or lighter design and see how far you can push the margins.");

  const headline =
    outcome === "success" ? `Full success: ${pct(n.coverage)} of the Moon surveyed and ${returned.toFixed(0)} GB returned.`
      : outcome === "partial" ? `Partial success: ${pct(n.coverage)} surveyed, but only ${returned.toFixed(0)} of the ${goalGb} GB goal reached Earth.`
        : `Mission failed: ${n.stats.lossCause ?? "science goals were not achieved."}`;
  return { outcome, headline, objectives, categories, total, grade, lessons, xp: Math.round(total * 5) };
}
