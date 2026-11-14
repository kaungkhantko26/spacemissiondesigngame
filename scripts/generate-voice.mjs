#!/usr/bin/env node
// Pre-generates the game's voice lines with ElevenLabs into public/voice/<id>.mp3.
// The API key is only used here, on your machine; it is never shipped to the browser.
//   ELEVENLABS_API_KEY=... [ELEVENLABS_VOICE_ID=...] node scripts/generate-voice.mjs [--force]
import { readFileSync, mkdirSync, existsSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const lines = JSON.parse(readFileSync(join(root, "src/lib/voiceLines.json"), "utf8"));
const key = process.env.ELEVENLABS_API_KEY;
const voice = process.env.ELEVENLABS_VOICE_ID || "JBFqnCBsd6RMkjVDRZzb"; // "George" premade voice
if (!key) { console.error("Set ELEVENLABS_API_KEY"); process.exit(1); }
const out = join(root, "public/voice"); mkdirSync(out, { recursive: true });
for (const [id, text] of Object.entries(lines)) {
  const file = join(out, `${id}.mp3`);
  if (existsSync(file) && !process.argv.includes("--force")) { console.log("skip", id); continue; }
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_64`, {
    method: "POST", headers: { "xi-api-key": key, "content-type": "application/json" },
    body: JSON.stringify({ text, model_id: "eleven_multilingual_v2", voice_settings: { stability: 0.5, similarity_boost: 0.8 } }),
  });
  if (!res.ok) { console.error(id, res.status, (await res.text()).slice(0, 200)); process.exit(1); }
  writeFileSync(file, Buffer.from(await res.arrayBuffer())); console.log("wrote", id);
}
