import { create } from "zustand";
import { DEFAULT_DESIGN, evaluate, seedFromDesign, simulate, solvePropellant, type Design, type Evaluation, type MissionResult } from "./engine";
import { GAME } from "./data";

interface GameState {
  design: Design; attempt: number; result: MissionResult | null;
  patch: (p: Partial<Design>) => void;
  toggleInstrument: (id: string) => void;
  autoFill: () => void;
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
export const useEvaluation = (): Evaluation => evaluate(useDesignStore((s) => s.design));
export const TANK = GAME.tankFraction;
