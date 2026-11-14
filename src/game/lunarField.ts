"use client";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { asset } from "@/lib/asset";

/**
 * Real archived NASA data: Lunar Prospector magnetometer (MAG) Level 4 large-scale vector field maps at a common altitude of 37 km
 * (PDS PPI data set LP-L-MAG-5-SURFACE-FIELD-MAP-V1.0, total-field files), re-binned to 2 x 2 degree cells by scripts/build_lp_field.py.
 * Gaps are real: bins with no data in the archive stay empty and cannot be used as survey targets.
 */
export const CELL_DEG = 2, ROWS = 90, COLS = 180, TILE_DEG = 10, TILE_CELLS = TILE_DEG / CELL_DEG; // 5 x 5 cells per 10-degree region
export const MAX_TARGETS = 3, MIN_VALID_CELLS = 15; // a region needs reference data in at least 15 of its 25 cells to be selectable

export interface FieldMeta { dataset: string; title: string; source: string; url: string; altitudeKm: number; units: string; sourceResolutionDeg: number; gameResolutionDeg: number; coordinates: string; processing: string; caveat: string; retrieved: string; stats: { cells: number; missing: number; minNT: number; medianNT: number; p95NT: number; maxNT: number } }
export interface LunarField { meta: FieldMeta; values: Float32Array /* nT, NaN = no archived data */ }
export interface Tile { id: string; row: number; col: number; lat0: number; lon0: number; valid: number; meanNT: number; maxNT: number; selectable: boolean }

export const cellIndex = (lat: number, lon: number) => Math.min(ROWS - 1, Math.max(0, Math.floor((lat + 90) / CELL_DEG))) * COLS + (((Math.floor((((lon % 360) + 360) % 360) / CELL_DEG)) % COLS + COLS) % COLS);
export const cellCentre = (k: number): { lat: number; lon: number } => ({ lat: Math.floor(k / COLS) * CELL_DEG - 90 + CELL_DEG / 2, lon: (k % COLS) * CELL_DEG + CELL_DEG / 2 });
export const tileId = (row: number, col: number) => `t${row}_${col}`;
/** Cell indices (2 degree) inside a 10 degree region. */
export function tileCells(id: string): number[] {
  const m = /^t(\d+)_(\d+)$/.exec(id); if (!m) return [];
  const r0 = Number(m[1]) * TILE_CELLS, c0 = Number(m[2]) * TILE_CELLS, out: number[] = [];
  for (let r = 0; r < TILE_CELLS; r++) for (let c = 0; c < TILE_CELLS; c++) out.push((r0 + r) * COLS + (c0 + c));
  return out;
}
export const tileBounds = (id: string) => { const m = /^t(\d+)_(\d+)$/.exec(id); if (!m) return null; return { lat0: Number(m[1]) * TILE_DEG - 90, lon0: Number(m[2]) * TILE_DEG }; };
export const placeLabel = (lat: number, lon: number) => `${Math.abs(lat).toFixed(0)}°${lat >= 0 ? "N" : "S"}, ${lon.toFixed(0)}°E`;

let cache: Promise<LunarField | null> | null = null;
/** Loads the archived field once (about 44 KB). Resolves to null if it cannot be fetched; callers must handle that. */
export function loadField(): Promise<LunarField | null> {
  cache ??= (async () => {
    try {
      const res = await fetch(asset("/data/lp-mag-37km-2deg.json")); if (!res.ok) return null;
      const j = (await res.json()) as FieldMeta & { data: string; rows: number; cols: number };
      const bin = atob(j.data), raw = new Uint16Array(j.rows * j.cols);
      for (let i = 0; i < raw.length; i++) raw[i] = bin.charCodeAt(2 * i) | (bin.charCodeAt(2 * i + 1) << 8);
      const values = new Float32Array(raw.length); for (let i = 0; i < raw.length; i++) values[i] = raw[i] === 0xffff ? NaN : raw[i] / 100;
      const { data: _d, rows: _r, cols: _c, ...meta } = j; void _d; void _r; void _c;
      return { meta, values };
    } catch { return null; }
  })();
  return cache;
}
export function tilesOf(f: LunarField): Tile[] {
  const out: Tile[] = [];
  for (let r = 0; r < ROWS / TILE_CELLS; r++) for (let c = 0; c < COLS / TILE_CELLS; c++) {
    const id = tileId(r, c); let valid = 0, sum = 0, max = 0;
    for (const k of tileCells(id)) { const v = f.values[k]; if (Number.isNaN(v)) continue; valid++; sum += v; if (v > max) max = v; }
    out.push({ id, row: r, col: c, lat0: r * TILE_DEG - 90, lon0: c * TILE_DEG, valid, meanNT: valid ? sum / valid : 0, maxNT: max, selectable: valid >= MIN_VALID_CELLS });
  }
  return out;
}
/** The strongest selectable regions that do not overlap, for a "show me where to look" hint. */
export const strongestTiles = (tiles: Tile[], n = MAX_TARGETS) => tiles.filter((t) => t.selectable).sort((a, b) => b.meanNT - a.meanNT).slice(0, n);

/* ---- the player's chosen survey regions (kept until the mission starts, then copied into the saved mission) ---- */
interface TargetStore { ids: string[]; toggle: (id: string) => void; set: (ids: string[]) => void; clear: () => void }
const storage = createJSONStorage(() => { try { return window.localStorage; } catch { return { getItem: () => null, setItem: () => undefined, removeItem: () => undefined }; } });
export const useTargets = create<TargetStore>()(persist((set) => ({
  ids: [],
  toggle: (id) => set((s) => (s.ids.includes(id) ? { ids: s.ids.filter((x) => x !== id) } : s.ids.length >= MAX_TARGETS ? s : { ids: [...s.ids, id] })),
  set: (ids) => set({ ids: ids.slice(0, MAX_TARGETS) }), clear: () => set({ ids: [] }),
}), { name: "smd-targets", storage, skipHydration: true }));

/** Colour for a field value on a dark background (low = deep blue, strong = warm). */
export function fieldColor(nT: number, max = 6): string {
  const t = Math.min(1, Math.max(0, nT / max));
  return `rgb(${Math.round(30 + 225 * t)},${Math.round(60 + 140 * Math.pow(t, 1.4))},${Math.round(150 * (1 - t) + 40)})`;
}

/* ---- what the mission observed, in terms of real archived cells ---- */
const cellOrder = (k: number) => { const s = Math.sin(k * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }; // fixed pseudo-random order: which cells of a region are covered first
export interface Observation { observed: Set<number>; returned: Set<number>; perTarget: { id: string; valid: number; observed: number; returned: number }[] }
/**
 * Cells of each chosen region that were observed (progress) and whose data reached Earth (progress x share of the recorded data that was downlinked).
 * Only cells with archived data count; this is a simplified coverage model, not a physical ground-track simulation.
 */
export function observationOf(f: LunarField, targets: string[], progress: number[], returnedShare: number): Observation {
  const observed = new Set<number>(), returned = new Set<number>(), perTarget: Observation["perTarget"] = [];
  targets.forEach((id, i) => {
    const cells = tileCells(id).filter((k) => !Number.isNaN(f.values[k])).sort((a, b) => cellOrder(a) - cellOrder(b));
    const nObs = Math.round(cells.length * Math.min(1, progress[i] ?? 0)), nRet = Math.round(nObs * Math.min(1, Math.max(0, returnedShare)));
    cells.slice(0, nObs).forEach((k) => observed.add(k)); cells.slice(0, nRet).forEach((k) => returned.add(k));
    perTarget.push({ id, valid: cells.length, observed: nObs, returned: nRet });
  });
  return { observed, returned, perTarget };
}
