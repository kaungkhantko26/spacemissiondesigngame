"use client";
import { Dices, RotateCcw } from "lucide-react";
import { GameButton, GlassPanel } from "@/components/ui";
import { AvatarArt } from "@/components/ui/AvatarArt";
import { AVATAR_BGS, AVATAR_FGS, AVATAR_FRAMES, AVATAR_SHAPES, AVATAR_TEMPLATES, useAvatar, type AvatarStyle } from "@/game/avatar";
import { cn } from "@/lib/mission";

const pick = <T,>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)];
const Chip = ({ on, onClick, children, label }: { on: boolean; onClick: () => void; children: React.ReactNode; label: string }) => (
  <button type="button" aria-pressed={on} aria-label={label} title={label} onClick={onClick} className={cn("rounded-lg border p-1 transition", on ? "border-orange bg-orange/10" : "border-white/10 hover:border-white/30")}>{children}</button>
);
const Swatch = ({ color, on, onClick, label }: { color: string; on: boolean; onClick: () => void; label: string }) => (
  <button type="button" aria-pressed={on} aria-label={label} title={label} onClick={onClick} className={cn("size-7 rounded-full border-2 transition", on ? "border-white scale-110" : "border-white/20 hover:border-white/60")} style={{ background: color }} />
);

/** Template profile pictures with colours, frame and shape the player can customise; saved in the browser and used everywhere the avatar shows. */
export function AvatarEditor({ name }: { name: string }) {
  const a = useAvatar();
  const style: AvatarStyle = { template: a.template, bg: a.bg, fg: a.fg, frame: a.frame, shape: a.shape };
  return (
    <GlassPanel className="p-5" aria-label="Customise profile picture">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-bold">Profile picture</h2>
        <div className="flex gap-2">
          <GameButton variant="outline" icon={<Dices className="size-4" />} onClick={() => a.patch({ template: pick(AVATAR_TEMPLATES).id, bg: pick(AVATAR_BGS), fg: pick(AVATAR_FGS), frame: pick(AVATAR_FRAMES), shape: pick(AVATAR_SHAPES) })}>Surprise me</GameButton>
          <GameButton variant="outline" icon={<RotateCcw className="size-4" />} onClick={a.reset}>Reset</GameButton>
        </div>
      </div>
      <div className="mt-4 grid gap-5 md:grid-cols-[120px_1fr]">
        <div className="grid place-items-center rounded-xl bg-white/5 p-3"><AvatarArt style={style} name={name} size={104} /></div>
        <div className="grid gap-3 text-sm">
          <div><p className="hud-label mb-1.5">Template</p>
            <div className="flex flex-wrap gap-2">{AVATAR_TEMPLATES.map((t) => <Chip key={t.id} label={t.label} on={a.template === t.id} onClick={() => a.patch({ template: t.id })}><AvatarArt style={{ ...style, template: t.id }} name={name} size={44} /></Chip>)}</div></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><p className="hud-label mb-1.5">Background</p><div className="flex flex-wrap gap-2">{AVATAR_BGS.map((c) => <Swatch key={c} color={c} label={`Background ${c}`} on={a.bg === c} onClick={() => a.patch({ bg: c })} />)}</div></div>
            <div><p className="hud-label mb-1.5">Picture colour</p><div className="flex flex-wrap gap-2">{AVATAR_FGS.map((c) => <Swatch key={c} color={c} label={`Picture colour ${c}`} on={a.fg === c} onClick={() => a.patch({ fg: c })} />)}</div></div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><p className="hud-label mb-1.5">Frame</p><div className="flex flex-wrap gap-1.5">{AVATAR_FRAMES.map((f) => <button key={f} type="button" aria-pressed={a.frame === f} onClick={() => a.patch({ frame: f })} className={cn("rounded-md border px-3 py-1 text-xs capitalize", a.frame === f ? "border-orange text-orange" : "border-white/15 text-ink2")}>{f}</button>)}</div></div>
            <div><p className="hud-label mb-1.5">Shape</p><div className="flex flex-wrap gap-1.5">{AVATAR_SHAPES.map((f) => <button key={f} type="button" aria-pressed={a.shape === f} onClick={() => a.patch({ shape: f })} className={cn("rounded-md border px-3 py-1 text-xs capitalize", a.shape === f ? "border-orange text-orange" : "border-white/15 text-ink2")}>{f}</button>)}</div></div>
          </div>
        </div>
      </div>
    </GlassPanel>
  );
}
