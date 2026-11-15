export type EmotePose = "idle" | "wave" | "ready" | "celebrate";
/** Each emote plays one of the astronaut's animation clips: wave, moon walk (celebrate) or weightless float (ready). */
export const EMOTES: Record<string, { pose: EmotePose; icon: string; label: string; hint: string }> = {
  "emote-wave": { pose: "wave", icon: "👋", label: "Wave", hint: "A friendly wave." },
  "emote-cheer": { pose: "celebrate", icon: "🎉", label: "Cheer", hint: "The moon-walk victory dance." },
  "emote-float": { pose: "ready", icon: "🪐", label: "Float", hint: "Drifting weightlessly." },
};
export const emotePose = (id: string | null | undefined): EmotePose | null => (id && EMOTES[id] ? EMOTES[id].pose : null);
