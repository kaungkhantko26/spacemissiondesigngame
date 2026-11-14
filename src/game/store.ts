import { useMemo } from "react";
import { create } from "zustand";
import { DEFAULT_DESIGN, evaluate, seedFromDesign, simulate, solvePropellant, type Design, type Evaluation, type MissionResult } from "./engine";
import { DATASET, GAME, ANTENNAS, destinationById } from "./data";

interface GameState {
  design: Design; attempt: number; result: MissionResult | null;
  patch: (p: Partial<Design>) => void;
  toggleInstrument: (id: string) => void;
  autoFill: () => void;
  /** One-click: search the catalogue for the most reliable go-for-launch build for a destination. */
  quickStart: (destinationId: string) => boolean;
  launch: () => MissionResult | null;
  reset: () => void; redesign: () => void;
}
export const useDesignStore = create<GameState>((set, get) => ({
  design: DEFAULT_DESIGN, attempt: 0, result: null,
  patch: (p) => set((s) => ({ design: { ...s.design, ...p }, result: null })),
  toggleInstrument: (id) => set((s) => {
    const has = s.design.instrumentIds.includes(id);
    return { design: { ...s.design, instrumentIds: has ? s.design.instrumentIds.filter((x) => x !== id) : [...s.design.instrumentIds, id] }, result: null };
  }),
  autoFill: () => set((s) => {
    // Propellant with zero tank mass in the loop gives the dry base; solve exactly, then add a 15 % reserve.
    const probe = evaluate({ ...s.design, propellantKg: 0 });
    const dryBase = probe.dryKg; // tank = 0 here
    const p = solvePropellant(dryBase, probe.dvRequired, probe.isp);
    return p === null ? s : { design: { ...s.design, propellantKg: Math.ceil(p * 1.15) } };
  }),
  quickStart: (destinationId) => {
    const dest = destinationById(destinationId);
    if (!dest) return false;
    // Prefer the destination's primary tag first (Moon: a magnetometer-class "fields" instrument), then lighter instruments.
    const rank = (t: string) => dest.wants.indexOf(t as (typeof dest.wants)[number]);
    const wanted = DATASET.instruments.filter((i) => dest.wants.includes(i.tag)).sort((a, b) => rank(a.tag) - rank(b.tag) || a.mass_kg - b.mass_kg);
    const props = ["chem", ...DATASET.electric_propulsion.map((e) => e.id)];
    const build = (vehicleId: string, pr: string, th: number, solar: number, antennaId: string, ins: string[]) => {
      const base: Design = { destinationId, vehicleId, propulsionId: pr, thrusters: th, propellantKg: 0, solarAreaM2: solar, rtgUnits: 0, antennaId, instrumentIds: ins, marginPct: 15 };
      const probe = evaluate(base);
      const prop = solvePropellant(probe.dryKg, probe.dvRequired, probe.isp);
      if (prop === null) return null;
      const d = { ...base, propellantKg: Math.ceil(prop * 1.15) };
      return { d, ev: evaluate(d) };
    };
    // Candidate payloads: the destination's wanted tags first (diverse = one per wanted tag), then lighter/heavier mixes.
    const diverse = dest.wants.map((t) => wanted.find((i) => i.tag === t)).filter((i): i is (typeof wanted)[number] => !!i).map((i) => i.id);
    const sets: string[][] = [diverse.slice(0, 2), diverse.slice(0, 3), wanted.slice(0, 2).map((i) => i.id), wanted.slice(0, 3).map((i) => i.id)]
      .filter((x, i, a) => x.length > 0 && a.findIndex((y) => y.join() === x.join()) === i);
    // Phase 1: coarse sweep over vehicle × propulsion (strong power/antenna, two instruments), keep the best few.
    const seeds: { v: string; pr: string; th: number; score: number }[] = [];
    for (const v of DATASET.vehicles) for (const pr of props) for (const th of pr === "chem" ? [1] : [2]) {
      const r = build(v.id, pr, th, 30, "high", sets[0]);
      if (r) seeds.push({ v: v.id, pr, th, score: r.ev.probabilities.mission * (r.ev.goNoGo ? 1 : 0.01) });
    }
    seeds.sort((x, y) => y.score - x.score);
    // Phase 2: refine power, antenna and payload. The contract's science target comes FIRST; only then rank by reliability
    // and cost (otherwise the optimiser is rewarded for dropping instruments, which lower flight reliability).
    interface Cand { d: Design; p: number; c: number; sci: number }
    const cands: Cand[] = [];
    for (const sd of seeds.slice(0, 6)) for (const solar of [6, 12, 20, 30, 45, 60]) for (const ant of ANTENNAS) for (const ins of sets) {
      const r = build(sd.v, sd.pr, sd.th, solar, ant.id, ins);
      if (r && r.ev.goNoGo) cands.push({ d: r.d, p: r.ev.probabilities.mission, c: r.ev.costUsd, sci: r.ev.science });
    }
    const meets = cands.filter((c) => c.sci >= dest.scienceGoal);
    const best = meets.length
      ? meets.reduce((a, c) => (c.p > a.p + 1e-9 || (Math.abs(c.p - a.p) <= 1e-9 && c.c < a.c) ? c : a))
      : cands.reduce<Cand | null>((a, c) => (!a || c.sci * c.p > a.sci * a.p ? c : a), null);
    if (!best) return false;
    set({ design: best.d, result: null });
    return true;
  },
  launch: () => {
    const { design, attempt } = get();
    const ev = evaluate(design);
    if (!ev.goNoGo) return null;
    const result = simulate(ev, seedFromDesign(design, attempt));
    set({ result, attempt: attempt + 1 });
    return result;
  },
  reset: () => set({ design: DEFAULT_DESIGN, attempt: 0, result: null }),
  redesign: () => set({ result: null }),
}));
export const useEvaluation = (): Evaluation => { const d = useDesignStore((s) => s.design); return useMemo(() => evaluate(d), [d]); };
export const TANK = GAME.tankFraction;
