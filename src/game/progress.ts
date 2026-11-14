"use client";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { cosmetics } from "@/data/mock";
import type { CosmeticCategory, CosmeticItem, Id } from "@/types";

/** What the player has actually done in the game; unlocks cosmetics. Saved in this browser (localStorage). */
export interface Progress {
  flights: number; wins: number; orbits: number; moons: number; hardWins: number; pilotWins: number; moonsPilot: number; sGrades: number; teamRuns: number;
  equipped: Partial<Record<CosmeticCategory, Id | null>>;
}
const ZERO: Progress = { flights: 0, wins: 0, orbits: 0, moons: 0, hardWins: 0, pilotWins: 0, moonsPilot: 0, sGrades: 0, teamRuns: 0, equipped: {} };

/** How each item is earned, in terms the game can verify. `level` is the player's level (mock profile: 28). */
type Rule = { label: string; test: (p: Progress, level: number) => boolean };
const R = (label: string, test: Rule["test"]): Rule => ({ label, test });
export const UNLOCK_RULES: Record<Id, Rule> = {
  "suit-classic": R("Starter item", () => true), "suit-orange": R("Reach level 10", (_, l) => l >= 10), "suit-neon": R("Complete 3 flights", (p) => p.flights >= 3),
  "suit-lunar": R("Fly the Moon mission", (p) => p.moons >= 1), "suit-mars": R("Complete the Moon mission 3 times", (p) => p.moons >= 3),
  "suit-stealth": R("Reach orbit on Pilot or Commander", (p) => p.pilotWins >= 1), "suit-gold": R("Win a Commander flight", (p) => p.hardWins >= 1),
  "helmet-classic": R("Starter item", () => true), "helmet-lunar": R("Fly the Moon mission", (p) => p.moons >= 1), "helmet-neon": R("Win a Commander flight", (p) => p.hardWins >= 1),
  "pack-std": R("Starter item", () => true), "pack-telescope": R("Finish a Team Up mission", (p) => p.teamRuns >= 1),
  "patch-mission": R("Starter item", () => true), "patch-nasa": R("Starter item", () => true), "patch-myanmar": R("Starter item", () => true),
  "pack-jet": R("Complete 5 flights", (p) => p.flights >= 5), "pack-solar": R("Reach orbit 3 times", (p) => p.orbits >= 3), "patch-earth": R("Reach orbit once", (p) => p.orbits >= 1),
  "pattern-stripes": R("Complete 2 flights", (p) => p.flights >= 2), "pattern-stars": R("Complete 3 flights", (p) => p.flights >= 3), "pattern-circuit": R("Reach level 20", (_, l) => l >= 20),
  "pattern-camo": R("Fly the Moon mission on Pilot or Commander", (p) => p.moonsPilot >= 1),
  "head-antenna": R("Starter item", () => true), "head-lamp": R("Fly the Moon mission", (p) => p.moons >= 1), "head-halo": R("Win 3 flights", (p) => p.wins >= 3), "head-crown": R("Win 2 Commander flights", (p) => p.hardWins >= 2),
  "shoulder-flag": R("Starter item", () => true), "shoulder-pads": R("Reach level 15", (_, l) => l >= 15), "shoulder-beacon": R("Earn an S grade", (p) => p.sGrades >= 1),
  "boots-moon": R("Fly the Moon mission", (p) => p.moons >= 1), "boots-thruster": R("Reach level 10", (_, l) => l >= 10),
  "emote-wave": R("Starter item", () => true), "emote-cheer": R("Win 5 flights", (p) => p.wins >= 5),
};
export const isUnlocked = (id: Id, p: Progress, level: number) => (UNLOCK_RULES[id]?.test(p, level) ?? false);
/** Items with their unlocked flag and unlock text taken from the rules above. */
export const withUnlocks = (p: Progress, level: number): CosmeticItem[] => cosmetics.map((c) => ({ ...c, unlocked: isUnlocked(c.id, p, level), unlockCondition: UNLOCK_RULES[c.id]?.label ?? c.unlockCondition }));

interface Store extends Progress {
  /** Record a finished flight; returns the names of cosmetics it just unlocked. */
  recordFlight: (r: { ok: boolean; mission: "orbit" | "moon"; difficulty: "easy" | "medium" | "hard"; grade?: string }, level: number) => string[];
  recordMoonCapture: (difficulty: "easy" | "medium" | "hard", level: number) => string[];
  recordTeamRun: (level: number) => string[];
  setEquipped: (cat: CosmeticCategory, id: Id | null) => void;
}
const storage = createJSONStorage(() => { try { return window.localStorage; } catch { return { getItem: () => null, setItem: () => undefined, removeItem: () => undefined }; } });
const diff = (before: Progress, after: Progress, level: number) => cosmetics.filter((c) => !isUnlocked(c.id, before, level) && isUnlocked(c.id, after, level)).map((c) => c.name);
const snapshot = (s: Progress): Progress => ({ flights: s.flights, wins: s.wins, orbits: s.orbits, moons: s.moons, hardWins: s.hardWins, pilotWins: s.pilotWins, moonsPilot: s.moonsPilot, sGrades: s.sGrades, teamRuns: s.teamRuns, equipped: s.equipped });

export const useProgress = create<Store>()(persist((set, get) => {
  const bump = (patch: (p: Progress) => Partial<Progress>, level: number) => {
    const before = snapshot(get()); set(patch(before)); return diff(before, snapshot(get()), level);
  };
  return {
    ...ZERO,
    recordFlight: (r, level) => bump((p) => ({
      flights: p.flights + 1, wins: p.wins + (r.ok ? 1 : 0), orbits: p.orbits + (r.ok && r.mission === "orbit" ? 1 : 0),
      hardWins: p.hardWins + (r.ok && r.difficulty === "hard" ? 1 : 0), pilotWins: p.pilotWins + (r.ok && r.difficulty !== "easy" ? 1 : 0), sGrades: p.sGrades + (r.ok && r.grade === "S" ? 1 : 0),
    }), level),
    recordMoonCapture: (difficulty, level) => bump((p) => ({ moons: p.moons + 1, moonsPilot: p.moonsPilot + (difficulty !== "easy" ? 1 : 0) }), level),
    recordTeamRun: (level) => bump((p) => ({ teamRuns: p.teamRuns + 1 }), level),
    setEquipped: (cat, id) => set((s) => ({ equipped: { ...s.equipped, [cat]: id } })),
  };
}, { name: "smd-progress", storage, skipHydration: true }));
