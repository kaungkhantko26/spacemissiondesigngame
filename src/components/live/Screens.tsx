"use client";
/** Live (real-backend) versions of the main flow screens, in the existing UI style. */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Crown, Lock, Wifi, WifiOff } from "lucide-react";
import { create } from "zustand";
import { BackButton, GameButton, GlassPanel, PlayerAvatar, ScreenContainer, StatBar, StatusPill } from "@/components/ui";
import { useGame } from "@/live/store";
import { Design } from "./Design";
import { Report } from "./Report";
import { Portrait } from "./Portrait";
import { cn } from "@/lib/mission";
import type { Difficulty, Room } from "@/live/types";

const swallow = (p: Promise<unknown>) => { p.catch(() => {}); };
const PALETTE = ["#4fc3f7", "#ff8c42", "#a78bfa", "#34d399", "#f472b6", "#fbbf24"];
const colorOf = (s: string) => PALETTE[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % PALETTE.length];

/** Which route each server state belongs to. Redirects so every player follows the room. */
type Stage = "entry" | "lobby" | "setup" | "roles" | "design" | "report";
function useGate(stage: Stage) {
  const router = useRouter(); const { boot, ready, room, profile } = useGame();
  useEffect(() => { void boot(); }, [boot]);
  const host = !!room && !!profile && room.hostId === profile.id;
  let target: string | null = null;
  if (ready) {
    if (!room) target = stage === "entry" ? null : "/team";
    else if (room.status === "design") target = stage === "design" ? null : "/mission/gameplay";
    else if (room.status === "report") target = stage === "report" ? null : "/mission/results";
    else if (room.status === "roles") target = stage === "roles" ? null : "/mission/roles";
    else if (stage === "entry") target = "/team/lobby";
    else if (stage === "setup" && !host) target = "/team/lobby";
    else if (stage === "lobby" || stage === "setup") target = null;
    else target = "/team/lobby";
  }
  useEffect(() => { if (target) router.replace(target); }, [target, router]);
  return { ready: ready && !target, room, host, profile };
}
const Wait = ({ children = "Connecting to the game server…" }: { children?: React.ReactNode }) => (
  <ScreenContainer title="Space Mission Design Game"><p role="status" className="text-ink2">{children}</p></ScreenContainer>
);
function ErrorBar() { const e = useGame((s) => s.error); return e ? <div role="alert" className="rounded-lg border border-bad/50 bg-bad/10 p-2 text-sm text-bad">{e}</div> : null; }

/* ---------- Team ---------- */
export function LiveTeam() {
  const router = useRouter(); const g = useGame(); const { ready } = useGate("entry");
  const [code, setCode] = useState(""); const [name, setName] = useState("");
  useEffect(() => { if (g.profile) setName(g.profile.name); }, [g.profile?.name]);
  if (!ready || !g.profile) return <Wait>{g.conn === "offline" ? "Can't reach the game server." : undefined}</Wait>;
  const go = (p: Promise<unknown>) => p.then(() => router.push("/team/lobby")).catch(() => {});
  const input = "rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-white";
  return (
    <ScreenContainer title="Team Up" subtitle="Create a room or join your crew with a 4-letter code." actions={<BackButton href="/menu" label="Main menu" />}>
      <ErrorBar />
      <div className="grid gap-4 md:grid-cols-3">
        <GlassPanel className="grid h-fit gap-3 p-6"><h2 className="text-xl font-bold">Your callsign</h2>
          <input className={input} maxLength={20} value={name} onChange={(e) => setName(e.target.value)} />
          <GameButton variant="outline" onClick={() => swallow(g.rename(name))}>Save name</GameButton></GlassPanel>
        <GlassPanel className="grid h-fit gap-3 p-6"><h2 className="text-xl font-bold">Create Lobby</h2><p className="text-sm text-ink2">Host a crew of up to four players.</p>
          <GameButton variant="primary" onClick={() => void go(g.createRoom())}>Create room</GameButton></GlassPanel>
        <GlassPanel className="grid h-fit gap-3 p-6"><h2 className="text-xl font-bold">Join with Code</h2>
          <input className={cn(input, "uppercase tracking-widest")} placeholder="ABCD" maxLength={4} value={code} onChange={(e) => setCode(e.target.value)} />
          <GameButton variant="primary" disabled={code.length < 4} onClick={() => void go(g.joinRoom(code))}>Join</GameButton></GlassPanel>
      </div>
    </ScreenContainer>
  );
}

/* ---------- Lobby ---------- */
export function LiveLobby() {
  const router = useRouter(); const g = useGame(); const { ready, room, host } = useGate("lobby");
  const [copied, setCopied] = useState(false);
  if (!ready || !room) return <Wait />;
  const slots = Array.from({ length: 4 }, (_, i) => room.members[i] ?? null);
  return (
    <ScreenContainer step={1} title="Mission Crew Lobby" subtitle="Share the code so your crew can join." actions={<BackButton href="/team" label="Leave" />}>
      <ErrorBar />
      <GlassPanel className="flex flex-wrap items-center gap-3 p-4">
        <span className="font-display text-3xl tracking-widest text-gold" aria-label={`Room code ${room.code}`}>{room.code}</span>
        <GameButton variant="outline" icon={<Copy className="size-4" />} onClick={() => { void navigator.clipboard?.writeText(room.code); setCopied(true); }}>{copied ? "Copied" : "Copy code"}</GameButton>
        <span className="ml-auto text-sm text-ink2">{room.members.length}/4 players</span>
      </GlassPanel>
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {slots.map((m, i) => (
          <li key={i}><GlassPanel className="flex h-full min-h-48 flex-col items-center justify-center gap-2 p-4 text-center">
            {m ? <>
              <PlayerAvatar player={{ username: m.name, avatarColor: colorOf(m.id) }} size={64} />
              <p className="font-bold">{m.name} {m.id === room.hostId && <Crown className="inline size-4 text-gold" aria-label="Host" />}</p>
              <p className="text-xs text-ink2">{m.rank}</p>
              <StatusPill state={m.online || m.bot ? "ok" : "warning"}>{m.online ? <Wifi className="inline size-3" /> : <WifiOff className="inline size-3" />} {m.bot ? "test bot" : m.online ? "connected" : "reconnecting"}</StatusPill>
            </> : <span className="text-ink2">Waiting for player…</span>}
          </GlassPanel></li>))}
      </ul>
      {g.catalog?.rules.devTools && host && <GlassPanel className="flex flex-wrap items-center gap-2 p-3"><span className="text-xs text-muted">DEV TOOLS</span>
        <GameButton variant="outline" onClick={() => swallow(g.devAddBot())} disabled={room.members.length >= 4}>🛠 Add test player</GameButton>
        <GameButton variant="ghost" onClick={() => swallow(g.devRemoveBot())} disabled={!room.members.some((m) => m.bot)}>Remove test player</GameButton></GlassPanel>}
      <div className="flex justify-end gap-2">
        <GameButton variant="ghost" onClick={() => { swallow(g.leaveRoom()); router.push("/team"); }}>Leave room</GameButton>
        {host ? <GameButton variant="primary" onClick={() => router.push("/mission/select")}>Next: Select Mission</GameButton>
          : <p className="self-center text-sm text-ink2">Waiting for the host to pick a mission…</p>}
      </div>
    </ScreenContainer>
  );
}

/* ---------- Mission select ---------- */
export function LiveMissionSelect() {
  const router = useRouter(); const g = useGame(); const { ready, room } = useGate("setup");
  const cat = g.catalog; const prof = g.profile;
  const [d, setD] = useState<Difficulty>("easy"); const [m, setM] = useState("");
  if (!ready || !room || !cat || !prof) return <Wait />;
  const hardLocked = cat.rules.hardGate.enabled && !prof.unlocks.hard;
  const sel = cat.missions.find((x) => x.id === m);
  const valid = !!sel && sel.difficulties.includes(d) && !(d === "hard" && hardLocked);
  return (
    <ScreenContainer step={2} title="Mission Selection" actions={<BackButton href="/team/lobby" />}>
      <ErrorBar />
      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <GlassPanel className="h-fit p-4">
          <h2 className="mb-2 text-lg font-bold">Difficulty</h2>
          <div role="radiogroup" aria-label="Difficulty" className="grid gap-2">
            {(["easy", "medium", "hard"] as Difficulty[]).map((x) => { const locked = x === "hard" && hardLocked; return (
              <button key={x} role="radio" aria-checked={x === d} onClick={() => !locked && setD(x)} aria-disabled={locked}
                className={cn("rounded-lg border px-3 py-2 text-left", x === d ? "border-orange bg-orange/10" : "border-white/10 hover:border-cyan/50", locked && "opacity-50")}>
                <span className="font-semibold">{cat.difficulties[x].label}</span> <span className="text-xs text-gold">{cat.difficulties[x].xpMult}× XP</span>
                {locked && <Lock className="ml-1 inline size-3" aria-label="Locked" />}
                <p className="text-xs text-ink2">{locked ? cat.rules.hardGate.requires : cat.difficulties[x].blurb}</p>
              </button>); })}
          </div>
        </GlassPanel>
        <div className="grid gap-4">
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {cat.missions.map((x, i) => { const ok = x.difficulties.includes(d); return (
              <li key={x.id} className="enter lift" style={{ animationDelay: `${i * 70}ms` }}>
                <button onClick={() => ok && setM(x.id)} aria-disabled={!ok} aria-pressed={m === x.id} className={cn("h-full w-full text-left", !ok && "cursor-not-allowed")}>
                  <GlassPanel active={m === x.id} className={cn("flex h-full flex-col overflow-hidden", !ok && "opacity-60")}>
                    <div className="h-28"><Scene3D stars={false} camera={[0, 0, 4]} label={`${x.name} preview`}><PlanetModel kind={x.body} radius={1.3} /></Scene3D></div>
                    <div className="flex flex-1 flex-col gap-1 p-3">
                      <p className="font-display font-bold">{x.name} {!ok && <Lock className="inline size-4" aria-label="Unavailable" />}</p>
                      <p className="text-xs text-ink2">{x.tagline}</p>
                      <p className="text-xs text-muted">{x.type} · {x.slots.length} players · {x.baseXP} base XP</p>
                      <p className="text-xs text-muted">Difficulties: {x.difficulties.join(", ")}</p>
                      {!ok && <p className="mt-auto text-xs text-warn">⚠ {x.lockedReason[d] ?? "Not available on this difficulty"}</p>}
                    </div>
                  </GlassPanel>
                </button>
              </li>); })}
            {cat.comingSoon.map((x, i) => (
              <li key={x.id} className="enter" style={{ animationDelay: `${(cat.missions.length + i) * 70}ms` }}>
                <GlassPanel className="flex h-full flex-col overflow-hidden opacity-60">
                  <div className="h-28"><Scene3D stars={false} camera={[0, 0, 4]} label={`${x.name} preview`}><PlanetModel kind={x.body} radius={1.3} /></Scene3D></div>
                  <div className="flex flex-1 flex-col gap-1 p-3">
                    <p className="font-display font-bold">{x.name} <Lock className="inline size-4" aria-label="Unavailable" /></p>
                    <p className="text-xs text-ink2">{x.tagline}</p>
                    <p className="text-xs text-muted">{x.category}</p>
                    <p className="mt-auto text-xs text-warn">⚠ {x.note || "Coming soon"}</p>
                  </div>
                </GlassPanel>
              </li>))}
          </ul>
          <GlassPanel className="p-4">
            {sel ? (
              <div className="grid gap-3 md:grid-cols-3">
                <div><h2 className="text-xl font-bold">{sel.name}</h2><p className="text-sm text-ink2">{sel.brief}</p></div>
                <div><p className="text-sm font-semibold">Goals</p><ul className="list-disc pl-5 text-sm text-ink2">{sel.objectives.map((o, j) => <li key={j}>{o.label}</li>)}</ul></div>
                <div className="text-sm text-ink2"><p className="font-semibold text-ink">Crew & rewards</p>
                  <p>{sel.slots.map((sl) => sl.role).join(", ")}</p>
                  <p>{sel.baseXP} base XP ({cat.difficulties[d].xpMult}× on {cat.difficulties[d].label})</p></div>
              </div>
            ) : <p className="text-sm text-muted">Select an available mission to see details.</p>}
          </GlassPanel>
          <div className="flex justify-end"><GameButton variant="primary" disabled={!valid} onClick={() => g.setup(m, d).then(() => router.push("/mission/briefing")).catch(() => {})}>Continue to Briefing</GameButton></div>
        </div>
      </div>
    </ScreenContainer>
  );
}

/* ---------- Briefing ---------- */
export function LiveBriefing() {
  const g = useGame(); const { ready, room, host } = useGate("setup"); const cat = g.catalog;
  if (!ready || !room || !cat) return <Wait />;
  const mission = cat.missions.find((x) => x.id === room.missionId); const d = room.difficulty;
  if (!mission || !d) return <Wait>Pick a mission first…</Wait>;
  const mods = (mission.modifiers[d] ?? []).map((id) => cat.modifiers.find((x) => x.id === id)).filter(Boolean);
  const ch = mission.challenges.hard;
  const dst = cat.design.destinations.find((x) => x.id === mission.destinationId);
  const budget = (dst?.budgetUsd ?? 0) * cat.difficulties[d].budgetMult; const deadline = Math.round((dst?.deadlineDays ?? 0) * cat.difficulties[d].deadlineMult);
  return (
    <ScreenContainer step={3} title="Mission Briefing" subtitle={`${mission.name} · ${cat.difficulties[d].label} · ${cat.difficulties[d].xpMult}× XP`} actions={<BackButton href="/mission/select" />}>
      <ErrorBar />
      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <GlassPanel className="space-y-3 p-5"><p className="text-ink2">{mission.brief}</p>
          <h2 className="text-xl font-bold">Objectives</h2>
          <ul className="list-disc pl-5 text-ink2">{mission.objectives.map((o) => <li key={o.id}>{o.label}{o.required ? " *" : ""}</li>)}</ul>
          <p className="text-xs text-muted">Budget ${Math.round(budget / 1e6)}M · deadline {deadline} days · * required</p></GlassPanel>
        <div className="grid h-fit gap-3">
          {mods.length === 0 ? <GlassPanel className="p-5"><p className="font-bold text-ok">✓ No modifiers active</p></GlassPanel>
            : mods.map((x) => x && <GlassPanel key={x.id} className="p-4"><p className="font-bold text-orange">{x.name}</p><p className="text-sm text-ink2">{x.desc}</p></GlassPanel>)}
          {d === "hard" && ch && <GlassPanel className="border-gold/50 p-4"><h2 className="font-bold text-gold">Time attack — {ch.timeLimitMin} min</h2>
            <ul className="list-disc pl-5 text-sm text-ink2">{ch.list.map((c) => <li key={c.id}>{c.name} — {c.desc}</li>)}</ul>
            <p className="mt-2 text-xs text-muted">Beat {ch.tiers.map((t) => `${t.need}/${ch.list.length}`).join(" or ")} in time for exclusive cosmetics (first attempt only).</p></GlassPanel>}
        </div>
      </div>
      <div className="flex justify-end">{host ? <GameButton variant="primary" onClick={() => swallow(g.startRoles())}>Continue to Roles</GameButton> : <p className="text-sm text-ink2">Waiting for the host…</p>}</div>
    </ScreenContainer>
  );
}

/* ---------- Roles + characters ---------- */
const usePick = create<{ slot: string | null; set: (s: string | null) => void }>((set) => ({ slot: null, set: (slot) => set({ slot }) }));
const holder = (room: Room, slot: string) => { const s = room.slots.find((x) => x.slot === slot)!; return s.playerId ? room.members.find((m) => m.id === s.playerId)?.name ?? "?" : s.ai ? "AI crew" : "open"; };

export function LiveRoles() {
  const router = useRouter(); const g = useGame(); const { ready, room, profile } = useGate("roles"); const { slot, set } = usePick();
  if (!ready || !room || !g.catalog || !profile) return <Wait />;
  const cat = g.catalog;
  return (
    <ScreenContainer step={4} title="Role Assignment" subtitle="Choose the seat you'll fly. Roles unclaimed by players are run by AI crew." actions={<BackButton href="/team/lobby" />}>
      <ErrorBar />
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {room.slots.map((s) => { const role = cat.roles.find((r) => r.id === s.role)!; const mine = s.playerId === profile.id; const taken = !!s.playerId && !mine; return (
          <li key={s.slot}><button disabled={taken} onClick={() => set(s.slot)} className="w-full text-left disabled:cursor-not-allowed">
            <GlassPanel active={slot === s.slot || mine} className={cn("p-4", taken && "opacity-60")}>
              <p className="text-2xl">{role.icon}</p><p className="font-display text-lg font-bold">{role.label}</p><p className="text-sm text-ink2">{role.desc}</p>
              <p className="mt-2 text-xs text-muted">{holder(room, s.slot)}{mine && s.characterId ? " — you ✓" : ""}</p>
            </GlassPanel></button></li>); })}
      </ul>
      <div className="flex justify-end"><GameButton variant="primary" disabled={!slot} onClick={() => router.push("/mission/characters")}>Continue to Characters</GameButton></div>
    </ScreenContainer>
  );
}

export function LiveCharacters() {
  const router = useRouter(); const g = useGame(); const { ready, room, profile } = useGate("roles"); const { slot } = usePick();
  if (!ready || !room || !g.catalog || !profile) return <Wait />;
  const cat = g.catalog; const diff = room.difficulty!;
  const s = room.slots.find((x) => x.slot === slot);
  if (!s) return <ScreenContainer title="Character Selection"><GameButton onClick={() => router.push("/mission/roles")}>Choose a role first</GameButton></ScreenContainer>;
  const mineNow = s.playerId === profile.id ? s.characterId : null;
  return (
    <ScreenContainer step={5} title="Character Selection" subtitle={`${cat.roles.find((r) => r.id === s.role)?.label} · perks and flaws shown for ${cat.difficulties[diff].label}`} actions={<BackButton href="/mission/roles" />}>
      <ErrorBar />
      <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cat.characters.filter((c) => c.role === s.role).map((c) => { const tp = cat.traitPreview[diff][c.id]; return (
          <li key={c.id}><button className="w-full text-left" onClick={() => swallow(g.claim(s.slot, c.id))}>
            <GlassPanel active={mineNow === c.id} className="h-full space-y-2 p-4">
              <div className="flex gap-3">
                <Portrait id={c.id} role={c.role} size={92} />
                <div className="min-w-0 flex-1">
                  <p className="font-display text-lg font-bold">{c.name} <span className="text-sm font-normal text-ink2">{c.title}</span></p>
                  <p className="mb-1 text-xs text-ink2">{c.bio}</p>
                  <div className="grid gap-1">{cat.stats.map((st) => <StatBar key={st.id} label={st.label} value={c.stats[st.id]} max={10} />)}</div>
                </div>
              </div>
              {tp?.perks.map((p) => <p key={p.id} className="text-xs text-ok">＋ <b>{p.label}</b>: {p.effects.map((e) => e.text).join(", ")}</p>)}
              {tp?.flaw && <p className={cn("text-xs", tp.flaw.active ? "text-bad" : "text-muted")}>− <b>{tp.flaw.label}</b>{tp.flaw.active ? "" : " (dormant)"}: {tp.flaw.effects.map((e) => e.text).join(", ")}</p>}
              {mineNow === c.id && <p className="text-xs font-bold text-orange">✓ Selected</p>}
            </GlassPanel></button></li>); })}
      </ul>
      <div className="flex justify-end"><GameButton variant="primary" disabled={!mineNow} onClick={() => router.push("/mission/confirm")}>Continue</GameButton></div>
    </ScreenContainer>
  );
}

export function LiveConfirm() {
  const g = useGame(); const { ready, room, host } = useGate("roles");
  if (!ready || !room || !g.catalog) return <Wait />;
  const cat = g.catalog; const mission = cat.missions.find((x) => x.id === room.missionId);
  return (
    <ScreenContainer step={6} title="Confirm Crew" subtitle={`${mission?.name} · ${room.difficulty}`} actions={<BackButton href="/mission/characters" />}>
      <ErrorBar />
      <GlassPanel className="p-4"><ul className="grid gap-2 sm:grid-cols-2">
        {room.slots.map((s) => { const ch = cat.characters.find((c) => c.id === s.characterId);
          return <li key={s.slot} className="text-sm"><b>{cat.roles.find((r) => r.id === s.role)?.label}</b> — {holder(room, s.slot)}{ch ? ` as ${ch.name}` : s.playerId ? " (choosing…)" : ""}</li>; })}
      </ul></GlassPanel>
      <div className="flex justify-end">{host ? <GameButton variant="primary" onClick={() => swallow(g.startDesign())}>Start designing 🚀</GameButton> : <p className="text-sm text-ink2">Waiting for the host to start…</p>}</div>
    </ScreenContainer>
  );
}

/* ---------- Design + results ---------- */
export function LiveDesign() { const { ready } = useGate("design"); return ready ? <ScreenContainer title="Mission Architect" subtitle="Real orbital physics, real launch records, real NASA instruments. Balance them as a team."><ErrorBar /><Design /></ScreenContainer> : <Wait />; }
export function LiveResults() { const { ready } = useGate("report"); return ready ? <ScreenContainer title="Mission Report"><ErrorBar /><Report /></ScreenContainer> : <Wait />; }

