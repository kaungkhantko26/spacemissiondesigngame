"use client";
import { Component, Suspense, useRef, type ReactNode } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import type { Group } from "three";
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
export function Scene3D({ children, camera = [0, 1.2, 5], controls = false, light = "studio", stars = true, label = "3D scene", className = "h-full w-full" }: {
  children: ReactNode; camera?: [number, number, number]; controls?: boolean; light?: LightPreset; stars?: boolean; label?: string; className?: string;
}) {
  const quality = useUIStore((s) => s.quality);
  const dpr: [number, number] = quality === "low" ? [1, 1] : quality === "medium" ? [1, 1.5] : [1, 2];
  return (
    <div className={className} aria-label={label} role="img">
      <Boundary fallback={<Fallback label={label} />}>
        <Canvas dpr={dpr} camera={{ position: camera, fov: 40 }} gl={{ antialias: quality !== "low" }}>
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

/* ---------- Procedural astronaut (replaceable with GLB later) ---------- */
export interface AstronautLook {
  suit: string; skin?: string; helmet?: string; accent?: string; pack?: string;
  pose?: "idle" | "wave" | "ready" | "celebrate";
}
export function Astronaut({ suit, skin = "#f0c8a0", helmet = "#4fc3f7", accent = "#168bff", pack = "#9fb3c8", pose = "idle", position = [0, 0, 0], scale = 1 }:
  AstronautLook & { position?: [number, number, number]; scale?: number }) {
  const root = useRef<Group>(null);
  const arm = useRef<Group>(null);
  const reduced = useUIStore((s) => s.reducedMotion);
  useFrame(({ clock }) => {
    if (reduced || !root.current) return;
    const t = clock.elapsedTime;
    root.current.position.y = position[1] + Math.sin(t * 1.6) * 0.03; // breathing
    root.current.rotation.y = Math.sin(t * 0.6) * 0.12;                 // head/body sway
    if (arm.current) {
      arm.current.rotation.z = pose === "wave" ? -2.4 + Math.sin(t * 6) * 0.4 : pose === "celebrate" ? -2.7 + Math.sin(t * 8) * 0.2 : pose === "ready" ? -0.4 : -0.15;
    }
  });
  const body = <meshStandardMaterial color={suit} roughness={0.55} />;
  return (
    <group ref={root} position={position} scale={scale}>
      {/* torso */}
      <mesh position={[0, 0.9, 0]}><capsuleGeometry args={[0.42, 0.55, 8, 16]} />{body}</mesh>
      {/* chest panel */}
      <mesh position={[0, 1.0, 0.4]}><boxGeometry args={[0.35, 0.22, 0.05]} /><meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.4} /></mesh>
      {/* backpack */}
      <mesh position={[0, 0.95, -0.45]}><boxGeometry args={[0.6, 0.8, 0.28]} /><meshStandardMaterial color={pack} roughness={0.7} /></mesh>
      {/* head + visor */}
      <mesh position={[0, 1.85, 0]}><sphereGeometry args={[0.5, 24, 24]} /><meshStandardMaterial color="#eef3fa" roughness={0.3} /></mesh>
      <mesh position={[0, 1.85, 0.12]}><sphereGeometry args={[0.4, 24, 24]} /><meshStandardMaterial color="#12284d" metalness={0.5} roughness={0.25} /></mesh>
      <mesh position={[0, 1.82, 0.3]} scale={[1, 0.95, 0.75]}><sphereGeometry args={[0.3, 20, 20]} /><meshStandardMaterial color={skin} /></mesh><mesh position={[-0.1, 1.86, 0.55]}><sphereGeometry args={[0.035, 8, 8]} /><meshBasicMaterial color="#1a1a2e" /></mesh><mesh position={[0.1, 1.86, 0.55]}><sphereGeometry args={[0.035, 8, 8]} /><meshBasicMaterial color="#1a1a2e" /></mesh>
      <mesh position={[0, 1.85, 0.27]} scale={[1.05, 1.05, 0.5]}><sphereGeometry args={[0.38, 24, 24]} /><meshStandardMaterial color={helmet} transparent opacity={0.25} metalness={0.6} roughness={0.1} /></mesh>
      {/* arms */}
      <group ref={arm} position={[0.55, 1.35, 0]}><mesh position={[0.3, -0.05, 0]} rotation={[0, 0, Math.PI / 2]}><capsuleGeometry args={[0.13, 0.5, 6, 12]} />{body}</mesh></group>
      <mesh position={[-0.75, 1.05, 0]} rotation={[0, 0, 0.3]}><capsuleGeometry args={[0.13, 0.5, 6, 12]} />{body}</mesh>
      {/* legs */}
      <mesh position={[-0.2, 0.2, 0]}><capsuleGeometry args={[0.16, 0.5, 6, 12]} />{body}</mesh>
      <mesh position={[0.2, 0.2, 0]}><capsuleGeometry args={[0.16, 0.5, 6, 12]} />{body}</mesh>
      {/* boots */}
      <mesh position={[-0.2, -0.2, 0.06]}><boxGeometry args={[0.3, 0.16, 0.42]} /><meshStandardMaterial color={accent} /></mesh>
      <mesh position={[0.2, -0.2, 0.06]}><boxGeometry args={[0.3, 0.16, 0.42]} /><meshStandardMaterial color={accent} /></mesh>
    </group>
  );
}

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
export function PlanetModel({ kind, radius = 1.5, position = [0, 0, 0] }: { kind: BodyKind; radius?: number; position?: [number, number, number] }) {
  const ref = useRef<Group>(null);
  const reduced = useUIStore((s) => s.reducedMotion);
  useFrame((_, d) => { if (ref.current && !reduced) ref.current.rotation.y += d * 0.1; });
  const s = bodyStyle[kind];
  return (
    <group ref={ref} position={position}>
      <mesh><sphereGeometry args={[radius, 48, 48]} /><meshStandardMaterial color={s.color} emissive={s.emissive} emissiveIntensity={0.5} roughness={0.9} /></mesh>
      {kind === "earth" && (
        <>
          <mesh scale={1.0}><sphereGeometry args={[radius * 1.001, 24, 24]} /><meshStandardMaterial color="#2fa56a" transparent opacity={0.55} wireframe /></mesh>
          <mesh scale={1.06}><sphereGeometry args={[radius, 32, 32]} /><meshBasicMaterial color="#4fc3f7" transparent opacity={0.12} /></mesh>
        </>
      )}
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
