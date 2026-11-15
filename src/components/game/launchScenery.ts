import { density } from "@/game/launch/core";

/**
 * Real-environment scenery for the launch scene: per-spaceport biome (terrain, sea, vegetation, light), an atmosphere-correct
 * sky that darkens with altitude, layered hills with aerial perspective, clouds the rocket flies through, the launch complex
 * and exhaust smoke. Everything is drawn procedurally on a 2-D canvas in the pad's local frame (metres) so it scales with the zoom.
 */
type RGB = [number, number, number];
export interface Biome {
  id: string; name: string; land: [RGB, RGB]; hills: { amp: number; freq: number; color: RGB; p: number }[]; sea?: { side: 1 | -1; shoreM: number; shallow: RGB; deep: RGB };
  veg: "palm" | "pine" | "jungle" | "scrub" | "none"; vegDensity: number; sand: boolean; zenith: RGB; horizon: RGB; glow: RGB; haze: number; cloudiness: number;
}
const c = (hex: string): RGB => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
export const BIOMES: Record<string, Biome> = {
  ll2_pad_87: { id: "kennedy", name: "Kennedy coastal marsh", land: [c("#839272"), c("#626f53")], hills: [{ amp: 5, freq: 1800, color: c("#71866e"), p: 0.5 }], sea: { side: 1, shoreM: 1100, shallow: c("#58b3bd"), deep: c("#1d5d8f") }, veg: "scrub", vegDensity: 0.2, sand: false, zenith: c("#2f6fc9"), horizon: c("#d3e6f3"), glow: c("#ffd29a"), haze: 0.55, cloudiness: 0.7 },
  ll2_pad_16: { id: "vandenberg", name: "California coast range", land: [c("#9b8650"), c("#6f5e38")], hills: [{ amp: 1500, freq: 11000, color: c("#8d8a73"), p: 0.18 }, { amp: 700, freq: 6000, color: c("#8a7c52"), p: 0.35 }, { amp: 260, freq: 2600, color: c("#7d6e45"), p: 0.6 }], sea: { side: -1, shoreM: 640, shallow: c("#4f9db0"), deep: c("#1b4f7c") }, veg: "scrub", vegDensity: 0.3, sand: false, zenith: c("#2b66bd"), horizon: c("#d8e4ef"), glow: c("#ffcf94"), haze: 0.35, cloudiness: 0.35 },
  ll2_pad_124: { id: "kourou", name: "Guiana forest clearing", land: [c("#628154"), c("#426646")], hills: [{ amp: 35, freq: 2200, color: c("#3b6b3a"), p: 0.4 }], sea: { side: 1, shoreM: 3000, shallow: c("#6db39a"), deep: c("#27698a") }, veg: "jungle", vegDensity: 0.55, sand: false, zenith: c("#2f74cf"), horizon: c("#d6e9ef"), glow: c("#ffd8a6"), haze: 0.65, cloudiness: 0.85 },
  ll2_pad_50: { id: "sriharikota", name: "Bay of Bengal sand spit", land: [c("#bfa772"), c("#92814f")], hills: [{ amp: 30, freq: 1200, color: c("#9d8c5f"), p: 0.5 }], sea: { side: 1, shoreM: 470, shallow: c("#63b8c0"), deep: c("#215f8a") }, veg: "palm", vegDensity: 0.25, sand: true, zenith: c("#3170c7"), horizon: c("#e0e8ee"), glow: c("#ffd199"), haze: 0.5, cloudiness: 0.5 },
  ll2_pad_32: { id: "baikonur", name: "Baikonur dry steppe", land: [c("#aa9a66"), c("#86764e")], hills: [{ amp: 9, freq: 2400, color: c("#9a8b5f"), p: 0.45 }], veg: "scrub", vegDensity: 0.08, sand: true, zenith: c("#3a73c0"), horizon: c("#e3e4dc"), glow: c("#ffd9a4"), haze: 0.5, cloudiness: 0.3 },
};
export const biomeFor = (siteId: string): Biome => BIOMES[siteId] ?? BIOMES.ll2_pad_87;

const rgb = (a: number[], al = 1) => `rgba(${Math.round(a[0])},${Math.round(a[1])},${Math.round(a[2])},${al})`;
const mix = (a: number[], b: number[], t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const smooth = (x: number) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };
export const hash = (n: number) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const noise = (x: number, seed: number) => (Math.sin(x + seed) * 0.5 + Math.sin(x * 2.37 + seed * 1.7) * 0.3 + Math.sin(x * 5.11 + seed * 0.6) * 0.2 + 1) / 2;
const SPACE: RGB = [3, 6, 16];

/** Sky colour at height h (m) above the local ground: pale horizon → deep zenith → black above ~100 km. */
export function skyAt(h: number, b: Biome): RGB {
  const day = mix(b.horizon, b.zenith, Math.pow(smooth(h / 22000), 0.62));
  return mix(day, SPACE, smooth((h - 20000) / 80000));
}

export interface Scene { W: number; H: number; k: number; E: number; gy: number; anchorX: number; camX: number; time: number; alpha: number; night: number }

export function drawSky(ctx: CanvasRenderingContext2D, s: Scene, b: Biome) {
  const g = ctx.createLinearGradient(0, 0, 0, Math.max(s.gy, 1));
  const N = 18;
  // near the ground the view spans only a few hundred metres, but the eye reads sky colour by elevation angle — exaggerate it
  for (let i = 0; i <= N; i++) { const y = (s.gy * i) / N, h = Math.max(0, (s.gy - y) / s.k); g.addColorStop(i / N, rgb(skyAt(Math.max(h, ((s.gy - y) / s.H) * 11000), b))); }
  ctx.fillStyle = "#03060f"; ctx.fillRect(0, 0, s.W, s.H);
  ctx.save(); ctx.globalAlpha = Math.max(0, Math.min(1, s.alpha)); // sky fades to black as the camera pulls back to orbit view
  ctx.fillStyle = g; ctx.fillRect(0, 0, s.W, Math.max(0, Math.min(s.H, s.gy + 2)));
  // golden-hour sun low in the east + horizon glow (fades as the sky darkens)
  const day = 1 - s.night;
  if (day > 0.02) {
    const sx = s.W * 0.86, sy = Math.min(s.gy, s.H) - s.H * 0.1 - s.W * 0.02;
    const glow = ctx.createRadialGradient(sx, s.gy, 0, sx, s.gy, s.W * 0.7);
    glow.addColorStop(0, rgb(b.glow, 0.5 * day)); glow.addColorStop(0.4, rgb(b.glow, 0.16 * day)); glow.addColorStop(1, rgb(b.glow, 0));
    ctx.fillStyle = glow; ctx.fillRect(0, 0, s.W, s.H);
    const sun = ctx.createRadialGradient(sx, sy, 0, sx, sy, 70);
    sun.addColorStop(0, `rgba(255,252,235,${0.95 * day})`); sun.addColorStop(0.12, `rgba(255,236,190,${0.8 * day})`); sun.addColorStop(1, "rgba(255,210,150,0)");
    ctx.fillStyle = sun; ctx.beginPath(); ctx.arc(sx, sy, 70, 0, 7); ctx.fill();
  }
  ctx.restore();
}

/* ------------------------------------------------------------ terrain */
function silhouette(ctx: CanvasRenderingContext2D, s: Scene, layer: Biome["hills"][number], seed: number, color: RGB, b: Biome) {
  const aX = s.W / 2 + (s.anchorX - s.W / 2) * layer.p, n = Math.ceil(s.W / 7) + 2;
  const hazeT = Math.min(0.9, b.haze * (1.1 - layer.p) + 0.1);
  ctx.beginPath(); ctx.moveTo(0, s.gy + 1);
  for (let i = 0; i <= n; i++) { const x = i * 7, xm = (x - aX) / s.k; ctx.lineTo(x, s.gy - layer.amp * (noise(xm / layer.freq * 6.28, seed) - 0.25) * Math.max(0, 1) * s.k); }
  ctx.lineTo(s.W, s.gy + 1); ctx.closePath();
  const g = ctx.createLinearGradient(0, s.gy - layer.amp * s.k, 0, s.gy);
  g.addColorStop(0, rgb(mix(color, b.horizon, hazeT), s.alpha)); g.addColorStop(1, rgb(mix(color, b.horizon, Math.min(0.95, hazeT + 0.25)), s.alpha));
  ctx.fillStyle = g; ctx.fill();
}

export function drawTerrain(ctx: CanvasRenderingContext2D, s: Scene, b: Biome, alt = 0) {
  if (s.alpha <= 0.01) return;
  const { W, H, gy, k } = s, below = Math.max(1, H - gy);
  // far → near hill layers
  b.hills.forEach((l, i) => silhouette(ctx, s, l, 11 + i * 5.3, l.color, b));
  // ground plane with perspective gradient
  const land = ctx.createLinearGradient(0, gy, 0, H);
  land.addColorStop(0, rgb(mix(b.land[0], b.horizon, b.haze * 0.7), s.alpha)); land.addColorStop(0.25, rgb(b.land[0], s.alpha)); land.addColorStop(1, rgb(b.land[1], s.alpha));
  ctx.fillStyle = land; ctx.fillRect(0, gy, W, below);
  // sea
  if (b.sea) {
    const side = b.sea.side, shoreX = s.anchorX + side * b.sea.shoreM * k;
    const slope = 0.42 * side;
    ctx.save(); ctx.beginPath();
    if (side === 1) { ctx.moveTo(shoreX, gy); ctx.lineTo(W, gy); ctx.lineTo(W, H); ctx.lineTo(shoreX + slope * below, H); } else { ctx.moveTo(shoreX, gy); ctx.lineTo(0, gy); ctx.lineTo(0, H); ctx.lineTo(shoreX + slope * below, H); }
    ctx.closePath(); ctx.clip();
    const sea = ctx.createLinearGradient(0, gy, 0, H);
    sea.addColorStop(0, rgb(mix(b.sea.deep, b.horizon, 0.55), s.alpha)); sea.addColorStop(0.35, rgb(b.sea.deep, s.alpha)); sea.addColorStop(1, rgb(b.sea.shallow, s.alpha));
    ctx.fillStyle = sea; ctx.fillRect(0, gy, W, below);
    const sunX = W * 0.86;
    for (let r = 0; r < 70; r++) { // wave crests, denser and longer toward the camera; glitter on the sun's path
      const t = (r + 0.5) / 70, y = gy + below * Math.pow(t, 1.9), len = (6 + t * 90) * (0.5 + hash(r * 3.1)), x0 = hash(r * 7.7) * W;
      const near = Math.max(0, 1 - Math.abs(x0 - sunX) / (W * 0.22)), tw = 0.5 + 0.5 * Math.sin(s.time * 2.1 + r * 1.7);
      ctx.fillStyle = `rgba(255,${240 - near * 20},${215 - near * 60},${s.alpha * (0.07 + near * 0.55 * tw * (1 - t * 0.4))})`; ctx.fillRect(x0, y, len, 1 + t * 2.2);
    }
    ctx.restore();
    // foam line along the shore
    ctx.strokeStyle = `rgba(255,255,255,${0.5 * s.alpha})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(shoreX, gy); ctx.lineTo(shoreX + slope * below, H); ctx.stroke();
  }
  // Cleared launch compound seen in perspective; vegetation begins beyond the hardstand.
  const apron = ctx.createLinearGradient(0, gy, 0, H);
  apron.addColorStop(0, rgb(mix(c("#a9a9a1"), b.land[0], 0.18), s.alpha));
  apron.addColorStop(1, rgb(mix(c("#747873"), b.land[1], 0.22), s.alpha));
  ctx.fillStyle = apron; ctx.beginPath();
  ctx.moveTo(s.anchorX - 235 * k, gy); ctx.lineTo(s.anchorX + 235 * k, gy);
  ctx.lineTo(s.anchorX + 390 * k, H); ctx.lineTo(s.anchorX - 390 * k, H); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = `rgba(230,225,205,${0.22 * s.alpha})`; ctx.lineWidth = Math.max(1, k);
  for (const side of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s.anchorX + side * 235 * k, gy); ctx.lineTo(s.anchorX + side * 390 * k, H); ctx.stroke(); }
  // vegetation / dunes on the land side, drawn in perspective rows (nearer rows are bigger and slide faster)
  const rows = 26, vegFade = 1 - smooth(alt / 22000), shrink = 1 / (1 + alt / 3500);
  for (let r = rows - 1; r >= 0 && vegFade > 0.02; r--) {
    const t = (r + 0.5) / rows, y = gy + below * Math.pow(t, 1.8), sc = 0.12 + t * 1.5, p = 0.3 + 1.1 * t, aX = W / 2 + (s.anchorX - W / 2) * p;
    ctx.globalAlpha = vegFade;
    const count = Math.round((5 + t * 9) * (b.veg === "none" ? 0 : b.vegDensity * 2.4) * Math.max(0.35, shrink));
    for (let i = 0; i < count; i++) {
      const x = aX + (hash(r * 31 + i * 7.3) - 0.5) * W * 2.4;
      // The serviced launch pad is a cleared hardstand, not a meadow of trees.
      if (Math.abs(x - s.anchorX) < Math.max(95, 260 * k) * (0.6 + t * 0.5)) continue;
      if (b.sea) { const sx = s.anchorX + b.sea.side * b.sea.shoreM * k + b.sea.side * 0.42 * (y - gy); if ((x - sx) * b.sea.side > -6 * sc) continue; }
      const size = (6 + hash(r * 9 + i) * 10) * sc * shrink * (b.veg === "jungle" ? 1.7 : b.veg === "palm" ? 1.1 : 0.8);
      if (x < -30 || x > W + 30) continue;
      const shade = 0.82 + hash(i + r * 5) * 0.3;
      if (b.veg === "palm") { ctx.strokeStyle = `rgba(80,62,40,${s.alpha})`; ctx.lineWidth = Math.max(1, size * 0.14); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + size * 0.15, y - size * 1.5); ctx.stroke(); ctx.fillStyle = rgb([50 * shade, 112 * shade, 52 * shade], s.alpha); for (let f = 0; f < 5; f++) { const a = -Math.PI / 2 + (f - 2) * 0.62; ctx.beginPath(); ctx.ellipse(x + size * 0.15 + Math.cos(a) * size * 0.55, y - size * 1.5 + Math.sin(a) * size * 0.4, size * 0.62, size * 0.13, a, 0, 7); ctx.fill(); } }
      else if (b.veg === "pine") { ctx.fillStyle = rgb([34 * shade, 78 * shade, 44 * shade], s.alpha); ctx.beginPath(); ctx.moveTo(x - size * 0.4, y); ctx.lineTo(x, y - size * 1.9); ctx.lineTo(x + size * 0.4, y); ctx.fill(); }
      else { const col = b.veg === "jungle" ? ([26, 88, 34] as RGB) : ([118, 110, 70] as RGB); ctx.fillStyle = rgb([col[0] * shade, col[1] * shade, col[2] * shade], s.alpha); ctx.beginPath(); ctx.ellipse(x, y - size * 0.4, size * (b.veg === "jungle" ? 1.1 : 0.9), size * (b.veg === "jungle" ? 0.85 : 0.5), 0, 0, 7); ctx.fill(); }
    }
    if (b.sand && t > 0.15 && r % 2 === 0) { ctx.strokeStyle = `rgba(255,236,190,${0.12 * s.alpha})`; ctx.lineWidth = 1 + t * 2; ctx.beginPath(); for (let x = 0; x <= W; x += 14) { const yy = y + Math.sin(x * 0.01 / (0.4 + t) + r) * 3 * sc; if (x) ctx.lineTo(x, yy); else ctx.moveTo(x, yy); } ctx.stroke(); }
  }
  ctx.globalAlpha = 1;
  // humid haze right at the horizon
  const hz = ctx.createLinearGradient(0, gy - 90 * Math.max(0.4, Math.min(2.5, k * 40)), 0, gy + 60);
  hz.addColorStop(0, rgb(b.horizon, 0)); hz.addColorStop(0.7, rgb(b.horizon, 0.38 * b.haze * s.alpha)); hz.addColorStop(1, rgb(b.horizon, 0));
  ctx.fillStyle = hz; ctx.fillRect(0, gy - 90 * Math.max(0.4, Math.min(2.5, k * 40)), W, 150 * Math.max(0.4, Math.min(2.5, k * 40)));
}

/* ------------------------------------------------------------ clouds */
export function puff(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, a: number, shade = 0) {
  const g = ctx.createRadialGradient(x - r * 0.15, y - r * 0.2, r * 0.05, x, y, r);
  g.addColorStop(0, `rgba(255,255,255,${0.95 * a})`); g.addColorStop(0.55, `rgba(${240 - shade},${244 - shade},${250 - shade * 0.6},${0.7 * a})`); g.addColorStop(1, `rgba(${225 - shade},${232 - shade},${244 - shade * 0.5},0)`);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
}
export function drawClouds(ctx: CanvasRenderingContext2D, s: Scene, b: Biome) {
  if (s.alpha <= 0.02) return;
  const { k } = s;
  const layer = (altM: number, spacingM: number, sizeM: number, p: number, puffs: number, a: number, flat: number, seed: number) => {
    if (sizeM * k < 1.6) return; // clouds smaller than a couple of pixels: not worth thousands of gradients per frame
    const aX = s.W / 2 + (s.anchorX - s.W / 2) * p, n0 = Math.floor((-aX / k) / spacingM) - 1, n1 = Math.ceil(((s.W - aX) / k) / spacingM) + 1;
    if (n1 - n0 > 90) return; // too many to draw while the camera is zoomed far out
    for (let i = n0; i <= n1; i++) {
      if (hash(i * 3.3 + seed) > b.cloudiness) continue;
      const cx = aX + (i * spacingM + (hash(i + seed) - 0.5) * spacingM * 0.8) * k, cy = s.gy - (altM + (hash(i * 5 + seed) - 0.5) * altM * 0.5) * k;
      for (let j = 0; j < puffs; j++) { const dx = (hash(i * 9 + j + seed) - 0.5) * sizeM * 2.2, dy = (hash(i * 4 + j * 2 + seed) - 0.5) * sizeM * 0.55 * flat, r = sizeM * (0.45 + hash(i + j * 1.7 + seed) * 0.6); puff(ctx, cx + dx * k, cy + dy * k, r * k, a * s.alpha, j % 2 ? 14 : 0); }
    }
  };
  layer(9500, 14000, 2600, 0.95, 6, 0.3, 0.22, 90); // cirrus
  layer(5200, 9000, 2100, 0.92, 6, 0.7, 0.8, 31);    // towering cumulus the rocket punches through
  layer(2400, 6500, 1100, 0.88, 11, 0.92, 1, 7);      // cumulus
  layer(1100, 4200, 800, 0.84, 5, 0.6, 0.55, 51);   // low scud
}

/* ------------------------------------------------------------ launch complex (pad-local frame, metres) */
export function drawComplex(ctx: CanvasRenderingContext2D, s: Scene, padAngle: number, padX: number, padY: number, b: Biome) {
  const u = s.k;
  if (u * 300 < 4) return;
  ctx.save(); ctx.translate(padX, padY); ctx.rotate(padAngle);
  ctx.globalAlpha = Math.min(1, u * 10);
  const box = (x: number, y: number, w: number, h: number, color: string) => { ctx.fillStyle = color; ctx.fillRect(x * u, y * u, w * u, h * u); };
  const stroke = (points: [number, number][], color: string, width = 2) => {
    ctx.strokeStyle = color; ctx.lineWidth = Math.max(1, width * u); ctx.beginPath();
    points.forEach(([x, y], i) => i ? ctx.lineTo(x * u, y * u) : ctx.moveTo(x * u, y * u)); ctx.stroke();
  };
  const tower = (x: number, height: number, width: number, color: string, bays = 7) => {
    box(x, -height, width, height, color);
    box(x + 4, -height + 5, width - 8, height - 10, "#64717c");
    for (let i = 0; i <= bays; i++) {
      const y = -height + i * height / bays;
      box(x - 6, y, width + 12, 3, "#b8bec2");
      if (i < bays) stroke([[x + 4, y], [x + width - 4, y + height / bays]], "#c4cbd0", 2);
    }
  };
  const tank = (x: number, w: number, h: number) => {
    box(x, -h, w, h, "#d8dfe1");
    ctx.fillStyle = "#e9eeeb"; ctx.beginPath(); ctx.ellipse((x + w / 2) * u, -h * u, w * u / 2, 8 * u, 0, Math.PI, 0); ctx.fill();
    box(x, -h + 15, w, 4, "#a1afb2");
  };
  const rail = (x0: number, x1: number) => {
    for (const y of [3, 11]) stroke([[x0, y], [x1, y]], "#3a4143", 2);
    for (let x = x0; x < x1; x += 16) box(x, 1, 5, 13, "#746b59");
  };
  // All sites have a cleared paved hardstand and a flame trench. The surrounding structures follow each real pad's layout.
  box(-280, 0, 560, 10, "#a5a9a9"); box(-43, 1, 86, 17, "#25282b");
  if (b.id === "kennedy") {
    // LC-39A: raised pad and crawler ramp, fixed tower, water tower, Atlantic coastal marsh.
    box(-180, -13, 360, 13, "#9ba1a4"); box(-40, -13, 80, 30, "#242729");
    stroke([[-185, 0], [-520, 24]], "#8c9191", 16);
    tower(-95, 118, 27, "#a8b0b3", 9);
    for (const y of [-42, -73, -100]) stroke([[-68, y], [-13, y + 2]], "#c6cdca", 5);
    tower(185, 63, 9, "#8c999d", 5); tank(171, 37, 13);
    tank(-420, 31, 25); tank(-355, 27, 20);
    for (const x of [-250, 150, 275]) { stroke([[x, 0], [x, -150], [x + 10, -174]], "#9ca7aa", 2); box(x + 7, -176, 5, 5, "#ef6046"); }
  } else if (b.id === "vandenberg") {
    // SLC-4E: austere Falcon pad on a dry coastal bluff, low horizontal processing buildings.
    box(-460, -29, 170, 29, "#b1aca3"); box(-485, -32, 220, 5, "#777c79");
    tank(230, 35, 22); tank(288, 30, 18);
    stroke([[72, 0], [69, -62], [24, -72]], "#757d7e", 6);
    for (const x of [-205, 170]) { stroke([[x, 0], [x, -105]], "#8e9899", 2); box(x - 3, -107, 6, 5, "#d45844"); }
    stroke([[-560, 8], [-160, 8]], "#646b69", 8);
  } else if (b.id === "kourou") {
    // Ariane ELA-2: mobile service structure parked on rails by the forest clearing.
    rail(-560, 150); tower(-245, 110, 64, "#bac3c0", 9);
    box(-330, -32, 105, 32, "#cbd1ca"); box(-345, -36, 135, 5, "#838f8a");
    tower(80, 84, 20, "#a9b4b0", 7);
    stroke([[96, -59], [25, -59]], "#b9c2bb", 4);
    tank(195, 30, 26); tank(245, 30, 26);
  } else if (b.id === "sriharikota") {
    // SDSC: rail-retracted mobile service tower on the narrow, sandy coastal island.
    rail(-520, 125); tower(-280, 98, 77, "#adb8b4", 10);
    box(-450, -24, 145, 24, "#d3d7cf"); box(-460, -28, 165, 5, "#818b86");
    tower(73, 87, 18, "#9da9a5", 7); stroke([[82, -62], [20, -62]], "#d0d5cc", 4);
    tank(200, 35, 28); tank(255, 33, 24);
  } else {
    // Site 1/5: Baikonur's open steppe, railway and opposed green Soyuz support arms.
    rail(-650, -60); tower(-145, 66, 26, "#79908a", 5);
    tower(120, 66, 26, "#79908a", 5);
    stroke([[-126, -49], [-31, -30]], "#7b9a89", 8);
    stroke([[126, -49], [31, -30]], "#7b9a89", 8);
    box(-420, -26, 160, 26, "#a8a899"); box(-425, -30, 170, 5, "#777f76");
    tank(240, 24, 19);
  }
  // Sparse fixed perimeter lights, outside the blast zone.
  for (const x of [-275, 275]) { stroke([[x, 0], [x, -24]], "#777f80", 1); box(x - 2, -27, 5, 4, "#f4c471"); }
  ctx.restore();
}

/* ------------------------------------------------------------ exhaust smoke (pad frame) */
export interface Puff { x: number; y: number; vx: number; vy: number; r: number; age: number; life: number; heat: number }
export function updateSmoke(list: Puff[], engineOn: boolean, thrustFrac: number, alt: number, dt: number): Puff[] {
  const out = list.filter((p) => p.age < p.life);
  if (engineOn && alt < 450 && thrustFrac > 0.05) {
    const n = Math.round(60 * dt * (1 + (alt < 60 ? 2 : 0)));
    for (let i = 0; i < n; i++) { const dir = Math.random() < 0.5 ? -1 : 1; out.push({ x: dir * (10 + Math.random() * 18), y: 6 + Math.random() * 10, vx: dir * (22 + Math.random() * 70), vy: 4 + Math.random() * 18, r: 16 + Math.random() * 14, age: 0, life: 7 + Math.random() * 8, heat: 1 }); }
  }
  for (const p of out) { p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= Math.pow(0.8, dt); p.vy *= Math.pow(0.9, dt); p.vy += 3 * dt; p.r += (14 - p.age) * 0.9 * dt + 3 * dt; p.heat = Math.max(0, p.heat - dt * 0.9); }
  return out.slice(-420);
}
export function drawSmoke(ctx: CanvasRenderingContext2D, s: Scene, list: Puff[], padAngle: number, padX: number, padY: number) {
  if (!list.length) return;
  ctx.save(); ctx.translate(padX, padY); ctx.rotate(padAngle);
  for (const p of list) {
    const a = Math.max(0, 1 - p.age / p.life) * 0.5, r = Math.max(2, p.r * s.k);
    const g = ctx.createRadialGradient(p.x * s.k, -p.y * s.k, 0, p.x * s.k, -p.y * s.k, r);
    const hot = p.heat; g.addColorStop(0, `rgba(${240 + hot * 15},${232 - (1 - hot) * 20},${215 - (1 - hot) * 30},${a})`); g.addColorStop(0.6, `rgba(214,210,204,${a * 0.6})`); g.addColorStop(1, "rgba(205,204,202,0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x * s.k, -p.y * s.k, r, 0, 7); ctx.fill();
  }
  ctx.restore();
}

/** Exhaust-trail opacity at a point: thick white vapour in dense air, fading to nothing in vacuum. */
export const trailAlpha = (h: number) => Math.min(0.85, 0.1 + 0.9 * (density(h) / 1.225) ** 0.5);
