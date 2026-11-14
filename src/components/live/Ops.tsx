"use client";
import { useEffect, useState } from "react";
import { useGame } from "@/live/store";
import { GameButton, GlassPanel } from "@/components/ui";
import { fmtMoney } from "@/live/format";
import { OpsScene } from "./OpsScene";
import type { RoleId } from "@/live/types";

const swallow = (p: Promise<unknown>) => { p.catch(() => {}); };
const KIND: Record<string, string> = { good: "text-ok", bad: "text-bad", alert: "text-orange", decision: "text-cyan", info: "text-ink2" };

function Gauge({ label, value, good, note }: { label: string; value: number; good: "high" | "low"; note?: string }) {
  const bad = good === "high" ? value < 25 : value > 85; const warn = good === "high" ? value < 50 : value > 65;
  const color = bad ? "bg-bad" : warn ? "bg-gold" : "bg-ok";
  return (
    <div>
      <div className="flex justify-between text-xs"><span>{label}</span><span>{value}%</span></div>
      <div className="mt-1 h-3 overflow-hidden rounded bg-white/10"><div className={`h-full transition-all duration-500 ${color}`} style={{ width: `${value}%` }} /></div>
      {note && <p className="mt-0.5 text-[10px] text-muted">{note}</p>}
    </div>
  );
}

export function Ops() {
  const g = useGame(); const { room, catalog: cat, profile, roomAt } = g;
  const [tick, setTick] = useState(0);
  useEffect(() => { const t = setInterval(() => setTick((x) => x + 1), 250); return () => clearInterval(t); }, []);
  const op = room?.ops;
  if (!room || !op || !cat || !profile) return null;
  void tick;
  const mine = room.slots.find((s) => s.playerId === profile.id)?.role as RoleId | undefined;
  const can = (owner: RoleId) => !!mine && (mine === "lead" || mine === owner) || room.slots.filter((s) => s.role === owner).every((s) => !s.playerId);
  const roleName = (r: RoleId) => cat.roles.find((x) => x.id === r)?.label ?? r;
  const inc = op.incident;
  const incLeft = inc ? Math.max(0, Math.round((inc.deadline - inc.serverNow - (Date.now() - roomAt)) / 1000)) : 0;
  const pct = Math.round((op.tick / op.ticks) * 100);
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <div className="space-y-3">
        <GlassPanel className="p-4">
          <div className="flex justify-between text-sm"><b>Month {op.month} / {op.totalMonths} · {op.decisions} decisions</b><span className="text-ink2">You are: {mine ? roleName(mine) : "observer"}{op.safeNow && " · SAFE MODE"}</span></div>
          <div className="mt-2 h-2 overflow-hidden rounded bg-white/10"><div className="h-full bg-cyan transition-all duration-500" style={{ width: `${pct}%` }} /></div>
        </GlassPanel>
        <OpsScene op={op} inc={inc} />
        <GlassPanel className="grid gap-4 p-4 sm:grid-cols-3">
          <Gauge label="Battery power" value={op.res.power} good="high" note="Low = brownout" />
          <Gauge label="Onboard memory" value={op.res.storage} good="low" note="Full = data thrown away" />
          <Gauge label="Hardware health" value={op.res.health} good="high" note="0 = spacecraft lost" />
        </GlassPanel>
        {inc && (
          <GlassPanel active className={`space-y-2 p-4 ${inc.positive ? "border-ok" : "border-orange"}`}>
            <div className="flex justify-between"><h2 className={`font-display text-xl font-bold ${inc.positive ? "text-ok" : "text-orange"}`}>{inc.positive ? "★" : "⚠"} {inc.label}</h2><span className="font-mono text-orange">{incLeft}s</span></div>
            <p className="text-sm">{inc.text}</p>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">{inc.options.map((o) => (
              <button key={o.id} onClick={() => swallow(g.opsRespond(o.id))} className="rounded-lg border border-white/15 p-2 text-left text-sm hover:border-orange">
                <b>{o.label}</b>{o.perk && <span className="ml-1 rounded bg-gold/20 px-1 text-[10px] text-gold">PERK</span>}<div className="text-xs text-ink2">{o.hint}</div>
                <div className="mt-1 text-[10px] text-muted">Suits: {roleName(o.role)}{o.cost > 0 && ` · costs ${fmtMoney(o.cost)}`}</div>
              </button>))}</div>
            <p className="text-xs text-muted">Discuss as a crew — no answer means the worst default happens.</p>
          </GlassPanel>)}
        <GlassPanel className="space-y-4 p-4">
          <h3 className="font-semibold">Controls</h3>
          <label className="block text-sm">Instrument duty {Math.round(op.ctl.duty * 100)}% <span className="text-xs text-muted">({roleName("science")})</span>
            <input type="range" min={0.1} max={1} step={0.05} disabled={!can("science")} value={op.ctl.duty} onChange={(e) => swallow(g.opsSet({ duty: Number(e.target.value) }))} className="mt-1 w-full accent-orange" /></label>
          <div className="flex flex-wrap gap-2">
            <GameButton variant={op.ctl.downlink === "boost" ? "primary" : "outline"} disabled={!can("comms")} onClick={() => swallow(g.opsSet({ downlink: op.ctl.downlink === "boost" ? "normal" : "boost" }))}>
              Downlink: {op.ctl.downlink === "boost" ? "BOOST (more data, more power)" : "normal"} · {roleName("comms")}</GameButton>
            <GameButton variant={op.ctl.mode === "safe" ? "danger" : "outline"} disabled={!can("engineer")} onClick={() => swallow(g.opsSet({ mode: op.ctl.mode === "safe" ? "nominal" : "safe" }))}>
              {op.ctl.mode === "safe" ? "Leave safe mode" : "Enter safe mode"} · {roleName("engineer")}</GameButton>
            <GameButton disabled={!can("engineer") || op.repairIn > 0} onClick={() => swallow(g.opsRepair())}>{op.repairIn > 0 ? `Repair crew busy (${op.repairIn})` : "Order repairs (+14 health)"}</GameButton>
          </div>
          <p className="text-xs text-muted">Contingency budget: {fmtMoney(op.res.budget)} of {fmtMoney(op.budget0)} — unspent design budget carries over, so thrifty designs have more to spend here.</p>
        </GlassPanel>
      </div>
      <GlassPanel className="max-h-[70vh] overflow-auto p-4">
        <h3 className="mb-1 font-semibold">Crew traits in play</h3>
        <ul className="mb-3 space-y-1 text-[11px]">{op.crew.map((c, i) => <li key={i} className={c.active ? "text-ink2" : "text-muted line-through"} title={c.desc}><b className="text-ink">{c.who}</b> — {c.trait} <span className="text-gold">({c.skillLabel})</span></li>)}</ul>
        <h3 className="mb-2 font-semibold">Mission log</h3>
        <ul className="space-y-1 text-xs">{[...op.log].reverse().map((l, i) => <li key={i} className={KIND[l.kind]}>M{Math.round(l.tick * (op.totalMonths / op.ticks))}: {l.text}</li>)}</ul>
        {room.hostId === profile.id && <GameButton variant="ghost" className="mt-3" onClick={() => swallow(g.toLobby())}>Abort mission</GameButton>}
      </GlassPanel>
    </div>
  );
}
