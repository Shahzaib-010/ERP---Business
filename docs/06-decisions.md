# 6. Decision Log

This log records decisions made after docs 01–05 were written. **If a decision
here conflicts with docs 01–05, this file wins.** Add new decisions at the
bottom with a date. Do not edit old entries; add a new entry that supersedes
the old one.

Status values: **Decided**, **Proposed** (a recommendation the owner has not
confirmed yet), **Open** (still needs an answer).

---

## D-001 — Next.js full-stack replaces React + Express — Decided (2026-11-06)

- The app is a single **Next.js (App Router) app in JavaScript**. There is no
  separate Express server.
- Backend code lives in `src/server/` (models, services, auth, permissions,
  validation). Every file there starts with `import 'server-only'`.
- Route handlers (`src/app/api/**/route.js`) and Server Actions stay thin:
  read the session, validate the input, call a service, return the result.
- Business rules and calculations live in services only (doc 02 §2.2 still
  applies).
- **Authorization:** every Server Action, route handler and service that reads
  or writes protected data checks the session and permissions itself.
  `src/proxy.js` (what Next.js used to call middleware) is only for
  redirects, never for security.
- Mongoose is still the database layer. Doc 02's Express module list maps
  one-to-one onto `src/server/services/<module>`.
- Installed version: Next.js 16 with `cacheComponents` enabled. Pages that read
  the session render inside `<Suspense>` boundaries (see the bundled guide
  `node_modules/next/dist/docs/01-app/02-guides/authentication-with-cache-components.md`).

## D-002 — Free hosting — Proposed (2026-11-06)

| Need | Choice | Notes |
|---|---|---|
| App hosting | Netlify (free) | Vercel Hobby is not allowed for commercial use. Render (free) is the fallback, but it sleeps when idle and the first load is slow. |
| Database | MongoDB Atlas M0 (free, 512 MB) | M0 is a replica set, so multi-document transactions work. Use separate Atlas projects for dev and prod. |
| Private files | Cloudflare R2 (10 GB free, needs a card on file) | Fallback: Backblaze B2 (10 GB free). Both use the S3 API, so the code is the same. |
| Backups | GitHub Actions nightly `mongodump`, uploaded to R2/B2 | Atlas M0 has no automatic backups. |
| Errors / uptime | Sentry free, UptimeRobot free | Optional. |

## D-003 — Library choices — Proposed (2026-11-06)

- Validation: Zod (the same schemas on client and server).
- UI: Tailwind CSS v4; shadcn/ui components (JS mode) when building screens.
- Forms: react-hook-form. Charts: Recharts. Dates: date-fns with the business
  timezone `Asia/Karachi` (store UTC, display in the business timezone).
- Auth: custom session auth. An opaque session id goes in an HttpOnly,
  Secure, SameSite=Lax cookie; the session record is stored in MongoDB so a
  disabled account loses access immediately. Passwords are hashed with
  bcryptjs (pure JS, so it works on serverless hosts).
- Money: integer **whole PKR** unless the owner says paisa is needed.
  **Open:** confirm that whole PKR is enough.

## Open decisions (from doc 01 §1.7) — Open

1. Exact bike, customer, seller and agreement fields: waiting for photos of
   the register and receipt samples.
2. When a payment counts as overdue, and whether there is a grace period.
3. Whether Admin can create ordinary staff User accounts.
4. Default permissions for the User role.
5. Receipt numbering format, business name, logo and contact details.
6. Receipt language: Urdu, English or both.
7. Storage provider (R2 or B2) and the upload size limit (proposed: 10 MB per
   file).
8. Bike status transitions the business actually uses.
9. Customer password reset. Proposed: staff reset it in person after checking
   the customer's CNIC, so no email or SMS service is needed.
10. Formal profit calculation in the MVP, or reporting only.

## D-004 — Phase 0 findings from the paper records — Proposed (2026-11-06)

Full field list: `docs/07-source-fields.md`. Changes to the data model (doc 03)
that follow from it:

- **Customer:** add father/husband name, caste (optional), profession,
  designation, home address, installment-collection address, business address.
- **Guarantors (new):** one or more per installment plan: name, father's name,
  profession, address, phones. Stored on the plan (a snapshot), not as customers.
- **Security cheque (new, optional) on the plan:** number, bank, amount, status.
- **Installment plan:** store `cashPrice` and `agreedTotal` (markup = difference),
  `monthlyAmount`, `dueDayOfMonth`, optional `installmentCount`,
  `previousAccountNumber`, free-text item description, model and serial/registration.
- **Account and receipt numbers:** plain sequential integers.
- **Settlement discount (new):** a non-cash adjustment that closes the last
  part of a balance. It reduces the receivable and is not cash received.
  Needs confirmation (Q2 below).

### Questions for the owner (from Phase 0)

1. **Numbering:** should the system continue from the paper numbers (next
   account after the highest paper account, next receipt after the paper
   receipt book), or start a new series?
2. **Settlement discount:** may the business waive the last part of a balance
   (as on the finished card: "1000 Less")? Who may do it: Superadmin only, or Admin too?
   Is there a maximum?
3. **Old accounts:** should running paper accounts be entered into the system
   with their past payments (import), or only new accounts from a start date?
4. **Overdue:** the form says "pay by the 10th of every month". Is a plan
   overdue the day after the due day, or after some grace days?
5. **Guarantors:** how many at most (1 or 2)? Is a guarantor required?
6. **Security cheque:** should the system track it (held / returned / cashed)?
7. **Agreement printing:** should the system print the Urdu agreement form,
   or only receipts?
8. **Bike register:** still need a photo of the bike purchase register and a
   seller receipt to get the bike and seller fields.

## D-005 — Phase 1 authentication design — Decided (2026-11-06)

- **Staff log in with a username** (not email). Usernames are stored lower-case.
- **Only the Superadmin creates and edits staff accounts** (Admin and User). This is the
  safe default for open decision 3; letting Admin create Users is a one-line permission
  change later. Superadmin accounts are created only by `npm run create-superadmin`,
  which refuses to run when one already exists. No web page can create a Superadmin.
- **New User accounts start with no permissions.** The Superadmin ticks each permission
  (open decision 4 stays open for the *recommended* starting set).
- **Sessions:** a random token in an HttpOnly cookie (`__Host-` prefixed in production);
  the database stores only an HMAC of it (keyed with `SESSION_SECRET`). Staff sessions
  last 12 hours, customer sessions 7 days. Disabling an account, resetting its password
  or turning off a customer's portal login deletes its sessions at once.
- **Login throttling:** 5 failed attempts per account or 30 per IP in 15 minutes block
  further attempts for the rest of that window. Stored in MongoDB.
- **Customer portal password** is set or reset by staff with `customers.edit` (proposed
  answer to open decision 9). The screen for it comes with the customer profile in Phase 2.
- **Audit:** logins, failed staff logins, account changes, permission changes and
  password resets are written to `auditLogs` with scope `security`. Passwords and
  hashes are never written there.

## D-006 — Owner answers to the D-004 questions — Decided (2026-11-11)

Answers given by the owner. Numbers match the D-004 question list.

1. **Numbering:** continue from the paper records. Old accounts keep their paper
   account and receipt numbers when entered; new numbers continue after the
   highest number already used. (Implemented with plans in Phase 4 and receipts in Phase 6.)
2. **Settlement discount:** answer was "whatever the amount is, it will stay as it is".
   Read as: **no settlement discount for now**; a balance is closed only by payments.
   *To confirm with the owner before Phase 4.*
3. **Old accounts:** all running and past paper accounts will be entered later, with
   their past payments, then new accounts. Until then, development uses dummy data
   (`npm run seed:dev`).
4. **Overdue:** a plan is overdue the day after its due day. The due day is set per
   plan and can be changed by staff. The plan shows how many days the current
   installment is late. No grace days.
5. **Guarantors:** optional. A plan may have any number of guarantors (zero or more).
   Stored on the plan, as D-004 proposed (Phase 4).
6. **Security cheque:** kept as a document (attachment) on the plan for now. No
   held/returned/cashed tracking (Phase 4/6).
7. **Printing:** receipts only. No agreement form printing.
8. **Bike register photos:** still to come from the owner (needed for Phase 3).

## D-007 — Phase 2 customer and search design — Decided (2026-11-11)

- **Phones** are stored as digits only (`03001234567`), up to 3 per customer, 7–15 digits each.
- **CNIC display:** lists and search results show the masked CNIC (`*****-***4567-1`).
  The customer profile and edit form show the full CNIC to staff with `customers.view`.
  The full CNIC is never written to the audit log (it is masked there).
- **Universal search** (`/search`, box in the header) is staff only. Results are grouped
  by type and each group needs its own permission (customers now; plans, bikes and
  receipts are added in their phases). Customer portal users cannot search.
- Customer edits are audited (scope `operational`) with before/after values.
- Customers are never deleted (a later phase may add "archive" if the owner wants it).

## D-008 — Settlement discount and bike photos — Decided (2026-11-11)

Supersedes D-006 answers 2 and 8.

- **Settlement discount:** a plan is normally closed only when the full agreed total
  is paid. In a special case the **Superadmin only** may close the remaining balance
  with a manual discount (the "NIL 1000 Less" line on the paper card). It is entered
  by hand, needs a reason, reduces the receivable, is **not** cash received, and is
  written to the audit log. No maximum amount was set. Admin and User cannot do it.
- **Bike register:** the owner will not supply register photos. Bike fields are
  defined from the agreement and ledger forms (model, year, colour, new/used,
  registration and serial numbers) — see the Phase 3 proposal. **Bike photos are an
  optional attachment field** on the bike record (stored with the private files in Phase 6).
