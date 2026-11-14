/**
 * Frontend data contracts. Presentation-only; the backend developer owns
 * authoritative values. References use stable IDs, never display names.
 */
export type Id = string;
export type DifficultyId = "easy" | "medium" | "hard";
export type RoleId = "leader" | "specialist" | "engineer";
export type CosmeticCategory = "suit" | "pattern" | "helmet" | "headgear" | "shoulder" | "boots" | "backpack" | "patch" | "emote";
export type Rarity = "common" | "rare" | "epic" | "legendary";
export type Severity = "low" | "medium" | "high";
export type HudState = "loading" | "normal" | "warning" | "critical";

export interface Player {
  id: Id;
  username: string;
  level: number;
  avatarColor: string;
}

export interface PlayerProgression {
  level: number;
  xp: number;
  xpForNextLevel: number;
  availableXp: number;
}

export interface PlayerAttributes {
  engineering: number;
  research: number;
  coordination: number;
  adaptability: number;
}
export type AttributeKey = keyof PlayerAttributes;

export interface Achievement {
  id: Id;
  name: string;
  description: string;
  unlockedAt?: string;
}

export interface PlayerProfile extends Player {
  playerCode: string;
  progression: PlayerProgression;
  attributes: PlayerAttributes;
  equipped: Record<CosmeticCategory, Id | null>;
  history: {
    attempted: number;
    completed: number;
    bestPerformance: string;
    highestDifficulty: DifficultyId | null;
  };
  achievements: Achievement[];
}

export interface UpgradeOption {
  attribute: AttributeKey;
  cost: number;
  currentValue: number;
  nextValue: number;
}

export interface CosmeticItem {
  id: Id;
  name: string;
  category: CosmeticCategory;
  rarity: Rarity;
  collection: string;
  color: string;
  accent: string;
  unlocked: boolean;
  unlockCondition: string;
  hardModeExclusive: boolean;
}

export interface MissionDifficulty {
  id: DifficultyId;
  label: string;
  description: string;
  xpMultiplier: number;
  modifierSummary: string;
  optionalChallenges: boolean;
}

export type Severity3 = Severity;
export interface MissionModifier {
  id: Id;
  name: string;
  description: string;
  affectedSystem: string;
  severity: Severity;
  icon: "power" | "radio" | "weight" | "alert";
}

export interface MissionReward {
  id: Id;
  label: string;
  kind: "xp" | "cosmetic" | "badge";
}

export interface CrewRole {
  id: RoleId;
  name: string;
  description: string;
  responsibilities: string[];
  required: number;
}

export interface Mission {
  id: Id;
  name: string;
  summary: string;
  /** What is actually playable today, shown on the mission card so the name never over-promises. */
  playable?: string;
  category: string;
  body: "moon" | "earth" | "mars" | "deepspace" | "telescope";
  supportedDifficulties: DifficultyId[];
  minPlayers: number;
  maxPlayers: number;
  durationMinutes: [number, number];
  objectives: string[];
  roleTemplate: CrewRole[];
  modifiersByDifficulty: Record<DifficultyId, Id[]>;
  challengeObjectives: string[];
  rewards: MissionReward[];
  /** Presentation-only: why a mission may be unavailable. */
  restrictions?: Partial<Record<DifficultyId, string>>;
  comingSoon?: string;
}

export interface CharacterTrait {
  id: Id;
  name: string;
  description: string;
}

export interface CharacterStats {
  research: number;
  analysis: number;
  communication: number;
  maintenance: number;
  coordination: number;
}

export interface Character {
  id: Id;
  name: string;
  role: RoleId;
  specialization: string;
  bio: string;
  suitColor: string;
  skinTone: string;
  accent: string;
  stats: CharacterStats;
  traitIds: Id[];
  strengths: string[];
  weaknesses: string[];
}

export interface LobbyMember {
  playerId: Id;
  isHost: boolean;
  ready: boolean;
  connection: "connected" | "reconnecting" | "lost";
}

export interface Lobby {
  id: Id;
  name: string;
  code: string;
  privacy: "private" | "public";
  maxPlayers: number;
  members: LobbyMember[];
}

export interface CrewAssignment {
  playerId: Id;
  roleId: RoleId | null;
  characterId: Id | null;
  confirmedRole: boolean;
  confirmedCharacter: boolean;
}

export interface MissionTelemetry {
  /** MOCK values. Not scientifically validated. */
  massKg: { value: number; max: number; state: HudState };
  powerW: { value: number; max: number; state: HudState };
  budgetM: { value: number; max: number; state: HudState };
  storageGb: { value: number; max: number; state: HudState };
  comms: { label: string; state: HudState };
  timeline: { id: string; label: string; done: boolean; at: string }[];
  events: { id: string; text: string; state: HudState }[];
}

export interface MissionResult {
  /** MOCK. Authoritative result will come from backend. */
  status: "success" | "partial" | "failed";
  objectives: { label: string; done: boolean }[];
  science: number;
  engineering: number;
  efficiency: number;
  crewContribution: { playerId: Id; percent: number }[];
  xpEarned: number;
  cosmeticRewards: Id[];
}
