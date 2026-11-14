"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/mission";
import type { HudState, Player } from "@/types";

/* ---------- GlassPanel ---------- */
export function GlassPanel({ children, className, active, as: Tag = "div", ...rest }: {
  children: ReactNode; className?: string; active?: boolean; as?: "div" | "section" | "aside";
} & React.HTMLAttributes<HTMLElement>) {
  return (
    <Tag
      {...rest}
      className={cn(
        "rounded-[14px] border bg-panel backdrop-blur-md shadow-[0_8px_30px_rgba(0,0,0,.35),inset_0_1px_0_rgba(255,255,255,.06)]",
        active ? "border-cyan shadow-[0_0_24px_rgba(79,195,247,.35)]" : "border-[var(--border)]",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

/* ---------- GameButton ---------- */
type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger";
const variants: Record<Variant, string> = {
  primary: "bg-gradient-to-r from-orange to-[#ff6a2b] text-[#1a0b00] font-bold shadow-[0_0_20px_rgba(255,140,66,.4)] hover:brightness-110",
  secondary: "bg-electric/90 text-white hover:bg-electric",
  outline: "border border-cyan/60 text-cyan hover:bg-cyan/10",
  ghost: "text-ink2 hover:text-ink hover:bg-white/5",
  danger: "bg-bad/90 text-[#2a0008] font-semibold hover:bg-bad",
};
export function GameButton({ variant = "secondary", loading, icon, className, children, disabled, ...rest }:
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean; icon?: ReactNode }) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm tracking-wide transition active:scale-[.97] duration-150",
        "disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none disabled:active:scale-100",
        variants[variant], className,
      )}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
}
export function IconButton({ label, children, className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button {...rest} aria-label={label} title={label}
      className={cn("grid size-10 place-items-center rounded-full border border-[var(--border)] bg-panel text-ink2 hover:text-ink hover:border-cyan transition", className)}>
      {children}
    </button>
  );
}
export function LinkButton({ href, variant = "secondary", className, children, icon }: { href: string; variant?: Variant; className?: string; children: ReactNode; icon?: ReactNode }) {
  return (
    <Link href={href} className={cn("inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm tracking-wide transition active:scale-[.97]", variants[variant], className)}>
      {icon}{children}
    </Link>
  );
}
export function BackButton({ href, label = "Back" }: { href?: string; label?: string }) {
  const router = useRouter();
  return (
    <button onClick={() => (href ? router.push(href) : router.back())} aria-label={label}
      className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-panel px-4 py-2 text-sm text-ink2 hover:text-ink hover:border-cyan transition">
      <ArrowLeft className="size-4" aria-hidden />{label}
    </button>
  );
}

/* ---------- Progress / stats ---------- */
export function XPProgressBar({ xp, max, className }: { xp: number; max: number; className?: string }) {
  const pct = Math.min(100, Math.round((xp / max) * 100));
  return (
    <div className={className}>
      <div role="progressbar" aria-valuenow={xp} aria-valuemin={0} aria-valuemax={max} aria-label="Experience"
        className="h-2 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-gradient-to-r from-electric to-cyan transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1 text-xs text-muted">{xp.toLocaleString()} / {max.toLocaleString()} XP</p>
    </div>
  );
}
export function LevelBadge({ level }: { level: number }) {
  return <span className="rounded-full bg-gold/15 px-2 py-0.5 text-xs font-semibold text-gold" aria-label={`Level ${level}`}>Lv {level}</span>;
}
export function StatBar({ label, value, max = 10, next, tone = "cyan" }: { label: string; value: number; max?: number; next?: number; tone?: "cyan" | "orange" }) {
  return (
    <div>
      <div className="flex justify-between text-xs text-ink2"><span>{label}</span><span>{value}{next ? <span className="text-ok"> → {next}</span> : null}</span></div>
      <div className="relative mt-1 h-2 rounded-full bg-white/10" role="meter" aria-label={label} aria-valuenow={value} aria-valuemin={0} aria-valuemax={max}>
        {next ? <div className="absolute inset-y-0 left-0 rounded-full bg-ok/40" style={{ width: `${(next / max) * 100}%` }} /> : null}
        <div className={cn("absolute inset-y-0 left-0 rounded-full", tone === "cyan" ? "bg-cyan" : "bg-orange")} style={{ width: `${(value / max) * 100}%` }} />
      </div>
    </div>
  );
}
export function PlayerAvatar({ player, size = 40 }: { player: Pick<Player, "username" | "avatarColor">; size?: number }) {
  return (
    <span className="grid shrink-0 place-items-center rounded-full font-bold text-[#04101f] ring-2 ring-white/20" aria-label={`${player.username} avatar`}
      style={{ width: size, height: size, background: player.avatarColor, fontSize: size * 0.4 }}>
      {player.username[0]}
    </span>
  );
}

/* ---------- Feedback ---------- */
export function StatusPill({ state, children }: { state: HudState | "ok"; children: ReactNode }) {
  const map = { normal: "text-ok border-ok/50", ok: "text-ok border-ok/50", warning: "text-warn border-warn/50", critical: "text-bad border-bad/50", loading: "text-cyan border-cyan/50" } as const;
  const mark = { normal: "●", ok: "●", warning: "▲", critical: "■", loading: "◌" } as const; // non-color cue
  return <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs", map[state])}><span aria-hidden>{mark[state]}</span>{children}</span>;
}
export function EmptyState({ title, body }: { title: string; body?: string }) {
  return <div className="rounded-xl border border-dashed border-[var(--border)] p-8 text-center"><p className="font-display text-lg">{title}</p>{body && <p className="mt-1 text-sm text-ink2">{body}</p>}</div>;
}
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-xl border border-bad/50 bg-bad/10 p-6 text-center">
      <p className="font-display text-lg text-bad">Something went wrong</p>
      <p className="mt-1 text-sm text-ink2">{message}</p>
      {onRetry && <GameButton className="mt-4" variant="outline" onClick={onRetry}>Try again</GameButton>}
    </div>
  );
}
export function SkeletonLoader({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-xl bg-white/5", className)} />;
}
export function LoadingBar({ value }: { value?: number }) {
  return (
    <div className="relative h-2 w-full overflow-hidden rounded-full bg-white/10" role="progressbar" aria-label="Loading"
      aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      {value === undefined
        ? <div className="absolute inset-y-0 w-1/3 rounded-full bg-cyan" style={{ animation: "indeterminate 1.4s ease-in-out infinite" }} />
        : <div className="h-full rounded-full bg-gradient-to-r from-electric to-cyan transition-all" style={{ width: `${value}%` }} />}
    </div>
  );
}
export function ScreenContainer({ title, subtitle, children, actions, step }: { title: string; subtitle?: string; children: ReactNode; actions?: ReactNode; step?: number }) {
  return (
    <main className="relative mx-auto flex w-full max-w-[1500px] flex-1 flex-col gap-4 px-4 pb-8 pt-4 md:px-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          {step ? <StepProgress current={step} /> : null}
          <h1 className="text-3xl font-bold md:text-4xl">{title}</h1>
          {subtitle && <p className="text-sm text-ink2">{subtitle}</p>}
        </div>
        {actions}
      </header>
      {children}
    </main>
  );
}
export const SETUP_STEPS = ["Team", "Mission", "Briefing", "Roles", "Characters", "Confirm"];
export function StepProgress({ current }: { current: number }) {
  return (
    <ol className="mb-2 flex flex-wrap gap-1 text-[11px]" aria-label="Mission setup steps">
      {SETUP_STEPS.map((s, i) => (
        <li key={s} aria-current={i + 1 === current ? "step" : undefined}
          className={cn("rounded-full border px-2 py-0.5", i + 1 === current ? "border-orange text-orange" : i + 1 < current ? "border-ok/50 text-ok" : "border-white/10 text-muted")}>
          {i + 1 < current ? "✓ " : `${i + 1}. `}{s}
        </li>
      ))}
    </ol>
  );
}
