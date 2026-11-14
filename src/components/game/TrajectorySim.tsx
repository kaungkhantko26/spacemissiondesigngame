"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import { BufferAttribute, BufferGeometry, Line, LineBasicMaterial, LineDashedMaterial, Vector3, type Group, type Mesh, type MeshBasicMaterial } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { Pause, Play, RotateCcw, SkipForward, Crosshair, Globe2 } from "lucide-react";
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
  constructor(public u: number, public playing: boolean, public speed = 1, public follow = false, public autoOverview = false) {}
  advance(dt: number, durationS: number, uEnd: number) {
    if (!this.playing || this.u >= uEnd) return;
    this.u = Math.min(uEnd, this.u + (dt / durationS) * this.speed);
    if (this.u >= uEnd) this.playing = false;
  }
  patch(p: Partial<Pick<Playhead, "u" | "playing" | "speed" | "follow" | "autoOverview">>) { Object.assign(this, p); }
}
const fmt = (n: number, d = 0) => n.toLocaleString("en-US", { maximumFractionDigits: d });
const met = (s: number) => {
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return `T+ ${d}d ${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m`;
};

export const overviewPos = (traj: Trajectory): [number, number, number] => traj.mode === "moon"
  ? [traj.centre[0], traj.viewRadius * 1.05, traj.viewRadius * 0.95]
  : [0, traj.viewRadius * 2.5, traj.viewRadius * 1.1];
const nearStart = (traj: Trajectory): [number, number, number] => { const c = traj.sample(0).craft; return [c[0] + traj.earthR * 0.6, c[1] + traj.earthR * 0.5, c[2] + traj.earthR * 1.1]; };

/** Everything inside the single R3F canvas. State lives in `head` (mutated per frame, never React state). */
function World({ traj, head, labels }: { traj: Trajectory; head: Playhead; labels: LabelBus }) {
  const boom = useRef<{ t0: number } | null>(null), flash = useRef<Mesh>(null), fire = useRef<Mesh>(null), prevFollow = useRef(head.follow);
  const earth = useRef<Group>(null), target = useRef<Group>(null), craft = useRef<Mesh>(null), controls = useRef<OrbitControlsImpl>(null);
  const { camera, size } = useThree();
  const proj = useMemo(() => new Vector3(), []);
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
    const l = new Line(g, new LineDashedMaterial({ color: "#8fa3bd", dashSize: traj.viewRadius * 0.012, gapSize: traj.viewRadius * 0.012, transparent: true, opacity: 0.5 }));
    l.computeLineDistances();
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
    trail.geometry.setDrawRange(0, Math.max(0, Math.floor((h.u / traj.uEnd) * 720) + 1));
    // constant on-screen size for the craft marker
    const d = camera.position.distanceTo(craft.current!.position);
    craft.current?.scale.setScalar(Math.max(d * 0.011, moon ? 0.9 : 0.2));
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
    last.current.set(...s.craft);
    [s.earth, s.target].forEach((p, i) => {
      proj.set(p[0], p[1], p[2]).project(camera);
      labels.place(i, (proj.x * 0.5 + 0.5) * size.width, (-proj.y * 0.5 + 0.5) * size.height, proj.z < 1);
    });
  });

  return (
    <>
      <ambientLight intensity={0.9} />
      <pointLight position={[0, 0, 0]} intensity={moon ? 0 : 60000} decay={0} />
      <Stars radius={traj.viewRadius * 6} depth={traj.viewRadius * 2} count={1500} factor={6} fade />
      {rings.map((r, i) => <primitive key={i} object={r} />)}
      <primitive object={planned} />
      <primitive object={trail} />
      <group ref={earth}>
        {moon ? <PlanetModel kind="earth" radius={traj.earthR} /> : <mesh scale={traj.viewRadius * 0.022}><sphereGeometry args={[1, 16, 16]} /><meshBasicMaterial color="#4f9dff" /></mesh>}
      </group>
      <group ref={target}>
        {moon ? <PlanetModel kind="moon" radius={traj.targetR} /> : <mesh scale={traj.viewRadius * 0.026}><sphereGeometry args={[1, 16, 16]} /><meshBasicMaterial color="#e8a35a" /></mesh>}
      </group>
      {!moon && <mesh scale={traj.viewRadius * 0.035}><sphereGeometry args={[1, 16, 16]} /><meshBasicMaterial color="#ffd27a" /></mesh>}
      <mesh ref={flash} visible={false}><sphereGeometry args={[1, 16, 16]} /><meshBasicMaterial color="#fff4c2" transparent depthWrite={false} /></mesh>
      <mesh ref={fire} visible={false}><sphereGeometry args={[1, 16, 16]} /><meshBasicMaterial color="#ff6a1a" transparent depthWrite={false} /></mesh>
      <mesh ref={craft}><coneGeometry args={[0.55, 1.6, 8]} /><meshBasicMaterial color="#ffffff" /></mesh>
      <OrbitControls ref={controls} enablePan={false} target={head.follow ? traj.sample(0).craft : traj.centre} minDistance={moon ? 1 : 8} maxDistance={traj.viewRadius * 5} />
    </>
  );
}

const Btn = ({ label, onClick, on, children }: { label: string; onClick: () => void; on?: boolean; children: React.ReactNode }) => (
  <button type="button" aria-label={label} title={label} aria-pressed={on} onClick={onClick}
    className={cn("grid size-9 place-items-center rounded-md border bg-panel text-ink2 transition hover:text-ink", on ? "border-orange text-orange" : "border-[var(--border)]")}>{children}</button>
);

export function TrajectorySim({ traj, onUpdate, className, startAtEnd = false, awaitLaunch = false }: { traj: Trajectory; onUpdate: (u: number, done: boolean) => void; className?: string; startAtEnd?: boolean; awaitLaunch?: boolean }) {
  const reducedMotion = useUIStore((s) => s.reducedMotion);
  const reduced = reducedMotion || startAtEnd;
  const gated = awaitLaunch && !reduced; // wait on the pad until the player starts the countdown
  const closeUp = traj.mode === "moon" && gated;
  const [head] = useState(() => { const h = new Playhead(reduced ? traj.uEnd : 0, !reduced && !gated); if (closeUp) { h.follow = true; h.autoOverview = true; } return h; });
  const [count, setCount] = useState<number | null>(null);
  const [launched, setLaunched] = useState(!gated);
  const [ui, setUi] = useState({ u: reduced ? traj.uEnd : 0, playing: !reduced && !gated, follow: closeUp, speed: 1 });
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

  const set = (p: Partial<Pick<Playhead, "u" | "playing" | "speed" | "follow">>) => { head.patch(p); setUi((s) => ({ ...s, ...p })); };
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
        <Btn label={ui.follow ? "Overview camera" : "Follow spacecraft"} on={ui.follow} onClick={() => set({ follow: !ui.follow })}>{ui.follow ? <Crosshair className="size-4" /> : <Globe2 className="size-4" />}</Btn>
      </div>
      <p className="pointer-events-none absolute right-3 top-3 max-w-[11rem] text-right text-[10px] uppercase tracking-widest text-muted">
        {traj.mode === "moon" ? "True scale · 1 unit = 1,000 km" : "Orbits true scale · bodies enlarged"}
      </p>
    </div>
  );
}
