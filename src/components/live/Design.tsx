"use client";
import { useEffect, useState } from "react";
import { useGame } from "@/live/store";
import { GameButton, GlassPanel } from "@/components/ui";
import { fmtMoney, mmss, secondsLeft } from "@/live/format";
import type { DesignPatch, Part, PartCategory } from "@/live/types";

const swallow = (p: Promise<unknown>) => { p.catch(() => {}); };
const COLOR: Record<string, string> = { pass: "text-good", warn: "text-warn", fail: "text-bad", block: "text-bad" };

function Sel({ label, field, value, options, owners, mine, onChange }: {
  label: string; field: string; value: string | null; options: { id: string; name: string; hint?: string }[];
  owners: string[]; mine?: string; onChange: (v: string) => void;
}) {
  const own = mine && owners.includes(mine);
  return (
    <label className="block text-xs">
      <span className="text-ink2">{label} <i>{owners.length ? (own ? "· yours" : `· ${owners.join("/")}`) : ""}</i></span>
      <select className="mt-1 w-full rounded border border-white/20 bg-[#0b1530] p-2 text-sm text-white [&>option]:bg-[#0b1530] [&>option]:text-white" value={value ?? ""} data-field={field} onChange={(e) => onChange(e.target.value)}>
        <option value="">—</option>
        {options.map((o) => <option key={o.id} value={o.id}>{o.name}{o.hint ? ` (${o.hint})` : ""}</option>)}
      </select>
    </label>
  );
}

export function Design() {
  const g = useGame(); const { room, catalog: cat, profile, roomAt } = g;
  const [tick, setTick] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setTick(Date.now()), 500); return () => clearInterval(t); }, []);
  if (!room || !cat || !profile || !room.design) return null;
  const d = room.design, pv = room.preview, me = profile.id;
  const myRole = room.slots.find((s) => s.playerId === me)?.role;
  const mission = cat.missions.find((m) => m.id === room.missionId)!;
  const own = (f: string) => room.fieldOwners[f] ?? [];
  const set = (p: DesignPatch) => swallow(g.setDesign(p));
  const parts = (c: PartCategory): Part[] => cat.parts.filter((p) => p.cat === c);
  const pl = (c: PartCategory) => parts(c).map((p) => ({ id: p.id, name: p.name, hint: `${p.massKg}kg · ${fmtMoney(p.costM)}` }));
  const left = secondsLeft(room.challenge, roomAt, tick);
  const approved = room.approvals.includes(me);
  const toggleInst = (id: string) => set({ instruments: d.instruments.includes(id) ? d.instruments.filter((x) => x !== id) : [...d.instruments, id] });
  const humans = room.members.length;
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
      <div className="space-y-3">
        <GlassPanel className="p-4">
          <h2 className="text-xl font-bold">{mission.name} · {room.difficulty} · attempt {room.attempt}</h2>
          <p className="text-xs text-ink2">You are: {myRole ? cat.roles.find((r) => r.id === myRole)?.label : "observer"} — you can edit any field, but your own role&apos;s fields are your specialty.</p>
          {left != null && room.challenge?.eligible && <p className="mt-1 text-orange">⏱ Time attack {mmss(left)} — finish all 5 challenges before it hits 0</p>}
        </GlassPanel>
        <GlassPanel className="grid gap-3 p-4 sm:grid-cols-2">
          <Sel label="Bus" field="bus" value={d.bus} owners={own("bus")} mine={myRole} onChange={(v) => set({ bus: v || null })}
            options={cat.buses.filter((b) => mission.allowed.buses.includes(b.id)).map((b) => ({ id: b.id, name: b.name, hint: `${b.dryKg}kg` }))} />
          <Sel label="Launch vehicle" field="launch.vehicle" value={d.launch.vehicle} owners={own("launch.vehicle")} mine={myRole} onChange={(v) => set({ "launch.vehicle": v || null })}
            options={cat.launchers.filter((l) => mission.allowed.launchers.includes(l.id)).map((l) => ({ id: l.id, name: l.name, hint: fmtMoney(l.priceM) }))} />
          <Sel label="Orbit" field="launch.orbit" value={d.launch.orbit} owners={own("launch.orbit")} mine={myRole} onChange={(v) => set({ "launch.orbit": v || null })}
            options={cat.orbits.filter((o) => mission.allowed.orbits.includes(o.id)).map((o) => ({ id: o.id, name: o.name, hint: `${o.altKm}km` }))} />
          <Sel label="Ground network" field="ground" value={d.ground} owners={own("ground")} mine={myRole} onChange={(v) => set({ ground: v })}
            options={cat.grounds.map((x) => ({ id: x.id, name: x.name }))} />
          <Sel label="Solar" field="solar" value={d.solar} owners={own("solar")} mine={myRole} onChange={(v) => set({ solar: v || null })} options={pl("solar")} />
          <Sel label="Battery" field="battery" value={d.battery} owners={own("battery")} mine={myRole} onChange={(v) => set({ battery: v || null })} options={pl("battery")} />
          <label className="block text-xs"><span className="text-ink2">Battery count</span>
            <input type="number" min={1} max={8} className="mt-1 w-full rounded bg-white/10 p-2 text-sm" value={d.batteryCount} onChange={(e) => set({ batteryCount: Number(e.target.value) })} /></label>
          <Sel label="ADCS (pointing)" field="adcs" value={d.adcs} owners={own("adcs")} mine={myRole} onChange={(v) => set({ adcs: v || null })} options={pl("adcs")} />
          <Sel label="Propulsion" field="propulsion" value={d.propulsion} owners={own("propulsion")} mine={myRole} onChange={(v) => set({ propulsion: v || null })} options={pl("propulsion")} />
          <Sel label="Comms" field="comms" value={d.comms} owners={own("comms")} mine={myRole} onChange={(v) => set({ comms: v || null })} options={pl("comms")} />
          <label className="block text-xs"><span className="text-ink2">Ops months ({mission.lifetimeMonths.min}–{mission.lifetimeMonths.max})</span>
            <input type="number" min={mission.lifetimeMonths.min} max={mission.lifetimeMonths.max} className="mt-1 w-full rounded bg-white/10 p-2 text-sm" value={d.opsMonths} onChange={(e) => set({ opsMonths: Number(e.target.value) })} /></label>
          <label className="block text-xs"><span className="text-ink2">Instrument duty {Math.round(d.duty * 100)}%</span>
            <input type="range" min={0.1} max={1} step={0.05} className="mt-2 w-full accent-orange" value={d.duty} onChange={(e) => set({ duty: Number(e.target.value) })} /></label>
        </GlassPanel>
        <GlassPanel className="p-4">
          <h3 className="mb-2 font-semibold">Instruments</h3>
          <div className="grid gap-1 sm:grid-cols-2">{parts("instrument").map((p) => (
            <label key={p.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={d.instruments.includes(p.id)} onChange={() => toggleInst(p.id)} />
              {p.name} <span className="text-xs text-ink2">{p.massKg}kg · {fmtMoney(p.costM)}</span></label>))}</div>
        </GlassPanel>
      </div>
      <aside className="space-y-3">
        <GlassPanel className="p-4">
          <div className="text-3xl font-bold">{pv?.score ?? "—"} <span className="text-lg text-ink2">{pv?.grade}</span></div>
          {pv?.metrics && <ul className="mt-2 text-xs text-ink2">
            {["totalMassKg", "costM", "costPct", "massMarginPct", "powerMarginPct", "dataReturnPct", "doseMarginPct"].filter((k) => pv.metrics[k] != null).map((k) => <li key={k}>{k}: {String(pv.metrics[k])}</li>)}</ul>}
        </GlassPanel>
        <GlassPanel className="p-4"><h3 className="font-semibold">Objectives</h3>
          {pv?.objectives.map((o) => <div key={o.id} className={`text-xs ${o.met ? "text-good" : "text-ink2"}`}>{o.met ? "✔" : "○"} {o.label}{o.required && " *"}</div>)}</GlassPanel>
        {pv?.challenges && room.challenge?.eligible && <GlassPanel className="p-4"><h3 className="font-semibold">Challenges {pv.challenges.count}/{pv.challenges.total}</h3>
          {pv.challenges.list.map((c) => <div key={c.id} className={`text-xs ${c.completed ? "text-good" : "text-ink2"}`}>{c.completed ? "✔" : "○"} {c.name} — {c.desc}</div>)}
          <div className="mt-1 text-xs text-orange">{pv.challenges.tiers.map((t) => `${t.need}/${pv.challenges!.total}${t.reached ? " ✔" : ""}`).join(" · ")} for cosmetics</div></GlassPanel>}
        <GlassPanel className="max-h-64 overflow-auto p-4"><h3 className="font-semibold">Checks</h3>
          {pv?.checks.filter((c) => c.status !== "pass").map((c) => <div key={c.id} className={`text-xs ${COLOR[c.status]}`} title={c.why}>● {c.title}: {c.detail}</div>)}</GlassPanel>
        <GlassPanel className="space-y-2 p-4">
          <div className="text-xs text-ink2">Approved: {room.approvals.length}/{humans}</div>
          <GameButton onClick={() => swallow(g.approve(!approved))}>{approved ? "Withdraw approval" : "Approve design"}</GameButton>
          {room.hostId === me && <GameButton variant="primary" disabled={!pv?.launchReady} onClick={() => swallow(g.launch())}>🚀 Launch</GameButton>}
          {cat.rules.devTools && <GameButton variant="outline" onClick={() => swallow(g.devAutodesign())}>🛠 Auto-design (dev)</GameButton>}
          <GameButton variant="ghost" onClick={() => swallow(g.toLobby())}>Abort</GameButton>
        </GlassPanel>
      </aside>
    </div>
  );
}
