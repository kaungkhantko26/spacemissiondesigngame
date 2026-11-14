"use client";
import { Component, Suspense, useEffect, useMemo, useRef, type ReactNode } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Stars, useAnimations, useGLTF, useTexture } from "@react-three/drei";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import { AdditiveBlending, CanvasTexture, SRGBColorSpace, Vector3, type Group, type Mesh, type MeshStandardMaterial, type Object3D } from "three";
import { BackpackGear, BootGear, Headgear, PatchGear, ShoulderGear, patternTexture } from "./Gear";
import { useUIStore } from "@/stores";
import { asset } from "@/lib/asset";
import { create } from "zustand";

/** True once an astronaut model has actually been shown, so screens can swap a poster image for the live 3D one. */
export const useAstronautReady = create<{ ready: boolean; set: () => void }>((set) => ({ ready: false, set: () => set({ ready: true }) }));

/** Error boundary: 3D must never block navigation. */
class Boundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean; tries: number }> {
  state = { failed: false, tries: 0 };
  private timer: ReturnType<typeof setTimeout> | null = null;
  static getDerivedStateFromError() { return { failed: true }; }
  /** A dropped connection while a big model downloads must not leave a permanent hole: forget the failed request and try again a few times. */
  componentDidCatch() {
    if (this.state.tries >= 4) return;
    this.timer = setTimeout(() => { useGLTF.clear(ASTRONAUT_URL); this.setState((st) => ({ failed: false, tries: st.tries + 1 })); }, 2500 * (this.state.tries + 1));
  }
  componentWillUnmount() { if (this.timer) clearTimeout(this.timer); }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

const Fallback = ({ label }: { label: string }) => (
  <div className="grid h-full w-full place-items-center rounded-xl bg-white/5 text-sm text-ink2" role="img" aria-label={label}>
    3D preview unavailable
  </div>
);

export type LightPreset = "studio" | "hangar" | "orbit";

/** Shared canvas wrapper: quality-aware DPR, lighting presets, optional controls. */
export function Scene3D({ children, camera = [0, 1.2, 5], controls = false, light = "studio", stars = true, label = "3D scene", className = "h-full w-full", far }: {
  children: ReactNode; camera?: [number, number, number]; controls?: boolean; light?: LightPreset; stars?: boolean; label?: string; className?: string; far?: number;
}) {
  const quality = useUIStore((s) => s.quality);
  const dpr: [number, number] = quality === "low" ? [1, 1] : quality === "medium" ? [1, 1.5] : [1, 2];
  return (
    <div className={className} aria-label={label} role="img">
      <Boundary fallback={<Fallback label={label} />}>
        <Canvas dpr={dpr} camera={{ position: camera, fov: 40, ...(far ? { far } : {}) }} gl={{ antialias: quality !== "low", powerPreference: "high-performance" }}>
          <Suspense fallback={null}>
            <Lights preset={light} />
            {stars && <Stars radius={60} depth={30} count={quality === "low" ? 500 : 1800} factor={3} fade />}
            {children}
            {controls && <OrbitControls enablePan={false} minDistance={2.5} maxDistance={9} />}
          </Suspense>
        </Canvas>
      </Boundary>
    </div>
  );
}

function Lights({ preset }: { preset: LightPreset }) {
  const cfg = {
    studio: { amb: 0.6, key: "#ffffff", rim: "#168bff" },
    hangar: { amb: 0.5, key: "#9fd0ff", rim: "#ff8c42" },
    orbit: { amb: 0.25, key: "#fff4e0", rim: "#168bff" },
  }[preset];
  return (
    <>
      <ambientLight intensity={cfg.amb} />
      <directionalLight position={[3, 4, 5]} intensity={2} color={cfg.key} />
      <directionalLight position={[-4, 2, -3]} intensity={1.4} color={cfg.rim} />
    </>
  );
}

/* ---------- Astronaut (rigged GLB, recolourable skins) ---------- */
export interface AstronautLook {
  suit: string; skin?: string; helmet?: string; accent?: string; pack?: string; packKind?: string; packAccent?: string; patchKind?: string; patchColor?: string; patchAccent?: string;
  /** Cosmetic ids + colours (see data/mock cosmetics): pattern decal, headgear, shoulder gear, boots. */
  pattern?: string; patternColor?: string; headgear?: string; headgearColor?: string;
  shoulder?: string; shoulderColor?: string; boots?: string; bootsColor?: string;
  pose?: "idle" | "wave" | "ready" | "celebrate";
}
export const ASTRONAUT_URL = asset("/models/astronaut.glb");
const POSE_CLIP = { idle: "idle", wave: "wave", ready: "floating", celebrate: "moon_walk" } as const;
const MODEL_HEIGHT = 3.1165; // native height of the GLB in its own units
const TARGET_HEIGHT = 2.4; // world units, feet resting on y=-0.25

export function Astronaut({ suit, helmet = "#4fc3f7", pose = "idle", position = [0, 0, 0], scale = 1, rotationY = 0, pattern, patternColor, headgear, headgearColor, shoulder, shoulderColor, boots, bootsColor, pack, packKind, packAccent, patchKind, patchColor, patchAccent }:
  AstronautLook & { position?: [number, number, number]; scale?: number; rotationY?: number }) {
  const { scene, animations } = useGLTF(ASTRONAUT_URL);
  // Per-instance clone so skins and animation state never leak between crew members.
  const model = useMemo(() => {
    const c = cloneSkeleton(scene);
    c.traverse((o) => {
      const m = o as Mesh;
      if (m.isMesh) m.material = (m.material as MeshStandardMaterial).clone();
    });
    return c;
  }, [scene]);
  // Source model is ~3.12 units tall (T-pose bounds measured offline); scale it to TARGET_HEIGHT.
  const k = TARGET_HEIGHT / MODEL_HEIGHT;
  const offset: [number, number, number] = [0, -0.25, 0.08 * k];
  const root = useRef<Group>(null);
  const { actions } = useAnimations(animations, root);
  const markReady = useAstronautReady((st) => st.set);
  useEffect(() => { markReady(); }, [markReady]);
  const reduced = useUIStore((s) => s.reducedMotion);

  // Skin: tint the suit materials; the near-black visor takes the helmet colour.
  useEffect(() => {
    model.traverse((o) => {
      const m = o as Mesh;
      if (!m.isMesh) return;
      const mat = m.material as MeshStandardMaterial;
      if (mat.name === "material_1") { mat.color.set(helmet).multiplyScalar(0.25); return; }
      mat.color.set(suit);
      // Pattern decal = glowing emissive mask in the pattern colour (keeps the suit's baked detail underneath).
      const tex = pattern ? patternTexture(pattern) : null;
      mat.emissiveMap = tex; mat.emissive.set(tex ? patternColor ?? "#ffffff" : "#000000"); mat.emissiveIntensity = tex ? 0.55 : 0;
      mat.needsUpdate = true;
    });
  }, [model, suit, helmet, pattern, patternColor]);

  // Accessories follow their bones (position only) so they stay attached through every animation clip.
  const bones = useMemo(() => {
    const by: Record<string, Object3D | undefined> = {};
    const want: [string, RegExp][] = [["head", /^head\d/], ["lSh", /^L_Clevicle/], ["rSh", /^R_Clevicle/], ["lFoot", /^L_Ankle/], ["rFoot", /^R_Ankle/], ["pack", /^bagPack\.?\d/], ["chest", /^Spine_3/]];
    model.traverse((o) => { for (const [k, re] of want) if (re.test(o.name)) by[k] = o; });
    return by;
  }, [model]);
  const headG = useRef<Group>(null), lShG = useRef<Group>(null), rShG = useRef<Group>(null), lFootG = useRef<Group>(null), rFootG = useRef<Group>(null), packG = useRef<Group>(null), chestG = useRef<Group>(null);
  const tmp = useMemo(() => new Vector3(), []);
  useFrame(() => {
    const r = root.current; if (!r) return;
    const pairs: [string, Group | null][] = [["head", headG.current], ["lSh", lShG.current], ["rSh", rShG.current], ["lFoot", lFootG.current], ["rFoot", rFootG.current], ["pack", packG.current], ["chest", chestG.current]];
    for (const [key, g] of pairs) {
      const b = bones[key]; if (!b || !g) continue;
      b.getWorldPosition(tmp); r.worldToLocal(tmp); g.position.copy(tmp);
    }
  });

  useEffect(() => {
    const action = actions[POSE_CLIP[pose]] ?? actions.idle;
    if (!action) return;
    action.reset().fadeIn(0.25).play();
    if (reduced) action.setEffectiveTimeScale(0);
    return () => { action.fadeOut(0.2); };
  }, [actions, pose, reduced]);

  return (
    <group ref={root} position={position} scale={scale} rotation={[0, rotationY, 0]}>
      <primitive object={model} scale={k} position={offset} />
      {headgear && <group ref={headG}><Headgear kind={headgear} color={headgearColor ?? "#ffc857"} /></group>}
      {shoulder && <><group ref={lShG}><ShoulderGear kind={shoulder} color={shoulderColor ?? "#9fb3c8"} side={1} /></group><group ref={rShG}><ShoulderGear kind={shoulder} color={shoulderColor ?? "#9fb3c8"} side={-1} /></group></>}
      {packKind && packKind !== "pack-std" && <group ref={packG}><BackpackGear kind={packKind} color={pack ?? "#9fb3c8"} accent={packAccent ?? "#ffc857"} /></group>}
      {patchKind && <group ref={chestG}><group position={[0.13, 0.03, 0.19]}><PatchGear kind={patchKind} color={patchColor ?? "#0b3d91"} accent={patchAccent ?? "#ff8c42"} /></group></group>}
      {boots && <><group ref={lFootG}><BootGear kind={boots} color={bootsColor ?? "#4fc3f7"} /></group><group ref={rFootG}><BootGear kind={boots} color={bootsColor ?? "#4fc3f7"} /></group></>}
    </group>
  );
}
/** Only screens that actually show the astronaut ask for it; the Launch Control and Moon views never download the model. */
export const preloadAstronaut = () => useGLTF.preload(ASTRONAUT_URL);

export function CrewLineup({ crew, pose = "idle" }: { crew: (AstronautLook | null)[]; pose?: AstronautLook["pose"] }) {
  const n = crew.length;
  return (
    <>
      {crew.map((c, i) => c && (
        <Astronaut key={i} {...c} pose={c.pose ?? pose} position={[(i - (n - 1) / 2) * 1.5, -1, i % 2 ? -0.3 : 0]} scale={0.8} />
      ))}
    </>
  );
}

/* ---------- Bodies ---------- */
export type BodyKind = "earth" | "moon" | "mars" | "sun" | "deepspace" | "telescope";
const bodyStyle: Record<BodyKind, { color: string; emissive: string }> = {
  sun: { color: "#ffd27a", emissive: "#ff9b2e" },
  earth: { color: "#1f6fd1", emissive: "#0b3d91" },
  moon: { color: "#b7bcc6", emissive: "#2a2d33" },
  mars: { color: "#c2562e", emissive: "#4a1a0c" },
  deepspace: { color: "#6b7bd6", emissive: "#1a1f4a" },
  telescope: { color: "#c9d4e5", emissive: "#1a2438" },
};
type P3 = [number, number, number];
/** Real Earth: NASA Blue Marble map + drifting cloud layer + atmosphere rim. */
function TexturedEarth({ radius }: { radius: number }) {
  const [map, clouds] = useTexture([asset("/textures/earth.jpg"), asset("/textures/earth_clouds.png")], (t) => { (Array.isArray(t) ? t[0] : t).colorSpace = SRGBColorSpace; });
  const cl = useRef<Group>(null);
  const reduced = useUIStore((st) => st.reducedMotion);
  useFrame((_, d) => { if (cl.current && !reduced) cl.current.rotation.y += d * 0.02; });
  return (
    <>
      <mesh><sphereGeometry args={[radius, 64, 64]} /><meshStandardMaterial map={map} roughness={0.85} /></mesh>
      <group ref={cl}><mesh><sphereGeometry args={[radius * 1.012, 48, 48]} /><meshStandardMaterial map={clouds} alphaMap={clouds} transparent opacity={0.45} depthWrite={false} /></mesh></group>
      <mesh><sphereGeometry args={[radius * 1.06, 48, 48]} /><meshBasicMaterial color="#5fb4ff" transparent opacity={0.1} depthWrite={false} /></mesh>
    </>
  );
}
/** Procedural canvas texture: soft noise blotches between two colours (no image files). */
function blotchTexture(base: string, dark: string, light: string, seed: number, polar = false): CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas"); c.width = 512; c.height = 256; const g = c.getContext("2d"); if (!g) return null;
  g.fillStyle = base; g.fillRect(0, 0, 512, 256);
  let a = seed >>> 0; const rnd = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  for (let i = 0; i < 160; i++) { const x = rnd() * 512, y = rnd() * 256, r = 8 + rnd() * 46, gr = g.createRadialGradient(x, y, 0, x, y, r); const col = rnd() < 0.55 ? dark : light; gr.addColorStop(0, col + "99"); gr.addColorStop(1, col + "00"); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
  if (polar) for (const y of [0, 256]) { const gr = g.createLinearGradient(0, y, 0, y ? 226 : 30); gr.addColorStop(0, "rgba(255,255,255,.9)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, y ? 226 : 0, 512, 30); }
  const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; return t;
}
function TexturedMars({ radius }: { radius: number }) {
  const map = useMemo(() => blotchTexture("#b5532f", "#6e2f1c", "#e0955c", 11, true), []);
  return <mesh><sphereGeometry args={[radius, 48, 48]} /><meshStandardMaterial map={map} roughness={1} /></mesh>;
}
/** The Sun: bright granulated surface plus a soft glow (additive sprite) so it reads as a star, not a yellow dot. */
function SunBody({ radius }: { radius: number }) {
  const map = useMemo(() => blotchTexture("#ffb938", "#ff7a14", "#fff2b0", 5), []);
  const glow = useMemo(() => {
    if (typeof document === "undefined") return null;
    const c = document.createElement("canvas"); c.width = c.height = 256; const g = c.getContext("2d"); if (!g) return null;
    const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128); gr.addColorStop(0, "rgba(255,225,150,1)"); gr.addColorStop(0.25, "rgba(255,170,60,.55)"); gr.addColorStop(0.6, "rgba(255,120,20,.14)"); gr.addColorStop(1, "rgba(255,100,0,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256); const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; return t;
  }, []);
  return (
    <group>
      <mesh><sphereGeometry args={[radius, 48, 48]} /><meshBasicMaterial map={map} color="#ffffff" /></mesh>
      <sprite scale={[radius * 6, radius * 6, 1]}><spriteMaterial map={glow} transparent depthWrite={false} blending={AdditiveBlending} /></sprite>
    </group>
  );
}
function TexturedMoon({ radius }: { radius: number }) {
  const map = useTexture(asset("/textures/moon.jpg"), (t) => { (Array.isArray(t) ? t[0] : t).colorSpace = SRGBColorSpace; });
  return <mesh><sphereGeometry args={[radius, 48, 48]} /><meshStandardMaterial map={map} roughness={1} /></mesh>;
}
export function PlanetModel({ kind, radius = 1.5, position = [0, 0, 0] }: { kind: BodyKind; radius?: number; position?: P3 }) {
  const ref = useRef<Group>(null);
  const reduced = useUIStore((st) => st.reducedMotion);
  useFrame((_, d) => { if (ref.current && !reduced) ref.current.rotation.y += d * 0.1; });
  const st = bodyStyle[kind];
  return (
    <group ref={ref} position={position}>
      {kind === "earth" ? <TexturedEarth radius={radius} /> : kind === "moon" ? <TexturedMoon radius={radius} /> : kind === "mars" ? <TexturedMars radius={radius} /> : kind === "sun" ? <SunBody radius={radius} />
        : <mesh><sphereGeometry args={[radius, 48, 48]} /><meshStandardMaterial color={st.color} emissive={st.emissive} emissiveIntensity={0.5} roughness={0.9} /></mesh>}
    </group>
  );
}
export const EarthModel = (p: { radius?: number; position?: [number, number, number] }) => <PlanetModel kind="earth" {...p} />;
export const MoonModel = (p: { radius?: number; position?: [number, number, number] }) => <PlanetModel kind="moon" {...p} />;
export const MarsModel = (p: { radius?: number; position?: [number, number, number] }) => <PlanetModel kind="mars" {...p} />;

export function SpacecraftPreview({ position = [0, 0, 0], scale = 1 }: { position?: [number, number, number]; scale?: number }) {
  const ref = useRef<Group>(null);
  const reduced = useUIStore((s) => s.reducedMotion);
  useFrame(({ clock }) => {
    if (!ref.current || reduced) return;
    ref.current.rotation.y = clock.elapsedTime * 0.4;
    ref.current.position.y = position[1] + Math.sin(clock.elapsedTime) * 0.1;
  });
  return (
    <group ref={ref} position={position} scale={scale}>
      <mesh rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.25, 0.25, 1.2, 20]} /><meshStandardMaterial color="#e8eef7" metalness={0.4} roughness={0.4} /></mesh>
      <mesh position={[0.75, 0, 0]} rotation={[0, 0, -Math.PI / 2]}><coneGeometry args={[0.25, 0.4, 20]} /><meshStandardMaterial color="#ff8c42" /></mesh>
      <mesh position={[0, 0, 0.9]}><boxGeometry args={[0.6, 0.02, 0.9]} /><meshStandardMaterial color="#168bff" emissive="#0b3d91" /></mesh>
      <mesh position={[0, 0, -0.9]}><boxGeometry args={[0.6, 0.02, 0.9]} /><meshStandardMaterial color="#168bff" emissive="#0b3d91" /></mesh>
    </group>
  );
}

/** Hangar: floor + back window glow with Earth. */
export function MissionHangar() {
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.25, 0]}><circleGeometry args={[6, 48]} /><meshStandardMaterial color="#0b1730" metalness={0.6} roughness={0.4} /></mesh>
      <mesh position={[0, 1.2, -4]}><planeGeometry args={[9, 3.5]} /><meshBasicMaterial color="#071225" /></mesh>
      <EarthModel radius={1.6} position={[3.2, 1.6, -6]} />
      <pointLight position={[-3, 2, 2]} color="#ff8c42" intensity={8} />
      <pointLight position={[3, 2, 2]} color="#168bff" intensity={8} />
    </>
  );
}
export function OrbitalVisualization() {
  return (
    <>
      <EarthModel radius={1.6} />
      <mesh rotation={[Math.PI / 2.4, 0, 0]}><torusGeometry args={[2.6, 0.008, 8, 128]} /><meshBasicMaterial color="#4fc3f7" /></mesh>
      <SpacecraftPreview position={[2.6, 0, 0]} scale={0.3} />
    </>
  );
}
