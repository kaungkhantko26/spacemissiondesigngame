import raw from "./dataset.json";

/**
 * Typed view of src/game/dataset.json (generated from kaungkhantko26/space-mission-dataset by
 * scripts/build-game-data.py). Everything in `GAME` below is a *game-balance value* the dataset does not
 * contain (component prices, power/comms models); the UI labels these as game values, never as real data.
 */
export interface Body { id: string; name: string; mu: number; radius_m: number; gravity: number | null; sma_m: number | null; parent: string | null; irradiance_w_m2?: number }
export interface Vehicle { id: string; name: string; manufacturer: string; manufacturer_country: string; leo_capacity_kg: number; gto_capacity_kg: number | null; launch_cost_usd: number; total_launches: number; successful_launches: number; reusable: boolean;
  /** Saturn V only: verified stage data + the Apollo 11 spacecraft mass; price is a game value */
  stages?: { stage: string; dry_kg: number; prop_kg: number; engines: number; engine: string; engine_thrust_n: number }[]; tli_payload_kg?: number; launch_cost_is_game?: boolean;
  launch_mass_t: number | null; liftoff_thrust_kn: number | null; diameter_m: number | null; length_m: number | null; min_stage: number | null; max_stage: number | null }
export interface LaunchSite { id: string; name: string; location: string; country: string; lat: number; lon: number; launches: number; rotation_boost_m_s: number }
export interface ElectricThruster { id: string; name: string; type: string; thrust_n: number; power_w: number; isp_s: number }
export type InstrumentTag = "radar" | "imager" | "fields" | "plasma" | "particles" | "spectrometer" | "other";
export interface Instrument { id: string; name: string; mission: string; mass_kg: number; power_w: number | null; tag: InstrumentTag; source: string | null }

export interface DesignDataset {
  provenance: { dataset: string; note: string };
  bodies: Body[]; vehicles: Vehicle[]; electric_propulsion: ElectricThruster[]; instruments: Instrument[]; launch_sites: LaunchSite[];
}
export const DATASET = raw as unknown as DesignDataset;
export const bodyById = (id: string): Body => {
  const b = DATASET.bodies.find((x) => x.id === id);
  if (!b) throw new Error(`Unknown body ${id}`);
  return b;
};
export const vehicleById = (id: string) => DATASET.vehicles.find((v) => v.id === id);
export const instrumentById = (id: string) => DATASET.instruments.find((i) => i.id === id);
export const launchReliability = (v: Vehicle) => (v.successful_launches + 0.5) / (v.total_launches + 1); // Jeffreys estimate

/* ---------- Game-balance values (NOT dataset data) ---------- */
export const GAME = {
  g0: 9.80665,
  auInM: 1.495978707e11,
  leoAltitudeM: 300_000,
  dvMargin: 1.05,                       // 5 % on the required delta-v
  chemical: { id: "chem", name: "Storable bipropellant", isp_s: 320, engineKg: 40, thrust_n: 450, cost: 12e6 },
  tankFraction: 0.08,                   // tank mass per kg of propellant
  busBaseKg: 120, structureFraction: 0.1, busPowerW: 80, busCostPerKg: 220_000,
  instrumentCostPerKg: 4e6, defaultInstrumentPowerW: 5,
  solar: { efficiency: 0.29, degradation: 0.9, kgPerM2: 2.4, costPerM2: 0.4e6, maxM2: 120 },
  rtg: { watts: 55, kg: 40, cost: 20e6, max: 4 },
  electric: { thrusterKg: 12, ppuKgPerKw: 6, spiralPenalty: 1.15, costPerThruster: 15e6, maxThrusters: 3 },
  comms: { kBps: 2.2e25, duty: 0.35, amplifierEff: 0.35 }, // bps·m²/(m²·W), calibrated so a 3 m / 100 W dish returns ~0.5 Mbps at 2e8 km (MRO-class)
  opsCostPerDay: 120_000,
  tagValue: { radar: 12, imager: 10, spectrometer: 11, fields: 8, plasma: 8, particles: 7, other: 6 } as Record<InstrumentTag, number>,
  wantedBonus: 1.5, duplicateTagFactor: 0.5,
} as const;

export interface Antenna { id: string; name: string; dishM: number; txW: number; massKg: number; cost: number; maxBps: number }
export const ANTENNAS: Antenna[] = [
  { id: "patch", name: "Patch antenna", dishM: 0.3, txW: 10, massKg: 3, cost: 3e6, maxBps: 2e6 },
  { id: "medium", name: "1 m dish", dishM: 1, txW: 35, massKg: 9, cost: 12e6, maxBps: 2e7 },
  { id: "high", name: "2.5 m high-gain", dishM: 2.5, txW: 100, massKg: 30, cost: 35e6, maxBps: 1.5e8 },
  { id: "large", name: "4 m deep-space dish", dishM: 4, txW: 150, massKg: 70, cost: 60e6, maxBps: 3e8 },
];

export interface Destination {
  id: string; bodyId: string; name: string; tagline: string; kind: "moon" | "planet";
  opsDays: number; deadlineDays: number; budgetUsd: number; scienceGoal: number; wants: InstrumentTag[]; difficulty: 1 | 2 | 3 | 4 | 5;
  /** Mandatory payload type for the contract (launch is blocked without it). */
  requires?: InstrumentTag;
}
export const DESTINATIONS: Destination[] = [
  { id: "moon", bodyId: "moon", name: "Moon", tagline: "Low lunar orbit survey", kind: "moon", opsDays: 60, deadlineDays: 400, budgetUsd: 250e6, scienceGoal: 20, wants: ["fields", "particles"], difficulty: 1, requires: "fields" },
  { id: "mars", bodyId: "mars", name: "Mars", tagline: "Orbiter to image candidate landing sites", kind: "planet", opsDays: 365, deadlineDays: 800, budgetUsd: 700e6, scienceGoal: 35, wants: ["imager", "spectrometer"], difficulty: 2 },
];
export const destinationById = (id: string) => DESTINATIONS.find((d) => d.id === id);
