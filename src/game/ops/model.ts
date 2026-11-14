import { GAME } from "../data";
import { OPS } from "./core";

/**
 * ONE power/data model shared by Mission Architect (design readiness) and Mission Control (live operations), so a design the
 * Architect calls GO is judged by the same rules the operations simulation then applies. (Game-balanced, simplified.)
 */
export const OPS_POINTING = { moon: 0.55, earth: 0.6, sun: 1 } as const;
/** Planned operating mix used for the orbit-average check: observe this share of the time, downlink the rest. */
export const OPS_DUTY = { observe: 0.6, downlink: 0.4 } as const;
/** Share of each day the ground station can actually receive during science (station up × Earth in view). */
export const downlinkWindow = () => OPS.stationUpFrac * OPS.earthVisFrac;

export interface PowerInputs { solarW: number; rtgW: number; instW: number; txW: number }
export interface ModePower { gen: number; genAvg: number; load: number }
export interface OpsPower { science: ModePower; downlink: ModePower; avgGen: number; avgLoad: number; eclipseWh: number; batteryUsableWh: number }

/** Solar is switched off in eclipse (orbit-average factor) and derated by pointing; RTG output is constant. */
export function opsPower(i: PowerInputs): OpsPower {
  const sunFrac = 1 - OPS.eclipseFrac;
  const solar = (pf: number) => i.solarW * OPS.arrayDerate * pf;
  const science: ModePower = { gen: solar(OPS_POINTING.moon) + i.rtgW, genAvg: solar(OPS_POINTING.moon) * sunFrac + i.rtgW, load: GAME.busPowerW + i.instW + 5 };
  const downlink: ModePower = { gen: solar(OPS_POINTING.earth) + i.rtgW, genAvg: solar(OPS_POINTING.earth) * sunFrac + i.rtgW, load: GAME.busPowerW + i.instW * 0.1 + i.txW / GAME.comms.amplifierEff };
  const avgGen = OPS_DUTY.observe * science.genAvg + OPS_DUTY.downlink * downlink.genAvg;
  const avgLoad = OPS_DUTY.observe * science.load + OPS_DUTY.downlink * downlink.load;
  // Energy the battery must supply through one eclipse while observing (RTG keeps contributing).
  const eclipseWh = (Math.max(0, science.load - i.rtgW) * OPS.eclipseFrac * OPS.orbitPeriodS) / 3600;
  return { science, downlink, avgGen, avgLoad, eclipseWh, batteryUsableWh: OPS.batteryWh * 0.8 };
}

/** Largest share of time the spacecraft can observe while still returning everything it records (data balance). */
export function sustainableObserveFrac(instKbpsSum: number, linkBps: number): number {
  const R = (instKbpsSum * OPS.dataScale) / 1000;        // Mbps generated while observing
  const L = (linkBps / 1e6) * OPS.linkScale * downlinkWindow(); // Mbps returnable, averaged over the day
  return R <= 0 ? 1 : L / (R + L);
}
/** Observing share needed to finish the survey inside the science window. */
export const requiredObserveFrac = (hasFields: boolean) => Math.min(1, (OPS.goalCoverage * OPS.coverageDays) / (OPS.scienceDays * (hasFields ? 1 : 0.3)));
