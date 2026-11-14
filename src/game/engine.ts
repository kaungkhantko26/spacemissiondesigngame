import { OPS } from "./ops/core";
import { OPS_DUTY } from "./ops/model";
import { ANTENNAS, DATASET, GAME, destinationById, instrumentById, launchReliability, vehicleById, type Antenna, type Destination, type Instrument, type Vehicle, type ElectricThruster } from "./data";
import { deltaV, linkRate, planTransfer, type TransferPlan } from "./physics";
import { opsPower, requiredObserveFrac, sustainableObserveFrac, type OpsPower } from "./ops/model";

export type PropulsionId = "chem" | string; // "chem" or an electric thruster id from the dataset
export interface Design {
  destinationId: string; vehicleId: string; propulsionId: PropulsionId; thrusters: number;
  propellantKg: number; solarAreaM2: number; rtgUnits: number; antennaId: string;
  instrumentIds: string[]; marginPct: number;
}
export type CheckState = "ok" | "warn" | "bad";
export interface Check { id: string; label: string; value: string; limit: string; state: CheckState; detail: string }
export interface Evaluation {
  design: Design; destination: Destination; vehicle: Vehicle; plan: TransferPlan; antenna: Antenna; instruments: Instrument[];
  electric: ElectricThruster | null; isp: number;
  dryKg: number; wetKg: number; dvRequired: number; dvAvailable: number; propellantNeededKg: number;
  powerGenW: number; solarGenW: number; rtgGenW: number; powerLoadW: number; ops: OpsPower; observeFrac: number; electricThrottle: number; linkBps: number; requiredBps: number; dataFraction: number;
  cruiseDays: number; costUsd: number; costBreakdown: Record<string, number>; science: number;
  probabilities: { launch: number; cruise: number; insertion: number; ops: number; mission: number };
  checks: Check[]; goNoGo: boolean;
}

export const DEFAULT_DESIGN: Design = {
  destinationId: "moon", vehicleId: "ll2_cfg_164", propulsionId: "chem", thrusters: 1, propellantKg: 800,
  solarAreaM2: 6, rtgUnits: 0, antennaId: "medium", instrumentIds: [], marginPct: 10,
};

const instrumentPower = (i: Instrument) => i.power_w ?? GAME.defaultInstrumentPowerW;
const instrumentKbps = (i: Instrument) => 2 + 4 * Math.sqrt(i.mass_kg);
const fmt = (n: number, d = 0) => n.toLocaleString("en-US", { maximumFractionDigits: d });
const usd = (n: number) => `$${fmt(n / 1e6)}M`;

/** Propellant that exactly meets the required delta-v (null when impossible, e.g. mass ratio too large for the tanks). */
export function solvePropellant(dryBaseKg: number, dv: number, isp: number): number | null {
  const R = Math.exp(dv / (isp * GAME.g0)), t = GAME.tankFraction;
  const denom = 1 + t - R * t;
  if (denom <= 0) return null;
  return (dryBaseKg * (R - 1)) / denom;
}

export function evaluate(d: Design): Evaluation {
  const destination = destinationById(d.destinationId) ?? destinationById("moon")!;
  const vehicle = vehicleById(d.vehicleId) ?? DATASET.vehicles[0];
  const antenna = ANTENNAS.find((a) => a.id === d.antennaId) ?? ANTENNAS[0];
  const electric = d.propulsionId === "chem" ? null : DATASET.electric_propulsion.find((e) => e.id === d.propulsionId) ?? null;
  const instruments = d.instrumentIds.map((id) => instrumentById(id)).filter((i): i is Instrument => !!i);
  const plan = planTransfer(destination);
  const n = electric ? d.thrusters : 1;
  const isp = electric ? electric.isp_s : GAME.chemical.isp_s;
  const prop = Math.max(0, d.propellantKg);

  // ---- Mass ----
  const instrumentKg = instruments.reduce((s, i) => s + i.mass_kg, 0);
  const powerKg = d.solarAreaM2 * GAME.solar.kgPerM2 + d.rtgUnits * GAME.rtg.kg;
  const propulsionKg = electric
    ? n * (GAME.electric.thrusterKg + (GAME.electric.ppuKgPerKw * electric.power_w) / 1000)
    : GAME.chemical.engineKg;
  const tankKg = prop * GAME.tankFraction;
  const subsystems = GAME.busBaseKg + instrumentKg + powerKg + antenna.massKg + propulsionKg;
  const structure = subsystems * GAME.structureFraction;
  const marginKg = (subsystems + structure) * (d.marginPct / 100);
  const dryBase = subsystems + structure + marginKg;
  const dryKg = dryBase + tankKg;
  const wetKg = dryKg + prop;

  // ---- Delta-v ----
  const dvRequired = plan.totalDv * GAME.dvMargin * (electric ? GAME.electric.spiralPenalty : 1);
  const dvAvailable = deltaV(isp, wetKg, dryKg);
  const propellantNeededKg = solvePropellant(dryBase, dvRequired, isp) ?? Infinity;

  // ---- Power ----
  const commsDrawW = (antenna.txW / GAME.comms.amplifierEff) * GAME.comms.duty;
  const powerLoadW = GAME.busPowerW + instruments.reduce((s, i) => s + instrumentPower(i), 0) + commsDrawW;
  const solarEff = GAME.solar.efficiency * GAME.solar.degradation;
  const solarGenW = plan.irradiance * d.solarAreaM2 * solarEff, rtgGenW = d.rtgUnits * GAME.rtg.watts;
  const powerGenW = solarGenW + rtgGenW;
  const solarAt1AuW = 1361 * d.solarAreaM2 * solarEff;
  const thrusterPowerW = electric ? n * electric.power_w : 0;

  // ---- Time ----
  // Ion thrusters are power-limited: average the solar power over the transfer (1 AU at departure → destination at arrival).
  const arrivalSolarW = plan.irradiance * d.solarAreaM2 * solarEff;
  const electricThrottle = electric ? Math.max(0.05, Math.min(1, ((solarAt1AuW + arrivalSolarW) / 2) / Math.max(1, thrusterPowerW + GAME.busPowerW))) : 1;
  const thrust = electric ? n * electric.thrust_n * electricThrottle : GAME.chemical.thrust_n;
  const burnDays = electric ? (dvRequired * ((wetKg + dryKg) / 2)) / thrust / 86400 : 0;
  const cruiseDays = plan.transferDays + burnDays * 0.5 + (electric ? 0 : 0);

  // ---- Link & science ----
  const linkBps = linkRate(antenna.dishM, antenna.txW, plan.linkDistanceM, antenna.maxBps);
  const requiredBps = instruments.reduce((s, i) => s + instrumentKbps(i) * 1000, 0);
  const dataFraction = requiredBps === 0 ? 0 : Math.min(1, linkBps / requiredBps);
  const seen = new Map<string, number>();
  let rawScience = 0;
  for (const i of instruments) {
    const k = seen.get(i.tag) ?? 0;
    seen.set(i.tag, k + 1);
    const wanted = destination.wants.includes(i.tag) ? GAME.wantedBonus : 1;
    rawScience += GAME.tagValue[i.tag] * wanted * Math.pow(GAME.duplicateTagFactor, k);
  }
  const science = rawScience * dataFraction;

  // ---- Operations readiness (same model Mission Control uses)
  const instKbps = instruments.reduce((a, i) => a + instrumentKbps(i), 0);
  const opsModel = opsPower({ solarW: solarGenW, rtgW: rtgGenW, instW: instruments.reduce((a, i) => a + instrumentPower(i), 0) * OPS.loadScale, txW: antenna.txW });
  const observeFrac = sustainableObserveFrac(instKbps, linkBps);
  const hasFieldsInst = instruments.some((i) => i.tag === "fields");

  // ---- Cost (launch price = dataset; the rest = game values) ----
  const dryNoTanks = dryKg - tankKg;
  const costBreakdown = {
    "Launch vehicle (dataset)": vehicle.launch_cost_usd,
    Spacecraft: dryNoTanks * GAME.busCostPerKg,
    Instruments: instrumentKg * GAME.instrumentCostPerKg,
    Power: d.solarAreaM2 * GAME.solar.costPerM2 + d.rtgUnits * GAME.rtg.cost,
    Propulsion: electric ? n * GAME.electric.costPerThruster : GAME.chemical.cost,
    Communications: antenna.cost,
    Operations: destination.opsDays * GAME.opsCostPerDay,
  };
  const costUsd = Object.values(costBreakdown).reduce((s, v) => s + v, 0);

  // ---- Reliability ----
  const dvMargin = dvRequired > 0 ? (dvAvailable - dvRequired) / dvRequired : 0;
  const launch = launchReliability(vehicle);
  const cruise = Math.min(0.995, 0.985 - 0.004 * instruments.length - (electric ? 0.01 : 0) - (d.rtgUnits > 0 ? 0.006 : 0) + 0.0012 * Math.min(d.marginPct, 25));
  const insertion = Math.min(0.99, 0.9 + Math.max(0, Math.min(0.08, dvMargin * 0.4)));
  const ops = Math.min(0.99, 0.95 + 0.02 * dataFraction + 0.0008 * Math.min(d.marginPct, 25));
  const probabilities = { launch, cruise, insertion, ops, mission: launch * cruise * insertion * ops };

  // ---- Design review ----
  const checks: Check[] = [];
  const add = (id: string, label: string, value: string, limit: string, state: CheckState, detail: string) => checks.push({ id, label, value, limit, state, detail });
  const capacity = vehicle.leo_capacity_kg;
  add("mass", "Launch mass", `${fmt(wetKg)} kg`, `≤ ${fmt(capacity)} kg`, wetKg > capacity ? "bad" : wetKg > capacity * 0.92 ? "warn" : "ok",
    wetKg > capacity ? `${vehicle.name} cannot lift this — pick a bigger rocket or cut mass.` : "Within the vehicle's stated LEO capacity (reference orbit not stated by the dataset).");
  add("dv", "Delta-v", `${fmt(dvAvailable)} m/s`, `≥ ${fmt(dvRequired)} m/s`, dvAvailable < dvRequired ? "bad" : dvMargin < 0.05 ? "warn" : "ok",
    dvAvailable < dvRequired ? "Not enough propulsion to reach and enter orbit — add propellant (try Auto-fill)." : "Enough to leave Earth and capture into orbit.");
  add("power", "Power", `${fmt(powerGenW)} W`, `≥ ${fmt(powerLoadW * 1.1)} W`, powerGenW < powerLoadW ? "bad" : powerGenW < powerLoadW * 1.1 ? "warn" : "ok",
    powerGenW < powerLoadW ? `Blackout at ${destination.name} (${fmt(plan.irradiance)} W/m² sunlight) — more array area or RTGs.` : "Generation covers the load at the destination.");
  if (electric) add("thruster-power", "Thruster power (at 1 AU)", `${fmt(solarAt1AuW)} W`, `≥ ${fmt(thrusterPowerW + GAME.busPowerW)} W`, solarAt1AuW < thrusterPowerW + GAME.busPowerW ? "bad" : "ok",
    solarAt1AuW < thrusterPowerW + GAME.busPowerW ? "Ion thrusters need solar arrays; RTGs are too weak." : electricThrottle < 0.999 ? `Thrust is power-limited along the transfer (average ${fmt(electricThrottle * 100)} % of rated; arrival sunlight ${fmt(plan.irradiance)} W/m²) — cruise time already accounts for it.` : "Arrays can drive the thrusters the whole way.");
  add("time", "Cruise time", `${fmt(cruiseDays)} d`, `≤ ${fmt(destination.deadlineDays)} d`, cruiseDays > destination.deadlineDays ? "bad" : cruiseDays > destination.deadlineDays * 0.85 ? "warn" : "ok",
    cruiseDays > destination.deadlineDays ? "Misses the mission deadline — add thrusters or use chemical propulsion." : "Arrives inside the mission window.");
  add("budget", "Budget", usd(costUsd), `≤ ${usd(destination.budgetUsd)}`, costUsd > destination.budgetUsd ? "bad" : costUsd > destination.budgetUsd * 0.95 ? "warn" : "ok",
    costUsd > destination.budgetUsd ? "Over budget — launch price is real data; other prices are game values." : "Funded.");
  add("payload", "Instruments", `${instruments.length}`, "≥ 1", instruments.length === 0 ? "bad" : "ok", instruments.length === 0 ? "A mission with no science is just expensive space junk." : `${instruments.length} real NASA instrument(s) aboard.`);
  if (destination.requires) {
    const has = instruments.some((i) => i.tag === destination.requires);
    add("contract", "Required payload", has ? `${destination.requires} instrument` : "missing", `${destination.requires} instrument`, has ? "ok" : "bad",
      has ? "Contract payload aboard." : `The ${destination.name} contract requires a ${destination.requires} instrument (e.g. a magnetometer); without one the survey cannot be completed.`);
  }
  if (instruments.length > 0 && destination.kind === "moon") { // the operations model (Mission Control) exists for the Moon
    const ratio = opsModel.avgLoad > 0 ? opsModel.avgGen / opsModel.avgLoad : 9;
    add("ops-power", "Sustained power (orbit avg)", `${fmt(opsModel.avgGen)} W in`, `≥ ${fmt(opsModel.avgLoad)} W out`, ratio < 1 ? "bad" : ratio < 1.15 ? "warn" : "ok",
      `Operating mix ${Math.round(OPS_DUTY.observe * 100)} % observing / ${Math.round(OPS_DUTY.downlink * 100)} % downlink, solar derated ${Math.round(OPS.arrayDerate * 100)} % for pointing, off in eclipse, RTG constant. Observing: ${fmt(opsModel.science.gen)} W in / ${fmt(opsModel.science.load)} W out · downlink: ${fmt(opsModel.downlink.gen)} W in / ${fmt(opsModel.downlink.load)} W out.${ratio < 1 ? " Add array area or RTGs." : ""}`);
    add("ops-battery", "Eclipse battery", `${fmt(opsModel.eclipseWh)} Wh`, `≤ ${fmt(opsModel.batteryUsableWh)} Wh`, opsModel.eclipseWh > opsModel.batteryUsableWh ? "bad" : opsModel.eclipseWh > opsModel.batteryUsableWh * 0.8 ? "warn" : "ok",
      opsModel.eclipseWh > opsModel.batteryUsableWh ? "The battery cannot carry the observing load through an eclipse — cut instrument power or add RTGs." : "Battery carries the load through the lunar eclipse.");
    const need = requiredObserveFrac(hasFieldsInst);
    add("ops-data", "Sustained observing (data)", `${fmt(observeFrac * 100)} %`, `≥ ${fmt(need * 100)} %`, observeFrac < need ? "bad" : observeFrac < need * 1.15 ? "warn" : "ok",
      observeFrac < need ? "The link cannot return the data the instruments record, so the survey cannot finish — bigger antenna or fewer/lower-rate instruments." : "Downlink keeps up with the survey data rate (counting ground-station windows).");
  }
  add("link", "Science data link", `${fmt(linkBps / 1000, 1)} kbps`, `${fmt(requiredBps / 1000, 1)} kbps wanted`, requiredBps > 0 && dataFraction < 0.5 ? "warn" : "ok",
    dataFraction < 1 && requiredBps > 0 ? `Only ${fmt(dataFraction * 100)} % of instrument data reaches Earth — bigger antenna or fewer instruments.` : "All instrument data can be downlinked.");
  if (prop <= 0) add("prop", "Propellant", "0 kg", "> 0", "bad", "No propellant loaded.");
  const goNoGo = checks.every((c) => c.state !== "bad");

  return {
    design: d, destination, vehicle, plan, antenna, instruments, electric, isp, dryKg, wetKg, dvRequired, dvAvailable, propellantNeededKg,
    powerGenW, solarGenW, rtgGenW, powerLoadW, ops: opsModel, observeFrac, electricThrottle, linkBps, requiredBps, dataFraction, cruiseDays, costUsd, costBreakdown, science, probabilities, checks, goNoGo,
  };
}

/* ---------- Launch simulation (seeded, replayable) ---------- */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export interface Phase { id: string; label: string; probability: number; passed: boolean; story: string }
export interface MissionResult { phases: Phase[]; success: boolean; reached: number; score: number; grade: "S" | "A" | "B" | "C" | "D"; scienceFraction: number; budgetBonus: number; headline: string }

const STORY = {
  launch: [["Liftoff and stage separation nominal.", "Anomaly on ascent — the vehicle was lost."]],
  cruise: [["Cruise: trajectory corrections on target.", "Spacecraft lost contact during cruise (subsystem fault)."]],
  insertion: [["Orbit insertion burn complete — captured!", "Insertion burn failed; the spacecraft flew past its target."]],
  ops: [["Science operations: data streaming home.", "Science phase cut short by an instrument fault."]],
} as const;

export function simulate(ev: Evaluation, seed: number): MissionResult {
  const rnd = mulberry32(seed);
  const p = ev.probabilities;
  const defs: [string, string, number, keyof typeof STORY][] = [
    ["launch", `Launch · ${ev.vehicle.name}`, p.launch, "launch"],
    ["cruise", `Cruise · ${fmt(ev.cruiseDays)} days`, p.cruise, "cruise"],
    ["insertion", `Orbit insertion · ${ev.destination.name}`, p.insertion, "insertion"],
    ["ops", `Science ops · ${fmt(ev.destination.opsDays)} days`, p.ops, "ops"],
  ];
  const phases: Phase[] = [];
  let alive = true;
  for (const [id, label, prob, key] of defs) {
    if (!alive) break;
    const passed = rnd() < prob;
    phases.push({ id, label, probability: prob, passed, story: STORY[key][0][passed ? 0 : 1] });
    alive = passed;
  }
  const reached = phases.filter((x) => x.passed).length;
  const success = reached === defs.length;
  const scienceFraction = Math.min(1, ev.science / ev.destination.scienceGoal);
  const budgetBonus = Math.max(0, Math.min(1, 1 - ev.costUsd / ev.destination.budgetUsd) * 2); // 0..1 (≥50 % under budget = max)
  const marginBonus = ev.design.marginPct >= 10 ? 1 : ev.design.marginPct / 10;
  const score = Math.round((reached / defs.length) * 300 + (success ? 200 + 300 * scienceFraction + 120 * budgetBonus + 80 * marginBonus : 0));
  const grade = score >= 900 ? "S" : score >= 750 ? "A" : score >= 550 ? "B" : score >= 300 ? "C" : "D";
  const headline = success
    ? scienceFraction >= 1 ? `Mission success — ${ev.destination.name} science goal exceeded!` : `Mission success — ${fmt(scienceFraction * 100)} % of the science goal met.`
    : `Mission lost during ${phases[phases.length - 1].label.split(" · ")[0].toLowerCase()}.`;
  return { phases, success, reached, score, grade, scienceFraction, budgetBonus, headline };
}

export const seedFromDesign = (d: Design, attempt: number) => {
  const s = JSON.stringify(d) + "#" + attempt;
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
};
