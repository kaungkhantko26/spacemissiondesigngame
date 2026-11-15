import { DATASET, bodyById, type LaunchSite, type Vehicle } from "../data";

/**
 * Ground-to-orbit ascent simulation (2-D, inertial frame, Earth-centred).
 * REAL inputs (dataset): Earth μ and radius, launch-site latitude + rotation boost, vehicle liftoff mass, liftoff thrust,
 * diameter, LEO capacity. GAME values (not in the dataset): Isp, stage split/structure, drag coefficient, atmosphere
 * model, structural limits, weather, failures — everything in `LAUNCH` below. Simplified and game-balanced.
 */
export const LAUNCH = {
  g0: 9.80665,
  rho0: 1.225, scaleHeightM: 8500, atmosphereTopM: 140_000, karmanM: 100_000,
  cd: 0.3,
  dvIdealMs: 10000,                      // ideal Δv at full LEO capacity (calibrates the stage split per vehicle)
  stage1: { ispSl: 285, ispVac: 315, share: 0.74, inert: 0.06, minThrottle: 0.5 },
  stage2: { ispVac: 345, twr: 1.4, inert: 0.09, minThrottle: 0.35 },
  fairingKg: 0, countdownS: 10, targetOrbitKm: 200,
  qDesignPa: 36_000,                     // design dynamic-pressure limit
  qAlphaDesign: 90_000,                  // design q·α limit (Pa·deg) ≈ 30 kPa × 3°
  twrMin: 1.2, twrMax: 1.6,              // liftoff thrust-to-weight is clamped to a flyable range
  upperMaxG: 3.5, gLimit: 6.5, gOverS: 3,
  pitchSlewDegS: 3, autopilotSlewDegS: 4,
  dt: 0.05,
} as const;

export type Difficulty = "easy" | "medium" | "hard";
export type AutopilotMode = "full" | "upper" | "none";
export interface Rules {
  id: Difficulty; name: string; tagline: string; autopilot: AutopilotMode; autoStaging: boolean; payloadFrac: number;
  minPerigeeKm: number; maxApogeeKm: number; qLimitFactor: number; aoaProtect: boolean; windMs: number;
  minorAnomalyChance: number; majorAnomalyChance: number; scoreMult: number; guideCue: boolean; bullets: string[];
}
export const RULES: Record<Difficulty, Rules> = {
  easy: {
    id: "easy", name: "Cadet", tagline: "Autopilot flies the climb — learn the sequence", autopilot: "full", autoStaging: true, payloadFrac: 0.6,
    minPerigeeKm: 120, maxApogeeKm: 900, qLimitFactor: 2.2, aoaProtect: true, windMs: 0, minorAnomalyChance: 0, majorAnomalyChance: 0, scoreMult: 1, guideCue: true,
    bullets: ["Autopilot controls pitch, throttle, staging and engine cutoff", "You can take manual control at any time (and hand it back)", "Calm weather, no equipment failures", "Payload is 60 % of the rocket's LEO capacity — lots of spare Δv", "Orbit counts when the lowest point is above 120 km", "Wide structural limits and angle-of-attack protection"],
  },
  medium: {
    id: "medium", name: "Pilot", tagline: "You fly stage 1; the upper-stage computer helps", autopilot: "upper", autoStaging: true, payloadFrac: 0.8,
    minPerigeeKm: 150, maxApogeeKm: 700, qLimitFactor: 1.5, aoaProtect: false, windMs: 15, minorAnomalyChance: 0.3, majorAnomalyChance: 0, scoreMult: 1.5, guideCue: true,
    bullets: ["You steer stage 1 (pitch keys) and set the throttle — throttle down through max-Q", "Upper-stage guidance can be switched on after staging", "Staging is automatic", "Upper-atmosphere winds and a 30 % chance of a minor engine anomaly", "Payload is 80 % of capacity", "Orbit counts when the lowest point is above 150 km", "Score ×1.5"],
  },
  hard: {
    id: "hard", name: "Commander", tagline: "Fully manual — no autopilot, real consequences", autopilot: "none", autoStaging: false, payloadFrac: 0.9,
    minPerigeeKm: 180, maxApogeeKm: 600, qLimitFactor: 1.25, aoaProtect: false, windMs: 30, minorAnomalyChance: 0.5, majorAnomalyChance: 0.3, scoreMult: 2.5, guideCue: false,
    bullets: ["No autopilot: you control pitch, throttle, staging and engine cutoff/restart", "You must trigger stage separation and ignite stage 2 yourself", "Strong jet-stream winds, 50 % minor + 30 % major engine anomalies", "Payload is 90 % of capacity — almost no Δv to waste", "Orbit counts only when the lowest point is above 180 km (apogee below 600 km)", "Tight structural limits: max-Q or angle-of-attack mistakes destroy the rocket", "No guidance cue. Score ×2.5"],
  },
};

/* ---------- Rocket model built from a dataset vehicle ---------- */
export interface StageSpec { propKg: number; dryKg: number; thrustSlN: number; thrustVacN: number; ispSl: number; ispVac: number; minThrottle: number }
export interface Rocket { name: string; diameterM: number; lengthM: number; m0: number; payloadKg: number; capacityKg: number; s1: StageSpec; s2: StageSpec; s3?: StageSpec; stageNames: string[]; /** share of the full height still flying after stage 1 / stage 2 separate (for the sprite) */ stageFrac: [number, number]; dvIdeal: number; twr0: number; vehicle: Vehicle; /** player-set limit on the engine throttle (1 = no limit) */ throttleCap?: number; /** share of the standard propellant loaded (1 = full) */ fuelLoad?: number }

const ln = Math.log;
function dvOf(m0: number, payload: number, a: number, k: number): { dv1: number; dv2: number; s1prop: number; s1dry: number; s2prop: number; s2dry: number } {
  const { stage1, stage2, g0 } = LAUNCH;
  const total = m0 - payload;
  const e1 = Math.min(0.5, stage1.inert * k), e2 = Math.min(0.6, stage2.inert * k);
  const s1tot = a * total, s2tot = (1 - a) * total;
  const s1prop = (1 - e1) * s1tot, s1dry = e1 * s1tot, s2prop = (1 - e2) * s2tot, s2dry = e2 * s2tot;
  const dv1 = ((stage1.ispSl + stage1.ispVac) / 2) * g0 * ln(m0 / (m0 - s1prop));
  const m2 = s2tot + payload;
  const dv2 = stage2.ispVac * g0 * ln(m2 / (m2 - s2prop));
  return { dv1, dv2, s1prop, s1dry, s2prop, s2dry };
}

/** The real Saturn V from the dataset: verified stage masses + F-1/J-2 thrust (Isp values are game values: F-1 263/304 s, J-2 421 s). */
function buildSaturn(v: Vehicle, payloadKg: number): Rocket {
  const [ic, ii, ivb] = v.stages!, g0 = LAUNCH.g0;
  const refPayload = v.tli_payload_kg ?? 43_904, m0Ref = (v.launch_mass_t ?? 2970) * 1000;
  const extra = Math.max(0, m0Ref - (ic.dry_kg + ic.prop_kg + ii.dry_kg + ii.prop_kg + ivb.dry_kg + ivb.prop_kg + refPayload)); // interstages, escape tower
  const m0 = ic.dry_kg + ic.prop_kg + ii.dry_kg + ii.prop_kg + ivb.dry_kg + ivb.prop_kg + payloadKg + extra;
  const t1 = (v.liftoff_thrust_kn ?? ic.engines * ic.engine_thrust_n / 1000) * 1000;
  const iiVac = ii.engines * ii.engine_thrust_n, ivbVac = ivb.engines * ivb.engine_thrust_n;
  const s1: StageSpec = { propKg: ic.prop_kg, dryKg: ic.dry_kg + extra, thrustSlN: t1, thrustVacN: t1 * (304 / 263), ispSl: 263, ispVac: 304, minThrottle: 0.8 };
  const s2: StageSpec = { propKg: ii.prop_kg, dryKg: ii.dry_kg, thrustSlN: iiVac * 0.92, thrustVacN: iiVac, ispSl: 360, ispVac: 421, minThrottle: 0.6 };
  const s3: StageSpec = { propKg: ivb.prop_kg, dryKg: ivb.dry_kg, thrustSlN: ivbVac * 0.9, thrustVacN: ivbVac, ispSl: 360, ispVac: 421, minThrottle: 0.35 };
  const m2 = m0 - ic.prop_kg - s1.dryKg, m3 = ivb.dry_kg + ivb.prop_kg + payloadKg;
  const dv = ((263 + 304) / 2) * g0 * ln(m0 / (m0 - ic.prop_kg)) + 421 * g0 * ln(m2 / (m2 - ii.prop_kg)) + 421 * g0 * ln(m3 / (m3 - ivb.prop_kg));
  return {
    name: v.name, diameterM: v.diameter_m ?? 10.1, lengthM: v.length_m ?? 110.6, m0, payloadKg, capacityKg: v.leo_capacity_kg, vehicle: v, s1, s2, s3,
    stageNames: ["S-IC", "S-II", "S-IVB"], stageFrac: [0.62, 0.39], dvIdeal: dv, twr0: t1 / (m0 * g0),
  };
}

export function buildRocket(v: Vehicle, payloadKg: number): Rocket {
  if (v.stages?.length === 3) return buildSaturn(v, payloadKg);
  let m0 = (v.launch_mass_t ?? v.leo_capacity_kg / 0.04 / 1000) * 1000;
  const cap = v.leo_capacity_kg;
  // The dataset's liftoff mass/thrust pairs are not always self-consistent (e.g. strap-on variants); clamp to a flyable T/W.
  let t1 = (v.liftoff_thrust_kn ?? (m0 * LAUNCH.g0 * 1.35) / 1000) * 1000;
  if (t1 / (m0 * LAUNCH.g0) < LAUNCH.twrMin) m0 = t1 / (LAUNCH.twrMin * LAUNCH.g0);
  if (t1 / (m0 * LAUNCH.g0) > LAUNCH.twrMax) t1 = LAUNCH.twrMax * m0 * LAUNCH.g0;
  // Calibrate structural fraction (k) so the ideal Δv at full capacity equals dvIdealMs.
  let lo = 0.3, hi = 4;
  for (let i = 0; i < 50; i++) { const mid = (lo + hi) / 2; const r = dvOf(m0, cap, LAUNCH.stage1.share, mid); if (r.dv1 + r.dv2 > LAUNCH.dvIdealMs) lo = mid; else hi = mid; }
  const k = (lo + hi) / 2;
  const split = dvOf(m0, payloadKg, LAUNCH.stage1.share, k);
  const { stage1, stage2, g0 } = LAUNCH;
  const m2start = split.s2prop + split.s2dry + payloadKg;
  const t2 = stage2.twr * m2start * g0;
  return {
    name: v.name, diameterM: v.diameter_m ?? 3, lengthM: v.length_m ?? 40, m0, payloadKg, capacityKg: cap, vehicle: v,
    s1: { propKg: split.s1prop, dryKg: split.s1dry, thrustSlN: t1, thrustVacN: t1 * (stage1.ispVac / stage1.ispSl), ispSl: stage1.ispSl, ispVac: stage1.ispVac, minThrottle: stage1.minThrottle },
    s2: { propKg: split.s2prop, dryKg: split.s2dry, thrustSlN: t2 * 0.9, thrustVacN: t2, ispSl: stage2.ispVac * 0.85, ispVac: stage2.ispVac, minThrottle: stage2.minThrottle },
    stageNames: ["Stage 1", "Stage 2"], stageFrac: [0.38, 0.38], dvIdeal: split.dv1 + split.dv2, twr0: t1 / (m0 * g0),
  };
}

/** Ideal (no gravity or drag loss) delta-v of the stack as loaded: each stage burns its propellant while carrying everything above it. */
export function idealDv(r: Rocket): number {
  const stages = [r.s1, r.s2, ...(r.s3 ? [r.s3] : [])], g0 = LAUNCH.g0;
  let above = r.payloadKg, dv = 0;
  const starts: number[] = [];
  for (let i = stages.length - 1; i >= 0; i--) { above += stages[i].dryKg + stages[i].propKg; starts[i] = above; }
  stages.forEach((st, i) => { const isp = i === 0 ? (st.ispSl + st.ispVac) / 2 : st.ispVac; dv += isp * g0 * Math.log(starts[i] / (starts[i] - st.propKg)); });
  return dv;
}
/** Player configuration: load less propellant (lighter rocket, less delta-v) and/or limit the throttle. 1 and 1 leave the rocket exactly as built. */
export function configureRocket(r: Rocket, cfg: { fuelPct?: number; throttleCap?: number }): Rocket {
  const fuel = Math.min(1, Math.max(0.5, cfg.fuelPct ?? 1)), cap = Math.min(1, Math.max(0.4, cfg.throttleCap ?? 1));
  if (fuel === 1 && cap === 1) return r;
  const scale = (st: StageSpec): StageSpec => ({ ...st, propKg: st.propKg * fuel });
  const out: Rocket = { ...r, s1: scale(r.s1), s2: scale(r.s2), s3: r.s3 ? scale(r.s3) : undefined, throttleCap: cap, fuelLoad: fuel };
  const removed = r.s1.propKg + r.s2.propKg + (r.s3?.propKg ?? 0) - (out.s1.propKg + out.s2.propKg + (out.s3?.propKg ?? 0));
  out.m0 = r.m0 - removed;
  out.dvIdeal = idealDv(out);
  out.twr0 = (out.s1.thrustSlN * cap) / (out.m0 * LAUNCH.g0);
  return out;
}

/** Quick test flight with the Cadet autopilot: does this exact stack reach orbit? (Orbit missions only; the answer is for a clean autopilot flight, manual flying can do better or worse.) */
export function autopilotReaches(rocket: Rocket, site: LaunchSite, maxT = 1200): { ok: boolean; reason: string | null } {
  const f = createFlight(rocket, RULES.easy, site, 1, "orbit"), input = defaultInput(f.rules);
  while (f.phase !== "orbit" && f.phase !== "failed" && f.t < maxT) { stepFlight(f, input); input.stage = false; input.cut = false; input.restart = false; }
  return { ok: f.phase === "orbit", reason: f.failure };
}

/* ---------- Flight state ---------- */
export type FlightPhase = "countdown" | "stage1" | "coast" | "stage2" | "orbit" | "parking" | "tli" | "translunar" | "failed";
export type MissionKind = "orbit" | "moon";
export interface Input { throttle: number; pitchRate: number; stage: boolean; cut: boolean; restart: boolean; autopilot: boolean; upperGuidance: boolean }
export interface LogLine { t: number; text: string; tone: "info" | "good" | "warn" | "bad" }
export interface Telemetry {
  alt: number; speed: number; surfSpeed: number; vr: number; vt: number; downrangeKm: number; q: number; aoa: number; g: number; pitch: number;
  apoKm: number; periKm: number; ecc: number; mass: number; thrust: number; prop1: number; prop2: number; prop3: number; propUpper: number; qAlpha: number;
  /** Moon mission: seconds until the TLI window (parking orbit only) and the window error in degrees when burning */
  tliRemainS: number | null; tliErrDeg: number | null;
}
export interface Flight {
  rocket: Rocket; rules: Rules; site: LaunchSite; seed: number; rng: number;
  t: number; phase: FlightPhase; stage: 1 | 2 | 3; mission: MissionKind; sepFrom: 1 | 2; tliStartAngle: number; tliErr: number | null; x: number; y: number; vx: number; vy: number; theta0: number;
  m: number; prop1: number; prop2: number; prop3: number; pitch: number; throttle: number; engineOn: boolean; ignited: boolean; liftedOff: boolean;
  coastLeft: number; fairing: boolean; thrustMult: number; thrustMultUntil: number; guidanceDownUntil: number;
  omega: number; maxQ: number; maxQt: number; maxG: number; maxQAlpha: number;
  anomalies: { at: number; kind: "minor" | "major" | "none"; done: boolean };
  milestones: Record<string, number>; log: LogLine[]; tel: Telemetry; failure: string | null; trail: number[]; debris: { x: number; y: number; vx: number; vy: number; /** sprite rows (fraction from the top) of the spent part */ top: number; bot: number }[];
  cutoffs: number; kickDone: boolean; manualOverride: boolean; gOver: number;
  /** orbit reached (insertion): numbers frozen for scoring; TLI apogee accuracy */
  park: { periKm: number; apoKm: number; fuel: number } | null; tliRatio: number | null;
}

export const R_E = () => bodyById("earth").radius_m;
export const MU_E = () => bodyById("earth").mu;
const earthRadius = R_E(), muEarth = MU_E();

function mulberry(n: { rng: number }) { n.rng = (n.rng + 0x6d2b79f5) >>> 0; let t = n.rng; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
const deg = (r: number) => (r * 180) / Math.PI, rad = (d: number) => (d * Math.PI) / 180;

export function createFlight(rocket: Rocket, rules: Rules, site: LaunchSite, seed: number, mission: MissionKind = "orbit"): Flight {
  const f: Flight = {
    rocket, rules, site, seed, rng: seed >>> 0, t: -LAUNCH.countdownS, phase: "countdown", stage: 1, mission, sepFrom: 1, tliStartAngle: 0, tliErr: null,
    x: 0, y: earthRadius, vx: site.rotation_boost_m_s, vy: 0, theta0: 0, m: rocket.m0, prop1: rocket.s1.propKg, prop2: rocket.s2.propKg, prop3: rocket.s3?.propKg ?? 0,
    pitch: 90, throttle: rocket.throttleCap ?? 1, engineOn: false, ignited: false, liftedOff: false, coastLeft: 0, fairing: true, thrustMult: 1, thrustMultUntil: 0, guidanceDownUntil: 0,
    omega: site.rotation_boost_m_s / earthRadius, maxQ: 0, maxQt: 0, maxG: 0, maxQAlpha: 0, anomalies: { at: 0, kind: "none", done: false },
    milestones: {}, log: [], tel: undefined as unknown as Telemetry, failure: null, trail: [], debris: [], cutoffs: 0, kickDone: false, manualOverride: false, gOver: 0, park: null, tliRatio: null,
  };
  const rnd = () => mulberry(f);
  const major = rnd() < rules.majorAnomalyChance, minor = rnd() < rules.minorAnomalyChance;
  f.anomalies = { at: 45 + rnd() * 60, kind: major ? "major" : minor ? "minor" : "none", done: false };
  f.tel = telemetry(f, 0, 0, 0);
  log(f, mission === "moon" ? "Launch director: all stations go for the lunar mission. Countdown started." : "Launch director: all stations go. Countdown started.", "info");
  return f;
}
const log = (f: Flight, text: string, tone: LogLine["tone"] = "info") => { f.log = [...f.log.slice(-39), { t: f.t, text, tone }]; };
const mark = (f: Flight, key: string, text: string, tone: LogLine["tone"] = "good") => { if (f.milestones[key] === undefined) { f.milestones[key] = f.t; log(f, text, tone); } };

/* ---------- Environment ---------- */
export const density = (h: number) => (h > LAUNCH.atmosphereTopM ? 0 : LAUNCH.rho0 * Math.exp(-Math.max(0, h) / LAUNCH.scaleHeightM));
/** Head/tail wind along the flight direction (m/s): jet-stream peak near 11 km, seeded gusts. */
export function windAt(f: Flight, h: number): number {
  const amp = f.rules.windMs;
  if (!amp) return 0;
  const jet = Math.exp(-((h - 11_000) ** 2) / (2 * 5_000 ** 2));
  const gust = Math.sin(f.t * 0.37 + f.seed) * 0.5 + Math.sin(f.t * 0.11 + f.seed * 0.3) * 0.5;
  return amp * jet * (0.6 + 0.4 * gust);
}

export function orbitElements(x: number, y: number, vx: number, vy: number) {
  const r = Math.hypot(x, y), v2 = vx * vx + vy * vy;
  const eps = v2 / 2 - muEarth / r;
  const hz = x * vy - y * vx;
  const ex = ((v2 - muEarth / r) * x - (x * vx + y * vy) * vx) / muEarth, ey = ((v2 - muEarth / r) * y - (x * vx + y * vy) * vy) / muEarth;
  const e = Math.hypot(ex, ey);
  if (eps >= 0) return { a: Infinity, e, peri: r - earthRadius, apo: Infinity, bound: false, ex, ey, hz };
  const a = -muEarth / (2 * eps);
  return { a, e, peri: a * (1 - e) - earthRadius, apo: a * (1 + e) - earthRadius, bound: true, ex, ey, hz };
}

function telemetry(f: Flight, q: number, aoa: number, g: number): Telemetry {
  const r = Math.hypot(f.x, f.y), rx = f.x / r, ry = f.y / r, hx = ry, hy = -rx;
  const vr = f.vx * rx + f.vy * ry, vt = f.vx * hx + f.vy * hy;
  const el = orbitElements(f.x, f.y, f.vx, f.vy);
  const wind = windAt(f, r - earthRadius);
  const vatm = f.omega * r + wind;
  const thrust = f.engineOn ? currentThrust(f, r - earthRadius) : 0;
  const ang = Math.atan2(f.y, f.x);
  const theta = Math.PI / 2 - ang; // angle clockwise from the pad's vertical
  return {
    alt: r - earthRadius, speed: Math.hypot(f.vx, f.vy), surfSpeed: Math.hypot(vr, vt - vatm), vr, vt,
    downrangeKm: Math.max(0, (theta - f.omega * Math.max(0, f.t)) * earthRadius / 1000), q, aoa, g, pitch: f.pitch,
    apoKm: el.bound ? el.apo / 1000 : Infinity, periKm: el.peri / 1000, ecc: el.e, mass: f.m, thrust, prop1: f.prop1 / f.rocket.s1.propKg, prop2: f.prop2 / f.rocket.s2.propKg, prop3: f.rocket.s3 ? f.prop3 / f.rocket.s3.propKg : 0,
    propUpper: f.rocket.s3 ? f.prop3 / f.rocket.s3.propKg : f.prop2 / f.rocket.s2.propKg, qAlpha: q * Math.abs(aoa) / 1000,
    tliRemainS: f.phase === "parking" ? Math.max(0, tliRemain(f) / Math.sqrt(muEarth / r ** 3)) : null, tliErrDeg: f.tliErr === null ? null : deg(f.tliErr),
  };
}

const stageSpec = (f: Flight) => (f.stage === 1 ? f.rocket.s1 : f.stage === 2 ? f.rocket.s2 : f.rocket.s3!);
const lastStage = (f: Flight): 2 | 3 => (f.rocket.s3 ? 3 : 2);
const isUpper = (f: Flight) => f.stage === lastStage(f);
const propOf = (f: Flight) => (f.stage === 1 ? f.prop1 : f.stage === 2 ? f.prop2 : f.prop3);
const burnPropellant = (f: Flight, d: number) => { if (f.stage === 1) f.prop1 -= d; else if (f.stage === 2) f.prop2 -= d; else f.prop3 -= d; };
const wrapPi = (a: number) => { const t = (a + Math.PI) % (2 * Math.PI); return (t < 0 ? t + 2 * Math.PI : t) - Math.PI; };
/** Angle still to fly (rad, clockwise) before the TLI window opens; ≤ 0 once the craft has passed the window start. */
const tliRemain = (f: Flight) => wrapPi(Math.atan2(f.y, f.x) - f.tliStartAngle);
export const tliWindowRemain = tliRemain;
/** Moon distance the TLI orbit must reach (centre-to-centre) and the accepted band. */
export const MOON_DIST_M = () => bodyById("moon").sma_m as number;
export const TLI = { tolLow: 0.93, tolHigh: 1.07, windowOkRad: 0.14, windowFailRad: 0.35, orbitsToWait: 0.3, leadRad: 0.17, maxRestarts: 4 } as const;
function fullThrust(f: Flight, h: number) {
  const s = stageSpec(f);
  const p = Math.exp(-Math.max(0, h) / LAUNCH.scaleHeightM);
  return (s.thrustVacN + (s.thrustSlN - s.thrustVacN) * p) * (f.t < f.thrustMultUntil ? f.thrustMult : 1);
}
const currentThrust = (f: Flight, h: number) => fullThrust(f, h) * f.throttle;
const radialSpeed = (f: Flight) => (f.vx * f.x + f.vy * f.y) / Math.hypot(f.x, f.y);
const ispNow = (f: Flight, h: number) => { const s = stageSpec(f); const p = Math.exp(-Math.max(0, h) / LAUNCH.scaleHeightM); return s.ispVac + (s.ispSl - s.ispVac) * p; };

/* ---------- Guidance (autopilot / upper-stage computer / reference cue) ---------- */
const CLEAR_TOWER_M = 300, PROFILE_TOP_M = 115_000, PROFILE_EXP = 0.8, LEAD_BELOW = 4, LEAD_ABOVE = 3;
/** Reference ascent profile: pitch above the horizon as a function of altitude (steep early, flat near orbit). */
export const profilePitch = (h: number) => 90 - 90 * Math.pow(clamp(h / PROFILE_TOP_M, 0, 1), PROFILE_EXP);
/** Pitch (deg above horizontal) the guidance wants right now. */
export function guidancePitch(f: Flight): number {
  const r = Math.hypot(f.x, f.y), rx = f.x / r, ry = f.y / r, hx = ry, hy = -rx;
  const h = r - earthRadius, vr = f.vx * rx + f.vy * ry, vt = f.vx * hx + f.vy * hy;
  if (f.phase === "tli") return deg(Math.atan2(vr, Math.max(1, vt))); // burn prograde (along the velocity vector)
  if (f.stage === 1) {
    if (h < CLEAR_TOWER_M) return 90;
    const vatm = f.omega * r + windAt(f, h);
    const rel = deg(Math.atan2(vr, Math.max(1, vt - vatm))); // flight-path angle relative to the air
    // Near the ground stay within a few degrees of the airflow; as the air thins (low q) the nose may lead much further.
    const thin = clamp(1 - (f.tel?.q ?? 0) / 6000, 0, 1);
    return clamp(profilePitch(h), rel - (LEAD_BELOW + 28 * thin), rel + LEAD_ABOVE);
  }
  // Upper stage: terminal guidance. Pick a radial acceleration that lands on the target altitude with zero climb rate
  // exactly when horizontal speed reaches circular speed (time-to-go from the rocket equation).
  // Already above the target (lofted stage 1)? Hold that altitude rather than diving back down.
  const tgtH = Math.max(LAUNCH.targetOrbitKm * 1000, h);
  const vcirc = Math.sqrt(muEarth / r);
  const thrust = Math.max(1, fullThrust(f, h) * clamp(f.throttle, 0.35, 1));
  const ve = ispNow(f, h) * LAUNCH.g0;
  const dvLeft = Math.max(5, vcirc - vt);
  const tGo = clamp((f.m * ve / thrust) * (1 - Math.exp(-dvLeft / ve)), 8, 900);
  // Terminal phase (< 20 s to go): stop chasing altitude, just null the climb rate (avoids the law blowing up as T → 0).
  const aR = tGo < 20 ? clamp(-vr / 10, -6, 6) : (6 * (tgtH - h - (2 / 3) * vr * tGo)) / (tGo * tGo);
  const aT = Math.max(0.5, thrust / f.m);
  const need = muEarth / (r * r) - (vt * vt) / r + clamp(aR, -15, 15);
  return clamp(deg(Math.asin(clamp(need / aT, -0.3, 0.97))), -5, 95); // the cue never asks for a pitch the controls cannot reach
}

/* ---------- Step ---------- */
export function stepFlight(f: Flight, input: Input, dt = LAUNCH.dt): void {
  if (f.phase === "orbit" || f.phase === "failed" || f.phase === "translunar") return;
  f.t += dt;
  if (f.phase === "countdown") {
    const left = -f.t;
    if (left <= 3 && !f.ignited) { f.ignited = true; f.engineOn = true; log(f, "Main engine start.", "info"); }
    if (f.t >= 0) { f.phase = "stage1"; f.liftedOff = true; mark(f, "liftoff", "Liftoff! The vehicle has cleared the tower."); }
    f.tel = telemetry(f, 0, 0, f.engineOn ? 1 : 0);
    if (f.t < 0) return;
  }
  const r0 = Math.hypot(f.x, f.y), h0 = r0 - earthRadius;

  // ---- controls
  const rules = f.rules;
  const apAllowed = rules.autopilot === "full" || (rules.autopilot === "upper" && f.stage >= 2 && input.upperGuidance);
  const apOn = apAllowed && (rules.autopilot === "upper" ? true : input.autopilot) && f.t >= f.guidanceDownUntil;
  const s = stageSpec(f);
  if (f.milestones.kick === undefined && h0 >= CLEAR_TOWER_M) mark(f, "kick", "Tower cleared — pitch program started.", "info");
  if (apOn && rules.autopilot === "full" && f.stage === 1) f.throttle = maxQBucket(f, h0);
  else if (apOn && f.stage >= 2) f.throttle = f.engineOn ? clamp((LAUNCH.upperMaxG * LAUNCH.g0 * f.m) / Math.max(1, fullThrust(f, h0)), s.minThrottle, 1) : f.throttle;
  else f.throttle = clamp(input.throttle, 0, 1);
  if (f.rocket.throttleCap !== undefined) f.throttle = Math.min(f.throttle, f.rocket.throttleCap); // the player-set throttle limit
  if (f.engineOn && f.stage === 1) f.throttle = clamp(f.throttle, s.minThrottle, 1);
  if (f.engineOn && f.stage >= 2 && f.throttle > 0) f.throttle = clamp(f.throttle, s.minThrottle, 1);

  if (apOn && isUpper(f) && f.engineOn && f.phase === "stage2") { // guided cutoff: circular enough at the target altitude
    const el = orbitElements(f.x, f.y, f.vx, f.vy);
    const vcirc = Math.sqrt(muEarth / Math.hypot(f.x, f.y)), rr = Math.hypot(f.x, f.y), vtt = (f.vx * f.y - f.vy * f.x) / rr;
    const circ = el.bound && el.peri / 1000 >= LAUNCH.targetOrbitKm - 25 && (el.apo - el.peri) / 1000 < 120;
    if (circ || (vtt >= vcirc && Math.abs((f.vx * f.x + f.vy * f.y) / rr) < 60)) { f.engineOn = false; f.cutoffs++; mark(f, "seco" + f.cutoffs, "Guided engine cutoff (SECO)."); }
  }
  // ---- Moon mission: wait in parking orbit for the TLI window, then re-ignite the upper stage and burn prograde
  if (f.phase === "parking") {
    const rem = tliRemain(f);
    const auto = rules.autopilot === "full" && input.autopilot;
    const go = auto ? rem <= 0 && rem > -1 : input.restart;
    if (go && propOf(f) > 0 && f.cutoffs < TLI.maxRestarts) {
      f.phase = "tli"; f.engineOn = true; f.tliErr = rem; f.throttle = f.rocket.throttleCap ?? 1;
      mark(f, "tliStart", `TLI ignition — ${Math.abs(deg(rem)) <= deg(TLI.windowOkRad) ? "inside the window." : Math.abs(rem) < TLI.windowFailRad ? "window error " + deg(rem).toFixed(0) + "°, the Moon will be off-axis." : "OUTSIDE the window."}`, Math.abs(rem) <= TLI.windowOkRad ? "good" : "warn");
    }
  }
  if (f.phase === "tli" && f.engineOn) {
    const el = orbitElements(f.x, f.y, f.vx, f.vy), apoTarget = MOON_DIST_M() - earthRadius;
    if (apOn && (!el.bound || el.apo >= apoTarget)) { f.engineOn = false; f.cutoffs++; mark(f, "tliCut", "Guided TLI cutoff — apogee at lunar distance."); }
  }
  if (apOn) {
    const target = guidancePitch(f);
    const slew = LAUNCH.autopilotSlewDegS * dt;
    f.pitch += clamp(target - f.pitch, -slew, slew);
  } else {
    f.pitch = clamp(f.pitch + input.pitchRate * LAUNCH.pitchSlewDegS * dt, -5, 95);
  }

  // ---- staging
  if (f.stage === 1 && f.phase === "stage1" && f.prop1 <= 0 && f.engineOn) {
    f.engineOn = false; mark(f, "meco", "Main engine cutoff (MECO).");
    if (rules.autoStaging) { stageSeparation(f); } else { log(f, "Stage 1 is spent — press STAGE to separate.", "warn"); }
  }
  if (f.stage === 2 && f.rocket.s3 && f.phase === "stage2" && f.prop2 <= 0 && f.engineOn) {
    f.engineOn = false; mark(f, "meco2", `${f.rocket.stageNames[1]} cutoff.`);
    if (rules.autoStaging) stageSeparation(f); else log(f, `${f.rocket.stageNames[1]} is spent — press STAGE to separate.`, "warn");
  }
  if (f.stage === 1 && f.prop1 <= 0 && !rules.autoStaging && input.stage && f.phase === "stage1") stageSeparation(f);
  if (f.stage === 2 && f.rocket.s3 && f.prop2 <= 0 && !rules.autoStaging && input.stage && f.phase === "stage2" && !f.engineOn) stageSeparation(f);
  if (f.phase === "coast") {
    f.coastLeft -= dt;
    const ready = f.coastLeft <= 0;
    if (rules.autoStaging ? ready : input.stage) {
      f.phase = "stage2"; f.stage = (f.sepFrom + 1) as 2 | 3; f.engineOn = true; f.throttle = Math.min(f.rocket.throttleCap ?? 1, Math.max(0.35, input.throttle));
      mark(f, f.stage === 2 ? "ignition2" : "ignition3", `${f.rocket.stageNames[f.stage - 1]} ignition.`);
    }
  }
  // restart / cutoff
  if (isUpper(f) && (f.phase === "stage2" || f.phase === "tli")) {
    if (input.cut && f.engineOn) { f.engineOn = false; f.cutoffs++; mark(f, f.phase === "tli" ? "tliCut" : "seco" + f.cutoffs, f.phase === "tli" ? "TLI engine cutoff." : "Second engine cutoff (SECO)."); }
    else if (f.phase === "stage2" && !f.engineOn && propOf(f) > 0 && input.restart && f.cutoffs > 0 && f.cutoffs < TLI.maxRestarts) { f.engineOn = true; f.throttle = Math.min(f.rocket.throttleCap ?? 1, Math.max(0.35, input.throttle)); log(f, "Engine restart.", "info"); }
  }

  // ---- forces
  const r = Math.hypot(f.x, f.y), h = r - earthRadius, rx = f.x / r, ry = f.y / r, hx = ry, hy = -rx;
  const thrust = f.engineOn && propOf(f) > 0 ? currentThrust(f, h) : 0;
  const pr = rad(f.pitch);
  const tdx = Math.cos(pr) * hx + Math.sin(pr) * rx, tdy = Math.cos(pr) * hy + Math.sin(pr) * ry;
  const vatm = f.omega * r + windAt(f, h);
  const rvx = f.vx - vatm * hx, rvy = f.vy - vatm * hy, rv = Math.hypot(rvx, rvy);
  const rho = density(h), q = 0.5 * rho * rv * rv;
  const area = Math.PI * (f.rocket.diameterM / 2) ** 2;
  const drag = q * LAUNCH.cd * area;
  let aoa = 0;
  if (rv > 30) { const c = (tdx * rvx + tdy * rvy) / rv; aoa = deg(Math.acos(clamp(c, -1, 1))); }
  let ax = (thrust * tdx) / f.m - (drag * (rv > 0 ? rvx / rv : 0)) / f.m - (muEarth * rx) / (r * r);
  let ay = (thrust * tdy) / f.m - (drag * (rv > 0 ? rvy / rv : 0)) / f.m - (muEarth * ry) / (r * r);
  if (!f.liftedOff || (f.phase === "stage1" && thrust < f.m * (muEarth / (r * r)) && h < 5)) { // held on the pad until thrust > weight
    const up = ax * rx + ay * ry;
    if (up < 0 && h < 5) { ax -= up * rx; ay -= up * ry; f.vx = f.omega * r * hx; f.vy = f.omega * r * hy; }
  }
  f.vx += ax * dt; f.vy += ay * dt; f.x += f.vx * dt; f.y += f.vy * dt;
  // mass flow
  if (thrust > 0) {
    const dm = (thrust / (ispNow(f, h) * LAUNCH.g0)) * dt;
    const d = Math.min(dm, propOf(f)); burnPropellant(f, d); f.m -= d;
    if (f.stage >= 2 && propOf(f) <= 0 && (isUpper(f) || f.stage === 2 && !f.rocket.s3)) { f.engineOn = false; log(f, f.phase === "tli" ? "Upper stage propellant depleted during TLI." : "Upper stage propellant depleted.", "warn"); }
  }
  // debris (cosmetic)
  for (const d of f.debris) { const dr = Math.hypot(d.x, d.y); d.vx -= (muEarth * d.x) / dr ** 3 * dt; d.vy -= (muEarth * d.y) / dr ** 3 * dt; d.x += d.vx * dt; d.y += d.vy * dt; }
  f.debris = f.debris.filter((d) => Math.hypot(d.x, d.y) > earthRadius - 100);

  // ---- anomalies
  if (!f.anomalies.done && f.t >= f.anomalies.at && f.stage === 1 && f.anomalies.kind !== "none") {
    f.anomalies.done = true;
    if (f.anomalies.kind === "minor") { f.thrustMult = 0.9; f.thrustMultUntil = f.t + 20; log(f, "Engine anomaly: thrust 10 % low for ~20 s.", "warn"); }
    else { f.thrustMult = 0.82; f.thrustMultUntil = f.t + 55; log(f, "Engine anomaly: one engine out — thrust down 18 %.", "bad"); }
  }

  // ---- limits
  const g = thrust / f.m / LAUNCH.g0;
  const qa = (q * aoa) / 1000;
  if (q > f.maxQ) { f.maxQ = q; f.maxQt = f.t; }
  f.maxG = Math.max(f.maxG, g); f.maxQAlpha = Math.max(f.maxQAlpha, qa * 1000);
  if (f.milestones.maxq === undefined && f.maxQ > 8000 && q < f.maxQ * 0.85 && f.stage === 1) mark(f, "maxq", `Max-Q: ${(f.maxQ / 1000).toFixed(1)} kPa.`, "info");
  const qLimit = LAUNCH.qDesignPa * rules.qLimitFactor, qaLimit = LAUNCH.qAlphaDesign * rules.qLimitFactor * (rules.aoaProtect ? 1.6 : 1);
  const effAoa = rules.aoaProtect ? aoa * 0.35 : aoa;
  if (f.liftedOff && f.t > 2) {
    if (q > qLimit) fail(f, `Structural failure: dynamic pressure ${(q / 1000).toFixed(0)} kPa exceeded the vehicle limit (${(qLimit / 1000).toFixed(0)} kPa). Throttle down through max-Q.`);
    else if (q * effAoa > qaLimit && q > 6000) fail(f, `Vehicle broke up: angle of attack ${aoa.toFixed(0)}° at ${(q / 1000).toFixed(0)} kPa. Keep the nose aligned with the airflow (gravity turn).`);
  }
  f.gOver = g > LAUNCH.gLimit ? f.gOver + dt : 0;
  if (f.gOver > LAUNCH.gOverS) fail(f, `Payload damaged: acceleration above ${LAUNCH.gLimit} g for ${LAUNCH.gOverS} s. Throttle the upper stage down as it gets lighter.`);
  if (f.liftedOff && h < -50 && radialSpeed(f) < 0) fail(f, "The vehicle fell back and crashed.");

  // ---- milestones
  if (f.stage >= 2 && f.fairing && h > (f.rocket.s3 ? 90_000 : 110_000) && q < 50) { f.fairing = false; mark(f, "fairing", f.rocket.s3 ? "Launch escape tower jettisoned." : "Payload fairing jettisoned."); }
  if (h >= LAUNCH.karmanM) mark(f, "karman", "Kármán line crossed — you are in space!");
  // trail
  if (Math.floor(f.t * 2) !== Math.floor((f.t - dt) * 2)) f.trail.push(f.x, f.y, f.t); // x, y, time (triplets)

  f.tel = telemetry(f, q, aoa, g);
  evaluateOutcome(f);
}

function maxQBucket(f: Flight, h: number) {
  const q = 0.5 * density(h) * (f.tel?.surfSpeed ?? 0) ** 2;
  const limit = LAUNCH.qDesignPa * 0.78;
  if (q > limit) return clamp(1 - (q - limit) / (limit * 0.45), 0.55, 1);
  return 1;
}
function stageSeparation(f: Flight) {
  if (f.phase === "coast" || (f.stage === 1 && false)) return;
  const [after1, after2] = f.rocket.stageFrac, before = f.stage === 1 ? 1 : after1, after = f.stage === 1 ? after1 : after2;
  f.phase = "coast"; f.coastLeft = 2.5; f.sepFrom = f.stage as 1 | 2; f.m -= stageSpec(f).dryKg;
  f.debris.push({ x: f.x, y: f.y, vx: f.vx * 0.995, vy: f.vy * 0.995, top: after, bot: before });
  mark(f, f.stage === 1 ? "sep" : "sep2", `${f.rocket.stageNames[f.stage - 1]} separation confirmed.`);
}
function fail(f: Flight, reason: string) { if (f.phase === "failed") return; f.phase = "failed"; f.failure = reason; f.engineOn = false; log(f, reason, "bad"); }

/** Success / failure after each step (orbit needs engine off, above the atmosphere, perigee over the difficulty threshold). */
function evaluateOutcome(f: Flight) {
  if (f.phase === "failed" || f.phase === "orbit" || f.phase === "translunar") return;
  const el = orbitElements(f.x, f.y, f.vx, f.vy), alt = Math.hypot(f.x, f.y) - earthRadius;
  const periKm = el.peri / 1000, apoKm = el.apo / 1000, moon = f.mission === "moon";
  if (f.t > (moon ? 9000 : 3600)) return fail(f, "Mission time exceeded without completing the objective.");
  if (f.phase === "parking") return; // coasting in parking orbit until the TLI window
  if (f.phase === "tli") return tliOutcome(f, el.bound, el.apo);
  if (isUpper(f) && f.phase === "stage2" && !f.engineOn && alt >= LAUNCH.atmosphereTopM * 0.8 && el.bound) {
    if (periKm >= f.rules.minPerigeeKm) {
      if (apoKm > f.rules.maxApogeeKm) return fail(f, `Orbit too high and elongated (apogee ${apoKm.toFixed(0)} km > ${f.rules.maxApogeeKm} km). Cut the engine sooner.`);
      f.park = { periKm, apoKm, fuel: f.tel.propUpper };
      if (moon) {
        f.phase = "parking"; f.tliStartAngle = Math.atan2(f.y, f.x) - TLI.orbitsToWait * 2 * Math.PI + TLI.leadRad;
        mark(f, "orbit", `Parking orbit: ${periKm.toFixed(0)} × ${apoKm.toFixed(0)} km. TLI window opens in about ${(TLI.orbitsToWait * 2 * Math.PI / Math.sqrt(muEarth / Math.hypot(f.x, f.y) ** 3) / 60).toFixed(0)} min.`);
      } else { f.phase = "orbit"; mark(f, "orbit", `Orbit achieved: ${periKm.toFixed(0)} × ${apoKm.toFixed(0)} km.`); }
      return;
    }
  }
  if (isUpper(f) && f.phase === "stage2" && propOf(f) <= 0 && !f.engineOn && periKm < f.rules.minPerigeeKm) {
    return fail(f, `Out of propellant in a ${periKm.toFixed(0)} × ${apoKm.toFixed(0)} km path — perigee must clear ${f.rules.minPerigeeKm} km. Fly the gravity turn more efficiently.`);
  }
  if (isUpper(f) && f.phase === "stage2" && !f.engineOn && propOf(f) > 0 && f.milestones.karman !== undefined && radialSpeed(f) < 0 && alt < 70_000 && periKm < 0) {
    return fail(f, "The stage re-entered the atmosphere — you cut the engine before reaching a safe orbit.");
  }
  if (f.phase === "coast" && alt < 20_000 && radialSpeed(f) < -100) fail(f, "Stage separation too early — the upper stage fell back to Earth.");
}

/** Translunar injection: judged on the orbit the burn leaves behind (apogee vs the Moon's distance) and the window error. */
function tliOutcome(f: Flight, bound: boolean, apoAlt: number) {
  const target = MOON_DIST_M() - earthRadius, moonKm = MOON_DIST_M() / 1000;
  if (!bound) return fail(f, "Overspeed: the burn pushed the stage onto an Earth-escape path — you would fly far past the Moon. Cut the engine when apogee reaches the Moon's distance.");
  if (f.engineOn) { if (apoAlt > target * TLI.tolHigh) fail(f, `TLI burn ran too long: apogee ${(apoAlt / 1000).toFixed(0)} km is beyond the Moon (${moonKm.toFixed(0)} km). Cut the engine sooner.`); return; }
  const ratio = apoAlt / target;
  if (ratio < TLI.tolLow) return fail(f, f.prop3 <= 0 && f.rocket.s3 || (!f.rocket.s3 && f.prop2 <= 0)
    ? `Upper stage ran out of propellant during TLI: apogee only ${(apoAlt / 1000).toFixed(0)} km, the Moon is ${moonKm.toFixed(0)} km away. This rocket cannot send this payload to the Moon — try the Saturn V.`
    : `TLI cutoff too early: apogee ${(apoAlt / 1000).toFixed(0)} km does not reach the Moon (${moonKm.toFixed(0)} km).`);
  if (ratio > TLI.tolHigh) return fail(f, `TLI overshoot: apogee ${(apoAlt / 1000).toFixed(0)} km is far beyond the Moon.`);
  if (Math.abs(f.tliErr ?? 0) > TLI.windowFailRad) return fail(f, `The burn started ${Math.abs(deg(f.tliErr ?? 0)).toFixed(0)}° off the TLI window — the Moon will not be at the end of this transfer. Ignite when the window indicator reads 0.`);
  f.tliRatio = ratio; f.phase = "translunar";
  mark(f, "tli", `Translunar injection complete: apogee ${(apoAlt / 1000).toFixed(0)} km — on course for the Moon.`);
}

/** Score a finished flight (0–1000 × difficulty multiplier). */
export function scoreFlight(f: Flight) {
  const t = f.tel, moon = f.mission === "moon";
  const ok = moon ? f.phase === "translunar" : f.phase === "orbit";
  const reachedOrbit = f.park !== null;
  const karman = f.milestones.karman !== undefined;
  const park = f.park ?? { periKm: t.periKm, apoKm: t.apoKm, fuel: t.propUpper };
  let base = 0;
  if (f.milestones.liftoff !== undefined) base += 60;
  if (f.milestones.maxq !== undefined) base += 40;
  if (f.milestones.sep !== undefined) base += 80;
  if (karman) base += 120;
  if (reachedOrbit) {
    base += 300;
    base += 150 * clamp(1 - Math.abs(park.periKm - LAUNCH.targetOrbitKm) / 200, 0, 1);
    base += 100 * clamp(park.fuel, 0, 1) * (moon ? 1 : 2);
    base += 70 * clamp(1 - f.maxQ / (LAUNCH.qDesignPa * f.rules.qLimitFactor), 0, 1);
    base += 80 * clamp(1 - Math.max(0, (isFinite(park.apoKm) ? (park.apoKm - park.periKm) / (park.apoKm + park.periKm + 2 * 6371) : 1) - 0.005) / 0.1, 0, 1);
  }
  if (moon && ok) { // TLI: reward a centred window and an apogee close to the Moon's distance
    base += 150 * clamp(1 - Math.abs(f.tliErr ?? 0) / TLI.windowFailRad, 0, 1) + 150 * clamp(1 - Math.abs((f.tliRatio ?? 1) - 1) / (TLI.tolHigh - 1), 0, 1);
  }
  const maxBase = moon ? 1300 : 1000;
  const total = Math.round(base * f.rules.scoreMult);
  const frac = base / maxBase;
  const grade = ok ? (frac >= 0.85 ? "S" : frac >= 0.7 ? "A" : frac >= 0.55 ? "B" : "C") : (karman ? "D" : "F");
  return { score: total, grade, base: Math.round(base), ok, karman, max: Math.round(maxBase * f.rules.scoreMult) };
}

/** World-space unit vector the engine is pointing along (x east at the pad, y up at the pad). */
export function thrustDir(f: Flight): { x: number; y: number } {
  const r = Math.hypot(f.x, f.y), rx = f.x / r, ry = f.y / r, hx = ry, hy = -rx, pr = rad(f.pitch);
  return { x: Math.cos(pr) * hx + Math.sin(pr) * rx, y: Math.cos(pr) * hy + Math.sin(pr) * ry };
}
/** Where the launch pad is now (it rides the rotating Earth). */
export function padPosition(f: Flight): { x: number; y: number; angle: number } {
  const angle = f.omega * Math.max(0, f.t);
  return { x: earthRadius * Math.sin(angle), y: earthRadius * Math.cos(angle), angle };
}
export function defaultInput(rules: Rules): Input {
  return { throttle: 1, pitchRate: 0, stage: false, cut: false, restart: false, autopilot: rules.autopilot === "full", upperGuidance: false };
}
export const sitesList = (): LaunchSite[] => DATASET.launch_sites;
