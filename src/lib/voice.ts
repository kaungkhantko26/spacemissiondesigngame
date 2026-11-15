import lines from "./voiceLines.json";
import { asset } from "./asset";
import { useCaptions } from "./captions";

export type VoiceId = keyof typeof lines;

/** Voice clips (public/voice/<id>.mp3, ElevenLabs) are played through Web Audio: one AudioContext that the first click/key/touch unlocks, which Safari and Chrome both accept.
 *  The browser's robotic speech is only a last resort when a clip cannot be loaded at all; a locked context stays silent and works after the first click. */
let ctx: AudioContext | null = null, installed = false, gen = 0, source: AudioBufferSourceNode | null = null;
const buffers = new Map<string, Promise<AudioBuffer | null>>();

/** The shared audio context (also used by the sound effects). */
export const audioContext = (): AudioContext | null => context();
function context(): AudioContext | null {
  if (ctx) return ctx;
  const AC = typeof window !== "undefined" ? (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext) : undefined;
  if (!AC) return null;
  try { ctx = new AC(); } catch { ctx = null; }
  return ctx;
}
function load(id: string): Promise<AudioBuffer | null> {
  let p = buffers.get(id);
  if (!p) {
    p = (async () => {
      const c = context(); if (!c) return null;
      try {
        const res = await fetch(asset(`/voice/${id}.mp3`)); if (!res.ok) { lastError = `clip ${id} HTTP ${res.status}`; return null; }
        const data = await res.arrayBuffer();
        return await new Promise<AudioBuffer | null>((ok) => { c.decodeAudioData(data, ok, () => { lastError = `clip ${id} could not be decoded`; ok(null); }); }); // callback form: older Safari has no promise version
      } catch (e) { lastError = `clip ${id}: ${e instanceof Error ? e.message : "load failed"}`; return null; }
    })();
    buffers.set(id, p);
  }
  return p;
}
/** Call synchronously inside a click handler: creates and resumes the audio context during the gesture (Safari requires that). */
export function primeVoice() { unlock(); }
let lastError = "";
/** What the browser reports, for the Test voice button. */
export function voiceStatus(): string {
  const c = ctx;
  return `audio ${c ? c.state : "not created"}${lastError ? ` · ${lastError}` : ""}`;
}
function unlock() {
  const c = context(); if (!c) return;
  if (c.state !== "running") void c.resume().catch(() => undefined);
  for (const id of Object.keys(lines)) void load(id); // warm the clips so they start instantly
}
export function installVoiceUnlock() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  for (const ev of ["pointerdown", "keydown", "touchend", "click"] as const) window.addEventListener(ev, unlock, { passive: true });
}
export function stopVoice() {
  gen++;
  try { source?.stop(); } catch { /* already stopped */ }
  source = null;
  try { window.speechSynthesis?.cancel(); } catch { /* ignore */ }
}
function browserSpeech(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  try { const u = new SpeechSynthesisUtterance(text); u.rate = 1.03; window.speechSynthesis.cancel(); window.speechSynthesis.speak(u); } catch { /* speech unavailable */ }
}
/** Resolves true once a clip started (false when muted or the browser has not been unlocked by a click yet). */
export async function playVoice(id: VoiceId, muted: boolean): Promise<boolean> {
  if (muted || typeof window === "undefined") return false;
  installVoiceUnlock();
  stopVoice();
  useCaptions.getState().show(lines[id]);
  const me = gen, c = context();
  if (!c) { browserSpeech(lines[id]); return true; }
  if (c.state !== "running") { try { await c.resume(); } catch { /* needs a gesture */ } }
  const buf = await load(id);
  if (me !== gen) return false; // a newer line took over
  if (!buf) { browserSpeech(lines[id]); return true; } // the clip is missing or undecodable
  if (c.state !== "running") return false; // still locked: silent until the first click
  const src = c.createBufferSource();
  src.buffer = buf; src.connect(c.destination); src.start(); source = src;
  return true;
}

if (typeof window !== "undefined") installVoiceUnlock(); // listen from page load so the very first click already unlocks audio
