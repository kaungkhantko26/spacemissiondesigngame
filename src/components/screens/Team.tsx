"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Globe, KeyRound, Plus, UserPlus, Wifi, WifiOff, Crown } from "lucide-react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { BackButton, GameButton, GlassPanel, PlayerAvatar, LevelBadge, ScreenContainer, StatusPill } from "@/components/ui";
import { useLobbyStore, useUIStore } from "@/stores";
import { lobbyService } from "@/services/mocks";
import { players } from "@/data/mock";
import { cn } from "@/lib/mission";

export function useLobby() {
  const { lobby, connect, create } = useLobbyStore();
  useEffect(() => {
    const off = connect();
    if (!useLobbyStore.getState().lobby) void create("Mission Crew Lobby");
    return off;
  }, [connect, create]);
  return lobby;
}

const Card = ({ icon: I, title, body, onClick, disabled, tag }: { icon: typeof Plus; title: string; body: string; onClick?: () => void; disabled?: boolean; tag?: string }) => (
  <button onClick={onClick} disabled={disabled} className="text-left disabled:opacity-60">
    <GlassPanel className="h-full p-6 transition hover:border-cyan hover:shadow-[0_0_24px_rgba(79,195,247,.3)]">
      <I className="size-8 text-cyan" aria-hidden />
      <h2 className="mt-3 text-xl font-bold">{title} {tag && <span className="ml-1 rounded bg-gold/20 px-2 text-xs text-gold">{tag}</span>}</h2>
      <p className="mt-1 text-sm text-ink2">{body}</p>
    </GlassPanel>
  </button>
);

export function TeamScreen() {
  const router = useRouter();
  return (
    <ScreenContainer title="Team Up" subtitle="Create a lobby or join one — multiplayer is mocked in this prototype." actions={<BackButton href="/menu" label="Main menu" />}>
      <div className="grid gap-4 md:grid-cols-3">
        <Card icon={Plus} title="Create Lobby" body="Host a four-player crew." onClick={() => router.push("/team/create")} />
        <Card icon={KeyRound} title="Join with Code" body="Enter a room code from a friend." onClick={() => router.push("/team/join")} />
        <Card icon={Globe} title="Public Lobbies" body="Browse open crews." disabled tag="Coming soon" />
      </div>
    </ScreenContainer>
  );
}

const nameSchema = z.object({ name: z.string().trim().min(3, "At least 3 characters").max(24, "Max 24 characters") });
export function CreateLobbyScreen() {
  const router = useRouter();
  const create = useLobbyStore((s) => s.create);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<{ name: string }>({ resolver: zodResolver(nameSchema), defaultValues: { name: "Mission Crew Lobby" } });
  return (
    <ScreenContainer title="Create Lobby" actions={<BackButton href="/team" />}>
      <GlassPanel className="max-w-md p-6">
        <form onSubmit={handleSubmit(async (v) => { await create(v.name); router.push("/team/lobby"); })} className="grid gap-4">
          <label className="grid gap-1 text-sm">Room name
            <input {...register("name")} className="rounded-lg border border-white/15 bg-black/30 px-3 py-2" aria-invalid={!!errors.name} />
          </label>
          {errors.name && <p role="alert" className="text-sm text-bad">{errors.name.message}</p>}
          <div className="flex justify-end gap-2"><GameButton type="button" variant="ghost" onClick={() => router.push("/team")}>Cancel</GameButton><GameButton variant="primary" type="submit" loading={isSubmitting}>Create</GameButton></div>
        </form>
      </GlassPanel>
    </ScreenContainer>
  );
}

const codeSchema = z.object({ code: z.string().trim().regex(/^SMD-\d{4}$/i, "Use the format SMD-1234") });
export function JoinScreen() {
  const router = useRouter();
  const join = useLobbyStore((s) => s.join);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<{ code: string }>({ resolver: zodResolver(codeSchema) });
  return (
    <ScreenContainer title="Join with Code" subtitle="Any code like SMD-1234 works in this mock." actions={<BackButton href="/team" />}>
      <GlassPanel className="max-w-md p-6">
        <form onSubmit={handleSubmit(async (v) => { await join(v.code); router.push("/team/lobby"); })} className="grid gap-4">
          <label className="grid gap-1 text-sm">Room code
            <input {...register("code")} placeholder="SMD-1234" className="rounded-lg border border-white/15 bg-black/30 px-3 py-2 uppercase" aria-invalid={!!errors.code} />
          </label>
          {errors.code && <p role="alert" className="text-sm text-bad">{errors.code.message}</p>}
          <div className="flex justify-end gap-2"><GameButton type="button" variant="ghost" onClick={() => router.push("/team")}>Cancel</GameButton><GameButton variant="primary" type="submit" loading={isSubmitting}>Join</GameButton></div>
        </form>
      </GlassPanel>
    </ScreenContainer>
  );
}

export function LobbyScreen() {
  const router = useRouter();
  const lobby = useLobby();
  const toast = useUIStore((s) => s.toast);
  const [copied, setCopied] = useState(false);
  if (!lobby) return <ScreenContainer title="Mission Crew Lobby"><p role="status">Connecting to mock lobby…</p></ScreenContainer>;
  const slots = Array.from({ length: lobby.maxPlayers }, (_, i) => lobby.members[i] ?? null);
  const sim = lobbyService.simulate;
  return (
    <ScreenContainer step={1} title={lobby.name} subtitle="Mock lobby — no real multiplayer connection." actions={<BackButton href="/team" />}>
      <GlassPanel className="flex flex-wrap items-center gap-3 p-4">
        <span className="font-display text-2xl tracking-widest text-gold" aria-label={`Room code ${lobby.code}`}>{lobby.code}</span>
        <GameButton variant="outline" icon={<Copy className="size-4" />} onClick={() => { void navigator.clipboard?.writeText(lobby.code); setCopied(true); toast("Room code copied", "success"); }}>{copied ? "Copied" : "Copy code"}</GameButton>
        <GameButton variant="outline" icon={<UserPlus className="size-4" />} onClick={() => toast("Invite link is a mock — use the simulator below")}>Invite</GameButton>
        <span className="ml-auto text-sm text-ink2">Privacy: {lobby.privacy} · Max {lobby.maxPlayers} players</span>
      </GlassPanel>
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {slots.map((m, i) => {
          const p = m && players.find((x) => x.id === m.playerId);
          return (
            <li key={i}>
              <GlassPanel active={!!m?.ready} className="flex h-full min-h-56 flex-col items-center justify-center gap-2 p-4 text-center">
                {m && p ? (
                  <>
                    <PlayerAvatar player={p} size={64} />
                    <p className="font-bold">{p.username} {m.isHost && <Crown className="inline size-4 text-gold" aria-label="Host" />}</p>
                    <LevelBadge level={p.level} />
                    <StatusPill state={m.connection === "connected" ? "ok" : m.connection === "lost" ? "critical" : "warning"}>
                      {m.connection === "connected" ? <Wifi className="inline size-3" /> : <WifiOff className="inline size-3" />} {m.connection}
                    </StatusPill>
                    <button aria-pressed={m.ready} onClick={() => void lobbyService.setReady(m.playerId, !m.ready)}
                      className={cn("rounded-full border px-4 py-1 text-sm", m.ready ? "border-ok text-ok" : "border-white/20 text-ink2")}>{m.ready ? "✓ Ready" : "Not ready"}</button>
                  </>
                ) : (
                  <button onClick={() => { sim.join(); }} className="grid place-items-center gap-2 text-ink2 hover:text-cyan"><UserPlus className="size-8" /><span>Invite Player</span><span className="text-xs text-muted">(simulates a join)</span></button>
                )}
              </GlassPanel>
            </li>
          );
        })}
      </ul>
      <GlassPanel className="p-4">
        <h2 className="mb-2 text-sm font-semibold text-muted">DEV SIMULATOR (frontend demo only)</h2>
        <div className="flex flex-wrap gap-2">
          <GameButton variant="outline" onClick={sim.join}>Player joins</GameButton>
          <GameButton variant="outline" onClick={sim.leave}>Player leaves</GameButton>
          <GameButton variant="outline" onClick={sim.changeHost}>Change host</GameButton>
          <GameButton variant="outline" onClick={sim.toggleConnection}>Toggle connection loss</GameButton>
          <GameButton variant="outline" onClick={() => lobby.members.forEach((m) => void lobbyService.setReady(m.playerId, true))}>Ready everyone</GameButton>
        </div>
      </GlassPanel>
      <div className="flex justify-end"><GameButton variant="primary" onClick={() => router.push("/mission/select")}>Next: Select Mission</GameButton></div>
    </ScreenContainer>
  );
}
