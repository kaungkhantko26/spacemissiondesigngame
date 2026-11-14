# Agent Log
## Session 1
**Done:** scaffold (Next 16, Tailwind 4, R3F, Zustand), tokens, UI kit, shell, types, mock data + services, stores, 3D components, all 15 screens, tests, docs.
**Tests:** vitest unit/UI tests pass; production build passes.
**Known issues:** no audio assets (mute toggle is state only); astronaut is procedural; mission-card canvases are several WebGL contexts (consider thumbnails); dev server walkthrough only spot-checked.
**Pending:** GLB models, audio, thumbnails, component-level tests for full screens, real backend wiring.
**Integration:** see INTEGRATION_GUIDE.md.

## Session 2
**Done:** replaced procedural astronaut with rigged GLB (`public/models/astronaut.glb`, from Tianmin435/s1203com, specular-glossiness materials converted to standard PBR). Poses map to clips (idle/wave/ready→floating/celebrate→moon_walk); reduced motion freezes animation. Skins = suit-colour tint on `material_0/2`, visor from helmet colour. Added suits: Neon Cyan, Stealth Black, Lunar Silver.
**Verified:** typecheck, lint, production build, browser screenshot of Cosmetics (default + Launch Orange). `npm test` could not run here (vitest rolldown native binding missing in this sandbox).
**Known issues:** GLB is 32 MB (4K PNG textures) — compress/resize textures (gltf-transform) before shipping; multiply tint darkens bright skins; broader UI rebrand not started (reference game/astronaut page were unreachable at the time).

## Session 2 (cont.) — UI restyle
Matte mission-control look replacing glass/neon: solid panels + hairline borders + orange corner tick, Rajdhani display font (uppercase, tracked), tactile press-edge buttons, segmented XP bar, tighter radii, orange selection state. Token names unchanged (`globals.css`), so all screens inherit. Reviewed backend-integration branch: client layer only (`src/live/*`, `/play/*`), no server code in this repo; not merged, will need restyling to match.
## Backend integration (branch `backend-integration`)
- Added `src/live/` (types, REST+WebSocket client, Zustand store `useGame`, format helpers) matching the real game server.
- Added `/play` (src/components/live/*): entry → lobby/mission+difficulty → crew/character pick → design screen → report. Additive; mock screens/tests untouched.
- Enable with `NEXT_PUBLIC_API_URL` (see `.env.example`). Visual design intentionally minimal (to be restyled).
- Verified client vs real backend in Node; typecheck of live code done with stubs only — run `npm test && npm run build` locally.
- Added /play/profile, /play/cosmetics, /play/stats (live XP, upgrades, trophies); main menu routes to /play/* when NEXT_PUBLIC_API_URL is set.

## Session 2 (cont.) — UX pass
Splash = pre-launch checklist + T-minus countdown (still gated on fonts/3D chunk, ≥4 s). Menu = mission-control status strip (live UTC clock; orbit/station/"crews online" are mock placeholders), 1–5 keyboard shortcuts, astronaut reacts to hovered/focused item (Cosmetics→moon_walk, Stats→floating). Staggered `.enter` entrances + `.lift` hover on menu/mission/cosmetic cards (disabled under reduced motion). Global input styling restyles the plain `/play` live screens' fields; their layouts are still unstyled.

## Session 2 (cont.) — Mission Architect (game logic from space-mission-dataset)
**Scope note:** AGENTS.md says "never implement simulation/scoring"; the user explicitly asked for game logic built on kaungkhantko26/space-mission-dataset, so it lives in an isolated, pure module `src/game/` (no UI/network/persistence) that can move to the backend later.
- `scripts/build-game-data.py` → `src/game/dataset.json`: JPL/NSSDC body μ/radii/orbits/irradiance, 10 real launch vehicles (capacity, price, flight record), 3 NASA electric thrusters, 16 NASA instruments with quoted mass (+power where stated).
- `physics.ts`: Hohmann/escape/capture Δv from dataset μ (Moon 3.9 km/s, Mars 4.4, Jupiter 8.0), rocket equation, link budget. `engine.ts`: mass/Δv/power/time/budget/link checks (go/no-go), reliability (Jeffreys estimate from real launch records), seeded 4-phase simulation, score + grade. `store.ts`: Zustand design state.
- `/design` (DesignStudio): 7 build sections, sticky live design review, launch sequence + results (astronaut celebrates/waits). Menu primary action = Design Mission.
- **Game values (not dataset):** chemical Isp/engine, component prices, solar/RTG specs, antenna models, destination budgets, science values — marked "game" in the UI. Mercury/Jupiter are impossible with chemical tanks (physics), needing ion thrusters + solar arrays (+RTG at Jupiter).
- Tests: `src/__tests__/game.test.ts` (9 cases) — vitest can't run in this sandbox; the cases were run through a shim and pass 9/9. Data licence CC BY 4.0 — attribution footer on /design.
