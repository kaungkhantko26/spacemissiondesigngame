/**
 * Live backend contract (mirrors the game server). Everything here is what the server SENDS;
 * the frontend only displays it. Ids are stable strings.
 */
export type Difficulty = "easy" | "medium" | "hard";
export type RoleId = "lead" | "engineer" | "science" | "comms";
export type StatId = "planning" | "engineering" | "science" | "comms" | "resilience";
export type CheckStatus = "pass" | "warn" | "fail";
export type RoomStatus = "lobby" | "roles" | "design" | "report";
export type Outcome = "success" | "partial" | "failure" | "launch_failure";

export interface DifficultyInfo {
  label: string; budgetMult: number; deadlineMult: number; eventRate: number; launchFailure: boolean;
  massGrowth: number; xpMult: number; disposalYears: number; blurb: string;
}
export interface StatInfo { id: StatId; label: string; desc: string }
export interface RoleInfo { id: RoleId; label: string; icon: string; desc: string; controls: string[] }
export interface Trait { id: string; label: string; desc: string }
export interface CharacterInfo {
  id: string; role: RoleId; name: string; title: string; bio: string;
  stats: Record<StatId, number>; traits: Trait[]; flaw: Trait;
}
export interface TraitEffectLine { text: string; good: boolean }
export interface TraitPreview {
  perks: { id: string; label: string; effects: TraitEffectLine[] }[];
  flaw: { id: string; label: string; active: boolean; strength: number; effects: TraitEffectLine[] } | null;
}
export interface Objective { id: string; label: string; type: string; required: boolean; points: number; why: string }
export interface ChallengeDef { id: string; name: string; desc: string }
export interface ChallengeSetDef { timeLimitMin: number; tiers: { need: number; reward: string }[]; list: ChallengeDef[] }
export interface MissionInfo {
  id: string; destinationId: string; name: string; tagline: string; brief: string; teach: string; type: string; tier: number;
  body: "earth" | "moon" | "mars" | "deepspace" | "telescope";
  difficulties: Difficulty[]; lockedReason: Partial<Record<Difficulty, string>>;
  slots: { slot: string; role: RoleId }[];
  baseXP: number; objectives: Objective[]; modifiers: Partial<Record<Difficulty, string[]>>;
  challenges: Partial<Record<"hard", ChallengeSetDef>>;
}
export interface ComingSoon { id: string; name: string; tagline: string; body: MissionInfo["body"]; category: string; difficulties: Difficulty[]; note: string }
export interface ModifierInfo { id: string; name: string; desc: string }
export interface CosmeticItem { id: string; slot: string; name: string; rarity: "common" | "rare" | "epic" | "legendary"; unlock: string }
export interface CosmeticsInfo {
  slots: { id: string; label: string }[]; items: CosmeticItem[];
  ranks: { minXp: number; title: string }[]; upgrades: { maxLevel: number; baseCost: number; perLevelBonus: number };
}

/** The real-data design model (same data the offline Mission Architect uses). */
export interface DesignCatalog {
  dataset: import("@/game/data").DesignDataset; antennas: import("@/game/data").Antenna[]; destinations: import("@/game/data").Destination[];
  game: Record<string, unknown>; defaultVehicle: string;
}
export interface Catalog {
  version: number; difficulties: Record<Difficulty, DifficultyInfo>;
  stats: StatInfo[]; roles: RoleInfo[]; characters: CharacterInfo[];
  missions: MissionInfo[]; comingSoon: ComingSoon[]; modifiers: ModifierInfo[]; cosmetics: CosmeticsInfo;
  design: DesignCatalog;
  traitPreview: Record<Difficulty, Record<string, TraitPreview>>;
  rules: { devTools: boolean; hardGate: { enabled: boolean; requires: string } };
}

/* ---------- profile ---------- */
export interface Profile {
  id: string; name: string; xp: number; rank: string;
  upgrades: Partial<Record<StatId, number>>;
  cosmetics: string[]; equipped: Record<string, string>;
  stats: { runs?: number; successes?: number; bestScore?: number; launchFailures?: number; easyClears?: number };
  unlocks: { hard: boolean };
}

/* ---------- room ---------- */
export interface DesignState {
  destinationId: string; vehicleId: string; propulsionId: string; thrusters: number; propellantKg: number;
  solarAreaM2: number; rtgUnits: number; antennaId: string; instrumentIds: string[]; marginPct: number;
}
/** Keys accepted by `design.set` (destinationId is fixed by the mission). */
export type DesignPatch = Partial<Omit<DesignState, "destinationId">>;
export interface Check { id: string; status: CheckStatus; cat: string; title: string; value: string; limit: string; detail: string; why: string }
export interface ObjectiveResult {
  id: string; label: string; required: boolean; points: number; met: boolean; earned: number;
  value: number | string | null; target: number | string | null; why: string;
}
export interface ChallengeResultItem { id: string; name: string; desc: string; completed: boolean; value: number | null; target: string }
export interface ChallengeProgress {
  timeLimitMin: number; total: number; count: number; list: ChallengeResultItem[];
  tiers: { need: number; reward: string; reached: boolean }[];
}
export type Metrics = Record<string, number | string | boolean | null>;
export interface Probabilities { launch: number; cruise: number; insertion: number; ops: number; mission: number }
export interface Preview {
  complete: boolean; launchReady: boolean; checks: Check[]; blockers: { id: string; title: string; detail: string }[]; metrics: Metrics;
  breakdown: Record<string, number> | null; probabilities: Probabilities;
  objectives: ObjectiveResult[]; score: number | null; grade: string | null;
  scoreBreakdown: Record<string, number> | null; modifiers: { id: string; name: string; desc: string }[];
  challenges: ChallengeProgress | null; error?: string;
}
export interface ChallengeClock { timeLimitMin: number; deadline: number; serverNow: number; eligible: boolean; tiers: { need: number; reward: string }[] }
export interface FlightPhase { id: "launch" | "cruise" | "insertion" | "ops"; label: string; probability: number; passed: boolean; story: string; lesson: string | null }
export interface Result {
  outcome: Outcome; success: boolean; launchSuccess: boolean; score: number; grade: string;
  scoreBreakdown: Record<string, number>; scienceOutput: number; scienceRef: number;
  phases: FlightPhase[]; probabilities: Probabilities;
  objectives: ObjectiveResult[]; metrics: Metrics; breakdown: Record<string, number>; checks: Check[];
  summary: string; lessons: { title: string; why: string; status: CheckStatus }[];
  missedObjectives: { label: string; why: string; value: number | string | null; target: number | string | null }[];
  realInstruments: { name: string; mission: string; tag: string; source: string | null }[];
  challenges: (ChallengeProgress & { onTime: boolean; eligible: boolean; rewards: string[] }) | null;
  xp: number; attempt: number; design: DesignState;
  awards: Record<string, { xp: number; newCosmetics: string[]; totalXp: number; rank: string }>;
}
export interface RoomMember { id: string; name: string; rank: string; equipped: Record<string, string>; online: boolean; bot?: boolean }
export interface Slot { slot: string; role: RoleId; playerId: string | null; ai: boolean; characterId: string | null }
export interface ChatMsg { from: string; name: string; text: string; at: number }
export interface Room {
  code: string; status: RoomStatus; hostId: string; missionId: string | null; difficulty: Difficulty | null; attempt: number;
  members: RoomMember[]; slots: Slot[]; design: DesignState | null; approvals: string[];
  fieldOwners: Record<string, RoleId[]>; preview: Preview | null; challenge: ChallengeClock | null;
  result: Result | null; chat: ChatMsg[];
}

/* ---------- socket protocol ---------- */
export type ServerMessage =
  | { t: "hello"; profile: Profile; room: Room | null }
  | { t: "room"; room: Room | null }
  | { t: "profile"; profile: Profile }
  | { t: "ok"; id?: number }
  | { t: "error"; id?: number; code: string; message: string }
  | { t: "pong" };

export type ClientMessage =
  | { t: "room.create" } | { t: "room.join"; code: string } | { t: "room.leave" }
  | { t: "room.setup"; missionId: string; difficulty: Difficulty } | { t: "room.start_roles" }
  | { t: "role.claim"; slot: string; characterId: string } | { t: "role.release" }
  | { t: "room.start_design" } | { t: "design.set"; patch: DesignPatch } | { t: "design.approve"; approved: boolean }
  | { t: "launch" } | { t: "design.autofill" }
  | { t: "dev.autodesign" } | { t: "dev.addbot" } | { t: "dev.removebot" }
  | { t: "room.redesign" } | { t: "room.to_lobby" } | { t: "chat"; text: string }
  | { t: "profile.upgrade"; stat: StatId } | { t: "profile.rename"; name: string } | { t: "cosmetic.equip"; item: string };
