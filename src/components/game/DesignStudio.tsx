"use client";
import Link from "next/link";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { Rocket, Wand2, RotateCcw, Pencil } from "lucide-react";
import { BackButton, GameButton, GlassPanel, ScreenContainer, StatusPill } from "@/components/ui";
import { Astronaut, Scene3D } from "@/components/three/lazy";
import { cn } from "@/lib/mission";
import { ANTENNAS, DATASET, DESTINATIONS, GAME, launchReliability } from "@/game/data";
import { seedFromDesign, simulate, type Check, type Evaluation, type MissionResult } from "@/game/engine";
import { useDesignStore, useEvaluation } from "@/game/store";
import { buildTrajectory } from "@/game/trajectory";
import { TrajectorySim } from "./TrajectorySim";
import { AscentFlight } from "./LaunchControl";
import { LaunchSession } from "@/game/launch/session";
import { RULES, type Difficulty } from "@/game/launch/core";
import { useLaunchSetup } from "@/game/launch/store";
import { CraftPreview } from "./CraftPreview";
import { catalogUrl, curationOf, requiredMeasures, suitability } from "@/game/instruments";
import { usePartThumbs } from "./partThumbs";

const fmt = (n: number, d = 0) => n.toLocaleString("en-US", { maximumFractionDigits: d });
const usd = (n: number) => (n >= 1e9 ? `$${fmt(n / 1e9, 2)}B` : `$${fmt(n / 1e6)}M`);

function Section({ n, title, hint, children }: { n: number; title: string; hint?: string; children: ReactNode }) {
  return (
    <GlassPanel as="section" className="p-4" aria-label={title}>
      <h2 className="mb-1 flex items-baseline gap-3 text-xl font-bold"><span className="hud-label !text-orange">0{n}</span>{title}</h2>
      {hint && <p className="mb-3 text-xs text-muted">{hint}</p>}
      {children}
    </GlassPanel>
  );
}
/** Picture of a part (rendered once by one shared offscreen context, see partThumbs.ts). */
function PartImg({ k, thumbs, w = 64, h = 64 }: { k: string; thumbs: Record<string, string>; w?: number; h?: number }) {
  const src = thumbs[k];
  return (
    <span aria-hidden className="grid shrink-0 place-items-center overflow-hidden rounded-md bg-white/[0.04]" style={{ width: w, height: h }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- generated data URL */}
      {src ? <img src={src} alt="" width={w} height={h} className="h-full w-full object-contain" /> : <span className="size-4 animate-pulse rounded-full bg-white/10" />}
    </span>
  );
}
const GameChip = () => <span className="ml-1 rounded-sm border border-white/15 px-1 text-[10px] uppercase tracking-wider text-muted" title="Not in the dataset — a game-balance value">game</span>;
const Pick = ({ on, onClick, children, className }: { on: boolean; onClick: () => void; children: ReactNode; className?: string }) => (
  <button type="button" aria-pressed={on} onClick={onClick}
    className={cn("lift rounded-lg border p-3 text-left transition", on ? "border-orange bg-orange/10" : "border-[var(--border)] bg-panel hover:border-[var(--border-strong)]", className)}>{children}</button>
);
const Slider = ({ label, value, min, max, step = 1, unit, onChange, note }: { label: string; value: number; min: number; max: number; step?: number; unit: string; onChange: (v: number) => void; note?: ReactNode }) => (
  <label className="block">
    <span className="flex justify-between text-sm"><span>{label}{note}</span><span className="font-display tabular-nums text-ink">{fmt(value)} {unit}</span></span>
    <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="mt-1 w-full" />
  </label>
);

export function DesignStudio() {
  const { design, patch, toggleInstrument, autoFill, quickStart, redesign, reset } = useDesignStore();
  const [qsFailed, setQsFailed] = useState(false);
  const ev = useEvaluation();
  const thumbs = usePartThumbs();
  const [flight, setFlight] = useState<MissionResult | null>(null);
  const dest = ev.destination;
  const maxProp = 40_000;

  const [ascent, setAscent] = useState<{ session: LaunchSession; n: number } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [fromTli, setFromTli] = useState(false);
  /** Every mission now starts with the real ground-to-orbit ascent (Launch Control) from the chosen spaceport. */
  const startAscent = (n: number) => {
    const setup = useLaunchSetup.getState();
    // Full Moon mission (parking orbit → TLI burn) when asked for, the target is the Moon and the rocket has the performance.
    const mission = setup.mission === "moon" && canFlyMoon(ev) ? "moon" : "orbit";
    setAttempt(n);
    setAscent({ n, session: new LaunchSession(setup.difficulty, setup.siteId, ev.vehicle.id, 1000 + n * 7919, Math.min(ev.wetKg, ev.vehicle.leo_capacity_kg), mission) });
  };
  const onLaunch = () => startAscent(attempt + 1);
  const finishAscent = () => {
    if (!ascent) return;
    const f = ascent.session.flight, site = f.site.location.split(",")[0];
    // The ascent decided the launch phase; the remaining phases (cruise, insertion, science) still roll on the design's odds.
    const r = simulate({ ...ev, probabilities: { ...ev.probabilities, launch: 1 } }, seedFromDesign(design, ascent.n));
    const tli = f.mission === "moon";
    r.phases[0] = { ...r.phases[0], probability: 1, story: tli
      ? `${f.rocket.name} reached a ${(f.park?.periKm ?? 0).toFixed(0)} × ${(f.park?.apoKm ?? 0).toFixed(0)} km parking orbit and the upper stage completed translunar injection (apogee ${f.tel.apoKm.toFixed(0)} km) — ${f.rules.name} launch from ${site}.`
      : `Reached a ${f.tel.periKm.toFixed(0)} × ${f.tel.apoKm.toFixed(0)} km orbit — ${f.rules.name} launch from ${site}.` };
    setFromTli(tli); setFlight(r); setAscent(null);
  };
  if (ascent && !flight) {
    return <AscentFlight key={ascent.n} session={ascent.session} onExit={() => setAscent(null)} onAgain={() => startAscent(ascent.n + 1)} onContinue={finishAscent} continueLabel={`fly to the ${ev.destination.name}`} exitLabel="Back to design" />;
  }
  if (flight) return <FlightView ev={ev} result={flight} fromTli={fromTli} onAgain={() => { setFlight(null); redesign(); }} onRetry={() => { setFlight(null); startAscent(attempt + 1); }} />;

  return (
    <ScreenContainer title="Mission Architect" subtitle="Real orbital physics, real launch records, real NASA instruments — balance them all." actions={<div className="flex gap-2"><GameButton variant="ghost" icon={<RotateCcw className="size-4" />} onClick={reset}>Reset</GameButton><BackButton href="/menu" label="Main menu" /></div>}>
      <GlassPanel active className="flex flex-wrap items-center gap-4 p-4" aria-label="Quick start">
        <div className="min-w-60 flex-1">
          <p className="hud-label !text-orange">New here? Three steps</p>
          <p className="font-display text-lg font-bold uppercase tracking-wide">1 Pick Moon or Mars · 2 Build it for me · 3 Launch from Earth</p>
          <p className="text-xs text-ink2">“Build it for me” picks the most reliable rocket, engine, power, antenna and instruments for {dest.name}. Tweak anything below afterwards.</p>
        </div>
        <GameButton variant="primary" icon={<Wand2 className="size-5" />} onClick={() => setQsFailed(!quickStart(design.destinationId))}>Build it for me</GameButton>
        {qsFailed && <p role="status" className="w-full text-xs text-bad">Couldn’t find a working build automatically — adjust the sections below.</p>}
      </GlassPanel>
      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <Section n={1} title="Destination" hint="Δv and travel time are computed from the dataset's gravitational parameters, radii and orbits.">
            <ul className="grid gap-3 sm:grid-cols-2">
              {DESTINATIONS.map((d) => (
                <li key={d.id}><Pick on={design.destinationId === d.id} onClick={() => patch({ destinationId: d.id })} className="h-full w-full">
                  <p className="font-display text-lg font-bold">{d.name}</p><p className="text-xs text-ink2">{d.tagline}</p>
                  <p className="mt-2 text-xs text-muted">Budget {usd(d.budgetUsd)}<GameChip /> · Wants {d.wants.join(", ")}</p>
                  <p className="mt-1 text-xs" aria-label={`Difficulty ${d.difficulty} of 5`}>{"●".repeat(d.difficulty)}<span className="text-white/20">{"●".repeat(5 - d.difficulty)}</span></p>
                </Pick></li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-ink2">To reach {dest.name}: <b className="text-ink">{fmt(ev.plan.totalDv)} m/s</b> from low Earth orbit (departure {fmt(ev.plan.departureDv)} + capture {fmt(ev.plan.captureDv)}), about <b className="text-ink">{fmt(ev.plan.transferDays)} days</b>, sunlight {fmt(ev.plan.irradiance)} W/m².</p>
          </Section>

          <Section n={2} title="Launch vehicle" hint="Capacity, price and flight record come from Launch Library 2 via the dataset (capacity reference orbit is not stated).">
            <ul className="grid gap-2 sm:grid-cols-2">
              {DATASET.vehicles.slice().sort((a, b) => a.leo_capacity_kg - b.leo_capacity_kg).map((v) => (
                <li key={v.id}><Pick on={design.vehicleId === v.id} onClick={() => patch({ vehicleId: v.id })} className="w-full">
                  <div className="flex gap-3"><PartImg k={`veh:${v.id}`} thumbs={thumbs} w={56} h={84} /><div className="min-w-0 flex-1">
                  <div className="flex justify-between"><span className="font-display font-bold">{v.name}</span><span className="text-xs text-muted">{v.manufacturer_country}</span></div>
                  <p className="text-xs text-ink2">{fmt(v.leo_capacity_kg)} kg to LEO · {usd(v.launch_cost_usd)}</p>
                  <p className="text-xs text-muted">{v.successful_launches}/{v.total_launches} successes → {fmt(launchReliability(v) * 100, 1)} % reliable</p>
                  </div></div>
                </Pick></li>
              ))}
            </ul>
          </Section>

          <Section n={3} title="Propulsion" hint="Thruster thrust, power and Isp are NASA-sourced; chemical engine values are game values.">
            <div className="grid gap-2 sm:grid-cols-2">
              <Pick on={design.propulsionId === "chem"} onClick={() => patch({ propulsionId: "chem" })}>
                <div className="flex gap-3"><PartImg k="prop:chem" thumbs={thumbs} /><div><p className="font-display font-bold">{GAME.chemical.name}<GameChip /></p><p className="text-xs text-ink2">Isp {GAME.chemical.isp_s} s · fast, heavy fuel use</p></div></div></Pick>
              {DATASET.electric_propulsion.map((e) => (
                <Pick key={e.id} on={design.propulsionId === e.id} onClick={() => patch({ propulsionId: e.id })}>
                  <div className="flex gap-3"><PartImg k={`prop:${e.id}`} thumbs={thumbs} /><div><p className="font-display font-bold">{e.name}</p><p className="text-xs text-ink2">Isp {fmt(e.isp_s)} s · {e.thrust_n} N · {fmt(e.power_w)} W each</p></div></div></Pick>
              ))}
            </div>
            <div className="mt-4 space-y-3">
              {ev.electric && <Slider label="Thrusters" value={design.thrusters} min={1} max={GAME.electric.maxThrusters} unit="×" onChange={(v) => patch({ thrusters: v })} />}
              <Slider label="Propellant" value={Math.min(design.propellantKg, maxProp)} min={0} max={maxProp} step={10} unit="kg" onChange={(v) => patch({ propellantKg: v })} />
              <div className="flex flex-wrap items-center gap-3 text-xs text-ink2">
                <GameButton variant="outline" icon={<Wand2 className="size-4" />} onClick={autoFill}>Auto-fill propellant</GameButton>
                {Number.isFinite(ev.propellantNeededKg)
                  ? <span>Needs ≈ {fmt(ev.propellantNeededKg)} kg for exactly {fmt(ev.dvRequired)} m/s.</span>
                  : <span className="text-warn">Impossible with these tanks — the mass ratio is too high. Try ion thrusters.</span>}
              </div>
            </div>
          </Section>

          <Section n={4} title="Power" hint="Sunlight at each planet is dataset data; array efficiency, mass and RTG specs are game values.">
            <div className="mb-3 grid grid-cols-2 gap-2">
              <div className="flex items-center gap-3 rounded-lg border border-[var(--border)] p-2"><PartImg k="power:solar" thumbs={thumbs} w={88} h={64} /><p className="text-xs text-ink2"><b className="text-ink">Solar wings</b><br />{fmt(design.solarAreaM2)} m² · sunlight-dependent</p></div>
              <div className="flex items-center gap-3 rounded-lg border border-[var(--border)] p-2"><PartImg k="power:rtg" thumbs={thumbs} w={64} h={64} /><p className="text-xs text-ink2"><b className="text-ink">RTG</b> ×{design.rtgUnits}<br />nuclear · works at any distance</p></div>
            </div>
            <div className="space-y-3">
              <Slider label="Solar array" note={<GameChip />} value={design.solarAreaM2} min={0} max={GAME.solar.maxM2} unit="m²" onChange={(v) => patch({ solarAreaM2: v })} />
              <Slider label="RTG units (nuclear, any distance)" note={<GameChip />} value={design.rtgUnits} min={0} max={GAME.rtg.max} unit="×" onChange={(v) => patch({ rtgUnits: v })} />
            </div>
          </Section>

          <Section n={5} title="Communications" hint="Data rate falls with the square of distance. The link model is calibrated to an MRO-class link (game model).">
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {ANTENNAS.map((a) => (
                <Pick key={a.id} on={design.antennaId === a.id} onClick={() => patch({ antennaId: a.id })}>
                  <div className="flex gap-3"><PartImg k={`ant:${a.id}`} thumbs={thumbs} w={56} h={56} /><div><p className="font-display font-bold">{a.name}</p><p className="text-xs text-ink2">{a.dishM} m · {a.txW} W · {a.massKg} kg</p></div></div></Pick>
              ))}
            </div>
          </Section>

          <Section n={6} title="Science instruments" hint="Real instruments from NASA's NSSDC catalog, with the mass (and power, where stated) quoted from NASA's descriptions.">
            <ul className="grid gap-2 sm:grid-cols-2">
              {DATASET.instruments.map((i) => {
                const su = suitability(i, dest), cu = curationOf(i), url = catalogUrl(i);
                const tone = su.kind === "suited" ? "text-ok" : su.kind === "unsuitable" ? "text-bad" : su.kind === "supporting" ? "text-warn" : "text-muted";
                return (
                  <li key={i.id}><Pick on={design.instrumentIds.includes(i.id)} onClick={() => toggleInstrument(i.id)} className="w-full">
                    <div className="flex gap-3"><PartImg k={`ins:${i.id}`} thumbs={thumbs} w={60} h={60} /><div className="min-w-0 flex-1">
                    <div className="flex justify-between gap-2"><span className="text-sm font-semibold">{i.name}</span>{su.kind === "suited" && <span className="hud-label !text-ok">fits contract</span>}</div>
                    <p className="text-xs text-ink2">{i.mission} · {cu.packageId ? `${i.mass_kg} kg · ${i.power_w} W (shared package)` : `${cu.massKg ?? i.mass_kg} kg · ${i.power_w ?? GAME.defaultInstrumentPowerW} W`}{i.power_w === null && <GameChip />}</p>
                    <p className="text-xs capitalize text-muted">{cu.measures.map((m) => m.replace(/-/g, " ")).join(" · ") || i.tag}</p>
                    <p className={cn("text-xs", tone)}>{su.label}</p></div></div>
                  </Pick>
                  <p className="mt-1 px-1 text-[11px] leading-snug text-muted">{MASS_LABEL[cu.massScope]}{cu.note ? ` · ${cu.note}` : ""}{cu.basis === "name" ? " · measurement type inferred from the name." : ""}{url && <> <a className="underline hover:text-ink" href={url} target="_blank" rel="noreferrer">NASA catalog entry</a></>}</p></li>
                );
              })}
            </ul>
          </Section>

          <Section n={7} title="Engineering margin" hint="Contingency mass makes every phase more reliable — at the cost of mass and money.">
            <Slider label="Design margin" value={design.marginPct} min={0} max={30} unit="%" onChange={(v) => patch({ marginPct: v })} />
          </Section>
        </div>

        <aside className="space-y-3 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:self-start lg:overflow-y-auto"><CraftPreview ev={ev} className="h-64" /><ReviewPanel ev={ev} onLaunch={onLaunch} /></aside>
      </div>
      <p className="text-center text-xs text-muted">Data: <a className="underline" href={DATASET.provenance.dataset}>space-mission-dataset</a> (NASA, JPL, Launch Library 2). Items marked “game” are balance values, not real data.</p>
    </ScreenContainer>
  );
}

/** The Moon contract can be flown end-to-end only with a rocket that has propellant left for translunar injection. */
const canFlyMoon = (ev: Evaluation) => ev.destination.kind === "moon" && (!!ev.vehicle.tli_payload_kg || ev.vehicle.leo_capacity_kg >= 20000);
function LaunchSetupFields({ ev }: { ev: Evaluation }) {
  const { siteId, difficulty, mission, set } = useLaunchSetup();
  const moonOk = canFlyMoon(ev);
  return (
    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
      <label className="col-span-2 block"><span className="hud-label">Launch mission</span>
        <select value={moonOk ? mission : "orbit"} disabled={!moonOk} onChange={(e) => set({ mission: e.target.value as "orbit" | "moon" })} aria-label="Launch mission" className="mt-1 w-full px-2 py-1.5">
          <option value="orbit">Quick: ascent to orbit, then the flight view</option>
          <option value="moon">Full Moon mission: parking orbit → TLI burn → Moon</option>
        </select>
        {!moonOk && <span className="mt-1 block text-muted">{ev.destination.kind !== "moon" ? "The full TLI mission is for the Moon contract." : "This rocket's upper stage is too small for translunar injection — pick the Saturn V (or another heavy lifter)."}</span>}</label>
      <label className="block"><span className="hud-label">Spaceport</span>
        <select value={siteId} onChange={(e) => set({ siteId: e.target.value })} aria-label="Spaceport" className="mt-1 w-full px-2 py-1.5">
          {DATASET.launch_sites.map((s) => <option key={s.id} value={s.id}>{s.location.split(",")[0]} (+{Math.round(s.rotation_boost_m_s)} m/s)</option>)}
        </select></label>
      <label className="block"><span className="hud-label">Launch difficulty</span>
        <select value={difficulty} onChange={(e) => set({ difficulty: e.target.value as Difficulty })} aria-label="Launch difficulty" className="mt-1 w-full px-2 py-1.5">
          {(["easy", "medium", "hard"] as const).map((d) => <option key={d} value={d}>{RULES[d].name} ({d})</option>)}
        </select></label>
    </div>
  );
}
const stateText: Record<Check["state"], string> = { ok: "OK", warn: "Tight", bad: "Fail" };
const stateColor = { ok: "text-ok", warn: "text-warn", bad: "text-bad" } as const;
const MASS_LABEL = { full: "Mass: whole instrument", "shared-package": "Mass: shared electronics package, counted once", "sensor-only": "Mass: sensor only, electronics not included", "electronics-only": "Mass: electronics board only (estimate)", derived: "Mass: derived from the source's parts" } as const;
function ReviewPanel({ ev, onLaunch }: { ev: Evaluation; onLaunch: () => void }) {
  const p = ev.probabilities;
  return (
    <GlassPanel active={ev.goNoGo} className="p-4">
      <p className="hud-label">Design review</p>
      <ul className="mt-2 space-y-2">
        {ev.checks.map((c) => (
          <li key={c.id} className="rounded-md border border-[var(--border)] p-2" title={c.detail}>
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="font-display tracking-wider uppercase">{c.label}</span>
              <StatusPill state={c.state === "ok" ? "ok" : c.state === "warn" ? "warning" : "critical"}>{stateText[c.state]}</StatusPill>
            </div>
            <p className={cn("text-xs tabular-nums", stateColor[c.state])}>{c.value} <span className="text-muted">/ {c.limit}</span></p>
            {c.state !== "ok" && <p className="mt-1 text-xs text-ink2">{c.detail}</p>}
          </li>
        ))}
      </ul>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-md bg-white/5 p-2"><dt className="text-muted">Dry / wet mass</dt><dd className="font-display text-base tabular-nums">{fmt(ev.dryKg)} / {fmt(ev.wetKg)} kg</dd></div>
        <div className="rounded-md bg-white/5 p-2"><dt className="text-muted">Total cost</dt><dd className="font-display text-base tabular-nums">{usd(ev.costUsd)}</dd></div>
        <div className="rounded-md bg-white/5 p-2"><dt className="text-muted">Science (goal {ev.destination.scienceGoal})</dt><dd className="font-display text-base tabular-nums">{fmt(ev.science, 1)}</dd></div>
        <div className="rounded-md bg-white/5 p-2"><dt className="text-muted" title="Chance the spacecraft survives launch, cruise, insertion and operations. It is NOT the chance of meeting the contract objective — that depends on science return (left) and, in Mission Control, on live events and your decisions.">Flight survival odds</dt><dd className="font-display text-base tabular-nums">{fmt(p.mission * 100)} %</dd></div>
      </dl>
      <details className="mt-3 text-xs text-ink2"><summary className="cursor-pointer">Power by operating mode</summary>
        <table className="mt-1 w-full"><thead><tr className="text-muted"><th className="text-left font-normal">Mode</th><th className="text-right font-normal">In</th><th className="text-right font-normal">Out</th></tr></thead><tbody className="tabular-nums">
          <tr><td>Observing (sunlit)</td><td className="text-right">{fmt(ev.ops.science.gen)} W</td><td className="text-right">{fmt(ev.ops.science.load)} W</td></tr>
          <tr><td>Downlink (sunlit)</td><td className="text-right">{fmt(ev.ops.downlink.gen)} W</td><td className="text-right">{fmt(ev.ops.downlink.load)} W</td></tr>
          <tr><td>Orbit average (60/40 mix)</td><td className="text-right">{fmt(ev.ops.avgGen)} W</td><td className="text-right">{fmt(ev.ops.avgLoad)} W</td></tr>
        </tbody></table>
        <p className="mt-1 text-muted">Same model Mission Control uses: arrays derated for pointing and off in eclipse; RTGs constant. Architect&apos;s headline power figure is the nominal full-Sun output.</p></details>
      <details className="mt-3 text-xs text-ink2"><summary className="cursor-pointer">Assumptions and sources</summary>
        <ul className="mt-1 space-y-1">
          <li><b className="text-ink">Real, from NASA or Launch Library 2:</b> instrument masses and powers as quoted, planetary constants, launch vehicle data. Launch Library 2 is not a NASA source.</li>
          <li><b className="text-ink">Game values:</b> prices other than launch, array and battery masses, reliability model, science points and the {ev.destination.id === "moon" ? "survey goals" : "mission goals"}. Where a source gives no power, a default is used (marked GAME).</li>
          <li><b className="text-ink">Simplifications:</b> {ev.electric ? "low-thrust transfer uses an approximate model; " : ""}coverage is a scalar progress counter, not a mapped survey; the survey does not use real NASA measurements yet.</li>
          {requiredMeasures(ev.destination).length > 0 && <li><b className="text-ink">Contract needs:</b> {requiredMeasures(ev.destination).map((m) => m.replace("-", " ")).join(" + ")}.</li>}
          {ev.instruments.map((i) => <li key={i.id}><b className="text-ink">{i.name}:</b> {MASS_LABEL[curationOf(i).massScope]}{curationOf(i).note ? `. ${curationOf(i).note}` : ""}</li>)}
        </ul></details>
      <details className="mt-3 text-xs text-ink2"><summary className="cursor-pointer">Cost breakdown</summary>
        <ul className="mt-1 space-y-0.5">{Object.entries(ev.costBreakdown).map(([k, v]) => <li key={k} className="flex justify-between"><span>{k}</span><span className="tabular-nums">{usd(v)}</span></li>)}</ul></details>
      <LaunchSetupFields ev={ev} />
      <GameButton variant="primary" className="mt-4 w-full py-3 text-lg" disabled={!ev.goNoGo} icon={<Rocket className="size-5" />} onClick={onLaunch}>{ev.goNoGo ? "Go for launch" : "No-go"}</GameButton>
      {!ev.goNoGo && <p className="mt-2 text-center text-xs text-bad" role="status">Fix the failing checks to unlock launch.</p>}
      {ev.destination.id === "moon" && <Link href="/mission-control" className="mt-2 block rounded-lg border border-[var(--border)] px-4 py-2 text-center text-sm text-ink2 transition hover:border-orange hover:text-ink">Or fly it live in Mission Control →</Link>}
    </GlassPanel>
  );
}

function FlightView({ ev, result, fromTli, onAgain, onRetry }: { ev: Evaluation; result: MissionResult; fromTli: boolean; onAgain: () => void; onRetry: () => void }) {
  const failIndex = (() => { const i = result.phases.findIndex((p) => !p.passed); return i === -1 ? null : (i as 0 | 1 | 2 | 3); })();
  const traj = useMemo(() => buildTrajectory(ev.destination, failIndex), [ev.destination, failIndex]);
  const [u, setU] = useState(0);
  const [seenEnd, setSeenEnd] = useState(false);
  const [crew, setCrew] = useState(false);
  const onUpdate = useCallback((nu: number, d: boolean) => { setU(nu); if (d) setSeenEnd(true); }, []);
  const revealed = result.phases.filter((_, i) => seenEnd || u >= traj.reveal[i] - 1e-6);
  const finished = seenEnd;
  return (
    <ScreenContainer title={finished ? (result.success ? "Mission success" : "Mission lost") : "Mission in progress"} subtitle={`${ev.destination.name} · ${ev.vehicle.name} · ${ev.design.propulsionId === "chem" ? "chemical" : ev.electric?.name}`}>
      <div className="grid gap-4 xl:grid-cols-[minmax(320px,430px)_1fr]">
        <GlassPanel className="p-5">
          <ol className="space-y-3" aria-live="polite">
            {revealed.map((ph) => (
              <li key={ph.id} className="enter flex gap-3">
                <span aria-hidden className={cn("mt-0.5 grid size-6 shrink-0 place-items-center rounded-sm border text-sm", ph.passed ? "border-ok text-ok" : "border-bad text-bad")}>{ph.passed ? "✓" : "✕"}</span>
                <div><p className="font-display text-lg uppercase tracking-wider">{ph.label}</p><p className="text-sm text-ink2">{ph.story}</p><p className="text-xs text-muted">Odds were {fmt(ph.probability * 100)} %</p></div>
              </li>
            ))}
            {!finished && <li className="text-sm text-muted">Tracking spacecraft…</li>}
          </ol>
          {finished && (
            <div className="enter mt-6 border-t border-[var(--border)] pt-4">
              <p className="text-lg">{result.headline}</p>
              <div className="mt-3 flex items-end gap-6">
                <div><p className="hud-label">Score</p><p className="font-display text-6xl font-bold leading-none text-orange tabular-nums">{result.score}</p></div>
                <div><p className="hud-label">Grade</p><p className="font-display text-6xl font-bold leading-none">{result.grade}</p></div>
              </div>
              <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
                <div className="rounded-md bg-white/5 p-2"><dt className="text-muted">Phases</dt><dd className="text-base">{result.reached}/4</dd></div>
                <div className="rounded-md bg-white/5 p-2"><dt className="text-muted">Science goal</dt><dd className="text-base">{fmt(result.scienceFraction * 100)} %</dd></div>
                <div className="rounded-md bg-white/5 p-2"><dt className="text-muted">Cost</dt><dd className="text-base">{usd(ev.costUsd)}</dd></div>
              </dl>
              <div className="mt-5 flex flex-wrap gap-2">
                <GameButton variant="primary" icon={<Pencil className="size-4" />} onClick={onAgain}>Redesign</GameButton>
                <GameButton variant="outline" icon={<RotateCcw className="size-4" />} onClick={onRetry}>Fly again (new dice)</GameButton>
                <GameButton variant="ghost" onClick={() => setCrew((c) => !c)}>{crew ? "Back to trajectory" : "Meet the commander"}</GameButton>
              </div>
            </div>
          )}
        </GlassPanel>
        <GlassPanel className="min-h-[520px] overflow-hidden p-0">
          {crew ? (
            <Scene3D camera={[0, 1, 5]} label={result.success ? "Commander celebrating" : "Commander waiting"}>
              <Astronaut suit="#e8eef7" pose={result.success ? "celebrate" : "idle"} position={[0, -1, 0]} />
            </Scene3D>
          ) : (
            <TrajectorySim key={`${result.score}-${result.reached}-${ev.destination.id}`} traj={traj} onUpdate={onUpdate} startAtEnd={seenEnd} startU={traj.mode === "moon" ? traj.markers.seg1 * (fromTli ? 1 : 0.35) : 0} className="h-full min-h-[520px]" />
          )}
        </GlassPanel>
      </div>
    </ScreenContainer>
  );
}
