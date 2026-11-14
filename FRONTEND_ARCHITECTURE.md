# Frontend Architecture
- **Routing:** Next.js App Router; each route renders one screen component. `GameShell` (root layout) provides header (hidden on splash/menu/loading/gameplay), page transitions, toasts, confirm dialog, a11y toggles.
- **State:** Zustand (`src/stores/index.ts`): `useUIStore` (transient), `usePlayerStore`, `useLobbyStore`, `useMissionSetupStore`, `useCrewSelectionStore`, `useCosmeticsStore`. Selections persist across navigation (in-memory). Server-owned values are mock stand-ins.
- **Services:** screens/stores call interfaces in `services/contracts`; implementations live in `services/mocks`.
- **3D:** one `Scene3D` wrapper per view (shared canvas, error boundary, quality-based DPR, lighting presets). Procedural `Astronaut`, `PlanetModel`, `SpacecraftPreview`, `MissionHangar`, `CrewLineup`, `OrbitalVisualization`; swap for GLBs without touching screens. Mission cards use small static-ish canvases; replace with thumbnails if WebGL context count becomes an issue.
- **Navigation never depends on 3D:** failures fall back to a text placeholder.
