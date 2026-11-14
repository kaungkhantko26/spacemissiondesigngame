# API Contracts
Types: `src/types/index.ts`. Services: `src/services/contracts/index.ts` — PlayerService, LobbyService, MissionCatalogService, CharacterCatalogService, ProgressionService, MissionTelemetryService.
Backend owns: lobby membership, role capacity, final character selection, XP, upgrade costs/results, cosmetic ownership, mission results, rewards. The frontend only displays what these return. IDs are stable strings.
