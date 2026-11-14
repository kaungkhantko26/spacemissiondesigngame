"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Lock, Radio, Weight, Zap, Check } from "lucide-react";
import {
  BackButton, GameButton, GlassPanel, LoadingBar, PlayerAvatar, ScreenContainer, StatBar, StatusPill,
} from "@/components/ui";
import { Astronaut, CrewLineup, MissionHangar, OrbitalVisualization, PlanetModel, Scene3D } from "@/components/three/lazy";
import { hydrateTeamSetup, useCrewSelectionStore, useLobbyStore, useMissionSetupStore, useUIStore } from "@/stores";
import { useLobby } from "./Team";
import { useLook } from "./Core";
import { cn, missionAvailability, roleCounts } from "@/lib/mission";
import { characters, difficulties, missions, modifiers, players, traits, telemetrySeed } from "@/data/mock";
import { lobbyService, missionTelemetryService } from "@/services/mocks";
import type { Character, DifficultyId, HudState, Mission, MissionModifier, MissionTelemetry, RoleId } from "@/types";
import { cosmetics } from "@/data/mock";
import { AscentFlight } from "@/components/game/LaunchControl";
import { LaunchSession } from "@/game/launch/session";
import { scoreFlight, type Difficulty as LaunchDifficulty } from "@/game/launch/core";
import { useTeamResult } from "@/game/launch/teamResult";
import { useProgress } from "@/game/progress";
import { usePlayerStore } from "@/stores";

/* ---------- shared hooks ---------- */
function useSetup() {
  const router = useRouter();
  const { missionId, difficultyId } = useMissionSetupStore();
  const mission = missions.find((m) => m.id === missionId) ?? null;
  const difficulty = difficulties.find((d) => d.id === difficultyId)!;
  const [ready, setReady] = useState(false);
  useEffect(() => { void hydrateTeamSetup().then(() => setReady(true)); }, []);
  useEffect(() => { if (ready && !mission) router.replace("/mission/select"); }, [ready, mission, router]);
  return { mission, difficulty, ready };
}
const mods = (m: Mission, d: DifficultyId): MissionModifier[] => m.modifiersByDifficulty[d].map((id) => modifiers.find((x) => x.id === id)!).filter(Boolean);
const modIcon = { power: Zap, radio: Radio, weight: Weight, alert: AlertTriangle } as const;
const sevLabel = { low: "▪ Low", medium: "▪▪ Medium", high: "▪▪▪ High" } as const;

function MissionSummary({ mission, difficultyId }: { mission: Mission; difficultyId: DifficultyId }) {
  return (
    <GlassPanel className="p-4 text-sm">
      <p className="font-display text-lg font-bold">{mission.name}</p>
      <p className="text-ink2 capitalize">Difficulty: {difficultyId}</p>
      <p className="text-muted">{mission.durationMinutes[0]}–{mission.durationMinutes[1]} min (est.)</p>
    </GlassPanel>
  );
}

/* ---------- Mission select ---------- */
export function MissionSelectScreen() {
  const router = useRouter();
  const lobby = useLobby();
  const { difficultyId, missionId, setDifficulty, setMission } = useMissionSetupStore();
  const count = lobby?.members.length ?? 1;
  const d = difficulties.find((x) => x.id === difficultyId)!;
  const sel = missions.find((m) => m.id === missionId);
  const valid = !!sel && missionAvailability(sel, difficultyId, count).available;
  return (
    <ScreenContainer step={2} title="Mission Selection" subtitle="Availability rules shown here are mock configuration, not game validation." actions={<BackButton href="/team/lobby" />}>
      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <GlassPanel className="h-fit p-4">
          <h2 className="mb-2 text-lg font-bold">Difficulty</h2>
          <div role="radiogroup" aria-label="Difficulty" className="grid gap-2">
            {difficulties.map((x) => (
              <button key={x.id} role="radio" aria-checked={x.id === difficultyId} onClick={() => setDifficulty(x.id)}
                className={cn("rounded-lg border px-3 py-2 text-left", x.id === difficultyId ? "border-orange bg-orange/10" : "border-white/10 hover:border-cyan/50")}>
                <span className="font-semibold">{x.label}</span> <span className="text-xs text-gold">{x.xpMultiplier}× XP</span>
              </button>
            ))}
          </div>
          <p className="mt-3 text-sm text-ink2">{d.description}</p>
          <p className="mt-1 text-xs text-muted">Modifiers: {d.modifierSummary}</p>
        </GlassPanel>
        <div className="grid gap-4">
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {missions.map((m, i) => {
              const a = missionAvailability(m, difficultyId, count);
              return (
                <li key={m.id} className="enter lift" style={{ animationDelay: `${i * 70}ms` }}>
                  <button onClick={() => a.available && setMission(m.id)} aria-disabled={!a.available} aria-pressed={missionId === m.id}
                    className={cn("h-full w-full text-left", !a.available && "cursor-not-allowed")}>
                    <GlassPanel active={missionId === m.id} className={cn("flex h-full flex-col overflow-hidden", !a.available && "opacity-60")}>
                      <div className="h-28"><Scene3D stars={false} camera={[0, 0, 4]} label={`${m.name} preview`}><PlanetModel kind={m.body} radius={1.3} /></Scene3D></div>
                      <div className="flex flex-1 flex-col gap-1 p-3">
                        <p className="font-display font-bold">{m.name} {!a.available && <Lock className="inline size-4" aria-label="Unavailable" />}</p>
                        <p className="text-xs text-ink2">{m.summary}</p>
                        <p className="text-xs text-muted">{m.category} · {m.minPlayers}–{m.maxPlayers} players · {m.durationMinutes[0]}–{m.durationMinutes[1]} min</p>
                        <p className="text-xs text-muted">Difficulties: {m.supportedDifficulties.join(", ") || "TBD"}</p>
                        {!a.available && <p className="mt-auto text-xs text-warn">⚠ {a.reason}</p>}
                      </div>
                    </GlassPanel>
                  </button>
                </li>
              );
            })}
          </ul>
          <GlassPanel className="p-4">
            {sel ? (
              <div className="grid gap-3 md:grid-cols-3">
                <div><h2 className="text-xl font-bold">{sel.name}</h2><p className="text-sm text-ink2">{sel.summary}</p></div>
                <div><p className="text-sm font-semibold">Goals</p><ul className="list-disc pl-5 text-sm text-ink2">{sel.objectives.map((o) => <li key={o}>{o}</li>)}</ul></div>
                <div className="text-sm text-ink2"><p className="font-semibold text-ink">Crew & rewards</p><p>{sel.roleTemplate.map((r) => `${r.required}× ${r.name}`).join(", ")}</p><p>Rewards: {sel.rewards.map((r) => r.label).join(", ")} ({d.xpMultiplier}× XP)</p></div>
              </div>
            ) : <p className="text-sm text-muted">Select an available mission to see details.</p>}
          </GlassPanel>
          <div className="flex justify-end"><GameButton variant="primary" disabled={!valid} onClick={() => router.push("/mission/briefing")}>Continue</GameButton></div>
        </div>
      </div>
    </ScreenContainer>
  );
}

/* ---------- Briefing ---------- */
export function BriefingScreen() {
  const router = useRouter();
  const { mission, difficulty } = useSetup();
  if (!mission) return null;
  const list = mods(mission, difficulty.id);
  return (
    <ScreenContainer step={3} title="Mission Briefing" subtitle={`${mission.name} · ${difficulty.label} · ${difficulty.xpMultiplier}× XP`} actions={<BackButton href="/mission/select" />}>
      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <GlassPanel className="p-5"><h2 className="mb-2 text-xl font-bold">Objectives</h2><ul className="list-disc pl-5 text-ink2">{mission.objectives.map((o) => <li key={o}>{o}</li>)}</ul>
          <h2 className="mb-2 mt-5 text-xl font-bold">Possible rewards</h2><ul className="text-sm text-ink2">{mission.rewards.map((r) => <li key={r.id}>{r.kind === "cosmetic" ? "🎖 " : "★ "}{r.label}</li>)}</ul></GlassPanel>
        <div className="grid gap-3">
          {list.length === 0 ? <GlassPanel className="p-6"><p className="font-display text-lg font-bold text-ok">✓ No modifiers active</p><p className="text-sm text-ink2">Easy mode runs without mission modifiers.</p></GlassPanel>
            : <ul className="grid gap-3 sm:grid-cols-2">{list.map((m) => { const I = modIcon[m.icon]; return (
              <li key={m.id}><GlassPanel className="h-full p-4"><I className="size-6 text-orange" aria-hidden /><p className="mt-2 font-bold">{m.name}</p><p className="text-sm text-ink2">{m.description}</p><p className="mt-2 text-xs text-muted">System: {m.affectedSystem} · Severity {sevLabel[m.severity]}</p></GlassPanel></li>); })}</ul>}
          {difficulty.optionalChallenges && (
            <GlassPanel className="border-gold/50 p-4"><h2 className="font-bold text-gold">Hard-mode challenges</h2><ul className="list-disc pl-5 text-sm text-ink2">{mission.challengeObjectives.map((c) => <li key={c}>{c}</li>)}</ul><p className="mt-2 text-xs text-muted">Complete challenges for exclusive cosmetics (mock).</p></GlassPanel>)}
        </div>
      </div>
      <div className="flex justify-end"><GameButton variant="primary" onClick={() => router.push("/mission/roles")}>Continue to Roles</GameButton></div>
    </ScreenContainer>
  );
}

/* ---------- Roles ---------- */
const ME = "p1";
function crewOf(lobbyIds: string[]) { return useCrewSelectionStore.getState().assignments; void lobbyIds; }

export function RolesScreen() {
  const router = useRouter();
  const { mission, difficulty } = useSetup();
  const lobby = useLobby();
  const ids = useMemo(() => lobby?.members.map((m) => m.playerId) ?? [ME], [lobby]);
  const { assignments, ensure, chooseRole, confirmRole } = useCrewSelectionStore();
  const toast = useUIStore((s) => s.toast);
  const [focus, setFocus] = useState<RoleId | null>(null);
  useEffect(() => ensure(ids), [ids, ensure]);
  if (!mission) return null;
  const list = ids.map((id) => assignments[id]).filter(Boolean);
  const counts = roleCounts(list.filter((a) => a.roleId));
  const mine = assignments[ME];
  const detail = mission.roleTemplate.find((r) => r.id === focus);
  const fillOthers = () => {
    const c = { ...counts };
    ids.filter((id) => id !== ME && !assignments[id]?.roleId).forEach((id) => {
      const r = mission.roleTemplate.find((x) => c[x.id] < x.required);
      if (r) { chooseRole(id, r.id); confirmRole(id); c[r.id]++; }
    });
    toast("Other crew members assigned (mock)", "success");
  };
  const done = mine?.confirmedRole;
  return (
    <ScreenContainer step={4} title="Role Assignment" subtitle="Capacity shown is mock — the backend will enforce it." actions={<BackButton href="/mission/briefing" />}>
      <div className="grid gap-4 lg:grid-cols-[260px_1fr_300px]">
        <div className="grid h-fit gap-3">
          <MissionSummary mission={mission} difficultyId={difficulty.id} />
          <GlassPanel className="p-4 text-sm"><p className="mb-2 font-semibold">Crew slots</p>
            <ul className="grid gap-1">{ids.map((id) => { const p = players.find((x) => x.id === id)!; const a = assignments[id]; return <li key={id} className="flex justify-between"><span>{p.username}</span><span className="text-ink2 capitalize">{a?.roleId ?? "—"}{a?.confirmedRole ? " ✓" : ""}</span></li>; })}</ul></GlassPanel>
          <GameButton variant="outline" onClick={fillOthers}>Auto-assign others (demo)</GameButton>
        </div>
        <ul className="grid h-fit gap-3 sm:grid-cols-2">
          {mission.roleTemplate.map((r) => {
            const full = counts[r.id] >= r.required && mine?.roleId !== r.id;
            return (
              <li key={r.id}>
                <button onClick={() => { setFocus(r.id); if (full) toast(`${r.name} is full`, "error"); else if (!done) chooseRole(ME, r.id); }} aria-pressed={mine?.roleId === r.id} aria-disabled={full}
                  className="w-full text-left"><GlassPanel active={mine?.roleId === r.id} className={cn("p-4", full && "opacity-60")}>
                    <p className="font-display text-lg font-bold">{r.name}</p><p className="text-sm text-ink2">{r.description}</p>
                    <p className="mt-2 text-xs text-muted">Assigned {counts[r.id]}/{r.required} · {full ? "Full" : "Available"}</p>
                  </GlassPanel></button>
              </li>);
          })}
        </ul>
        <GlassPanel className="h-fit p-4">
          {detail ? <><h2 className="text-lg font-bold">{detail.name}</h2><ul className="mt-2 list-disc pl-5 text-sm text-ink2">{detail.responsibilities.map((x) => <li key={x}>{x}</li>)}</ul></> : <p className="text-sm text-muted">Select a role to see its responsibilities.</p>}
          <GameButton className="mt-4 w-full" variant="primary" disabled={!mine?.roleId} onClick={() => { if (done) useCrewSelectionStore.setState((s) => ({ assignments: { ...s.assignments, [ME]: { ...s.assignments[ME], confirmedRole: false } } })); else confirmRole(ME); }}>
            {done ? "Change role" : "Confirm role"}</GameButton>
        </GlassPanel>
      </div>
      <div className="flex justify-end"><GameButton variant="primary" disabled={!done} onClick={() => router.push("/mission/characters")}>Continue to Characters</GameButton></div>
    </ScreenContainer>
  );
}

/* ---------- Characters ---------- */
const STAT_LABEL: Record<keyof Character["stats"], string> = { research: "Research", analysis: "Analysis", communication: "Communication", maintenance: "Maintenance", coordination: "Coordination" };
export function CharactersScreen() {
  const router = useRouter();
  const { mission, difficulty, ready } = useSetup();
  const lobby = useLobby();
  const ids = useMemo(() => lobby?.members.map((m) => m.playerId) ?? [ME], [lobby]);
  const { assignments, ensure, chooseCharacter, confirmCharacter } = useCrewSelectionStore();
  const toast = useUIStore((s) => s.toast);
  const [view, setView] = useState<string | null>(null);
  const [cmp, setCmp] = useState<string | null>(null);
  useEffect(() => ensure(ids), [ids, ensure]);
  const mine = assignments[ME];
  const roster = characters.filter((c) => c.role === mine?.roleId);
  useEffect(() => { if (ready && mine && !mine.roleId) router.replace("/mission/roles"); }, [ready, mine, router]);
  if (!mission || !mine?.roleId) return null;
  const shown = characters.find((c) => c.id === (view ?? mine.characterId ?? roster[0]?.id))!;
  const other = characters.find((c) => c.id === cmp);
  const fillOthers = () => {
    const taken = new Set(ids.map((i) => assignments[i]?.characterId).filter(Boolean));
    ids.filter((id) => id !== ME && !assignments[id]?.confirmedCharacter).forEach((id) => {
      const a = assignments[id]; if (!a?.roleId) return;
      const c = characters.find((x) => x.role === a.roleId && !taken.has(x.id));
      if (c) { taken.add(c.id); chooseCharacter(id, c.id); confirmCharacter(id); }
    });
    toast("Other crew characters chosen (mock)", "success");
  };
  const locked = mine.confirmedCharacter;
  return (
    <ScreenContainer step={5} title="Character Selection" subtitle={`Role: ${mine.roleId} — trait effects are not simulated here.`} actions={<BackButton href="/mission/roles" />}>
      <div className="grid gap-4 lg:grid-cols-[240px_1fr_360px]">
        <div className="grid h-fit gap-3"><MissionSummary mission={mission} difficultyId={difficulty.id} />
          <GlassPanel className="p-4 text-sm"><p className="mb-1 font-semibold">Crew</p>{ids.map((id) => { const a = assignments[id]; const ch = characters.find((c) => c.id === a?.characterId); return <p key={id} className="flex justify-between"><span>{players.find((p) => p.id === id)?.username}</span><span className="text-ink2">{ch?.name.split(" ").slice(-1)[0] ?? "—"}{a?.confirmedCharacter ? " ✓" : ""}</span></p>; })}</GlassPanel>
          <GameButton variant="outline" onClick={fillOthers}>Auto-pick others (demo)</GameButton></div>
        <GlassPanel className="flex min-h-[460px] flex-col p-3">
          <div className="min-h-0 flex-1"><Scene3D controls camera={[0, 1, 5]} label={`${shown.name} 3D preview`}><Astronaut suit={shown.suitColor} skin={shown.skinTone} accent={shown.accent} position={[0, -1, 0]} /></Scene3D></div>
          <div className="px-2 pb-2"><h2 className="text-2xl font-bold">{shown.name}</h2><p className="text-cyan">{shown.specialization}</p><p className="text-sm text-ink2">{shown.bio}</p></div>
        </GlassPanel>
        <div className="grid h-fit gap-3">
          <GlassPanel className="p-3"><ul role="listbox" aria-label="Character roster" className="grid gap-2">
            {roster.map((c) => (
              <li key={c.id} role="option" aria-selected={c.id === shown.id}>
                <button onClick={() => !locked && setView(c.id)} className={cn("flex w-full items-center gap-3 rounded-lg border p-2 text-left", c.id === shown.id ? "border-cyan bg-cyan/10" : "border-white/10")}>
                  <span className="size-8 rounded-full" style={{ background: c.suitColor }} aria-hidden /><span><span className="block text-sm font-semibold">{c.name}</span><span className="text-xs text-muted">{c.specialization}</span></span>
                  {mine.characterId === c.id && <Check className="ml-auto size-4 text-ok" aria-label="Selected" />}
                </button>
              </li>))}</ul></GlassPanel>
          <GlassPanel className="p-4"><div className="grid gap-2">{(Object.keys(STAT_LABEL) as (keyof Character["stats"])[]).map((k) => <StatBar key={k} label={STAT_LABEL[k]} value={shown.stats[k]} />)}</div>
            <div className="mt-3 flex flex-wrap gap-1">{shown.traitIds.map((t) => { const tr = traits.find((x) => x.id === t)!; return <span key={t} title={tr.description} className="rounded-full bg-gold/15 px-2 py-0.5 text-xs text-gold">{tr.name}</span>; })}</div>
            <p className="mt-2 text-xs text-ok">＋ {shown.strengths.join(", ")}</p><p className="text-xs text-bad">− {shown.weaknesses.join(", ")}</p>
            <div className="mt-3 flex items-center gap-2 text-xs"><label htmlFor="cmp" className="text-muted">Compare with</label>
              <select id="cmp" value={cmp ?? ""} onChange={(e) => setCmp(e.target.value || null)} className="rounded bg-black/40 px-2 py-1">
                <option value="">—</option>{roster.filter((c) => c.id !== shown.id).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
            {other && <ul className="mt-2 text-xs text-ink2">{(Object.keys(STAT_LABEL) as (keyof Character["stats"])[]).map((k) => { const d = shown.stats[k] - other.stats[k]; return <li key={k} className="flex justify-between"><span>{STAT_LABEL[k]}</span><span className={d > 0 ? "text-ok" : d < 0 ? "text-bad" : ""}>{d > 0 ? `+${d}` : d} vs {other.name.split(" ").slice(-1)[0]}</span></li>; })}</ul>}
          </GlassPanel>
          <GameButton variant="primary" onClick={() => { if (locked) useCrewSelectionStore.setState((s) => ({ assignments: { ...s.assignments, [ME]: { ...s.assignments[ME], confirmedCharacter: false } } })); else { chooseCharacter(ME, shown.id); confirmCharacter(ME); toast(`${shown.name} selected`, "success"); } }}>{locked ? "Change character" : "Confirm selection"}</GameButton>
        </div>
      </div>
      <div className="flex justify-end"><GameButton variant="primary" disabled={!locked} onClick={() => router.push("/mission/confirm")}>Review Crew</GameButton></div>
    </ScreenContainer>
  );
}

/* ---------- Confirm ---------- */
export function ConfirmScreen() {
  const router = useRouter();
  const { mission, difficulty } = useSetup();
  const lobby = useLobby();
  const look = useLook(); // your own equipped cosmetics show on your crew member
  const assignments = useCrewSelectionStore((s) => s.assignments);
  if (!mission || !lobby) return null;
  const crew = lobby.members.map((m) => ({ m, p: players.find((x) => x.id === m.playerId)!, a: assignments[m.playerId], c: characters.find((x) => x.id === assignments[m.playerId]?.characterId) }));
  const complete = crew.every((x) => x.a?.roleId && x.c);
  const allReady = lobby.members.every((m) => m.ready);
  const canLaunch = complete && allReady;
  return (
    <ScreenContainer step={6} title="Crew Ready" subtitle="Launching starts a demo transition only — no real simulation." actions={<BackButton href="/mission/characters" label="Edit crew" />}>
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <GlassPanel className="h-[380px] overflow-hidden p-0">
          <Scene3D light="hangar" camera={[0, 0.8, 6.5]} label="Crew lineup in hangar"><MissionHangar />
            <CrewLineup crew={crew.map((x) => x.c ? { suit: x.p.id === ME ? look.suit : x.c.suitColor, skin: x.c.skinTone, accent: x.p.id === ME ? look.accent : x.c.accent, pose: x.m.ready ? "ready" : "idle" } : null)} /></Scene3D>
        </GlassPanel>
        <GlassPanel className="p-4 text-sm"><h2 className="font-display text-xl font-bold">{mission.name}</h2><p className="capitalize text-ink2">{difficulty.label} · {difficulty.xpMultiplier}× XP</p>
          <p className="mt-2 text-muted">Modifiers: {mods(mission, difficulty.id).map((m) => m.name).join(", ") || "None"}</p>
          <p className="mt-2 text-muted">Rewards: {mission.rewards.map((r) => r.label).join(", ")}</p>
          <ul className="mt-3 grid gap-2">{crew.map(({ m, p, a, c }) => (
            <li key={p.id} className="flex items-center gap-2 rounded-lg bg-white/5 p-2"><PlayerAvatar player={p} size={28} />
              <span className="flex-1">{p.username}<span className="block text-xs text-muted capitalize">{a?.roleId ?? "No role"} · {c?.name ?? "No character"}</span></span>
              <button aria-pressed={m.ready} onClick={() => void lobbyService.setReady(p.id, !m.ready)} className={cn("rounded-md border px-3 py-0.5 text-xs", m.ready ? "border-ok text-ok" : "border-white/20 text-ink2")}>{m.ready ? "✓ Ready" : "Not ready"}</button></li>))}</ul></GlassPanel>
      </div>
      {!canLaunch && <p role="status" className="text-sm text-warn">⚠ {!complete ? "Every player needs a role and character (use the demo auto-fill buttons)." : "All players must be ready."}</p>}
      <div className="flex flex-wrap justify-end gap-2">
        <GameButton variant="outline" onClick={() => lobby.members.forEach((m) => void lobbyService.setReady(m.playerId, true))}>Ready everyone (demo)</GameButton>
        <GameButton variant="primary" disabled={!canLaunch} onClick={() => router.push("/mission/loading")}>Launch Mission</GameButton>
      </div>
    </ScreenContainer>
  );
}

/* ---------- Loading (demo) ---------- */
export function MissionLoadingScreen() {
  const router = useRouter();
  const { mission } = useSetup();
  const [p, setP] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setP((x) => Math.min(100, x + 4)), 120);
    return () => clearInterval(id);
  }, []);
  useEffect(() => { if (p >= 100) router.replace("/mission/gameplay"); }, [p, router]);
  if (!mission) return null;
  return (
    <main className="grid min-h-screen place-items-center px-6 text-center">
      <div className="w-full max-w-xl">
        <div className="mx-auto h-64 w-64"><Scene3D camera={[0, 0, 5]} light="orbit" label="Destination"><PlanetModel kind={mission.body} radius={1.4} /></Scene3D></div>
        <h1 className="text-4xl font-bold">{mission.name}</h1>
        <p className="mt-1 text-ink2">Preparing mission interface…</p>
        <div className="mt-6"><LoadingBar value={p} /></div>
        <p className="mt-2 text-xs text-muted">Demonstration transition — not real asset-loading progress. ({p}%)</p>
      </div>
    </main>
  );
}

/* ---------- Gameplay HUD shell ---------- */
const stateColor: Record<HudState, string> = { normal: "bg-ok", warning: "bg-warn", critical: "bg-bad", loading: "bg-cyan" };
function Meter({ label, v, unit }: { label: string; v: { value: number; max: number; state: HudState }; unit: string }) {
  return (
    <div><div className="flex justify-between text-xs"><span>{label}</span><StatusPill state={v.state}>{v.state}</StatusPill></div>
      <div className="mt-1 h-2 rounded-sm bg-white/10" role="meter" aria-label={label} aria-valuenow={Math.round(v.value)} aria-valuemin={0} aria-valuemax={v.max}><div className={cn("h-full rounded-full", stateColor[v.state])} style={{ width: `${Math.min(100, (v.value / v.max) * 100)}%` }} /></div>
      <p className="text-xs text-muted">{Math.round(v.value)} / {v.max} {unit}</p></div>
  );
}
const MOON_VEHICLE = "ll2_cfg_93", ORBIT_VEHICLE = "ll2_cfg_164";
export function GameplayScreen() {
  const router = useRouter();
  const { mission, difficulty } = useSetup();
  const [attempt, setAttempt] = useState(0);
  const [started, setStarted] = useState(false);
  const kind: "orbit" | "moon" = mission?.body === "moon" ? "moon" : "orbit";
  const [seedBase] = useState(() => Math.floor(Math.random() * 1e9));
  const seed = seedBase + attempt;
  const session = useMemo(() => (started ? new LaunchSession(difficulty.id as LaunchDifficulty, "ll2_pad_87", kind === "moon" ? MOON_VEHICLE : ORBIT_VEHICLE, seed, undefined, kind) : null), [started, difficulty.id, kind, seed]);
  if (!mission) return null;
  const finish = () => {
    const names = useProgress.getState().recordTeamRun(usePlayerStore.getState().profile.progression.level);
    if (names.length) useUIStore.getState().toast(`Cosmetic unlocked: ${names.join(", ")}`, "success");
    if (session) {
      const sc = scoreFlight(session.flight);
      useTeamResult.getState().set({ missionId: mission.id, ok: sc.ok, score: sc.score, max: sc.max, grade: sc.grade, rocket: session.flight.rocket.name, maxQ: session.flight.maxQ, maxG: session.flight.maxG, flightS: session.flight.t, kind });
    }
    router.push("/mission/results");
  };
  if (session) return <AscentFlight key={attempt} session={session} onExit={finish} onAgain={() => { setAttempt((n) => n + 1); }} exitLabel="Finish mission" />;
  const crew = Object.values(useCrewSelectionStore.getState().assignments);
  return (
    <ScreenContainer title={mission.name} subtitle={`${difficulty.label} · real launch simulation${kind === "moon" ? " · Saturn V to the Moon" : ""}`}>
      <div className="grid gap-4 lg:grid-cols-2">
        <GlassPanel className="p-5 text-sm"><p className="font-semibold">Objectives</p>
          <ul className="mt-2 list-disc pl-5 text-ink2">{mission.objectives.map((o) => <li key={o}>{o}</li>)}</ul>
          <p className="mt-3 text-ink2">{kind === "moon" ? "Fly the real Saturn V from Kennedy: ascent, parking orbit, TLI burn in the window, then coast and lunar-orbit insertion." : `Fly a Falcon-class ascent from Kennedy to orbit. ${difficulty.label} rules decide how much the autopilot helps.`}</p></GlassPanel>
        <GlassPanel className="p-5 text-sm"><p className="font-semibold">Crew</p>
          {crew.length ? crew.map((a) => <p key={a.playerId} className="flex justify-between"><span>{players.find((p) => p.id === a.playerId)?.username}</span><span className="capitalize text-ink2">{a.roleId ?? "—"}</span></p>) : <p className="text-ink2">Solo flight</p>}
          <div className="mt-4"><GameButton variant="primary" onClick={() => setStarted(true)}>Go to the pad</GameButton></div></GlassPanel>
      </div>
    </ScreenContainer>
  );
}

/* ---------- Results ---------- */
import { resultSeed } from "@/data/mock";
export function ResultsScreen() {
  const router = useRouter();
  const r = resultSeed;
  const real = useTeamResult((x) => x.result);
  const resetAll = () => { useCrewSelectionStore.getState().reset(); useMissionSetupStore.getState().reset(); };
  return (
    <ScreenContainer title="Mission Results" subtitle={real ? `${real.rocket} · flown in the launch simulator` : "Illustrative mock data — the backend will provide authoritative results."}>
      <div className="grid gap-4 lg:grid-cols-3">
        <GlassPanel className="p-5"><p className="text-xs text-muted">STATUS</p>{real ? <><p className={cn("font-display text-3xl font-bold", real.ok ? "text-ok" : "text-bad")}>{real.ok ? (real.kind === "moon" ? "✓ Translunar injection" : "✓ Orbit achieved") : "✗ Mission lost"}</p><p className="mt-2 text-sm text-ink2">Score {real.score} / {real.max} · Grade {real.grade}</p><p className="text-sm text-ink2">Max-Q {(real.maxQ / 1000).toFixed(1)} kPa · Peak {real.maxG.toFixed(1)} g · T+{Math.round(real.flightS)} s</p></> : <p className="font-display text-3xl font-bold capitalize text-ok">✓ {r.status}</p>}
          {!real && <ul className="mt-3 text-sm text-ink2">{r.objectives.map((o) => <li key={o.label}>{o.done ? "✓" : "✗"} {o.label}</li>)}</ul>}</GlassPanel>
        <GlassPanel className="grid gap-3 p-5"><StatBar label="Science" value={r.science} max={100} /><StatBar label="Engineering" value={r.engineering} max={100} /><StatBar label="Resource efficiency" value={r.efficiency} max={100} tone="orange" /></GlassPanel>
        <GlassPanel className="p-5 text-sm"><p className="font-semibold">Crew contribution</p>{r.crewContribution.map((c) => <p key={c.playerId} className="flex justify-between"><span>{players.find((p) => p.id === c.playerId)?.username}</span><span>{c.percent}%</span></p>)}
          <p className="mt-3 text-gold">+{r.xpEarned} XP (mock)</p><p className="text-ink2">Cosmetics: {r.cosmeticRewards.map((id) => cosmetics.find((c) => c.id === id)?.name).join(", ")}</p></GlassPanel>
      </div>
      <div className="flex justify-end gap-2"><GameButton variant="outline" onClick={() => router.push("/mission/select")}>Replay mission</GameButton><GameButton variant="primary" onClick={() => { resetAll(); router.push("/menu"); }}>Return to main menu</GameButton></div>
    </ScreenContainer>
  );
}
void crewOf; void useLobbyStore;
