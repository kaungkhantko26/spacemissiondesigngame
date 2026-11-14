"use client";
import { useGame } from "@/live/store";
import { GameButton, GlassPanel } from "@/components/ui";
import { OUTCOME_LABEL } from "@/live/format";

const swallow = (p: Promise<unknown>) => { p.catch(() => {}); };

export function Report() {
  const g = useGame(); const { room, catalog: cat, profile } = g;
  const r = room?.result;
  if (!room || !r || !cat || !profile) return null;
  const mine = r.awards[profile.id]; const host = room.hostId === profile.id;
  const item = (id: string) => cat.cosmetics.items.find((i) => i.id === id)?.name ?? id;
  return (
    <div className="space-y-4">
      <GlassPanel className="p-6">
        <h1 className="text-3xl font-bold">{OUTCOME_LABEL[r.outcome]} — {r.score} ({r.grade})</h1>
        <p className="mt-2 text-sm">{r.summary}</p>
        {mine && <p className="mt-2 text-orange">+{mine.xp} XP → {mine.totalXp} ({mine.rank}){mine.newCosmetics.length > 0 && ` · Unlocked: ${mine.newCosmetics.map(item).join(", ")}`}</p>}
      </GlassPanel>
      {r.ops && <GlassPanel className="p-4"><h3 className="font-semibold">Operations</h3>
        <p className="text-xs text-ink2">{r.ops.lost ? "Spacecraft lost during operations. " : ""}Incidents handled {r.ops.handled}, missed {r.ops.missed}, brownouts {r.ops.brownouts}. Contingency left ${r.ops.budgetLeftM.toFixed(2)}M of ${r.ops.budget0.toFixed(2)}M.</p>
        <div className="mt-2 flex h-16 items-end gap-0.5" aria-label="Health over time">{r.ops.timeline.map((t) => <div key={t.t} className="flex-1 bg-cyan/70" style={{ height: `${t.health}%` }} title={`Month step ${t.t}: health ${t.health}%`} />)}</div></GlassPanel>}
      {r.challenges && <GlassPanel className="p-4"><h3 className="font-semibold">Time-attack: {r.challenges.count}/{r.challenges.total}{!r.challenges.onTime && " (too slow — no cosmetic)"}</h3>
        {r.challenges.list.map((c) => <div key={c.id} className={`text-xs ${c.completed ? "text-good" : "text-ink2"}`}>{c.completed ? "✔" : "○"} {c.name}</div>)}</GlassPanel>}
      <GlassPanel className="p-4"><h3 className="font-semibold">What happened</h3>
        {r.events.length === 0 && <p className="text-xs text-ink2">Quiet mission.</p>}
        {r.events.map((e, i) => <div key={i} className="mt-1 text-xs"><b>Month {e.month} — {e.label}:</b> {e.text} <i className="text-ink2">{e.tip}</i></div>)}</GlassPanel>
      <GlassPanel className="p-4"><h3 className="font-semibold">Lessons</h3>
        {r.lessons.map((l, i) => <div key={i} className="mt-1 text-xs"><b>{l.title}</b> — {l.why}</div>)}</GlassPanel>
      {r.matches.length > 0 && <GlassPanel className="p-4"><h3 className="font-semibold">Real satellites like yours</h3>
        {r.matches.map((m) => <div key={m.name} className="text-xs">{m.name} ({m.country}, {m.launchYear}) — {m.similarityPct}% similar</div>)}</GlassPanel>}
      <div className="flex gap-2">
        {host && <GameButton variant="primary" onClick={() => swallow(g.redesign())}>Redesign & retry</GameButton>}
        {host && <GameButton onClick={() => swallow(g.toLobby())}>New mission</GameButton>}
        <GameButton variant="ghost" onClick={() => swallow(g.leaveRoom())}>Leave room</GameButton>
      </div>
    </div>
  );
}
