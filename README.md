# Space Mission Design Game — Frontend Prototype

Cooperative space-engineering game UI for the NASA Space Apps Challenge 2026.
**Frontend only.** All multiplayer, simulation, scoring, progression and persistence are mocked.

## Run
```bash
npm install
npm run dev      # http://localhost:3000
npm run build
npm test         # vitest (frontend behaviour only)
npm run typecheck
```

## Journey
`/splash → /menu → /profile /cosmetics /stats /settings → /team → /team/create|join → /team/lobby → /mission/select → briefing → roles → characters → confirm → loading → gameplay → results → /menu`

## Structure
- `src/app/*` thin route files → `src/components/screens/*`
- `src/components/ui` design-system components; `shell` app shell; `three` R3F scenes (`lazy.tsx` = client-only wrappers)
- `src/types` data contracts · `src/services/{contracts,mocks}` service interfaces + mocks · `src/data/mock` datasets
- `src/stores` Zustand stores · `src/lib` presentation helpers

See FRONTEND_ARCHITECTURE.md, UI_DESIGN_SYSTEM.md, API_CONTRACTS.md, MOCK_DATA.md, INTEGRATION_GUIDE.md, AGENTS.md, agentlog.md.
