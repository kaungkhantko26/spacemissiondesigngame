import { GAME, bodyById, type Destination } from "./data";

/**
 * Flight path for the launch visualisation. Everything is derived from the dataset's μ, radii and orbits:
 *  - Moon: Earth-centred. LEO parking orbit → Hohmann ellipse (TLI) → capture into a 100 km lunar orbit. The Moon sits where the
 *    craft will arrive (phase angle solved from its real mean motion).
 *  - Planets: Sun-centred. Earth/target on circular orbits (dataset semi-major axes), Hohmann ellipse between them, capture at target.
 * The timeline u∈[0,1] is a *visual* time warp of three segments; telemetry reports the real mission-elapsed time.
 */
export type V3 = [number, number, number];
export type FailIndex = 0 | 1 | 2 | 3 | null;
export interface Telemetry { metS: number; phase: string; altKm: number | null; speedKmS: number; rangeLabel: string; rangeKm: number; sunKm?: number }
export interface Sample { craft: V3; earth: V3; target: V3; telemetry: Telemetry; lost: boolean }
export interface Trajectory {
  mode: "moon" | "sun"; unitKm: number; earthR: number; targetR: number; targetName: string; uEnd: number;
  reveal: number[]; markers: { seg1: number; seg2: number }; sample: (u: number) => Sample; path: Float32Array;
  /** craft position relative to the target (for drawing the capture orbit as a clean ring) and the path index where capture begins */ pathRel: Float32Array; seg3Index: number; captureRadius: number; orbitRadii: number[];
  centre: V3; viewRadius: number; durationS: number; transferDays: number;
}

const TAU = Math.PI * 2;
const smooth = (x: number) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };

export function solveKepler(M: number, e: number): number {
  let E = e < 0.8 ? M : Math.PI;
  for (let i = 0; i < 40; i++) { const d = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E)); E -= d; if (Math.abs(d) < 1e-12) break; }
  return E;
}
const trueAnomaly = (E: number, e: number) => 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
const polar = (r: number, th: number): V3 => [r * Math.cos(th), 0, r * Math.sin(th)];
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const dist = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const FRACTIONS = { moon: [0.12, 0.7, 0.18], sun: [0.08, 0.74, 0.18] } as const;

export function buildTrajectory(dest: Destination, failIndex: FailIndex): Trajectory {
  const earth = bodyById("earth"), target = bodyById(dest.bodyId), sun = bodyById("sun");
  const moon = dest.kind === "moon";
  const [f1, f2, f3] = FRACTIONS[moon ? "moon" : "sun"];
  const s1 = f1, s2 = f1 + f2;
  const unitM = moon ? 1e6 : 1e9; // scene unit: 1000 km (Moon) or 1e6 km (planets)
  const U = (m: number) => m / unitM;

  // ----- geometry (metres, seconds) -----
  const mu = moon ? earth.mu : sun.mu;                 // central body of the transfer
  const r1 = moon ? earth.radius_m + GAME.leoAltitudeM : (earth.sma_m as number);
  const r2 = target.sma_m as number;                    // Moon: around Earth; planets: around the Sun
  const a = (r1 + r2) / 2, e = Math.abs(r2 - r1) / (r1 + r2), outward = r2 > r1;
  const n = Math.sqrt(mu / (a * a * a));
  const T2 = Math.PI / n;                               // Hohmann half-orbit
  const M0 = outward ? 0 : Math.PI, nu0 = outward ? 0 : Math.PI;
  const nT = Math.sqrt(mu / (r2 * r2 * r2));            // target mean motion
  const nE = moon ? Math.sqrt(earth.mu / (r1 * r1 * r1)) : Math.sqrt(sun.mu / (r1 * r1 * r1)); // LEO or Earth-around-Sun
  const ASCENT_S = 600, ASC_W = 0.35;
  const T1 = moon ? ASCENT_S + 1.5 * (TAU / nE) : 2 * 86400;
  const tArr = T1 + T2;
  const rcM = moon ? target.radius_m + 100_000 : Math.max(3, 0.02 * U(r2)) * unitM; // capture radius (planets exaggerated)
  const nCap = Math.sqrt(target.mu / (rcM ** 3)); // real lunar-orbit rate (used only for the Moon)
  const T3 = moon ? (3 * TAU) / nCap : 20 * 86400;
  const approachM = moon ? 20e6 : 3 * rcM;               // flyby / approach offset
  const psi0 = 0;                                         // transfer starts at angle 0 (Moon) / Earth's angle at departure (planets)
  const earthAngle = (t: number) => (moon ? 0 : nE * t);
  const startAngle = moon ? psi0 : earthAngle(T1);
  const targetAngle = (t: number) => startAngle + Math.PI + nT * (t - tArr);
  const earthPos = (t: number): V3 => (moon ? [0, 0, 0] : polar(U(r1), earthAngle(t)));
  const targetPos = (t: number): V3 => polar(U(r2), targetAngle(t));
  const ellipse = (t2: number): { r: number; th: number; v: number } => {
    const E = solveKepler(M0 + n * t2, e), r = a * (1 - e * Math.cos(E));
    const nu = trueAnomaly(E, e);
    return { r, th: startAngle + (nu - nu0), v: Math.sqrt(mu * (2 / r - 1 / a)) };
  };
  // Lunar approach: a real hyperbolic flyby (periapsis = the 100 km capture radius) that the insertion burn turns into a circular orbit.
  const vInf = moon ? Math.sqrt(earth.mu / r2) * (1 - Math.sqrt((2 * r1) / (r1 + r2))) : 0;
  const eH = 1 + (rcM * vInf * vInf) / target.mu, pH = rcM * (1 + eH), r0H = 9e6;
  const nuS = Math.acos(Math.min(1, Math.max(-1, (pH / r0H - 1) / eH))); // |ν| where the approach is picked up (≈ 9,000 km out)
  const th0 = targetAngle(tArr) + Math.PI - 0.35;                        // coming in from the Earth-facing side
  const phiP = th0 - nuS;                                               // periapsis direction (clockwise flight: θ = φp − ν)
  const startOff = (): V3 => polar(U(r0H), th0);
  const offsetDir = (): V3 => { const p = targetPos(tArr); const l = Math.hypot(p[0], p[2]) || 1; return [-p[0] / l, 0, -p[2] / l]; }; // toward the central body
  const scale = (v: V3, k: number): V3 => [v[0] * k, 0, v[2] * k];

  // ----- failure shaping -----
  const lostAt = failIndex === 0 ? 0.6 * ASC_W * s1 : failIndex === 1 ? s1 + 0.55 * f2 : failIndex === 3 ? s2 + 0.55 * f3 : null;
  const uEnd = lostAt ?? 1;
  const reveal = [
    failIndex === 0 ? lostAt! : moon ? ASC_W * s1 : 0.04 * s1,
    failIndex === 1 ? lostAt! : s2,
    failIndex === 2 ? s2 + 0.06 : s2 + 0.25 * f3,
    failIndex === 3 ? lostAt! : 1,
  ];

  const sample = (uIn: number): Sample => {
    const u = Math.min(uIn, uEnd);
    let craft: V3, t = 0, phase = "", speed = 0, altKm: number | null = null;
    let rangeLabel = "", rangeKm = 0;
    if (u < s1) { // ---- parking / ascent
      const w = u / s1;
      if (moon) {
        const asc = w < ASC_W;
        t = asc ? ASCENT_S * (w / ASC_W) : ASCENT_S + ((w - ASC_W) / (1 - ASC_W)) * (1.5 * (TAU / nE));
        const r = asc ? earth.radius_m + (r1 - earth.radius_m) * Math.pow(w / ASC_W, 0.7) : r1;
        craft = polar(U(r), psi0 - nE * (T1 - t));
        phase = asc ? "Ascent" : "Parking orbit";
        altKm = (r - earth.radius_m) / 1000;
        speed = asc ? 7.8 * (w / ASC_W) : Math.sqrt(earth.mu / r1) / 1000;
      } else {
        t = w * T1;
        craft = add(earthPos(t), polar(1.0, w * TAU * 1.5) /* exaggerated 1e6 km halo so it is visible */);
        phase = "Departure"; altKm = GAME.leoAltitudeM / 1000; speed = Math.sqrt(earth.mu / (earth.radius_m + GAME.leoAltitudeM)) / 1000;
      }
    } else if (u < s2) { // ---- Hohmann coast
      const w = (u - s1) / f2, t2 = w * T2;
      t = T1 + t2;
      const el = ellipse(t2);
      craft = polar(U(el.r), el.th);
      const lateral = smooth((w - 0.9) / 0.1);
      craft = moon && failIndex !== 2 ? add(craft, scale(startOff(), lateral)) : add(craft, scale(offsetDir(), U(approachM) * lateral));
      speed = el.v / 1000; phase = moon ? "Translunar coast" : "Interplanetary cruise";
      altKm = moon ? (el.r - earth.radius_m) / 1000 : null;
    } else if (failIndex === 2) { // ---- missed the target: ballistic continuation
      const w = (u - s2) / f3, t2 = T2 + w * T3;
      t = T1 + t2;
      const el = ellipse(t2);
      craft = add(polar(U(el.r), el.th), scale(offsetDir(), U(approachM)));
      speed = el.v / 1000; phase = "Missed — flyby"; altKm = moon ? (el.r - earth.radius_m) / 1000 : null;
    } else if (moon) { // ---- lunar approach → insertion burn → circular science orbit (all drawn relative to the Moon)
      const w = (u - s2) / f3, split = 0.4;
      t = tArr + w * T3;
      let rr: number, th: number;
      if (w < split) {
        const nu = -nuS * Math.pow(1 - w / split, 1.6);
        rr = pH / (1 + eH * Math.cos(nu)); th = phiP - nu;
        speed = Math.sqrt(vInf * vInf + (2 * target.mu) / rr) / 1000; phase = "Lunar approach";
      } else {
        const wb = (w - split) / (1 - split);
        rr = rcM; th = phiP - TAU * 2.5 * wb;
        speed = Math.sqrt(target.mu / rcM) / 1000; phase = wb < 0.12 ? "Orbit insertion burn" : "Science orbit";
      }
      craft = add(targetPos(t), polar(U(rr), th)); altKm = null;
    } else { // ---- capture & science orbit (planets: exaggerated visual orbit)
      const w = (u - s2) / f3;
      t = tArr + w * T3;
      const decay = 1 - smooth(w / 0.25);
      const rr = U(rcM) + (U(approachM) - U(rcM)) * decay;
      const ang = Math.PI + TAU * (moon ? 3 : 2.5) * w; // 3 real lunar orbits / a visual montage at planets
      craft = add(targetPos(t), polar(rr, ang));
      speed = Math.sqrt(target.mu / rcM) / 1000; phase = w < 0.25 ? "Orbit insertion" : "Science orbit"; altKm = null;
    }
    const tgt = targetPos(t), ea = earthPos(t);
    const lost = lostAt !== null && uIn >= lostAt;
    if (moon) { rangeLabel = "Distance to Moon"; rangeKm = dist(craft, tgt) * 1000; }
    else { rangeLabel = `Distance to ${target.name}`; rangeKm = dist(craft, tgt) * 1e6; }
    return {
      craft, earth: ea, target: tgt, lost,
      telemetry: { metS: t, phase: lost ? (failIndex === 0 ? "Vehicle lost" : "Signal lost") : phase, altKm, speedKmS: lost ? 0 : speed, rangeLabel, rangeKm, sunKm: moon ? undefined : Math.hypot(craft[0], craft[2]) * 1e6 },
    };
  };

  const N = 720, path = new Float32Array((N + 1) * 3), pathRel = new Float32Array((N + 1) * 3);
  for (let i = 0; i <= N; i++) { const sm = sample((i / N) * uEnd), c = sm.craft; path[i * 3] = c[0]; path[i * 3 + 1] = c[1]; path[i * 3 + 2] = c[2]; pathRel[i * 3] = c[0] - sm.target[0]; pathRel[i * 3 + 1] = c[1] - sm.target[1]; pathRel[i * 3 + 2] = c[2] - sm.target[2]; }
  const R = U(Math.max(r1, r2));
  return {
    mode: moon ? "moon" : "sun", unitKm: unitM / 1000, earthR: U(earth.radius_m), targetR: U(target.radius_m), targetName: target.name, uEnd,
    reveal, markers: { seg1: s1, seg2: s2 }, sample, path, pathRel, seg3Index: Math.min(N, Math.ceil((s2 / uEnd) * N)), captureRadius: U(rcM), orbitRadii: moon ? [U(r2)] : [U(r1), U(r2)],
    centre: moon ? [-U(r2) / 2, 0, 0] : [0, 0, 0], viewRadius: R, durationS: moon ? 28 : 34, transferDays: T2 / 86400,
  };
}
