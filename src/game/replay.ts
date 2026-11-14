import { evaluate, type Design, type Evaluation } from "./engine";
import { ANTENNAS } from "./data";
import { OPS, advance, applyPlan, buildReport, createOpsFromMission, planNextDay, resolveEvent, type OpsState } from "./ops/sim";
import { eventById } from "./ops/events";

/**
 * Same-seed comparison: fly the SAME scenario (same random numbers, same event timing rules, same survey regions, same controller)
 * twice, once with your design and once with ONE changed engineering choice, and show what the change did.
 * Both runs use the same assisted controller (daily auto-plan, best available event choice), so the difference comes from the design
 * and not from who was flying. It is an explanation tool, not a replay of your own flying.
 */
export interface Variant { id: string; label: string; apply: (d: Design) => Design; why: (a: RunSummary, b: RunSummary) => string }
export interface RunSummary {
  ok: boolean; phase: OpsState["phase"]; score: number; grade: string; coverage: number; usefulGb: number; generatedGb: number; returnedGb: number; returnedShare: number;
  lostGb: number; brownouts: number; safeDays: number; health: number; goNoGo: boolean; antenna: string; arrayM2: number; rtg: number; costUsd: number; fieldNotes: string[];
}
const smaller = (id: string) => { const i = ANTENNAS.findIndex((a) => a.id === id); return ANTENNAS[Math.max(0, i - 1)].id; };
const bigger = (id: string) => { const i = ANTENNAS.findIndex((a) => a.id === id); return ANTENNAS[Math.min(ANTENNAS.length - 1, i + 1)].id; };

export const VARIANTS: Variant[] = [
  { id: "antenna-down", label: "One size smaller antenna", apply: (d) => ({ ...d, antennaId: smaller(d.antennaId) }),
    why: (a, b) => `Smaller dish: the downlink share fell from ${(a.returnedShare * 100).toFixed(0)} % to ${(b.returnedShare * 100).toFixed(0)} %, so less of what the instruments recorded reached Earth, and ${b.lostGb.toFixed(1)} GB was lost when the recorder filled.` },
  { id: "antenna-up", label: "One size bigger antenna", apply: (d) => ({ ...d, antennaId: bigger(d.antennaId) }),
    why: (a, b) => `Bigger dish: more data fits through each ground pass (${(b.returnedShare * 100).toFixed(0)} % returned vs ${(a.returnedShare * 100).toFixed(0)} %), but it costs more mass and money.` },
  { id: "array-down", label: "Solar array 70 % smaller", apply: (d) => ({ ...d, solarAreaM2: Math.max(3, Math.round(d.solarAreaM2 * 0.3)) }),
    why: (a, b) => `Much smaller array: less power in sunlight. Brownouts went from ${a.brownouts} to ${b.brownouts} and safe-mode time from ${a.safeDays.toFixed(1)} to ${b.safeDays.toFixed(1)} days; science stops while the spacecraft is in safe mode.` },
  { id: "rtg-up", label: "Add one RTG", apply: (d) => ({ ...d, rtgUnits: d.rtgUnits + 1 }),
    why: (a, b) => `One RTG gives constant power, even in eclipse: brownouts ${a.brownouts} to ${b.brownouts}. It adds mass, cost and a small reliability penalty.` },
];

function summarise(n: OpsState, ev: Evaluation): RunSummary {
  const rep = buildReport(n, ev), gen = n.stats.generatedGb;
  const notes: string[] = [];
  if (n.stats.blackouts) notes.push(`${n.stats.blackouts} brownout${n.stats.blackouts === 1 ? "" : "s"}`);
  if (n.stats.safeS > 0) notes.push(`${(n.stats.safeS / 86400).toFixed(1)} days in safe mode`);
  return {
    ok: rep.outcome === "success", phase: n.phase, score: rep.total, grade: rep.grade, coverage: n.coverage, usefulGb: n.stats.usefulReturnedGb, generatedGb: gen, returnedGb: n.stats.returnedGb,
    returnedShare: gen > 0 ? Math.min(1, n.stats.returnedGb / gen) : 0, lostGb: n.stats.lostGb, brownouts: n.stats.blackouts, safeDays: n.stats.safeS / 86400,
    health: Math.min(n.health.power, n.health.comms, n.health.instruments, n.health.propulsion), goNoGo: ev.goNoGo, antenna: ev.antenna.name, arrayM2: ev.design.solarAreaM2, rtg: ev.design.rtgUnits, costUsd: ev.costUsd, fieldNotes: notes,
  };
}

/** One full assisted operations run for a design and a fixed seed. */
export function runAssisted(design: Design, targets: string[], attempt: number): RunSummary {
  const ev = evaluate(design);
  let n = createOpsFromMission(ev, { attempt, targets, transit: { departureBy: "launcher", transferDays: ev.cruiseDays } });
  for (let day = 0; day < OPS.scienceDays + 1 && n.phase === "science"; day++) {
    n = applyPlan(n, planNextDay(n));
    for (let i = 0; i < 144 && n.phase === "science"; i++) {
      if (n.event) { const def = eventById(n.event.id); if (def) { const ok = def.choices.filter((c) => !c.unavailable?.(n, ev)); const best = [...(ok.length ? ok : def.choices)].sort((a, b) => b.quality - a.quality)[0]; n = resolveEvent(n, ev, best.id); } }
      n = advance(n, ev, 600);
    }
  }
  return summarise(n, ev);
}

export interface Comparison { variant: Variant; base: RunSummary; changed: RunSummary; explanation: string; seed: number }
/** Plain-language summary of what changed between two runs, including trade-offs the grade can hide. */
export function describeChange(a: RunSummary, b: RunSummary): string[] {
  const out: string[] = [], pc = (x: number) => `${(x * 100).toFixed(0)} %`;
  const dCov = b.coverage - a.coverage, dRet = b.returnedShare - a.returnedShare, dCost = b.costUsd - a.costUsd;
  if (Math.abs(dCov) < 0.01 && Math.abs(dRet) < 0.02 && a.brownouts === b.brownouts && Math.abs(a.safeDays - b.safeDays) < 0.5) out.push("In this scenario the change made no visible difference to the science: the original design already had margin here. A change that costs nothing in results is a chance to save mass or money.");
  else {
    if (Math.abs(dCov) >= 0.01) out.push(`Survey coverage went from ${pc(a.coverage)} to ${pc(b.coverage)}.`);
    if (Math.abs(dRet) >= 0.02) out.push(`Share of recorded data that reached Earth went from ${pc(a.returnedShare)} to ${pc(b.returnedShare)}.`);
    if (a.brownouts !== b.brownouts || Math.abs(a.safeDays - b.safeDays) >= 0.5) out.push(`Brownouts ${a.brownouts} to ${b.brownouts}; days in safe mode ${a.safeDays.toFixed(1)} to ${b.safeDays.toFixed(1)}.`);
  }
  if (Math.abs(dCost) >= 1e5) out.push(`Cost ${dCost > 0 ? "rose" : "fell"} by $${(Math.abs(dCost) / 1e6).toFixed(1)}M.`);
  if (b.score >= a.score && (dCov < -0.01 || dRet < -0.02)) out.push("Note: the overall score did not drop even though less science came home, because the score also rewards low cost and margin. Compare the science numbers, not just the grade.");
  return out;
}
export function compare(design: Design, targets: string[], attempt: number, variantId: string): Comparison {
  const variant = VARIANTS.find((v) => v.id === variantId) ?? VARIANTS[0];
  const base = runAssisted(design, targets, attempt), changed = runAssisted(variant.apply(design), targets, attempt);
  return { variant, base, changed, explanation: variant.why(base, changed), seed: attempt };
}
