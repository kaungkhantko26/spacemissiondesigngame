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
