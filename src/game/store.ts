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
    const wanted = DATASET.instruments.filter((i) => dest.wants.includes(i.tag)).sort((a, b) => a.mass_kg - b.mass_kg);
    const props = ["chem", ...DATASET.electric_propulsion.map((e) => e.id)];
    const build = (vehicleId: string, pr: string, th: number, solar: number, antennaId: string, ins: string[]) => {
      const base: Design = { destinationId, vehicleId, propulsionId: pr, thrusters: th, propellantKg: 0, solarAreaM2: solar, rtgUnits: 0, antennaId, instrumentIds: ins, marginPct: 15 };
      const probe = evaluate(base);
      const prop = solvePropellant(probe.dryKg, probe.dvRequired, probe.isp);
      if (prop === null) return null;
      const d = { ...base, propellantKg: Math.ceil(prop * 1.15) };
      return { d, ev: evaluate(d) };
    };
    // Phase 1: coarse sweep over vehicle × propulsion (fixed mid-size power/antenna), keep the best few.
    const one = wanted.slice(0, 1).map((i) => i.id);
    const seeds: { v: string; pr: string; th: number; score: number }[] = [];
    for (const v of DATASET.vehicles) for (const pr of props) for (const th of pr === "chem" ? [1] : [2]) {
      const r = build(v.id, pr, th, 20, "medium", one);
      if (r) seeds.push({ v: v.id, pr, th, score: r.ev.probabilities.mission * (r.ev.goNoGo ? 1 : 0.01) });
    }
    seeds.sort((x, y) => y.score - x.score);
    // Phase 2: refine power, antenna and instruments for the leading candidates.
    let best: { d: Design; p: number; c: number } | null = null;
    for (const sd of seeds.slice(0, 6)) for (const solar of [6, 12, 20, 30]) for (const ant of ANTENNAS) for (const ins of [one, wanted.slice(0, 2).map((i) => i.id)]) {
      const r = build(sd.v, sd.pr, sd.th, solar, ant.id, ins);
      if (!r || !r.ev.goNoGo) continue;
      const p = r.ev.probabilities.mission;
      if (!best || p > best.p + 1e-9 || (Math.abs(p - best.p) <= 1e-9 && r.ev.costUsd < best.c)) best = { d: r.d, p, c: r.ev.costUsd };
    }
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
