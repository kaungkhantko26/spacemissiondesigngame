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

## Session 2 (cont.) — Flight simulation (Earth → Moon / planets)
- `src/game/trajectory.ts` (pure, tested): Kepler/Hohmann path from dataset μ, radii and semi-major axes. Moon = Earth-centred (ascent → LEO parking → TLI ellipse → 100 km lunar capture; Moon placed so it is at the apoapsis on arrival). Planets = Sun-centred (Earth + target on circular orbits, Hohmann ellipse, capture). Visual timeline is a 3-segment time warp; telemetry shows real mission-elapsed time, altitude, vis-viva speed, range to target. Failures shape the path (launch loss, signal lost in cruise, flyby on missed insertion, loss in ops).
- `TrajectorySim.tsx`: single R3F canvas (true-scale Moon view, 1 unit = 1000 km; planets: true orbits, enlarged bodies), play/pause/restart/scrub/speed, overview vs follow camera, DOM labels projected from the render loop (drei `<Html>` caused React root warnings). Phase log in FlightView is revealed by playhead position. Reduced motion starts at the end state. Astronaut view now behind a "Meet the commander" toggle (one canvas per view).
- Tests: 4 new trajectory cases (13 total) pass via the shim; vitest itself still can't run in this sandbox.

## Session 3 — Branch consolidation + demo hub
- `main` fast-forwarded to `claude/dazzling-hawking-vwq14c`, which already contained `backend-integration` (live client, `/play/*`), the restyle, GLB astronaut, Mission Architect and flight sim.
- Added `/demo` hub (src/components/screens/Demo.tsx) linking every offline-playable flow; menu has a Demo Hub entry; `/play` without `NEXT_PUBLIC_API_URL` now points to the offline demos. Live cards are disabled until the server URL is set.
- Lint fixes in live code (impure `Date.now()` initial state, setState-in-effect in Account). Verified: typecheck, lint, 24 tests, production build.
- No server code exists in this repo; live `/play` still needs the backend.

## Session 3 (cont.) — Real globe, Moon/Mars only, easier design, perf
- Destinations limited to Moon and Mars (Venus/Mercury/Jupiter removed from `DESTINATIONS`; tests updated).
- Real textures in `public/textures` (three.js example maps: Earth 2K + clouds, Moon 1K); `PlanetModel` uses them via `useTexture`. Mars is still a flat-colour sphere (no texture bundled).
- `useDesignStore.quickStart(destId)`: two-phase search → most reliable go-for-launch build ("Build it for me" button + 3-step banner on /design). Tests in `quickstart.test.ts`.
- Flight view waits on the pad: "Launch from Earth" → 3-2-1 countdown → ascent.
- Perf: evaluation memoized (`useEvaluation`), default quality `medium`, high-performance GL hint. Still open: `astronaut.glb` is 32 MB — compress textures (gltf-transform) for faster loads.
- Menu astronaut re-framed (head no longer cropped). Flight view: close chase camera from the pad, auto switch to system overview after LEO; explosion flash/fireball when a phase is lost (not yet seen live: needs a failing seed).
- Menu astronaut re-framed (head no longer cropped). Flight view: close chase camera from the pad, auto switch to overview after LEO; explosion flash/fireball when a phase is lost (not yet seen live).

## Session 3 (cont.) — Cosmetics beyond colour
- New categories: pattern, headgear, shoulder, boots (13 new items in mock data). Patterns = glowing emissive decal masks (canvas textures, `three/Gear.tsx`); accessories are procedural meshes that follow GLB bones (head/clavicles/ankles; note three strips dots from bone names). `useLook` passes ids+colours to `Astronaut`. Verified on /cosmetics (patterns, halo, flag, thruster boots); other items not all eyeballed.
- Menu astronaut: lower-right of the Earth, turned 45° right (`rotationY` prop), wears equipped cosmetics. Antenna lowered onto helmet; pattern decals softened.
