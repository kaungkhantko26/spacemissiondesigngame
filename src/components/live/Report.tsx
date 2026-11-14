"use client";
/** Live mission report: replays the flight on the trajectory sim, then shows the score, XP and what the team should learn. */
import { useCallback, useMemo, useState } from "react";
import { Pencil } from "lucide-react";
import { useGame } from "@/live/store";
import { GameButton, GlassPanel } from "@/components/ui";
import { TrajectorySim } from "@/components/game/TrajectorySim";
import { buildTrajectory } from "@/game/trajectory";
import { destinationById } from "@/game/data";
import { cn } from "@/lib/mission";
import { OUTCOME_LABEL } from "@/live/format";

const swallow = (p: Promise<unknown>) => { p.catch(() => {}); };
const fmt = (n: number, d = 0) => n.toLocaleString("en-US", { maximumFractionDigits: d });

export function Report() {
  const g = useGame(); const { room, catalog: cat, profile } = g;
  const r = room?.result;
  const dest = r ? destinationById(r.design.destinationId) : undefined;
  const failIndex = (() => { const i = r?.phases.findIndex((p) => !p.passed) ?? -1; return i === -1 ? null : (i as 0 | 1 | 2 | 3); })();
  const traj = useMemo(() => (dest ? buildTrajectory(dest, failIndex) : null), [dest, failIndex]);
  const [u, setU] = useState(0); const [seenEnd, setSeenEnd] = useState(false);
  const onUpdate = useCallback((nu: number, done: boolean) => { setU(nu); if (done) setSeenEnd(true); }, []);
  if (!room || !r || !cat || !profile || !dest || !traj) return null;
  const mine = r.awards[profile.id]; const host = room.hostId === profile.id;
  const item = (id: string) => cat.cosmetics.items.find((i) => i.id === id)?.name ?? id;
  const revealed = r.phases.filter((_, i) => seenEnd || u >= traj.reveal[i] - 1e-6);
  const mission = cat.missions.find((m) => m.id === room.missionId);
  const vehicle = cat.design.dataset.vehicles.find((v) => v.id === r.design.vehicleId)?.name;

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink2">{mission?.name} · {vehicle} · {r.design.propulsionId === "chem" ? "chemical engine" : cat.design.dataset.electric_propulsion.find((e) => e.id === r.design.propulsionId)?.name} · attempt {r.attempt}</p>
      <div className="grid gap-4 xl:grid-cols-[minmax(320px,440px)_1fr]">
        <div className="space-y-4">
          <GlassPanel className="p-5">
            <ol className="space-y-3" aria-live="polite">
              {revealed.map((ph) => (
                <li key={ph.id} className="enter flex gap-3">
                  <span aria-hidden className={cn("mt-0.5 grid size-6 shrink-0 place-items-center rounded-sm border text-sm", ph.passed ? "border-ok text-ok" : "border-bad text-bad")}>{ph.passed ? "✓" : "✕"}</span>
                  <div><p className="font-display text-lg uppercase tracking-wider">{ph.label}</p><p className="text-sm text-ink2">{ph.story}</p><p className="text-xs text-muted">Odds were {fmt(ph.probability * 100, 1)} %</p></div>
                </li>))}
              {!seenEnd && <li className="text-sm text-muted">Tracking spacecraft…</li>}
            </ol>
            {seenEnd && (
              <div className="enter mt-5 border-t border-[var(--border)] pt-4">
                <p className="text-lg">{r.summary}</p>
                <div className="mt-3 flex items-end gap-6">
                  <div><p className="hud-label">Score</p><p className="font-display text-6xl font-bold leading-none text-orange tabular-nums">{r.score}</p></div>
                  <div><p className="hud-label">Grade</p><p className="font-display text-6xl font-bold leading-none">{r.grade}</p></div>
                  <div><p className="hud-label">Result</p><p className="font-display text-xl font-bold leading-none">{OUTCOME_LABEL[r.outcome]}</p></div>
                </div>
                {mine && <p className="mt-3 text-orange">+{mine.xp} XP → {mine.totalXp} ({mine.rank}){mine.newCosmetics.length > 0 && ` · Unlocked: ${mine.newCosmetics.map(item).join(", ")}`}</p>}
              </div>)}
          </GlassPanel>
          {seenEnd && <div className="enter flex flex-wrap gap-2">
            {host && <GameButton variant="primary" icon={<Pencil className="size-4" />} onClick={() => swallow(g.redesign())}>Redesign &amp; retry</GameButton>}
            {host && <GameButton onClick={() => swallow(g.toLobby())}>New mission</GameButton>}
            <GameButton variant="ghost" onClick={() => swallow(g.leaveRoom())}>Leave room</GameButton>
          </div>}
        </div>
        <GlassPanel className="min-h-[520px] overflow-hidden p-0">
          <TrajectorySim key={`${room.code}-${r.attempt}-${r.score}`} traj={traj} onUpdate={onUpdate} startAtEnd={seenEnd} awaitLaunch className="h-full min-h-[520px]" />
        </GlassPanel>
      </div>

      {seenEnd && (
        <div className="enter grid gap-4 lg:grid-cols-2">
          <GlassPanel className="p-4"><h3 className="font-display text-lg font-bold uppercase tracking-wide">Objectives</h3>
            <ul className="mt-2 space-y-1.5">{r.objectives.map((o) => (
              <li key={o.id} className="text-sm"><span className={o.met ? "text-ok" : "text-bad"}>{o.met ? "✔" : "✕"}</span> {o.label}{o.required && " *"}
                {o.value != null && <span className="text-xs text-muted"> · {String(o.value)} (target {o.target})</span>}
                {!o.met && <p className="ml-5 text-xs text-ink2">{o.why}</p>}</li>))}</ul>
            <p className="mt-2 text-xs text-muted">* required for a full success</p></GlassPanel>
          <GlassPanel className="p-4"><h3 className="font-display text-lg font-bold uppercase tracking-wide">What to learn</h3>
            {r.lessons.length === 0 ? <p className="mt-2 text-sm text-ink2">A clean flight. Try Hard mode, or a cheaper design.</p> :
              <ul className="mt-2 space-y-1.5">{r.lessons.map((l, i) => <li key={i} className="text-sm"><b className={l.status === "fail" ? "text-bad" : "text-warn"}>{l.title}</b> <span className="text-ink2">{l.why}</span></li>)}</ul>}</GlassPanel>
          {r.realInstruments.length > 0 && <GlassPanel className="p-4"><h3 className="font-display text-lg font-bold uppercase tracking-wide">Real NASA instruments you flew</h3>
            <ul className="mt-2 space-y-1 text-sm text-ink2">{r.realInstruments.map((i) => <li key={i.name}><b className="text-ink">{i.name}</b> · from {i.mission}</li>)}</ul></GlassPanel>}
          {r.challenges && <GlassPanel className="p-4"><h3 className="font-display text-lg font-bold uppercase tracking-wide text-gold">Time-attack {r.challenges.count}/{r.challenges.total}{!r.challenges.onTime && " · too slow, no cosmetic"}</h3>
            {r.challenges.list.map((c) => <p key={c.id} className={cn("mt-1 text-sm", c.completed ? "text-ok" : "text-ink2")}>{c.completed ? "✔" : "○"} {c.name}</p>)}</GlassPanel>}
        </div>)}
    </div>
  );
}
