# Integration Guide
1. Implement each interface in `services/contracts` against the real backend.
2. Swap imports of `@/services/mocks` (stores + screens) for a single `services/index.ts` that exports real implementations.
3. Lobby: push server state through `LobbyService.subscribe`; remove the dev simulator panel in `LobbyScreen`.
4. Role/character: replace local `fillOthers` helpers and client capacity checks in `Mission.tsx` with server responses; keep UI messaging.
5. Mission availability: replace `lib/mission.ts#missionAvailability` with the server-provided config.
6. Telemetry/results: feed `MissionTelemetryService` and `getResult`; screens render values only.
7. Progression/cosmetics: `usePlayerStore` should hydrate from `PlayerService`/`ProgressionService`.
