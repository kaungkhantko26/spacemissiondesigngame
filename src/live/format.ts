import type { ChallengeClock } from "./types";

/** Seconds left on the hard-mode clock, using the server's clock to avoid device skew. */
export function secondsLeft(c: ChallengeClock | null, receivedAtLocal: number, nowLocal = Date.now()): number | null {
  if (!c) return null;
  const left = c.deadline - c.serverNow - (nowLocal - receivedAtLocal);
  return Math.max(0, Math.round(left / 1000));
}
export function mmss(sec: number): string {
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
export function fmtMoney(m: number | null | undefined): string {
  if (m == null) return "—";
  return m >= 100 ? `$${Math.round(m)}M` : `$${m.toFixed(m < 10 ? 2 : 1)}M`;
}
export const OUTCOME_LABEL: Record<string, string> = {
  success: "Mission success", partial: "Partial success", failure: "Mission failed", launch_failure: "Launch failure",
};
