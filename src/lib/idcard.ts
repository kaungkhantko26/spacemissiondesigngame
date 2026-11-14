import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AvatarArt } from "@/components/ui/AvatarArt";
import { drawFlag, type CustomFlag } from "@/game/flags";
import type { AvatarStyle } from "@/game/avatar";

/** Everything needed to draw a crew ID card; also what a shared link carries. */
export interface CardData { name: string; level: number; missions: number; code: string; avatar: AvatarStyle; flagId: string; custom: CustomFlag; patch?: { name: string; color: string; accent: string } | null; suit?: string }

export function encodeCard(d: CardData): string {
  const json = JSON.stringify(d);
  return btoa(String.fromCharCode(...new TextEncoder().encode(json))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export function decodeCard(s: string): CardData | null {
  try {
    const b = atob(s.replace(/-/g, "+").replace(/_/g, "/")), bytes = Uint8Array.from(b, (c) => c.charCodeAt(0));
    const d = JSON.parse(new TextDecoder().decode(bytes)) as CardData;
    return typeof d.name === "string" && d.avatar && typeof d.code === "string" ? { ...d, name: d.name.slice(0, 24), code: d.code.slice(0, 16) } : null;
  } catch { return null; }
}

const rr = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); };
const svgImage = (svg: string) => new Promise<HTMLImageElement>((ok, no) => { const im = new Image(); im.onload = () => ok(im); im.onerror = no; im.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"'))}`; });

/** Draws the badge to a PNG (640x960). */
export async function renderCardPng(d: CardData): Promise<Blob> {
  const W = 640, H = 960, c = document.createElement("canvas"); c.width = W; c.height = H;
  const ctx = c.getContext("2d")!;
  const bg = ctx.createLinearGradient(0, 0, W, H); bg.addColorStop(0, "#17233c"); bg.addColorStop(0.55, "#0d1526"); bg.addColorStop(1, "#1b2a48");
  rr(ctx, 0, 0, W, H, 44); ctx.fillStyle = bg; ctx.fill(); ctx.strokeStyle = "rgba(255,255,255,.2)"; ctx.lineWidth = 3; ctx.stroke();
  ctx.save(); rr(ctx, 0, 0, W, H, 44); ctx.clip();
  rr(ctx, W / 2 - 80, 34, 160, 26, 13); ctx.fillStyle = "rgba(0,0,0,.7)"; ctx.fill();
  ctx.fillStyle = "#ff8a3d"; ctx.font = "600 22px sans-serif"; ctx.textAlign = "center"; ctx.fillText("SPACE MISSION DESIGN", W / 2, 104);
  // avatar
  const ring = ctx.createConicGradient(3.5, W / 2, 290); ["#ff8a3d", "#ffd27a", "#4fc3f7", "#ff8a3d"].forEach((col, i) => ring.addColorStop(i / 3, col));
  ctx.fillStyle = ring; ctx.beginPath(); ctx.arc(W / 2, 290, 142, 0, 7); ctx.fill(); ctx.fillStyle = "#0d1526"; ctx.beginPath(); ctx.arc(W / 2, 290, 132, 0, 7); ctx.fill();
  try { const im = await svgImage(renderToStaticMarkup(createElement(AvatarArt, { style: d.avatar, name: d.name, size: 250 }))); ctx.drawImage(im, W / 2 - 125, 165, 250, 250); } catch { /* picture unavailable */ }
  if (d.patch) { ctx.fillStyle = d.patch.color; ctx.beginPath(); ctx.arc(W - 120, 400, 36, 0, 7); ctx.fill(); ctx.strokeStyle = d.patch.accent; ctx.lineWidth = 6; ctx.stroke(); ctx.fillStyle = d.patch.accent; ctx.font = "700 34px sans-serif"; ctx.fillText("★", W - 120, 413); }
  ctx.fillStyle = "#fff"; ctx.font = "700 60px sans-serif"; ctx.fillText(d.name, W / 2, 520);
  ctx.fillStyle = "#9fb3c8"; ctx.font = "500 22px sans-serif"; ctx.fillText("M I S S I O N   C O M M A N D E R", W / 2, 560);
  // flag
  const fc = document.createElement("canvas"); fc.width = 150; fc.height = 98; const fx = fc.getContext("2d")!;
  await new Promise<void>((ok) => { const t = setTimeout(ok, 1200); const draw = () => { drawFlag(fx, fc.width, fc.height, d.flagId, d.custom, () => { clearTimeout(t); draw(); ok(); }); }; draw(); if (!/^nasa/.test(d.flagId)) { clearTimeout(t); ok(); } });
  ctx.drawImage(fc, W / 2 - 75, 590, 150, 98);
  // stats
  ([["LEVEL", String(d.level), "#ffc857"], ["MISSIONS", String(d.missions), "#fff"]] as const).forEach(([k, v, col], i) => {
    const x = 80 + i * 245; rr(ctx, x, 720, 215, 90, 14); ctx.fillStyle = "rgba(255,255,255,.06)"; ctx.fill();
    ctx.fillStyle = "#8c97a8"; ctx.font = "500 18px sans-serif"; ctx.fillText(k, x + 107, 750); ctx.fillStyle = col; ctx.font = "700 40px sans-serif"; ctx.fillText(v, x + 107, 795);
  });
  ctx.textAlign = "left"; ctx.fillStyle = "#8c97a8"; ctx.font = "500 18px sans-serif"; ctx.fillText("CREW ID", 80, 858); ctx.fillStyle = "#fff"; ctx.font = "700 36px monospace"; ctx.fillText(d.code, 80, 898);
  const digits = d.code.replace(/\D/g, "").padEnd(8, "7"); let bx = 360;
  for (let r = 0; r < 2; r++) for (let i = 0; i < digits.length; i++) { const w = 3 + ((Number(digits[i]) + i) % 4) * 2, h = 36 + ((i * 7 + r * 3) % 24); ctx.fillStyle = "rgba(255,255,255,.88)"; ctx.fillRect(bx, 898 - h, w, h); bx += w + 4; }
  ctx.fillStyle = d.suit ?? "#ff8a3d"; for (let x = -40; x < W + 40; x += 56) { ctx.save(); ctx.translate(x, H - 28); ctx.rotate(-0.7); ctx.fillRect(0, -30, 28, 80); ctx.restore(); }
  ctx.restore();
  return await new Promise<Blob>((ok, no) => c.toBlob((b) => (b ? ok(b) : no(new Error("png"))), "image/png"));
}
