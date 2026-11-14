/**
 * Live backend contract (mirrors the game server). Everything here is what the server SENDS;
 * the frontend only displays it. Ids are stable strings.
 */
export type Difficulty = "easy" | "medium" | "hard";
export type RoleId = "lead" | "engineer" | "science" | "comms";
export type StatId = "planning" | "engineering" | "science" | "comms" | "resilience";
export type CheckStatus = "pass" | "warn" | "fail" | "block";
export type RoomStatus = "lobby" | "roles" | "design" | "ops" | "report";
export type Outcome = "success" | "partial" | "failure" | "launch_failure";

export interface DifficultyInfo {
  label: string; budgetMult: number; deadlineMult: number; eventRate: number; launchFailure: boolean;
  massGrowth: number; xpMult: number; disposalYears: number; blurb: string;
}
export interface Bus {
  id: string; name: string; dryKg: number; maxTotalKg: number; baseLoadW: number; slots: number;
  storageGB: number; costM: number; devMonths: number; blurb: string;
}
export interface Orbit {
  id: string; name: string; altKm: number; inclDeg: number; radKradPerYear: number; contactBaseMin: number;
  decayYears: number; teach: string;
}
export interface Launcher {
  id: string; name: string; kind: "rideshare" | "dedicated"; maxKg: number | null; reliability: number;
  priceM: number | null; orbits: string[]; blurb: string;
}
export interface Ground { id: string; name: string; contactMult: number; setupM: number; perMonthM: number; blurb: string }

export type PartCategory = "solar" | "battery" | "comms" | "adcs" | "propulsion" | "instrument";
export interface Part {
  id: string; cat: PartCategory; name: string; classes: string[]; massKg: number; costM: number;
  tier: "simple" | "advanced"; trl: number; note: string; src: string;
  peakW?: number; deployable?: boolean; tracking?: boolean;           // solar
  capWh?: number; chem?: string;                                       // battery
  downlinkMbps?: number; loadTxW?: number;                             // comms
  accArcsec?: number; sunTrack?: boolean;                              // adcs
  propKg?: number; ispS?: number; thrustN?: number;                    // propulsion
  loadW?: number; dataGBday?: number; tags?: string[]; science?: number; reqPointArcsec?: number | null; // instrument
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
  id: string; name: string; tagline: string; brief: string; teach: string; type: string; tier: number;
  body: "earth" | "moon" | "mars" | "deepspace" | "telescope";
  difficulties: Difficulty[]; lockedReason: Partial<Record<Difficulty, string>>;
  slots: { slot: string; role: RoleId }[];
  budgetM: number; deadlineMonths: number; lifetimeMonths: { min: number; max: number; default: number };
  baseXP: number; objectives: Objective[]; modifiers: Partial<Record<Difficulty, string[]>>;
  allowed: { buses: string[]; launchers: string[]; orbits: string[] };
  challenges: Partial<Record<"hard", ChallengeSetDef>>;
}
export interface ComingSoon { id: string; name: string; tagline: string; body: MissionInfo["body"]; category: string; difficulties: Difficulty[]; note: string }
export interface ModifierInfo { id: string; name: string; desc: string }
export interface CosmeticItem { id: string; slot: string; name: string; rarity: "common" | "rare" | "epic" | "legendary"; unlock: string }
export interface CosmeticsInfo {
  slots: { id: string; label: string }[]; items: CosmeticItem[];
  ranks: { minXp: number; title: string }[]; upgrades: { maxLevel: number; baseCost: number; perLevelBonus: number };
}

export interface Catalog {
  version: number; difficulties: Record<Difficulty, DifficultyInfo>;
  buses: Bus[]; orbits: Orbit[]; launchers: Launcher[]; grounds: Ground[]; parts: Part[];
  stats: StatInfo[]; roles: RoleInfo[]; characters: CharacterInfo[];
  missions: MissionInfo[]; comingSoon: ComingSoon[]; modifiers: ModifierInfo[]; cosmetics: CosmeticsInfo;
  traitPreview: Record<Difficulty, Record<string, TraitPreview>>;
  rules: { hardGate: { enabled: boolean; requires: string } };
  realMissionCount: number;
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
  bus: string | null; solar: string | null; battery: string | null; batteryCount: number;
  comms: string | null; adcs: string | null; propulsion: string | null; instruments: string[];
  ground: string; launch: { vehicle: string | null; orbit: string | null }; opsMonths: number; duty: number;
}
/** Keys accepted by `design.set`. */
export type DesignPatch = Partial<{
  bus: string | null; solar: string | null; battery: string | null; batteryCount: number;
  comms: string | null; adcs: string | null; propulsion: string | null; instruments: string[];
  ground: string; "launch.vehicle": string | null; "launch.orbit": string | null; opsMonths: number; duty: number;
}>;
export interface Check { id: string; status: CheckStatus; cat: string; title: string; detail: string; why: string }
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
export interface Preview {
  complete: boolean; launchReady: boolean; checks: Check[]; blockers: Check[]; metrics: Metrics;
  breakdown: { mass: { label: string; kg: number }[]; power: { label: string; w: number }[]; cost: { label: string; m: number }[] } | null;
  objectives: ObjectiveResult[]; score: number | null; grade: string | null;
  scoreBreakdown: Record<string, number> | null; modifiers: { id: string; name: string; desc: string }[];
  challenges: ChallengeProgress | null; error?: string;
}
export interface ChallengeClock { timeLimitMin: number; deadline: number; serverNow: number; eligible: boolean; tiers: { need: number; reward: string }[] }
export interface RoomEvent { month: number; id: string; label: string; severity: string; text: string; tip: string }
export interface RealMatch { name: string; country: string; purpose: string; launchYear: number; altitudeKm: number; massKg: number; powerW: number; similarityPct: number; note: string }
export interface Result {
  outcome: Outcome; success: boolean; launchSuccess: boolean; score: number; grade: string;
  scoreBreakdown: Record<string, number>; scienceOutput: number; scienceRef: number;
  objectives: ObjectiveResult[]; events: RoomEvent[]; metrics: Metrics; checks: Check[];
  effectiveMonths: number; summary: string; lessons: { title: string; why: string; status: CheckStatus }[];
  missedObjectives: { label: string; why: string; value: number | string | null; target: number | string | null }[];
  matches: RealMatch[];
  challenges: (ChallengeProgress & { onTime: boolean; eligible: boolean; rewards: string[] }) | null;
  xp: number; attempt: number; ops?: OpsSummary;
  awards: Record<string, { xp: number; newCosmetics: string[]; totalXp: number; rank: string }>;
}
export interface OpsIncident {
  id: string; label: string; text: string; deadline: number; serverNow: number;
  options: { id: string; label: string; hint: string; role: RoleId; cost: number }[];
}
export interface OpsView {
  status: "running" | "done" | "lost"; tick: number; ticks: number; month: number; totalMonths: number;
  res: { power: number; storage: number; health: number; budget: number }; budget0: number;
  ctl: { duty: number; downlink: "normal" | "boost"; mode: "nominal" | "safe" };
  incident: OpsIncident | null; log: { tick: number; kind: "info" | "good" | "bad" | "alert" | "decision"; text: string }[];
  timeline: { t: number; power: number; storage: number; health: number; eff: number }[];
  repairIn: number; serverNow: number; tickMs: number; nextAt: number; safeNow: boolean;
}
export interface OpsSummary { lost: boolean; budgetLeftM: number; budget0: number; handled: number; missed: number; brownouts: number; timeline: OpsView["timeline"] }
export interface RoomMember { id: string; name: string; rank: string; equipped: Record<string, string>; online: boolean }
export interface Slot { slot: string; role: RoleId; playerId: string | null; ai: boolean; characterId: string | null }
export interface ChatMsg { from: string; name: string; text: string; at: number }
export interface Room {
  code: string; status: RoomStatus; hostId: string; missionId: string | null; difficulty: Difficulty | null; attempt: number;
  members: RoomMember[]; slots: Slot[]; design: DesignState | null; approvals: string[];
  fieldOwners: Record<string, RoleId[]>; preview: Preview | null; challenge: ChallengeClock | null;
  result: Result | null; chat: ChatMsg[]; ops: OpsView | null;
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
  | { t: "launch" } | { t: "ops.set"; patch: Partial<{ duty: number; downlink: "normal" | "boost"; mode: "nominal" | "safe" }> }
  | { t: "ops.respond"; option: string } | { t: "ops.repair" } | { t: "room.redesign" } | { t: "room.to_lobby" } | { t: "chat"; text: string }
  | { t: "profile.upgrade"; stat: StatId } | { t: "profile.rename"; name: string } | { t: "cosmetic.equip"; item: string };
