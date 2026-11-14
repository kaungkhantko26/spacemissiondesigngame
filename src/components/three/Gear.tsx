"use client";
import { CanvasTexture, SRGBColorSpace } from "three";

/** Cosmetic gear: procedural accessories + suit-pattern textures (no extra model files). All positions are bone-relative. */

function rng(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

const cache = new Map<string, CanvasTexture>();
/** Greyscale emissive mask for a suit pattern (white = glowing decal). Returns null for unknown kinds / no DOM. */
export function patternTexture(kind: string): CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const hit = cache.get(kind); if (hit) return hit;
  const c = document.createElement("canvas"); c.width = c.height = 512;
  const g = c.getContext("2d"); if (!g) return null;
  g.fillStyle = "#000"; g.fillRect(0, 0, 512, 512);
  const r = rng(kind.length * 7919 + kind.charCodeAt(kind.length - 1));
  if (kind === "pattern-stripes") {
    g.fillStyle = "#fff";
    for (let x = 0; x < 512; x += 80) g.fillRect(x, 0, 22, 512);
    g.fillStyle = "#888"; for (let x = 36; x < 512; x += 80) g.fillRect(x, 0, 6, 512);
  } else if (kind === "pattern-stars") {
    g.fillStyle = "#fff";
    for (let i = 0; i < 160; i++) { const s = 1.5 + r() * 4; g.beginPath(); g.arc(r() * 512, r() * 512, s, 0, 7); g.fill(); }
  } else if (kind === "pattern-circuit") {
    g.strokeStyle = "#fff"; g.fillStyle = "#fff"; g.lineWidth = 4;
    for (let i = 0; i < 40; i++) {
      let x = r() * 512, y = r() * 512; g.beginPath(); g.moveTo(x, y);
      for (let s = 0; s < 4; s++) { if (r() < 0.5) x += (r() - 0.5) * 160; else y += (r() - 0.5) * 160; g.lineTo(x, y); }
      g.stroke(); g.beginPath(); g.arc(x, y, 7, 0, 7); g.fill();
    }
  } else if (kind === "pattern-camo") {
    for (let i = 0; i < 46; i++) { g.fillStyle = r() < 0.5 ? "#777" : "#bbb"; g.beginPath(); g.ellipse(r() * 512, r() * 512, 20 + r() * 50, 14 + r() * 36, r() * 3, 0, 7); g.fill(); }
  } else return null;
  const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; cache.set(kind, t); return t;
}

const Glow = ({ color, i = 1.2 }: { color: string; i?: number }) => <meshStandardMaterial color={color} emissive={color} emissiveIntensity={i} roughness={0.4} />;
const Metal = ({ color }: { color: string }) => <meshStandardMaterial color={color} metalness={0.7} roughness={0.3} />;

export function Headgear({ kind, color }: { kind: string; color: string }) {
  switch (kind) {
    case "head-antenna": return (
      <group position={[0.22, 0.28, -0.02]} rotation={[0, 0, -0.25]}>
        <mesh position={[0, 0.22, 0]}><cylinderGeometry args={[0.012, 0.018, 0.44, 8]} /><Metal color="#c9d4e5" /></mesh>
        <mesh position={[0, 0.46, 0]}><sphereGeometry args={[0.04, 12, 12]} /><Glow color={color} /></mesh>
      </group>);
    case "head-lamp": return (
      <group position={[0, 0.1, 0.3]}>
        <mesh><boxGeometry args={[0.2, 0.08, 0.08]} /><Metal color="#3a4252" /></mesh>
        <mesh position={[0, 0, 0.045]}><sphereGeometry args={[0.04, 12, 12]} /><Glow color={color} i={3} /></mesh>
      </group>);
    case "head-halo": return (
      <mesh position={[0, 0.44, 0]} rotation={[1.25, 0, 0]}><torusGeometry args={[0.3, 0.03, 12, 40]} /><Glow color={color} i={2} /></mesh>);
    case "head-crown": return (
      <group position={[0, 0.3, 0]}>
        {Array.from({ length: 7 }, (_, i) => { const a = (i / 7) * Math.PI * 2; return (
          <mesh key={i} position={[Math.cos(a) * 0.27, 0.04 * (i % 2), Math.sin(a) * 0.27]} rotation={[0, 0, 0]}><coneGeometry args={[0.045, 0.16, 6]} /><Glow color={color} i={0.8} /></mesh>); })}
        <mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.27, 0.02, 8, 36]} /><Glow color={color} i={0.8} /></mesh>
      </group>);
    default: return null;
  }
}

/** `side` is the sign of the bone's x offset: +1 = character's left shoulder, -1 = right. */
export function ShoulderGear({ kind, color, side }: { kind: string; color: string; side: -1 | 1 }) {
  switch (kind) {
    case "shoulder-flag": return side === -1 ? (
      <group position={[-0.3, 0.05, -0.05]}>
        <mesh position={[0, 0.25, 0]}><cylinderGeometry args={[0.01, 0.01, 0.5, 6]} /><Metal color="#e8eef7" /></mesh>
        <mesh position={[-0.13, 0.42, 0]}><boxGeometry args={[0.26, 0.17, 0.01]} /><meshStandardMaterial color={color} side={2} /></mesh>
        <mesh position={[-0.05, 0.42, 0.006]}><boxGeometry args={[0.1, 0.17, 0.005]} /><meshStandardMaterial color="#0b3d91" /></mesh>
      </group>) : null;
    case "shoulder-pads": return (
      <mesh position={[side * 0.3, 0.02, 0]} scale={[1.2, 0.7, 1.1]}><sphereGeometry args={[0.2, 16, 12]} /><meshStandardMaterial color={color} metalness={0.5} roughness={0.35} /></mesh>);
    case "shoulder-beacon": return side === 1 ? (
      <group position={[0.3, 0.17, 0]}>
        <mesh><cylinderGeometry args={[0.05, 0.06, 0.04, 12]} /><Metal color="#3a4252" /></mesh>
        <mesh position={[0, 0.045, 0]}><sphereGeometry args={[0.045, 12, 12]} /><Glow color={color} i={3} /></mesh>
        <pointLight color={color} intensity={0.6} distance={1.2} position={[0, 0.08, 0]} />
      </group>) : null;
    default: return null;
  }
}

export function BootGear({ kind, color }: { kind: string; color: string }) {
  switch (kind) {
    case "boots-moon": return (
      <group position={[0, -0.02, 0.06]}>
        <mesh scale={[1, 0.8, 1.5]}><sphereGeometry args={[0.2, 16, 12]} /><meshStandardMaterial color={color} roughness={0.8} /></mesh>
        <mesh position={[0, 0.1, -0.02]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.16, 0.03, 8, 20]} /><Glow color="#ffc857" i={0.6} /></mesh>
      </group>);
    case "boots-thruster": return (
      <group position={[0, 0.02, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.17, 0.03, 8, 24]} /><Glow color={color} i={2.2} /></mesh>
        <mesh position={[0, -0.14, 0]} rotation={[Math.PI, 0, 0]}><coneGeometry args={[0.09, 0.26, 10]} /><meshBasicMaterial color={color} transparent opacity={0.55} /></mesh>
      </group>);
    default: return null;
  }
}
