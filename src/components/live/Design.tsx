"use client";
/** Live multiplayer design phase. Same look as the offline Mission Architect; values and checks come from the server. */
import { useEffect, useState, type ReactNode } from "react";
import { Lock, Rocket, Wand2 } from "lucide-react";
import { useGame } from "@/live/store";
import { GameButton, GlassPanel, StatusPill } from "@/components/ui";
import { GameChip, Pick, Section, Slider } from "@/components/game/DesignStudio";
import { GAME, destinationById, launchReliability } from "@/game/data";
import { planTransfer } from "@/game/physics";
import { cn } from "@/lib/mission";
import { mmss, secondsLeft } from "@/live/format";
import type { CheckStatus, DesignPatch, RoleId } from "@/live/types";

const swallow = (p: Promise<unknown>) => { p.catch(() => {}); };
const fmt = (n: number, d = 0) => n.toLocaleString("en-US", { maximumFractionDigits: d });
const usd = (n: number) => (n >= 1e9 ? `$${fmt(n / 1e9, 2)}B` : `$${fmt(n / 1e6)}M`);
const STATE_TEXT: Record<CheckStatus, string> = { pass: "OK", warn: "Tight", fail: "Fail" };
const STATE_COLOR: Record<CheckStatus, string> = { pass: "text-ok", warn: "text-warn", fail: "text-bad" };
const PILL: Record<CheckStatus, "ok" | "warning" | "critical"> = { pass: "ok", warn: "warning", fail: "critical" };

/** A design section that is view-only unless this player's seat owns the field. */
function Owned({ n, title, hint, field, children }: { n: number; title: string; hint?: string; field: string; children: (can: boolean) => ReactNode }) {
  const { room, catalog: cat, profile } = useGame();
  if (!room || !cat || !profile) return null;
  const owners = room.fieldOwners[field] ?? [];
  const mine = room.slots.find((s) => s.playerId === profile.id)?.role;
  const botIds = new Set(room.members.filter((m) => m.bot).map((m) => m.id));
  const ownerSlots = room.slots.filter((s) => owners.includes(s.role));
  const can = (!!mine && owners.includes(mine)) || ownerSlots.every((s) => !s.playerId || botIds.has(s.playerId));
  const label = owners.map((r) => cat.roles.find((x) => x.id === r)?.label ?? r).join(" / ");
  const holders = ownerSlots.map((s) => (s.playerId ? room.members.find((m) => m.id === s.playerId)?.name : "AI crew")).join(", ");
  return (
    <Section n={n} title={title} hint={hint}>
      <p className={cn("mb-3 inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 text-[11px] uppercase tracking-wider", can && mine && owners.includes(mine) ? "border-orange/60 text-orange" : can ? "border-white/20 text-ink2" : "border-white/10 text-muted")}>
        {!can && <Lock className="size-3" aria-hidden />}{label} · {mine && owners.includes(mine) ? "your seat" : holders || "unassigned"}{!can && " · view only"}
      </p>
      <div className={cn(!can && "pointer-events-none select-none opacity-60")} aria-disabled={!can}>{children(can)}</div>
    </Section>
  );
}

export function Design() {
  const g = useGame(); const { room, catalog: cat, profile, roomAt } = g;
  const [tick, setTick] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setTick(Date.now()), 500); return () => clearInterval(t); }, []);
  if (!room || !cat || !profile || !room.design) return null;
  const d = room.design, pv = room.preview, me = profile.id;
  const DS = cat.design.dataset, ANT = cat.design.antennas;
  const mission = cat.missions.find((m) => m.id === room.missionId)!;
  const dest = destinationById(d.destinationId)!;
  const plan = planTransfer(dest);
  const myRole = room.slots.find((s) => s.playerId === me)?.role as RoleId | undefined;
  const set = (p: DesignPatch) => swallow(g.setDesign(p));
  const left = secondsLeft(room.challenge, roomAt, tick);
  const approved = room.approvals.includes(me);
  const realIds = room.members.filter((m) => !m.bot).map((m) => m.id);
  const approvedCount = room.approvals.filter((x) => realIds.includes(x)).length;
  const allApproved = approvedCount >= realIds.length;
  const toggleInst = (id: string) => set({ instrumentIds: d.instrumentIds.includes(id) ? d.instrumentIds.filter((x) => x !== id) : [...d.instrumentIds, id] });
  const electric = d.propulsionId !== "chem" ? DS.electric_propulsion.find((e) => e.id === d.propulsionId) : null;
  const m = pv?.metrics ?? {}; const num = (k: string) => Number(m[k] ?? 0);

  return (
    <div className="space-y-4">
      <GlassPanel active className="flex flex-wrap items-center gap-4 p-4">
        <div className="min-w-60 flex-1">
          <p className="hud-label !text-orange">{mission.name} · {room.difficulty} · attempt {room.attempt}</p>
          <p className="font-display text-lg font-bold uppercase tracking-wide">You are the {myRole ? cat.roles.find((r) => r.id === myRole)?.label : "observer"}</p>
          <p className="text-xs text-ink2">Each section belongs to one seat. Edit yours, read the others, and talk it through. Everyone approves before launch.</p>
        </div>
        {left != null && room.challenge?.eligible && <p className="font-display text-2xl text-orange tabular-nums" aria-label="Time attack clock">⏱ {mmss(left)}</p>}
      </GlassPanel>

      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <Section n={1} title="Destination" hint="Delta-v and travel time are computed from real gravitational parameters, radii and orbits.">
            <p className="font-display text-lg font-bold">{dest.name}</p><p className="text-xs text-ink2">{dest.tagline}</p>
            <p className="mt-2 text-xs text-ink2">To reach {dest.name}: <b className="text-ink">{fmt(plan.totalDv)} m/s</b> from low Earth orbit (departure {fmt(plan.departureDv)} + capture {fmt(plan.captureDv)}), about <b className="text-ink">{fmt(plan.transferDays)} days</b>, sunlight {fmt(plan.irradiance)} W/m². Science goal {dest.scienceGoal}, wants {dest.wants.join(", ")}.</p>
          </Section>

          <Owned n={2} title="Launch vehicle" field="vehicleId" hint="Capacity, price and flight record come from Launch Library 2 (capacity reference orbit is not stated).">
            {() => <ul className="grid gap-2 sm:grid-cols-2">
              {DS.vehicles.slice().sort((a, b) => a.leo_capacity_kg - b.leo_capacity_kg).map((v) => (
                <li key={v.id}><Pick on={d.vehicleId === v.id} onClick={() => set({ vehicleId: v.id })} className="w-full">
                  <div className="flex justify-between"><span className="font-display font-bold">{v.name}</span><span className="text-xs text-muted">{v.manufacturer_country}</span></div>
                  <p className="text-xs text-ink2">{fmt(v.leo_capacity_kg)} kg to LEO · {usd(v.launch_cost_usd)}</p>
                  <p className="text-xs text-muted">{v.successful_launches}/{v.total_launches} successes → {fmt(launchReliability(v) * 100, 1)} % reliable</p>
                </Pick></li>))}
            </ul>}
          </Owned>

          <Owned n={3} title="Propulsion" field="propulsionId" hint="Thruster thrust, power and Isp are NASA-sourced; chemical engine values are game values.">
            {() => <>
              <div className="grid gap-2 sm:grid-cols-2">
                <Pick on={d.propulsionId === "chem"} onClick={() => set({ propulsionId: "chem" })}><p className="font-display font-bold">{GAME.chemical.name}<GameChip /></p><p className="text-xs text-ink2">Isp {GAME.chemical.isp_s} s · fast, heavy fuel use</p></Pick>
                {DS.electric_propulsion.map((e) => <Pick key={e.id} on={d.propulsionId === e.id} onClick={() => set({ propulsionId: e.id })}><p className="font-display font-bold">{e.name}</p><p className="text-xs text-ink2">Isp {fmt(e.isp_s)} s · {e.thrust_n} N · {fmt(e.power_w)} W each</p></Pick>)}
              </div>
              <div className="mt-4 space-y-3">
                {electric && <Slider label="Thrusters" value={d.thrusters} min={1} max={GAME.electric.maxThrusters} unit="×" onChange={(v) => set({ thrusters: v })} />}
                <Slider label="Propellant" value={Math.min(d.propellantKg, 40000)} min={0} max={40000} step={10} unit="kg" onChange={(v) => set({ propellantKg: v })} />
                <GameButton variant="outline" icon={<Wand2 className="size-4" />} onClick={() => swallow(g.autofill())}>Auto-fill propellant</GameButton>
              </div>
            </>}
          </Owned>

          <Owned n={4} title="Power" field="solarAreaM2" hint="Sunlight at each planet is data; array efficiency, mass and RTG specs are game values.">
            {() => <div className="space-y-3">
              <Slider label="Solar array" note={<GameChip />} value={d.solarAreaM2} min={0} max={GAME.solar.maxM2} unit="m²" onChange={(v) => set({ solarAreaM2: v })} />
              <Slider label="RTG units (nuclear, any distance)" note={<GameChip />} value={d.rtgUnits} min={0} max={GAME.rtg.max} unit="×" onChange={(v) => set({ rtgUnits: v })} />
            </div>}
          </Owned>

          <Owned n={5} title="Communications" field="antennaId" hint="Data rate falls with the square of distance (game link model).">
            {() => <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {ANT.map((a) => <Pick key={a.id} on={d.antennaId === a.id} onClick={() => set({ antennaId: a.id })}><p className="font-display font-bold">{a.name}</p><p className="text-xs text-ink2">{a.dishM} m · {a.txW} W · {a.massKg} kg</p></Pick>)}
            </div>}
          </Owned>

          <Owned n={6} title="Science instruments" field="instrumentIds" hint="Real instruments from NASA's NSSDC catalog, with mass (and power, where stated) quoted from NASA's descriptions.">
            {() => <ul className="grid gap-2 sm:grid-cols-2">
              {DS.instruments.map((i) => { const wanted = dest.wants.includes(i.tag); return (
                <li key={i.id}><Pick on={d.instrumentIds.includes(i.id)} onClick={() => toggleInst(i.id)} className="w-full">
                  <div className="flex justify-between gap-2"><span className="text-sm font-semibold">{i.name}</span>{wanted && <span className="hud-label !text-ok">wanted ×{GAME.wantedBonus}</span>}</div>
                  <p className="text-xs text-ink2">{i.mission} · {i.mass_kg} kg · {i.power_w ?? GAME.defaultInstrumentPowerW} W{i.power_w === null && <GameChip />}</p>
                  <p className="text-xs capitalize text-muted">{i.tag}</p>
                </Pick></li>); })}
            </ul>}
          </Owned>

          <Owned n={7} title="Engineering margin" field="marginPct" hint="Reserve mass makes every phase more reliable and absorbs hardware mass growth, at the cost of mass and money.">
            {() => <Slider label="Design margin" value={d.marginPct} min={0} max={30} unit="%" onChange={(v) => set({ marginPct: v })} />}
          </Owned>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <GlassPanel active={!!pv?.launchReady} className="p-4">
            <p className="hud-label">Design review</p>
            <ul className="mt-2 space-y-2">
              {pv?.checks.map((c) => (
                <li key={c.id} className="rounded-md border border-[var(--border)] p-2" title={c.why}>
                  <div className="flex items-center justify-between gap-2 text-sm"><span className="font-display tracking-wider uppercase">{c.title}</span><StatusPill state={PILL[c.status]}>{STATE_TEXT[c.status]}</StatusPill></div>
                  <p className={cn("text-xs tabular-nums", STATE_COLOR[c.status])}>{c.value} <span className="text-muted">/ {c.limit}</span></p>
                  {c.status !== "pass" && <p className="mt-1 text-xs text-ink2">{c.detail}</p>}
                </li>))}
            </ul>
            {pv && <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-md bg-white/5 p-2"><dt className="text-muted">Dry / launch mass</dt><dd className="font-display text-base tabular-nums">{fmt(num("dryMassKg"))} / {fmt(num("launchMassKg"))} kg</dd></div>
              <div className="rounded-md bg-white/5 p-2"><dt className="text-muted">Cost / budget</dt><dd className="font-display text-base tabular-nums">${fmt(num("costM"))}M / ${fmt(num("budgetM"))}M</dd></div>
              <div className="rounded-md bg-white/5 p-2"><dt className="text-muted">Science (goal {num("scienceGoal")})</dt><dd className="font-display text-base tabular-nums">{fmt(num("science"), 1)}</dd></div>
              <div className="rounded-md bg-white/5 p-2"><dt className="text-muted">Mission success odds</dt><dd className="font-display text-base tabular-nums">{fmt(num("missionProbPct"), 1)} %</dd></div>
            </dl>}
            {pv?.breakdown && <details className="mt-3 text-xs text-ink2"><summary className="cursor-pointer">Cost breakdown</summary>
              <ul className="mt-1 space-y-0.5">{Object.entries(pv.breakdown).map(([k, v]) => <li key={k} className="flex justify-between"><span>{k}</span><span className="tabular-nums">${fmt(v, 1)}M</span></li>)}</ul></details>}
            {pv && pv.score != null && <p className="mt-3 text-xs text-ink2">Projected score if the flight goes well: <b className="text-ink">{pv.score}</b> ({pv.grade}). Each phase can still fail.</p>}
          </GlassPanel>

          {pv?.challenges && room.challenge?.eligible && <GlassPanel className="p-4"><p className="hud-label !text-gold">Time-attack {pv.challenges.count}/{pv.challenges.total}</p>
            {pv.challenges.list.map((c) => <p key={c.id} className={cn("mt-1 text-xs", c.completed ? "text-ok" : "text-ink2")}>{c.completed ? "✔" : "○"} <b>{c.name}</b>: {c.desc}</p>)}
            <p className="mt-2 text-xs text-orange">{pv.challenges.tiers.map((t) => `${t.need}/${pv.challenges!.total}${t.reached ? " ✔" : ""}`).join(" · ")} for cosmetics</p></GlassPanel>}

          <GlassPanel className="space-y-2 p-4">
            <p className="text-xs text-ink2">Approved: {approvedCount}/{realIds.length}{room.members.some((x) => x.bot) ? " (test bots auto-approve)" : ""}</p>
            <GameButton className="w-full" onClick={() => swallow(g.approve(!approved))}>{approved ? "Withdraw approval" : "Approve design"}</GameButton>
            {room.hostId === me && <GameButton variant="primary" className="w-full py-3 text-lg" disabled={!pv?.launchReady || !allApproved} icon={<Rocket className="size-5" />} title={allApproved ? "" : "Every player must approve first"} onClick={() => swallow(g.launch())}>{pv?.launchReady ? (allApproved ? "Go for launch" : "Waiting for approvals") : "No-go"}</GameButton>}
            {room.hostId !== me && <p className="text-xs text-muted">The host presses launch once everyone approves.</p>}
            {cat.rules.devTools && <GameButton variant="outline" className="w-full" onClick={() => swallow(g.devAutodesign())}>🛠 Auto-design (dev)</GameButton>}
            <GameButton variant="ghost" className="w-full" onClick={() => swallow(g.toLobby())}>Abort</GameButton>
          </GlassPanel>
        </aside>
      </div>
    </div>
  );
}
