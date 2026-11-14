import type {
  Character, CharacterTrait, CosmeticItem, Lobby, Mission, MissionDifficulty,
  MissionModifier, MissionResult, MissionTelemetry, Player, PlayerProfile,
  UpgradeOption, AttributeKey, Id,
} from "@/types";

export type Unsubscribe = () => void;

export interface PlayerService {
  getProfile(): Promise<PlayerProfile>;
  listPlayers(): Promise<Player[]>;
  listCosmetics(): Promise<CosmeticItem[]>;
  equipCosmetic(itemId: Id | null, category: CosmeticItem["category"]): Promise<void>;
}

export interface LobbyService {
  create(name: string): Promise<Lobby>;
  join(code: string): Promise<Lobby>;
  subscribe(cb: (lobby: Lobby | null) => void): Unsubscribe;
  setReady(playerId: Id, ready: boolean): Promise<void>;
  /** Dev-only simulation hooks; a real implementation may no-op these. */
  simulate: {
    join(): void; leave(): void; changeHost(): void; toggleConnection(): void;
  };
}

export interface MissionCatalogService {
  listMissions(): Promise<Mission[]>;
  listDifficulties(): Promise<MissionDifficulty[]>;
  listModifiers(): Promise<MissionModifier[]>;
}

export interface CharacterCatalogService {
  listCharacters(): Promise<Character[]>;
  listTraits(): Promise<CharacterTrait[]>;
}

export interface ProgressionService {
  getUpgradeOptions(): Promise<UpgradeOption[]>;
  /** Backend decides validity and result; mock simply applies it. */
  purchaseUpgrade(attribute: AttributeKey): Promise<{ profile: PlayerProfile }>;
}

export interface MissionTelemetryService {
  getInitial(): Promise<MissionTelemetry>;
  subscribe(cb: (t: MissionTelemetry) => void): Unsubscribe;
  getResult(): Promise<MissionResult>;
}
