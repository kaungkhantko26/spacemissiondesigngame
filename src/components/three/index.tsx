"use client";
import { Component, Suspense, useEffect, useMemo, useRef, type ReactNode } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Stars, useAnimations, useGLTF, useTexture } from "@react-three/drei";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import { SRGBColorSpace, Vector3, type Group, type Mesh, type MeshStandardMaterial, type Object3D } from "three";
import { BootGear, Headgear, ShoulderGear, patternTexture } from "./Gear";
import { useUIStore } from "@/stores";

/** Error boundary: 3D must never block navigation. */
class Boundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
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
  suit: string; skin?: string; helmet?: string; accent?: string; pack?: string;
  /** Cosmetic ids + colours (see data/mock cosmetics): pattern decal, headgear, shoulder gear, boots. */
  pattern?: string; patternColor?: string; headgear?: string; headgearColor?: string;
  shoulder?: string; shoulderColor?: string; boots?: string; bootsColor?: string;
  pose?: "idle" | "wave" | "ready" | "celebrate";
}
export const ASTRONAUT_URL = "/models/astronaut.glb";
const POSE_CLIP = { idle: "idle", wave: "wave", ready: "floating", celebrate: "moon_walk" } as const;
const MODEL_HEIGHT = 3.1165; // native height of the GLB in its own units
const TARGET_HEIGHT = 2.4; // world units, feet resting on y=-0.25

export function Astronaut({ suit, helmet = "#4fc3f7", pose = "idle", position = [0, 0, 0], scale = 1, rotationY = 0, pattern, patternColor, headgear, headgearColor, shoulder, shoulderColor, boots, bootsColor }:
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
    const want: [string, RegExp][] = [["head", /^head\d/], ["lSh", /^L_Clevicle/], ["rSh", /^R_Clevicle/], ["lFoot", /^L_Ankle/], ["rFoot", /^R_Ankle/]];
    model.traverse((o) => { for (const [k, re] of want) if (re.test(o.name)) by[k] = o; });
    return by;
  }, [model]);
  const headG = useRef<Group>(null), lShG = useRef<Group>(null), rShG = useRef<Group>(null), lFootG = useRef<Group>(null), rFootG = useRef<Group>(null);
  const tmp = useMemo(() => new Vector3(), []);
  useFrame(() => {
    const r = root.current; if (!r) return;
    const pairs: [string, Group | null][] = [["head", headG.current], ["lSh", lShG.current], ["rSh", rShG.current], ["lFoot", lFootG.current], ["rFoot", rFootG.current]];
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
      {boots && <><group ref={lFootG}><BootGear kind={boots} color={bootsColor ?? "#4fc3f7"} /></group><group ref={rFootG}><BootGear kind={boots} color={bootsColor ?? "#4fc3f7"} /></group></>}
    </group>
  );
}
useGLTF.preload(ASTRONAUT_URL);

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
export type BodyKind = "earth" | "moon" | "mars" | "deepspace" | "telescope";
const bodyStyle: Record<BodyKind, { color: string; emissive: string }> = {
  earth: { color: "#1f6fd1", emissive: "#0b3d91" },
  moon: { color: "#b7bcc6", emissive: "#2a2d33" },
  mars: { color: "#c2562e", emissive: "#4a1a0c" },
  deepspace: { color: "#6b7bd6", emissive: "#1a1f4a" },
  telescope: { color: "#c9d4e5", emissive: "#1a2438" },
};
type P3 = [number, number, number];
/** Real Earth: NASA Blue Marble map + drifting cloud layer + atmosphere rim. */
function TexturedEarth({ radius }: { radius: number }) {
  const [map, clouds] = useTexture(["/textures/earth.jpg", "/textures/earth_clouds.png"], (t) => { (Array.isArray(t) ? t[0] : t).colorSpace = SRGBColorSpace; });
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
function TexturedMoon({ radius }: { radius: number }) {
  const map = useTexture("/textures/moon.jpg", (t) => { (Array.isArray(t) ? t[0] : t).colorSpace = SRGBColorSpace; });
  return <mesh><sphereGeometry args={[radius, 48, 48]} /><meshStandardMaterial map={map} roughness={1} /></mesh>;
}
export function PlanetModel({ kind, radius = 1.5, position = [0, 0, 0] }: { kind: BodyKind; radius?: number; position?: P3 }) {
  const ref = useRef<Group>(null);
  const reduced = useUIStore((st) => st.reducedMotion);
  useFrame((_, d) => { if (ref.current && !reduced) ref.current.rotation.y += d * 0.1; });
  const st = bodyStyle[kind];
  return (
    <group ref={ref} position={position}>
      {kind === "earth" ? <TexturedEarth radius={radius} /> : kind === "moon" ? <TexturedMoon radius={radius} />
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
