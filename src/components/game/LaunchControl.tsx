"use client";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, Pause, Play, Rocket, RotateCcw, Power, Layers, Bot, Octagon } from "lucide-react";
import { BackButton, GameButton, GlassPanel, ScreenContainer } from "@/components/ui";
import { useUIStore } from "@/stores";
import { cn } from "@/lib/mission";
import { DATASET, vehicleById } from "@/game/data";
import { LAUNCH, RULES, buildRocket, guidancePitch, scoreFlight, type Difficulty, type Flight } from "@/game/launch/core";
import { LaunchSession } from "@/game/launch/session";
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
    <GlassPanel as="section" className="p-4" aria-label={title}>
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
  const { difficulty, siteId, vehicleId, set } = useLaunchSetup();
  const rules = RULES[difficulty];
  const v = vehicleById(vehicleId) ?? DATASET.vehicles[0];
  const site = DATASET.launch_sites.find((s) => s.id === siteId) ?? DATASET.launch_sites[0];
  const rocket = useMemo(() => buildRocket(v, v.leo_capacity_kg * rules.payloadFrac), [v, rules.payloadFrac]);
  return (
    <ScreenContainer title="Launch Control" subtitle="Roll out from a real spaceport and fly the ascent from the launch pad into orbit." actions={<BackButton href="/menu" label="Main menu" />}>
      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <Panel n={1} title="Difficulty" hint="Each level changes who flies, how heavy the payload is, the weather, failures and how strict the limits are.">
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
          <Panel n={2} title="Spaceport" hint="Real launch pads from the dataset. The closer to the equator, the more free eastward speed you get from Earth's spin.">
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
          <Panel n={3} title="Launch vehicle" hint="Liftoff mass, thrust, size and capacity are Launch Library 2 data. Stages, Isp and structure are modelled (game values).">
            <ul className="grid gap-2 sm:grid-cols-2">
              {DATASET.vehicles.slice().sort((a, b) => a.leo_capacity_kg - b.leo_capacity_kg).map((x) => (
                <li key={x.id}><Pick on={vehicleId === x.id} onClick={() => set({ vehicleId: x.id })}>
                  <div className="flex justify-between"><span className="font-display font-bold">{x.name}</span><span className="text-xs text-muted">{x.manufacturer_country}</span></div>
                  <p className="text-xs text-ink2">{fmt(x.leo_capacity_kg)} kg to LEO · {x.launch_mass_t ? `${fmt(x.launch_mass_t)} t at liftoff` : ""} · {usd(x.launch_cost_usd)}</p>
                </Pick></li>
              ))}
            </ul>
          </Panel>
        </div>
        <aside className="lg:sticky lg:top-4 lg:self-start">
          <GlassPanel active className="p-4">
            <p className="hud-label">Mission briefing</p>
            <h2 className="mt-1 text-2xl font-bold">{rocket.name} · {rules.name}</h2>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
              {[["Payload", `${fmt(rocket.payloadKg)} kg`], ["Liftoff mass", `${fmt(rocket.m0 / 1000)} t`], ["Thrust / weight", rocket.twr0.toFixed(2)], ["Ideal Δv", `${fmt(rocket.dvIdeal)} m/s`], ["Earth-spin boost", `+${fmt(site.rotation_boost_m_s)} m/s`], ["Upper winds", rules.windMs ? `up to ${rules.windMs} m/s` : "calm"]].map(([k, val]) => (
                <div key={k} className="rounded-md bg-white/5 p-2"><dt className="text-muted">{k}</dt><dd className="font-display text-base tabular-nums">{val}</dd></div>
              ))}
            </dl>
            <p className="mt-3 text-sm text-ink2"><b className="text-ink">Goal:</b> reach a stable orbit — lowest point above <b>{rules.minPerigeeKm} km</b>, highest below <b>{rules.maxApogeeKm} km</b>. Cross the Kármán line (100 km) on the way.</p>
            <ol className="mt-2 list-decimal space-y-0.5 pl-5 text-xs text-ink2"><li>Countdown &amp; liftoff</li><li>Clear the tower, pitch over</li><li>Max-Q (peak air pressure)</li><li>Stage separation</li><li>Upper stage burn to orbital speed</li><li>Engine cutoff in orbit</li></ol>
            <div className="mt-3 rounded-md border border-[var(--border)] p-2 text-xs text-ink2">
              <p className="hud-label mb-1">Controls</p>
              <p><kbd>↑</kbd>/<kbd>↓</kbd> pitch · <kbd>W</kbd>/<kbd>S</kbd> throttle · <kbd>Space</kbd> stage · <kbd>X</kbd> cut engine · <kbd>R</kbd> restart · <kbd>A</kbd> autopilot · <kbd>P</kbd> pause · <kbd>1</kbd>–<kbd>4</kbd> time warp</p>
            </div>
            <GameButton variant="primary" className="mt-4 w-full py-3 text-lg" icon={<Rocket className="size-5" />} onClick={onStart}>Roll out to the pad</GameButton>
          </GlassPanel>
          <p className="mt-2 text-center text-[11px] text-muted">Data: <a className="underline" href={DATASET.provenance.dataset}>space-mission-dataset</a>. Simplified 2-D ascent physics; balance values are not real.</p>
        </aside>
      </div>
    </ScreenContainer>
  );
}

/* ============================== flight ============================== */
interface Snap { t: number; phase: Flight["phase"]; stage: 1 | 2; engineOn: boolean; tel: Flight["tel"]; pitch: number; throttle: number; cue: number; ms: Record<string, number>; log: Flight["log"]; failure: string | null; cutoffs: number; coastLeft: number; prop1: number; prop2: number; maxQ: number; maxG: number; warp: number; running: boolean; autopilot: boolean; upper: boolean; fairing: boolean }
const snap = (s: LaunchSession): Snap => { const f = s.flight; return { t: f.t, phase: f.phase, stage: f.stage, engineOn: f.engineOn, tel: f.tel, pitch: f.pitch, throttle: f.throttle, cue: guidancePitch(f), ms: f.milestones, log: f.log, failure: f.failure, cutoffs: f.cutoffs, coastLeft: f.coastLeft, prop1: f.prop1, prop2: f.prop2, maxQ: f.maxQ, maxG: f.maxG, warp: s.warp, running: s.running, autopilot: s.input.autopilot, upper: s.input.upperGuidance, fairing: f.fairing }; };
const MILESTONES: [string, string][] = [["liftoff", "Liftoff"], ["maxq", "Max-Q"], ["meco", "Main engine cutoff"], ["sep", "Stage separation"], ["ignition2", "Second stage ignition"], ["karman", "Kármán line · space!"], ["fairing", "Fairing jettison"], ["orbit", "Orbit achieved"]];

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

export function AscentFlight({ session, onExit, onAgain, onContinue, continueLabel, exitLabel }: { session: LaunchSession; onExit: () => void; onAgain: () => void; onContinue?: () => void; continueLabel?: string; exitLabel?: string }) {
  const reduced = useUIStore((s) => s.reducedMotion);
  const rules = session.flight.rules;
  const canvas = useRef<HTMLCanvasElement>(null), wrap = useRef<HTMLDivElement>(null);
  const [view] = useState(() => newView(session.flight.site.id));
  const [s, setS] = useState<Snap>(() => snap(session));
  const [showResult, setShowResult] = useState(false);

  useEffect(() => {
    const el = canvas.current, box = wrap.current; if (!el || !box) return;
    const ctx = el.getContext("2d"); if (!ctx) return;
    let raf = 0, last = performance.now(), dead = false, W = 0, H = 0;
    const resize = () => { const r = box.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1); W = r.width; H = r.height; el.width = Math.round(W * dpr); el.height = Math.round(H * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
    resize(); const ro = new ResizeObserver(resize); ro.observe(box);
    // real Earth texture for the orbit view + the 3-D rocket model as the flight sprite (both load async; the scene works without them)
    const fl = session.flight;
    void buildEarthDisc(fl.site.lat, fl.site.lon).then((c) => { if (!dead) view.setEarth(c); });
    void loadRocketSprite(fl.rocket.vehicle.id).then((sp) => { if (!dead) view.setSprite(sp); });
    const frame = (now: number) => {
      if (dead) return;
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
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
  const apActive = rules.autopilot === "full" ? s.autopilot : rules.autopilot === "upper" ? s.upper && s.stage === 2 : false;
  const manualPitch = !apActive, manualThrottle = !apActive || (rules.autopilot === "upper" && s.stage === 1);
  const toggleAuto = useCallback(() => { session.toggleAssist(); setS(snap(session)); }, [session]);
  const start = () => { session.start(); setS(snap(session)); };
  const togglePause = useCallback(() => { if (session.flight.t > -LAUNCH.countdownS + 0.01 || session.running) session.toggleRun(); setS(snap(session)); }, [session]);
  const setWarp = useCallback((w: number) => { session.setWarp(w); setS(snap(session)); }, [session]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement | null)?.closest("input,select,textarea")) return;
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
      else if (["1", "2", "3", "4"].includes(k)) setWarp([1, 2, 5, 10][Number(k) - 1]);
    };
    const up = (e: KeyboardEvent) => { const k = e.key.toLowerCase(); if (k === "arrowup") session.hold("up", false); if (k === "arrowdown") session.hold("down", false); };
    window.addEventListener("keydown", down); window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, [session, toggleAuto, togglePause, setWarp]);

  const qLim = LAUNCH.qDesignPa * rules.qLimitFactor, qFrac = tel.q / qLim;
  const stageReady = s.stage === 1 && s.prop1 <= 0 && s.phase === "stage1" && !rules.autoStaging || (s.phase === "coast" && !rules.autoStaging);
  const canCut = s.stage === 2 && s.engineOn && !apActive, canRestart = s.stage === 2 && !s.engineOn && s.prop2 > 0 && s.cutoffs > 0 && s.cutoffs < 4 && s.phase === "stage2";
  const pitchErr = s.cue - s.pitch;
  const result = showResult ? scoreFlight(f) : null;
  const held = (key: "up" | "down") => ({ onPointerDown: () => session.hold(key, true), onPointerUp: () => session.hold(key, false), onPointerLeave: () => session.hold(key, false), onPointerCancel: () => session.hold(key, false) });
  return (
    <main className="relative flex min-h-[calc(100vh-70px)] flex-1 flex-col">
      <div ref={wrap} className="absolute inset-0"><canvas ref={canvas} className="h-full w-full" aria-label="Rocket flight view" role="img" /></div>

      {/* telemetry */}
      <dl className="pointer-events-none relative z-10 m-3 w-52 space-y-1.5 rounded-md border border-[var(--border)] bg-bg/80 p-3 font-display text-sm tracking-wider" aria-label="Flight telemetry">
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
        <Gauge label="Stage 1 fuel" value={`${Math.round(tel.prop1 * 100)} %`} pct={tel.prop1} tone={tel.prop1 < 0.1 ? "warn" : "ok"} />
        <Gauge label="Stage 2 fuel" value={`${Math.round(tel.prop2 * 100)} %`} pct={tel.prop2} tone={s.stage === 2 && tel.prop2 < 0.12 ? "warn" : "ok"} />
        <div className="grid grid-cols-2 gap-x-2 border-t border-[var(--border)] pt-1.5">
          <div><dt className="hud-label">Pitch</dt><dd className="tabular-nums">{s.pitch.toFixed(0)}°</dd></div>
          <div><dt className="hud-label">Orbit (low × high)</dt><dd className="tabular-nums text-xs">{tel.periKm > -1000 && tel.apoKm > 0.5 ? fmt(tel.periKm) : "—"} × {Number.isFinite(tel.apoKm) ? (tel.apoKm > 0.5 ? fmt(tel.apoKm) : "—") : "∞"} km</dd></div>
        </div>
        {rules.guideCue && manualPitch && s.phase !== "countdown" && s.stage <= 2 && (
          <p className="text-[11px] text-ink2" aria-live="off">Cue: <b className="text-ok">{s.cue.toFixed(0)}°</b> {Math.abs(pitchErr) < 2 ? "✓ on target" : pitchErr > 0 ? "▲ raise nose" : "▼ lower nose"}</p>
        )}
      </dl>

      {/* milestones */}
      <ol className="pointer-events-none absolute right-3 top-3 z-10 w-64 space-y-1 rounded-md border border-[var(--border)] bg-bg/80 p-3 text-sm" aria-label="Mission milestones">
        {MILESTONES.map(([key, label]) => (
          <li key={key} className={cn("flex items-center gap-2", s.ms[key] !== undefined ? "text-ok" : "text-muted")}>
            <span aria-hidden className="grid size-4 place-items-center rounded-sm border text-[10px]">{s.ms[key] !== undefined ? "✓" : ""}</span>{label}
            {s.ms[key] !== undefined && <span className="ml-auto text-[11px] tabular-nums text-muted">{clock(s.ms[key])}</span>}
          </li>
        ))}
      </ol>

      {/* pad overlay */}
      {!s.running && s.t <= -LAUNCH.countdownS + 0.01 && s.phase === "countdown" && (
        <div className="relative z-10 mx-auto mt-24 max-w-md rounded-lg border border-[var(--border-strong)] bg-bg/85 p-5 text-center">
          <p className="hud-label !text-orange">{f.rocket.name} on the pad · {f.site.location.split(",")[0]}</p>
          <h2 className="mt-1 text-3xl font-bold">All systems go?</h2>
          <p className="mt-2 text-sm text-ink2">{rules.name}: {rules.tagline}. Orbit: lowest point above {rules.minPerigeeKm} km.</p>
          <div className="mt-4 flex justify-center gap-2"><GameButton variant="primary" icon={<Rocket className="size-5" />} onClick={start}>Start countdown</GameButton><GameButton variant="ghost" onClick={onExit}>Back to briefing</GameButton></div>
        </div>
      )}
      {s.phase === "countdown" && s.running && s.t < 0 && <p className="pointer-events-none relative z-10 mt-20 text-center font-display text-8xl font-bold text-orange tabular-nums drop-shadow-lg" aria-live="assertive">{Math.ceil(-s.t) > 0 ? Math.ceil(-s.t) : ""}</p>}

      {/* log + controls */}
      <div className="relative z-10 mt-auto flex flex-col gap-2 p-3">
        <ul className="pointer-events-none max-w-xl space-y-0.5 text-sm" aria-live="polite">
          {s.log.slice(-3).map((l, i) => <li key={`${l.t}-${i}`} className={cn("rounded-sm bg-bg/70 px-2 py-0.5", l.tone === "good" ? "text-ok" : l.tone === "bad" ? "text-bad" : l.tone === "warn" ? "text-warn" : "text-ink2")}><span className="mr-2 text-muted tabular-nums">{clock(l.t)}</span>{l.text}</li>)}
        </ul>
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-[var(--border)] bg-bg/85 p-2">
          <B label={s.running ? "Pause (P)" : "Resume (P)"} onClick={togglePause} disabled={s.phase === "countdown" && !s.running && s.t <= -LAUNCH.countdownS + 0.01}>{s.running ? <Pause className="size-4" /> : <Play className="size-4" />}</B>
          {rules.autopilot !== "none" && <B label={rules.autopilot === "full" ? "Autopilot (A)" : "Upper-stage guidance (A)"} on={apActive} onClick={toggleAuto}><Bot className="size-4" />{rules.autopilot === "full" ? "Autopilot" : "Upper guidance"}</B>}
          <span className="hud-label px-1">Pitch</span>
          <B label="Raise nose (↑)" disabled={!manualPitch} {...held("up")}><ArrowUp className="size-4" /></B>
          <B label="Lower nose (↓)" disabled={!manualPitch} {...held("down")}><ArrowDown className="size-4" /></B>
          <label className="flex items-center gap-2 text-xs text-ink2"><span className="hud-label">Throttle</span>
            <input type="range" min={0} max={100} value={Math.round((manualThrottle ? session.input.throttle : s.throttle) * 100)} disabled={!manualThrottle} aria-label="Throttle" className="w-28"
              onChange={(e) => { session.setThrottle(Number(e.target.value) / 100); setS(snap(session)); }} /></label>
          <B label="Stage separation / ignite (Space)" disabled={!stageReady} onClick={() => session.stage()}><Layers className="size-4" />{rules.autoStaging ? "Staging auto" : "Stage"}</B>
          <B label="Engine cutoff (X)" disabled={!canCut} onClick={() => session.cut()}><Octagon className="size-4" />Cut</B>
          <B label="Restart engine (R)" disabled={!canRestart} onClick={() => session.restart()}><Power className="size-4" />Restart</B>
          <label className="ml-auto flex items-center gap-1 text-xs text-ink2">Warp
            <select aria-label="Time warp" value={s.warp} onChange={(e) => setWarp(Number(e.target.value))} className="px-1 py-0.5 text-xs">{[1, 2, 5, 10].map((w) => <option key={w} value={w}>{w}×</option>)}</select></label>
        </div>
      </div>

      {/* result */}
      {result && (
        <div className="absolute inset-0 z-20 grid place-items-center bg-black/55 p-4">
          <GlassPanel active className="enter w-full max-w-xl p-6" role="dialog" aria-modal="true" aria-label="Flight result">
            <p className="hud-label">{f.rocket.name} · {f.rules.name} · {f.site.location.split(",")[0]}</p>
            <h2 className={cn("mt-1 text-4xl font-bold", result.ok ? "text-ok" : "text-bad")}>{result.ok ? "Orbit achieved" : "Mission lost"}</h2>
            <p className="mt-1 text-sm text-ink2">{result.ok ? `You reached a ${fmt(tel.periKm)} × ${fmt(tel.apoKm)} km orbit in ${clock(f.t)}.` : f.failure}</p>
            <div className="mt-4 flex items-end gap-6">
              <div><p className="hud-label">Score</p><p className="font-display text-6xl font-bold leading-none text-orange tabular-nums">{result.score}</p></div>
              <div><p className="hud-label">Grade</p><p className="font-display text-6xl font-bold leading-none">{result.grade}</p></div>
              <p className="pb-1 text-xs text-muted">×{f.rules.scoreMult} {f.rules.name} multiplier</p>
            </div>
            <dl className="mt-4 grid grid-cols-4 gap-2 text-xs">
              {[["Max-Q", `${(f.maxQ / 1000).toFixed(1)} kPa`], ["Peak G", `${f.maxG.toFixed(1)} g`], ["Fuel left", `${Math.round(tel.prop2 * 100)} %`], ["Kármán line", result.karman ? "reached" : "no"]].map(([k, v]) => (
                <div key={k} className="rounded-md bg-white/5 p-2"><dt className="text-muted">{k}</dt><dd className="font-display text-base">{v}</dd></div>))}
            </dl>
            {!result.ok && <p className="mt-3 text-xs text-ink2">Tip: {f.rules.autopilot === "full" ? "turn the autopilot on and let it fly the climb." : f.rules.guideCue ? "follow the pitch cue, throttle down near max-Q, and cut the engine at orbital speed." : "ease the pitch over gradually, throttle through max-Q, and watch your fuel."}</p>}
            <div className="mt-5 flex flex-wrap gap-2">
              {onContinue && result.ok && <GameButton variant="primary" icon={<Rocket className="size-4" />} onClick={onContinue}>Continue: {continueLabel ?? "next phase"}</GameButton>}
              <GameButton variant={onContinue && result.ok ? "outline" : "primary"} icon={<RotateCcw className="size-4" />} onClick={onAgain}>Fly again</GameButton>
              <GameButton variant="outline" onClick={onExit}>{exitLabel ?? "Change setup"}</GameButton>
              {result.ok && !onContinue && <Link href="/design" className="inline-flex items-center rounded-md border border-[var(--border-strong)] bg-panel px-4 py-2.5 font-display text-sm uppercase tracking-wider text-ink hover:border-ink2">Next: design the Moon mission</Link>}
            </div>
          </GlassPanel>
        </div>
      )}
    </main>
  );
}

/* ============================== screen ============================== */
export function LaunchControl() {
  const { difficulty, siteId, vehicleId } = useLaunchSetup();
  const [session, setSession] = useState<LaunchSession | null>(null);
  const [attempt, setAttempt] = useState(0);
  const launch = useCallback((n: number) => { setSession(new LaunchSession(difficulty, siteId, vehicleId, 1000 + n * 7919)); setAttempt(n); }, [difficulty, siteId, vehicleId]);
  if (!session) return <Briefing onStart={() => launch(attempt)} />;
  return <AscentFlight key={`${attempt}`} session={session} onExit={() => setSession(null)} onAgain={() => launch(attempt + 1)} />;
}
