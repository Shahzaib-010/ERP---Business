@AGENTS.md

# Bike & Installment Business System

A private business app for a motorcycle showroom and an installment-sales business.
Next.js (App Router, JavaScript) + MongoDB/Mongoose. One business, private use.

## Read first
- `docs/01`–`05`: requirements, architecture, data model, roadmap, working rules.
- `docs/06-decisions.md`: decisions made after 01–05. **It overrides them where they conflict**
  (most importantly: Next.js full-stack instead of React + Express).
- The Next.js version here has breaking changes compared with older releases. Check
  `node_modules/next/dist/docs/` before using a Next.js API you are unsure of.

## Rules that matter most
- Never invent business rules. Open decisions are listed in `docs/06-decisions.md`; ask the owner instead.
- Build one roadmap phase at a time: plan → implement → test → summarize.
- Business logic lives in `src/server/services/`. It does not go in pages, components or route handlers.
- Every Server Action and route handler checks the session and permissions itself. `proxy.js` is not security.
- Money is integer PKR. Never use floating-point arithmetic for money.
- Never hard-delete posted financial records; void or reverse them and write an audit entry.
- Never log or return passwords, tokens, full CNICs or private document URLs.

## Layout
- `src/app/`: routes. `(public)` = landing and login, `(staff)` = staff app, `(portal)` = customer portal.
- `src/server/`: server-only code (`config`, `db`, `models`, `services`, `auth`, `permissions`, `validation`).
  `src/server/auth/current.js` is the data access layer: `getActor()`, `requireStaffPage(permission)`,
  `requireCustomerPage()`. Services take the actor as their first argument and check permissions.
- `src/lib/`: code shared by server and client (CNIC helpers, permission catalog, business identity).
- `src/components/`: shared UI.

## Commands
- `npm run dev`: dev server (needs `.env.local`; copy `.env.example`).
- `npm run lint`, `npm run build`, `npm test` (node:test + in-memory MongoDB replica set).
- `npm run create-superadmin`: one-time bootstrap. `npm run seed:dev`: demo customer login.
- Scripts and tests run in plain Node through `scripts/register-hooks.mjs`, which maps `@/`
  imports and adds missing `.js` extensions. Run them with `--conditions=react-server` so
  `server-only` imports work outside Next.js.
- `GET /api/health`: checks that the app and database are up.
