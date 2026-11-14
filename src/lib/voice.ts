import lines from "./voiceLines.json";
import { asset } from "./asset";

export type VoiceId = keyof typeof lines;
let current: HTMLAudioElement | null = null;

export function stopVoice() {
  try { current?.pause(); current = null; window.speechSynthesis?.cancel(); } catch { /* ignore */ }
}
function browserSpeech(text: string) {
  if (!("speechSynthesis" in window)) return;
  try { const u = new SpeechSynthesisUtterance(text); u.rate = 1.03; window.speechSynthesis.cancel(); window.speechSynthesis.speak(u); } catch { /* speech unavailable */ }
}
/** Play a pre-generated ElevenLabs clip (public/voice/<id>.mp3, made by scripts/generate-voice.mjs); falls back to browser speech when the clip is not there.
 *  Resolves true once sound actually started (false when muted or the browser blocked autoplay, which needs a click first). */
export function playVoice(id: VoiceId, muted: boolean): Promise<boolean> {
  if (muted || typeof window === "undefined") return Promise.resolve(false);
  stopVoice();
  const text = lines[id];
  return new Promise((resolve) => {
    try {
      const a = new Audio(asset(`/voice/${id}.mp3`));
      current = a;
      a.addEventListener("error", () => { if (current === a) { current = null; browserSpeech(text); } resolve(true); }, { once: true });
      a.play().then(() => resolve(true)).catch((e: unknown) => {
        if (current !== a) return resolve(false);
        current = null;
        if (e instanceof DOMException && e.name === "NotAllowedError") resolve(false); // autoplay blocked: try again on the next click
        else { browserSpeech(text); resolve(true); }
      });
    } catch { browserSpeech(text); resolve(true); }
  });
}
