"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { useUIStore } from "@/stores";
import { playVoice, stopVoice, audioContext, type VoiceId } from "@/lib/voice";
import { RocketSound, SpaceHum, playSfx } from "@/lib/sfx";
import { useProgress } from "@/game/progress";
import { usePlayerStore } from "@/stores";
import { RULES } from "@/game/launch/core";
import { RotateCcw } from "lucide-react";
import { GameButton, GlassPanel } from "@/components/ui";
import { cn } from "@/lib/mission";
import { destinationById } from "@/game/data";
import { TLI, scoreFlight, type Flight } from "@/game/launch/core";
import { mulberry32 } from "@/game/engine";
import { buildTrajectory } from "@/game/trajectory";
import { TrajectorySim } from "./TrajectorySim";

const fmt = (n: number, d = 0) => n.toLocaleString("en-US", { maximumFractionDigits: d });

/** After translunar injection: coast to the Moon and capture into lunar orbit (Earth→Moon trajectory view, dice on the remaining phases). */
export function MoonLeg({ flight, onAgain, onExit, onResult }: { flight: Flight; onAgain: () => void; onExit: () => void; onResult?: (r: { captured: boolean }) => void }) {
  const moon = destinationById("moon")!;
  const plan = useMemo(() => {
    const rnd = mulberry32((flight.seed ^ 0x9e3779b9) >>> 0);
    const err = Math.min(1, Math.abs(flight.tliErr ?? 0) / TLI.windowFailRad);
    const cruiseP = 0.985, loiP = Math.min(0.97, 0.93 + 0.04 * (1 - err) + 0.02 * (1 - Math.min(1, Math.abs((flight.tliRatio ?? 1) - 1) / (TLI.tolHigh - 1))));
    const cruiseOk = rnd() < cruiseP, loiOk = cruiseOk && rnd() < loiP;
    return { cruiseP, loiP, cruiseOk, loiOk, failIndex: (!cruiseOk ? 1 : !loiOk ? 2 : null) as 1 | 2 | null };
  }, [flight]);
  const traj = useMemo(() => buildTrajectory(moon, plan.failIndex), [moon, plan.failIndex]);
  const [u, setU] = useState(0);
  const [seenEnd, setSeenEnd] = useState(false);
  const muted = useUIStore((st) => st.muted);
  const [voice, setVoice] = useState(!muted);
  const called = useRef(new Set<string>());
  useEffect(() => { // flight director callouts along the coast, once each
    const { seg1, seg2 } = traj.markers;
    const say = (key: string, id: VoiceId) => { if (called.current.has(key)) return; called.current.add(key); void playVoice(id, !voice); };
    if (u > seg1 + 1e-3) say("coast", "coast");
    if (u >= seg1 + 0.4 * (seg2 - seg1)) say("mid", "midcourse");
    if (u >= seg2) say("approach", "approach");
    if (seenEnd) say("end", plan.loiOk ? "captured" : "lostcontact");
  }, [u, seenEnd, traj, plan.loiOk, voice]);
  // coast sound: cabin ambience all the way, engine for the mid-course correction and the lunar-orbit-insertion burn, chime or explosion at the end
  const engine = useRef<RocketSound | null>(null), hum = useRef<SpaceHum | null>(null), lastMove = useRef(0), fx = useRef(new Set<string>());
  useEffect(() => {
    const c = audioContext(); if (!c) return;
    if (!voice) { engine.current?.silence(); hum.current?.set(false); return; }
    engine.current ??= new RocketSound(c); hum.current ??= new SpaceHum(c);
    const { seg1, seg2 } = traj.markers, mid = seg1 + 0.4 * (seg2 - seg1);
    lastMove.current = performance.now();
    const burn = (u >= mid && u < mid + 0.012) || (u >= seg2 + 0.01 && u < traj.reveal[2]);
    engine.current.update(burn ? 0.55 : 0, 4e8, 0, burn);
    hum.current.set(true);
    if (seenEnd && !fx.current.has("end")) { fx.current.add("end"); engine.current.silence(); playSfx(plan.loiOk ? "chime" : "explosion"); }
  }, [u, seenEnd, traj, plan.loiOk, voice]);
  const reported = useRef(false);
  useEffect(() => { if (seenEnd && !reported.current) { reported.current = true; onResult?.({ captured: plan.loiOk }); } }, [seenEnd, plan.loiOk, onResult]);
  const counted = useRef(false);
  useEffect(() => { // a captured Moon mission counts toward cosmetic unlocks, once
    if (!seenEnd || !plan.loiOk || counted.current) return;
    counted.current = true;
    const d = (["easy", "medium", "hard"] as const).find((k) => RULES[k] === flight.rules) ?? "easy";
    const names = useProgress.getState().recordMoonCapture(d, usePlayerStore.getState().profile.progression.level);
    if (names.length) useUIStore.getState().toast(`Cosmetic unlocked: ${names.join(", ")}`, "success");
  }, [seenEnd, plan.loiOk, flight.rules]);
  useEffect(() => { // the engine falls silent when the playback pauses or ends
    const id = setInterval(() => { if (performance.now() - lastMove.current > 500) { engine.current?.silence(); hum.current?.set(false); } }, 250);
    return () => clearInterval(id);
  }, []);
  useEffect(() => () => { stopVoice(); engine.current?.dispose(); hum.current?.dispose(); engine.current = null; hum.current = null; }, []);
  const onUpdate = useCallback((nu: number, d: boolean) => { setU(nu); if (d) setSeenEnd(true); }, []);
  const show = (i: number) => seenEnd || u >= traj.reveal[i] - 1e-6;
  const base = scoreFlight(flight), mult = flight.rules.scoreMult;
  const bonus = plan.loiOk ? 350 : plan.cruiseOk ? 100 : 0;
  const total = Math.round((base.base + bonus) * mult), max = Math.round((1300 + 350) * mult), frac = total / max;
  const grade = plan.loiOk ? (frac >= 0.85 ? "S" : frac >= 0.7 ? "A" : frac >= 0.55 ? "B" : "C") : "D";
  const rows: { id: string; label: string; ok: boolean; story: string; shown: boolean }[] = [
    { id: "ascent", label: "Ascent & parking orbit", ok: true, shown: true, story: `${flight.rocket.name} reached a ${fmt(flight.park?.periKm ?? 0)} × ${fmt(flight.park?.apoKm ?? 0)} km parking orbit.` },
    { id: "tli", label: "Translunar injection", ok: true, shown: true, story: `${flight.rocket.stageNames[flight.rocket.s3 ? 2 : 1]} burn put you on a ${fmt((flight.tel.apoKm))} km-apogee transfer to the Moon (window error ${fmt(Math.abs((flight.tliErr ?? 0) * 180 / Math.PI), 1)}°).` },
    { id: "coast", label: `Translunar coast · ${fmt(traj.transferDays, 1)} days`, ok: plan.cruiseOk, shown: show(1), story: plan.cruiseOk ? "Trajectory corrections on target; the Moon is ahead." : "Spacecraft lost contact during the coast (subsystem fault)." },
    ...(plan.cruiseOk ? [{ id: "loi", label: "Lunar orbit insertion", ok: plan.loiOk, shown: show(2), story: plan.loiOk ? "Service-propulsion burn behind the Moon — captured into lunar orbit!" : "Insertion burn failed; the spacecraft flew past the Moon." }] : []),
    ...(plan.loiOk ? [{ id: "orbit", label: "In lunar orbit", ok: true, shown: show(3), story: "Mission to the Moon complete." }] : []),
  ];
  const finished = seenEnd;
  return (
    <main className="relative mx-auto flex w-full max-w-[1500px] flex-1 flex-col gap-4 px-4 pb-8 pt-4 md:px-8">
      <header><p className="hud-label !text-orange">Moon mission · {flight.rocket.name} · {flight.rules.name}</p>
        <button type="button" aria-label={voice ? "Mute flight director voice" : "Unmute flight director voice"} aria-pressed={voice} onClick={() => { if (voice) stopVoice(); setVoice((v) => !v); }} className="float-right rounded-md border border-white/15 p-2 text-ink2 hover:text-ink">{voice ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}</button>
        <h1 className="text-3xl font-bold md:text-5xl">{finished ? (plan.loiOk ? "Mission to the Moon: success" : "Mission lost on the way") : "Translunar coast"}</h1></header>
      <div className="grid gap-4 xl:grid-cols-[minmax(320px,430px)_1fr]">
        <GlassPanel className="p-5">
          <ol className="space-y-3" aria-live="polite">
            {rows.filter((r) => r.shown).map((r) => (
              <li key={r.id} className="enter flex gap-3">
                <span aria-hidden className={cn("mt-0.5 grid size-6 shrink-0 place-items-center rounded-sm border text-sm", r.ok ? "border-ok text-ok" : "border-bad text-bad")}>{r.ok ? "✓" : "✕"}</span>
                <div><p className="font-display text-lg uppercase tracking-wider">{r.label}</p><p className="text-sm text-ink2">{r.story}</p></div>
              </li>
            ))}
            {!finished && <li className="text-sm text-muted">Tracking spacecraft…</li>}
          </ol>
          {finished && (
            <div className="enter mt-6 border-t border-[var(--border)] pt-4">
              <div className="flex items-end gap-6">
                <div><p className="hud-label">Score</p><p className="font-display text-6xl font-bold leading-none text-orange tabular-nums">{total}</p></div>
                <div><p className="hud-label">Grade</p><p className="font-display text-6xl font-bold leading-none">{grade}</p></div>
                <p className="pb-1 text-xs text-muted">×{mult} {flight.rules.name} · of {max}</p>
              </div>
              <p className="mt-2 text-xs text-ink2">Ascent + TLI {fmt(base.base * mult)}, lunar leg {fmt(bonus * mult)}. Odds on the lunar leg were {fmt(plan.cruiseP * 100)} % (coast) and {fmt(plan.loiP * 100)} % (insertion, better with a well-centred TLI burn).</p>
              <div className="mt-5 flex flex-wrap gap-2">
                <GameButton variant="primary" icon={<RotateCcw className="size-4" />} onClick={onAgain}>Fly again</GameButton>
                <GameButton variant="outline" onClick={onExit}>Change setup</GameButton>
              </div>
            </div>
          )}
        </GlassPanel>
        <GlassPanel className="min-h-[520px] overflow-hidden p-0">
          <TrajectorySim traj={traj} onUpdate={onUpdate} startU={traj.markers.seg1} className="h-full min-h-[520px]" />
        </GlassPanel>
      </div>
    </main>
  );
}
