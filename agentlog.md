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
- Menu astronaut: turned 45° to the LEFT (rotationY -PI/4), scale 1.6, bottom-right corner.

## Session 3 (cont.) — GitHub Pages
- Static export when `GITHUB_PAGES=1` (next.config.ts: output export, basePath from NEXT_PUBLIC_BASE_PATH, trailingSlash). Public files go through `asset()` (src/lib/asset.ts) so the sub-path works. `npm run deploy:pages` builds and force-pushes ./out to the gh-pages branch (no workflow file: the gh token has no `workflow` scope). Pages source = gh-pages /. Live: https://kaungkhantko26.github.io/spacemissiondesigngame/ (static only; /play needs a backend URL at build time).

## Session 3 (cont.) — Mission Control vertical slice (Moon orbiter)
- `src/game/ops/` (pure, tested): `core.ts` (types + OPS balance constants, all game values), `sim.ts` (createOps/step/advance, command queue, phases ascent→cruise→insertion→science, power/battery/data/comms/thermal/health, mission report), `events.ts` (11 data-driven events with 2–4 choices, delayed effects, quality scores), `store.ts` (Zustand, in-memory only: persistence is backend scope).
- UI `/mission-control` (`MissionControl.tsx`): briefing (contract, objectives, design check, recommended design) → Mission Control dashboard (phase stepper, MET, Pause/1×/10×/100×, orbit schematic, six resource cards with "what drives it" explanations, alerts that select the relevant resource, objectives, health, quick actions + command queue + "Auto-plan next 24 h", log, event dialog pauses time) → report (7-category scorecard with cause/effect text, objectives, lessons). Mobile: Status/Orbit/Commands tabs. Cruise auto-warps ×10.
- Design link: Moon review panel has "fly it live"; menu has Mission Control. `quickStart` now prefers the destination's primary instrument tag (magnetometer for the Moon).
- Balance (headless perfect-play autopilot): patch antenna → partial (~22 GB), 1 m / 2.5 m dish → success. Tuning knobs live in `OPS`. Not done: save/resume, Mars scenario, wizard mode, ten-minute playtest with real humans.
- Tests: `ops.test.ts` (event shape, determinism, resource invariants, report, eclipse, antenna comparison); vitest timeout raised to 60 s.
- Fix: shell header path check strips the trailing slash (GitHub Pages serves /menu/), so the menu no longer shows two profile bars. Menu astronaut is sized from the canvas width (useThree viewport) so it is never clipped.

## Session 4 — Launch Control (ground → orbit ascent game)
- Merged Kaung's `main` (Mission Control, Pages export, cosmetics, menu tweaks) before starting; branch was a clean fast-forward.
- **Scope note:** AGENTS.md says "never implement simulation/scoring"; the user explicitly asked for a ground-to-space launch simulation game with difficulty levels. Logic is isolated in pure `src/game/launch/` (no UI/network/persistence).
- Data: `scripts/build-game-data.py` now also exports 6 real spaceports (dataset launch pads: lat/lon, launches, Earth-rotation boost) and vehicle liftoff mass/thrust/diameter/length. `data.ts` has `LaunchSite`.
- `launch/core.ts`: 2-D inertial ascent (gravity, rotating atmosphere, exponential density, drag, winds, thrust vs altitude, 2 stages + coast, fairing, orbit elements), max-Q / q·α / g-load structural limits, anomalies, outcome + score. Rocket built from the dataset vehicle (liftoff mass/thrust clamped to T/W 1.2–1.6; stage split/structure calibrated so ideal Δv at full LEO capacity ≈ 10 km/s — GAME values: Isp, inert fractions, Cd, limits). Guidance: altitude pitch profile with airflow-lead clamp for stage 1; terminal (time-to-go) guidance + guided cutoff for the upper stage.
- **Difficulty (RULES):** Cadet/easy = autopilot (pitch, throttle, staging, cutoff), calm, payload 60 %, perigee ≥120 km, wide limits + AoA protection, ×1. Pilot/medium = manual stage 1 + optional upper-stage guidance, winds 15 m/s, 30 % minor anomaly, payload 80 %, perigee ≥150, ×1.5. Commander/hard = fully manual incl. staging/cutoff/restart, winds 30 m/s, 50 % minor + 30 % major anomalies, payload 90 %, perigee ≥180 & apogee ≤600, tight limits, no pitch cue, ×2.5.
- Balance (headless): autopilot reaches orbit on all 10 vehicles at 60–95 % payload; the test-pilot bot (`launch/bot.ts`, reaction delay, max-Q throttling, manual staging/cutoff) wins 180/180 on medium and hard across 10 vehicles × 6 sites × 3 seeds.
- UI `/launch` (`LaunchControl.tsx`): briefing (3 difficulty cards with written rules, spaceport list, vehicle list, summary) → pad (tower, rocket, countdown) → flight (2-D canvas via `launchDraw.ts`: pad+tower close-up that zooms out to Earth + orbit view, trail, staging debris, predicted orbit, Kármán/target rings, explosion; HUD with clock, alt/speed/downrange/g, q and AoA gauges, throttle, fuel, apo/peri, pitch cue; milestone checklist; log; controls: pitch ↑↓, throttle, STAGE, CUT, RESTART, autopilot, pause, 1–10× warp + keyboard) → result (score, grade, tips, "Next: design the Moon mission"). Menu: Launch Control is now the primary entry; Demo Hub card added.
- Verified: typecheck, lint (0 errors), production build, 13 new tests (`launch.test.ts`) via a vitest shim (real vitest still can't run in this sandbox), browser playthroughs of Cadet (full orbit), Commander (manual staging prompt), Pilot (AoA break-up result).
- Not done: tablet/touch tuning of the controls, sound, hand-off of the achieved orbit into Mission Architect (only a link), 3-stage/booster models (all vehicles modelled as 2 stages), save of best scores (backend scope).

## Session 4 (cont.) — 3-D models for Mission Architect components
- `src/game/parts3d.ts` (pure three.js, tested in `parts3d.test.ts`): procedural stylised models for all 10 launch vehicles (per-vehicle livery + strap-on boosters/side cores), chemical engine + NSTAR/NEXT ion + BPT-4000 Hall thrusters (with plumes), solar wings (cell texture, size follows m²), RTG, patch/1 m/2.5 m/4 m dishes, the 7 instrument types (imager, radar, fields boom, plasma cup, particles, spectrometer, generic; scaled by mass), and `makeSpacecraft()` which assembles the selected parts on a gold-foil bus.
- Thumbnails (`partThumbs.ts`): ALL part pictures are rendered once by a single temporary WebGL context (released with `forceContextLoss`), cached as PNG data URLs — no WebGL context per card (AGENTS.md). Cards in /design show them (vehicles, propulsion, power, antennas, instruments); dishes share one scale reference so sizes are comparable.
- Live preview (`CraftPreview.tsx`): the one Canvas on /design, in the sticky review column, with Spacecraft / Rocket tabs; model rebuilt (and disposed) from the current design; auto-rotates unless reduced motion, drag to orbit. Aside is now scrollable (`max-h-[calc(100vh-2rem)]`).
- Not done: glTF/GLB parts (all procedural), per-component hover zoom, part animation (thruster plume flicker), parts on the Launch Control rocket sprite.

## Session 4 (cont.) — Real environment for Launch Control + 3-D rocket on the pad
- Merged `main` (PR #1) first; branch is current.
- **Scenery** (`components/game/launchScenery.ts`, procedural 2-D canvas, pad-local metres): per-spaceport `BIOMES` (Florida coast, California coast range, Guiana rainforest, Bay-of-Bengal sand spit, Kazakh steppe, Gobi) with their own terrain colours, hill layers with aerial perspective, vegetation (palms/jungle/scrub/dunes) in perspective rows with parallax, sea + shoreline + sun glitter where the site is coastal, golden-hour sun and horizon haze, a sky that follows `skyAt(h)` (pale horizon → blue → black above ~100 km), cumulus/cirrus layers the rocket flies through, launch complex (masts, tanks, buildings, apron, flame trench), ground glare + billowing exhaust smoke at liftoff, vapour trail that fades with air density (trail is stored as x,y,t triplets and drawn in the Earth-fixed frame). Landscape LOD fades out between 30 and 100 km camera height.
- **Real Earth from orbit** (`earthDisc.ts`): the repo's `public/textures/earth.jpg` + `earth_clouds.png` projected orthographically, looking down the launch-orbit normal so the pad sits on the rim and eastward flight is clockwise (matches the 2-D sim); rotates with Earth; sun-side shading.
- **3-D rocket as sprite** (`partThumbs.ts: loadRocketSprite`): the vehicle's `makeRocket` model rendered side-on (orthographic, transparent, one short-lived WebGL context) and drawn on the pad and in flight; stage 2 = top 38 %, the spent stage = lower 62 % tumbling. Falls back to the vector rocket if WebGL is unavailable.
- Tests: `launch.test.ts` now 16 (biome per site, coastal vs inland, sky darkening) — via vitest shim (real vitest still can't run in this sandbox). Lint 0 errors/warnings; production build OK.
- Not done: 3-D terrain/heightmap, per-site time of day or weather, day/night terminator following the rocket, city lights, real coastline shapes (coast side is stylised), biome art for orbit-view atmosphere haze.

## Session 4 (cont.) — Mission Architect launch now uses the real ascent
- User saw the deployed Mission Architect flight still using the old plain chase-camera launch. "Go for launch" now runs the full Launch Control ascent first (`AscentFlight`, exported from `LaunchControl.tsx`), with the design's rocket, payload = min(spacecraft wet mass, LEO capacity), and the Spaceport + Launch difficulty selectors added to the design-review panel (shared `useLaunchSetup`).
- Ascent failure → stays in the ascent result overlay (mission lost at launch; Fly again / Back to design). Ascent success → "Continue: fly to the Moon" → `simulate()` with launch odds forced to 1 (the remaining phases still roll on the design's odds) → Earth→Moon trajectory view starting at the parking orbit (`TrajectorySim startU`), launch phase text reports the achieved orbit, difficulty and spaceport. The old pad/countdown gate in the trajectory view is no longer used from Mission Architect.
- Redeployed to GitHub Pages (`npm run deploy:pages`).

## Session 5 — review fixes (external review of the deployed game)
- #1 launch sim speed was frame-rate dependent (`Math.ceil` per frame): `LaunchSession.tick` now uses a fixed-step accumulator (tested at 30/60/120/144 FPS and with warp).
- #2 RTG power vanished in eclipse: `Evaluation` now exposes `solarGenW` / `rtgGenW`; Mission Control applies eclipse + pointing derating to solar only.
- #3 readiness vs operations: new shared model `src/game/ops/model.ts` (orbit-average power by mode, eclipse battery, sustained-observing data balance). Architect gains checks `ops-power`, `ops-battery`, `ops-data` (Moon only, where Mission Control exists) and a "Power by operating mode" table in the review panel.
- #4 mandatory payload: `Destination.requires` (Moon = fields instrument) → `contract` check blocks launch with an explanation.
- #5 safe-mode scoring: new `stats.safeScienceS`; the report's safe-mode share uses science-phase safe time only.
- #7 quick start now requires the contract's science goal first (then reliability, cost); search widened (arrays up to 60 m², 3-instrument sets).
- #8 label "Mission success odds" → "Flight survival odds" with a tooltip saying what it does and does not mean.
- #9 ion thrust is throttled by the average solar power over the transfer (`electricThrottle`), check text explains it.
- Not done (needs product decisions): #6 one shared mission lifecycle across Launch Control / Architect / Mission Control, #10 persistence + XP (AGENTS.md says no persistence in the frontend).
- Tests: `review.test.ts` (13) + updated `game.test.ts` designs; all 6 test files pass via the vitest shim.

## Session 5 (cont.) — Saturn V and the mission to the Moon
- **Saturn V** (`ll2_cfg_93`) added to the dataset slice with its verified three stages (S-IC/S-II/S-IVB dry + propellant masses, F-1/J-2 thrust, 2,970 t / 35.1 MN liftoff, 140 t LEO) and the Apollo 11 spacecraft mass (43,904 kg) as the TLI payload. LL2 has no price → 185 M$ game value (flagged `launch_cost_is_game`). Isp values are game values (F-1 263/304 s, J-2 421 s). Appears in Launch Control and Mission Architect lists; 3-D model `makeSaturnV()` (true proportions, escape tower, fins) used for thumbnails, preview and the flight sprite.
- **3-stage ascent** in `launch/core.ts`: `Rocket.s3/stageNames/stageFrac`, `Flight.stage 1|2|3`, `prop3`, separation sprite crops, 3 fuel gauges + milestones in the HUD.
- **Moon mission** (`MissionKind "moon"`, selectable in the Launch Control briefing; Saturn V pre-selected): parking orbit (phase `parking`) → TLI window ~0.6 orbit later (`tliStartAngle`, indicator + warp 50×) → upper stage re-ignition (autopilot at the window, or **Ignite TLI**) → prograde burn (`tli`) → judged on apogee vs the Moon's distance (band 0.93–1.07) and window error (fail beyond 20°) → `translunar`. Camera pulls back to frame the transfer ellipse; Moon + TLI-window marker drawn. Score: up to 1300 base (+TLI window/apogee accuracy).
- **Lunar leg** (`MoonLeg.tsx`): after TLI → Earth→Moon trajectory view (coast 5 d, LOI) with dice (99 % coast, ~93–97 % insertion, better with a centred TLI); final score/grade up to 1650 base × difficulty.
- Balance (headless): autopilot completes the Saturn V Moon mission; Pilot/Commander test pilots 36/36 across all 6 sites; Falcon 9 / Delta IV Heavy / Falcon Heavy can do it with a light payload; smaller rockets run out of upper-stage propellant at TLI with a message pointing to the Saturn V.
- Menu astronaut enlarged (scaled from the panel height, feet near the bottom, taller panel). Canvas guard for a not-yet-laid-out first frame (NaN gradient error).
- Tests: `launch.test.ts` 23 (7 new Saturn V/TLI cases). All suites pass via the shim.

## Session 5 (cont.) — Moon leg visuals, pacing, Architect Moon mission, menu astronaut
- **Menu astronaut head cropped**: hovering Stats played the `floating` clip, which lifts the model out of the canvas. Stats now uses idle; scale reduced to 0.34×panel height for headroom.
- **Moon mission pacing**: TLI window now opens ~0.3 orbit (~28 min) after insertion; `LaunchSession` auto-warps to 50× in parking orbit, drops to 1× when the window is <90 s away, and caps the TLI burn at 10×.
- **Lunar arrival** (`trajectory.ts`): replaced the decaying spiral with a real hyperbolic approach (periapsis = 100 km capture radius, v∞ from the transfer) → insertion burn → circular orbit, drawn Moon-relative (`pathRel`, `seg3Index`, capture ring); the coast end blends into the approach start (no jump).
- **Earth→Moon view** (`TrajectorySim.tsx`): default is now a cinematic chase camera (`CineRig`): starts close to a textured, lit Earth, keeps the craft in the foreground with the Moon growing ahead, then circles the textured Moon during capture; craft marker points along its velocity; the planned (dashed) path stops at arrival; toggle button for the old map view. Used by Launch Control's Moon leg and Mission Architect.
- **Architect → full Moon mission**: "Launch mission" select (quick ascent, or parking orbit → TLI burn → Moon) in the review panel when the rocket can do it (Saturn V / ≥20 t); the Moon flight then starts at the coast.
- Verified: typecheck, lint (0 errors), production build, all 6 test suites via the shim, browser checks of the Moon leg (start/coast/capture) and the menu astronaut at 1890×950.

## Session: Team Up gameplay
- /mission/gameplay now runs the real launch sim (Saturn V + Moon leg for Lunar Landing, Falcon-class orbit otherwise) using the chosen difficulty; results screen shows the real score (src/game/launch/teamResult.ts). Mock telemetry removed.
- Fix: Team Up setup/crew now persist in sessionStorage (refresh no longer bounces to mission select). Launch countdown has launch-director voice (speechSynthesis) with mute toggle.
- Removed the Chinese launch vehicle (Long March 3B/E) and Jiuquan launch site from the dataset, scenery and 3D models per product direction.
- Moon mission pacing: auto-warp 5x for the last 90 s before the TLI window with autopilot on, and 10x for the ~4.5 min TLI burn (it looked like a stall at 1x).
- Moon/transfer view: replaced the white cone craft marker with an Apollo-style spacecraft model (CM, SM, engine bell, dish, RCS quads).
- Menu: astronaut greets on hover/click (speech bubble + browser voice) and offers a 7-step narrated How to play tutorial (src/components/screens/MenuGuide.tsx); also a How to play button under the menu.
- Menu greeting bubble: dropped backdrop-blur/transform animation (Safari hides the WebGL astronaut canvas under blurred overlays).
- Menu astronaut: greeting voice plays once per visit; "How to play" is now a skippable spotlight tour (src/components/game/Tour.tsx) over the real menu, Launch Control briefing and flight HUD. Voice lines load from public/voice/<id>.mp3 (ElevenLabs; scripts/generate-voice.mjs, docs/voice-script.md) with browser speech fallback.
- Added the real greeting voice clip public/voice/greeting.mp3 ; countdown clips cd-0..cd-10 generated with ElevenLabs voice c6SfcYrb2t09NHXiT80T.
- playVoice resolves whether sound started; greeting only counts as played after audio actually starts (autoplay needs a click).
- Flight callouts: launch director voice (ElevenLabs clips) reports max-Q, separations, ignitions, Karman line, orbit/parking, TLI, loss; muted by the speaker button.
- Moon coast voice: flight director calls coast start, mid-course, approach, capture/lost contact (MoonLeg), with a mute button.
- Voice: single shared audio element unlocked by the first user gesture (Safari blocked new Audio().play() outside a click), falls back to browser speech if still locked.
- Voice now plays via Web Audio (AudioContext unlocked by first gesture, clips decoded/cached); browser speech only if a clip cannot load. Fixes users hearing the robotic fallback instead of ElevenLabs.
- Astronaut GLB shrunk 32MB -> 18.7MB (textures downscaled/JPEG); no longer preloaded globally (Launch Control/Moon views never download it); menu shows loading progress. Voice: audio unlock listens from page load, primeVoice() inside the Start countdown click, Test voice button shows audio state.
- Astronaut: GLB 32MB -> 11.9MB (dropped unused TANGENT/UV1/UV4, weights as uint16, JPEG textures); instant poster image (astronaut-poster.webp) until the live model is ready; Boundary retries a dropped model download (4x) instead of leaving a hole.
- Menu simplified: 4 main choices + collapsible More options; Test voice moved to Settings; tour points at More options.
- Sound design: procedural Web Audio rocket engine (src/lib/sfx.ts) follows throttle/altitude/max-Q; one-shots for ignition, separation, upper-stage ignition, explosion, chime. ElevenLabs key lacks sound_generation permission so effects are synthesised, not generated.
- Moon coast sound: cabin hum throughout, engine during mid-course correction and the LOI burn, chime or explosion at the end; shares the mute button with the voice.
- App-wide sound: GlobalSound (UI clicks/hover ticks, ambient bed outside /launch), playSfx self-resumes the AudioContext, Test sound in Settings, flight sound follows the global mute. Moon coast engine + hum.
- Clouds: more layers + soft neutral cloud deck below the rocket while climbing out; guards stop cloud/deck drawing from exploding when zoomed out (was the lag near the top); flight canvas DPR capped 1.5, frame dt cap 0.25. Profile: crew ID badge on a draggable swinging lanyard. Engine sound: slow attack and long outro on cutoff. Sound: recorded samples in public/sfx/<id>.mp3 override synth; hover ticks and loud ambient bed removed.
- Click sound: clean short sine blip, no noise burst, quieter.
- Cosmetics now real: unlocks tied to actual play (src/game/progress.ts, saved in localStorage), toasts on unlock, equipped look restored on load, emote sets the menu astronaut pose, patch + suit show on the ID badge, own look on the Team Up lineup. Profile layout fixed (preview visible, badge beside history). Launch sound: hiss and noise burst removed, ~70% quieter.
- Profile picture templates: 9 templates (initial, helmet, rocket, planet, moon, star, satellite, comet, alien) with background/colour/frame/shape, saved in localStorage (src/game/avatar.ts, AvatarArt, AvatarEditor); used by PlayerAvatar for the local player everywhere.
- Menu astronaut: drag to turn (inertia, eases back to the waving pose after ~2.5s idle).
- Removed the ambient bed (old-TV hum) from menus: only the soft click remains outside the flight.
- Engine sound: removed the chopped "shaking" noise layer (its oscillator was still driving the gain) and the hiss; only a deep rumble remains, and pausing silences it at once (fade is done by the audio engine, not by repeated updates). Flags: Myanmar, NASA meatball + wordmark (supplied logos), other nations and a custom builder, worn on the shoulder and shown on the ID badge. Backpack add-ons (jet, solar wings, telescope) and chest patches (incl. NASA, Myanmar) now render on the astronaut. Profile reorganised into Overview / Profile picture / Flag tabs.
- Engine sound: removed tonal sub oscillators (buzz on small speakers) and made the noise loop seamless (equal-power crossfade) so it no longer pulses. Flag: crossbar attaches the cloth to the pole; preview camera pulled back. ID badge: Save image (PNG), Share (Web Share), Copy link -> /id/?c=... public card page. Editable display name (persisted, src/game/identity.ts).
