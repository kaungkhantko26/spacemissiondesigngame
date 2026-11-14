/**
 * MOCK DATA — illustrative only. Not verified NASA data.
 * Replace via services/mocks implementations.
 */
import type {
  Character, CharacterTrait, CosmeticItem, CrewRole, MissionDifficulty,
  MissionModifier, Mission, Player, PlayerProfile, MissionTelemetry, MissionResult,
} from "@/types";

export const players: Player[] = [
  { id: "p1", username: "Astronova", level: 28, avatarColor: "#168BFF" },
  { id: "p2", username: "NovaStar", level: 22, avatarColor: "#FF8C42" },
  { id: "p3", username: "KatieDev", level: 19, avatarColor: "#36D399" },
  { id: "p4", username: "LunaTic", level: 15, avatarColor: "#C084FC" },
];

export const profile: PlayerProfile = {
  ...players[0],
  playerCode: "SMD-7324",
  progression: { level: 28, xp: 4820, xpForNextLevel: 6000, availableXp: 1200 },
  attributes: { engineering: 6, research: 5, coordination: 4, adaptability: 3 },
  equipped: { suit: "suit-classic", helmet: "helmet-classic", backpack: "pack-std", patch: "patch-mission", emote: null },
  history: { attempted: 42, completed: 31, bestPerformance: "Lunar Landing — 94%", highestDifficulty: "medium" },
  achievements: [
    { id: "a1", name: "First Contact", description: "Complete your first mission.", unlockedAt: "2026-02-03" },
    { id: "a2", name: "Team Player", description: "Finish 10 co-op missions.", unlockedAt: "2026-04-18" },
    { id: "a3", name: "Frugal Flyer", description: "Complete a mission under budget." },
    { id: "a4", name: "Hard Landing", description: "Complete a Hard mission." },
  ],
};

export const difficulties: MissionDifficulty[] = [
  { id: "easy", label: "Easy", description: "No mission modifiers. A relaxed introduction.", xpMultiplier: 0.5, modifierSummary: "No modifiers", optionalChallenges: false },
  { id: "medium", label: "Medium", description: "Mission-specific modifiers apply.", xpMultiplier: 0.8, modifierSummary: "1–2 modifiers", optionalChallenges: false },
  { id: "hard", label: "Hard", description: "Harsher modifiers and optional cosmetic challenges.", xpMultiplier: 0.8, modifierSummary: "3+ modifiers, challenges", optionalChallenges: true },
];

export const modifiers: MissionModifier[] = [
  { id: "mod-power", name: "Reduced Power Generation", description: "Solar output is limited for this mission.", affectedSystem: "Power", severity: "medium", icon: "power" },
  { id: "mod-comms", name: "Limited Communication Windows", description: "Ground contact is available in short windows.", affectedSystem: "Communications", severity: "medium", icon: "radio" },
  { id: "mod-mass", name: "Restricted Launch Mass", description: "Tighter mass budget at launch.", affectedSystem: "Structure", severity: "high", icon: "weight" },
  { id: "mod-risk", name: "Increased Mission Risk", description: "Anomalies occur more frequently.", affectedSystem: "Mission", severity: "high", icon: "alert" },
];

const roles = (leader: number, spec: number, eng: number): CrewRole[] => [
  { id: "leader", name: "Mission Leader", description: "Coordinates the crew and owns final decisions.", responsibilities: ["Set mission priorities", "Resolve conflicts", "Approve launch"], required: leader },
  { id: "specialist", name: "Specialist", description: "Handles science and analysis tasks.", responsibilities: ["Plan science payload", "Analyze data", "Advise on risk"], required: spec },
  { id: "engineer", name: "Engineer", description: "Designs and maintains spacecraft systems.", responsibilities: ["Size subsystems", "Manage mass and power", "Repair faults"], required: eng },
];

const mods = (m: string[], h: string[]) => ({ easy: [], medium: m, hard: h });
const rw = (id: string, label: string, kind: "xp" | "cosmetic" | "badge") => ({ id, label, kind });

export const missions: Mission[] = [
  { id: "lunar-landing", name: "Lunar Landing", summary: "Design and land a crewed-style lander near the lunar south pole.", category: "Exploration", body: "moon", supportedDifficulties: ["easy", "medium", "hard"], minPlayers: 1, maxPlayers: 4, durationMinutes: [25, 35], objectives: ["Select landing site", "Budget lander mass", "Plan descent", "Survive the lunar night"], roleTemplate: roles(1, 2, 1), modifiersByDifficulty: mods(["mod-power"], ["mod-power", "mod-mass", "mod-risk"]), challengeObjectives: ["Land under budget", "No anomalies"], rewards: [rw("r1", "Mission XP", "xp"), rw("helmet-lunar", "Lunar Helmet", "cosmetic")] },
  { id: "earth-observation", name: "Earth Observation", summary: "Deploy a satellite to monitor Earth's climate and weather.", category: "Science", body: "earth", supportedDifficulties: ["easy", "medium", "hard"], minPlayers: 1, maxPlayers: 4, durationMinutes: [20, 30], objectives: ["Choose orbit", "Select instruments", "Downlink data"], roleTemplate: roles(1, 2, 1), modifiersByDifficulty: mods(["mod-comms"], ["mod-comms", "mod-power", "mod-risk"]), challengeObjectives: ["Maximize data return"], rewards: [rw("r1", "Mission XP", "xp"), rw("patch-earth", "Earth Patch", "cosmetic")] },
  { id: "mars-recon", name: "Mars Reconnaissance", summary: "Send an orbiter to survey candidate sites on Mars.", category: "Exploration", body: "mars", supportedDifficulties: ["medium", "hard"], minPlayers: 2, maxPlayers: 4, durationMinutes: [35, 50], objectives: ["Plan transfer", "Insert into orbit", "Map candidate sites"], roleTemplate: roles(1, 2, 1), modifiersByDifficulty: mods(["mod-comms", "mod-mass"], ["mod-comms", "mod-mass", "mod-power", "mod-risk"]), challengeObjectives: ["Map all sites", "Stay within power budget"], rewards: [rw("r1", "Mission XP", "xp"), rw("suit-mars", "Mars Suit", "cosmetic")], restrictions: { easy: "Requires modifiers; Easy has none." } },
  { id: "space-telescope", name: "Space Telescope Deployment", summary: "Launch and unfold a space telescope at a stable orbit point.", category: "Science", body: "telescope", supportedDifficulties: ["hard"], minPlayers: 3, maxPlayers: 4, durationMinutes: [40, 60], objectives: ["Deploy mirror", "Cool instruments", "Calibrate"], roleTemplate: roles(1, 1, 2), modifiersByDifficulty: mods([], ["mod-mass", "mod-power", "mod-risk"]), challengeObjectives: ["Zero deployment faults"], rewards: [rw("r1", "Mission XP", "xp"), rw("pack-telescope", "Telescope Pack", "cosmetic")], restrictions: { easy: "Hard-only mission.", medium: "Hard-only mission." } },
  { id: "deep-space-probe", name: "Deep Space Probe", summary: "Design a probe for the outer solar system.", category: "Exploration", body: "deepspace", supportedDifficulties: [], minPlayers: 2, maxPlayers: 4, durationMinutes: [45, 60], objectives: ["TBD"], roleTemplate: roles(1, 2, 1), modifiersByDifficulty: mods([], []), challengeObjectives: [], rewards: [rw("r1", "Mission XP", "xp")], comingSoon: "Coming soon — mission content is not finalized." },
];

export const traits: CharacterTrait[] = [
  { id: "t-calm", name: "Calm Under Pressure", description: "Steady in crisis (illustrative)." },
  { id: "t-curious", name: "Insatiable Curiosity", description: "Loves new data (illustrative)." },
  { id: "t-meticulous", name: "Meticulous", description: "Double-checks everything (illustrative)." },
  { id: "t-diplomat", name: "Diplomat", description: "Keeps the crew aligned (illustrative)." },
  { id: "t-tinkerer", name: "Tinkerer", description: "Fixes things on the fly (illustrative)." },
  { id: "t-bold", name: "Bold", description: "Takes calculated risks (illustrative)." },
];

const ch = (id: string, name: string, role: Character["role"], spec: string, bio: string, suit: string, skin: string, accent: string, s: number[], tr: string[], st: string[], we: string[]): Character => ({
  id, name, role, specialization: spec, bio, suitColor: suit, skinTone: skin, accent,
  stats: { research: s[0], analysis: s[1], communication: s[2], maintenance: s[3], coordination: s[4] },
  traitIds: tr, strengths: st, weaknesses: we,
});

export const characters: Character[] = [
  ch("c-tanaka", "Dr. Airi Tanaka", "leader", "Mission Command", "Veteran flight director who trained crews for a decade.", "#E8EEF7", "#F0C8A0", "#168BFF", [6, 7, 9, 4, 10], ["t-calm", "t-diplomat"], ["Crew coordination", "Decision speed"], ["Hands-on repairs"]),
  ch("c-okafor", "Cmdr. Ade Okafor", "leader", "Flight Operations", "Former test pilot with a knack for contingency plans.", "#FFB27A", "#8D5524", "#FF8C42", [5, 6, 8, 6, 9], ["t-bold", "t-calm"], ["Risk handling", "Leadership"], ["Deep science"]),
  ch("c-reyes", "Dr. Lena Reyes", "specialist", "Planetary Geology", "Maps terrain and picks safe, scientifically rich sites.", "#B9D7FF", "#C68642", "#4FC3F7", [10, 8, 5, 3, 5], ["t-curious", "t-meticulous"], ["Site selection", "Sample planning"], ["Maintenance"]),
  ch("c-chen", "Dr. Wei Chen", "specialist", "Remote Sensing", "Designs instruments and squeezes signal from noise.", "#CFE8D8", "#E0AC69", "#36D399", [8, 10, 6, 4, 4], ["t-meticulous", "t-curious"], ["Data analysis", "Instrument tuning"], ["Communication"]),
  ch("c-ivanova", "Dr. Mila Ivanova", "specialist", "Astrobiology", "Searches for signs of life in extreme environments.", "#E9D5FF", "#F1C27D", "#C084FC", [9, 7, 6, 4, 6], ["t-curious", "t-diplomat"], ["Science planning", "Team morale"], ["Risk appetite"]),
  ch("c-santos", "Dr. Rafael Santos", "specialist", "Orbital Analysis", "Computes trajectories and flags risky windows early.", "#FDE68A", "#A0673C", "#FFC857", [6, 10, 5, 5, 6], ["t-meticulous", "t-calm"], ["Trajectory review", "Early warnings"], ["Public speaking"]),
  ch("c-nakamura", "Dr. Yuki Nakamura", "specialist", "Communications Science", "Keeps the link alive across long delays.", "#FBCFE8", "#F5D0A9", "#FB7185", [6, 6, 10, 4, 7], ["t-diplomat", "t-bold"], ["Link planning", "Crew briefings"], ["Hardware faults"]),
  ch("c-mbeki", "Eng. Thandi Mbeki", "engineer", "Propulsion", "Squeezes every gram out of a design.", "#FECACA", "#6F4E37", "#FF8C42", [4, 7, 5, 10, 6], ["t-tinkerer", "t-meticulous"], ["Mass optimisation", "Repairs"], ["Science reasoning"]),
  ch("c-hart", "Eng. Jack Hart", "engineer", "Power Systems", "Solar arrays and batteries are his playground.", "#BFDBFE", "#E8B98A", "#168BFF", [5, 6, 6, 9, 5], ["t-tinkerer", "t-bold"], ["Power budgeting", "Improvisation"], ["Documentation"]),
];

export const cosmetics: CosmeticItem[] = [
  { id: "suit-classic", name: "Classic Suit", category: "suit", rarity: "common", collection: "Starter", color: "#E8EEF7", accent: "#168BFF", unlocked: true, unlockCondition: "Default", hardModeExclusive: false },
  { id: "suit-orange", name: "Launch Orange", category: "suit", rarity: "rare", collection: "Launch Day", color: "#FF8C42", accent: "#FFF", unlocked: true, unlockCondition: "Reach level 10", hardModeExclusive: false },
  { id: "suit-mars", name: "Mars Suit", category: "suit", rarity: "epic", collection: "Red Planet", color: "#C2562E", accent: "#FFC857", unlocked: false, unlockCondition: "Complete Mars Reconnaissance", hardModeExclusive: false },
  { id: "suit-gold", name: "Gold Pioneer", category: "suit", rarity: "legendary", collection: "Hard Mode", color: "#FFC857", accent: "#0B3D91", unlocked: false, unlockCondition: "Complete any Hard mission with all challenges", hardModeExclusive: true },
  { id: "helmet-classic", name: "Classic Helmet", category: "helmet", rarity: "common", collection: "Starter", color: "#4FC3F7", accent: "#FFF", unlocked: true, unlockCondition: "Default", hardModeExclusive: false },
  { id: "helmet-lunar", name: "Lunar Helmet", category: "helmet", rarity: "rare", collection: "Lunar", color: "#C9D4E5", accent: "#FFC857", unlocked: false, unlockCondition: "Complete Lunar Landing", hardModeExclusive: false },
  { id: "helmet-neon", name: "Neon Visor", category: "helmet", rarity: "epic", collection: "Hard Mode", color: "#36D399", accent: "#168BFF", unlocked: false, unlockCondition: "Hard Lunar Landing, no anomalies", hardModeExclusive: true },
  { id: "pack-std", name: "Standard Pack", category: "backpack", rarity: "common", collection: "Starter", color: "#9FB3C8", accent: "#168BFF", unlocked: true, unlockCondition: "Default", hardModeExclusive: false },
  { id: "pack-telescope", name: "Telescope Pack", category: "backpack", rarity: "epic", collection: "Observatory", color: "#7C3AED", accent: "#FFC857", unlocked: false, unlockCondition: "Complete Space Telescope Deployment", hardModeExclusive: true },
  { id: "patch-mission", name: "Mission Patch", category: "patch", rarity: "common", collection: "Starter", color: "#0B3D91", accent: "#FF8C42", unlocked: true, unlockCondition: "Default", hardModeExclusive: false },
  { id: "patch-earth", name: "Earth Patch", category: "patch", rarity: "rare", collection: "Earth", color: "#168BFF", accent: "#36D399", unlocked: false, unlockCondition: "Complete Earth Observation", hardModeExclusive: false },
  { id: "emote-wave", name: "Wave", category: "emote", rarity: "common", collection: "Starter", color: "#4FC3F7", accent: "#FFF", unlocked: true, unlockCondition: "Default", hardModeExclusive: false },
  { id: "emote-cheer", name: "Cheer", category: "emote", rarity: "rare", collection: "Celebration", color: "#FFC857", accent: "#FF8C42", unlocked: false, unlockCondition: "Win 5 missions", hardModeExclusive: false },
];

export const telemetrySeed: MissionTelemetry = {
  massKg: { value: 4200, max: 5000, state: "normal" },
  powerW: { value: 780, max: 1000, state: "warning" },
  budgetM: { value: 310, max: 400, state: "normal" },
  storageGb: { value: 92, max: 100, state: "critical" },
  comms: { label: "Link nominal (MOCK)", state: "normal" },
  timeline: [
    { id: "t1", label: "Launch", done: true, at: "T+00:00" },
    { id: "t2", label: "Orbit insertion", done: true, at: "T+00:12" },
    { id: "t3", label: "Instrument check", done: false, at: "T+00:30" },
    { id: "t4", label: "Science pass", done: false, at: "T+01:10" },
  ],
  events: [
    { id: "e1", text: "Storage nearing capacity (mock event)", state: "critical" },
    { id: "e2", text: "Power draw elevated (mock event)", state: "warning" },
    { id: "e3", text: "Orbit stable (mock event)", state: "normal" },
  ],
};

export const resultSeed: MissionResult = {
  status: "success",
  objectives: [
    { label: "Select landing site", done: true },
    { label: "Budget lander mass", done: true },
    { label: "Plan descent", done: true },
    { label: "Survive the lunar night", done: false },
  ],
  science: 82, engineering: 74, efficiency: 68,
  crewContribution: [
    { playerId: "p1", percent: 31 }, { playerId: "p2", percent: 27 },
    { playerId: "p3", percent: 24 }, { playerId: "p4", percent: 18 },
  ],
  xpEarned: 640,
  cosmeticRewards: ["helmet-lunar"],
};
