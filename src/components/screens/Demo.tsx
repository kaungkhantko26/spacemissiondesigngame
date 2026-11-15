"use client";
import Link from "next/link";
import { Rocket, Users, Satellite, Shirt, BarChart3, User, Server, Settings, type LucideIcon } from "lucide-react";
import { BackButton, GlassPanel, ScreenContainer, StatusPill } from "@/components/ui";
import { LIVE_ENABLED } from "@/live/client";

interface Demo { href: string; title: string; icon: LucideIcon; blurb: string; tag: "Offline" | "Mock data" | "Needs server" }
const OFFLINE: Demo[] = [
  { href: "/launch", title: "Launch Control — ground to orbit", icon: Rocket, tag: "Offline",
    blurb: "Pick a real spaceport and rocket, then fly the ascent from the pad through max-Q and staging into orbit. Three difficulty levels." },
  { href: "/design", title: "Mission Architect + flight sim", icon: Rocket, tag: "Offline",
    blurb: "Design a spacecraft from real launch vehicles, thrusters and instruments, then watch the Earth→Moon/planet flight and results." },
  { href: "/team", title: "Team up → full mission journey", icon: Users, tag: "Mock data",
    blurb: "Lobby → mission select → briefing → roles → characters → confirm → loading → gameplay HUD → results." },
  { href: "/mission/select", title: "Mission select", icon: Satellite, tag: "Mock data", blurb: "Jump straight to the mission catalogue and briefing flow." },
  { href: "/profile", title: "Profile", icon: User, tag: "Mock data", blurb: "Player card, level, XP and attributes." },
  { href: "/cosmetics", title: "Cosmetics", icon: Shirt, tag: "Mock data", blurb: "Try suits, helmets and skins on the 3D astronaut." },
  { href: "/stats", title: "Stats & upgrades", icon: BarChart3, tag: "Mock data", blurb: "Career stats and attribute upgrades." },
  { href: "/settings", title: "Settings", icon: Settings, tag: "Offline", blurb: "Quality, reduced motion, high contrast, audio mute." },
];
const LIVE: Demo[] = [
  { href: "/play", title: "Live multiplayer (/play)", icon: Server, tag: "Needs server", blurb: "Rooms, roles and shared design against the real backend." },
  { href: "/play/profile", title: "Live profile", icon: User, tag: "Needs server", blurb: "XP, rank and upgrades from the server." },
  { href: "/play/cosmetics", title: "Live cosmetics", icon: Shirt, tag: "Needs server", blurb: "Equip unlocked items." },
  { href: "/play/stats", title: "Live stats", icon: BarChart3, tag: "Needs server", blurb: "Runs, successes and trophies." },
];

function Card({ d, disabled }: { d: Demo; disabled?: boolean }) {
  const body = (
    <GlassPanel className={`h-full p-4 transition ${disabled ? "opacity-60" : "hover:border-[var(--border-strong)]"}`}>
      <div className="flex items-center gap-3"><d.icon className="size-5 text-orange" aria-hidden /><h3 className="font-display text-lg font-bold">{d.title}</h3></div>
      <p className="mt-2 text-sm text-ink2">{d.blurb}</p>
      <div className="mt-3"><StatusPill state={disabled ? "warning" : "ok"}>{disabled ? "Server not connected" : d.tag}</StatusPill></div>
    </GlassPanel>
  );
  return disabled ? <div aria-disabled>{body}</div> : <Link href={d.href} className="block">{body}</Link>;
}

export function DemoHub() {
  return (
    <ScreenContainer title="Demo hub" subtitle="Everything you can try right now. Offline demos run entirely in the browser."
      actions={<BackButton href="/menu" label="Main menu" />}>
      <section aria-labelledby="offline-h" className="space-y-3">
        <h2 id="offline-h" className="hud-label">Playable offline</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{OFFLINE.map((d) => <Card key={d.href} d={d} />)}</div>
      </section>
      <section aria-labelledby="live-h" className="space-y-3">
        <h2 id="live-h" className="hud-label">Live backend {LIVE_ENABLED ? "(connected config found)" : "(set NEXT_PUBLIC_API_URL to enable)"}</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{LIVE.map((d) => <Card key={d.href} d={d} disabled={!LIVE_ENABLED} />)}</div>
      </section>
    </ScreenContainer>
  );
}
