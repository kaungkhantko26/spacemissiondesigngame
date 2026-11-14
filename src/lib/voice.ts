import lines from "./voiceLines.json";
import { asset } from "./asset";

export type VoiceId = keyof typeof lines;
/** One shared <audio> element, unlocked by the first click/key/touch. Safari and Chrome only allow sound that starts from (or after) a user gesture, and a fresh element every time would never be unlocked. */
let gen = 0; // newest request wins
let el: HTMLAudioElement | null = null, unlocked = false, installed = false;
const SILENT = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAABErAAABAAgAZGF0YQAAAAA=";
function player(): HTMLAudioElement { if (!el) { el = new Audio(); el.preload = "auto"; } return el; }
function unlock() {
  if (unlocked) return;
  const a = player(), tok = ++gen; // a real clip requested meanwhile bumps gen, and then we leave the element alone
  a.muted = true; a.src = SILENT;
  void a.play().then(() => { if (tok !== gen) return; a.pause(); a.muted = false; unlocked = true; }).catch(() => { if (tok === gen) a.muted = false; });
}
export function installVoiceUnlock() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  for (const ev of ["pointerdown", "keydown", "touchend"] as const) window.addEventListener(ev, unlock, { passive: true });
}
export function stopVoice() { gen++; try { el?.pause(); window.speechSynthesis?.cancel(); } catch { /* ignore */ } }
function browserSpeech(text: string) {
  if (!("speechSynthesis" in window)) return;
  try { const u = new SpeechSynthesisUtterance(text); u.rate = 1.03; window.speechSynthesis.cancel(); window.speechSynthesis.speak(u); } catch { /* speech unavailable */ }
}
/** Play a pre-generated ElevenLabs clip (public/voice/<id>.mp3, made by scripts/generate-voice.mjs); falls back to browser speech when the clip is missing.
 *  Resolves true once sound actually started (false when muted or autoplay is still locked: it works after the first click). */
export function playVoice(id: VoiceId, muted: boolean): Promise<boolean> {
  if (muted || typeof window === "undefined") return Promise.resolve(false);
  installVoiceUnlock();
  stopVoice();
  const me = gen, text = lines[id], a = player();
  return new Promise((resolve) => {
    a.onerror = () => { if (me === gen) browserSpeech(text); resolve(true); };
    a.muted = false; a.src = asset(`/voice/${id}.mp3`);
    a.play().then(() => resolve(true)).catch((e: unknown) => {
      if (me !== gen) return resolve(false);
      if (e instanceof DOMException && e.name === "NotAllowedError") { browserSpeech(text); resolve(false); } // still locked: try speech, retry on next trigger
      else { browserSpeech(text); resolve(true); }
    });
  });
}
