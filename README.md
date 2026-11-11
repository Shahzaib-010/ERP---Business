# Bike & Installment Business System

A private management app for a motorcycle showroom and an installment-sales business.
Built with Next.js (App Router, JavaScript) and MongoDB/Mongoose.

## Setup

1. Install Node.js 22 or newer.
2. `npm install`
3. Copy `.env.example` to `.env.local` and fill in `MONGODB_URI` and `SESSION_SECRET`.
4. `npm run create-superadmin` creates the first Superadmin. It asks for a name, username
   and password in the terminal. It runs only once; after that, the Superadmin creates the
   other staff accounts in the app under **Staff accounts**.
5. `npm run dev`, then open http://localhost:3000 and log in at `/login`.
6. Check http://localhost:3000/api/health. It should return `{"status":"ok","database":"ok"}`.

Optional, development only: `npm run seed:dev` adds a demo customer so you can try the
customer login at `/login/customer` (CNIC `11111-1111111-1`, password `demo-pass-123`).

## Tests

`npm test` runs the unit tests and the login/permission tests against a temporary
in-memory MongoDB. The first run downloads a MongoDB binary (about 400 MB, cached in
`~/.cache/mongodb-binaries`).

## Docs

Requirements, architecture and the roadmap are in [`docs/`](docs/). Read
[`docs/06-decisions.md`](docs/06-decisions.md) for decisions and open questions that
override the original docs.
