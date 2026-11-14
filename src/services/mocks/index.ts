import type {
  CharacterCatalogService, LobbyService, MissionCatalogService,
  MissionTelemetryService, PlayerService, ProgressionService,
} from "../contracts";
import {
  characters, cosmetics, difficulties, missions, modifiers, players, profile,
  resultSeed, telemetrySeed, traits,
} from "@/data/mock";
import type { Lobby, PlayerProfile } from "@/types";

const delay = <T,>(v: T, ms = 120) => new Promise<T>((r) => setTimeout(() => r(v), ms));
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

let profileState: PlayerProfile = clone(profile);

export const playerService: PlayerService = {
  getProfile: () => delay(clone(profileState)),
  listPlayers: () => delay(clone(players)),
  listCosmetics: () => delay(clone(cosmetics)),
  async equipCosmetic(itemId, category) {
    profileState = { ...profileState, equipped: { ...profileState.equipped, [category]: itemId } };
  },
};

export const missionCatalogService: MissionCatalogService = {
  listMissions: () => delay(clone(missions)),
  listDifficulties: () => delay(clone(difficulties)),
  listModifiers: () => delay(clone(modifiers)),
};

export const characterCatalogService: CharacterCatalogService = {
  listCharacters: () => delay(clone(characters)),
  listTraits: () => delay(clone(traits)),
};

export const progressionService: ProgressionService = {
  async getUpgradeOptions() {
    const a = profileState.attributes;
    return (Object.keys(a) as (keyof typeof a)[]).map((k) => ({
      attribute: k, currentValue: a[k], nextValue: a[k] + 1, cost: 200 + a[k] * 100,
    }));
  },
  async purchaseUpgrade(attribute) {
    // MOCK economy: backend owns real costs/formulas.
    const cost = 200 + profileState.attributes[attribute] * 100;
    profileState = {
      ...profileState,
      attributes: { ...profileState.attributes, [attribute]: profileState.attributes[attribute] + 1 },
      progression: { ...profileState.progression, availableXp: Math.max(0, profileState.progression.availableXp - cost) },
    };
    return delay({ profile: clone(profileState) });
  },
};

/* ----- Lobby (in-memory mock) ----- */
let lobby: Lobby | null = null;
const subs = new Set<(l: Lobby | null) => void>();
const emit = () => subs.forEach((cb) => cb(lobby ? clone(lobby) : null));
const mkLobby = (name: string, code: string): Lobby => ({
  id: "lobby-1", name, code, privacy: "private", maxPlayers: 4,
  members: [{ playerId: "p1", isHost: true, ready: false, connection: "connected" }],
});
const nextPlayerId = () => players.find((p) => !lobby!.members.some((m) => m.playerId === p.id))?.id;

export const lobbyService: LobbyService = {
  async create(name) { lobby = mkLobby(name, "SMD-7324"); emit(); return clone(lobby); },
  async join(code) {
    lobby = mkLobby("Joined Crew", code.toUpperCase());
    lobby.members.unshift({ playerId: "p2", isHost: true, ready: true, connection: "connected" });
    lobby.members[1].isHost = false;
    emit(); return clone(lobby);
  },
  subscribe(cb) { subs.add(cb); cb(lobby ? clone(lobby) : null); return () => { subs.delete(cb); }; },
  async setReady(playerId, ready) {
    if (!lobby) return;
    lobby.members = lobby.members.map((m) => (m.playerId === playerId ? { ...m, ready } : m));
    emit();
  },
  simulate: {
    join() {
      if (!lobby || lobby.members.length >= lobby.maxPlayers) return;
      const id = nextPlayerId(); if (!id) return;
      lobby.members.push({ playerId: id, isHost: false, ready: false, connection: "connected" });
      emit();
    },
    leave() {
      if (!lobby || lobby.members.length <= 1) return;
      const left = lobby.members[lobby.members.length - 1];
      lobby.members.pop();
      if (left.isHost) lobby.members[0].isHost = true;
      emit();
    },
    changeHost() {
      if (!lobby || lobby.members.length < 2) return;
      const i = lobby.members.findIndex((m) => m.isHost);
      lobby.members = lobby.members.map((m, idx) => ({ ...m, isHost: idx === (i + 1) % lobby!.members.length }));
      emit();
    },
    toggleConnection() {
      if (!lobby || lobby.members.length < 2) return;
      const m = lobby.members[1];
      m.connection = m.connection === "connected" ? "lost" : "connected";
      emit();
    },
  },
};

export const missionTelemetryService: MissionTelemetryService = {
  getInitial: () => delay(clone(telemetrySeed)),
  subscribe(cb) {
    let t = clone(telemetrySeed);
    const id = setInterval(() => {
      t = { ...t, powerW: { ...t.powerW, value: Math.max(300, Math.min(1000, t.powerW.value + (Math.random() * 40 - 20))) } };
      cb(clone(t));
    }, 1500);
    return () => clearInterval(id);
  },
  getResult: () => delay(clone(resultSeed)),
};
