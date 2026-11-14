"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useGame } from "@/live/store";
import { LIVE_ENABLED } from "@/live/client";
import { GameButton, GlassPanel } from "@/components/ui";
import { Design } from "./Design";
import { Report } from "./Report";
import type { Difficulty, Room } from "@/live/types";

export function Play() {
  const { boot, conn, ready, error, room, catalog, profile } = useGame();
  useEffect(() => { void boot(); }, [boot]);
  if (!LIVE_ENABLED)
    return <Msg>Live play needs a game server. Set <code>NEXT_PUBLIC_API_URL</code> (e.g. https://api.yourdomain.com) and restart, or <Link href="/demo" className="text-orange underline">try the offline demos</Link>.</Msg>;
  if (!ready || !catalog || !profile) return <Msg>{conn === "offline" ? "Can't reach the game server." : "Connecting…"}</Msg>;
  return (
    <main className="mx-auto max-w-5xl space-y-4 p-4">
      <header className="flex items-center justify-between text-sm text-ink2">
        <span>{profile.name} · {profile.rank} · {profile.xp} XP</span>
        <span>{conn === "online" ? "● online" : "○ reconnecting…"}{room && ` · room ${room.code}`}</span>
      </header>
      {error && <div className="rounded-lg bg-bad/20 p-2 text-sm text-bad">{error}</div>}
      {!room ? <Entry /> : room.status === "lobby" ? <Lobby room={room} /> : room.status === "roles" ? <Roles room={room} />
        : room.status === "design" ? <Design /> : <Report />}
    </main>
  );
}
const Msg = ({ children }: { children: React.ReactNode }) => <main className="p-8 text-ink2">{children}</main>;
const swallow = (p: Promise<unknown>) => { p.catch(() => {}); };

function Entry() {
  const g = useGame(); const [code, setCode] = useState(""); const [name, setName] = useState(g.profile?.name ?? "");
  return (
    <GlassPanel className="space-y-4 p-6">
      <h1 className="text-2xl font-bold">Team up</h1>
      <div className="flex gap-2">
        <input className="rounded border border-white/20 bg-[#0b1530] px-3 py-2 text-white" value={name} onChange={(e) => setName(e.target.value)} maxLength={20} />
        <GameButton onClick={() => swallow(g.rename(name))}>Set name</GameButton>
      </div>
      <GameButton variant="primary" onClick={() => swallow(g.createRoom())}>Create room</GameButton>
      <div className="flex gap-2">
        <input className="w-32 rounded bg-white/10 px-3 py-2 uppercase" placeholder="CODE" maxLength={4} value={code} onChange={(e) => setCode(e.target.value)} />
        <GameButton onClick={() => swallow(g.joinRoom(code))} disabled={code.length < 4}>Join</GameButton>
      </div>
    </GlassPanel>
  );
}

function Lobby({ room }: { room: Room }) {
  const g = useGame(); const cat = g.catalog!; const host = room.hostId === g.profile!.id;
  const [m, setM] = useState(room.missionId ?? ""); const [d, setD] = useState<Difficulty>(room.difficulty ?? "easy");
  const hardLocked = cat.rules.hardGate.enabled && !g.profile!.unlocks.hard;
  const mission = cat.missions.find((x) => x.id === m);
  return (
    <div className="space-y-4">
      <GlassPanel className="p-4">
        <h2 className="text-xl font-bold">Room {room.code} — share this code</h2>
        <ul className="mt-2 text-sm">{room.members.map((x) => <li key={x.id}>{x.name} ({x.rank}){x.id === room.hostId && " ★ host"}{!x.online && " (offline)"}</li>)}</ul>
      </GlassPanel>
      {host ? (
        <GlassPanel className="space-y-3 p-4">
          <div className="flex gap-2">{(["easy", "medium", "hard"] as Difficulty[]).map((x) => (
            <GameButton key={x} variant={d === x ? "primary" : "outline"} onClick={() => setD(x)}
              disabled={x === "hard" && hardLocked}>{cat.difficulties[x].label}{x === "hard" && hardLocked ? " 🔒" : ""}</GameButton>))}
          </div>
          {d === "hard" && hardLocked && <p className="text-xs text-warn">{cat.rules.hardGate.requires}</p>}
          <p className="text-xs text-ink2">{cat.difficulties[d].blurb}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {cat.missions.map((x) => { const ok = x.difficulties.includes(d);
              return (<button key={x.id} disabled={!ok} onClick={() => setM(x.id)}
                className={`rounded-lg border p-3 text-left ${m === x.id ? "border-orange" : "border-white/10"} disabled:opacity-40`}>
                <b>{x.name}</b><div className="text-xs text-ink2">{x.tagline}</div>
                {!ok && <div className="text-xs text-warn">🔒 {x.lockedReason[d] ?? "Not on this difficulty"}</div>}
              </button>); })}
            {cat.comingSoon.map((x) => (<div key={x.id} className="rounded-lg border border-white/10 p-3 opacity-40"><b>{x.name}</b><div className="text-xs">Coming soon — {x.note}</div></div>))}
          </div>
          {mission && <p className="text-sm">{mission.brief}</p>}
          <div className="flex gap-2">
            <GameButton disabled={!m} onClick={() => swallow(g.setup(m, d).then(() => g.startRoles()))} variant="primary">Choose crew →</GameButton>
            <GameButton variant="ghost" onClick={() => swallow(g.leaveRoom())}>Leave</GameButton>
          </div>
        </GlassPanel>
      ) : <GlassPanel className="p-4 text-ink2">Waiting for the host to pick a mission…
        <div><GameButton variant="ghost" onClick={() => swallow(g.leaveRoom())}>Leave</GameButton></div></GlassPanel>}
    </div>
  );
}

function Roles({ room }: { room: Room }) {
  const g = useGame(); const cat = g.catalog!; const me = g.profile!.id; const host = room.hostId === me;
  const mine = room.slots.find((s) => s.playerId === me); const diff = room.difficulty!;
  const [pick, setPick] = useState<string | null>(null);
  const role = mine?.role;
  return (
    <div className="space-y-4">
      <GlassPanel className="p-4"><h2 className="text-xl font-bold">Crew — {cat.missions.find((x) => x.id === room.missionId)?.name} ({diff})</h2>
        <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">{room.slots.map((s) => {
          const who = s.playerId ? room.members.find((x) => x.id === s.playerId)?.name : s.ai ? "AI crew" : "open";
          const ch = cat.characters.find((c) => c.id === s.characterId);
          return <li key={s.slot}><b>{cat.roles.find((r) => r.id === s.role)?.label}</b>: {who}{ch && ` as ${ch.name}`}</li>; })}</ul></GlassPanel>
      <GlassPanel className="space-y-3 p-4">
        <h3 className="font-semibold">{mine ? "Your role (re-pick to change)" : "Pick a role & character"}</h3>
        {room.slots.filter((s) => !s.playerId || s.playerId === me).map((s) => (
          <div key={s.slot}>
            <div className="mb-1 text-sm text-ink2">{cat.roles.find((r) => r.id === s.role)?.label}</div>
            <div className="grid gap-2 sm:grid-cols-3">
              {cat.characters.filter((c) => c.role === s.role).map((c) => { const tp = cat.traitPreview[diff][c.id];
                return (<button key={c.id} onClick={() => { setPick(c.id); swallow(g.claim(s.slot, c.id)); }}
                  className={`rounded-lg border p-2 text-left text-xs ${s.characterId === c.id && s.playerId === me ? "border-orange" : "border-white/10"}`}>
                  <b className="text-sm">{c.name}</b> <span className="text-ink2">{c.title}</span>
                  <div className="mt-1 text-ink2">{Object.entries(c.stats).map(([k, v]) => `${k.slice(0, 3)} ${v}`).join(" · ")}</div>
                  {tp?.perks.map((p) => <div key={p.id} className="text-good">＋ {p.label}: {p.effects.map((e) => e.text).join(", ")}</div>)}
                  {tp?.flaw && <div className={tp.flaw.active ? "text-bad" : "text-ink2"}>− {tp.flaw.label}{tp.flaw.active ? "" : " (dormant)"}: {tp.flaw.effects.map((e) => e.text).join(", ")}</div>}
                </button>); })}
            </div>
          </div>))}
        {mine && <GameButton variant="ghost" onClick={() => swallow(g.release())}>Drop role</GameButton>}
        {host && <GameButton variant="primary" disabled={!mine && !role && !pick} onClick={() => swallow(g.startDesign())}>Start design →</GameButton>}
        <GameButton variant="ghost" onClick={() => swallow(g.toLobby())}>Back</GameButton>
      </GlassPanel>
    </div>
  );
}
