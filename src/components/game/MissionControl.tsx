"use client";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  AlertTriangle, Battery, CheckCircle2, Database, Fuel, Octagon, Pause, Play, Radio, Rocket, Thermometer, Wand2, Zap, X, Gauge, type LucideIcon,
} from "lucide-react";
import { BackButton, GameButton, GlassPanel, ScreenContainer } from "@/components/ui";
import { cn } from "@/lib/mission";
import { useDesignStore, useEvaluation } from "@/game/store";
import { eventById } from "@/game/ops/events";
import { useOps, type ResourceId, type Speed } from "@/game/ops/store";
import { useMission, stageLabel, type MissionRecord } from "@/game/mission";
import { observationOf } from "@/game/lunarField";
import { buildLearning } from "@/game/learn";
import { SurveyMap, useLunarField } from "./SurveyMap";
import { Line } from "@react-three/drei";
import { Scene3D, PlanetModel } from "@/components/three/lazy";
import { SpacecraftModel } from "./TrajectorySim";
import {
  CMD_LABEL, OPS, dataRateMbps, downlinkMbps, fmtMet, instrumentPowerW, orbitPhase, type Command, type OpsState, type Phase,
} from "@/game/ops/sim";
import type { Evaluation } from "@/game/engine";

const fmt = (n: number, d = 0) => n.toLocaleString("en-US", { maximumFractionDigits: d });
type Level = "ok" | "warn" | "crit";
const LEVEL_ICON: Record<Level, LucideIcon> = { ok: CheckCircle2, warn: AlertTriangle, crit: Octagon };
const LEVEL_TEXT: Record<Level, string> = { ok: "Healthy", warn: "Warning", crit: "Action needed" };
const LEVEL_COLOR: Record<Level, string> = { ok: "text-ok border-ok/40", warn: "text-warn border-warn/50", crit: "text-bad border-bad/60" };
const BAR: Record<Level, string> = { ok: "bg-ok", warn: "bg-warn", crit: "bg-bad" };

/** Shown once, in the briefing. Values below are GAME-BALANCED simplifications, not NASA-certified numbers. */
const CONTRACT = {
  name: "Lunar Magnetic Survey",
  text: "Map the Moon's magnetic anomalies from a polar orbit. You fly the mission yourself: manage power, data, heat and fuel for 30 days of science, and make the calls when things go wrong.",
};

/* ------------------------------------------------------------------ resources */
interface Resource { id: ResourceId; label: string; icon: LucideIcon; value: string; sub: string; frac: number; level: Level; explain: string }
function resources(s: OpsState, ev: Evaluation): Resource[] {
  const pct = (s.batteryWh / OPS.batteryWh) * 100;
  const net = s.powerGenW - s.powerUseW;
  const instW = instrumentPowerW(ev);
  const dvNeeded = s.phase === "cruise" || s.phase === "ascent" ? ev.plan.captureDv : 0;
  const dataPct = (s.dataGb / OPS.storageGb) * 100;
  return [
    {
      id: "power", label: "Power", icon: Zap, value: `${fmt(s.powerGenW)} W in`, sub: `${fmt(s.powerUseW)} W out`, frac: Math.min(1, s.powerUseW / Math.max(1, s.powerGenW || s.powerUseW)),
      level: net < 0 && !s.sunlit ? "warn" : net < 0 ? "crit" : "ok",
      explain: `Generation: arrays (${fmt(ev.solarGenW)} W at full Sun, plus ${fmt(ev.rtgGenW)} W of constant RTG power; derated to ${OPS.arrayDerate * 100} % for pointing/dust/temperature) = ${fmt(s.powerGenW)} W now${s.sunlit ? "" : " — in eclipse the arrays make nothing"}. Consumption: bus ${fmt(80)} W + instruments (${fmt(instW)} W when observing, 10 % standby) + transmitter (${fmt(ev.antenna.txW / 0.35)} W while downlinking). Pointing at the Sun gives the most power; at the Moon or Earth about half.`,
    },
    {
      id: "battery", label: "Battery", icon: Battery, value: `${fmt(pct)} %`, sub: `${fmt(s.batteryWh)} / ${OPS.batteryWh} Wh`, frac: pct / 100,
      level: pct < 15 ? "crit" : pct < 30 ? "warn" : "ok",
      explain: `The battery covers the ${Math.round(OPS.eclipseFrac * 118)}-minute eclipse each orbit. It charges only when generation exceeds use. Below 8 % it ages quickly; at 0 % the spacecraft browns out into safe mode. Switch instruments off before sunset or fly a larger array.`,
    },
    {
      id: "fuel", label: "Fuel (Δv)", icon: Fuel, value: `${fmt(s.dvLeft)} m/s`, sub: dvNeeded ? `${fmt(dvNeeded)} m/s needed for insertion` : "reserve for corrections", frac: Math.max(0, Math.min(1, s.dvLeft / Math.max(1, ev.dvAvailable))),
      level: s.dvLeft < dvNeeded * 1.05 ? "crit" : s.dvLeft < Math.max(40, dvNeeded * 1.3) ? "warn" : "ok",
      explain: `Δv is the velocity change your propellant can still deliver (${ev.electric ? ev.electric.name : "chemical engine"}, ${fmt(ev.isp)} s Isp). Burns, wheel desaturation and anomalies spend it; nothing refills it. The insertion burn alone needs ${fmt(ev.plan.captureDv)} m/s.`,
    },
    {
      id: "data", label: "Data storage", icon: Database, value: `${fmt(s.dataGb, 1)} GB`, sub: `of ${OPS.storageGb} GB · ${fmt(dataRateMbps(ev), 2)} Mbps in`, frac: dataPct / 100,
      level: dataPct >= 98 ? "crit" : dataPct > 80 ? "warn" : "ok",
      explain: `Instruments record ${fmt(dataRateMbps(ev), 2)} Mbps while observing (nadir-pointed, powered). Data fills storage until it is downlinked; when full, new science is lost. Returned so far: ${fmt(s.stats.returnedGb, 1)} GB (${fmt(s.stats.usefulReturnedGb, 1)} GB useful). Goal: ${OPS.goalDataGb} GB.`,
    },
    {
      id: "comms", label: "Comms", icon: Radio, value: s.downlinking ? `${fmt(s.linkMbps, 2)} Mbps` : s.contact ? "Contact" : "No contact", sub: s.pointing === "earth" ? "Pointed at Earth" : `Pointed at ${s.pointing}`, frac: Math.min(1, s.linkMbps / Math.max(0.01, downlinkMbps(ev))),
      level: s.health.comms < 0.5 || s.flags.commsMult < 0.5 ? "crit" : s.contact && s.pointing !== "earth" && s.dataGb > 5 ? "warn" : "ok",
      explain: `${ev.antenna.name}: up to ${fmt(downlinkMbps(ev) * s.flags.commsMult, 2)} Mbps when pointed at Earth during a ground-station pass (${Math.round(OPS.stationUpFrac * 100)} % of each day, Earth also above the lunar horizon). ${s.contact ? "A pass is open right now." : "No pass right now."} Pointing at Earth means not observing: re-pointing takes ${OPS.slewS / 60} min.`,
    },
    {
      id: "thermal", label: "Thermal", icon: Thermometer, value: `${fmt(s.tempC)} °C`, sub: s.tempC > OPS.hotC ? "Hot" : s.tempC < OPS.coldC ? "Cold" : "Nominal", frac: Math.max(0, Math.min(1, (s.tempC + 60) / 140)),
      level: s.tempC > OPS.safeHotC || s.tempC < OPS.coldC ? "crit" : s.tempC > OPS.hotC - 5 ? "warn" : "ok",
      explain: `Temperature rises with dissipated power and sunlight (staring at the Sun heats most) and falls in eclipse. Nominal is ${OPS.coldC + 15}…${OPS.hotC} °C. Above ${OPS.hotC} °C instruments and battery age; above ${OPS.safeHotC} °C damage is fast. Cold below ${OPS.coldC} °C hurts the comms hardware.`,
    },
  ];
}

interface Alert { id: string; level: Level; text: string; resource: ResourceId }
function alerts(s: OpsState, ev: Evaluation): Alert[] {
  const out: Alert[] = [];
  const net = s.powerGenW - s.powerUseW;
  if (s.safe) out.push({ id: "safe", level: "warn", text: "Safe mode active: science is stopped. Use Resume when the battery is above 25 %.", resource: "battery" });
  if (s.batteryWh / OPS.batteryWh < 0.3 && net < 0) out.push({ id: "batt", level: s.batteryWh / OPS.batteryWh < 0.15 ? "crit" : "warn", text: `Power deficit ${fmt(-net)} W: battery at ${fmt((s.batteryWh / OPS.batteryWh) * 100)} %. Switch instruments off or point at the Sun.`, resource: "battery" });
  if (s.dataGb / OPS.storageGb > 0.8) out.push({ id: "data", level: s.dataGb / OPS.storageGb > 0.97 ? "crit" : "warn", text: `Storage ${fmt((s.dataGb / OPS.storageGb) * 100)} % full. Point at Earth during a ground pass to downlink.`, resource: "data" });
  if (s.tempC > OPS.hotC - 5) out.push({ id: "hot", level: s.tempC > OPS.hotC ? "crit" : "warn", text: `Spacecraft at ${fmt(s.tempC)} °C. Reduce load or point away from the Sun.`, resource: "thermal" });
  if (s.phase === "science" && s.contact && s.pointing !== "earth" && s.dataGb > 8 && !s.safe) out.push({ id: "pass", level: "warn", text: `Ground-station pass open and ${fmt(s.dataGb, 0)} GB waiting. Point at Earth to downlink.`, resource: "comms" });
  if (s.flags.commsMult < 1) out.push({ id: "ant", level: "crit", text: `Antenna stuck: data rate limited to ${Math.round(s.flags.commsMult * 100)} %.`, resource: "comms" });
  if (s.flags.navError) out.push({ id: "nav", level: "crit", text: "Uncorrected navigation error: insertion needs +60 m/s and may fail.", resource: "fuel" });
  if (s.health.instruments < 0.6) out.push({ id: "inst", level: s.health.instruments < 0.35 ? "crit" : "warn", text: `Instruments at ${fmt(s.health.instruments * 100)} % health.`, resource: "thermal" });
  void ev;
  return out;
}

/* ------------------------------------------------------------------ small UI */
function Pill({ level, children }: { level: Level; children: ReactNode }) {
  const I = LEVEL_ICON[level];
  return <span className={cn("inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 font-display text-[11px] uppercase tracking-wider", LEVEL_COLOR[level])}><I className="size-3" aria-hidden />{children}</span>;
}
function Bar({ frac, level, label }: { frac: number; level: Level; label: string }) {
  return <div className="mt-1 h-1.5 rounded-sm bg-white/10" role="meter" aria-label={label} aria-valuenow={Math.round(frac * 100)} aria-valuemin={0} aria-valuemax={100}><div className={cn("h-full rounded-sm", BAR[level])} style={{ width: `${Math.min(100, Math.max(0, frac * 100))}%` }} /></div>;
}

const PHASES: { id: Phase; label: string }[] = [{ id: "ascent", label: "Ascent" }, { id: "cruise", label: "Cruise" }, { id: "loi", label: "Insertion" }, { id: "science", label: "Science" }];

/** One 3-D scene (one canvas): the real textured Moon with the spacecraft orbiting it, or the Earth-Moon transfer. */
function OrbitView({ s, ev }: { s: OpsState; ev: Evaluation }) {
  const science = s.phase === "science";
  const progress = s.phase === "ascent" ? s.phaseT / OPS.ascentS * 0.08 : s.phase === "cruise" ? 0.08 + 0.84 * Math.min(1, s.phaseT / (ev.cruiseDays * 86400)) : 0.95;
  const ang = 2 * Math.PI * (orbitPhase(s.t) - 0.81), R = 2.5;
  const sat: [number, number, number] = science ? [R * Math.cos(ang), 0, R * Math.sin(ang)] : [-3 + 6 * progress, 0.5 * Math.sin(progress * Math.PI), 0];
  const a0 = -0.19 * 2 * Math.PI, a1 = 0.19 * 2 * Math.PI;
  const ring = Array.from({ length: 96 }, (_, i) => { const a = (i / 96) * 2 * Math.PI; return [R * Math.cos(a), 0, R * Math.sin(a)] as [number, number, number]; });
  const shadow = Array.from({ length: 24 }, (_, i) => { const a = a0 + ((a1 - a0) * i) / 23; return [R * Math.cos(a), 0, R * Math.sin(a)] as [number, number, number]; });
  const status = science ? `${s.sunlit ? "Sunlight" : "ECLIPSE"} · pointing ${s.pointing} · ${s.observing ? "observing" : s.downlinking ? "downlinking" : "idle"}` : s.phase === "ascent" ? "Ascent to parking orbit" : s.phase === "cruise" ? `Trans-lunar coast · ${Math.round(progress * 100)} %` : "Arriving — insertion burn";
  return (
    <div className="relative h-full w-full" role="img" aria-label={science ? `Lunar orbit, spacecraft ${s.sunlit ? "in sunlight" : "in eclipse"}, pointed at ${s.pointing}` : "Earth–Moon transfer progress"}>
      <Scene3D camera={science ? [0, 3.6, 5.4] : [0, 1.6, 7]} light="orbit" stars label="Spacecraft in lunar orbit">
        {science ? (
          <>
            <directionalLight position={[-6, 1.5, 0]} intensity={2.2} color="#fff4e0" />
            <PlanetModel kind="moon" radius={1.25} />
            <PlanetModel kind="earth" radius={0.45} position={[4.4, -0.3, 2.3]} />
            <Line points={ring} color="#6f86a8" lineWidth={1} dashed dashSize={0.12} gapSize={0.12} />
            <Line points={shadow} color="#e7edf7" lineWidth={2.5} />
            {s.contact && <Line points={[sat, [4.4, -0.3, 2.3]]} color="#36d399" lineWidth={1.5} dashed dashSize={0.15} gapSize={0.1} />}
            <group position={sat} scale={0.28}><SpacecraftModel /></group>
          </>
        ) : (
          <>
            <PlanetModel kind="earth" radius={1} position={[-3.6, 0, 0]} />
            <PlanetModel kind="moon" radius={0.38} position={[3.6, 0, 0]} />
            <Line points={Array.from({ length: 40 }, (_, i) => { const t = i / 39; return [-3 + 6 * t, 0.5 * Math.sin(t * Math.PI), 0] as [number, number, number]; })} color="#6f86a8" lineWidth={1} dashed dashSize={0.15} gapSize={0.12} />
            <group position={sat} scale={0.3}><SpacecraftModel /></group>
          </>
        )}
      </Scene3D>
      <p className="pointer-events-none absolute inset-x-0 bottom-1 text-center text-[11px] text-ink2">{status}</p>
      {science && <p className="pointer-events-none absolute left-2 top-1 text-[11px] text-gold">☀ Sun ←</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ screen */
export function MissionControl() {
  const stage = useOps((o) => o.stage);
  return stage === "briefing" ? <Briefing /> : stage === "running" ? <Running /> : <ReportView />;
}

function Briefing() {
  const ev = useEvaluation();
  const { patch, quickStart } = useDesignStore();
  const begin = useOps((o) => o.begin);
  const { beginMission, resumeMission } = useOps();
  const record = useMission((m) => m.record), clearMission = useMission((m) => m.clear);
  const isMoon = ev.design.destinationId === "moon";
  const bad = ev.checks.filter((c) => c.state === "bad");
  return (
    <ScreenContainer title="Mission Control" subtitle="Brief → design → launch → fly the mission → report" actions={<BackButton href="/menu" label="Main menu" />}>
      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <GlassPanel active className="space-y-4 p-5">
          <p className="hud-label !text-orange">Contract</p>
          <h2 className="font-display text-3xl font-bold uppercase">{CONTRACT.name}</h2>
          <p className="text-ink2">{CONTRACT.text}</p>
          <div>
            <p className="hud-label mb-1">Mandatory</p>
            <ul className="space-y-1 text-sm">
              <li>▸ Reach lunar orbit</li><li>▸ Carry a magnetometer (a “fields” instrument)</li>
              <li>▸ Survey ≥ {OPS.goalCoverage * 100} % of the surface in {OPS.scienceDays} days</li><li>▸ Return ≥ {OPS.goalDataGb} GB of useful data</li>
            </ul>
          </div>
          <div>
            <p className="hud-label mb-1">Bonus</p>
            <ul className="space-y-1 text-sm text-ink2"><li>▸ Return ≥ {OPS.stretchDataGb} GB</li><li>▸ Finish with ≥ 60 % spacecraft health</li><li>▸ Observe the unexpected anomaly</li></ul>
          </div>
          <p className="text-xs text-muted">Budget ${fmt(ev.destination.budgetUsd / 1e6)}M · Simplified, game-balanced operations model (not NASA-certified). Launch price, Δv and instruments come from the dataset.</p>
        </GlassPanel>
        <div className="space-y-4">
          {record && <SavedMission record={record} onTakeOver={() => beginMission(record)} onResume={() => resumeMission(record)} onClear={clearMission} />}
          <GlassPanel className="p-5">
            <p className="hud-label">{record ? "Design in the Architect (not the saved mission)" : "Your spacecraft"}</p>
            {!isMoon && <p className="mt-2 text-sm text-warn">This slice flies the Moon orbiter. Mars arrives next.</p>}
            <p className="mt-2 text-sm text-ink2">{ev.vehicle.name} · {ev.design.propulsionId === "chem" ? "chemical" : ev.electric?.name} · {ev.antenna.name} · {ev.instruments.length} instrument{ev.instruments.length === 1 ? "" : "s"}{ev.instruments.length ? `: ${ev.instruments.map((i) => i.name).join(", ")}` : ""}</p>
            <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
              <div className="rounded-md bg-white/5 p-2"><dt className="text-muted">Δv</dt><dd className="font-display text-base tabular-nums">{fmt(ev.dvAvailable)} m/s</dd></div>
              <div className="rounded-md bg-white/5 p-2"><dt className="text-muted">Downlink</dt><dd className="font-display text-base tabular-nums">{fmt(downlinkMbps(ev), 1)} Mbps</dd></div>
              <div className="rounded-md bg-white/5 p-2"><dt className="text-muted">Launch odds</dt><dd className="font-display text-base tabular-nums">{fmt(ev.probabilities.launch * 100)} %</dd></div>
            </dl>
            {bad.length > 0 && (
              <ul className="mt-3 space-y-1 text-xs text-bad" role="status">{bad.map((c) => <li key={c.id}><b>{c.label}:</b> {c.detail}</li>)}</ul>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              {!isMoon && <GameButton variant="outline" onClick={() => patch({ destinationId: "moon" })}>Switch to Moon</GameButton>}
              <GameButton variant="outline" icon={<Wand2 className="size-4" />} onClick={() => quickStart("moon")}>Use recommended design</GameButton>
              <Link href="/design" className="inline-flex items-center rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-ink2 hover:text-ink">Edit in Mission Architect</Link>
            </div>
          </GlassPanel>
          <GameButton variant={record?.stage === "operating" ? "outline" : "primary"} className="w-full py-4 text-lg" icon={<Rocket className="size-5" />} disabled={!ev.goNoGo || !isMoon} onClick={() => begin(ev)}>
            {ev.goNoGo && isMoon ? "Practice run (simulated launch)" : "Fix the design to launch"}
          </GameButton>
          <p className="text-xs text-muted">A practice run rolls the launch and transfer with dice. For the real thing, fly the ascent and lunar capture in the Mission Architect: operations then start from the lunar orbit you reached.</p>
        </div>
      </div>
    </ScreenContainer>
  );
}

const STAGES: ["ascent" | "transit" | "operating" | "complete", string][] = [["ascent", "Launch"], ["transit", "Transfer"], ["operating", "Operations"], ["complete", "Report"]];
function SavedMission({ record, onTakeOver, onResume, onClear }: { record: MissionRecord; onTakeOver: () => void; onResume: () => void; onClear: () => void }) {
  const idx = STAGES.findIndex(([k]) => k === record.stage), lost = record.stage === "lost";
  return (
    <GlassPanel active className="p-5" aria-label="Saved mission">
      <p className="hud-label !text-orange">Saved mission {record.id}</p>
      <p className="mt-1 font-display text-xl font-bold">{stageLabel[record.stage]}</p>
      <ol className="mt-3 flex gap-1" aria-label="Mission progress">{STAGES.map(([k, label], i) => <li key={k} className={cn("flex-1 rounded-md px-2 py-1 text-center text-[11px]", lost ? "bg-white/5 text-muted" : i < idx || record.stage === "complete" ? "bg-ok/15 text-ok" : i === idx ? "bg-orange/20 text-orange" : "bg-white/5 text-muted")}>{label}</li>)}</ol>
      {record.ascent && <p className="mt-2 text-xs text-ink2">Launch: {record.ascent.rocket}, {record.ascent.difficulty}, grade {record.ascent.grade} ({record.ascent.score}). {record.transit ? `Transfer ${fmt(record.transit.transferDays, 1)} days; departure burn by the ${record.transit.departureBy}.` : ""}</p>}
      {lost && <p className="mt-2 text-sm text-bad">{record.lostReason}</p>}
      {record.stage === "complete" && record.summary && <p className="mt-2 text-sm text-ink2">Final: {record.summary.headline} Grade {record.summary.grade}, score {record.summary.total}.</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        {record.stage === "operating" && (record.ops ? <><GameButton variant="primary" onClick={onResume}>Resume operations</GameButton><GameButton variant="outline" onClick={onTakeOver}>Restart from lunar orbit</GameButton></> : <GameButton variant="primary" onClick={onTakeOver}>Take over operations</GameButton>)}
        {record.stage === "complete" && record.ops && <GameButton variant="primary" onClick={onResume}>View the report</GameButton>}
        {(lost || record.stage === "complete") && <Link href="/design" onClick={onClear} className="inline-flex items-center rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-ink2 hover:text-ink">Start a new mission</Link>}
        {record.stage === "ascent" && <Link href="/design" className="inline-flex items-center rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-ink2 hover:text-ink">Back to the Architect</Link>}
      </div>
    </GlassPanel>
  );
}

function Running() {
  const { s, ev, speed, setSpeed, tick } = useOps();
  const [tab, setTab] = useState<"status" | "orbit" | "ops">("status");
  useEffect(() => {
    const id = setInterval(() => tick(0.1), 100);
    return () => clearInterval(id);
  }, [tick]);
  if (!s || !ev) return null;
  const phaseIdx = PHASES.findIndex((p) => p.id === s.phase);
  return (
    <main className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-3 p-3">
      <header className="flex flex-wrap items-center gap-3 rounded-lg border border-[var(--border)] bg-panel px-3 py-2">
        <ol className="flex items-center gap-1" aria-label="Mission phase">
          {PHASES.map((p, i) => (
            <li key={p.id} aria-current={i === phaseIdx ? "step" : undefined} className={cn("rounded-sm border px-2 py-1 font-display text-xs uppercase tracking-wider", i === phaseIdx ? "border-orange text-orange" : i < phaseIdx ? "border-ok/40 text-ok" : "border-white/10 text-muted")}>{i < phaseIdx ? "✓ " : ""}{p.label}</li>
          ))}
        </ol>
        <p className="font-display text-lg tabular-nums tracking-wider" aria-label="Mission elapsed time">{fmtMet(s.t)}</p>
        {s.phase === "cruise" && <p className="text-xs text-cyan">Cruise auto-warp ×{OPS.cruiseWarp}</p>}
        {s.phase === "science" && <p className="text-xs text-ink2">Science day {Math.min(OPS.scienceDays, Math.floor((s.t - s.sciT0) / 86400) + 1)} / {OPS.scienceDays}</p>}
        <div className="ml-auto flex items-center gap-1" role="group" aria-label="Time controls">
          {OPS.speeds.map((v) => (
            <button key={v} type="button" aria-pressed={speed === v} onClick={() => setSpeed(v as Speed)} aria-label={v === 0 ? "Pause" : `${v}× speed`}
              className={cn("grid h-9 min-w-9 place-items-center rounded-md border px-2 text-sm", speed === v ? "border-orange text-orange" : "border-[var(--border)] text-ink2 hover:text-ink")}>
              {v === 0 ? <Pause className="size-4" /> : v === 1 ? <Play className="size-4" /> : `${v}×`}
            </button>
          ))}
        </div>
      </header>
      <div role="tablist" aria-label="Mission Control sections" className="flex gap-2 lg:hidden">
        {([["status", "Status"], ["orbit", "Orbit"], ["ops", "Commands"]] as const).map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={cn("flex-1 rounded-md border px-3 py-1.5 text-sm", tab === id ? "border-orange text-orange" : "border-white/15 text-ink2")}>{label}</button>
        ))}
      </div>
      <div className="grid flex-1 gap-3 lg:grid-cols-[300px_1fr_340px]">
        <div className={cn("space-y-3", tab !== "status" && "hidden lg:block")}><LeftColumn s={s} ev={ev} /></div>
        <div className={cn("space-y-3", tab !== "orbit" && "hidden lg:block")}><Center s={s} ev={ev} /></div>
        <div className={cn("space-y-3", tab !== "ops" && "hidden lg:block")}><Commands s={s} ev={ev} /></div>
      </div>
      <EventDialog />
    </main>
  );
}

function LeftColumn({ s, ev }: { s: OpsState; ev: Evaluation }) {
  const select = useOps((o) => o.select);
  const list = alerts(s, ev);
  const health: [string, number][] = [["Power system", s.health.power], ["Comms", s.health.comms], ["Instruments", s.health.instruments], ["Propulsion", s.health.propulsion]];
  const inOrbit = s.phase === "science";
  return (
    <>
      <GlassPanel className="p-3">
        <p className="hud-label mb-2">Objectives</p>
        <ul className="space-y-2 text-sm">
          <li className="flex items-center gap-2">{inOrbit ? <CheckCircle2 className="size-4 text-ok" aria-hidden /> : <Gauge className="size-4 text-muted" aria-hidden />}Reach lunar orbit<span className="ml-auto text-xs text-muted">{inOrbit ? "done" : "pending"}</span></li>
          <li><div className="flex justify-between"><span>Surface coverage</span><span className="tabular-nums">{fmt(s.coverage * 100)} % / {OPS.goalCoverage * 100} %</span></div><Bar frac={s.coverage / OPS.goalCoverage} level={s.coverage >= OPS.goalCoverage ? "ok" : "warn"} label="Coverage" /></li>
          <li><div className="flex justify-between"><span>Useful data returned</span><span className="tabular-nums">{fmt(s.stats.usefulReturnedGb, 1)} / {OPS.goalDataGb} GB</span></div><Bar frac={s.stats.usefulReturnedGb / OPS.goalDataGb} level={s.stats.usefulReturnedGb >= OPS.goalDataGb ? "ok" : "warn"} label="Data returned" /></li>
        </ul>
      </GlassPanel>
      <GlassPanel className="p-3">
        <p className="hud-label mb-2">Spacecraft health</p>
        <ul className="space-y-2 text-sm">
          {health.map(([k, v]) => { const lvl: Level = v < 0.35 ? "crit" : v < 0.7 ? "warn" : "ok"; return (
            <li key={k}><div className="flex items-center justify-between"><span>{k}</span><Pill level={lvl}>{fmt(v * 100)} %</Pill></div><Bar frac={v} level={lvl} label={k} /></li>
          ); })}
        </ul>
      </GlassPanel>
      <GlassPanel className="p-3" aria-label="Alerts">
        <p className="hud-label mb-2">Alerts</p>
        {list.length === 0 ? <p className="flex items-center gap-2 text-sm text-ok"><CheckCircle2 className="size-4" aria-hidden />All systems nominal.</p> : (
          <ul className="max-h-52 space-y-2 overflow-y-auto">{list.map((a) => (
            <li key={a.id}><button type="button" onClick={() => select(a.resource)} className={cn("w-full rounded-md border p-2 text-left text-xs", LEVEL_COLOR[a.level])}>
              <span className="mr-1 font-display uppercase">{LEVEL_TEXT[a.level]}:</span><span className="text-ink">{a.text}</span></button></li>
          ))}</ul>
        )}
      </GlassPanel>
    </>
  );
}

function Center({ s, ev }: { s: OpsState; ev: Evaluation }) {
  const { selected, select } = useOps();
  const list = useMemo(() => resources(s, ev), [s, ev]);
  const sel = list.find((r) => r.id === selected) ?? list[0];
  return (
    <>
      <GlassPanel className="h-[250px] p-2"><OrbitView s={s} ev={ev} /></GlassPanel>
      <div className="grid grid-cols-2 gap-2 xl:grid-cols-3">
        {list.map((r) => (
          <button key={r.id} type="button" aria-pressed={sel.id === r.id} onClick={() => select(r.id)}
            className={cn("rounded-lg border bg-panel p-3 text-left transition", sel.id === r.id ? "border-orange" : "border-[var(--border)] hover:border-[var(--border-strong)]")}>
            <div className="flex items-center justify-between gap-2"><span className="flex items-center gap-1.5 text-sm font-semibold"><r.icon className="size-4 text-ink2" aria-hidden />{r.label}</span><Pill level={r.level}>{LEVEL_TEXT[r.level]}</Pill></div>
            <p className="mt-1 font-display text-xl tabular-nums">{r.value}</p>
            <p className="text-xs text-muted">{r.sub}</p>
            <Bar frac={r.frac} level={r.level} label={r.label} />
          </button>
        ))}
      </div>
      <GlassPanel className="p-3"><p className="hud-label">{sel.label}: what is driving it?</p><p className="mt-1 text-sm text-ink2">{sel.explain}</p></GlassPanel>
    </>
  );
}

const WHEN = [["Now", 0], ["+1 h", 3600], ["+3 h", 10800], ["+6 h", 21600], ["+12 h", 43200], ["+24 h", 86400]] as const;
const KINDS: Command["kind"][] = ["point-moon", "point-earth", "point-sun", "science-on", "science-off", "burn", "safe-mode", "resume"];

function Commands({ s, ev }: { s: OpsState; ev: Evaluation }) {
  const { command, cancel, assist } = useOps();
  const [kind, setKind] = useState<Command["kind"]>("point-moon");
  const [when, setWhen] = useState<number>(0);
  const [dv, setDv] = useState(10);
  const quick = (items: [Command["kind"], number?][]) => items.forEach(([k, a]) => command(k, 0, a));
  void ev;
  return (
    <>
      <GlassPanel className="space-y-3 p-3">
        <p className="hud-label">Quick actions</p>
        <div className="grid grid-cols-2 gap-2">
          <GameButton variant="outline" onClick={() => quick([["point-moon"], ["science-on"]])}>Observe</GameButton>
          <GameButton variant="outline" onClick={() => quick([["point-earth"], ["science-off"]])}>Downlink</GameButton>
          <GameButton variant="outline" onClick={() => quick([["point-sun"], ["science-off"]])}>Charge</GameButton>
          <GameButton variant="outline" onClick={() => quick([[s.safe ? "resume" : "safe-mode"]])}>{s.safe ? "Resume" : "Safe mode"}</GameButton>
        </div>
        <GameButton variant="primary" icon={<Wand2 className="size-4" />} onClick={assist} disabled={s.phase !== "science"}>Auto-plan next 24 h</GameButton>
        <p className="text-xs text-muted">Observing needs the Moon in view; downlink needs Earth in view during a ground pass.</p>
      </GlassPanel>
      <GlassPanel className="space-y-2 p-3">
        <p className="hud-label">Command queue</p>
        <div className="flex flex-wrap gap-2">
          <select aria-label="Command" value={kind} onChange={(e) => setKind(e.target.value as Command["kind"])} className="min-w-0 flex-1 px-2 py-1.5 text-sm">
            {KINDS.map((k) => <option key={k} value={k}>{CMD_LABEL[k]}</option>)}
          </select>
          <select aria-label="When" value={when} onChange={(e) => setWhen(Number(e.target.value))} className="px-2 py-1.5 text-sm">{WHEN.map(([l, v]) => <option key={l} value={v}>{l}</option>)}</select>
          {kind === "burn" && <input aria-label="Δv in m/s" type="number" min={1} max={200} value={dv} onChange={(e) => setDv(Number(e.target.value))} className="w-20 px-2 py-1.5 text-sm" />}
          <GameButton variant="secondary" onClick={() => command(kind, when, kind === "burn" ? dv : undefined)}>Add</GameButton>
        </div>
        <ul className="max-h-40 space-y-1 overflow-auto text-xs" aria-label="Queued commands">
          {s.queue.length === 0 && <li className="text-muted">Nothing scheduled.</li>}
          {s.queue.slice(0, 20).map((c) => (
            <li key={c.id} className="flex items-center gap-2 rounded bg-white/5 px-2 py-1"><span className="tabular-nums text-muted">{fmtMet(c.at)}</span><span className="flex-1">{CMD_LABEL[c.kind]}{c.arg ? ` ${c.arg} m/s` : ""}</span>
              <button type="button" aria-label={`Cancel ${CMD_LABEL[c.kind]}`} onClick={() => cancel(c.id)} className="text-muted hover:text-bad"><X className="size-3.5" /></button></li>
          ))}
        </ul>
      </GlassPanel>
      <GlassPanel className="p-3" aria-label="Event log">
        <p className="hud-label mb-1">Log</p>
        <ul className="max-h-56 space-y-1 overflow-auto text-xs" aria-live="polite">
          {[...s.log].reverse().slice(0, 40).map((l, i) => (
            <li key={`${l.t}-${i}`} className={cn(l.level === "crit" ? "text-bad" : l.level === "warn" ? "text-warn" : l.level === "good" ? "text-ok" : "text-ink2")}><span className="tabular-nums text-muted">{fmtMet(l.t)}</span> {l.text}</li>
          ))}
        </ul>
      </GlassPanel>
    </>
  );
}

function EventDialog() {
  const { s, ev, choose } = useOps();
  if (!s || !ev || !s.event) return null;
  const def = eventById(s.event.id);
  if (!def) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-labelledby="ev-title">
      <GlassPanel active className="max-h-[90vh] w-full max-w-xl space-y-3 overflow-auto p-5">
        <p className="hud-label !text-warn">Event · {fmtMet(s.t)} · time paused</p>
        <h2 id="ev-title" className="font-display text-2xl font-bold uppercase">{def.title}</h2>
        <p className="text-ink2">{def.description(s, ev)}</p>
        <p className="rounded-md bg-white/5 p-2 text-xs text-muted"><b>Why it matters:</b> {def.learn}</p>
        <ul className="space-y-2">
          {def.choices.map((c, i) => { const why = c.unavailable?.(s, ev) ?? null; return (
            <li key={c.id}>
              <button type="button" autoFocus={i === 0} disabled={!!why} onClick={() => choose(c.id)}
                className={cn("w-full rounded-lg border p-3 text-left transition", why ? "border-white/10 opacity-50" : "border-[var(--border)] bg-panel hover:border-orange")}>
                <span className="font-display text-lg font-bold uppercase">{c.label}</span>
                <span className="block text-xs text-ink2">{why ?? c.hint}</span>
              </button>
            </li>
          ); })}
        </ul>
      </GlassPanel>
    </div>
  );
}

function ReportView() {
  const { report, s, ev, reset, begin, beginMission, attempt } = useOps();
  const record = useMission((m) => m.record), clearMission = useMission((m) => m.clear);
  const { field, tiles } = useLunarField();
  const obs = useMemo(() => (field && s && s.targets.length ? observationOf(field, s.targets, s.targetProgress, s.stats.generatedGb > 0 ? s.stats.returnedGb / s.stats.generatedGb : 0) : null), [field, s]);
  if (!report || !s || !ev) return null;
  const learn = buildLearning(field, obs, s, ev);
  const color = report.outcome === "success" ? "text-ok" : report.outcome === "partial" ? "text-warn" : "text-bad";
  return (
    <ScreenContainer title="Mission report" subtitle={`${CONTRACT.name} · ${fmtMet(s.t)}`} actions={<BackButton href="/menu" label="Main menu" />}>
      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <div className="space-y-4">
          {record?.ascent && (
            <GlassPanel className="p-5" aria-label="Mission record">
              <p className="hud-label">Mission record {record.id}</p>
              <ol className="mt-2 space-y-1 text-sm text-ink2">
                <li>✓ Design: {record.design.destinationId}, {ev.vehicle.name}, {ev.instruments.length} instrument{ev.instruments.length === 1 ? "" : "s"}</li>
                <li>{record.ascent.ok ? "✓" : "✕"} Launch: {record.ascent.rocket}, {record.ascent.difficulty}, grade {record.ascent.grade} ({record.ascent.score})</li>
                {record.transit && <li>{record.transit.cruiseOk && record.transit.insertionOk ? "✓" : "✕"} Transfer and lunar capture: {fmt(record.transit.transferDays, 1)} days, departure burn by the {record.transit.departureBy}</li>}
                <li>{report.outcome === "failure" ? "✕" : "✓"} Operations: {fmtMet(s.t)} flown. {report.headline}</li>
              </ol>
            </GlassPanel>
          )}
          <GlassPanel active className="p-5">
            <p className={cn("font-display text-3xl font-bold uppercase", color)}>{report.outcome === "success" ? "Success" : report.outcome === "partial" ? "Partial success" : "Mission failed"}</p>
            <p className="mt-2 text-lg">{report.headline}</p>
            <div className="mt-4 flex items-end gap-8">
              <div><p className="hud-label">Score</p><p className="font-display text-6xl font-bold leading-none text-orange tabular-nums">{report.total}</p></div>
              <div><p className="hud-label">Grade</p><p className="font-display text-6xl font-bold leading-none">{report.grade}</p></div>
              <p className="text-sm text-gold">+{report.xp} XP (mock)</p>
            </div>
          </GlassPanel>
          <GlassPanel className="p-5"><p className="hud-label mb-2">Objectives</p>
            <ul className="space-y-2 text-sm">{report.objectives.map((o) => (
              <li key={o.id} className="flex gap-2">{o.met ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-ok" aria-label="Met" /> : <Octagon className="mt-0.5 size-4 shrink-0 text-bad" aria-label="Not met" />}
                <span><b>{o.label}</b>{!o.required && <span className="ml-1 text-xs text-muted">(bonus)</span>}<span className="block text-xs text-ink2">{o.detail}</span></span></li>
            ))}</ul></GlassPanel>
        </div>
        <div className="space-y-4">
          <GlassPanel className="p-5"><p className="hud-label mb-2">Scorecard — cause and effect</p>
            <ul className="space-y-3">{report.categories.map((c) => { const lvl: Level = c.score < 40 ? "crit" : c.score < 70 ? "warn" : "ok"; return (
              <li key={c.id}><div className="flex justify-between text-sm"><span>{c.label}</span><span className="tabular-nums">{c.score}</span></div><Bar frac={c.score / 100} level={lvl} label={c.label} /><p className="mt-0.5 text-xs text-ink2">{c.why}</p></li>
            ); })}</ul></GlassPanel>
          {field && obs && (
            <GlassPanel className="p-5" aria-label="Survey result">
              <p className="hud-label mb-2">Your survey, on the real map</p>
              <SurveyMap field={field} tiles={tiles} selected={s.targets} revealed={obs.returned} observed={obs.observed} />
              <p className="mt-2 text-xs text-ink2">Colour = the archived Lunar Prospector field in cells whose data reached Earth. Amber = observed but never downlinked. Grey = not observed. Everything outside your regions is dimmed.</p>
            </GlassPanel>
          )}
          <GlassPanel className="p-5" aria-label="What we learned">
            <p className="hud-label mb-2">What we can learn from this</p>
            <h3 className="font-display text-lg font-bold">What your data shows</h3>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-ink2">{learn.found.map((l) => <li key={l}>{l}</li>)}</ul>
            <h3 className="mt-3 font-display text-lg font-bold">What your design choices did</h3>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-ink2">{learn.design.map((l) => <li key={l}>{l}</li>)}</ul>
            <h3 className="mt-3 font-display text-lg font-bold">Key ideas</h3>
            <dl className="mt-1 space-y-2 text-sm">{learn.ideas.map((i) => <div key={i.term}><dt className="font-semibold text-ink">{i.term}</dt><dd className="text-ink2">{i.text}</dd></div>)}</dl>
            <p className="mt-3 text-[11px] text-muted">{learn.caveat}</p>
          </GlassPanel>
          <GlassPanel className="p-5"><p className="hud-label mb-2">What to try next</p><ul className="list-disc space-y-1 pl-5 text-sm text-ink2">{report.lessons.map((l) => <li key={l}>{l}</li>)}</ul></GlassPanel>
          <div className="flex flex-wrap gap-2">
            <GameButton variant="primary" onClick={() => (record?.ascent ? beginMission(record, true) : begin(ev, attempt + 1))}>{record?.ascent ? "Fly operations again (new dice)" : "Fly again (new dice)"}</GameButton>
            <GameButton variant="outline" onClick={reset}>Back to briefing</GameButton>
            <Link href="/design" onClick={clearMission} className="inline-flex items-center rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-ink2 hover:text-ink">{record?.ascent ? "Start a new mission" : "Redesign spacecraft"}</Link>
          </div>
        </div>
      </div>
    </ScreenContainer>
  );
}
