import { LAUNCH, MOON_DIST_M, R_E, TLI, density, orbitElements, padPosition, thrustDir, type Flight } from "@/game/launch/core";
import { biomeFor, drawClouds, drawComplex, drawSky, drawSmoke, drawTerrain, trailAlpha, updateSmoke, type Biome, type Puff, type Scene } from "./launchScenery";
import type { RocketSprite } from "./partThumbs";

/** Camera + scene state for the launch canvas (a class so async loaders can attach textures without mutating React state). */
export class SceneView {
  cx = 0; cy = R_E(); logE = Math.log(190); shake = 0; boom: { x: number; y: number; age: number } | null = null; flicker = 0;
  smoke: Puff[] = []; earth: HTMLCanvasElement | null = null; sprite: RocketSprite | null = null; biome: Biome;
  stars: [number, number, number][] = Array.from({ length: 190 }, (_, i) => { const a = Math.sin(i * 91.7) * 43758.5453; const b = Math.sin(i * 12.9) * 24634.6345; return [a - Math.floor(a), b - Math.floor(b), 0.35 + ((i * 37) % 10) / 12] as [number, number, number]; });
  constructor(siteId: string) { this.biome = biomeFor(siteId); }
  setEarth(c: HTMLCanvasElement | null) { this.earth = c; }
  setSprite(s: RocketSprite | null) { this.sprite = s; }
}
export const newView = (siteId: string) => new SceneView(siteId);

const R = R_E();
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (x: number) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };

/** Advance the camera toward what the player should see (pad+tower → climbing rocket → whole Earth + orbit). */
export function updateView(v: SceneView, f: Flight, dtReal: number, reduced: boolean, simDt: number) {
  const alt = Math.hypot(f.x, f.y) - R, pad = padPosition(f);
  const onPad = !f.liftedOff || alt < 40;
  const d = Math.hypot(f.x - pad.x, f.y - pad.y);
  const s = smooth((alt - 70_000) / 80_000); // orbit view blend
  const b = onPad ? 0.5 : Math.max(0, 0.5 * (1 - alt / 40_000));
  const tx = lerp(lerp(f.x, pad.x, b), 0, s), ty = lerp(lerp(f.y, pad.y, b), 0, s);
  const eAsc = Math.max(onPad ? 190 : 260, 2.1 * d + 160);
  let tLogE = lerp(Math.log(eAsc), Math.log(R * 1.35), s), cx = tx, cy = ty;
  if (f.mission === "moon" && (f.phase === "tli" || f.phase === "translunar" || f.phase === "parking")) {
    // pull back to frame the whole transfer ellipse (Earth at one end, the Moon at the apogee)
    const el = orbitElements(f.x, f.y, f.vx, f.vy);
    if (el.bound && el.apo > 15_000_000) {
      const rApo = el.apo + R, a = Math.atan2(el.ey, el.ex) + Math.PI;
      tLogE = Math.log(rApo * 0.62); cx = Math.cos(a) * rApo * 0.5; cy = Math.sin(a) * rApo * 0.5;
    }
  }
  const k = 1 - Math.exp(-dtReal * (onPad ? 3 : 2.2));
  v.cx += (cx - v.cx) * k; v.cy += (cy - v.cy) * k; v.logE += (tLogE - v.logE) * k;
  const thrusting = f.engineOn && f.tel.thrust > 0;
  v.shake = reduced ? 0 : thrusting && alt < 8000 ? Math.min(1, (f.tel.thrust / (f.rocket.s1.thrustSlN || 1)) * (1 - alt / 8000)) * 2.2 : 0;
  v.flicker = reduced ? 0.5 : Math.random();
  if (simDt > 0) v.smoke = updateSmoke(v.smoke, f.engineOn && f.stage === 1, f.throttle, alt, simDt);
  if (f.phase === "failed" && f.failure && !v.boom) v.boom = { x: f.x, y: f.y, age: 0 };
  if (v.boom) v.boom.age += dtReal;
  if (f.phase === "countdown" && f.t < -LAUNCH.countdownS + 0.1) { v.boom = null; v.smoke = []; }
}

export function drawFlight(ctx: CanvasRenderingContext2D, W: number, H: number, f: Flight, v: SceneView) {
  if (!(W > 8 && H > 8) || !Number.isFinite(v.logE)) return; // canvas not laid out yet
  const alt = Math.hypot(f.x, f.y) - R, b = v.biome, now = performance.now() / 1000;
  const E = Math.exp(v.logE), k = (Math.min(W, H) * 0.5 * 0.9) / E;
  const sh = v.shake ? () => (Math.random() - 0.5) * v.shake * 2 : () => 0;
  const sx = (x: number) => W / 2 + (x - v.cx) * k + sh();
  const sy = (y: number) => H / 2 - (y - v.cy) * k + sh();
  const pad = padPosition(f), padX = sx(pad.x), padY = sy(pad.y);
  const hTop = Math.max(0, padY) / k, skyA = 1 - smooth((E - 60_000) / 120_000), land = 1 - smooth((E - 30_000) / 70_000);
  const night = Math.max(smooth((hTop - 22_000) / 80_000), smooth((E - 40_000) / 60_000));
  const scene: Scene = { W, H, k, E, gy: padY, anchorX: padX, camX: v.cx, time: now, alpha: land, night };

  // ---- sky + stars (space is the default background)
  ctx.save(); ctx.globalAlpha = 1; drawSky(ctx, { ...scene, alpha: skyA }, b); ctx.restore();
  const starA = Math.max(0, night - 0.15) * 1.1;
  if (starA > 0) { ctx.fillStyle = "#fff"; for (const [a, c, s] of v.stars) { ctx.globalAlpha = Math.min(1, starA) * s * 0.85; ctx.fillRect(a * W, c * H, s * 1.6, s * 1.6); } ctx.globalAlpha = 1; }

  // ---- Earth: surface colour (mid zoom), real texture (orbit zoom), atmosphere rim
  const alpha0 = Math.atan2(v.cy, v.cx), dist = Math.hypot(v.cx, v.cy);
  const diagM = Math.hypot(W, H) / k, span = Math.min(Math.PI, Math.asin(Math.min(1, (diagM * 0.75 + 1) / Math.max(R, dist))) + 0.2);
  const arc = (rad: number, from: number, to: number, n = 90) => { for (let i = 0; i <= n; i++) { const a = from + ((to - from) * i) / n; const x = sx(rad * Math.cos(a)), y = sy(rad * Math.sin(a)); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); } };
  const near = dist > R * 0.2, a0 = near ? alpha0 - span : 0, a1 = near ? alpha0 + span : Math.PI * 2;
  const ocean = [27, 79, 134], surf = b.sea ? [(b.land[0][0] + b.sea.deep[0]) / 2, (b.land[0][1] + b.sea.deep[1]) / 2, (b.land[0][2] + b.sea.deep[2]) / 2] : b.land[0];
  const mixAmt = smooth((E - 250_000) / 1_500_000), base = surf.map((c, i) => Math.round(lerp(c * 0.8, ocean[i], mixAmt)));
  ctx.beginPath(); arc(R, a0, a1); if (near) { ctx.lineTo(sx(0), sy(0)); ctx.closePath(); } else ctx.closePath();
  ctx.fillStyle = `rgb(${base[0]},${base[1]},${base[2]})`; ctx.fill();
  const imgA = smooth((E - 0.1 * R) / (0.25 * R));
  if (v.earth && imgA > 0.01) {
    const cxs = sx(0), cys = sy(0), rpx = R * k;
    ctx.save(); ctx.globalAlpha = imgA; ctx.beginPath(); ctx.arc(cxs, cys, rpx, 0, Math.PI * 2); ctx.clip();
    ctx.translate(cxs, cys); ctx.rotate(pad.angle); ctx.drawImage(v.earth, -rpx, -rpx, rpx * 2, rpx * 2); ctx.rotate(-pad.angle);
    const shade = ctx.createLinearGradient(-rpx, 0, rpx, 0); shade.addColorStop(0, "rgba(0,0,14,.62)"); shade.addColorStop(0.5, "rgba(0,0,14,.12)"); shade.addColorStop(1, "rgba(255,230,190,.06)");
    ctx.fillStyle = shade; ctx.fillRect(-rpx, -rpx, rpx * 2, rpx * 2); ctx.restore();
  }
  ctx.save(); ctx.beginPath(); arc(R + 25_000, a0, a1); ctx.lineWidth = Math.max(1.5, 60_000 * k); ctx.strokeStyle = `rgba(120,185,255,${0.1 + 0.16 * night})`; ctx.stroke(); ctx.restore();
  ctx.beginPath(); arc(R, a0, a1); ctx.lineWidth = 1.2; ctx.strokeStyle = "rgba(170,215,255,.55)"; ctx.stroke();

  // ---- real-environment scenery near the ground
  drawTerrain(ctx, scene, b, Math.max(0, alt));
  drawClouds(ctx, scene, b);

  // ---- reference rings + predicted orbit (orbit view)
  if (E > R * 0.15) {
    ctx.setLineDash([6, 6]); ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(255,255,255,.35)"; ctx.beginPath(); arc(R + LAUNCH.karmanM, 0, Math.PI * 2, 180); ctx.stroke();
    ctx.strokeStyle = "rgba(95,207,154,.6)"; ctx.beginPath(); arc(R + LAUNCH.targetOrbitKm * 1000, 0, Math.PI * 2, 180); ctx.stroke(); ctx.setLineDash([]);
  }
  const el = orbitElements(f.x, f.y, f.vx, f.vy);
  if (el.bound && f.liftedOff && (f.stage === 2 || f.phase === "coast") && E > 4_000) {
    const e = Math.min(el.e, 0.999), p = el.a * (1 - e * e), wp = Math.atan2(el.ey, el.ex), dir = el.hz < 0 ? -1 : 1;
    ctx.strokeStyle = "rgba(79,200,247,.9)"; ctx.lineWidth = 1.6; ctx.beginPath(); let pen = false;
    for (let i = 0; i <= 720; i++) { const nu = (i / 720) * Math.PI * 2, r = p / (1 + e * Math.cos(nu)); if (r < R) { pen = false; continue; } const a = wp + dir * nu; const x = sx(r * Math.cos(a)), y = sy(r * Math.sin(a)); if (pen) ctx.lineTo(x, y); else ctx.moveTo(x, y); pen = true; }
    ctx.stroke();
  }

  // ---- Moon mission: the Moon waits at the end of the transfer; TLI window marker on the parking orbit
  if (f.mission === "moon" && (f.phase === "parking" || f.phase === "tli" || f.phase === "translunar")) {
    const ma = f.tliStartAngle - TLI.leadRad + Math.PI, D = MOON_DIST_M(), mx = sx(D * Math.cos(ma)), my = sy(D * Math.sin(ma));
    ctx.setLineDash([3, 8]); ctx.strokeStyle = "rgba(200,210,230,.25)"; ctx.lineWidth = 1; ctx.beginPath(); arc(D, 0, Math.PI * 2, 360); ctx.stroke(); ctx.setLineDash([]);
    const mr = Math.max(5, 1_737_400 * k), mg = ctx.createRadialGradient(mx - mr * 0.3, my - mr * 0.3, mr * 0.1, mx, my, mr); mg.addColorStop(0, "#e8e8ea"); mg.addColorStop(1, "#8d8f96");
    ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(mx, my, mr, 0, 7); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.85)"; ctx.font = "11px sans-serif"; ctx.fillText("Moon", mx + mr + 5, my + 4);
    if (f.phase === "parking" && f.park) {
      const rp = R + ((f.park.periKm + f.park.apoKm) / 2) * 1000, wx = sx(rp * Math.cos(f.tliStartAngle)), wy = sy(rp * Math.sin(f.tliStartAngle));
      ctx.strokeStyle = "#ff7a33"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(wx, wy, 9, 0, 7); ctx.stroke(); ctx.fillStyle = "#ff7a33"; ctx.fillText("TLI window", wx + 13, wy - 4);
    }
  }

  // ---- launch complex, tower, smoke
  drawComplex(ctx, scene, pad.angle, padX, padY, b);
  if (k * 120 > 5) {
    ctx.save(); ctx.translate(padX, padY); ctx.rotate(pad.angle);
    const u = k; ctx.fillStyle = "#5b6574"; ctx.fillRect(-60 * u, 0, 120 * u, 5 * u);
    ctx.fillStyle = "#3a4250"; ctx.fillRect(-14 * u, 0, 28 * u, 3 * u);
    ctx.fillStyle = "#8c97a8"; ctx.fillRect(-26 * u, -78 * u, 5 * u, 78 * u); ctx.fillRect(-26 * u, -78 * u, 12 * u, 1.6 * u);
    ctx.strokeStyle = "#8c97a8"; ctx.lineWidth = Math.max(1, 1.2 * u);
    for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(-26 * u, -i * 13 * u); ctx.lineTo(-18 * u, -(i + 1) * 13 * u); ctx.stroke(); }
    ctx.fillStyle = "#c8553d"; ctx.fillRect(-32 * u, -78 * u, 16 * u, 3 * u);
    ctx.restore();
  } else if (alt < 30_000) { ctx.fillStyle = "#ffd27a"; ctx.beginPath(); ctx.arc(padX, padY, 3, 0, 7); ctx.fill(); }
  drawSmoke(ctx, scene, v.smoke, pad.angle, padX, padY);
  if (f.engineOn && alt < 350 && f.tel.thrust > 0 || (f.phase === "countdown" && f.engineOn)) { // ground glare under the engines
    const gl = ctx.createRadialGradient(padX, padY - 4 * k, 0, padX, padY - 4 * k, 90 * k * (1 - Math.min(1, alt / 450) * 0.7));
    gl.addColorStop(0, "rgba(255,230,170,.8)"); gl.addColorStop(0.4, "rgba(255,150,60,.35)"); gl.addColorStop(1, "rgba(255,120,40,0)");
    ctx.fillStyle = gl; ctx.fillRect(padX - 200 * k, padY - 200 * k, 400 * k, 260 * k);
  }

  // ---- exhaust trail: stored with timestamps and drawn in the Earth-fixed frame (the air rotates with the ground), so it
  //      hangs in the sky behind the rocket instead of smearing sideways at Earth-rotation speed
  const tr = f.trail, aNow = pad.angle, omega = f.omega;
  if (tr.length > 5) {
    const fix = (x: number, y: number, t: number): [number, number] => { const d = aNow - omega * Math.max(0, t), c = Math.cos(d), sn = Math.sin(d); return [sx(x * c + y * sn), sy(-x * sn + y * c)]; };
    ctx.lineJoin = "round"; ctx.lineCap = "round";
    const wBase = Math.max(1.6, Math.min(6, f.rocket.diameterM * k * 1.2));
    let [px0, py0] = fix(tr[0], tr[1], tr[2]);
    const n = tr.length / 3;
    for (let i = 1; i < n; i++) {
      const [px1, py1] = fix(tr[i * 3], tr[i * 3 + 1], tr[i * 3 + 2]);
      const h = Math.hypot(tr[i * 3], tr[i * 3 + 1]) - R, aT = trailAlpha(h), fresh = Math.max(0, 1 - (n - i) / 12);
      ctx.strokeStyle = h > 70_000 ? "rgba(255,170,100,.75)" : `rgba(${Math.round(255 - (1 - fresh) * 25)},${Math.round(250 - (1 - fresh) * 25)},${Math.round(245 - (1 - fresh) * 20)},${Math.min(0.9, aT * (0.5 + fresh * 0.5))})`;
      ctx.lineWidth = h > 70_000 ? 1.8 : wBase * (0.6 + Math.min(1, density(h) / 1.225) * 1.3);
      ctx.beginPath(); ctx.moveTo(px0, py0); ctx.lineTo(px1, py1); ctx.stroke(); px0 = px1; py0 = py1;
    }
    ctx.strokeStyle = "rgba(255,170,100,.9)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(px0, py0); ctx.lineTo(sx(f.x), sy(f.y)); ctx.stroke();
  }

  // ---- spent stage (3-D sprite lower part, tumbling)
  const sp = v.sprite;
  for (const d of f.debris) {
    const part = d.bot - d.top, Ld = Math.max(10, f.rocket.lengthM * part * k), wd = Math.max(3, f.rocket.lengthM * k * (sp?.aspect ?? 0.06) * 1.25);
    ctx.save(); ctx.translate(sx(d.x), sy(d.y)); ctx.rotate(Math.atan2(d.vx, d.vy) + f.t * 0.25);
    if (sp) ctx.drawImage(sp.img, 0, sp.img.height * d.top, sp.img.width, sp.img.height * part, -wd / 2, -Ld / 2, wd, Ld); else { ctx.fillStyle = "#9aa4b4"; ctx.fillRect(-2, -Ld / 2, 4, Ld); }
    ctx.restore();
  }

  // ---- rocket
  const td = thrustDir(f), ang = Math.atan2(td.x, td.y), onGround = f.phase === "countdown" || !f.liftedOff;
  const stg = f.phase === "coast" ? f.sepFrom + 1 : f.stage, frac = stg === 1 ? 1 : stg === 2 ? f.rocket.stageFrac[0] : f.rocket.stageFrac[1], len = f.rocket.lengthM * frac, L = Math.max(16, Math.min(f.stage === 1 ? 320 : 200, len * k));
  const Wd = sp ? Math.max(3, L / frac * sp.aspect * 1.25) : Math.max(3, Math.min(L * 0.13, 12));
  ctx.save(); ctx.translate(onGround ? padX : sx(f.x), onGround ? padY : sy(f.y)); ctx.rotate(f.liftedOff ? ang : pad.angle);
  if (f.phase !== "failed") {
    const thrusting = f.engineOn && (f.tel.thrust > 0 || f.phase === "countdown");
    if (thrusting) {
      const fl = L * (0.6 + 0.8 * f.throttle) * (0.85 + 0.3 * v.flicker) * (alt > 40_000 ? 1.4 : 1), fw = Math.max(3, Wd * (alt > 40_000 ? 1.2 : 0.9));
      const fg = ctx.createLinearGradient(0, 0, 0, fl); fg.addColorStop(0, "#fffbe0"); fg.addColorStop(0.25, "#ffc65a"); fg.addColorStop(0.7, "rgba(255,110,40,.55)"); fg.addColorStop(1, "rgba(255,90,40,0)");
      ctx.fillStyle = fg; ctx.beginPath(); ctx.moveTo(-fw * 0.7, 0); ctx.quadraticCurveTo(-fw * 0.9, fl * 0.5, 0, fl); ctx.quadraticCurveTo(fw * 0.9, fl * 0.5, fw * 0.7, 0); ctx.closePath(); ctx.fill();
    }
    if (sp) {
      const sh0 = 0, sH = sp.img.height * frac;
      ctx.drawImage(sp.img, 0, sh0, sp.img.width, sH, -Wd / 2, -L, Wd, L);
    } else {
      ctx.fillStyle = f.stage === 1 ? "#f2f5fa" : "#cfd6e2"; ctx.fillRect(-Wd / 2, -L, Wd, L);
      ctx.fillStyle = "#d8dee9"; ctx.beginPath(); ctx.moveTo(-Wd / 2, -L); ctx.lineTo(0, -L - Wd * 1.6); ctx.lineTo(Wd / 2, -L); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#ff7a33"; ctx.fillRect(-Wd / 2, -L * 0.55, Wd, Math.max(1.5, L * 0.04));
    }
  }
  ctx.restore();
  if (f.phase !== "failed" && L <= 20) { ctx.strokeStyle = "#ffd27a"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(sx(f.x), sy(f.y), 11, 0, 7); ctx.stroke(); }

  // ---- explosion
  if (v.boom) {
    const age = v.boom.age, bx = sx(v.boom.x), by = sy(v.boom.y), rad = 18 + age * 110, a = Math.max(0, 1 - age / 2.8);
    const bg = ctx.createRadialGradient(bx, by, 0, bx, by, rad); bg.addColorStop(0, `rgba(255,250,215,${a})`); bg.addColorStop(0.3, `rgba(255,175,60,${a * 0.95})`); bg.addColorStop(0.7, `rgba(190,70,30,${a * 0.5})`); bg.addColorStop(1, "rgba(60,30,20,0)");
    ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(bx, by, rad, 0, 7); ctx.fill();
  }
  if (f.phase === "orbit") { ctx.strokeStyle = "rgba(95,207,154,.9)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(sx(f.x), sy(f.y), 16 + Math.sin(now * 4) * 3, 0, 7); ctx.stroke(); }

  // ---- scale bar + location tag
  const target = 110 / k, pow = Math.pow(10, Math.floor(Math.log10(target))), nice = [1, 2, 5, 10].map((m) => m * pow).find((m) => m * k >= 70) ?? pow * 10;
  ctx.fillStyle = "rgba(255,255,255,.88)"; ctx.fillRect(18, H - 24, nice * k, 2); ctx.fillRect(18, H - 29, 2, 12); ctx.fillRect(18 + nice * k, H - 29, 2, 12);
  ctx.font = "11px sans-serif"; ctx.fillText(nice >= 1000 ? `${nice / 1000} km` : `${nice} m`, 24, H - 33);
  if (land > 0.3) { ctx.font = "11px sans-serif"; ctx.fillStyle = "rgba(255,255,255,.75)"; ctx.fillText(`${b.name}`, W - 150, H - 12); }
}
