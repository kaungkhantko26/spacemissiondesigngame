"use client";
import { useState } from "react";
import { GameButton, GlassPanel } from "@/components/ui";
import { VARIANTS, compare, describeChange, type Comparison, type RunSummary } from "@/game/replay";
import type { Design } from "@/game/engine";
import { cn } from "@/lib/mission";

const usd = (v: number) => `$${(v / 1e6).toFixed(0)}M`;
const ROWS: { label: string; get: (r: RunSummary) => string; better: (a: RunSummary, b: RunSummary) => number }[] = [
  { label: "Survey coverage", get: (r) => `${(r.coverage * 100).toFixed(0)} %`, better: (a, b) => b.coverage - a.coverage },
  { label: "Data that reached Earth", get: (r) => `${(r.returnedShare * 100).toFixed(0)} %  (${r.usefulGb.toFixed(0)} GB useful)`, better: (a, b) => b.returnedShare - a.returnedShare },
  { label: "Brownouts", get: (r) => String(r.brownouts), better: (a, b) => a.brownouts - b.brownouts },
  { label: "Days in safe mode", get: (r) => r.safeDays.toFixed(1), better: (a, b) => a.safeDays - b.safeDays },
  { label: "Cost", get: (r) => usd(r.costUsd), better: (a, b) => a.costUsd - b.costUsd },
  { label: "Grade (score)", get: (r) => `${r.grade} (${r.score})`, better: (a, b) => b.score - a.score },
];

/** Fly the same scenario twice with one changed choice and show what it did. Both runs use the same assisted controller. */
export function ReplayCompare({ design, targets, attempt }: { design: Design; targets: string[]; attempt: number }) {
  const [id, setId] = useState(VARIANTS[0].id);
  const [res, setRes] = useState<Comparison | null>(null), [busy, setBusy] = useState(false);
  const run = () => { setBusy(true); setTimeout(() => { setRes(compare(design, targets, attempt, id)); setBusy(false); }, 30); };
  return (
    <GlassPanel className="p-5" aria-label="Same-seed comparison">
      <p className="hud-label">Same scenario, one change</p>
      <p className="mt-1 text-sm text-ink2">Fly the identical scenario (same random events, same survey regions, same controller) twice: once with your design and once with one choice changed. Seeing the difference is the quickest way to learn what each choice does.</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select aria-label="What to change" value={id} onChange={(e) => { setId(e.target.value); setRes(null); }} className="min-w-0 flex-1 px-2 py-1.5 text-sm">{VARIANTS.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}</select>
        <GameButton variant="primary" onClick={run} disabled={busy}>{busy ? "Flying both…" : "Compare"}</GameButton>
      </div>
      {res && (
        <div className="mt-4" aria-live="polite">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm">
              <thead><tr className="text-left text-xs text-muted"><th className="py-1 pr-2 font-normal">Result</th><th className="py-1 pr-2 font-normal">Your design ({res.base.antenna}, {res.base.arrayM2} m², {res.base.rtg} RTG)</th><th className="py-1 font-normal">{res.variant.label} ({res.changed.antenna}, {res.changed.arrayM2} m², {res.changed.rtg} RTG)</th></tr></thead>
              <tbody>{ROWS.map((r) => { const d = r.better(res.base, res.changed); return (
                <tr key={r.label} className="border-t border-white/10"><td className="py-1.5 pr-2 text-ink2">{r.label}</td><td className="py-1.5 pr-2 tabular-nums">{r.get(res.base)}</td><td className={cn("py-1.5 tabular-nums", Math.abs(d) < 1e-9 ? "" : d > 0 ? "text-ok" : "text-bad")}>{r.get(res.changed)}</td></tr>); })}</tbody>
            </table>
          </div>
          <p className="mt-3 text-sm"><b>Why:</b> <span className="text-ink2">{res.explanation}</span></p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink2">{describeChange(res.base, res.changed).map((l) => <li key={l}>{l}</li>)}</ul>
          {!res.changed.goNoGo && <p className="mt-2 text-xs text-warn">The changed design would not pass the Architect&apos;s launch review, so you could not fly it as it is. It is shown so you can see why.</p>}
          <p className="mt-3 text-[11px] text-muted">Both runs use the same assisted controller (daily auto-plan, best available answer to each event), seed {res.seed}. This explains the design, it is not a replay of your own flying.</p>
        </div>
      )}
    </GlassPanel>
  );
}
