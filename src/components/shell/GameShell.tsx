"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, Volume2, VolumeX, Accessibility, X } from "lucide-react";
import { useUIStore, usePlayerStore } from "@/stores";
import { GlassPanel, GameButton, IconButton, LevelBadge, PlayerAvatar, XPProgressBar } from "@/components/ui";
import Link from "next/link";
import { cn } from "@/lib/mission";

const BARE = ["/", "/splash", "/menu", "/mission/gameplay", "/mission/loading"];

export function GameShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { toasts, dismissToast, confirm, closeConfirm, reducedMotion, highContrast, muted, set } = useUIStore();
  const profile = usePlayerStore((s) => s.profile);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) set({ reducedMotion: true });
  }, [set]);
  useEffect(() => {
    document.documentElement.classList.toggle("reduce-motion", reducedMotion);
    document.documentElement.classList.toggle("high-contrast", highContrast);
  }, [reducedMotion, highContrast]);

  const bare = BARE.includes(path);
  const showHeader = !bare;

  return (
    <div className="starfield relative flex min-h-screen flex-col">
      <div className="stars" aria-hidden />
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-gold focus:p-2 focus:text-black">Skip to content</a>

      {showHeader && (
        <header className="relative z-20 flex items-center justify-between gap-3 border-b border-[var(--border)] bg-bg/80 px-4 py-2.5 md:px-8">
          <Link href="/menu" className="flex items-center gap-2 font-display text-xl font-bold uppercase tracking-[.16em]">
            <span aria-hidden className="size-3 rotate-45 bg-orange" /><span>Mission <span className="text-orange">Design</span></span>
          </Link>
          <div className="flex items-center gap-2">
            <IconButton label={muted ? "Unmute audio" : "Mute audio"} onClick={() => set({ muted: !muted })}>
              {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
            </IconButton>
            <IconButton label={reducedMotion ? "Enable motion" : "Reduce motion"} aria-pressed={reducedMotion} onClick={() => set({ reducedMotion: !reducedMotion })}>
              <Accessibility className="size-4" />
            </IconButton>
            <IconButton label="Notifications (none)" onClick={() => useUIStore.getState().toast("No new notifications")}>
              <Bell className="size-4" />
            </IconButton>
            <ProfileWidget profile={profile} />
          </div>
        </header>
      )}

      <div id="main" className="relative z-10 flex flex-1 flex-col">
        <AnimatePresence mode="wait">
          <motion.div key={path} className="flex flex-1 flex-col"
            initial={{ opacity: 0, y: reducedMotion ? 0 : 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            transition={{ duration: reducedMotion ? 0 : 0.3 }}>
            {children}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Toasts */}
      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2" role="status" aria-live="polite">
        {toasts.map((t) => (
          <GlassPanel key={t.id} className={cn("pointer-events-auto flex items-center gap-3 px-4 py-3 text-sm", t.tone === "success" && "border-ok", t.tone === "error" && "border-bad")}>
            <span>{t.tone === "success" ? "✓" : t.tone === "error" ? "!" : "i"}</span>{t.message}
            <button aria-label="Dismiss" onClick={() => dismissToast(t.id)}><X className="size-4" /></button>
          </GlassPanel>
        ))}
      </div>

      {/* Confirm dialog */}
      {confirm && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onKeyDown={(e) => e.key === "Escape" && closeConfirm()}>
          <GlassPanel className="w-full max-w-md p-6" role="dialog" aria-modal="true" aria-labelledby="cd-title">
            <h2 id="cd-title" className="text-xl font-bold">{confirm.title}</h2>
            <p className="mt-2 text-sm text-ink2">{confirm.body}</p>
            <div className="mt-6 flex justify-end gap-2">
              <GameButton variant="ghost" autoFocus onClick={closeConfirm}>Cancel</GameButton>
              <GameButton variant={confirm.danger ? "danger" : "primary"} onClick={() => { confirm.onConfirm(); closeConfirm(); }}>{confirm.confirmLabel}</GameButton>
            </div>
          </GlassPanel>
        </div>
      )}
    </div>
  );
}

export function ProfileWidget({ profile }: { profile: ReturnType<typeof usePlayerStore.getState>["profile"] }) {
  return (
    <Link href="/profile" className="flex items-center gap-3 rounded-md border border-[var(--border)] bg-panel py-1 pl-1 pr-4 hover:border-[var(--border-strong)]">
      <PlayerAvatar player={profile} size={36} />
      <div className="hidden min-w-28 sm:block">
        <div className="flex items-center gap-2 text-sm font-semibold">{profile.username}<LevelBadge level={profile.progression.level} /></div>
        <XPProgressBar xp={profile.progression.xp} max={profile.progression.xpForNextLevel} />
      </div>
    </Link>
  );
}
