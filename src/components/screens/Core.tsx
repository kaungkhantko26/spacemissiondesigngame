"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Rocket, Users, User, Shirt, BarChart3, Settings, FlaskConical, Lock, Check } from "lucide-react";
import {
  BackButton, GameButton, GlassPanel, LoadingBar, ScreenContainer, StatBar, XPProgressBar, LevelBadge, PlayerAvatar,
} from "@/components/ui";
import { Astronaut, Scene3D, PlanetModel } from "@/components/three/lazy";
import { ProfileWidget } from "@/components/shell/GameShell";
import { usePlayerStore, useCosmeticsStore, useUIStore } from "@/stores";
import { cn } from "@/lib/mission";
import type { AttributeKey, CosmeticCategory, CosmeticItem } from "@/types";
import { progressionService } from "@/services/mocks";
import type { UpgradeOption } from "@/types";

const CHECKS = ["Life support", "Comms uplink", "Guidance computer", "Crew suits", "Launch window"];

/* ---------- Splash: pre-launch checklist + countdown ---------- */
export function SplashScreen() {
  const router = useRouter();
  const [step, setStep] = useState(0); // 0..CHECKS.length = checks done, then countdown
  useEffect(() => {
    const t = setInterval(() => setStep((x) => Math.min(x + 1, CHECKS.length + 3)), 520);
    // Real init work: fonts + 3D chunk. Never blocks on the animation alone.
    const ready = Promise.all([document.fonts?.ready, import("@/components/three")]).catch(() => null);
    const min = new Promise((r) => setTimeout(r, 4000));
    Promise.all([ready, min]).then(() => { useUIStore.getState().set({ booted: true }); router.replace("/menu"); });
    return () => clearInterval(t);
  }, [router]);
  const count = step - CHECKS.length; // 0 → "3", 1 → "2", 2 → "1", 3 → liftoff
  return (
    <main className="relative grid min-h-screen place-items-center px-6">
      <div className="grid w-full max-w-4xl items-center gap-8 md:grid-cols-[1fr_1.1fr]">
        <div className="mx-auto h-64 w-64 md:h-80 md:w-80"><Scene3D camera={[0, 1.2, 4.5]} label="Astronaut mascot"><Astronaut suit="#e8eef7" pose="wave" position={[0, -1, 0]} /></Scene3D></div>
        <div>
          <p className="hud-label !text-orange !tracking-[.3em]">Pre-launch sequence</p>
          <h1 className="mt-1 text-5xl font-bold md:text-6xl"><span className="text-orange">Space Mission</span><br />Design Game</h1>
          <ul className="mt-6 space-y-2 font-display text-lg tracking-wider" role="status" aria-live="polite">
            {CHECKS.map((c, i) => (
              <li key={c} className={cn("flex items-center gap-3 transition-opacity duration-300", i <= step ? "opacity-100" : "opacity-25")}>
                <span aria-hidden className={cn("grid size-5 place-items-center rounded-sm border text-xs", i < step ? "border-ok text-ok" : "border-white/20 text-muted")}>{i < step ? "✓" : ""}</span>
                <span className="uppercase">{c}</span><span className="ml-auto text-xs text-muted">{i < step ? "GO" : i === step ? "…" : ""}</span>
              </li>
            ))}
          </ul>
          <div className="mt-6 flex items-end gap-4">
            <span className="font-display text-7xl font-bold leading-none text-orange tabular-nums" aria-hidden>
              {count < 0 ? "T-" : count < 3 ? 3 - count : "↑"}
            </span>
            <span className="hud-label pb-2">{count < 0 ? "Standing by" : count < 3 ? "Terminal count" : "Liftoff"}</span>
          </div>
          <div className="mt-4"><LoadingBar /></div>
          <p className="mt-6 text-xs text-muted">NASA Space Apps Challenge 2026 · Prototype with mock data</p>
        </div>
      </div>
    </main>
  );
}

/* ---------- Main menu ---------- */
const LIVE = !!process.env.NEXT_PUBLIC_API_URL; // live backend mode → route to /play/*
const MENU = [
  { href: "/design", label: "Design Mission", icon: Rocket, primary: true },
  { href: LIVE ? "/play" : "/team", label: "Team Up", icon: Users },
  { href: LIVE ? "/play/profile" : "/profile", label: "Profile", icon: User },
  { href: LIVE ? "/play/cosmetics" : "/cosmetics", label: "Cosmetics", icon: Shirt },
  { href: LIVE ? "/play/stats" : "/stats", label: "Stats", icon: BarChart3 },
  { href: "/demo", label: "Demo Hub", icon: FlaskConical },
  { href: "/settings", label: "Settings", icon: Settings },
];
type Pose = "idle" | "wave" | "ready" | "celebrate";
const HOVER_POSE: Record<string, Pose> = { Cosmetics: "celebrate", Stats: "ready", Profile: "idle", Settings: "idle" };

function MissionClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    const first = setTimeout(tick, 0); const t = setInterval(tick, 1000);
    return () => { clearTimeout(first); clearInterval(t); };
  }, []);
  const hms = now ? now.toISOString().slice(11, 19) : "--:--:--";
  return (
    <dl className="flex flex-wrap gap-x-6 gap-y-1 font-display text-sm tracking-wider" aria-label="Mission control status">
      {[["UTC", hms], ["Orbit", "LEO · 408 km"], ["Station", "Nominal"], ["Crews online", "1,284"]].map(([k, v]) => (
        <div key={k} className="flex items-baseline gap-2"><dt className="hud-label">{k}</dt><dd className="tabular-nums text-ink">{v}</dd></div>
      ))}
    </dl>
  );
}

export function MenuScreen() {
  const profile = usePlayerStore((s) => s.profile);
  const router = useRouter();
  const [pose, setPose] = useState<Pose>("wave");
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.metaKey || e.ctrlKey || e.altKey || t?.closest("input,textarea,select")) return;
      const item = MENU[Number(e.key) - 1];
      if (item) router.push(item.href);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);
  return (
    <main className="relative flex min-h-screen flex-1 flex-col">
      <div className="absolute inset-0 opacity-90" aria-hidden>
        <Scene3D camera={[0, 0.6, 7]} light="hangar" label="Earth seen from the station">
          <PlanetModel kind="earth" radius={2.2} position={[4.2, 1.4, -5]} />
        </Scene3D>
      </div>
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] bg-bg/60 px-4 py-3 md:px-8">
        <MissionClock /><ProfileWidget profile={profile} />
      </div>
      <div className="relative z-10 grid flex-1 items-center gap-6 px-6 pb-10 md:grid-cols-2 md:px-16">
        <div>
          <p className="hud-label !text-orange !tracking-[.3em]">NASA SPACE APPS CHALLENGE 2026</p>
          <h1 className="mt-2 text-5xl font-bold leading-tight md:text-7xl"><span className="text-orange">Space Mission</span><br />Design Game</h1>
          <nav aria-label="Main menu" className="mt-8 flex max-w-sm flex-col gap-3">
            {MENU.map((m, i) => (
              <Link key={m.href} href={m.href} style={{ animationDelay: `${i * 70}ms` }}
                onMouseEnter={() => setPose(HOVER_POSE[m.label] ?? "wave")} onFocus={() => setPose(HOVER_POSE[m.label] ?? "wave")}
                onMouseLeave={() => setPose("wave")} onBlur={() => setPose("wave")}
                className={cn("enter group flex items-center gap-3 rounded-lg border px-5 py-3 font-display tracking-wide transition duration-150 hover:translate-x-1",
                  m.primary ? "border-orange bg-orange shadow-[0_4px_0_#b4501a] py-4 text-lg font-bold text-[#1a0b00]"
                    : "border-[var(--border)] bg-panel hover:border-[var(--border-strong)]")}>
                <m.icon className="size-5" aria-hidden />{m.label.toUpperCase()}
                <kbd aria-label={`Shortcut ${i + 1}`} className={cn("ml-auto rounded-sm border px-1.5 text-xs", m.primary ? "border-black/30" : "border-white/20 text-muted")}>{i + 1}</kbd>
              </Link>
            ))}
          </nav>
          <p className="hud-label mt-4">Press 1–{MENU.length} to jump</p>
        </div>
        <div className="h-[380px] md:h-[560px]">
          <Scene3D camera={[0, 0.6, 7]} label="Your astronaut"><Astronaut suit="#e8eef7" pose={pose} position={[0, -1.5, 0]} scale={1} /></Scene3D>
        </div>
      </div>
    </main>
  );
}

/* ---------- helpers ---------- */
export function useLook() {
  const profile = usePlayerStore((s) => s.profile);
  const items = useCosmeticsStore((s) => s.items);
  const previewId = useCosmeticsStore((s) => s.previewId);
  return useMemo(() => {
    const byId = (id: string | null) => items.find((c) => c.id === id);
    const eq = { ...profile.equipped };
    const p = byId(previewId);
    if (p) eq[p.category] = p.id;
    const suit = byId(eq.suit), helmet = byId(eq.helmet), pack = byId(eq.backpack);
    const pat = byId(eq.pattern), head = byId(eq.headgear), sh = byId(eq.shoulder), bt = byId(eq.boots);
    return {
      suit: suit?.color ?? "#e8eef7", accent: suit?.accent ?? "#168bff", helmet: helmet?.color ?? "#4fc3f7", pack: pack?.color ?? "#9fb3c8",
      pattern: pat?.id, patternColor: pat?.color, headgear: head?.id, headgearColor: head?.color,
      shoulder: sh?.id, shoulderColor: sh?.color, boots: bt?.id, bootsColor: bt?.color,
    };
  }, [profile.equipped, items, previewId]);
}

/* ---------- Profile ---------- */
export function ProfileScreen() {
  const profile = usePlayerStore((s) => s.profile);
  const look = useLook();
  const h = profile.history;
  return (
    <ScreenContainer title="Profile" actions={<BackButton href="/menu" label="Main menu" />}>
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="grid gap-4">
          <GlassPanel className="flex flex-wrap items-center gap-4 p-5">
            <PlayerAvatar player={profile} size={72} />
            <div className="flex-1">
              <h2 className="text-2xl font-bold">{profile.username} <LevelBadge level={profile.progression.level} /></h2>
              <p className="text-sm text-muted">Player ID {profile.playerCode} · Mock identity (no real auth)</p>
              <XPProgressBar className="mt-3 max-w-md" xp={profile.progression.xp} max={profile.progression.xpForNextLevel} />
            </div>
          </GlassPanel>
          <GlassPanel className="p-5">
            <h2 className="mb-3 text-xl font-bold">Mission history</h2>
            <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {[["Attempted", h.attempted], ["Completed", h.completed], ["Best", h.bestPerformance], ["Highest difficulty", h.highestDifficulty ?? "—"]].map(([k, v]) => (
                <div key={String(k)} className="rounded-lg bg-white/5 p-3"><dt className="text-xs text-muted">{k}</dt><dd className="font-semibold capitalize">{v}</dd></div>
              ))}
            </dl>
          </GlassPanel>
          <GlassPanel className="p-5">
            <h2 className="mb-3 text-xl font-bold">Achievements</h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {profile.achievements.map((a) => (
                <li key={a.id} className={cn("flex items-start gap-3 rounded-lg border p-3", a.unlockedAt ? "border-gold/40" : "border-white/10 opacity-70")}>
                  {a.unlockedAt ? <Check className="size-5 text-gold" aria-label="Unlocked" /> : <Lock className="size-5 text-muted" aria-label="Locked" />}
                  <div><p className="font-semibold">{a.name}</p><p className="text-xs text-ink2">{a.description}</p><p className="text-xs text-muted">{a.unlockedAt ? `Unlocked ${a.unlockedAt}` : "Locked"}</p></div>
                </li>
              ))}
            </ul>
          </GlassPanel>
        </div>
        <GlassPanel className="flex min-h-[420px] flex-col p-3">
          <h2 className="px-2 pt-2 text-xl font-bold">Character preview</h2>
          <p className="px-2 text-xs text-muted">Drag to rotate · scroll to zoom</p>
          <div className="min-h-0 flex-1"><Scene3D controls camera={[0, 1, 5]} label="Interactive astronaut preview"><Astronaut {...look} position={[0, -1, 0]} /></Scene3D></div>
        </GlassPanel>
      </div>
    </ScreenContainer>
  );
}

/* ---------- Cosmetics ---------- */
const CATS: { id: CosmeticCategory; label: string }[] = [
  { id: "suit", label: "Suits" }, { id: "pattern", label: "Patterns" }, { id: "helmet", label: "Helmets" },
  { id: "headgear", label: "Headgear" }, { id: "shoulder", label: "Shoulder" }, { id: "boots", label: "Boots" },
  { id: "backpack", label: "Backpacks" }, { id: "patch", label: "Patches" }, { id: "emote", label: "Emotes" },
];
const rarityColor = { common: "text-ink2", rare: "text-cyan", epic: "text-[#c084fc]", legendary: "text-gold" } as const;

export function CosmeticsScreen() {
  const { items, category, previewId, setCategory, preview } = useCosmeticsStore();
  const { profile, equip } = usePlayerStore();
  const toast = useUIStore((s) => s.toast);
  const look = useLook();
  const list = items.filter((c) => c.category === category);
  const sel: CosmeticItem | undefined = items.find((c) => c.id === previewId);
  const equipped = sel && profile.equipped[sel.category] === sel.id;
  return (
    <ScreenContainer title="Cosmetics" subtitle="Visual only — cosmetics never change gameplay." actions={<BackButton href="/menu" label="Main menu" />}>
      <div className="grid gap-4 lg:grid-cols-[minmax(300px,1fr)_1.4fr]">
        <GlassPanel className="flex min-h-[420px] flex-col p-3">
          <div className="min-h-0 flex-1"><Scene3D controls camera={[0, 1, 5]} label="Cosmetic preview"><Astronaut {...look} position={[0, -1, 0]} /></Scene3D></div>
          <p className="px-2 pb-2 text-sm text-ink2">{profile.username} · {sel ? `Previewing ${sel.name}` : "Equipped look"}</p>
        </GlassPanel>
        <div className="flex flex-col gap-3">
          <div role="tablist" aria-label="Cosmetic categories" className="flex flex-wrap gap-2">
            {CATS.map((c) => (
              <button key={c.id} role="tab" aria-selected={category === c.id} onClick={() => setCategory(c.id)}
                className={cn("rounded-md border px-4 py-1.5 text-sm", category === c.id ? "border-orange bg-orange/10 text-orange" : "border-white/15 text-ink2 hover:text-ink")}>{c.label}</button>
            ))}
          </div>
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {list.map((c, i) => {
              const isEq = profile.equipped[c.category] === c.id;
              return (
                <li key={c.id} className="enter lift" style={{ animationDelay: `${i * 50}ms` }}>
                  <button onClick={() => preview(c.id)} aria-pressed={previewId === c.id}
                    className={cn("w-full rounded-lg border bg-panel p-3 text-left transition", previewId === c.id ? "border-orange" : "border-white/10 hover:border-cyan/50")}>
                    <div className="mb-2 grid h-20 place-items-center rounded-lg" style={{ background: `linear-gradient(135deg, ${c.color}, ${c.accent})` }}>
                      {!c.unlocked && <Lock className="size-6 text-white/90" aria-label="Locked" />}
                    </div>
                    <p className="font-semibold">{c.name}</p>
                    <p className="text-xs text-muted capitalize">{c.category} · {c.collection}</p>
                    <p className={cn("text-xs capitalize", rarityColor[c.rarity])}>{c.rarity}{c.hardModeExclusive && <span className="ml-1 rounded bg-orange/20 px-1 text-orange">HARD ONLY</span>}</p>
                    <p className="text-xs">{isEq ? "✓ Equipped" : c.unlocked ? "Unlocked" : "Locked"}</p>
                  </button>
                </li>
              );
            })}
          </ul>
          {sel && (
            <GlassPanel className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="font-display text-lg font-bold">{sel.name}</p>
                <p className="text-sm text-ink2">{sel.unlocked ? "Unlocked (mock ownership)" : `Unlock: ${sel.unlockCondition}`}</p>
              </div>
              {sel.unlocked
                ? <GameButton variant={equipped ? "outline" : "primary"} onClick={async () => { await equip(sel.category, equipped ? null : sel.id); toast(equipped ? `${sel.name} unequipped` : `${sel.name} equipped`, "success"); }}>{equipped ? "Unequip" : "Equip"}</GameButton>
                : <GameButton disabled icon={<Lock className="size-4" />}>Locked</GameButton>}
            </GlassPanel>
          )}
        </div>
      </div>
    </ScreenContainer>
  );
}

/* ---------- Stats ---------- */
export function StatsScreen() {
  const { profile, upgrade } = usePlayerStore();
  const { askConfirm, toast } = useUIStore();
  const [opts, setOpts] = useState<UpgradeOption[]>([]);
  const [sel, setSel] = useState<AttributeKey | null>(null);
  useEffect(() => { progressionService.getUpgradeOptions().then(setOpts); }, [profile.attributes]);
  const cur = opts.find((o) => o.attribute === sel);
  const avail = profile.progression.availableXp;
  return (
    <ScreenContainer title="Stats & Upgrades" subtitle="Costs and values are mock data supplied through the ProgressionService contract." actions={<BackButton href="/menu" label="Main menu" />}>
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <GlassPanel className="p-5">
          <div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-bold">Attributes</h2><p className="text-sm text-gold">Available XP: {avail}</p></div>
          <ul className="grid gap-4">
            {opts.map((o) => (
              <li key={o.attribute} className={cn("rounded-lg border p-3", sel === o.attribute ? "border-orange" : "border-white/10")}>
                <StatBar label={o.attribute[0].toUpperCase() + o.attribute.slice(1)} value={o.currentValue} next={sel === o.attribute ? o.nextValue : undefined} />
                <div className="mt-2 flex items-center justify-between text-xs text-ink2">
                  <span>Next: {o.nextValue} · Cost {o.cost} XP</span>
                  <GameButton variant="outline" className="!py-1" onClick={() => setSel(o.attribute)} aria-label={`Preview ${o.attribute} upgrade`}>Preview</GameButton>
                </div>
              </li>
            ))}
          </ul>
        </GlassPanel>
        <GlassPanel className="h-fit p-5">
          <h2 className="mb-2 text-xl font-bold">Upgrade preview</h2>
          {cur ? (
            <>
              <p className="capitalize">{cur.attribute}: {cur.currentValue} → <span className="text-ok">{cur.nextValue}</span></p>
              <p className="mt-1 text-sm text-ink2">Cost: {cur.cost} XP {avail < cur.cost && <span className="text-bad">(not enough XP)</span>}</p>
              <GameButton className="mt-4 w-full" variant="primary" disabled={avail < cur.cost}
                onClick={() => askConfirm({ title: "Confirm upgrade", body: `Upgrade ${cur.attribute} to ${cur.nextValue} for ${cur.cost} XP? (mock only)`, confirmLabel: "Upgrade",
                  onConfirm: async () => { await upgrade(cur.attribute); toast(`${cur.attribute} upgraded`, "success"); setSel(null); } })}>Upgrade</GameButton>
            </>
          ) : <p className="text-sm text-muted">Select an attribute to preview its upgrade.</p>}
        </GlassPanel>
      </div>
    </ScreenContainer>
  );
}

/* ---------- Settings ---------- */
const Row = ({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) => (
  <button role="switch" aria-checked={on} onClick={onClick} className="flex w-full items-center justify-between rounded-lg bg-white/5 p-3 text-left">
    {label}<span className={cn("rounded-sm px-3 py-0.5 font-display text-xs uppercase tracking-wider", on ? "bg-ok/20 text-ok" : "bg-white/10 text-muted")}>{on ? "On" : "Off"}</span>
  </button>
);

export function SettingsScreen() {
  const ui = useUIStore();
  return (
    <ScreenContainer title="Settings" actions={<BackButton href="/menu" label="Main menu" />}>
      <GlassPanel className="grid max-w-xl gap-3 p-5">
        <Row label="Mute audio (no audio assets yet)" on={ui.muted} onClick={() => ui.set({ muted: !ui.muted })} />
        <Row label="Reduce motion" on={ui.reducedMotion} onClick={() => ui.set({ reducedMotion: !ui.reducedMotion })} />
        <Row label="High contrast" on={ui.highContrast} onClick={() => ui.set({ highContrast: !ui.highContrast })} />
        <div role="radiogroup" aria-label="3D quality" className="flex items-center justify-between rounded-lg bg-white/5 p-3">
          3D quality
          <div className="flex gap-1">{(["low", "medium", "high"] as const).map((q) => (
            <button key={q} role="radio" aria-checked={ui.quality === q} onClick={() => ui.set({ quality: q })}
              className={cn("rounded-md border px-3 py-1 text-xs capitalize", ui.quality === q ? "border-orange text-orange" : "border-white/15 text-ink2")}>{q}</button>))}
          </div>
        </div>
      </GlassPanel>
    </ScreenContainer>
  );
}
