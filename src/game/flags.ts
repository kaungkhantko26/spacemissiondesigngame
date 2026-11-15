"use client";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { asset } from "@/lib/asset";

export interface FlagDef { id: string; label: string; kind: "image" | "draw" }
/** Flags the player can put on the astronaut's shoulder. NASA marks are the supplied logo images; the rest are drawn. */
export const FLAGS: FlagDef[] = [
  { id: "myanmar", label: "Myanmar", kind: "draw" }, { id: "nasa", label: "NASA", kind: "image" }, { id: "nasa-wordmark", label: "NASA wordmark", kind: "image" }, { id: "msa", label: "MSA logo", kind: "image" },
  { id: "usa", label: "United States", kind: "draw" }, { id: "japan", label: "Japan", kind: "draw" }, { id: "india", label: "India", kind: "draw" },
  { id: "thailand", label: "Thailand", kind: "draw" }, { id: "germany", label: "Germany", kind: "draw" }, { id: "custom", label: "Custom", kind: "draw" },
];
export interface CustomFlag { a: string; b: string; c: string; dir: "h" | "v"; star: boolean; starColor: string }
export const DEFAULT_CUSTOM: CustomFlag = { a: "#168BFF", b: "#FFFFFF", c: "#FF8C42", dir: "h", star: true, starColor: "#FFC857" };
export const FLAG_COLORS = ["#FFFFFF", "#0B1220", "#E8363D", "#FF8C42", "#FFC857", "#36D399", "#168BFF", "#0B3D91", "#7C3AED", "#EA2839", "#FECB00", "#34B232"] as const;

const IMAGES: Record<string, string> = { nasa: "/flags/nasa-meatball.png", "nasa-wordmark": "/flags/nasa-wordmark.png", msa: "/flags/msa-logo.png" };
const imgCache = new Map<string, HTMLImageElement>();
function loadImage(id: string, done: () => void): HTMLImageElement | null {
  const hit = imgCache.get(id);
  if (hit) return hit.complete ? hit : (hit.addEventListener("load", done, { once: true }), null);
  const im = new Image(); im.addEventListener("load", done, { once: true }); im.src = asset(IMAGES[id]); imgCache.set(id, im); return im.complete ? im : null;
}
function star(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, fill: string) {
  ctx.fillStyle = fill; ctx.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.4 : r; ctx[i ? "lineTo" : "moveTo"](cx + rr * Math.cos(a), cy + rr * Math.sin(a)); }
  ctx.closePath(); ctx.fill();
}
/** Draws a flag filling w×h. `redraw` is called when an image flag finishes loading. */
export function drawFlag(ctx: CanvasRenderingContext2D, w: number, h: number, id: string, custom: CustomFlag, redraw: () => void) {
  const bands = (cols: string[], dir: "h" | "v" = "h") => cols.forEach((c, i) => { ctx.fillStyle = c; if (dir === "h") ctx.fillRect(0, (h * i) / cols.length, w, h / cols.length + 1); else ctx.fillRect((w * i) / cols.length, 0, w / cols.length + 1, h); });
  ctx.clearRect(0, 0, w, h);
  switch (id) {
    case "myanmar": bands(["#FECB00", "#34B232", "#EA2839"]); star(ctx, w / 2, h * 0.53, h * 0.36, "#FFFFFF"); break;
    case "usa": { bands(Array.from({ length: 13 }, (_, i) => (i % 2 ? "#FFFFFF" : "#B22234"))); ctx.fillStyle = "#3C3B6E"; ctx.fillRect(0, 0, w * 0.42, (h * 7) / 13);
      for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) star(ctx, w * (0.05 + c * 0.075), h * (0.07 + r * 0.13), h * 0.04, "#fff"); break; }
    case "japan": ctx.fillStyle = "#FFFFFF"; ctx.fillRect(0, 0, w, h); ctx.fillStyle = "#BC002D"; ctx.beginPath(); ctx.arc(w / 2, h / 2, h * 0.3, 0, 7); ctx.fill(); break;
    case "india": bands(["#FF9933", "#FFFFFF", "#138808"]); ctx.strokeStyle = "#000080"; ctx.lineWidth = Math.max(1, h * 0.02); ctx.beginPath(); ctx.arc(w / 2, h / 2, h * 0.14, 0, 7); ctx.stroke(); break;
    case "thailand": bands(["#A51931", "#F4F5F8", "#2D2A4A", "#F4F5F8", "#A51931"].flatMap((c, i) => (i === 2 ? [c, c] : [c]))); break;
    case "germany": bands(["#000000", "#DD0000", "#FFCE00"]); break;
    case "custom": bands([custom.a, custom.b, custom.c], custom.dir); if (custom.star) star(ctx, w / 2, h / 2, h * 0.3, custom.starColor); break;
    default: { // NASA logo images on a deep-blue cloth
      ctx.fillStyle = id === "msa" ? "#FFFFFF" : id === "nasa" ? "#0B1B3F" : "#0B3D91"; ctx.fillRect(0, 0, w, h);
      const im = loadImage(id, redraw); if (!im) break;
      const s = Math.min((w * 0.9) / im.width, (h * 0.86) / im.height); ctx.drawImage(im, (w - im.width * s) / 2, (h - im.height * s) / 2, im.width * s, im.height * s);
    }
  }
}

interface Store { flagId: string; custom: CustomFlag; setFlag: (id: string) => void; setCustom: (p: Partial<CustomFlag>) => void; reset: () => void }
const storage = createJSONStorage(() => { try { return window.localStorage; } catch { return { getItem: () => null, setItem: () => undefined, removeItem: () => undefined }; } });
export const useFlag = create<Store>()(persist((set) => ({
  flagId: "myanmar", custom: DEFAULT_CUSTOM,
  setFlag: (flagId) => set({ flagId }), setCustom: (p) => set((s) => ({ custom: { ...s.custom, ...p }, flagId: "custom" })), reset: () => set({ flagId: "myanmar", custom: DEFAULT_CUSTOM }),
}), { name: "smd-flag", storage, skipHydration: true }));

/** Round patch emblem filling a size x size canvas (used by the 3-D chest patch and the cosmetics cards). */
export function drawPatch(ctx: CanvasRenderingContext2D, size: number, kind: string, color: string, accent: string, custom: CustomFlag, redraw: () => void) {
  const R = size / 2;
  ctx.clearRect(0, 0, size, size); ctx.save(); ctx.beginPath(); ctx.arc(R, R, R - 4, 0, 7); ctx.clip();
  if (kind === "patch-nasa") drawFlag(ctx, size, size, "nasa", custom, redraw);
  else if (kind === "patch-msa") drawFlag(ctx, size, size, "msa", custom, redraw);
  else if (kind === "patch-myanmar") drawFlag(ctx, size, size, "myanmar", custom, redraw);
  else {
    ctx.fillStyle = color; ctx.fillRect(0, 0, size, size); ctx.fillStyle = accent; ctx.beginPath();
    if (kind === "patch-earth") { ctx.arc(R, R, R * 0.5, 0, 7); ctx.fill(); ctx.strokeStyle = "#fff"; ctx.lineWidth = R * 0.07; ctx.beginPath(); ctx.ellipse(R, R, R * 0.5, R * 0.2, 0, 0, 7); ctx.stroke(); }
    else { for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? R * 0.22 : R * 0.55; ctx[i ? "lineTo" : "moveTo"](R + rr * Math.cos(a), R + rr * Math.sin(a)); } ctx.fill(); }
  }
  ctx.restore(); ctx.lineWidth = R * 0.1; ctx.strokeStyle = accent; ctx.beginPath(); ctx.arc(R, R, R - 6, 0, 7); ctx.stroke();
}
