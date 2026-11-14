"use client";
import { RotateCcw } from "lucide-react";
import { GameButton, GlassPanel } from "@/components/ui";
import { FlagView } from "@/components/ui/FlagView";
import { FLAGS, FLAG_COLORS, useFlag, type CustomFlag } from "@/game/flags";
import { usePlayerStore } from "@/stores";
import { cn } from "@/lib/mission";

const Swatches = ({ value, onPick, label }: { value: string; onPick: (c: string) => void; label: string }) => (
  <div className="flex flex-wrap gap-1.5" role="group" aria-label={label}>{FLAG_COLORS.map((c) => (
    <button key={c} type="button" aria-label={`${label} ${c}`} aria-pressed={value.toLowerCase() === c.toLowerCase()} onClick={() => onPick(c)}
      className={cn("size-6 rounded-full border-2 transition", value.toLowerCase() === c.toLowerCase() ? "scale-110 border-white" : "border-white/20 hover:border-white/60")} style={{ background: c }} />))}
  </div>
);

/** Choose a flag (Myanmar, the NASA marks, other nations) or build your own; it flies on the astronaut's shoulder. */
export function FlagEditor() {
  const f = useFlag();
  const equip = usePlayerStore((s) => s.equip);
  const wearing = usePlayerStore((s) => s.profile.equipped.shoulder === "shoulder-flag");
  const wear = () => { void equip("shoulder", "shoulder-flag"); };
  const set = (p: Partial<CustomFlag>) => { f.setCustom(p); wear(); };
  const name = FLAGS.find((x) => x.id === f.flagId)?.label ?? "Flag";
  return (
    <GlassPanel className="p-5" aria-label="Customise flag">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-bold">Your flag</h2>
        <div className="flex gap-2">
          {!wearing && <GameButton variant="primary" onClick={wear}>Wear it on my shoulder</GameButton>}
          <GameButton variant="outline" icon={<RotateCcw className="size-4" />} onClick={f.reset}>Reset</GameButton>
        </div>
      </div>
      <p className="mt-1 text-sm text-ink2">{wearing ? "Flying on your astronaut's shoulder." : "Not worn yet."} Pick one below or design your own.</p>
      <div className="mt-4 grid gap-5 md:grid-cols-[240px_1fr]">
        <div className="grid place-items-center gap-2 rounded-xl bg-white/5 p-4"><FlagView id={f.flagId} custom={f.custom} width={200} label={`${name} flag`} /><p className="text-sm font-semibold">{name}</p></div>
        <div className="grid gap-4">
          <div role="radiogroup" aria-label="Flag" className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {FLAGS.map((x) => (
              <button key={x.id} type="button" role="radio" aria-checked={f.flagId === x.id} onClick={() => { f.setFlag(x.id); wear(); }}
                className={cn("grid place-items-center gap-1 rounded-lg border p-2 text-[11px] transition", f.flagId === x.id ? "border-orange bg-orange/10" : "border-white/10 hover:border-white/30")}>
                <FlagView id={x.id} custom={f.custom} width={64} label={x.label} /><span className="text-ink2">{x.label}</span>
              </button>))}
          </div>
          {f.flagId === "custom" && (
            <div className="grid gap-3 rounded-lg border border-white/10 p-3 text-sm">
              <div className="grid gap-3 sm:grid-cols-3">
                <div><p className="hud-label mb-1.5">Stripe 1</p><Swatches value={f.custom.a} label="Stripe 1" onPick={(c) => set({ a: c })} /></div>
                <div><p className="hud-label mb-1.5">Stripe 2</p><Swatches value={f.custom.b} label="Stripe 2" onPick={(c) => set({ b: c })} /></div>
                <div><p className="hud-label mb-1.5">Stripe 3</p><Swatches value={f.custom.c} label="Stripe 3" onPick={(c) => set({ c })} /></div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex gap-1.5">{(["h", "v"] as const).map((d) => <button key={d} type="button" aria-pressed={f.custom.dir === d} onClick={() => set({ dir: d })} className={cn("rounded-md border px-3 py-1 text-xs", f.custom.dir === d ? "border-orange text-orange" : "border-white/15 text-ink2")}>{d === "h" ? "Horizontal" : "Vertical"}</button>)}</div>
                <label className="flex items-center gap-2 text-xs text-ink2"><input type="checkbox" checked={f.custom.star} onChange={(e) => set({ star: e.target.checked })} /> Star</label>
                {f.custom.star && <Swatches value={f.custom.starColor} label="Star colour" onPick={(c) => set({ starColor: c })} />}
              </div>
            </div>)}
        </div>
      </div>
    </GlassPanel>
  );
}
