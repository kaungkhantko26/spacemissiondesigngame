import {
  AdditiveBlending, BoxGeometry, CanvasTexture, ConeGeometry, CylinderGeometry, DoubleSide, Group, LatheGeometry, Mesh, MeshBasicMaterial,
  MeshStandardMaterial, SphereGeometry, TorusGeometry, Vector2, type BufferGeometry, type Material,
} from "three";
import type { InstrumentTag } from "./data";

/**
 * Procedural 3-D models for every Mission Architect component (stylised, not CAD): launch vehicles, propulsion, solar arrays,
 * RTGs, antennas and instruments. Pure three.js (no React) so the same builders feed the thumbnails and the live preview.
 * Units are loose "metres"; callers fit the result to their camera with Box3.
 */
const std = (color: string, o: { metalness?: number; roughness?: number; emissive?: string; ei?: number; side?: 0 | 1 | 2 } = {}) =>
  new MeshStandardMaterial({ color, metalness: o.metalness ?? 0.3, roughness: o.roughness ?? 0.55, emissive: o.emissive ?? "#000000", emissiveIntensity: o.ei ?? 0, side: o.side ?? 0 });
const mesh = (g: BufferGeometry, m: Material, x = 0, y = 0, z = 0) => { const o = new Mesh(g, m); o.position.set(x, y, z); return o; };
const cyl = (rt: number, rb: number, h: number, seg = 28) => new CylinderGeometry(rt, rb, h, seg);
const FOIL = () => std("#d6a64e", { metalness: 0.85, roughness: 0.35 });
const WHITE = () => std("#eef2f7", { metalness: 0.15, roughness: 0.5 });
const DARK = () => std("#1d2330", { metalness: 0.5, roughness: 0.5 });
const STEEL = () => std("#9aa6b8", { metalness: 0.8, roughness: 0.3 });
const GLOW = (c: string, o = 0.55) => new MeshBasicMaterial({ color: c, transparent: true, opacity: o, blending: AdditiveBlending, depthWrite: false });

/* ---------------------------------------------------------------- launch vehicles */
export interface RocketStyle { body: string; accent: string; boosters: number; boosterLen: number; boosterRad: number; boosterNose: boolean; taper?: boolean }
const STYLES: Record<string, RocketStyle> = {
  ll2_cfg_26: { body: "#4b5262", accent: "#c3cad8", boosters: 0, boosterLen: 0, boosterRad: 0, boosterNose: false },
  ll2_cfg_43: { body: "#f2f2ee", accent: "#e8742c", boosters: 6, boosterLen: 0.34, boosterRad: 0.3, boosterNose: true },
  ll2_cfg_127: { body: "#f4f6fa", accent: "#2f6cc4", boosters: 0, boosterLen: 0, boosterRad: 0, boosterNose: false },
  ll2_cfg_134: { body: "#c9d2c4", accent: "#3a6b3a", boosters: 4, boosterLen: 0.55, boosterRad: 0.34, boosterNose: true, taper: true },
  ll2_cfg_16: { body: "#f3f5f9", accent: "#2858a8", boosters: 0, boosterLen: 0, boosterRad: 0, boosterNose: false },
  ll2_cfg_121: { body: "#f1f3f8", accent: "#1f4aa0", boosters: 2, boosterLen: 0.45, boosterRad: 0.46, boosterNose: true },
  ll2_cfg_50: { body: "#f1ede6", accent: "#c8382c", boosters: 4, boosterLen: 0.5, boosterRad: 0.3, boosterNose: true },
  ll2_cfg_164: { body: "#f2f5fa", accent: "#101216", boosters: 0, boosterLen: 0, boosterRad: 0, boosterNose: false },
  ll2_cfg_21: { body: "#d9792e", accent: "#f2d9b0", boosters: 2, boosterLen: 0.86, boosterRad: 1, boosterNose: true },
  ll2_cfg_161: { body: "#f2f5fa", accent: "#101216", boosters: 2, boosterLen: 0.86, boosterRad: 1, boosterNose: true },
};
const DEFAULT_STYLE: RocketStyle = { body: "#eef2f7", accent: "#ff7a33", boosters: 0, boosterLen: 0, boosterRad: 0, boosterNose: false };

function stack(r: number, L: number, st: RocketStyle, nose: boolean): Group {
  const g = new Group();
  const lower = L * 0.62, upper = L * 0.22, fair = L * 0.16;
  const body = std(st.body, { metalness: 0.2, roughness: 0.45 }), accent = std(st.accent, { metalness: 0.3, roughness: 0.5 });
  g.add(mesh(cyl(r, r * (st.taper ? 1.12 : 1), lower), body, 0, lower / 2, 0));
  g.add(mesh(cyl(r * 1.02, r * 1.02, L * 0.035), accent, 0, lower + L * 0.0175, 0));          // interstage band
  g.add(mesh(cyl(r * 0.9, r, upper), body, 0, lower + L * 0.035 + upper / 2, 0));
  const fy = lower + L * 0.035 + upper;
  g.add(mesh(cyl(r * 0.95, r * 0.9, fair * 0.4), WHITE(), 0, fy + fair * 0.2, 0));
  if (nose) g.add(mesh(new ConeGeometry(r * 0.95, fair * 0.9, 28), WHITE(), 0, fy + fair * 0.4 + fair * 0.45, 0));
  g.add(mesh(cyl(r * 1.005, r * 1.005, L * 0.02), accent, 0, lower * 0.5, 0));                 // livery stripe
  return g;
}
function bells(r: number, count: number, y = 0): Group {
  const g = new Group(), m = std("#3b4251", { metalness: 0.7, roughness: 0.35 }), cols = Math.max(1, count);
  for (let i = 0; i < cols; i++) {
    const a = (i / cols) * Math.PI * 2, rad = cols === 1 ? 0 : r * 0.55;
    const bell = mesh(new CylinderGeometry(r * 0.16, r * 0.3, r * 0.5, 16, 1, true), m, Math.cos(a) * rad, y - r * 0.2, Math.sin(a) * rad);
    (bell.material as MeshStandardMaterial).side = DoubleSide; g.add(bell);
  }
  return g;
}

/** Saturn V in true proportions (110.6 m): S-IC with 5 F-1 bells and fins, S-II, S-IVB, instrument unit, Apollo CSM and the escape tower. */
export function makeSaturnV(): Group {
  const g = new Group(), white = std("#f3f3ef", { metalness: 0.15, roughness: 0.55 }), black = std("#16181d", { metalness: 0.2, roughness: 0.6 }), gold = FOIL();
  const R1 = 5.05, y1 = 42, y2 = 66.8, y3 = 70.5, y4 = 88.3;
  g.add(mesh(cyl(R1, R1, y1, 36), white, 0, y1 / 2, 0));
  g.add(mesh(cyl(R1 * 1.004, R1 * 1.004, 5, 36), black, 0, 36, 0), mesh(cyl(R1 * 1.004, R1 * 1.004, 4, 36), black, 0, 22, 0), mesh(cyl(R1 * 1.004, R1 * 1.004, 2.4, 36), black, 0, 10, 0));
  g.add(mesh(cyl(R1, R1, y2 - y1, 36), white, 0, (y1 + y2) / 2, 0), mesh(cyl(R1 * 1.004, R1 * 1.004, 1.6, 36), black, 0, y1 + 1, 0));
  g.add(mesh(cyl(3.3, R1, y3 - y2, 36), white, 0, (y2 + y3) / 2, 0));                         // S-II/S-IVB interstage cone
  g.add(mesh(cyl(3.3, 3.3, y4 - y3, 32), white, 0, (y3 + y4) / 2, 0), mesh(cyl(3.34, 3.34, 1.2, 32), black, 0, y3 + 1.2, 0));
  g.add(mesh(cyl(3.3, 3.3, 0.9, 32), std("#d9dbe0"), 0, y4 + 0.45, 0));                         // instrument unit
  g.add(mesh(cyl(1.95, 1.95, 7.5, 28), std("#e6e8ee", { metalness: 0.4 }), 0, y4 + 0.9 + 3.75, 0));
  g.add(mesh(new ConeGeometry(1.95, 3.5, 28), std("#dcdfe6", { metalness: 0.3 }), 0, y4 + 0.9 + 7.5 + 1.75, 0));
  const lesY = y4 + 0.9 + 7.5 + 3.5;
  g.add(mesh(cyl(0.6, 1.5, 1.6, 20), std("#c8553d"), 0, lesY + 0.8, 0), mesh(cyl(0.18, 0.18, 7.5, 10), STEEL(), 0, lesY + 1.6 + 3.75, 0), mesh(new ConeGeometry(0.5, 1.6, 14), std("#c8553d"), 0, lesY + 9.9, 0));
  for (let i = 0; i < 4; i++) { const a = (i * Math.PI) / 2 + Math.PI / 4; const fin = mesh(new BoxGeometry(0.5, 10, 6.5), black, Math.cos(a) * (R1 + 2.4), 4.2, Math.sin(a) * (R1 + 2.4)); fin.rotation.y = -a; g.add(fin); }
  const bell = std("#3b4251", { metalness: 0.7, roughness: 0.35 });
  for (let i = 0; i < 5; i++) { const a = (i / 4) * Math.PI * 2, rad = i === 4 ? 0 : 2.9; const b = mesh(new CylinderGeometry(0.9, 1.9, 4.4, 20, 1, true), bell, Math.cos(a) * rad, -1.6, Math.sin(a) * rad); (b.material as MeshStandardMaterial).side = DoubleSide; g.add(b); }
  return g;
}

export function makeRocket(vehicleId: string, lengthM = 40, diameterM = 3.5): Group {
  if (vehicleId === "ll2_cfg_93") return makeSaturnV();
  const st = STYLES[vehicleId] ?? DEFAULT_STYLE;
  const root = new Group();
  const r = diameterM / 2, L = Math.max(lengthM, diameterM * 6);
  root.add(stack(r, L, st, true), bells(r, st.boosters ? 1 : 9));
  if (st.boosters) {
    const bl = L * st.boosterLen, br = r * (st.boosterRad === 1 ? 1 : st.boosterRad), n = st.boosters;
    for (let i = 0; i < n; i++) {
      const heavy = st.boosterRad === 1;
      const a = heavy ? (i === 0 ? 0 : Math.PI) : (i / n) * Math.PI * 2 + Math.PI / n, d = (heavy ? r * 2.02 : r + br * 0.95);
      const b = new Group();
      b.add(mesh(cyl(br, br, bl), std(heavy ? st.body : "#e9ecf2", { metalness: 0.2, roughness: 0.5 }), 0, bl / 2, 0));
      if (st.boosterNose) b.add(mesh(new ConeGeometry(br, bl * 0.2, 20), WHITE(), 0, bl + bl * 0.1, 0));
      b.add(mesh(cyl(br * 1.02, br * 1.02, bl * 0.05), std(st.accent), 0, bl * 0.4, 0));
      b.add(bells(br * (heavy ? 1.7 : 1.3), heavy ? 9 : 1));
      b.position.set(Math.cos(a) * d, 0, Math.sin(a) * d); root.add(b);
    }
  }
  root.position.y = 0;
  return root;
}

/* ---------------------------------------------------------------- propulsion */
export type ThrusterKind = "chem" | "nstar" | "next" | "bpt4000";
export function makeThruster(kind: string): Group {
  const g = new Group();
  if (kind === "chem") {
    g.add(mesh(cyl(0.34, 0.34, 0.55), std("#b9c2d0", { metalness: 0.7, roughness: 0.35 }), 0, 0.28, 0));                 // chamber
    g.add(mesh(cyl(0.3, 0.3, 0.12), FOIL(), 0, 0.62, 0));
    const lathe = new LatheGeometry([new Vector2(0.12, 0), new Vector2(0.16, -0.12), new Vector2(0.3, -0.45), new Vector2(0.55, -0.95), new Vector2(0.78, -1.35)], 36);
    g.add(mesh(lathe, std("#3b4251", { metalness: 0.85, roughness: 0.3, side: 2 }), 0, 0, 0));
    g.add(mesh(new TorusGeometry(0.78, 0.02, 8, 36), std("#ff7a33", { metalness: 0.4 }), 0, -1.35, 0).rotateX(Math.PI / 2));
    g.add(mesh(new ConeGeometry(0.55, 1.5, 20, 1, true), GLOW("#ffb366", 0.28), 0, -2.05, 0).rotateX(Math.PI));
    return g;
  }
  const housing = std("#8d97a8", { metalness: 0.75, roughness: 0.35 });
  if (kind === "bpt4000") { // Hall-effect: annular channel with central pole
    g.add(mesh(cyl(0.5, 0.5, 0.45, 36), housing, 0, 0.22, 0));
    g.add(mesh(new TorusGeometry(0.34, 0.1, 14, 40), std("#e8eaf0", { metalness: 0.5 }), 0, -0.02, 0).rotateX(Math.PI / 2));
    g.add(mesh(cyl(0.16, 0.16, 0.08, 20), std("#5d6678", { metalness: 0.8 }), 0, -0.04, 0));
    g.add(mesh(new ConeGeometry(0.45, 1.5, 28, 1, true), GLOW("#6cc3ff", 0.32), 0, -0.85, 0).rotateX(Math.PI));
    return g;
  }
  // gridded ion (NSTAR / NEXT): cylinder housing + gold accelerator grid + xenon plume
  const big = kind === "next" ? 1.15 : 0.9;
  g.add(mesh(cyl(0.42 * big, 0.5 * big, 0.55 * big, 36), housing, 0, 0.3 * big, 0));
  g.add(mesh(cyl(0.4 * big, 0.4 * big, 0.05, 36), FOIL(), 0, -0.01, 0));
  g.add(mesh(new TorusGeometry(0.43 * big, 0.03, 8, 40), std("#d7dbe4", { metalness: 0.9 }), 0, 0.02, 0).rotateX(Math.PI / 2));
  g.add(mesh(cyl(0.12 * big, 0.12 * big, 0.2, 12), DARK(), 0.35 * big, 0.62 * big, 0));
  g.add(mesh(new ConeGeometry(0.36 * big, 1.9 * big, 28, 1, true), GLOW("#69b8ff", 0.4), 0, -0.98 * big, 0).rotateX(Math.PI));
  g.add(mesh(new ConeGeometry(0.18 * big, 1.5 * big, 20, 1, true), GLOW("#c4e6ff", 0.5), 0, -0.78 * big, 0).rotateX(Math.PI));
  return g;
}

/* ---------------------------------------------------------------- power */
let cellTex: CanvasTexture | null = null;
function solarTexture(): CanvasTexture {
  if (cellTex) return cellTex;
  const c = document.createElement("canvas"); c.width = c.height = 128;
  const x = c.getContext("2d");
  if (!x) { cellTex = new CanvasTexture(c); return cellTex; } // no 2-D canvas (SSR/tests): plain texture
  x.fillStyle = "#0f2a5c"; x.fillRect(0, 0, 128, 128);
  const g = x.createLinearGradient(0, 0, 128, 128); g.addColorStop(0, "rgba(90,150,255,.35)"); g.addColorStop(1, "rgba(10,40,110,.1)"); x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  x.strokeStyle = "#c9d6ee"; x.lineWidth = 2;
  for (let i = 0; i <= 4; i++) { x.beginPath(); x.moveTo(i * 32, 0); x.lineTo(i * 32, 128); x.stroke(); x.beginPath(); x.moveTo(0, i * 32); x.lineTo(128, i * 32); x.stroke(); }
  cellTex = new CanvasTexture(c); cellTex.anisotropy = 4;
  return cellTex;
}
/** One solar wing: yoke + a row of panels totalling `areaM2` (clamped to a drawable size). */
export function makeSolarWing(areaM2: number, dir: 1 | -1 = 1): Group {
  const g = new Group();
  const a = Math.max(0.5, areaM2), h = Math.min(2.2, 0.9 + a * 0.05), segs = Math.min(5, Math.max(1, Math.round(a / 8) + 1));
  const w = a / segs / h, tex = solarTexture().clone(); tex.needsUpdate = true; tex.repeat.set(Math.max(1, Math.round(w)), Math.max(1, Math.round(h))); tex.wrapS = tex.wrapT = 1000;
  const panelMat = new MeshStandardMaterial({ map: tex, metalness: 0.6, roughness: 0.3, emissive: "#0a1e4a", emissiveIntensity: 0.25 });
  g.add(mesh(cyl(0.04, 0.04, 0.6), STEEL(), dir * 0.3, 0, 0).rotateZ(Math.PI / 2));
  for (let i = 0; i < segs; i++) {
    const panel = mesh(new BoxGeometry(w, 0.03, h), panelMat, dir * (0.6 + w * (i + 0.5) + i * 0.04), 0, 0);
    g.add(panel);
    g.add(mesh(new BoxGeometry(w + 0.04, 0.036, 0.035), std("#c7cfdd", { metalness: 0.8 }), panel.position.x, 0, h / 2));
  }
  return g;
}
export function makeSolarArray(areaM2: number): Group { const g = new Group(); g.add(makeSolarWing(areaM2 / 2, 1), makeSolarWing(areaM2 / 2, -1)); return g; }
export function makeRTG(): Group {
  const g = new Group(), body = std("#2b2f3a", { metalness: 0.6, roughness: 0.45 });
  g.add(mesh(cyl(0.22, 0.22, 1.1, 24), body, 0, 0.55, 0));
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; for (let k = 0; k < 4; k++) { const fin = mesh(new BoxGeometry(0.34, 0.02, 0.22), std("#c9ced8", { metalness: 0.85, roughness: 0.3 }), 0, 0.15 + k * 0.25, 0); fin.position.x = Math.cos(a) * 0.3; fin.position.z = Math.sin(a) * 0.3; fin.rotation.y = -a; g.add(fin); } }
  g.add(mesh(cyl(0.24, 0.24, 0.1, 24), WHITE(), 0, 1.15, 0), mesh(cyl(0.26, 0.26, 0.08, 24), FOIL(), 0, 0.02, 0));
  return g;
}

/* ---------------------------------------------------------------- antennas */
export function makeAntenna(id: string, dishM: number): Group {
  const g = new Group();
  if (id === "patch") {
    g.add(mesh(new BoxGeometry(0.5, 0.05, 0.5), FOIL(), 0, 0.03, 0), mesh(new BoxGeometry(0.38, 0.02, 0.38), std("#f3e3b8", { metalness: 0.4 }), 0, 0.07, 0), mesh(new BoxGeometry(0.1, 0.08, 0.1), DARK(), 0, 0.09, 0));
    return g;
  }
  const r = dishM * 0.5, depth = r * 0.42, pts: Vector2[] = [];
  for (let i = 0; i <= 14; i++) { const t = i / 14, rr = t * r; pts.push(new Vector2(rr, depth * t * t)); }
  g.add(mesh(new LatheGeometry(pts, 40), std("#f1f3f7", { metalness: 0.3, roughness: 0.4, side: 2 }), 0, 0, 0));
  g.add(mesh(cyl(0.03 * r + 0.02, 0.03 * r + 0.02, depth * 1.5), STEEL(), 0, depth * 0.75, 0));
  g.add(mesh(new ConeGeometry(0.1 * r + 0.04, 0.2 * r + 0.1, 12), FOIL(), 0, depth * 1.55, 0).rotateX(Math.PI));
  for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2; const s = mesh(cyl(0.012 * r + 0.008, 0.012 * r + 0.008, Math.hypot(r * 0.8, depth * 1.4)), STEEL(), Math.cos(a) * r * 0.4, depth * 0.78, Math.sin(a) * r * 0.4); s.rotation.set(Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9); g.add(s); }
  g.add(mesh(new TorusGeometry(r, 0.012 * r + 0.01, 6, 48), STEEL(), 0, depth, 0).rotateX(Math.PI / 2));
  return g;
}

/* ---------------------------------------------------------------- instruments */
export function makeInstrument(tag: InstrumentTag, massKg: number): Group {
  const g = new Group(), s = 0.5 + 0.22 * Math.sqrt(Math.max(0.2, massKg));
  const box = std("#2f3646", { metalness: 0.55, roughness: 0.45 }), light = std("#cfd6e3", { metalness: 0.6, roughness: 0.35 });
  g.scale.setScalar(s);
  switch (tag) {
    case "imager": { // camera barrel + lens + hood
      g.add(mesh(cyl(0.3, 0.3, 0.75, 24), light, 0, 0.375, 0), mesh(cyl(0.33, 0.33, 0.1, 24), FOIL(), 0, 0.05, 0), mesh(cyl(0.36, 0.28, 0.25, 24, ), DARK(), 0, 0.85, 0));
      g.add(mesh(new SphereGeometry(0.2, 18, 12), std("#3a6cc4", { metalness: 0.9, roughness: 0.1, emissive: "#102a6a", ei: 0.5 }), 0, 0.9, 0));
      break; }
    case "radar": { // flat phased-array panel on a short mast
      g.add(mesh(new BoxGeometry(1.1, 0.06, 0.7), std("#1b2438", { metalness: 0.6 }), 0, 0.55, 0), mesh(new BoxGeometry(1.0, 0.02, 0.6), std("#5a7fb8", { metalness: 0.9, roughness: 0.25, emissive: "#16294d", ei: 0.4 }), 0, 0.59, 0), mesh(cyl(0.05, 0.05, 0.55), STEEL(), 0, 0.27, 0));
      break; }
    case "fields": { // magnetometer boom with sensor head
      g.add(mesh(cyl(0.025, 0.025, 1.8), std("#bcc4d2", { metalness: 0.8 }), 0, 0.9, 0), mesh(new BoxGeometry(0.22, 0.22, 0.22), box, 0, 0.12, 0), mesh(new SphereGeometry(0.1, 14, 10), std("#ff7a33", { metalness: 0.5, emissive: "#6a2400", ei: 0.4 }), 0, 1.85, 0));
      break; }
    case "plasma": { // cup analyser
      g.add(mesh(cyl(0.45, 0.28, 0.35, 28, ), light, 0, 0.35, 0), mesh(cyl(0.46, 0.46, 0.04, 28), std("#7ad0e8", { metalness: 0.8, roughness: 0.25, emissive: "#0d4a5a", ei: 0.4 }), 0, 0.54, 0), mesh(new BoxGeometry(0.4, 0.18, 0.4), box, 0, 0.09, 0));
      break; }
    case "particles": { // detector box with aperture
      g.add(mesh(new BoxGeometry(0.6, 0.5, 0.6), box, 0, 0.25, 0), mesh(new BoxGeometry(0.34, 0.04, 0.34), std("#0c0f16"), 0, 0.52, 0), mesh(new BoxGeometry(0.62, 0.05, 0.62), FOIL(), 0, 0.03, 0));
      break; }
    case "spectrometer": { // tall box + slit + fins
      g.add(mesh(new BoxGeometry(0.5, 0.8, 0.45), light, 0, 0.4, 0), mesh(new BoxGeometry(0.34, 0.5, 0.02), DARK(), 0, 0.45, 0.235), mesh(new BoxGeometry(0.04, 0.4, 0.03), std("#9fe8c4", { emissive: "#2a7a58", ei: 0.8 }), 0, 0.45, 0.25));
      for (let i = 0; i < 4; i++) g.add(mesh(new BoxGeometry(0.56, 0.02, 0.3), STEEL(), 0, 0.12 + i * 0.07, -0.28));
      break; }
    default: g.add(mesh(new BoxGeometry(0.6, 0.5, 0.6), light, 0, 0.25, 0), mesh(new BoxGeometry(0.62, 0.05, 0.62), FOIL(), 0, 0.02, 0));
  }
  return g;
}

/* ---------------------------------------------------------------- assembled spacecraft */
export interface CraftSpec { solarAreaM2: number; rtgUnits: number; antennaId: string; dishM: number; thruster: string; thrusters: number; instruments: { tag: InstrumentTag; massKg: number }[] }
/** Bus with every selected component mounted: wings ±X, dish +Y, engine −Y, instruments on the +Z deck, RTGs on a boom at −Z. */
export function makeSpacecraft(c: CraftSpec): Group {
  const g = new Group();
  const bus = new Group();
  bus.add(mesh(new BoxGeometry(1.5, 1.5, 1.8), FOIL(), 0, 0, 0), mesh(new BoxGeometry(1.54, 0.12, 1.84), std("#e9ecf2", { metalness: 0.3 }), 0, 0.5, 0), mesh(new BoxGeometry(1.54, 0.12, 1.84), std("#e9ecf2", { metalness: 0.3 }), 0, -0.5, 0));
  g.add(bus);
  if (c.solarAreaM2 > 0.5) { const wings = makeSolarArray(c.solarAreaM2); wings.position.set(0, 0, 0); wings.children.forEach((w) => { w.position.x += w === wings.children[0] ? 0.75 : -0.75; }); g.add(wings); }
  const ant = makeAntenna(c.antennaId, c.dishM);
  const scale = c.antennaId === "patch" ? 1 : Math.max(0.45, c.dishM * 0.85);
  const dishBase = new Group(); dishBase.add(mesh(cyl(0.06, 0.06, 0.55), STEEL(), 0, 0.27, 0)); ant.position.y = 0.55; ant.scale.setScalar(c.antennaId === "patch" ? 1 : scale / Math.max(0.5, c.dishM * 0.5) * (c.dishM * 0.5));
  dishBase.add(ant); dishBase.position.set(0.1, 0.78, -0.2); dishBase.rotation.x = -0.35; g.add(dishBase);
  const th = makeThruster(c.thruster); const n = Math.max(1, c.thrusters);
  for (let i = 0; i < n; i++) { const t = th.clone(); t.scale.setScalar(0.6); t.rotation.x = Math.PI; t.position.set((i - (n - 1) / 2) * 0.62, -0.75, 0); g.add(t); }
  c.instruments.slice(0, 8).forEach((ins, i) => { const m = makeInstrument(ins.tag, ins.massKg); m.scale.multiplyScalar(0.55); const col = i % 3, row = Math.floor(i / 3); m.position.set((col - 1) * 0.5, -0.4 + row * 0.55, 0.9); m.rotation.x = Math.PI / 2; g.add(m); });
  for (let i = 0; i < Math.min(4, c.rtgUnits); i++) { const r = makeRTG(); r.scale.setScalar(0.7); r.rotation.x = -Math.PI / 2; r.position.set(((i % 2) - 0.5) * 0.9, (Math.floor(i / 2) - 0.5) * 0.6, -1.0 - 0.1); g.add(r); const boom = mesh(cyl(0.025, 0.025, 0.7), STEEL(), r.position.x, r.position.y, -0.75); boom.rotation.x = Math.PI / 2; g.add(boom); }
  return g;
}

/** Dispose every geometry/material in a built model (thumbnails build 40 of them once). */
export function disposeModel(root: Group) {
  root.traverse((o) => { const m = o as Mesh; if (m.isMesh) { m.geometry.dispose(); const mat = m.material as Material | Material[]; (Array.isArray(mat) ? mat : [mat]).forEach((x) => x.dispose()); } });
}
