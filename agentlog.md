# Agent Log
## Session 1
**Done:** scaffold (Next 16, Tailwind 4, R3F, Zustand), tokens, UI kit, shell, types, mock data + services, stores, 3D components, all 15 screens, tests, docs.
**Tests:** vitest unit/UI tests pass; production build passes.
**Known issues:** no audio assets (mute toggle is state only); astronaut is procedural; mission-card canvases are several WebGL contexts (consider thumbnails); dev server walkthrough only spot-checked.
**Pending:** GLB models, audio, thumbnails, component-level tests for full screens, real backend wiring.
**Integration:** see INTEGRATION_GUIDE.md.

## Backend integration (branch `backend-integration`)
- Added `src/live/` (types, REST+WebSocket client, Zustand store `useGame`, format helpers) matching the real game server.
- Added `/play` (src/components/live/*): entry → lobby/mission+difficulty → crew/character pick → design screen → report. Additive; mock screens/tests untouched.
- Enable with `NEXT_PUBLIC_API_URL` (see `.env.example`). Visual design intentionally minimal (to be restyled).
- Verified client vs real backend in Node; typecheck of live code done with stubs only — run `npm test && npm run build` locally.
- Added /play/profile, /play/cosmetics, /play/stats (live XP, upgrades, trophies); main menu routes to /play/* when NEXT_PUBLIC_API_URL is set.
- Main flow (/team, /team/lobby, /mission/select|briefing|roles|characters|confirm|gameplay|results) now renders live screens (src/components/live/Screens.tsx) in the original UI style when NEXT_PUBLIC_API_URL is set; mock screens remain as fallback. Routes follow the server room state (useGate).
