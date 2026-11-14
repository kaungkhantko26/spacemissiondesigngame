"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Bell, CheckCircle2, Info, Volume2, VolumeX, Accessibility, X } from "lucide-react";
import { useUIStore, usePlayerStore } from "@/stores";
import { GlassPanel, GameButton, IconButton, LevelBadge, PlayerAvatar, XPProgressBar } from "@/components/ui";
import Link from "next/link";
import { cn } from "@/lib/mission";
import { GlobalSound } from "./GlobalSound";
import { useProgress } from "@/game/progress";
import { useAvatar } from "@/game/avatar";
import { useFlag } from "@/game/flags";
import { useIdentity } from "@/game/identity";

const BARE = ["/", "/splash", "/menu", "/mission/gameplay", "/mission/loading"];

export function GameShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { toasts, dismissToast, confirm, closeConfirm, reducedMotion, highContrast, muted, set } = useUIStore();
  const profile = usePlayerStore((s) => s.profile);

  useEffect(() => { // a page from before a new deploy may ask for a script that no longer exists: reload once to pick up the new version
    const reloadOnce = () => {
      try { const last = Number(window.sessionStorage.getItem("smd-reload") ?? 0); if (Date.now() - last < 30_000) return; window.sessionStorage.setItem("smd-reload", String(Date.now())); } catch { /* storage unavailable */ }
      window.location.reload();
    };
    const onError = (e: Event) => { const t = e.target; if (t instanceof HTMLScriptElement && t.src.includes("/_next/static/")) reloadOnce(); };
    const onRejection = (e: PromiseRejectionEvent) => { const m = String((e.reason as { name?: string; message?: string } | undefined)?.name ?? "") + String((e.reason as { message?: string } | undefined)?.message ?? ""); if (/ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module/i.test(m)) reloadOnce(); };
    window.addEventListener("error", onError, true); window.addEventListener("unhandledrejection", onRejection);
    return () => { window.removeEventListener("error", onError, true); window.removeEventListener("unhandledrejection", onRejection); };
  }, []);
  useEffect(() => { // restore saved cosmetics, progress and profile picture from this browser
    void useAvatar.persist.rehydrate(); void useFlag.persist.rehydrate();
    void Promise.resolve(useIdentity.persist.rehydrate()).then(() => { const n = useIdentity.getState().name; if (n) usePlayerStore.setState((st) => ({ profile: { ...st.profile, username: n } })); });
    void Promise.resolve(useProgress.persist.rehydrate()).then(() => {
      const saved = useProgress.getState().equipped;
      usePlayerStore.setState((st) => ({ profile: { ...st.profile, equipped: { ...st.profile.equipped, ...saved } } }));
    });
  }, []);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) set({ reducedMotion: true });
  }, [set]);
  useEffect(() => {
    document.documentElement.classList.toggle("reduce-motion", reducedMotion);
    document.documentElement.classList.toggle("high-contrast", highContrast);
  }, [reducedMotion, highContrast]);

  // GitHub Pages serves routes with a trailing slash ("/menu/"), so normalise before comparing.
  const bare = BARE.includes(path.length > 1 ? path.replace(/\/+$/, "") : path);
  const showHeader = !bare;

  return (
    <div className="starfield relative flex min-h-screen flex-col">
      <div className="stars" aria-hidden />
      <GlobalSound />
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
            initial={{ opacity: 0, y: reducedMotion ? 0 : 14, filter: reducedMotion ? "none" : "blur(6px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: reducedMotion ? 0 : -6, filter: reducedMotion ? "none" : "blur(4px)", transition: { duration: reducedMotion ? 0 : 0.16 } }}
            transition={{ duration: reducedMotion ? 0 : 0.42, ease: [0.22, 1, 0.36, 1] }}>
            {children}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Toasts: top-centre, above every overlay (flight HUD, tour, dialogs) */}
      <div className="pointer-events-none fixed inset-x-0 top-3 z-[90] flex flex-col items-center gap-2 px-3" role="status" aria-live="polite">
        <AnimatePresence initial={false}>
          {toasts.map((t) => {
            const tone = t.tone === "success" ? { c: "#5fcf9a", Icon: CheckCircle2, label: "Done" } : t.tone === "error" ? { c: "#f0707e", Icon: AlertTriangle, label: "Problem" } : { c: "#79c9dc", Icon: Info, label: "Notice" };
            return (
              <motion.div key={t.id} layout initial={{ opacity: 0, y: reducedMotion ? 0 : -18, scale: reducedMotion ? 1 : 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: reducedMotion ? 0 : -10, transition: { duration: 0.15 } }}
                transition={{ type: "spring", stiffness: 420, damping: 32 }}
                className="pointer-events-auto relative w-full max-w-md overflow-hidden rounded-xl border border-white/10 bg-[#0d1424]/95 shadow-[0_14px_40px_rgba(0,0,0,.55)]">
                <div className="flex items-start gap-3 p-3 pr-2">
                  <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full" style={{ background: `${tone.c}22`, color: tone.c }}><tone.Icon className="size-[18px]" aria-hidden /></span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-semibold uppercase tracking-[.18em]" style={{ color: tone.c }}>{tone.label}</p>
                    <p className="text-sm leading-snug text-ink">{t.message}</p>
                  </div>
                  <button aria-label="Dismiss notification" onClick={() => dismissToast(t.id)} className="rounded-md p-1.5 text-muted hover:bg-white/10 hover:text-ink"><X className="size-4" /></button>
                </div>
                <span aria-hidden className="absolute bottom-0 left-0 h-[3px] origin-left" style={{ background: tone.c, width: "100%", animation: reducedMotion ? "none" : "toastbar 3.5s linear forwards" }} />
              </motion.div>
            );
          })}
        </AnimatePresence>
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
