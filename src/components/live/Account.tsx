"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useGame } from "@/live/store";
import { LIVE_ENABLED } from "@/live/client";
import { GameButton, GlassPanel } from "@/components/ui";
import type { StatId } from "@/live/types";

const swallow = (p: Promise<unknown>) => { p.catch(() => {}); };

export function Account({ view }: { view: "profile" | "cosmetics" | "stats" }) {
  const g = useGame(); const { catalog: cat, profile: p, error } = g;
  const [draft, setName] = useState<string | null>(null);
  const name = draft ?? p?.name ?? "";
  useEffect(() => { void g.boot(); }, [g]);
  if (!LIVE_ENABLED) return <main className="p-8 text-ink2">Set NEXT_PUBLIC_API_URL to use live profiles.</main>;
  if (!cat || !p) return <main className="p-8 text-ink2">Loading…</main>;
  const ranks = cat.cosmetics.ranks; const next = ranks.find((r) => r.minXp > p.xp);
  const U = cat.cosmetics.upgrades;
  return (
    <main className="mx-auto max-w-4xl space-y-4 p-4">
      <nav className="flex gap-3 text-sm">
        <Link href="/menu">← Menu</Link><Link href="/play/profile">Profile</Link>
        <Link href="/play/cosmetics">Cosmetics</Link><Link href="/play/stats">Stats</Link><Link href="/play">Play</Link>
      </nav>
      {error && <div className="rounded-lg bg-bad/20 p-2 text-sm text-bad">{error}</div>}
      {view === "profile" && (
        <GlassPanel className="space-y-3 p-6">
          <h1 className="text-2xl font-bold">{p.name}</h1>
          <p>{p.rank} · {p.xp} XP{next && ` · ${next.minXp - p.xp} XP to ${next.title}`}</p>
          <div className="flex gap-2">
            <input className="rounded bg-white/10 px-3 py-2" maxLength={20} value={name} onChange={(e) => setName(e.target.value)} />
            <GameButton onClick={() => swallow(g.rename(name))}>Rename</GameButton>
          </div>
          <ul className="text-sm text-ink2">
            <li>Missions flown: {p.stats.runs ?? 0} · successes {p.stats.successes ?? 0} · best score {p.stats.bestScore ?? 0}</li>
            <li>Hard mode: {p.unlocks.hard ? "unlocked" : "locked — clear one Easy run"}</li>
          </ul>
        </GlassPanel>
      )}
      {view === "stats" && (
        <GlassPanel className="space-y-3 p-6">
          <h1 className="text-2xl font-bold">Stats & Upgrades — {p.xp} XP</h1>
          {cat.stats.map((s) => { const lvl = p.upgrades[s.id as StatId] ?? 0; const cost = U.baseCost * (lvl + 1);
            return (
              <div key={s.id} className="flex items-center justify-between gap-3 text-sm">
                <div><b>{s.label}</b> <span className="text-ink2">+{lvl * U.perLevelBonus} (lv {lvl}/{U.maxLevel})</span><div className="text-xs text-ink2">{s.desc}</div></div>
                <GameButton disabled={lvl >= U.maxLevel || p.xp < cost} onClick={() => swallow(g.upgrade(s.id as StatId))}>{lvl >= U.maxLevel ? "Max" : `Upgrade ${cost} XP`}</GameButton>
              </div>); })}
        </GlassPanel>
      )}
      {view === "cosmetics" && (
        <div className="space-y-3">
          {cat.cosmetics.slots.map((slot) => (
            <GlassPanel key={slot.id} className="p-4">
              <h2 className="mb-2 font-semibold">{slot.label}</h2>
              <div className="grid gap-2 sm:grid-cols-3">
                {cat.cosmetics.items.filter((i) => i.slot === slot.id).map((i) => { const owned = p.cosmetics.includes(i.id) || i.unlock === "default";
                  const on = p.equipped[slot.id] === i.id;
                  return (
                    <button key={i.id} disabled={!owned} onClick={() => swallow(g.equip(i.id))}
                      className={`rounded-lg border p-2 text-left text-xs ${on ? "border-orange" : "border-white/10"} ${owned ? "" : "opacity-40"}`}>
                      <b className="text-sm">{i.name}</b> <span className="text-ink2">{i.rarity}</span>
                      <div>{on ? "Equipped" : owned ? "Tap to equip" : i.unlock.startsWith("trophy") ? "🏆 Hard-mode time-attack reward" : "Locked"}</div>
                    </button>); })}
              </div>
            </GlassPanel>))}
        </div>
      )}
    </main>
  );
}
