# Voice script

Generate each line as an MP3 (ElevenLabs or anything else) and save it as `public/voice/<id>.mp3`. A calm, clear male or female narrator works well; keep each clip short and trim silence. Missing files fall back to the browser voice.

Or run `ELEVENLABS_API_KEY=... node scripts/generate-voice.mjs` (optional `ELEVENLABS_VOICE_ID`) to create them all.

| File | Text |
|---|---|
| `greeting.mp3` | Hi, and welcome aboard Space Mission Design! I'm your astronaut. Launch a real rocket, send Apollo to the Moon, or design your own mission. New here? Press the tour button and I'll show you around. |
| `cd-10.mp3` | T minus 10. |
| `cd-9.mp3` | 9. |
| `cd-8.mp3` | 8. |
| `cd-7.mp3` | 7. |
| `cd-6.mp3` | 6. |
| `cd-5.mp3` | 5. |
| `cd-4.mp3` | 4. |
| `cd-3.mp3` | 3. Main engine start. |
| `cd-2.mp3` | 2. |
| `cd-1.mp3` | 1. |
| `cd-0.mp3` | Liftoff! |
