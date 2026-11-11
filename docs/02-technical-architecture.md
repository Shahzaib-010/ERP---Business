# 2. Technical Architecture

## 2.1 Recommended stack

-   Frontend: React.js (JavaScript), React Router, Tailwind CSS.
-   Backend: Node.js + Express.js.
-   Database: MongoDB with Mongoose.
-   Authentication: secure server-issued sessions or short-lived access
    tokens with refresh-token strategy. Choose one approach and
    implement it consistently.
-   Validation: shared schemas where practical; always validate on the
    server.
-   Charts: a React chart library selected during implementation.
-   File storage: private object storage (provider to be selected);
    MongoDB stores metadata and storage keys, not public file contents.
-   Printing: browser-based print views with CSS print styles for A4,
    A5, and thermal layouts.

Use JavaScript unless the project owner later explicitly chooses
TypeScript.

## 2.2 Application structure

Recommended monorepo:

``` text
project/
  client/
    src/
      app/
      components/
      features/
        auth/
        dashboard/
        customers/
        bikes/
        installments/
        transactions/
        expenses/
        receipts/
        documents/
        users/
        audit/
      layouts/
      routes/
      services/
      hooks/
      utils/
  server/
    src/
      config/
      middleware/
      modules/
        auth/
        users/
        customers/
        bikes/
        installment-plans/
        payments/
        transactions/
        receipts/
        documents/
        dashboard/
        audit/
      utils/
      jobs/
      app.js
      server.js
  docs/
```

Keep business logic in backend services, not React components or route
handlers.

## 2.3 Backend module responsibilities

-   `auth`: staff and customer authentication, password reset,
    session/token lifecycle.
-   `users`: staff account management, roles, permissions,
    activation/deactivation.
-   `customers`: customer profile and identity.
-   `bikes`: bike register, purchase/sale association, status.
-   `installment-plans`: agreements, expected schedule, balances,
    status.
-   `payments`: customer collections and supplier payments.
-   `transactions`: canonical financial events and cash-flow
    classification.
-   `receipts`: unique numbering, rendering data, print/download
    authorization.
-   `documents`: private upload metadata and authorized file access.
-   `dashboard`: aggregated metrics and date-filtered analytics.
-   `audit`: append-only history for changes and financial corrections.

## 2.4 Financial consistency design

Do not maintain unrelated manually editable copies of the same balance.

Use source records plus financial transaction records. Each
payment/financial event should be represented once and linked to its
source record. Derive outstanding balances from the valid underlying
records or maintain cached totals that are updated transactionally and
can be reconciled/rebuilt.

For financial writes: 1. Validate the business rule. 2. Create/update
the source record and its financial transaction(s) in one MongoDB
transaction where supported. 3. Create the receipt record when a receipt
is required. 4. Write an audit event. 5. Return the updated balance and
receipt reference.

Use MongoDB replica-set support in deployed environments if
multi-document transactions are required. For local development,
document the database setup needed for transaction support. If
transactions are not used, design explicit idempotency and recovery
logic.

## 2.5 Suggested transaction classification

Every financial event should have: - `direction`: `inflow` or
`outflow`. - `type`: e.g. `sale`, `customer_payment`, `bike_purchase`,
`supplier_payment`, `expense`, `other_income`, `owner_investment`,
`owner_withdrawal`, `purchase`. - `sourceModule`: `showroom`,
`installments`, or `general`. - `category`. - `amount` (store as integer
minor currency units or integer PKR; do not use floating-point
arithmetic for money). - `occurredAt`. - `createdBy`. - `relatedEntity`
reference(s). - `status`: `posted`, `voided`, or `reversed`. -
`receiptId` where applicable.

Revenue recognition and cash movement must be separate: - Sale agreement
creates the sale/revenue event and receivable. - Actual customer payment
creates an inflow and reduces receivable. - Supplier purchase creates
purchase cost and payable. - Actual supplier payment creates an outflow
and reduces payable. - Expense creates an outflow and expense event. -
Owner investment/withdrawal changes cash movement/equity classification,
not sales revenue/operating expense.

Avoid counting the same payment as both a sale and a second source of
revenue.

## 2.6 Installment calculation rules

At minimum: - `agreedTotal` - `advanceReceived` - `amountPaid` -
`remainingBalance = agreedTotal - validPaymentsTotal` -
`suggestedInstallmentAmount` (optional) - `frequency` (`daily`,
`weekly`, `monthly`, `custom`) - `customIntervalDays` where frequency is
custom - `startDate` - `targetDuration` / `targetEndDate` where agreed -
generated expected due dates - actual payment dates and amounts -
`status`

Do not assume the suggested installment amount is a contractual minimum.
Payments can happen on any date and in any amount up to the remaining
balance.

Expected schedule and overdue calculation are separate from payment
acceptance. Do not implement overdue rules until the grace-period rule
is confirmed. A plan can be active while its payment timing is flexible.

## 2.7 Authorization and security

-   Enforce role and permission checks on every protected API endpoint.
-   Use deny-by-default authorization.
-   Customer portal endpoints must scope all queries to the
    authenticated customer ID.
-   Never trust a customer ID supplied by the browser without checking
    ownership.
-   Hash passwords with a modern password-hashing algorithm
    (e.g. Argon2id or bcrypt with a suitable cost).
-   CNIC is an identifier, not a secret or authentication factor.
-   Rate-limit login and password-reset endpoints.
-   Use secure, HttpOnly, SameSite cookies if using cookie-based
    sessions/tokens; protect state-changing requests against CSRF where
    applicable.
-   Validate and normalize CNIC/phone inputs.
-   Do not log passwords, tokens, full CNICs, or private document
    contents.
-   Restrict private document downloads through authenticated,
    authorized backend access or short-lived signed URLs.
-   Use HTTPS in production.
-   Keep secrets in environment variables, never committed to Git.
-   Add audit events for permission changes, account changes, and
    financial changes.

## 2.8 File storage

-   Store files in private object storage.
-   Store metadata in MongoDB: owner record, document type/label,
    original filename, MIME type, size, storage key, uploadedBy,
    uploadedAt.
-   Validate MIME type and file signature; do not trust extension alone.
-   Apply upload size limits and allowlist PDF/JPG/JPEG/PNG/WEBP.
-   Use random storage keys; do not expose raw storage paths.
-   Provide authenticated download endpoints with authorization.
-   Consider malware scanning if available within the chosen hosting
    budget.
-   Back up metadata and understand the storage provider's
    backup/versioning policy.

## 2.9 Search

Implement a server-side universal search endpoint with: - Query
normalization. - Indexed exact/partial search for CNIC, phone, receipt
number, account number, and bike identifier. - Permission-aware result
types. - Pagination/limits. - Debounced frontend requests. - No
cross-customer exposure in customer portal mode.

MongoDB indexes should be added for common lookup fields. Consider
MongoDB text search or Atlas Search only if basic indexed queries do not
meet requirements or if the chosen hosting plan supports it affordably.

## 2.10 Printing

Use dedicated print components/routes, not screenshots of UI cards.

Recommended approach: - A4 receipt/voucher template. - A5 receipt
template (recommended default). - Thermal template with compact
typography and minimal columns. - Browser print dialog so the operator
can select a connected printer and paper size. - Print CSS with page
breaks, margins, and hidden application navigation. - Receipt number,
business identity, date, transaction type, payer/payee, amount,
description, and signature/acknowledgement areas as appropriate. - Make
templates resilient to long names and descriptions.

Printer-specific automatic cutting, drawer control, and direct
USB/Bluetooth integration are not required for MVP.

## 2.11 Deployment considerations

Keep hosting inexpensive and separate frontend, API, database, and file
storage responsibilities: - React frontend on a static hosting
platform. - Node/Express API on a suitable Node hosting service. -
MongoDB Atlas or another managed MongoDB provider. - Private object
storage for uploaded documents. - Domain with HTTPS.

Select actual providers only after checking current pricing, region,
backup needs, and file-storage costs. Do not assume a generic shared PHP
hosting plan can run the Node API.

## 2.12 Observability and recovery

-   Structured server logs with sensitive-data redaction.
-   Centralized error handling.
-   Health endpoint.
-   Database backups and restore test.
-   Error tracking if budget allows.
-   Audit logs for business accountability.
-   Idempotency for payment creation to prevent duplicate submissions.
