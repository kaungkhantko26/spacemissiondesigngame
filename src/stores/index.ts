"use client";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  AttributeKey, CosmeticCategory, CosmeticItem, CrewAssignment, DifficultyId,
  Id, Lobby, PlayerProfile, RoleId,
} from "@/types";
import { cosmetics as cosmeticSeed, profile as profileSeed } from "@/data/mock";
import { useProgress } from "@/game/progress";
import { lobbyService, playerService, progressionService } from "@/services/mocks";

/* ---------- UI (transient) ---------- */
export interface Toast { id: number; message: string; tone: "info" | "success" | "error" }
export interface ConfirmRequest {
  title: string; body: string; confirmLabel: string; danger?: boolean; onConfirm: () => void;
}
interface UIState {
  toasts: Toast[];
  confirm: ConfirmRequest | null;
  muted: boolean;
  reducedMotion: boolean;
  highContrast: boolean;
  quality: "low" | "medium" | "high";
  booted: boolean;
  toast: (message: string, tone?: Toast["tone"]) => void;
  dismissToast: (id: number) => void;
  askConfirm: (c: ConfirmRequest) => void;
  closeConfirm: () => void;
  set: (p: Partial<Pick<UIState, "muted" | "reducedMotion" | "highContrast" | "quality" | "booted">>) => void;
}
let toastId = 1;
export const useUIStore = create<UIState>((set) => ({
  toasts: [], confirm: null, muted: false, reducedMotion: false, highContrast: false,
  quality: "medium", booted: false,
  toast: (message, tone = "info") => {
    const id = toastId++;
    set((s) => ({ toasts: [...s.toasts, { id, message, tone }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 3500);
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  askConfirm: (confirm) => set({ confirm }),
  closeConfirm: () => set({ confirm: null }),
  set: (p) => set(p),
}));

/* ---------- Player (mock stand-in for server-owned state) ---------- */
interface PlayerState {
  profile: PlayerProfile;
  upgrade: (a: AttributeKey) => Promise<void>;
  equip: (category: CosmeticCategory, id: Id | null) => Promise<void>;
}
export const usePlayerStore = create<PlayerState>((set) => ({
  profile: profileSeed,
  upgrade: async (a) => { const r = await progressionService.purchaseUpgrade(a); set({ profile: r.profile }); },
  equip: async (category, id) => {
    await playerService.equipCosmetic(id, category);
    set((s) => ({ profile: { ...s.profile, equipped: { ...s.profile.equipped, [category]: id } } }));
    useProgress.getState().setEquipped(category, id);
  },
}));

/* ---------- Cosmetics (transient preview state) ---------- */
interface CosmeticsState {
  items: CosmeticItem[];
  category: CosmeticCategory;
  previewId: Id | null;
  setCategory: (c: CosmeticCategory) => void;
  preview: (id: Id | null) => void;
}
export const useCosmeticsStore = create<CosmeticsState>((set) => ({
  items: cosmeticSeed, category: "suit", previewId: null,
  setCategory: (category) => set({ category, previewId: null }),
  preview: (previewId) => set({ previewId }),
}));

/* ---------- Lobby (mock subscription) ---------- */
interface LobbyState {
  lobby: Lobby | null;
  connected: boolean;
  connect: () => () => void;
  create: (name: string) => Promise<void>;
  join: (code: string) => Promise<void>;
}
export const useLobbyStore = create<LobbyState>((set) => ({
  lobby: null, connected: false,
  connect: () => {
    const off = lobbyService.subscribe((lobby) => set({ lobby, connected: !!lobby }));
    return off;
  },
  create: async (name) => { await lobbyService.create(name); },
  join: async (code) => { await lobbyService.join(code); },
}));

/* ---------- Mission setup ---------- */
/** Session-only persistence so refreshing a Team Up step does not bounce the player back to mission select. Hydrated manually after mount. */
const sessionStore = createJSONStorage(() => {
  try { return window.sessionStorage; } catch { return { getItem: () => null, setItem: () => undefined, removeItem: () => undefined }; }
});
interface MissionSetupState {
  difficultyId: DifficultyId;
  missionId: Id | null;
  setDifficulty: (d: DifficultyId) => void;
  setMission: (id: Id | null) => void;
  reset: () => void;
}
export const useMissionSetupStore = create<MissionSetupState>()(persist((set) => ({
  difficultyId: "easy", missionId: null,
  setDifficulty: (difficultyId) => set({ difficultyId, missionId: null }),
  setMission: (missionId) => set({ missionId }),
  reset: () => set({ difficultyId: "easy", missionId: null }),
}), { name: "smd-mission-setup", storage: sessionStore, skipHydration: true }));

/* ---------- Crew selection ---------- */
interface CrewState {
  assignments: Record<Id, CrewAssignment>;
  ensure: (playerIds: Id[]) => void;
  chooseRole: (playerId: Id, role: RoleId | null) => void;
  confirmRole: (playerId: Id) => void;
  chooseCharacter: (playerId: Id, characterId: Id | null) => void;
  confirmCharacter: (playerId: Id) => void;
  autoFill: (playerIds: Id[], roleOrder: RoleId[], charByRole: (r: RoleId, i: number) => Id | null) => void;
  reset: () => void;
}
const blank = (playerId: Id): CrewAssignment => ({ playerId, roleId: null, characterId: null, confirmedRole: false, confirmedCharacter: false });
export const useCrewSelectionStore = create<CrewState>()(persist((set) => ({
  assignments: {},
  ensure: (ids) => set((s) => {
    const next = { ...s.assignments };
    ids.forEach((id) => { if (!next[id]) next[id] = blank(id); });
    return { assignments: next };
  }),
  chooseRole: (pid, roleId) => set((s) => ({
    assignments: { ...s.assignments, [pid]: { ...(s.assignments[pid] ?? blank(pid)), roleId, confirmedRole: false, characterId: null, confirmedCharacter: false } },
  })),
  confirmRole: (pid) => set((s) => ({ assignments: { ...s.assignments, [pid]: { ...s.assignments[pid], confirmedRole: true } } })),
  chooseCharacter: (pid, characterId) => set((s) => ({
    assignments: { ...s.assignments, [pid]: { ...s.assignments[pid], characterId, confirmedCharacter: false } },
  })),
  confirmCharacter: (pid) => set((s) => ({ assignments: { ...s.assignments, [pid]: { ...s.assignments[pid], confirmedCharacter: true } } })),
  autoFill: (ids, roleOrder, charByRole) => set((s) => {
    const next = { ...s.assignments };
    const used: Record<string, number> = {};
    ids.forEach((id, i) => {
      const role = next[id]?.roleId ?? roleOrder[i % roleOrder.length];
      const idx = (used[role] = (used[role] ?? -1) + 1);
      const cur = next[id] ?? blank(id);
      next[id] = { ...cur, roleId: role, confirmedRole: true, characterId: cur.characterId ?? charByRole(role, idx), confirmedCharacter: true };
    });
    return { assignments: next };
  }),
  reset: () => set({ assignments: {} }),
}), { name: "smd-crew-selection", storage: sessionStore, skipHydration: true }));

/** Restore the Team Up setup from this tab's session (refresh-safe). */
export const hydrateTeamSetup = () => Promise.all([useMissionSetupStore.persist.rehydrate(), useCrewSelectionStore.persist.rehydrate()]).then(() => undefined);
