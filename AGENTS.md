# AGENTS.md
Read this file and agentlog.md before changes. Next.js 16: consult `node_modules/next/dist/docs/` for API changes.
- Frontend only; never implement simulation, scoring, networking, auth, persistence.
- UI depends on `services/contracts`, never on mocks directly where avoidable; use stable IDs.
- Strict TypeScript, no `any`; tokens via CSS variables; respect reduced motion; never block navigation on 3D.
- One Canvas per view; no WebGL context per card.
- Tests: frontend behaviour only (`npm test`). Update agentlog.md each session.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
