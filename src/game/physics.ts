import { GAME, bodyById, type Destination } from "./data";

const { auInM } = GAME;
const escapeBurn = (mu: number, rp: number, vinf: number) => Math.sqrt(vinf * vinf + (2 * mu) / rp) - Math.sqrt(mu / rp);

/** Hohmann transfer between circular orbits around a body of gravitational parameter mu. */
export function hohmann(mu: number, r1: number, r2: number) {
  const a = (r1 + r2) / 2;
  const v1 = Math.sqrt(mu / r1), v2 = Math.sqrt(mu / r2);
  const dv1 = Math.abs(v1 * (Math.sqrt((2 * r2) / (r1 + r2)) - 1));
  const dv2 = Math.abs(v2 * (1 - Math.sqrt((2 * r1) / (r1 + r2))));
  return { dv1, dv2, timeS: Math.PI * Math.sqrt((a * a * a) / mu) };
}

export interface TransferPlan { departureDv: number; captureDv: number; totalDv: number; transferDays: number; linkDistanceM: number; irradiance: number }

/** Delta-v from a 300 km Earth parking orbit to a captured science orbit, using dataset μ, radii and orbits. */
export function planTransfer(dest: Destination): TransferPlan {
  const earth = bodyById("earth"), sun = bodyById("sun"), target = bodyById(dest.bodyId);
  const rLeo = earth.radius_m + GAME.leoAltitudeM;
  const days = (s: number) => s / 86400;
  if (dest.kind === "moon") {
    const rMoon = target.sma_m as number; // moon orbit around Earth (dataset)
    const t = hohmann(earth.mu, rLeo, rMoon);
    const vinf = Math.sqrt(earth.mu / rMoon) * (1 - Math.sqrt((2 * rLeo) / (rLeo + rMoon)));
    const rp = target.radius_m + 100_000; // 100 km circular lunar orbit
    const capture = escapeBurn(target.mu, rp, vinf);
    return { departureDv: t.dv1, captureDv: capture, totalDv: t.dv1 + capture, transferDays: days(t.timeS), linkDistanceM: rMoon, irradiance: bodyById("earth").irradiance_w_m2 ?? 1361 };
  }
  const r1 = earth.sma_m as number, r2 = target.sma_m as number;
  const h = hohmann(sun.mu, r1, r2);
  const departureDv = escapeBurn(earth.mu, rLeo, h.dv1);
  const rp = target.radius_m + 300_000, ra = target.radius_m * 20; // elliptical capture is far cheaper than circular
  const a = (rp + ra) / 2;
  const capture = Math.sqrt(h.dv2 * h.dv2 + (2 * target.mu) / rp) - Math.sqrt(target.mu * (2 / rp - 1 / a));
  return {
    departureDv, captureDv: capture, totalDv: departureDv + capture, transferDays: days(h.timeS),
    linkDistanceM: Math.sqrt(r1 * r1 + r2 * r2), irradiance: target.irradiance_w_m2 ?? 1361,
  };
}

/** Tsiolkovsky rocket equation. */
export const deltaV = (isp: number, wet: number, dry: number) => isp * GAME.g0 * Math.log(wet / dry);

/** Link rate (bps) for a dish + transmitter at distance d, capped by the radio hardware. */
export const linkRate = (dishM: number, txW: number, distM: number, capBps: number) =>
  Math.min(capBps, (GAME.comms.kBps * dishM * dishM * txW) / (distM * distM));

export const AU = auInM;
