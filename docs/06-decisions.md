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

## D-002 — Free hosting — Accepted (2026-11-12, see D-016)

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

## D-009 — Bike fields and plan items — Decided (2026-11-11)

- **Bike fields confirmed by the owner:** make, model, model year, colour, new/used,
  registration number (optional), engine number (optional), chassis number (optional),
  notes, photos (optional). **Purchase:** seller name, phone, CNIC (optional), address,
  purchase price, amount paid now (rest is owed to the seller), purchase date.
  **Sale:** customer, sale price, full payment or installment (opens a plan).
- **Installment plans are for any item**, not only bikes (as on the paper form,
  "حاصل کردہ چیز"). A plan can link to a bike from the register when the item is a bike.

## D-010 — UI stack — Decided (2026-11-11)

- **shadcn/ui** (Radix base, "nova" preset, JavaScript) for components, **lucide-react**
  for icons, **tw-animate-css** and **motion** for animation, **sonner** for toasts,
  **next-themes** for light/dark mode.
- Staff app shell: collapsible left sidebar (state kept in the `sidebar_state` cookie),
  sticky top bar with breadcrumbs and a Ctrl+K command menu, page on the right.
- Every page has: a page header, a loading skeleton, empty states, an error boundary
  and toasts for saved changes. Destructive actions ask for confirmation.
- Brand colour: deep indigo-blue (`--primary` in `src/app/globals.css`).

## D-011 — Public site design — Decided (2026-11-11)

- **Landing page (`/`)**: clean and minimal, modelled on the owner's reference
  (light hero with the bike and key figures, dark close-up sections with yellow
  highlights, a timeline with a yellow line). It shows the showroom only: **no
  installments are mentioned** on the public pages.
- **3D showroom (`/showroom`)**: separate page with an interactive 3D bike (rotate,
  zoom, change model and colour). The bike is drawn in code (three.js); there are no
  licensed model files. `?model=<id>` opens a given model.
- Models, specs and colours on both pages are **placeholder demo data** in
  `src/lib/showroom.js`, to be replaced with the real bikes.
- Colours (supersedes the blue in D-010): warm stone neutrals, charcoal for primary
  actions, **yellow `--brand` accent** used mainly on dark surfaces. Condensed display
  font (Barlow Condensed) for figures and section titles.

## D-012 — Phase 4 installment design — Decided (2026-11-11)

- **Plans** (`installmentPlans`) are for any item. `terms` holds the original agreement and
  is never changed; `schedule` is the current schedule and may be changed (audited).
- **Business dates** (agreement, due and payment dates) are calendar days stored at
  00:00 UTC; "today" is the Pakistan date (`src/lib/business-date.js`).
- **Schedule engine** (`src/lib/installment-schedule.js`, shared with the forms): the advance
  is due on the agreement date; the first installment on the first due date entered, later
  ones on the due day (monthly; 31 = last day of short months), or every 7 / 1 / N days.
  Payments count towards installments in order, so extra payments move ahead and short ones
  carry forward. Late = the day after a due date with an uncovered amount; "days late" is
  counted from the oldest uncovered installment (D-006 Q4).
- **Payments** (`payments`): one row per payment, kinds `advance`, `installment`, `discount`.
  Never more than the balance. Never edited or deleted: a wrong one is **voided** with a
  reason (`payments.edit`) and stays visible. Plan totals are recomputed from posted rows.
- **Discount** (D-008): Superadmin-only permission `installments.discount`; closes the whole
  remaining balance, needs a reason, counts as settled but not as cash.
- **Numbers**: account and receipt numbers can be typed from the paper records; a counter
  keeps the highest number used, and an empty account number takes the next one. A receipt
  number belongs to one posted payment. Old payments may have no receipt number.
- **Guarantors** are stored on the plan (zero or more). Their CNIC is optional and shown masked.
- **Customer portal** shows the signed-in customer's own plans, payments and what is due.
- Cash-book entries (`financialTransactions`) for these payments come with Phase 5, built
  from the payment rows so nothing is counted twice.

## D-013 — Palette revision and Phase 3 bike register — Decided (2026-11-11)

**Palette** (supersedes the colours in D-010 and D-011): back to the original cool white and
grey neutrals. The bright royal blue is replaced by a **deep midnight navy** primary. A
**neon lime** (`--brand`) is used only in small accents: the active sidebar item's edge,
the logo mark, "in stock" dots, text selection and the landing page's dark sections.

**Bike register** (fields from D-009):
- One `bikes` document per motorcycle with a stock number (B-1, B-2, …), its details, and the
  purchase (seller snapshot, date, price) and sale (customer, mode, price) kept on it.
  This replaces the separate `bikePurchases` / `bikeSales` collections in doc 03; the data is
  the same and one document keeps the bike's status and sale consistent.
- Payments to the seller are rows in `sellerPayments`; "owed to seller" is the purchase
  price minus posted rows. Rows are voided with a reason, never deleted.
- Registration, engine and chassis numbers are optional but unique (compared without
  spaces or dashes).
- A bike is sold **for cash** (price and receipt number on the bike) or **on installments**:
  the plan form opens with the bike attached, and creating the plan marks the bike sold.
  The sale value is recorded once; later installments only reduce the plan balance.
- A cash sale entered by mistake can be cancelled (needs `bikes.edit` and `payments.edit`);
  the bike returns to stock and the sale stays in the audit history. Installment sales are
  corrected on the plan.
- Receipt numbers are one series shared by plan payments and cash bike sales.
- Bike photos: optional; the upload arrives with private file storage (Phase 6).

## D-014 — Phase 5 cash book and business figures — Decided (2026-11-11)

- **One ledger, no copies.** The cash book is assembled from where each payment already
  lives: installment advances and payments (`payments`), cash bike sales (`bikes.sale`),
  payments to sellers (`sellerPayments`). Only entries that exist nowhere else are stored
  in `financialTransactions`: **expense, other income, owner investment, owner withdrawal**.
  This replaces "every payment also writes a financialTransactions row" in doc 03, which
  would store each payment twice. Settlement discounts are not cash and never appear.
- Manual entries are voided with a reason (`transactions.edit`), never edited or deleted.
- **Expense categories** (defaults, owner may change): rent, salaries, utilities, fuel &
  transport, repairs, parts & accessories, registration & documents, marketing, taxes &
  government fees, office & tea, other. **Income categories**: commission, service &
  repairs, document & file fees, other.
- **Figures** (dashboard, needs `dashboard.view`):
  - Sales are counted when the sale is made: a cash bike sale's price, or a plan's total
    price on its agreement date. Later installments are cash received, not new sales.
  - Cash received / paid / net for the chosen period (this month, 3 months, 12 months,
    this year), each compared with the equally long period before it.
  - Position: cash in hand (all recorded cash in minus out), receivables (active plan
    balances, with how late they are: on time, 1–30, 31–60, over 60 days), owed to sellers,
    stock value at purchase price.
  - Cash in hand only counts what is recorded in the system; an opening balance can be
    entered as an owner investment.
- Charts follow the dataviz guidance: validated colour-blind-safe palette (light and dark
  steps), one axis, legends, hover tooltips and a table view for every chart.

## D-015 — Dashboards per business — Decided (2026-11-12)

- **Dashboard → Overview** (combined, needs `dashboard.view`): cash in hand with a
  12-month cash-position chart; money owed (customers owe you vs you owe sellers);
  sales, installments collected, bikes sold and new customers, each with a 12-month
  sparkline and the change versus the previous period; one summary card per business;
  cash flow, sales and money in/out breakdowns; late plans; recent activity.
- **Dashboard → Installments** (needs `installments.view`): owed by customers, on-time
  rate, overdue, due in the next 30 days, collected; expected vs collected per month
  (expected comes from each plan's own schedule); balances by item type; reminder list
  (due in 30 days), late plans, new plans per month, largest balances.
- **Dashboard → Showroom** (needs `bikes.view`): stock count and value, new vs used,
  owed to sellers, spent buying, average days from purchase to sale; bought vs sold and
  bike sales value per month; stock by make and by age; oldest stock, sellers still owed,
  recent sales.
- Tabs and figures appear only for modules the person may see.

## D-016 — Deployment and backups — Decided (2026-11-12)

- **App:** Netlify Free, deployed from `main`, served on the owner's own subdomain (GoDaddy
  CNAME to the Netlify site; free HTTPS). `netlify.toml` sets `publish = ".next"`, Node 22 and
  declares `@netlify/plugin-nextjs` (installed as a devDependency): without it the build ran
  but no server functions were deployed and every page was a Netlify 404.
- **Database:** MongoDB Atlas M0, Mumbai, database `bike_business`; network access
  `0.0.0.0/0` (Netlify has no fixed IPs; protected by TLS and a generated password).
- **Secrets** live only in Netlify environment variables and in local `.env.local` /
  `.env.prod` (git-ignored; `.env.prod` is not auto-loaded by Next.js). The first Superadmin
  on production is created with `npm run create-superadmin:prod`.
- **Files:** Cloudflare R2, private buckets `bike-docs` (live), `bike-docs-dev` (local),
  `bike-backups`; one access key per bucket.
- **Backups (3-2-1, required before real data):** nightly encrypted `mongodump` to R2 and
  Backblaze B2; weekly copy of documents to B2; weekly automated restore check; manual
  backup before each deploy; Healthchecks.io alert if a backup is missed. Not built yet.

## D-017 — Private documents — Decided (2026-11-12)

- Documents attach to customers, installment plans and bikes; optional, several per record,
  each with a group and a label. Groups: identity, agreement, bike purchase/seller,
  registration/transfer, bike sale/buyer, transaction proof, bike photo (D-008), general.
- **Limit 10 MB per file**; PDF, JPG/JPEG, PNG, WEBP only. The real file signature is
  checked after upload, not just the name or declared type. Phone photos are shrunk in the
  browser before upload.
- The browser uploads straight to R2 with a 10-minute signed URL; files open through
  `/api/documents/:id`, which checks the session and permissions, writes an audit entry
  (security scope) and redirects to a 60-second signed URL. Storage keys are random and
  never shown; signed URLs are never logged or stored.
- Viewing needs `documents.view` plus the record's own view permission; uploading needs
  `documents.upload`. Customers (portal) never see documents.
- **Removing is Superadmin-only for now** through the new opt-in permission
  `documents.remove`. Opt-in permissions are not part of any role by default; the
  Superadmin can tick them on an individual Admin or User account later.
- Removing moves a document to a **bin** (hidden, file kept, restorable). **Erase
  permanently** is a separate step from the bin only (reason + typing ERASE): the file is
  deleted from storage and the metadata row stays as the audit trail. No automatic
  expiry of the bin for now (the 30-day auto-erase option was not chosen).
