"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import { BufferAttribute, BufferGeometry, Line, LineBasicMaterial, LineDashedMaterial, Vector3, type Group, type Mesh, type MeshBasicMaterial } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { Pause, Play, RotateCcw, SkipForward, Crosshair, Globe2, Film } from "lucide-react";
import { Scene3D, PlanetModel } from "@/components/three/lazy";
import { useUIStore } from "@/stores";
import { cn } from "@/lib/mission";
import type { Telemetry, Trajectory } from "@/game/trajectory";

/** DOM labels pinned to 3D positions (updated from the render loop, so no <Html> portals). */
export class LabelBus {
  els: (HTMLElement | null)[] = [];
  bind(i: number, el: HTMLElement | null) { this.els[i] = el; }
  place(i: number, x: number, y: number, show: boolean) {
    const el = this.els[i]; if (!el) return;
    el.style.transform = `translate(${x}px, ${y}px) translate(-50%, 8px)`; el.style.opacity = show ? "1" : "0";
  }
}
/** Mutable playback state, advanced inside the render loop (never React state). */
export class Playhead {
  constructor(public u: number, public playing: boolean, public speed = 1, public follow = false, public autoOverview = false, public cine = false) {}
  advance(dt: number, durationS: number, uEnd: number) {
    if (!this.playing || this.u >= uEnd) return;
    this.u = Math.min(uEnd, this.u + (dt / durationS) * this.speed);
    if (this.u >= uEnd) this.playing = false;
  }
  patch(p: Partial<Pick<Playhead, "u" | "playing" | "speed" | "follow" | "autoOverview" | "cine">>) { Object.assign(this, p); }
}
const fmt = (n: number, d = 0) => n.toLocaleString("en-US", { maximumFractionDigits: d });
const met = (s: number) => {
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return `T+ ${d}d ${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m`;
};

export const overviewPos = (traj: Trajectory): [number, number, number] => traj.mode === "moon"
  ? [traj.centre[0], traj.viewRadius * 1.05, traj.viewRadius * 0.95]
  : [0, traj.viewRadius * 2.5, traj.viewRadius * 1.1];
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
const smoothstep = (x: number) => { const t = clamp(x, 0, 1); return t * t * (3 - 2 * t); };
const UP = new Vector3(0, 1, 0);
const nearStart = (traj: Trajectory): [number, number, number] => { const c = traj.sample(0).craft; return [c[0] + traj.earthR * 0.6, c[1] + traj.earthR * 0.5, c[2] + traj.earthR * 1.1]; };

/** Apollo-style spacecraft (command module, service module, engine bell, high-gain dish, RCS quads), nose along +Y, about 2 units long. */
function SpacecraftModel() {
  return (
    <group>
      <mesh position={[0, 0.78, 0]}><coneGeometry args={[0.3, 0.55, 20]} /><meshStandardMaterial color="#d9d6cf" metalness={0.5} roughness={0.35} emissive="#3a3935" /></mesh>
      <mesh position={[0, 0.44, 0]}><cylinderGeometry args={[0.3, 0.32, 0.12, 20]} /><meshStandardMaterial color="#8a8c92" metalness={0.6} roughness={0.4} emissive="#222" /></mesh>
      <mesh position={[0, -0.05, 0]}><cylinderGeometry args={[0.32, 0.32, 0.8, 20]} /><meshStandardMaterial color="#ecebe6" metalness={0.4} roughness={0.4} emissive="#3a3935" /></mesh>
      <mesh position={[0, -0.05, 0]}><cylinderGeometry args={[0.325, 0.325, 0.1, 20]} /><meshStandardMaterial color="#2b2d33" emissive="#111" /></mesh>
      <mesh position={[0, -0.62, 0]} rotation={[Math.PI, 0, 0]}><coneGeometry args={[0.2, 0.42, 16, 1, true]} /><meshStandardMaterial color="#6d6a63" metalness={0.8} roughness={0.35} side={2} emissive="#1c1b19" /></mesh>
      {[0, 1, 2, 3].map((i) => <mesh key={i} position={[Math.cos(i * Math.PI / 2) * 0.35, -0.2, Math.sin(i * Math.PI / 2) * 0.35]}><boxGeometry args={[0.1, 0.18, 0.1]} /><meshStandardMaterial color="#9a9ca2" emissive="#222" /></mesh>)}
      <group position={[0.4, -0.3, 0]} rotation={[0, 0, -0.5]}>
        <mesh position={[0.12, 0, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.02, 0.02, 0.35, 8]} /><meshStandardMaterial color="#aaa" /></mesh>
        <mesh position={[0.34, 0, 0]} rotation={[0, 0, -Math.PI / 2]}><coneGeometry args={[0.2, 0.08, 20, 1, true]} /><meshStandardMaterial color="#e8e6df" side={2} emissive="#333" /></mesh>
      </group>
    </group>
  );
}

/** Cinematic camera + craft orientation state (a class so per-frame mutation happens through methods, not on hook values). */
class CineRig {
  pos = new Vector3(); look = new Vector3(); init = false; prev = false;
  v1 = new Vector3(); v2 = new Vector3(); v3 = new Vector3(); vel = new Vector3(1, 0, 0); fwd = new Vector3(); side = new Vector3(); want = new Vector3(); wantLook = new Vector3();
  /** Leaving cinematic mode: forget the camera so it re-initialises next time. */
  reset() { this.prev = false; this.init = false; }
  /** Point the craft marker along its direction of travel (relative to the Moon while in lunar orbit). */
  orient(craft: Group | null, s: ReturnType<Trajectory["sample"]>, s2: ReturnType<Trajectory["sample"]>, capturing: boolean) {
    this.vel.set(s2.craft[0] - s.craft[0], s2.craft[1] - s.craft[1], s2.craft[2] - s.craft[2]);
    if (capturing) this.vel.sub(this.v1.set(s2.target[0] - s.target[0], s2.target[1] - s.target[1], s2.target[2] - s.target[2]));
    if (craft && this.vel.lengthSq() > 1e-12) craft.quaternion.setFromUnitVectors(UP, this.fwd.copy(this.vel).normalize());
  }
  /** Chase the craft out of Earth orbit (Earth falling away behind), then circle the Moon during capture. */
  step(camera: { position: Vector3; lookAt: (v: Vector3) => void }, traj: Trajectory, s: ReturnType<Trajectory["sample"]>, u: number, dt: number) {
    const craftV = this.v1.set(...s.craft), moonV = this.v2.set(...s.target), earthV = this.v3.set(...s.earth);
    if (u < traj.markers.seg2) {
      const dE = craftV.distanceTo(earthV), dM = craftV.distanceTo(moonV);
      const dist = clamp(Math.min(dM * 0.28, dE * 0.9 + 12), 14, 140);
      // camera on the Earth side of the craft looking toward the Moon: craft in the foreground, Moon growing ahead, Earth behind
      const toMoon = this.fwd.copy(moonV).sub(craftV); toMoon.y = 0; if (toMoon.lengthSq() < 1e-9) toMoon.set(1, 0, 0); toMoon.normalize();
      const side = this.side.crossVectors(toMoon, UP).normalize();
      this.want.copy(craftV).addScaledVector(toMoon, -dist * 0.9).addScaledVector(UP, dist * 0.4).addScaledVector(side, dist * 0.25);
      this.wantLook.copy(craftV).addScaledVector(toMoon, dist * 0.35);
    } else {
      const R = traj.targetR, a = (performance.now() / 1000) * 0.1;
      this.want.set(moonV.x + Math.cos(a) * R * 6.5, moonV.y + R * 2.6, moonV.z + Math.sin(a) * R * 6.5);
      this.wantLook.copy(moonV);
    }
    if (!this.init) { this.pos.copy(this.want); this.look.copy(this.wantLook); this.init = true; }
    else { const k = 1 - Math.exp(-dt * 2.4); this.pos.lerp(this.want, k); this.look.lerp(this.wantLook, k); }
    camera.position.copy(this.pos); camera.lookAt(this.look);
    this.prev = true;
  }
}

/** Everything inside the single R3F canvas. State lives in `head` (mutated per frame, never React state). */
function World({ traj, head, labels }: { traj: Trajectory; head: Playhead; labels: LabelBus }) {
  const boom = useRef<{ t0: number } | null>(null), flash = useRef<Mesh>(null), fire = useRef<Mesh>(null), prevFollow = useRef(head.follow);
  const earth = useRef<Group>(null), target = useRef<Group>(null), craft = useRef<Group>(null), controls = useRef<OrbitControlsImpl>(null);
  const { camera, size } = useThree();
  const proj = useMemo(() => new Vector3(), []);
  const [rig] = useState(() => new CineRig());
  const moonGroup = useRef<Group>(null);
  // capture orbit drawn relative to the Moon (a clean ring, not a spiral smeared by the Moon's own motion)
  const relTrail = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(traj.pathRel, 3)); g.setDrawRange(0, 0);
    return new Line(g, new LineBasicMaterial({ color: "#7fd1e8" }));
  }, [traj]);
  const captureRing = useMemo(() => {
    const pts = new Float32Array(129 * 3);
    for (let i = 0; i <= 128; i++) { const a = (i / 128) * Math.PI * 2; pts[i * 3] = traj.captureRadius * Math.cos(a); pts[i * 3 + 2] = traj.captureRadius * Math.sin(a); }
    const g = new BufferGeometry(); g.setAttribute("position", new BufferAttribute(pts, 3));
    return new Line(g, new LineBasicMaterial({ color: "#5fcf9a", transparent: true, opacity: 0.55 }));
  }, [traj]);
  const last = useRef(new Vector3(...traj.sample(0).craft));
  const moon = traj.mode === "moon";

  const trail = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(traj.path, 3));
    g.setDrawRange(0, 0);
    return new Line(g, new LineBasicMaterial({ color: "#ff7a33" }));
  }, [traj]);
  const planned = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(traj.path, 3));
    const l = new Line(g, new LineDashedMaterial({ color: "#8fa3bd", dashSize: traj.viewRadius * 0.012, gapSize: traj.viewRadius * 0.012, transparent: true, opacity: moon ? 0.28 : 0.5 }));
    l.computeLineDistances();
    if (moon) l.geometry.setDrawRange(0, traj.seg3Index + 1); // the Earth-frame path stops at arrival; the capture orbit is drawn Moon-relative
    return l;
  }, [traj]);
  const rings = useMemo(() => traj.orbitRadii.map((r) => {
    const pts = new Float32Array(193 * 3);
    for (let i = 0; i <= 192; i++) { const a = (i / 192) * Math.PI * 2; pts[i * 3] = r * Math.cos(a); pts[i * 3 + 2] = r * Math.sin(a); }
    const g = new BufferGeometry(); g.setAttribute("position", new BufferAttribute(pts, 3));
    return new Line(g, new LineBasicMaterial({ color: "#3a4c66", transparent: true, opacity: 0.6 }));
  }), [traj]);

  useFrame((_, dt) => {
    const h = head;
    h.advance(dt, traj.durationS, traj.uEnd);
    const s = traj.sample(h.u);
    craft.current?.position.set(...s.craft);
    earth.current?.position.set(...s.earth);
    target.current?.position.set(...s.target);
    const idx = Math.max(0, Math.floor((h.u / traj.uEnd) * 720) + 1);
    const capturing = moon && h.u >= traj.markers.seg2;
    trail.geometry.setDrawRange(0, moon ? Math.min(idx, traj.seg3Index + 1) : idx);
    relTrail.geometry.setDrawRange(capturing ? traj.seg3Index : 0, capturing ? Math.max(0, idx - traj.seg3Index) : 0);
    moonGroup.current?.position.set(...s.target); if (moonGroup.current) moonGroup.current.visible = moon && h.u >= traj.markers.seg2 - 0.01;
    // point the craft along its direction of travel (relative to the Moon while in lunar orbit)
    const s2 = traj.sample(Math.min(traj.uEnd, h.u + 0.0015));
    rig.orient(craft.current, s, s2, capturing);
    // constant on-screen size for the craft marker
    const d = camera.position.distanceTo(craft.current!.position);
    craft.current?.scale.setScalar(moon && h.cine ? Math.max(0.1, d * 0.02) : Math.max(d * 0.011, moon ? 0.9 : 0.2));
    if (craft.current) craft.current.visible = !s.lost;
    // explosion when the vehicle/spacecraft is lost: flash + fireball expanding then fading
    if (s.lost && !boom.current) boom.current = { t0: performance.now() };
    if (!s.lost) boom.current = null;
    const age = boom.current ? (performance.now() - boom.current.t0) / 1000 : -1;
    for (const [m, k, life] of [[flash.current, 0.05, 0.5], [fire.current, 0.09, 2.2]] as const) {
      if (!m) continue;
      const on = age >= 0 && age < life;
      m.visible = on;
      if (on) {
        m.position.set(...s.craft);
        m.scale.setScalar(Math.max(d * k * (0.4 + 3 * (age / life)), moon ? 0.5 : 0.1));
        (m.material as MeshBasicMaterial).opacity = 1 - age / life;
      }
    }
    if (moon && h.cine) {
      if (controls.current) controls.current.enabled = false;
      rig.step(camera, traj, s, h.u, dt);
    } else {
      if (controls.current) controls.current.enabled = true;
      if (rig.prev && controls.current) { rig.reset(); controls.current.target.set(...traj.centre); camera.position.set(...overviewPos(traj)); }
      // camera presets: close chase view on the pad/ascent, whole-system view afterwards
      if (h.autoOverview && h.u >= traj.markers.seg1) h.patch({ autoOverview: false, follow: false });
      if (prevFollow.current !== h.follow && controls.current) {
        prevFollow.current = h.follow;
        const c0 = controls.current;
        if (h.follow) { const cp = new Vector3(...s.craft); c0.target.copy(cp); camera.position.copy(cp).add(new Vector3(traj.earthR * 0.6, traj.earthR * 0.5, traj.earthR * 1.1)); }
        else { c0.target.set(...traj.centre); camera.position.set(...overviewPos(traj)); }
      }
      const c = controls.current;
      if (c) {
        const here = new Vector3(...s.craft);
        if (h.follow) { const delta = here.clone().sub(c.target); c.target.add(delta); camera.position.add(delta); }
        c.update();
      }
    }
    last.current.set(...s.craft);
    [s.earth, s.target].forEach((p, i) => {
      proj.set(p[0], p[1], p[2]).project(camera);
      labels.place(i, (proj.x * 0.5 + 0.5) * size.width, (-proj.y * 0.5 + 0.5) * size.height, proj.z < 1 && Math.abs(proj.x) < 1 && Math.abs(proj.y) < 0.95);
    });
  });

  return (
    <>
      <ambientLight intensity={moon ? 0.5 : 0.9} />
      {moon && <directionalLight position={[1, 0.55, 0.35]} intensity={2.6} />}
      <pointLight position={[0, 0, 0]} intensity={moon ? 0 : 60000} decay={0} />
      <Stars radius={traj.viewRadius * 6} depth={traj.viewRadius * 2} count={1500} factor={6} fade />
      {rings.map((r, i) => <primitive key={i} object={r} />)}
      <primitive object={planned} />
      <primitive object={trail} />
      {moon && <group ref={moonGroup} visible={false}><primitive object={captureRing} /><primitive object={relTrail} /></group>}
      <group ref={earth}>
        {moon ? <PlanetModel kind="earth" radius={traj.earthR} /> : <mesh scale={traj.viewRadius * 0.022}><sphereGeometry args={[1, 16, 16]} /><meshBasicMaterial color="#4f9dff" /></mesh>}
      </group>
      <group ref={target}>
        {moon ? <PlanetModel kind="moon" radius={traj.targetR} /> : <mesh scale={traj.viewRadius * 0.026}><sphereGeometry args={[1, 16, 16]} /><meshBasicMaterial color="#e8a35a" /></mesh>}
      </group>
      {!moon && <mesh scale={traj.viewRadius * 0.035}><sphereGeometry args={[1, 16, 16]} /><meshBasicMaterial color="#ffd27a" /></mesh>}
      <mesh ref={flash} visible={false}><sphereGeometry args={[1, 16, 16]} /><meshBasicMaterial color="#fff4c2" transparent depthWrite={false} /></mesh>
      <mesh ref={fire} visible={false}><sphereGeometry args={[1, 16, 16]} /><meshBasicMaterial color="#ff6a1a" transparent depthWrite={false} /></mesh>
      <group ref={craft}><SpacecraftModel /></group>
      <OrbitControls ref={controls} enablePan={false} target={head.follow ? traj.sample(0).craft : traj.centre} minDistance={moon ? 1 : 8} maxDistance={traj.viewRadius * 5} />
    </>
  );
}

const Btn = ({ label, onClick, on, children }: { label: string; onClick: () => void; on?: boolean; children: React.ReactNode }) => (
  <button type="button" aria-label={label} title={label} aria-pressed={on} onClick={onClick}
    className={cn("grid size-9 place-items-center rounded-md border bg-panel text-ink2 transition hover:text-ink", on ? "border-orange text-orange" : "border-[var(--border)]")}>{children}</button>
);

export function TrajectorySim({ traj, onUpdate, className, startAtEnd = false, awaitLaunch = false, startU = 0 }: { traj: Trajectory; onUpdate: (u: number, done: boolean) => void; className?: string; startAtEnd?: boolean; awaitLaunch?: boolean; startU?: number }) {
  const reducedMotion = useUIStore((s) => s.reducedMotion);
  const reduced = reducedMotion || startAtEnd;
  const gated = awaitLaunch && !reduced; // wait on the pad until the player starts the countdown
  const closeUp = traj.mode === "moon" && gated;
  const [head] = useState(() => { const h = new Playhead(reduced ? traj.uEnd : startU, !reduced && !gated); if (closeUp) { h.follow = true; h.autoOverview = true; } else if (traj.mode === "moon") h.cine = true; return h; });
  const [count, setCount] = useState<number | null>(null);
  const [launched, setLaunched] = useState(!gated);
  const [ui, setUi] = useState({ u: reduced ? traj.uEnd : startU, playing: !reduced && !gated, follow: closeUp, cine: traj.mode === "moon" && !closeUp, speed: 1 });
  const [tel, setTel] = useState<Telemetry>(() => traj.sample(reduced ? traj.uEnd : 0).telemetry);
  const [lost, setLost] = useState(false);
  const [labels] = useState(() => new LabelBus());
  const cb = useRef(onUpdate);
  useEffect(() => { cb.current = onUpdate; }, [onUpdate]);

  useEffect(() => { // 10 Hz bridge from the render loop to React (HUD + phase log)
    const id = setInterval(() => {
      const h = head, s = traj.sample(h.u);
      setUi((p) => (p.u === h.u && p.playing === h.playing && p.follow === h.follow ? p : { ...p, u: h.u, playing: h.playing, follow: h.follow }));
      setTel(s.telemetry); setLost(s.lost);
      cb.current(h.u, h.u >= traj.uEnd - 1e-6);
    }, 100);
    return () => clearInterval(id);
  }, [traj, head]);

  const set = (p: Partial<Pick<Playhead, "u" | "playing" | "speed" | "follow" | "cine">>) => { head.patch(p); setUi((s) => ({ ...s, ...p })); };
  const camera = closeUp ? nearStart(traj) : overviewPos(traj);
  useEffect(() => { // T-minus countdown, then ignition
    if (count === null) return;
    const id = setTimeout(() => {
      if (count <= 1) { head.patch({ playing: true }); setLaunched(true); setCount(null); } else setCount(count - 1);
    }, 900);
    return () => clearTimeout(id);
  }, [count, head]);
  const done = ui.u >= traj.uEnd;
  return (
    <div className={cn("relative overflow-hidden", className)}>
      <Scene3D camera={camera} stars={false} far={traj.viewRadius * 40} label={`Trajectory from Earth to ${traj.targetName}`} light="studio">
        <World traj={traj} head={head} labels={labels} />
      </Scene3D>
      {["Earth", traj.targetName].map((t, i) => (
        <span key={t} ref={(el) => labels.bind(i, el)} aria-hidden className="pointer-events-none absolute left-0 top-0 whitespace-nowrap rounded-sm bg-black/60 px-1.5 py-0.5 font-display text-[11px] uppercase tracking-widest text-ink2 opacity-0">{t}</span>
      ))}
      {!launched && (
        <div className="absolute inset-0 z-10 grid place-items-center bg-black/30">
          {count === null ? (
            <div className="text-center">
              <p className="hud-label !text-orange">Pad 39 · All systems go</p>
              <button type="button" onClick={() => setCount(3)} className="mt-3 rounded-lg border border-orange bg-orange px-8 py-4 font-display text-xl font-bold uppercase tracking-widest text-[#1a0b00] shadow-[0_4px_0_#b4501a] transition active:translate-y-0.5">Launch from Earth</button>
            </div>
          ) : <p role="status" aria-live="assertive" className="font-display text-8xl font-bold text-orange tabular-nums">{count}</p>}
        </div>
      )}
      <dl className="pointer-events-none absolute left-3 top-3 space-y-1 rounded-md border border-[var(--border)] bg-bg/75 p-3 font-display text-sm tracking-wider" aria-label="Flight telemetry">
        <div><dt className="hud-label">Phase</dt><dd className={cn("text-base uppercase", lost ? "text-bad" : "text-orange")}>{tel.phase}</dd></div>
        <div><dt className="hud-label">Mission time</dt><dd className="tabular-nums">{met(tel.metS)}</dd></div>
        {tel.altKm !== null && <div><dt className="hud-label">Altitude</dt><dd className="tabular-nums">{fmt(tel.altKm)} km</dd></div>}
        <div><dt className="hud-label">Speed</dt><dd className="tabular-nums">{fmt(tel.speedKmS, 2)} km/s</dd></div>
        <div><dt className="hud-label">{tel.rangeLabel}</dt><dd className="tabular-nums">{fmt(tel.rangeKm)} km</dd></div>
        {tel.sunKm !== undefined && <div><dt className="hud-label">From Sun</dt><dd className="tabular-nums">{fmt(tel.sunKm / 1.495978707e8, 3)} AU</dd></div>}
      </dl>
      <div className="absolute inset-x-3 bottom-3 flex flex-wrap items-center gap-2 rounded-md border border-[var(--border)] bg-bg/80 p-2">
        <Btn label={ui.playing ? "Pause" : "Play"} onClick={() => set({ playing: !ui.playing && !done })}>{ui.playing ? <Pause className="size-4" /> : <Play className="size-4" />}</Btn>
        <Btn label="Restart" onClick={() => set({ u: 0, playing: true })}><RotateCcw className="size-4" /></Btn>
        <Btn label="Skip to end" onClick={() => set({ u: traj.uEnd, playing: false })}><SkipForward className="size-4" /></Btn>
        <input type="range" aria-label="Timeline" className="min-w-24 flex-1" min={0} max={1000} value={Math.round((ui.u / traj.uEnd) * 1000)}
          onChange={(e) => set({ u: (Number(e.target.value) / 1000) * traj.uEnd, playing: false })} />
        <label className="flex items-center gap-1 text-xs text-ink2">Speed
          <select aria-label="Playback speed" value={ui.speed} onChange={(e) => set({ speed: Number(e.target.value) })} className="px-1 py-0.5 text-xs">
            {[0.5, 1, 2, 4].map((v) => <option key={v} value={v}>{v}×</option>)}
          </select>
        </label>
        {traj.mode === "moon" && <Btn label={ui.cine ? "Switch to map view" : "Switch to cinematic camera"} on={ui.cine} onClick={() => set({ cine: !ui.cine })}><Film className="size-4" /></Btn>}
        <Btn label={ui.follow ? "Overview camera" : "Follow spacecraft"} on={ui.follow} onClick={() => set({ follow: !ui.follow })}>{ui.follow ? <Crosshair className="size-4" /> : <Globe2 className="size-4" />}</Btn>
      </div>
      <p className="pointer-events-none absolute right-3 top-3 max-w-[11rem] text-right text-[10px] uppercase tracking-widest text-muted">
        {traj.mode === "moon" ? "True scale · 1 unit = 1,000 km" : "Orbits true scale · bodies enlarged"}
      </p>
    </div>
  );
}
