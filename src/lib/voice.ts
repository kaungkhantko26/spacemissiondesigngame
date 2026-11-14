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
/** Play a pre-generated ElevenLabs clip (public/voice/<id>.mp3, made by scripts/generate-voice.mjs); falls back to browser speech when the clip is not there. */
export function playVoice(id: VoiceId, muted: boolean) {
  if (muted || typeof window === "undefined") return;
  stopVoice();
  const text = lines[id];
  try {
    const a = new Audio(asset(`/voice/${id}.mp3`));
    current = a;
    a.addEventListener("error", () => { if (current === a) { current = null; browserSpeech(text); } }, { once: true });
    void a.play().catch(() => { if (current === a) { current = null; browserSpeech(text); } });
  } catch { browserSpeech(text); }
}
