import { LAUNCH, R_E, orbitElements, padPosition, thrustDir, type Flight } from "@/game/launch/core";

export interface View { cx: number; cy: number; logE: number; shake: number; boom: { x: number; y: number; age: number } | null; flicker: number; stars: [number, number, number][] }
export const newView = (): View => ({
  cx: 0, cy: R_E(), logE: Math.log(150), shake: 0, boom: null, flicker: 0,
  stars: Array.from({ length: 140 }, (_, i) => { const a = Math.sin(i * 91.7) * 43758.5453; const b = Math.sin(i * 12.9) * 24634.6345; return [a - Math.floor(a), b - Math.floor(b), 0.4 + ((i * 37) % 10) / 14] as [number, number, number]; }),
});

const R = R_E();
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (x: number) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };
const mix = (a: number[], b: number[], t: number) => a.map((v, i) => Math.round(lerp(v, b[i], t)));
const rgb = (c: number[]) => `rgb(${c[0]},${c[1]},${c[2]})`;

/** Advance the camera toward what the player should see (pad+tower → climbing rocket → whole Earth + orbit). */
export function updateView(v: View, f: Flight, dtReal: number, reduced: boolean) {
  const alt = Math.hypot(f.x, f.y) - R, pad = padPosition(f);
  const onPad = !f.liftedOff || alt < 40;
  const d = Math.hypot(f.x - pad.x, f.y - pad.y);
  const s = smooth((alt - 70_000) / 80_000); // orbit view blend
  const b = onPad ? 0.5 : Math.max(0, 0.5 * (1 - alt / 40_000));
  const asc = { x: lerp(f.x, pad.x, b), y: lerp(f.y, pad.y, b) };
  const tx = lerp(asc.x, 0, s), ty = lerp(asc.y, 0, s);
  const eAsc = Math.max(onPad ? 130 : 220, 2.1 * d + 120);
  const tLogE = lerp(Math.log(eAsc), Math.log(R * 1.35), s);
  const k = 1 - Math.exp(-dtReal * (onPad ? 3 : 2.2));
  v.cx += (tx - v.cx) * k; v.cy += (ty - v.cy) * k; v.logE += (tLogE - v.logE) * k;
  const thrusting = f.engineOn && f.tel.thrust > 0;
  v.shake = reduced ? 0 : thrusting && alt < 8000 ? Math.min(1, (f.tel.thrust / (f.rocket.s1.thrustSlN || 1)) * (1 - alt / 8000)) * 2.2 : 0;
  v.flicker = reduced ? 0.5 : Math.random();
  if (f.phase === "failed" && f.failure && !v.boom) v.boom = { x: f.x, y: f.y, age: 0 };
  if (v.boom) v.boom.age += dtReal;
  if (f.phase === "countdown" || f.t < -0.5) v.boom = null;
}

export function drawFlight(ctx: CanvasRenderingContext2D, W: number, H: number, f: Flight, v: View) {
  const alt = Math.hypot(f.x, f.y) - R;
  const E = Math.exp(v.logE), k = (Math.min(W, H) * 0.5 * 0.9) / E;
  const sx = (x: number) => W / 2 + (x - v.cx) * k + (v.shake ? (Math.random() - 0.5) * v.shake * 2 : 0);
  const sy = (y: number) => H / 2 - (y - v.cy) * k + (v.shake ? (Math.random() - 0.5) * v.shake * 2 : 0);
  const skyT = E > R * 0.3 ? 1 : Math.min(1, Math.max(0, alt) / 100_000), night = Math.pow(skyT, 0.55);
  // ---- sky
  const top = mix([88, 150, 226], [3, 6, 16], night), bot = mix([158, 200, 240], [8, 14, 34], night);
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, rgb(top)); g.addColorStop(1, rgb(bot));
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#fff";
  const starA = Math.max(0, night - 0.25) * 1.2;
  if (starA > 0) for (const [a, b, s] of v.stars) { ctx.globalAlpha = Math.min(1, starA) * s * 0.8; ctx.fillRect(a * W, b * H, s * 1.5, s * 1.5); }
  ctx.globalAlpha = 1;

  // ---- Earth (visible arc only, so huge radii stay precise)
  const alpha0 = Math.atan2(v.cy, v.cx), dist = Math.hypot(v.cx, v.cy);
  const diagM = Math.hypot(W, H) / k, span = Math.min(Math.PI, Math.asin(Math.min(1, (diagM * 0.75 + 1) / Math.max(R, dist))) + 0.2);
  const arc = (rad: number, from: number, to: number, n = 90) => { for (let i = 0; i <= n; i++) { const a = from + ((to - from) * i) / n; const x = sx(rad * Math.cos(a)), y = sy(rad * Math.sin(a)); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } };
  const farSpan = dist > R * 0.2 ? span : Math.PI;
  const a0 = dist > R * 0.2 ? alpha0 - farSpan : 0, a1 = dist > R * 0.2 ? alpha0 + farSpan : Math.PI * 2;
  // atmosphere band
  ctx.save(); ctx.beginPath(); arc(R + 45_000, a0, a1); ctx.lineWidth = Math.max(1, 90_000 * k); ctx.strokeStyle = `rgba(110,170,255,${0.1 + 0.12 * night})`; ctx.stroke(); ctx.restore();
  ctx.beginPath(); arc(R, a0, a1); if (dist > R * 0.2) { ctx.lineTo(sx(0), sy(0)); ctx.closePath(); } else ctx.closePath();
  const eg = ctx.createLinearGradient(0, H * 0.4, 0, H);
  eg.addColorStop(0, night > 0.6 ? "#1d4a7a" : "#3b7a4a"); eg.addColorStop(1, night > 0.6 ? "#0d2a4a" : "#23502f");
  ctx.fillStyle = E > R * 0.3 ? "#1b4f86" : eg; ctx.fill();
  ctx.lineWidth = 1.5; ctx.strokeStyle = "rgba(160,210,255,.5)"; ctx.stroke();

  // ---- reference rings (orbit view)
  if (E > R * 0.15) {
    ctx.setLineDash([6, 6]); ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(255,255,255,.35)"; ctx.beginPath(); arc(R + LAUNCH.karmanM, 0, Math.PI * 2, 180); ctx.stroke();
    ctx.strokeStyle = "rgba(95,207,154,.55)"; ctx.beginPath(); arc(R + LAUNCH.targetOrbitKm * 1000, 0, Math.PI * 2, 180); ctx.stroke(); ctx.setLineDash([]);
  }
  // ---- predicted orbit
  const el = orbitElements(f.x, f.y, f.vx, f.vy);
  if (el.bound && f.liftedOff && (f.stage === 2 || f.phase === "coast") && E > 4_000) {
    const e = Math.min(el.e, 0.999), p = el.a * (1 - e * e), wp = Math.atan2(el.ey, el.ex), dir = el.hz < 0 ? -1 : 1;
    ctx.strokeStyle = "rgba(79,200,247,.8)"; ctx.lineWidth = 1.5; ctx.beginPath(); let pen = false;
    for (let i = 0; i <= 240; i++) { const nu = (i / 240) * Math.PI * 2, r = p / (1 + e * Math.cos(nu)); if (r < R) { pen = false; continue; } const a = wp + dir * nu; const x = sx(r * Math.cos(a)), y = sy(r * Math.sin(a)); pen ? ctx.lineTo(x, y) : ctx.moveTo(x, y); pen = true; }
    ctx.stroke();
  }
  // ---- pad & tower
  const pad = padPosition(f), padK = k;
  if (padK * 120 > 5) {
    ctx.save(); ctx.translate(sx(pad.x), sy(pad.y)); ctx.rotate(pad.angle);
    const u = padK; ctx.fillStyle = "#5b6574"; ctx.fillRect(-60 * u, 0, 120 * u, 5 * u);
    ctx.fillStyle = "#3a4250"; ctx.fillRect(-14 * u, 0, 28 * u, 3 * u);
    ctx.fillStyle = "#8c97a8"; ctx.fillRect(-26 * u, -78 * u, 5 * u, 78 * u);
    ctx.strokeStyle = "#8c97a8"; ctx.lineWidth = Math.max(1, 1.2 * u);
    for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(-26 * u, -i * 13 * u); ctx.lineTo(-18 * u, -(i + 1) * 13 * u); ctx.stroke(); }
    ctx.fillStyle = "#c8553d"; ctx.fillRect(-32 * u, -78 * u, 16 * u, 3 * u);
    ctx.restore();
  } else if (alt < 30_000) { ctx.fillStyle = "#ffd27a"; ctx.beginPath(); ctx.arc(sx(pad.x), sy(pad.y), 3, 0, 7); ctx.fill(); }

  // ---- trail
  const tr = f.trail;
  if (tr.length > 3) {
    ctx.lineWidth = 2; ctx.lineJoin = "round"; ctx.strokeStyle = "rgba(255,160,90,.85)"; ctx.beginPath();
    for (let i = 0; i < tr.length; i += 2) { const x = sx(tr[i]), y = sy(tr[i + 1]); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.lineTo(sx(f.x), sy(f.y)); ctx.stroke();
  }
  // ---- debris
  ctx.fillStyle = "#9aa4b4"; for (const d of f.debris) { ctx.fillRect(sx(d.x) - 2, sy(d.y) - 5, 4, 10); }

  // ---- rocket
  const td = thrustDir(f), ang = Math.atan2(td.x, td.y);
  const len = f.rocket.lengthM * (f.stage === 1 ? 1 : 0.4), L = Math.max(16, Math.min(70, len * k)), Wd = Math.max(3, Math.min(L * 0.13, 12));
  const px = f.phase === "countdown" || (!f.liftedOff) ? sx(pad.x) + 0 : sx(f.x), py = f.phase === "countdown" || !f.liftedOff ? sy(pad.y) : sy(f.y);
  ctx.save(); ctx.translate(px, py); ctx.rotate(f.liftedOff ? ang : pad.angle);
  if (f.phase !== "failed") {
    const thrusting = f.engineOn && (f.tel.thrust > 0 || f.phase === "countdown");
    if (thrusting) { const fl = L * (0.55 + 0.7 * f.throttle) * (0.85 + 0.3 * v.flicker); const fg = ctx.createLinearGradient(0, 0, 0, fl); fg.addColorStop(0, "#fff6c9"); fg.addColorStop(0.35, "#ffb347"); fg.addColorStop(1, "rgba(255,90,40,0)"); ctx.fillStyle = fg; ctx.beginPath(); ctx.moveTo(-Wd * 0.7, 0); ctx.lineTo(Wd * 0.7, 0); ctx.lineTo(0, fl); ctx.closePath(); ctx.fill(); }
    ctx.fillStyle = f.stage === 1 ? "#f2f5fa" : "#cfd6e2"; ctx.fillRect(-Wd / 2, -L, Wd, L);
    ctx.fillStyle = "#d8dee9"; ctx.beginPath(); ctx.moveTo(-Wd / 2, -L); ctx.lineTo(0, -L - Wd * 1.6); ctx.lineTo(Wd / 2, -L); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#ff7a33"; ctx.fillRect(-Wd / 2, -L * 0.55, Wd, Math.max(1.5, L * 0.04));
    if (f.stage === 1) { ctx.fillStyle = "#c8553d"; ctx.beginPath(); ctx.moveTo(-Wd / 2, -L * 0.02); ctx.lineTo(-Wd * 1.2, 0); ctx.lineTo(-Wd / 2, -L * 0.2); ctx.fill(); ctx.beginPath(); ctx.moveTo(Wd / 2, -L * 0.02); ctx.lineTo(Wd * 1.2, 0); ctx.lineTo(Wd / 2, -L * 0.2); ctx.fill(); }
  }
  ctx.restore();
  if (f.phase !== "failed" && L <= 20) { ctx.strokeStyle = "#ffd27a"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(sx(f.x), sy(f.y), 11, 0, 7); ctx.stroke(); }

  // ---- explosion
  if (v.boom) {
    const age = v.boom.age, bx = sx(v.boom.x), by = sy(v.boom.y), rad = 14 + age * 90;
    const a = Math.max(0, 1 - age / 2.6);
    const bg = ctx.createRadialGradient(bx, by, 0, bx, by, rad); bg.addColorStop(0, `rgba(255,250,210,${a})`); bg.addColorStop(0.35, `rgba(255,170,60,${a * 0.9})`); bg.addColorStop(1, "rgba(255,70,30,0)");
    ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(bx, by, rad, 0, 7); ctx.fill();
  }
  // ---- orbit achieved halo
  if (f.phase === "orbit") { ctx.strokeStyle = "rgba(95,207,154,.9)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(sx(f.x), sy(f.y), 16 + Math.sin(performance.now() / 250) * 3, 0, 7); ctx.stroke(); }

  // ---- scale bar
  const target = 110 / k, pow = Math.pow(10, Math.floor(Math.log10(target))), nice = [1, 2, 5, 10].map((m) => m * pow).find((m) => m * k >= 70) ?? pow * 10;
  ctx.fillStyle = "rgba(255,255,255,.85)"; ctx.fillRect(18, H - 24, nice * k, 2); ctx.fillRect(18, H - 29, 2, 12); ctx.fillRect(18 + nice * k, H - 29, 2, 12);
  ctx.font = "11px sans-serif"; ctx.fillText(nice >= 1000 ? `${nice / 1000} km` : `${nice} m`, 24, H - 33);
}
