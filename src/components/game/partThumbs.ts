"use client";
import { useEffect, useState } from "react";
import { AmbientLight, Box3, DirectionalLight, Group, HemisphereLight, PerspectiveCamera, Scene, SRGBColorSpace, Vector3, WebGLRenderer } from "three";
import { ANTENNAS, DATASET } from "@/game/data";
import { disposeModel, makeAntenna, makeInstrument, makeRocket, makeRTG, makeSolarArray, makeThruster } from "@/game/parts3d";

interface Job { key: string; build: () => Group; w: number; h: number; dir?: [number, number, number]; ref?: number }

const jobs = (): Job[] => [
  ...DATASET.vehicles.map((v): Job => ({ key: `veh:${v.id}`, build: () => makeRocket(v.id, v.length_m ?? 40, v.diameter_m ?? 3.5), w: 140, h: 220, dir: [0.8, 0.25, 1.1] })),
  ...(["chem", ...DATASET.electric_propulsion.map((e) => e.id)]).map((id): Job => ({ key: `prop:${id}`, build: () => makeThruster(id), w: 200, h: 200, dir: [0.9, 0.35, 1.1] })),
  ...ANTENNAS.map((a): Job => ({ key: `ant:${a.id}`, build: () => makeAntenna(a.id, a.dishM), w: 200, h: 200, dir: [0.9, 0.5, 1.1], ref: 2.3 })),
  ...DATASET.instruments.map((i): Job => ({ key: `ins:${i.id}`, build: () => makeInstrument(i.tag, i.mass_kg), w: 160, h: 160, dir: [0.9, 0.6, 1.1] })),
  { key: "power:solar", build: () => makeSolarArray(24), w: 220, h: 160, dir: [0.2, 1.2, 1.0] },
  { key: "power:rtg", build: () => makeRTG(), w: 160, h: 200, dir: [0.9, 0.4, 1.1] },
];

/** Render every part once with ONE temporary WebGL context (released afterwards), return PNG data URLs. */
function renderAll(): Record<string, string> {
  const out: Record<string, string> = {};
  let renderer: WebGLRenderer | null = null;
  try {
    const canvas = document.createElement("canvas");
    renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setClearColor(0x000000, 0); renderer.outputColorSpace = SRGBColorSpace; renderer.setPixelRatio(1.5);
    const scene = new Scene();
    scene.add(new HemisphereLight(0xdbe8ff, 0x1c2230, 1.5), new AmbientLight(0xffffff, 0.35));
    const key = new DirectionalLight(0xfff1dc, 2.6); key.position.set(3, 5, 4);
    const rim = new DirectionalLight(0x6cc3ff, 1.4); rim.position.set(-4, 2, -3);
    scene.add(key, rim);
    for (const j of jobs()) {
      const model = j.build(); scene.add(model);
      const box = new Box3().setFromObject(model), size = box.getSize(new Vector3()), center = box.getCenter(new Vector3());
      const cam = new PerspectiveCamera(28, j.w / j.h, 0.1, 5000);
      const tanV = Math.tan((28 * Math.PI) / 360), tanH = tanV * (j.w / j.h);
      // Fit the bounding box (tall rockets fill their frame); `ref` pins a common scale so a 4 m dish looks bigger than a 1 m dish.
      const half = j.ref ?? 0, dist = (half ? half / Math.min(tanV, tanH) : Math.max(size.y / 2 / tanV, Math.max(size.x, size.z) / 2 / tanH) + size.z / 2) * 1.12;
      const d = new Vector3(...(j.dir ?? [0.9, 0.4, 1.1])).normalize();
      cam.position.copy(center).addScaledVector(d, dist); cam.lookAt(center);
      renderer.setSize(j.w, j.h, false); renderer.render(scene, cam);
      out[j.key] = canvas.toDataURL("image/png");
      scene.remove(model); disposeModel(model);
    }
  } catch { /* WebGL unavailable: cards simply show no picture */ }
  finally { if (renderer) { renderer.dispose(); renderer.forceContextLoss(); } }
  return out;
}

let cache: Record<string, string> | null = null;
const waiting = new Set<(c: Record<string, string>) => void>();
let started = false;
function ensure() {
  if (cache || started) return; started = true;
  setTimeout(() => { cache = renderAll(); waiting.forEach((f) => f(cache!)); waiting.clear(); }, 30);
}
/** Part pictures, keyed `veh:<id>` · `prop:<id>` · `ant:<id>` · `ins:<id>` · `power:solar|rtg`. Empty until rendered. */
export function usePartThumbs(): Record<string, string> {
  const [t, setT] = useState<Record<string, string>>(() => cache ?? {});
  useEffect(() => {
    if (cache) { const c = cache; Promise.resolve().then(() => setT(c)); return; }
    waiting.add(setT); ensure();
    return () => { waiting.delete(setT); };
  }, []);
  return t;
}

/* ---------- side-view sprite of the real 3-D rocket for the Launch Control canvas ---------- */
import { OrthographicCamera } from "three";
export interface RocketSprite { img: HTMLImageElement; aspect: number }
const sprites = new Map<string, Promise<RocketSprite | null>>();
/** Orthographic side view of makeRocket(), transparent background, cropped exactly to the model. One short-lived WebGL context. */
export function loadRocketSprite(vehicleId: string): Promise<RocketSprite | null> {
  const hit = sprites.get(vehicleId); if (hit) return hit;
  const p = new Promise<RocketSprite | null>((resolve) => {
    setTimeout(() => {
      let renderer: WebGLRenderer | null = null;
      try {
        const v = DATASET.vehicles.find((x) => x.id === vehicleId);
        const model = makeRocket(vehicleId, v?.length_m ?? 40, v?.diameter_m ?? 3.5);
        const box = new Box3().setFromObject(model), size = box.getSize(new Vector3()), c = box.getCenter(new Vector3());
        const h = 640, w = Math.max(28, Math.round((h * Math.max(size.x, size.z)) / size.y * 1.06));
        const canvas = document.createElement("canvas");
        renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
        renderer.setClearColor(0x000000, 0); renderer.outputColorSpace = SRGBColorSpace; renderer.setSize(w, h, false);
        const scene = new Scene(); scene.add(model, new HemisphereLight(0xe6efff, 0x3a3f4c, 1.9), new AmbientLight(0xffffff, 0.45));
        const key = new DirectionalLight(0xfff0d8, 2.4); key.position.set(4, 3, 6); scene.add(key);
        const cam = new OrthographicCamera((-size.y * (w / h)) / 2, (size.y * (w / h)) / 2, size.y / 2, -size.y / 2, 0.1, 5000);
        cam.position.set(c.x, c.y, c.z + 400); cam.lookAt(c);
        renderer.render(scene, cam);
        const url = canvas.toDataURL("image/png"); disposeModel(model);
        const img = new Image();
        img.onload = () => resolve({ img, aspect: w / h }); img.onerror = () => resolve(null); img.src = url;
      } catch { resolve(null); }
      finally { if (renderer) { renderer.dispose(); renderer.forceContextLoss(); } }
    }, 0);
  });
  sprites.set(vehicleId, p);
  return p;
}
