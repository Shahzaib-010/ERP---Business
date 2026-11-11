# 5. Instructions for Claude Code

You are implementing a business management web application from the
requirements in this documentation.

## Working rules

1.  Read all files in `docs/` before proposing or changing architecture.
2.  Do not silently invent business rules. Check
    `01-product-requirements.md` for confirmed requirements, recommended
    defaults, and open decisions.
3.  Before implementing a feature with an unresolved business rule, ask
    a concise question or implement only the non-controversial
    foundation and leave the rule configurable.
4.  Keep the MVP small. Do not add public signup, delivery, complex
    inventory, cash wallets/accounts, employee handovers, bank
    reconciliation, payment gateways, or unrelated ERP features.
5.  Use MERN and JavaScript. Do not switch to Laravel, SQL, or
    TypeScript without explicit approval.
6.  Build incrementally. First present a short implementation plan for
    the current phase, then implement and test that phase. Do not
    scaffold every feature at once.
7.  Prefer maintainable, modular code with clear separation between UI,
    API routes, controllers, services, models, validation, and
    authorization.
8.  Keep UI clean, responsive, and efficient for repeated daily data
    entry. Avoid decorative complexity.
9.  Do not put business calculations only in the frontend. The backend
    is authoritative.
10. Do not expose secrets, passwords, tokens, full CNICs, or private
    document URLs in logs or client responses.

## Financial correctness

-   Use integer money representation consistently; do not use
    floating-point arithmetic for currency.
-   Keep sales/revenue separate from cash collection.
-   Recognize full agreed sale value once at the sale/agreement date,
    according to the confirmed rule.
-   Customer payments reduce receivables and increase cash received;
    they are not new revenue.
-   Supplier payments reduce payables and increase cash paid.
-   Do not double-count payments in dashboard aggregates.
-   Do not hard-delete posted financial transactions.
-   Use void/reversal/correction workflows and preserve audit history.
-   Protect multi-document financial updates with MongoDB transactions
    where supported.
-   Make payment creation idempotent to prevent duplicate submissions.

## Security

-   Enforce authorization in Express middleware/services for every
    protected operation.
-   Use deny-by-default permissions.
-   Customer endpoints must scope every query to the authenticated
    customer's ID.
-   CNIC is an identifier, never a password or sole authentication
    factor.
-   Hash passwords securely.
-   Keep uploaded documents private and authorize every download.
-   Validate inputs on the server and rate-limit authentication
    endpoints.
-   Add audit history for financial changes and permission/account
    changes.

## Installment behavior

-   Installments apply to any product, not only bikes.
-   Fixed agreed total; no interest calculation.
-   Advance can be zero, partial, or full.
-   Schedule may be daily, weekly, monthly, or custom.
-   Expected due dates are generated, but payments are accepted on any
    date.
-   Suggested installment amount is guidance, not a mandatory minimum.
-   Extra payments reduce remaining balance and may shorten actual
    completion time.
-   Preserve original target duration/terms separately from actual
    progress.
-   Do not implement overdue status until its exact business rule and
    grace period are confirmed.

## UI and printing

-   Build a main dashboard with global date filters, key
    financial/operational metrics, charts, and recent activity.
-   Each module should have its own relevant summary/analytics.
-   Provide a universal search across customer, CNIC, phone, account
    number, bike, transaction, and receipt identifiers.
-   Build dedicated receipt print views for A4, A5, and thermal formats
    using browser print CSS.
-   A5 may be the default, but all three requested formats should be
    supported where practical.
-   Customer portal is separate and read-only. It must not show private
    documents or receipt download actions.

## Before marking a phase complete

-   Run relevant tests.
-   Check authorization for allowed and denied roles.
-   Test edge cases and financial totals.
-   Verify responsive behavior.
-   Summarize files changed, behavior implemented, tests run, and
    remaining open decisions.
-   Do not claim tests passed unless they were actually run.

## First task

Start with Phase 0 and Phase 1 planning. Inspect the repository before
changing files. If no repository exists, propose the folder structure
and setup steps first. Identify the open business decisions that block
implementation; do not guess the bike fields from memory---inspect the
original sample records provided by the project owner.
