import { DATASET, GAME, type Destination, type Instrument } from "./data";

/**
 * Curation layer over the extracted NASA instrument list. The dataset keeps the raw extracted mass/power; this layer says what each
 * instrument can actually MEASURE, whether it works from orbit, which shared hardware it belongs to, and what its mass figure covers.
 * `basis` says where the classification comes from: "source" = stated in the dataset's own NASA sentence; "name" = inferred from the
 * instrument's name (re-check the original documentation before relying on it).
 */
export type Measure = "magnetic-vector" | "electron-spectrum" | "electric-field" | "dust-flux" | "imaging" | "radar-altimetry" | "gamma-ray-bursts" | "cloud-polarimetry" | "ionospheric-plasma"
  | "uv-spectroscopy" | "ir-radiometry" | "ion-mass-spectrometry" | "solar-wind-plasma" | "mossbauer-spectroscopy" | "navigation";
export type MassScope = "full" | "shared-package" | "sensor-only" | "electronics-only" | "derived";
export interface Curation { measures: Measure[]; deployment: "orbiter" | "contact"; packageId?: string; massScope: MassScope; basis: "source" | "name"; massKg?: number; note?: string }

export const CURATION: Record<string, Curation> = {
  nmc_exp_1975_075a_01: { measures: ["imaging"], deployment: "orbiter", massScope: "full", basis: "name", note: "Mass covers the two cameras including their housing." },
  nmc_exp_1978_051a_02: { measures: ["radar-altimetry"], deployment: "orbiter", massScope: "full", basis: "name" },
  nmc_exp_1978_051a_05: { measures: ["gamma-ray-bursts"], deployment: "orbiter", massScope: "full", basis: "name" },
  nmc_exp_1978_051a_06: { measures: ["cloud-polarimetry", "imaging"], deployment: "orbiter", massScope: "full", basis: "name" },
  nmc_exp_1978_051a_07: { measures: ["ionospheric-plasma"], deployment: "orbiter", massScope: "full", basis: "name" },
  nmc_exp_1978_051a_12: { measures: ["magnetic-vector"], deployment: "orbiter", massScope: "full", basis: "name", note: "The source sentence quotes only the electronics box (1.7 kg); the listed 7.0 kg is not clearly the whole instrument. Treat the mass as uncertain." },
  nmc_exp_1978_051a_13: { measures: ["electric-field"], deployment: "orbiter", massScope: "electronics-only", basis: "name", note: "An electric-field detector measures electric fields. It is not a magnetometer." },
  nmc_exp_1978_051a_15: { measures: ["uv-spectroscopy"], deployment: "orbiter", massScope: "full", basis: "name" },
  nmc_exp_1978_051a_16: { measures: ["ir-radiometry"], deployment: "orbiter", massScope: "full", basis: "name" },
  nmc_exp_1978_051a_17: { measures: ["ion-mass-spectrometry"], deployment: "orbiter", massScope: "full", basis: "name" },
  nmc_exp_1978_051a_18: { measures: ["solar-wind-plasma"], deployment: "orbiter", massScope: "full", basis: "name" },
  nmc_exp_1998_001a_05: { measures: ["magnetic-vector"], deployment: "orbiter", packageId: "lp-mager", massScope: "shared-package", basis: "source", note: "Shares one electronics box with the Electron Reflectometer; the 5 kg / 4.5 W are for the combined package and are counted once." },
  nmc_exp_1998_001a_06: { measures: ["electron-spectrum"], deployment: "orbiter", packageId: "lp-mager", massScope: "shared-package", basis: "source", note: "Shares one electronics box with the Magnetometer; the 5 kg / 4.5 W are for the combined package and are counted once." },
  nmc_exp_1999_003a_01: { measures: ["imaging", "navigation"], deployment: "orbiter", massScope: "derived", basis: "source", massKg: 12, note: "The source gives the periscope (2.5 kg) and the rest of the camera (9.5 kg) separately; the game uses their sum, 12 kg." },
  nmc_exp_1999_003a_03: { measures: ["dust-flux"], deployment: "orbiter", massScope: "sensor-only", basis: "source", note: "Dust-impact detector. The 0.332 kg is the sensor unit only; its electronics box is not included. It is not an electron reflectometer." },
  nmc_exp_2003_027a_04: { measures: ["mossbauer-spectroscopy"], deployment: "contact", massScope: "electronics-only", basis: "source", note: "A rover-arm instrument that studies nearby rock and soil. It cannot do anything from orbit. The 0.14 kg is the electronics board." },
};
const FALLBACK: Curation = { measures: [], deployment: "orbiter", massScope: "full", basis: "name" };
export const curationOf = (i: Instrument): Curation => CURATION[i.id] ?? FALLBACK;
/** NASA NSSDCA catalog entry the extracted values came from (ids look like nmc_exp_1978_051a_13 → 1978-051A-13). */
export const catalogUrl = (i: Instrument): string | null => { const m = /^nmc_exp_(\d{4})_(\d{3}[a-z])_(\d+)$/.exec(i.id); return m ? `https://nssdc.gsfc.nasa.gov/nmc/experiment/display.action?id=${m[1]}-${m[2].toUpperCase()}-${m[3]}` : null; };

export const measuresOf = (i: Instrument): Measure[] => curationOf(i).measures;
export const effectiveMassKg = (i: Instrument) => curationOf(i).massKg ?? i.mass_kg;

/** Hardware totals: instruments that share one electronics package count that package once (mass and power), not once per instrument. */
export function hardware(instruments: Instrument[]) {
  const seenPkg = new Set<string>(); let massKg = 0, powerW = 0, kbps = 0;
  const members = new Map<string, number>(); for (const i of instruments) { const p = curationOf(i).packageId; if (p) members.set(p, (members.get(p) ?? 0) + 1); }
  for (const i of instruments) {
    const pkg = curationOf(i).packageId, m = effectiveMassKg(i), w = i.power_w ?? GAME.defaultInstrumentPowerW;
    const share = pkg ? m / (members.get(pkg) ?? 1) : m; // data rate follows the instrument's share of the package
    kbps += 2 + 4 * Math.sqrt(share);
    if (pkg) { if (seenPkg.has(pkg)) continue; seenPkg.add(pkg); }
    massKg += m; powerW += w;
  }
  return { massKg, powerW, kbps, sharedPackages: [...seenPkg] };
}

/** Measurements a destination's contract needs (Moon: a magnetic-field survey plus electron observations). Other destinations fall back to tags. */
export const requiredMeasures = (d: Destination): Measure[] => (d.id === "moon" ? ["magnetic-vector", "electron-spectrum"] : []);
export type Suitability = { kind: "suited" | "supporting" | "unsuitable" | "neutral"; label: string };
export function suitability(i: Instrument, d: Destination): Suitability {
  const c = curationOf(i);
  if (c.deployment === "contact") return { kind: "unsuitable", label: "Surface instrument: cannot work from orbit" };
  const need = requiredMeasures(d), hit = c.measures.filter((m) => need.includes(m));
  if (hit.length) return { kind: "suited", label: `Measures ${hit.map((m) => m.replace("-", " ")).join(" + ")} (required)` };
  if (d.wants.includes(i.tag)) return { kind: "supporting", label: "Related science, not the contract measurement" };
  return { kind: "neutral", label: "Not related to this contract" };
}
export const instrumentList = () => DATASET.instruments;
