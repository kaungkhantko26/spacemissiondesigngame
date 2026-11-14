"use client";
import Link from "next/link";
import { GlassPanel } from "@/components/ui";
import { useMission, stageLabel } from "@/game/mission";
import { useProgress } from "@/game/progress";
import { cn } from "@/lib/mission";

const STEPS = [["Design", "Pick the Moon and press Build it for me"], ["Launch", "Fly the ascent from a real spaceport"], ["Lunar orbit", "Capture, then take over in Mission Control"], ["Report", "See what your design choices did"]] as const;
const KEYS = ["ascent", "transit", "operating", "complete"] as const;

/** Where the player is in the saved mission, with one clear next step. Fills the middle of the menu with something useful. */
export function MenuMission({ className }: { className?: string }) {
  const record = useMission((s) => s.record);
  const flights = useProgress((s) => s.flights), moons = useProgress((s) => s.moons);
  const idx = record ? KEYS.indexOf(record.stage as (typeof KEYS)[number]) : -1;
  const lost = record?.stage === "lost";
  const next = !record ? { href: "/design", label: "Step 1: design your spacecraft" }
    : record.stage === "ascent" ? { href: "/design", label: "Continue in Mission Architect" }
    : record.stage === "operating" ? { href: "/mission-control", label: "Resume in Mission Control" }
    : record.stage === "complete" ? { href: "/mission-control", label: "View the report" }
    : record.stage === "transit" ? { href: "/design", label: "Back to the Architect" } : { href: "/design", label: "Try again" };
  return (
    <GlassPanel className={cn("w-full max-w-sm p-4", className)} aria-label="Your mission">
      <p className="hud-label !text-orange">{record ? "Your mission in progress" : "Start here"}</p>
      <p className="mt-1 font-display text-xl font-bold">{record ? `${record.id} · ${stageLabel[record.stage]}` : "Build and fly a Moon mission"}</p>
      {!record && <p className="mt-1 text-xs text-ink2">One mission, four steps. The buttons on the left are shortcuts to each part.</p>}
      <ol className="mt-3 space-y-2">
        {STEPS.map(([title, hint], i) => {
          const done = record ? (lost ? false : i < idx || record.stage === "complete") : false, current = record ? !lost && i === idx : i === 0;
          return (
            <li key={title} className="flex items-start gap-2.5">
              <span aria-hidden className={cn("mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border text-[10px]", done ? "border-ok bg-ok/15 text-ok" : current ? "border-orange bg-orange/15 text-orange" : "border-white/15 text-muted")}>{done ? "✓" : i + 1}</span>
              <div><p className={cn("text-sm font-semibold", current ? "text-ink" : done ? "text-ink2" : "text-muted")}>{title}</p><p className="text-xs text-muted">{hint}</p></div>
            </li>);
        })}
      </ol>
      {lost && record?.lostReason && <p className="mt-3 text-xs text-bad">{record.lostReason}</p>}
      <Link href={next.href} className="mt-4 block rounded-lg border border-orange bg-orange px-4 py-2.5 text-center font-display font-bold text-[#1a0b00] shadow-[0_3px_0_#b4501a] transition hover:translate-y-px">{next.label}</Link>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-center text-[11px]">
        <div className="rounded-md bg-white/5 py-1.5"><dt className="text-muted">Flights flown</dt><dd className="font-display text-base font-bold">{flights}</dd></div>
        <div className="rounded-md bg-white/5 py-1.5"><dt className="text-muted">Moon captures</dt><dd className="font-display text-base font-bold">{moons}</dd></div>
      </dl>
    </GlassPanel>
  );
}
