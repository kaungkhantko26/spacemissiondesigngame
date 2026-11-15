"use client";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, Pause, Play, Rocket, RotateCcw, Power, Layers, Bot, Octagon, Volume2, VolumeX, Keyboard } from "lucide-react";
import { ControlsHelp, MANUAL_TOUR } from "./FlightHelp";
import { explainFailure } from "@/game/launch/coach";
import { BackButton, GameButton, GlassPanel, ScreenContainer } from "@/components/ui";
import { useUIStore } from "@/stores";
import { cn } from "@/lib/mission";
import { DATASET, vehicleById } from "@/game/data";
import { LAUNCH, RULES, autopilotReaches, buildRocket, configureRocket, guidancePitch, scoreFlight, type Difficulty, type Flight } from "@/game/launch/core";
import { MoonLeg } from "./MoonLeg";
import { playVoice, primeVoice, stopVoice, audioContext, type VoiceId } from "@/lib/voice";
import { RocketSound, playSfx } from "@/lib/sfx";
import { useProgress } from "@/game/progress";
import { usePlayerStore } from "@/stores";
import { BRIEFING_TOUR, FLIGHT_TOUR, Tour, pendingTour, setPendingTour } from "./Tour";
import { LaunchSession, payloadFor } from "@/game/launch/session";
import { useLaunchSetup } from "@/game/launch/store";
import { drawFlight, newView, updateView } from "./launchDraw";
import { buildEarthDisc } from "./earthDisc";
import { loadRocketSprite } from "./partThumbs";

const fmt = (n: number, d = 0) => n.toLocaleString("en-US", { maximumFractionDigits: d });
const usd = (n: number) => (n >= 1e9 ? `$${fmt(n / 1e9, 2)}B` : `$${fmt(n / 1e6)}M`);
const clock = (t: number) => { const s = Math.abs(Math.round(t)); return `T${t < 0 ? "−" : "+"}${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`; };
const DIFF_ORDER: Difficulty[] = ["easy", "medium", "hard"];
const PIPS = { easy: 1, medium: 3, hard: 5 } as const;

/* ============================== briefing ============================== */
function Panel({ n, title, hint, children }: { n: number; title: string; hint?: string; children: ReactNode }) {
  return (
    <GlassPanel as="section" className="p-4" aria-label={title} data-tour={`panel-${n}`}>
      <h2 className="mb-1 flex items-baseline gap-3 text-xl font-bold"><span className="hud-label !text-orange">0{n}</span>{title}</h2>
      {hint && <p className="mb-3 text-xs text-muted">{hint}</p>}
      {children}
    </GlassPanel>
  );
}
const Pick = ({ on, onClick, children, className }: { on: boolean; onClick: () => void; children: ReactNode; className?: string }) => (
  <button type="button" aria-pressed={on} onClick={onClick} className={cn("lift w-full rounded-lg border p-3 text-left transition", on ? "border-orange bg-orange/10" : "border-[var(--border)] bg-panel hover:border-[var(--border-strong)]", className)}>{children}</button>
);

function Briefing({ onStart }: { onStart: () => void }) {
  const { difficulty, siteId, vehicleId, mission, payloadPct, fuelPct, throttleCap, set } = useLaunchSetup();
  const rules = RULES[difficulty];
  const v = vehicleById(vehicleId) ?? DATASET.vehicles[0];
  const site = DATASET.launch_sites.find((s) => s.id === siteId) ?? DATASET.launch_sites[0];
  const basePayload = payloadFor(v, rules.payloadFrac, mission);
  const standard = buildRocket(v, basePayload);
  // the configured stack, plus a quick autopilot test flight (orbit missions) so the verdict reflects what really happens, not a fixed delta-v number
  const sim = useMemo(() => {
    const r = configureRocket(buildRocket(v, Math.round(basePayload * payloadPct)), { fuelPct, throttleCap });
    return { rocket: r, reach: mission === "orbit" && r.twr0 >= 1.05 ? autopilotReaches(r, site) : null };
  }, [v, basePayload, payloadPct, fuelPct, throttleCap, mission, site]);
  const rocket = sim.rocket;
  const dvVerdict = mission === "moon"
    ? (rocket.dvIdeal >= standard.dvIdeal * 0.97 ? "ok" : rocket.dvIdeal >= standard.dvIdeal * 0.92 ? "tight" : "bad")
    : sim.reach ? (sim.reach.ok ? "ok" : "bad") : "bad";
  const canMoon = (x: { leo_capacity_kg: number; tli_payload_kg?: number }) => !!x.tli_payload_kg || x.leo_capacity_kg >= 20000;
  const [tour, setTour] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- sessionStorage is only readable after mount
  useEffect(() => { if (pendingTour() === "launch") setTour(true); }, []);
  return (
    <>
    {tour && <Tour steps={BRIEFING_TOUR} doneLabel="Got it" onDone={() => { setTour(false); setPendingTour("flight"); }} onSkip={() => { setTour(false); setPendingTour(null); }} />}
    <ScreenContainer title="Launch Control" subtitle="Roll out from a real spaceport and fly the ascent from the launch pad into orbit." actions={<BackButton href="/menu" label="Main menu" />}>
      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <Panel n={1} title="Mission" hint="Fly to orbit, or the full Apollo-style trip: parking orbit → wait for the TLI window → re-light the upper stage → coast to the Moon → lunar orbit.">
            <ul className="grid gap-3 md:grid-cols-2">
              <li><Pick on={mission === "orbit"} onClick={() => set({ mission: "orbit" })} className="h-full">
                <p className="font-display text-xl font-bold">Reach orbit</p><p className="text-sm text-ink2">Climb through max-Q and staging into a stable low Earth orbit. Any rocket.</p></Pick></li>
              <li><Pick on={mission === "moon"} onClick={() => set({ mission: "moon", vehicleId: "ll2_cfg_93" })} className="h-full">
                <p className="font-display text-xl font-bold">Mission to the Moon <span className="ml-1 rounded-sm border border-orange px-1 text-[10px] uppercase tracking-wider text-orange">Saturn V</span></p>
                <p className="text-sm text-ink2">Parking orbit, then translunar injection (~3.1 km/s), the 3-day coast and lunar orbit insertion. Needs a heavy rocket with propellant left in the upper stage — the <b>Saturn V</b> is built for it.</p></Pick></li>
            </ul>
          </Panel>
          <Panel n={2} title="Difficulty" hint="Each level changes who flies, how heavy the payload is, the weather, failures and how strict the limits are.">
            <ul className="grid gap-3 md:grid-cols-3">
              {DIFF_ORDER.map((d) => { const r = RULES[d]; return (
                <li key={d}><Pick on={difficulty === d} onClick={() => set({ difficulty: d })} className="h-full">
                  <div className="flex items-baseline justify-between"><span className="font-display text-xl font-bold">{r.name}</span><span className="text-xs text-muted">×{r.scoreMult} score</span></div>
                  <p className="text-xs" aria-label={`Difficulty ${PIPS[d]} of 5`}>{"●".repeat(PIPS[d])}<span className="text-white/20">{"●".repeat(5 - PIPS[d])}</span> <span className="capitalize text-muted">{d}</span></p>
                  <p className="mt-1 text-sm text-ink2">{r.tagline}</p>
                  <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-ink2">{r.bullets.map((b) => <li key={b}>{b}</li>)}</ul>
                </Pick></li>
              ); })}
            </ul>
          </Panel>
          <Panel n={3} title="Spaceport" hint="Real launch pads from the dataset. The closer to the equator, the more free eastward speed you get from Earth's spin.">
            <ul className="grid gap-2 sm:grid-cols-2">
              {DATASET.launch_sites.map((s) => (
                <li key={s.id}><Pick on={siteId === s.id} onClick={() => set({ siteId: s.id })}>
                  <p className="font-display font-bold">{s.name.length > 28 ? s.location.split(",")[0] : s.name}</p>
                  <p className="text-xs text-ink2">{s.location}</p>
                  <p className="text-xs text-muted">{Math.abs(s.lat).toFixed(1)}°{s.lat >= 0 ? "N" : "S"} · {s.launches} launches · <b className="text-ok">+{fmt(s.rotation_boost_m_s)} m/s</b> free</p>
                </Pick></li>
              ))}
            </ul>
          </Panel>
          <Panel n={4} title="Launch vehicle" hint="Liftoff mass, thrust, size and capacity are Launch Library 2 data. Stages, Isp and structure are modelled (game values).">
            <ul className="grid gap-2 sm:grid-cols-2">
              {DATASET.vehicles.slice().sort((a, b) => a.leo_capacity_kg - b.leo_capacity_kg).map((x) => (
                <li key={x.id}><Pick on={vehicleId === x.id} onClick={() => set({ vehicleId: x.id })}>
                  <div className="flex justify-between"><span className="font-display font-bold">{x.name}</span><span className="text-xs text-muted">{x.manufacturer_country}</span></div>
                  <p className="text-xs text-ink2">{fmt(x.leo_capacity_kg)} kg to LEO · {x.launch_mass_t ? `${fmt(x.launch_mass_t)} t at liftoff` : ""} · {usd(x.launch_cost_usd)}{x.launch_cost_is_game ? " (game)" : ""}</p>
                  {x.stages && <p className="text-xs text-ok">3 real stages: {x.stages.map((st) => st.stage).join(" · ")}</p>}
                  {mission === "moon" && !canMoon(x) && <p className="text-xs text-warn">⚠ upper stage too small to reach the Moon</p>}
                </Pick></li>
              ))}
            </ul>
          </Panel>
          <Panel n={5} title="Configure spacecraft" hint="Tune the stack before rollout. Less payload or fuel makes the rocket lighter; a throttle limit makes the engines gentler. Too little fuel cannot reach orbit.">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm"><span className="flex justify-between"><span>Payload mass</span><span className="font-display tabular-nums text-ink">{fmt(Math.round(basePayload * payloadPct))} kg · {Math.round(payloadPct * 100)} %</span></span>
                <input type="range" min={20} max={100} step={5} value={Math.round(payloadPct * 100)} onChange={(e) => set({ payloadPct: Number(e.target.value) / 100 })} className="mt-1 w-full" aria-label="Payload mass" /></label>
              <label className="block text-sm"><span className="flex justify-between"><span>Fuel loaded</span><span className="font-display tabular-nums text-ink">{Math.round(fuelPct * 100)} %</span></span>
                <input type="range" min={60} max={100} step={1} value={Math.round(fuelPct * 100)} onChange={(e) => set({ fuelPct: Number(e.target.value) / 100 })} className="mt-1 w-full" aria-label="Fuel loaded" /></label>
              <label className="block text-sm"><span className="flex justify-between"><span>Throttle limit</span><span className="font-display tabular-nums text-ink">{Math.round(throttleCap * 100)} %</span></span>
                <input type="range" min={50} max={100} step={1} value={Math.round(throttleCap * 100)} onChange={(e) => set({ throttleCap: Number(e.target.value) / 100 })} className="mt-1 w-full" aria-label="Throttle limit" /></label>
              <div className="flex items-end"><GameButton variant="outline" onClick={() => set({ payloadPct: 1, fuelPct: 1, throttleCap: 1 })} disabled={payloadPct === 1 && fuelPct === 1 && throttleCap === 1}>Reset to standard</GameButton></div>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
              {[["Liftoff mass", `${fmt(rocket.m0 / 1000)} t`], ["Thrust / weight", rocket.twr0.toFixed(2)], ["Ideal Δv", `${fmt(rocket.dvIdeal)} m/s`], ["Fuel on board", `${fmt((rocket.s1.propKg + rocket.s2.propKg + (rocket.s3?.propKg ?? 0)) / 1000)} t`]].map(([k, val]) => (
                <div key={k} className="rounded-md bg-white/5 p-2"><dt className="text-muted">{k}</dt><dd className="font-display text-base tabular-nums">{val}</dd></div>))}
            </dl>
            <p role="status" className={cn("mt-3 rounded-md border px-3 py-2 text-xs", rocket.twr0 < 1.05 ? "border-bad text-bad" : dvVerdict === "ok" ? "border-ok/60 text-ok" : dvVerdict === "tight" ? "border-warn text-warn" : "border-bad text-bad")}>
              {rocket.twr0 < 1.05 ? "Thrust-to-weight is too low: with this throttle limit and load the rocket cannot lift off. Raise the throttle limit or reduce payload or fuel."
                : dvVerdict === "ok" ? (mission === "moon" ? "Enough delta-v for the lunar mission." : "Autopilot test flight: this setup reaches orbit. Flying it yourself may be easier or harder.")
                  : dvVerdict === "tight" ? "Tight: very little margin. Fly cleanly or add fuel." : mission === "moon" ? "Not enough delta-v for the lunar mission. Add fuel or reduce payload." : `Autopilot test flight: this setup does not reach orbit${sim.reach?.reason ? `: ${sim.reach.reason.replace(/\s*Cut the engine sooner\.|\s*Throttle the upper stage down as it gets lighter\./, "").replace(/\.$/, "")}` : ""}. Add fuel or reduce payload.`}
            </p>
          </Panel>
        </div>
        <aside className="lg:sticky lg:top-4 lg:self-start">
          <GlassPanel active className="p-4" data-tour="briefing">
            <p className="hud-label">Mission briefing</p>
            <h2 className="mt-1 text-2xl font-bold">{rocket.name} · {rules.name}</h2>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
              {[["Payload", `${fmt(rocket.payloadKg)} kg`], ["Liftoff mass", `${fmt(rocket.m0 / 1000)} t`], ["Thrust / weight", rocket.twr0.toFixed(2)], ["Ideal Δv", `${fmt(rocket.dvIdeal)} m/s`], ["Earth-spin boost", `+${fmt(site.rotation_boost_m_s)} m/s`], ["Upper winds", rules.windMs ? `up to ${rules.windMs} m/s` : "calm"]].map(([k, val]) => (
                <div key={k} className="rounded-md bg-white/5 p-2"><dt className="text-muted">{k}</dt><dd className="font-display text-base tabular-nums">{val}</dd></div>
              ))}
            </dl>
            {mission === "moon" ? <p className="mt-3 text-sm text-ink2"><b className="text-ink">Goal:</b> reach a <b>{rules.minPerigeeKm}+ km</b> parking orbit, wait for the TLI window (~30 min, auto-warped), re-ignite the upper stage and burn prograde until apogee reaches the Moon (≈384,400 km), then coast to the Moon and enter lunar orbit.</p> : <p className="mt-3 text-sm text-ink2"><b className="text-ink">Goal:</b> reach a stable orbit — lowest point above <b>{rules.minPerigeeKm} km</b>, highest below <b>{rules.maxApogeeKm} km</b>. Cross the Kármán line (100 km) on the way.</p>}
            <ol className="mt-2 list-decimal space-y-0.5 pl-5 text-xs text-ink2"><li>Countdown &amp; liftoff</li><li>Clear the tower, pitch over</li><li>Max-Q (peak air pressure)</li><li>Stage separation</li><li>Upper stage burn to orbital speed</li><li>Engine cutoff in orbit</li></ol>
            <div className="mt-3 rounded-md border border-[var(--border)] p-2 text-xs text-ink2">
              <p className="hud-label mb-1">Controls</p>
              <p><kbd>↑</kbd>/<kbd>↓</kbd> pitch · <kbd>W</kbd>/<kbd>S</kbd> throttle · <kbd>Space</kbd> stage · <kbd>X</kbd> cut engine · <kbd>R</kbd> restart · <kbd>A</kbd> autopilot · <kbd>P</kbd> pause · <kbd>1</kbd>–<kbd>5</kbd> time warp (5 = 50×, for the TLI wait)</p>
            </div>
            <div data-tour="rollout" className="mt-4"><GameButton variant="primary" className="w-full py-3 text-lg" icon={<Rocket className="size-5" />} onClick={() => { if (pendingTour() === "launch") setPendingTour("flight"); onStart(); }}>Roll out to the pad</GameButton></div>
          </GlassPanel>
          <p className="mt-2 text-center text-[11px] text-muted">Data: <a className="underline" href={DATASET.provenance.dataset}>space-mission-dataset</a>. Simplified 2-D ascent physics; balance values are not real.</p>
        </aside>
      </div>
    </ScreenContainer>
    </>
  );
}

/* ============================== flight ============================== */
interface Snap { t: number; phase: Flight["phase"]; stage: 1 | 2 | 3; engineOn: boolean; tel: Flight["tel"]; pitch: number; throttle: number; cue: number; ms: Record<string, number>; log: Flight["log"]; failure: string | null; cutoffs: number; cuts2: number; coastLeft: number; prop1: number; prop2: number; prop3: number; maxQ: number; maxG: number; warp: number; running: boolean; autopilot: boolean; upper: boolean; fairing: boolean }
const snap = (s: LaunchSession): Snap => { const f = s.flight; return { t: f.t, phase: f.phase, stage: f.stage, engineOn: f.engineOn, tel: f.tel, pitch: f.pitch, throttle: f.throttle, cue: guidancePitch(f), ms: f.milestones, log: f.log, failure: f.failure, cutoffs: f.cutoffs, cuts2: f.cuts2, coastLeft: f.coastLeft, prop1: f.prop1, prop2: f.prop2, prop3: f.prop3, maxQ: f.maxQ, maxG: f.maxG, warp: s.warp, running: s.running, autopilot: s.input.autopilot, upper: s.input.upperGuidance, fairing: f.fairing }; };
const milestonesFor = (f: Flight): [string, string][] => {
  const n = f.rocket.stageNames, three = !!f.rocket.s3, moon = f.mission === "moon";
  return [
    ["liftoff", "Liftoff"], ["maxq", "Max-Q"], ["meco", `${n[0]} cutoff`], ["sep", `${n[0]} separation`], ["ignition2", `${n[1]} ignition`],
    ...(three ? ([["meco2", `${n[1]} cutoff`], ["sep2", `${n[1]} separation`], ["ignition3", `${n[2]} ignition`]] as [string, string][]) : []),
    ["karman", "Kármán line · space!"], ["fairing", three ? "Escape tower jettison" : "Fairing jettison"],
    ["orbit", moon ? "Parking orbit" : "Orbit achieved"],
    ...(moon ? ([["tliStart", "TLI ignition"], ["tli", "Translunar injection"]] as [string, string][]) : []),
  ];
};

function Gauge({ label, value, text, tone = "ok", pct }: { label: string; value?: string; text?: string; tone?: "ok" | "warn" | "bad"; pct: number }) {
  return (
    <div>
      <div className="flex justify-between text-[11px]"><span className="hud-label">{label}</span><span className="tabular-nums">{value ?? text}</span></div>
      <div className="mt-0.5 h-1.5 rounded-sm bg-white/10" role="meter" aria-label={label} aria-valuenow={Math.round(pct * 100)} aria-valuemin={0} aria-valuemax={100}>
        <div className={cn("h-full rounded-sm", tone === "ok" ? "bg-ok" : tone === "warn" ? "bg-warn" : "bg-bad")} style={{ width: `${Math.min(100, Math.max(0, pct * 100))}%` }} />
      </div>
    </div>
  );
}

const B = ({ label, onClick, disabled, children, on, ...rest }: { label: string; onClick?: () => void; disabled?: boolean; children: ReactNode; on?: boolean } & React.HTMLAttributes<HTMLButtonElement>) => (
  <button type="button" aria-label={label} title={label} aria-pressed={on} disabled={disabled} onClick={onClick} {...rest}
    className={cn("inline-flex h-10 items-center gap-1.5 rounded-md border px-3 font-display text-sm uppercase tracking-wider transition disabled:opacity-35", on ? "border-orange bg-orange/15 text-orange" : "border-[var(--border)] bg-panel text-ink2 hover:text-ink")}>{children}</button>
);

export function AscentFlight({ session, onExit, onAgain, onContinue, continueLabel, exitLabel, onLunarResult }: { session: LaunchSession; onExit: () => void; onAgain: () => void; onContinue?: () => void; onLunarResult?: (r: { captured: boolean }) => void; continueLabel?: string; exitLabel?: string }) {
  const reduced = useUIStore((s) => s.reducedMotion);
  const rules = session.flight.rules;
  const canvas = useRef<HTMLCanvasElement>(null), wrap = useRef<HTMLDivElement>(null);
  const [view] = useState(() => newView(session.flight.site.id));
  const [s, setS] = useState<Snap>(() => snap(session));
  const [showResult, setShowResult] = useState(false);
  const [leg, setLeg] = useState(false); // Moon mission: coast to the Moon after TLI
  const [tour, setTour] = useState(false);
  const [help, setHelp] = useState(false);
  const [school, setSchool] = useState(false); // first-time manual flight school
  useEffect(() => { // storage is only readable after mount
    if (pendingTour() === "flight") { setTour(true); return; } // eslint-disable-line react-hooks/set-state-in-effect
    if (session.flight.rules.autopilot === "full") return;
    try { if (!window.localStorage.getItem("smd-manual-school")) setSchool(true); } catch { /* storage unavailable */ } // eslint-disable-line react-hooks/set-state-in-effect
  }, [session]);

  useEffect(() => {
    const el = canvas.current, box = wrap.current; if (!el || !box) return;
    const ctx = el.getContext("2d"); if (!ctx) return;
    let raf = 0, last = performance.now(), dead = false, W = 0, H = 0;
    const resize = () => { const r = box.getBoundingClientRect(), dpr = Math.min(1.5, window.devicePixelRatio || 1); W = r.width; H = r.height; el.width = Math.round(W * dpr); el.height = Math.round(H * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
    resize(); const ro = new ResizeObserver(resize); ro.observe(box);
    // real Earth texture for the orbit view + the 3-D rocket model as the flight sprite (both load async; the scene works without them)
    const fl = session.flight;
    void buildEarthDisc(fl.site.lat, fl.site.lon).then((c) => { if (!dead) view.setEarth(c); });
    void loadRocketSprite(fl.rocket.vehicle.id).then((sp) => { if (!dead) view.setSprite(sp); });
    const frame = (now: number) => {
      if (dead) return;
      const dt = Math.min(0.25, (now - last) / 1000); last = now; // a slow frame no longer slows the simulation down to a crawl
      session.tick(dt); updateView(view, session.flight, dt, reduced, session.running ? dt * session.warp : 0); drawFlight(ctx, W, H, session.flight, view);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => { dead = true; cancelAnimationFrame(raf); ro.disconnect(); };
  }, [session, view, reduced]);

  useEffect(() => { // HUD at 10 Hz
    let doneAt = 0;
    const id = setInterval(() => {
      setS(snap(session));
      if (session.done) { doneAt = doneAt || performance.now(); if (performance.now() - doneAt > (session.flight.phase === "failed" ? 2200 : 1400)) setShowResult(true); } else doneAt = 0;
    }, 100);
    return () => clearInterval(id);
  }, [session]);

  const f = session.flight, tel = s.tel;
  const apActive = rules.autopilot === "full" ? s.autopilot : rules.autopilot === "upper" ? s.upper && s.stage >= 2 : false;
  const manualPitch = !apActive, manualThrottle = !apActive || (rules.autopilot === "upper" && s.stage === 1);
  const toggleAuto = useCallback(() => { session.toggleAssist(); setS(snap(session)); }, [session]);
  const muted = useUIStore((st) => st.muted);
  const [voice, setVoice] = useState(!muted); // launch-director voice and flight sound
  const spoken = useRef(Number.POSITIVE_INFINITY);
  useEffect(() => {
    const t = s.t, running = s.running && s.phase !== "failed";
    if (!running || t >= 1.5) return;
    const n = Math.ceil(-t); // whole seconds to go
    if (n === spoken.current) return;
    spoken.current = n;
    if (n > 10 || n < 0) return;
    playVoice(`cd-${Math.max(0, n)}` as VoiceId, !voice);
  }, [s.t, s.running, s.phase, voice]);
  // flight callouts: the launch director reports each milestone once (the latest new one wins if several land together)
  const called = useRef(new Set<string>());
  useEffect(() => {
    if (!s.running && s.phase !== "failed") return;
    const moon = f.mission === "moon";
    const MAP: Record<string, VoiceId> = { maxq: "maxq", sep: "sep", sep2: "sep", ignition2: "ignition2", ignition3: "ignition2", karman: "karman", fairing: "jettison", orbit: moon ? "parking" : "orbit", tliStart: "tliStart", tli: "tli" };
    let say: VoiceId | null = null, at = -Infinity;
    for (const [k, id] of Object.entries(MAP)) {
      const t = s.ms[k];
      if (t === undefined || called.current.has(k)) continue;
      called.current.add(k);
      if (t >= at) { at = t; say = id; }
    }
    if (s.phase === "failed" && !called.current.has("failed")) { called.current.add("failed"); say = "failed"; }
    if (say) playVoice(say, !voice);
  }, [s.ms, s.phase, s.running, voice, f.mission]);
  useEffect(() => () => stopVoice(), []);
  // rocket sound design: engine follows throttle / altitude / max-Q, one-shots for milestones
  const engine = useRef<RocketSound | null>(null);
  const sfxCalled = useRef(new Set<string>());
  useEffect(() => {
    const c = audioContext();
    if (!voice || !c) { engine.current?.silence(); return; }
    if (!engine.current) engine.current = new RocketSound(c);
    engine.current.update(s.throttle, s.tel.alt, s.tel.q, s.running && s.engineOn && s.warp <= 2 && s.phase !== "failed", !s.running);
  }, [s.throttle, s.tel.alt, s.tel.q, s.running, s.engineOn, s.warp, s.phase, voice]);
  useEffect(() => {
    if (!voice) return;
    const EV: Record<string, Parameters<typeof playSfx>[0]> = { liftoff: "ignition", sep: "separation", sep2: "separation", ignition2: "ignite2", ignition3: "ignite2", tliStart: "ignite2", orbit: "chime", tli: "chime" };
    for (const [k, kind] of Object.entries(EV)) if (s.ms[k] !== undefined && !sfxCalled.current.has(k)) { sfxCalled.current.add(k); playSfx(kind); }
    if (s.phase === "failed" && !sfxCalled.current.has("failed")) { sfxCalled.current.add("failed"); playSfx("explosion"); engine.current?.silence(); }
  }, [s.ms, s.phase, voice]);
  useEffect(() => () => { engine.current?.dispose(); engine.current = null; }, []);
  const recorded = useRef(false);
  useEffect(() => { // count the finished flight toward cosmetic unlocks, once
    if (!(s.phase === "orbit" || s.phase === "translunar" || s.phase === "failed") || recorded.current) return;
    recorded.current = true;
    const sc = scoreFlight(session.flight);
    const names = useProgress.getState().recordFlight({ ok: sc.ok, mission: session.flight.mission, difficulty: session.difficulty, grade: sc.grade }, usePlayerStore.getState().profile.progression.level);
    if (names.length) useUIStore.getState().toast(`Cosmetic unlocked: ${names.join(", ")}`, "success");
  }, [s.phase, session]);
  const start = () => { primeVoice(); session.start(); setS(snap(session)); };
  const togglePause = useCallback(() => { if (session.flight.t > -LAUNCH.countdownS + 0.01 || session.running) session.toggleRun(); setS(snap(session)); }, [session]);
  const setWarp = useCallback((w: number) => { session.setWarp(w); setS(snap(session)); }, [session]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      // typing fields keep their keys, but a focused slider or button must not steal the flight controls (arrows pitch, Space stages)
      if ((e.target as HTMLElement | null)?.closest("input:not([type=range]),select,textarea")) return;
      const k = e.key.toLowerCase();
      if (k === "arrowup") { session.hold("up", true); e.preventDefault(); }
      else if (k === "arrowdown") { session.hold("down", true); e.preventDefault(); }
      else if (k === "w") session.setThrottle(e.shiftKey ? 1 : session.input.throttle + 0.05);
      else if (k === "s") session.setThrottle(e.shiftKey ? 0 : session.input.throttle - 0.05);
      else if (k === " ") { session.stage(); e.preventDefault(); }
      else if (k === "x") session.cut();
      else if (k === "r") session.restart();
      else if (k === "a") toggleAuto();
      else if (k === "p") togglePause();
      else if (k === "h" || k === "?") setHelp((v) => !v);
      else if (k === "m") setVoice((v) => !v);
      else if (["1", "2", "3", "4", "5"].includes(k)) setWarp([1, 3, 5, 10, 50][Number(k) - 1]);
    };
    const up = (e: KeyboardEvent) => { const k = e.key.toLowerCase(); if (k === "arrowup") session.hold("up", false); if (k === "arrowdown") session.hold("down", false); if (k === " " && !(e.target as HTMLElement | null)?.closest("input:not([type=range]),select,textarea")) e.preventDefault(); /* a focused button must not also "click" on Space */ };
    const release = () => { session.hold("up", false); session.hold("down", false); }; // keys held while the window loses focus would otherwise stay pressed
    window.addEventListener("keydown", down); window.addEventListener("keyup", up); window.addEventListener("blur", release); document.addEventListener("visibilitychange", release);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); window.removeEventListener("blur", release); document.removeEventListener("visibilitychange", release); };
  }, [session, toggleAuto, togglePause, setWarp]);

  const qLim = LAUNCH.qDesignPa * rules.qLimitFactor, qFrac = tel.q / qLim;
  const upper = f.rocket.s3 ? 3 : 2, upperFuel = f.rocket.s3 ? s.prop3 : s.prop2;
  const stageReady = !rules.autoStaging && ((s.stage === 1 && s.prop1 <= 0 && s.phase === "stage1") || (s.stage === 2 && !!f.rocket.s3 && (s.prop2 <= 0 || s.cuts2 > 0) && s.phase === "stage2" && !s.engineOn) || s.phase === "coast");
  const middle = s.stage === 2 && !!f.rocket.s3; // the 3-stage rocket's middle stage may also be cut and relit
  const canCut = (s.stage === upper || middle) && s.engineOn && !apActive && (s.phase === "stage2" || s.phase === "tli");
  const autoTli = rules.autopilot === "full" && s.autopilot;
  const canRestart = (s.stage === upper && !s.engineOn && upperFuel > 0 && s.cutoffs > 0 && s.cutoffs < 4 && s.phase === "stage2") || (middle && !s.engineOn && s.prop2 > 0 && s.cuts2 > 0 && s.cuts2 < 4 && s.phase === "stage2") || (s.phase === "parking" && !autoTli);
  const pitchErr = s.cue - s.pitch;
  const result = showResult ? scoreFlight(f) : null;
  const held = (key: "up" | "down") => ({ onPointerDown: () => session.hold(key, true), onPointerUp: () => session.hold(key, false), onPointerLeave: () => session.hold(key, false), onPointerCancel: () => session.hold(key, false) });
  if (leg) return <MoonLeg flight={f} onAgain={onAgain} onExit={onExit} onResult={onLunarResult} />;
  return (
    <main className="relative flex h-[calc(100dvh-81px)] min-h-0 shrink-0 flex-col overflow-hidden">
      {school && <Tour steps={MANUAL_TOUR.filter((st) => st.target !== "[data-tour=cue]" || rules.guideCue)} doneLabel="Start flying" onDone={() => { setSchool(false); try { window.localStorage.setItem("smd-manual-school", "1"); } catch { /* ignore */ } }} onSkip={() => { setSchool(false); try { window.localStorage.setItem("smd-manual-school", "1"); } catch { /* ignore */ } }} />}
      {help && <ControlsHelp onClose={() => setHelp(false)} />}
      {tour && <Tour steps={FLIGHT_TOUR} doneLabel="Let's fly" onDone={() => { setTour(false); setPendingTour(null); }} onSkip={() => { setTour(false); setPendingTour(null); }} />}
      <div ref={wrap} className="absolute inset-0"><canvas ref={canvas} className="h-full w-full" aria-label="Rocket flight view" role="img" /></div>

      {/* telemetry */}
      <dl className="relative z-10 m-2 max-h-[40%] w-52 shrink-0 space-y-1.5 overflow-y-auto max-sm:w-[46vw] max-sm:text-xs sm:m-3 rounded-md border border-[var(--border)] bg-bg/80 p-3 font-display text-sm tracking-wider" aria-label="Flight telemetry" data-tour="telemetry">
        <div><dt className="hud-label">Mission clock</dt><dd className="text-xl tabular-nums text-orange">{clock(s.t)}</dd></div>
        <div className="grid grid-cols-2 gap-x-2">
          <div><dt className="hud-label">Altitude</dt><dd className="tabular-nums">{tel.alt >= 100_000 ? fmt(tel.alt / 1000, 1) + " km" : tel.alt >= 1000 ? fmt(tel.alt / 1000, 2) + " km" : fmt(tel.alt) + " m"}</dd></div>
          <div><dt className="hud-label">Speed</dt><dd className="tabular-nums">{fmt(tel.speed)} m/s</dd></div>
          <div><dt className="hud-label">Downrange</dt><dd className="tabular-nums">{fmt(tel.downrangeKm)} km</dd></div>
          <div><dt className="hud-label">G-load</dt><dd className="tabular-nums">{tel.g.toFixed(1)} g</dd></div>
        </div>
        <Gauge label="Dynamic pressure" value={`${(tel.q / 1000).toFixed(1)} kPa`} pct={qFrac} tone={qFrac > 0.85 ? "bad" : qFrac > 0.6 ? "warn" : "ok"} />
        <Gauge label="Angle of attack" value={`${tel.aoa.toFixed(1)}°`} pct={Math.min(1, (tel.qAlpha * 1000) / (LAUNCH.qAlphaDesign * rules.qLimitFactor * (rules.aoaProtect ? 1.6 : 1) / (rules.aoaProtect ? 0.35 : 1)))} tone={tel.qAlpha > 60 ? "bad" : tel.qAlpha > 35 ? "warn" : "ok"} />
        <Gauge label="Throttle" value={`${Math.round(s.throttle * 100)} %`} pct={s.throttle} />
        {f.rocket.stageNames.map((nm, i) => { const v = [tel.prop1, tel.prop2, tel.prop3][i]; return <Gauge key={nm} label={`${nm} fuel`} value={`${Math.round(v * 100)} %`} pct={v} tone={s.stage === i + 1 && v < 0.12 ? "warn" : "ok"} />; })}
        <div className="grid grid-cols-2 gap-x-2 border-t border-[var(--border)] pt-1.5">
          <div><dt className="hud-label">Pitch</dt><dd className="tabular-nums">{s.pitch.toFixed(0)}°</dd></div>
          <div><dt className="hud-label">Orbit (low × high)</dt><dd className="tabular-nums text-xs">{tel.periKm > -1000 && tel.apoKm > 0.5 ? fmt(tel.periKm) : "—"} × {Number.isFinite(tel.apoKm) ? (tel.apoKm > 0.5 ? fmt(tel.apoKm) : "—") : "∞"} km</dd></div>
        </div>
        {s.phase === "parking" && tel.tliRemainS !== null && (
          <p className="text-[11px] text-ink2" aria-live="polite">TLI window in <b className="text-orange tabular-nums">{tel.tliRemainS > 1 ? clock(tel.tliRemainS).replace("T+", "") : "NOW"}</b>{autoTli ? " · autopilot ignites it" : tel.tliRemainS < 40 ? " · press Ignite TLI" : " · warp ahead (5)"}</p>
        )}
        {(s.phase === "tli" || s.phase === "translunar") && <p className="text-[11px] text-ink2">Apogee <b className="text-orange tabular-nums">{fmt(tel.apoKm)}</b> km → Moon at 384,400 km{tel.tliErrDeg !== null ? ` · window error ${tel.tliErrDeg.toFixed(1)}°` : ""}</p>}
        {rules.guideCue && manualPitch && s.phase !== "countdown" && s.stage <= 2 && (
          <p data-tour="cue" className="text-[11px] text-ink2" aria-live="off">Cue: <b className="text-ok">{s.cue.toFixed(0)}°</b> {Math.abs(pitchErr) < 2 ? "✓ on target" : pitchErr > 0 ? "▲ raise nose" : "▼ lower nose"}</p>
        )}
      </dl>

      {/* milestones */}
      <ol className="absolute right-2 top-2 z-10 max-h-[40%] w-64 space-y-1 overflow-y-auto max-sm:w-[44vw] max-sm:text-xs sm:right-3 sm:top-3 rounded-md border border-[var(--border)] bg-bg/80 p-3 text-sm" data-tour="milestones" aria-label="Mission milestones">
        {milestonesFor(f).map(([key, label]) => (
          <li key={key} className={cn("flex items-center gap-2", s.ms[key] !== undefined ? "text-ok" : "text-muted")}>
            <span aria-hidden className="grid size-4 place-items-center rounded-sm border text-[10px]">{s.ms[key] !== undefined ? "✓" : ""}</span>{label}
            {s.ms[key] !== undefined && <span className="ml-auto text-[11px] tabular-nums text-muted">{clock(s.ms[key])}</span>}
          </li>
        ))}
      </ol>

      {/* pad overlay */}
      {!s.running && s.t <= -LAUNCH.countdownS + 0.01 && s.phase === "countdown" && (
        <div data-tour="pad" className="absolute left-1/2 top-[16%] z-20 max-h-[66%] w-[min(28rem,calc(100%-1.5rem))] -translate-x-1/2 overflow-y-auto rounded-lg border border-[var(--border-strong)] bg-bg/90 p-4 text-center sm:p-5">
          <p className="hud-label !text-orange">{f.rocket.name} on the pad · {f.site.location.split(",")[0]}</p>
          <h2 className="mt-1 text-3xl font-bold">All systems go?</h2>
          <p className="mt-2 text-sm text-ink2">{rules.name}: {rules.tagline}. {f.mission === "moon" ? `Mission: parking orbit above ${rules.minPerigeeKm} km, then translunar injection to the Moon.` : `Orbit: lowest point above ${rules.minPerigeeKm} km.`}</p>
          <div className="mt-4 flex justify-center gap-2"><GameButton variant="primary" icon={<Rocket className="size-5" />} onClick={start}>Start countdown</GameButton><GameButton variant="ghost" onClick={onExit}>Back to briefing</GameButton></div>
        </div>
      )}
      {s.phase === "countdown" && s.running && s.t < 0 && <p className="pointer-events-none absolute inset-x-0 top-[22%] z-10 text-center font-display text-[clamp(3rem,16vh,6rem)] font-bold text-orange tabular-nums drop-shadow-lg" aria-live="assertive">{Math.ceil(-s.t) > 0 ? Math.ceil(-s.t) : ""}</p>}

      {/* log + controls */}
      <div className="relative z-10 mt-auto flex max-h-[62%] shrink-0 flex-col gap-2 overflow-y-auto p-3">
        <ul className="pointer-events-none max-w-xl space-y-0.5 text-sm" aria-live="polite">
          {s.log.slice(-3).map((l, i) => <li key={`${l.t}-${i}`} className={cn("rounded-sm bg-bg/70 px-2 py-0.5", l.tone === "good" ? "text-ok" : l.tone === "bad" ? "text-bad" : l.tone === "warn" ? "text-warn" : "text-ink2")}><span className="mr-2 text-muted tabular-nums">{clock(l.t)}</span>{l.text}</li>)}
        </ul>
        <div data-tour="controls" data-nosound className="flex flex-wrap items-center gap-2 rounded-md border border-[var(--border)] bg-bg/85 p-2">
          <B label={s.running ? "Pause (P)" : "Resume (P)"} onClick={togglePause} disabled={s.phase === "countdown" && !s.running && s.t <= -LAUNCH.countdownS + 0.01}>{s.running ? <Pause className="size-4" /> : <Play className="size-4" />}<kbd className="ml-0.5 rounded border border-white/25 bg-white/5 px-1 font-mono text-[10px] normal-case tracking-normal">P</kbd></B>
          <B label={voice ? "Mute sound" : "Unmute sound"} on={voice} onClick={() => setVoice((v) => !v)}>{voice ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}</B>
          {rules.autopilot !== "none" && <B label={rules.autopilot === "full" ? "Autopilot (A)" : "Upper-stage guidance (A)"} on={apActive} onClick={toggleAuto}><Bot className="size-4" />{rules.autopilot === "full" ? "Autopilot" : "Upper guidance"}<kbd className="ml-0.5 rounded border border-white/25 bg-white/5 px-1 font-mono text-[10px] normal-case tracking-normal">A</kbd></B>}
          <div data-tour="pitch" className="flex items-center gap-2">
            <span className="hud-label px-1">Pitch</span>
            <B label="Raise nose (↑)" disabled={!manualPitch} {...held("up")}><ArrowUp className="size-4" /></B>
            <B label="Lower nose (↓)" disabled={!manualPitch} {...held("down")}><ArrowDown className="size-4" /></B>
          </div>
          <label data-tour="throttle" className="flex items-center gap-2 text-xs text-ink2"><span className="hud-label">Throttle</span>
            <input type="range" min={0} max={Math.round((f.rocket.throttleCap ?? 1) * 100)} value={Math.round((manualThrottle ? Math.min(session.input.throttle, f.rocket.throttleCap ?? 1) : s.throttle) * 100)} disabled={!manualThrottle} aria-label="Throttle" className="w-28"
              onChange={(e) => { session.setThrottle(Number(e.target.value) / 100); setS(snap(session)); }} /><kbd className="ml-0.5 rounded border border-white/25 bg-white/5 px-1 font-mono text-[10px] normal-case tracking-normal">W/S</kbd></label>
          <B data-tour="stage" label="Stage separation / ignite (Space)" disabled={!stageReady} onClick={() => session.stage()}><Layers className="size-4" />{rules.autoStaging ? "Staging auto" : "Stage"}<kbd className="ml-0.5 rounded border border-white/25 bg-white/5 px-1 font-mono text-[10px] normal-case tracking-normal">Space</kbd></B>
          <B data-tour="cut" label="Engine cutoff (X)" disabled={!canCut} onClick={() => session.cut()}><Octagon className="size-4" />Cut<kbd className="ml-0.5 rounded border border-white/25 bg-white/5 px-1 font-mono text-[10px] normal-case tracking-normal">X</kbd></B>
          <B label="Restart engine (R)" disabled={!canRestart} onClick={() => session.restart()}><Power className="size-4" />{s.phase === "parking" ? "Ignite TLI" : "Restart"}<kbd className="ml-0.5 rounded border border-white/25 bg-white/5 px-1 font-mono text-[10px] normal-case tracking-normal">R</kbd></B>
          <B label="Keyboard controls (H)" onClick={() => setHelp(true)}><Keyboard className="size-4" /><kbd className="ml-0.5 rounded border border-white/25 bg-white/5 px-1 font-mono text-[10px] normal-case tracking-normal">H</kbd></B>
          <div data-tour="warp" role="radiogroup" aria-label="Time warp" className="ml-auto flex items-center gap-2">
            <span className="hud-label !text-sm">Warp</span>
            <div className="flex overflow-hidden rounded-md border border-[var(--border)]">
              {[1, 3, 5, 10, 50].map((w, i) => (
                <button key={w} type="button" role="radio" aria-checked={s.warp === w} aria-label={`Time warp ${w}x (key ${i + 1})`} title={`${w}× (key ${i + 1})`} onClick={() => setWarp(w)}
                  className={cn("h-10 min-w-12 px-3 font-display text-base font-semibold tabular-nums transition", s.warp === w ? "bg-orange text-[#1a0b00]" : "bg-panel text-ink2 hover:text-ink", i > 0 && "border-l border-[var(--border)]")}>{w}×</button>))}
            </div>
          </div>
        </div>
      </div>

      {/* result */}
      {result && (
        <div className="absolute inset-0 z-20 overflow-y-auto bg-black/55 p-3 sm:p-4">
          <div className="grid min-h-full place-items-center">
          <GlassPanel active className="enter w-full max-w-xl p-4 sm:p-6" role="dialog" aria-modal="true" aria-label="Flight result">
            <p className="hud-label">{f.rocket.name} · {f.rules.name} · {f.site.location.split(",")[0]}</p>
            <h2 className={cn("mt-1 text-4xl font-bold", result.ok ? "text-ok" : "text-bad")}>{result.ok ? (f.mission === "moon" ? "Translunar injection complete" : "Orbit achieved") : "Mission lost"}</h2>
            <p className="mt-1 text-sm text-ink2">{result.ok ? (f.mission === "moon" ? `${f.rocket.name} put the spacecraft on a ${fmt(tel.apoKm)} km-apogee transfer to the Moon at ${clock(f.t)} (window error ${Math.abs(tel.tliErrDeg ?? 0).toFixed(1)}°). Now coast to the Moon and capture into lunar orbit.` : `You reached a ${fmt(tel.periKm)} × ${fmt(tel.apoKm)} km orbit in ${clock(f.t)}.`) : f.failure}</p>
            <div className="mt-4 flex items-end gap-6">
              <div><p className="hud-label">Score</p><p className="font-display text-6xl font-bold leading-none text-orange tabular-nums">{result.score}</p></div>
              <div><p className="hud-label">Grade</p><p className="font-display text-6xl font-bold leading-none">{result.grade}</p></div>
              <p className="pb-1 text-xs text-muted">×{f.rules.scoreMult} {f.rules.name} multiplier</p>
            </div>
            <dl className="mt-4 grid grid-cols-4 gap-2 text-xs">
              {[["Max-Q", `${(f.maxQ / 1000).toFixed(1)} kPa`], ["Peak G", `${f.maxG.toFixed(1)} g`], ["Fuel left", `${Math.round(tel.prop2 * 100)} %`], ["Kármán line", result.karman ? "reached" : "no"]].map(([k, v]) => (
                <div key={k} className="rounded-md bg-white/5 p-2"><dt className="text-muted">{k}</dt><dd className="font-display text-base">{v}</dd></div>))}
            </dl>
            {!result.ok && (() => { const c = explainFailure(f); return (
              <section className="mt-4 rounded-lg border border-bad/40 bg-bad/10 p-3 text-sm" aria-label="Why the mission failed">
                <p className="font-display text-lg font-bold text-bad">{c.title}</p>
                <p className="mt-1 text-xs text-ink2"><b className="text-ink">What happened:</b> {c.why}</p>
                <p className="mt-2 text-xs font-semibold text-ink">What to do next time</p>
                <ol className="mt-1 list-decimal space-y-1 pl-5 text-xs text-ink2">{c.steps.map((st) => <li key={st}>{st}</li>)}</ol>
                <p className="mt-2 text-[11px] text-muted">Press H on the flight screen any time to see every key.</p>
              </section>); })()}
            <div className="mt-5 flex flex-wrap gap-2">
              {f.mission === "moon" && result.ok && !onContinue && <GameButton variant="primary" icon={<Rocket className="size-4" />} onClick={() => setLeg(true)}>Continue: coast to the Moon</GameButton>}
              {onContinue && result.ok && <GameButton variant="primary" icon={<Rocket className="size-4" />} onClick={onContinue}>Continue: {continueLabel ?? "next phase"}</GameButton>}
              <GameButton variant={(onContinue || f.mission === "moon") && result.ok ? "outline" : "primary"} icon={<RotateCcw className="size-4" />} onClick={onAgain}>Fly again</GameButton>
              <GameButton variant="outline" onClick={onExit}>{exitLabel ?? "Change setup"}</GameButton>
              {result.ok && !onContinue && f.mission === "orbit" && <Link href="/design" className="inline-flex items-center rounded-md border border-[var(--border-strong)] bg-panel px-4 py-2.5 font-display text-sm uppercase tracking-wider text-ink hover:border-ink2">Next: design the Moon mission</Link>}
            </div>
          </GlassPanel>
          </div>
        </div>
      )}
    </main>
  );
}

/* ============================== screen ============================== */
export function LaunchControl() {
  const { difficulty, siteId, vehicleId, mission, payloadPct, fuelPct, throttleCap } = useLaunchSetup();
  const [session, setSession] = useState<LaunchSession | null>(null);
  const [attempt, setAttempt] = useState(0);
  const launch = useCallback((n: number) => { const v = vehicleById(vehicleId) ?? DATASET.vehicles[0];
    setSession(new LaunchSession(difficulty, siteId, vehicleId, 1000 + n * 7919, Math.round(payloadFor(v, RULES[difficulty].payloadFrac, mission) * payloadPct), mission, { fuelPct, throttleCap })); setAttempt(n);
  }, [difficulty, siteId, vehicleId, mission, payloadPct, fuelPct, throttleCap]);
  if (!session) return <Briefing onStart={() => launch(attempt)} />;
  return <AscentFlight key={`${attempt}`} session={session} onExit={() => setSession(null)} onAgain={() => launch(attempt + 1)} />;
}
