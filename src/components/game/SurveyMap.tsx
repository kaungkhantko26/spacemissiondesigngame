"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { CELL_DEG, COLS, ROWS, TILE_DEG, fieldColor, loadField, placeLabel, tileBounds, tileCells, tilesOf, type LunarField, type Tile } from "@/game/lunarField";

/** Hook: the archived field once loaded (null while loading or if it could not be fetched). */
export function useLunarField() {
  const [f, setF] = useState<LunarField | null>(null), [failed, setFailed] = useState(false);
  useEffect(() => { let dead = false; void loadField().then((x) => { if (dead) return; if (x) setF(x); else setFailed(true); }); return () => { dead = true; }; }, []);
  return { field: f, failed, tiles: useMemo(() => (f ? tilesOf(f) : []), [f]) };
}

const W = 720, H = 360, PX = W / COLS; // 4 px per 2-degree cell
/** Equirectangular map of the real archived field. Click a 10-degree region to select it. */
export function SurveyMap({ field, tiles, selected, onToggle, observed, revealed }: {
  field: LunarField; tiles: Tile[]; selected: string[]; onToggle?: (id: string) => void;
  /** report mode: cells the spacecraft observed / cells whose data reached Earth (indices) */ observed?: Set<number>; revealed?: Set<number>;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [hover, setHover] = useState<Tile | null>(null);
  useEffect(() => {
    const c = ref.current, g = c?.getContext("2d"); if (!c || !g) return;
    g.fillStyle = "#0b1020"; g.fillRect(0, 0, W, H);
    const report = !!revealed;
    for (let r = 0; r < ROWS; r++) for (let col = 0; col < COLS; col++) {
      const k = r * COLS + col, v = field.values[k]; if (Number.isNaN(v)) continue;
      const x = col * PX, y = (ROWS - 1 - r) * PX;
      if (report && !selected.some((id) => tileCells(id).includes(k))) { g.fillStyle = "rgba(120,140,190,.22)"; g.fillRect(x, y, PX, PX); continue; }
      g.fillStyle = report && !revealed!.has(k) ? (observed?.has(k) ? "rgba(255,200,90,.35)" : "rgba(255,255,255,.06)") : fieldColor(v); g.fillRect(x, y, PX, PX);
    }
    g.strokeStyle = "rgba(255,255,255,.12)"; g.lineWidth = 1;
    for (let i = 0; i <= 360 / TILE_DEG; i++) { g.beginPath(); g.moveTo(i * TILE_DEG * 2, 0); g.lineTo(i * TILE_DEG * 2, H); g.stroke(); }
    for (let j = 0; j <= 180 / TILE_DEG; j++) { g.beginPath(); g.moveTo(0, j * TILE_DEG * 2); g.lineTo(W, j * TILE_DEG * 2); g.stroke(); }
    for (const t of tiles) if (!t.selectable && !report) { const x = t.col * TILE_DEG * 2, y = (ROWS / 5 - 1 - t.row) * TILE_DEG * 2; g.fillStyle = "rgba(5,8,18,.55)"; g.fillRect(x, y, TILE_DEG * 2, TILE_DEG * 2); }
    selected.forEach((id, i) => { const b = tileBounds(id); if (!b) return; const x = (b.lon0 / CELL_DEG) * PX, y = (ROWS - (b.lat0 + 90) / CELL_DEG - TILE_DEG / CELL_DEG) * PX;
      g.strokeStyle = "#ff8a3d"; g.lineWidth = 2.5; g.strokeRect(x + 1, y + 1, TILE_DEG * 2 - 2, TILE_DEG * 2 - 2); g.fillStyle = "#ff8a3d"; g.font = "bold 13px sans-serif"; g.fillText(String(i + 1), x + 5, y + 16); });
    if (hover) { const x = hover.col * TILE_DEG * 2, y = (ROWS / 5 - 1 - hover.row) * TILE_DEG * 2; g.strokeStyle = "#fff"; g.lineWidth = 1.5; g.strokeRect(x + 0.5, y + 0.5, TILE_DEG * 2, TILE_DEG * 2); }
  }, [field, tiles, selected, observed, revealed, hover]);
  const at = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect(), x = ((e.clientX - r.left) / r.width) * W, y = ((e.clientY - r.top) / r.height) * H;
    return tiles.find((t) => t.col === Math.floor(x / (TILE_DEG * 2)) && t.row === ROWS / 5 - 1 - Math.floor(y / (TILE_DEG * 2))) ?? null;
  };
  return (
    <div>
      <canvas ref={ref} width={W} height={H} role="img" aria-label="Map of the archived Lunar Prospector magnetic field at 37 km altitude" className={onToggle ? "w-full cursor-pointer rounded-md border border-white/10" : "w-full rounded-md border border-white/10"}
        onPointerMove={(e) => setHover(at(e))} onPointerLeave={() => setHover(null)} onClick={(e) => { const t = at(e as unknown as React.PointerEvent<HTMLCanvasElement>); if (t && onToggle && t.selectable) onToggle(t.id); }} />
      <div className="mt-1 flex items-center justify-between text-[11px] text-muted">
        <span>{hover ? `${placeLabel(hover.lat0 + TILE_DEG / 2, hover.lon0 + TILE_DEG / 2)} · ${hover.selectable ? `mean ${hover.meanNT.toFixed(1)} nT, strongest cell ${hover.maxNT.toFixed(1)} nT` : "not enough archived data"}` : "Longitude 0° to 360°E left to right · latitude 90°N at the top"}</span>
        <span className="flex items-center gap-1" aria-hidden><span className="h-2 w-16 rounded-sm" style={{ background: `linear-gradient(90deg, ${fieldColor(0)}, ${fieldColor(3)}, ${fieldColor(6)})` }} />0 to 6+ nT</span>
      </div>
    </div>
  );
}
