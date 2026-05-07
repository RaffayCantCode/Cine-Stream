# StreamVault

A premium cinematic streaming website — browse trending movies and TV shows, watch them via embedded player, log in to track your watch history, and pick up where you left off with "Continue Watching."

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/streamvault run dev` — run the frontend (port via $PORT)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL`, `SESSION_SECRET`, `TMDB_API_KEY`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, Tailwind CSS v4, Framer Motion, TanStack Query, Wouter
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod, `drizzle-zod`
- Auth: Replit Auth (OIDC + PKCE), cookie-based sessions stored in DB
- API codegen: Orval (from OpenAPI spec → React Query hooks + Zod schemas)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/streamvault/` — React + Vite frontend
- `artifacts/api-server/` — Express 5 API server
- `lib/db/` — PostgreSQL schema + Drizzle ORM (`usersTable`, `sessionsTable`, `watchHistoryTable`)
- `lib/api-spec/openapi.yaml` — OpenAPI source of truth
- `lib/api-client-react/` — Generated React Query hooks (via Orval)
- `lib/api-zod/` — Generated Zod validation schemas (via Orval)
- `lib/replit-auth-web/` — `useAuth()` hook for frontend auth state

## Architecture decisions

- **Contract-first API**: OpenAPI spec is the source of truth; hooks and Zod schemas are generated via Orval.
- **Orval codegen quirk**: The `zod` output uses `mode: "single"` and `target: "generated/api"`. After each codegen run, a post-processing node script overwrites `lib/api-zod/src/index.ts` to only export from `./generated/api/api` — this prevents duplicate export conflicts between Zod schemas and TypeScript interfaces.
- **Auth via Replit OIDC**: Sessions are stored in PostgreSQL (`sessionsTable`). The `authMiddleware` attaches `req.user` and `req.isAuthenticated()` to every request.
- **Video playback**: `Watch Now` opens `/watch/movie/:id` or `/watch/tv/:id/:season/:episode` in a new tab. Those pages render a full-screen iframe from `vidking.net`.
- **Watch history**: Upserts on `(userId, mediaId, mediaType, season, episode)` — so re-watching the same episode updates the timestamp rather than adding a duplicate. Deduped by mediaId+mediaType on read.

## Product

- **Home**: Hero banner (trending #1), Continue Watching row (logged-in users), 5 media rows
- **Browse Movies / TV Shows**: Grid with infinite scroll-style pagination
- **Search**: Real-time search across movies and TV
- **Movie Detail**: Backdrop hero, metadata, cast row, "More Like This", Watch Now button
- **TV Detail**: Backdrop hero, season tabs, episode list with thumbnails, cast row
- **Watch page**: Full-screen embedded player (new tab) via vidking.net
- **Auth**: Log in / log out via Replit Auth. Avatar + name shown in navbar when logged in.
- **Continue Watching**: Poster grid showing last-watched items; removable individually.

## User preferences

- Premium, cinematic design: dark backgrounds, Bebas Neue font for titles
- Logo: STREAM in #08f0fc, VAULT in #08fc92, separated by ·
- Primary accent: `hsl(348 90% 50%)` (crimson red)
- Auth UI: "Log in" / "Log out" — never mention "Replit" in user-facing text

## Gotchas

- Always run `pnpm --filter @workspace/api-spec run codegen` after changing `openapi.yaml`.
- After codegen, `lib/api-zod/src/index.ts` is auto-fixed by the post-processing script — do not manually revert it.
- The `lib/replit-auth-web` lib uses `composite: true` so it can be referenced from the streamvault tsconfig.
- `req.user.id` is available in Express routes because `authMiddleware` extends `Express.User` with the local `AuthUser` interface (defined in `lib/auth.ts`).
- DB `onConflictDoUpdate` for watch history requires all nullable columns in the target to be handled — `season` and `episode` can be null for movies.
