# 3. Proposed MongoDB Data Model

This is a starting model, not a final schema. Validate field names
against the original business registers and receipts before coding.

## 3.1 Core collections

### `staffUsers`

-   `_id`
-   `name`
-   `username` or `email` (login identifier; final choice open)
-   `passwordHash`
-   `role`: `superadmin | admin | user`
-   `permissions`: explicit module/action grants for `user` role;
    optionally overrides for admin if needed
-   `isActive`
-   `createdBy`
-   `createdAt`, `updatedAt`

### `customers`

-   `_id`
-   `name`
-   `cnicNormalized` (unique index)
-   `phone`
-   `address`
-   other fields confirmed from existing forms
-   `portalEnabled`
-   `createdAt`, `updatedAt`

Avoid duplicating customer profile details into every installment plan
unless a historical snapshot is needed.

### `customerCredentials`

-   `_id`
-   `customerId`
-   `passwordHash`
-   `isActive`
-   `passwordChangedAt`
-   `createdAt`, `updatedAt`

Keep customer credentials separate from customer profile data. Do not
store plaintext passwords.

### `suppliers`

-   `_id`
-   `name`
-   `phone`
-   `cnic` (only if required by the business)
-   `address`
-   `notes`
-   `createdAt`, `updatedAt`

A seller can be an individual; the UI may call this party
Seller/Supplier as appropriate.

### `bikes`

-   `_id`
-   bike detail fields copied from the existing register after
    inspection
-   `status`
-   `purchaseId`
-   `saleId`
-   `purchaseDate`
-   `soldDate`
-   `createdAt`, `updatedAt`

Do not finalize bike detail fields from assumptions. Preserve useful
historical details when a bike is sold.

### `bikePurchases`

-   `_id`
-   `bikeId`
-   `sellerId`
-   `purchaseAmount`
-   `paidAmount`
-   `payableBalance`
-   `purchaseDate`
-   `notes`
-   `createdBy`
-   `createdAt`, `updatedAt`

### `bikeSales`

-   `_id`
-   `bikeId`
-   `customerId`
-   `saleAmount`
-   `amountReceivedAtSale`
-   `receivableBalance`
-   `saleDate`
-   `paymentMode`: `full | installment`
-   `installmentPlanId` (nullable)
-   `createdBy`
-   `createdAt`, `updatedAt`

A bike sale paid in installments should link to the same generic
installment-plan model used for other products.

### `installmentPlans`

-   `_id`
-   `accountNumber` (unique)
-   `customerId`
-   `productType` (bike/mobile/laptop/other)
-   `productDescription`
-   `relatedBikeId` (nullable)
-   `agreedTotal`
-   `advanceReceived`
-   `suggestedInstallmentAmount` (optional)
-   `frequency`: `daily | weekly | monthly | custom`
-   `customIntervalDays` (nullable)
-   `startDate`
-   `targetDuration` / `targetEndDate` (optional, as agreed)
-   `expectedDueDates` or schedule configuration from which dates are
    generated
-   `amountPaid` (derived or cached)
-   `remainingBalance` (derived or cached)
-   `status`: `active | completed | cancelled`
-   `createdBy`
-   `createdAt`, `updatedAt`

Store original agreement terms separately from current calculated
progress so edits do not erase the original agreement.

### `payments`

-   `_id`
-   `installmentPlanId`
-   `customerId`
-   `amount`
-   `paidAt`
-   `method` (optional; cash is likely but confirm if other methods are
    used)
-   `receiptId`
-   `enteredBy`
-   `status`: `posted | voided | reversed`
-   `createdAt`, `updatedAt`

Every payment must be individually recorded. Do not overwrite a single
"last payment" field.

### `financialTransactions`

-   `_id`
-   `transactionNumber`
-   `direction`: `inflow | outflow`
-   `type`
-   `sourceModule`: `showroom | installments | general`
-   `category`
-   `amount`
-   `occurredAt`
-   `description`
-   `customerId` / `supplierId` / `bikeId` / `installmentPlanId` /
    source references as applicable
-   `createdBy`
-   `status`: `posted | voided | reversed`
-   `receiptId`
-   `createdAt`, `updatedAt`

This is the central source for cash-flow reporting. Avoid duplicate
financial events for one real-world payment.

### `receipts`

-   `_id`
-   `receiptNumber` (unique)
-   `transactionId`
-   `layout`: `a4 | a5 | thermal`
-   `issuedAt`
-   `issuedBy`
-   `snapshot` of receipt display details needed for historical
    reprinting
-   `status`
-   `createdAt`

The receipt snapshot helps reproduce the original receipt even if
customer or product details later change.

### `expenses`

Optional convenience/business-detail collection if expense-specific
fields are needed. Link each expense to exactly one financial
transaction. Do not double-count it in dashboard totals.

-   `_id`
-   `financialTransactionId`
-   `category`
-   `description`
-   `createdAt`

### `documents`

-   `_id`
-   `ownerType`
-   `ownerId`
-   `label`
-   `documentCategory`
-   `originalFilename`
-   `mimeType`
-   `sizeBytes`
-   `storageKey`
-   `uploadedBy`
-   `uploadedAt`
-   `isPrivate` (true by default)
-   `status`

### `auditLogs`

-   `_id`
-   `actorId`
-   `actorRole`
-   `action`
-   `entityType`
-   `entityId`
-   `before` (redacted/safe snapshot)
-   `after` (redacted/safe snapshot)
-   `reason` (recommended for financial corrections)
-   `createdAt`

Audit records should be append-only for normal application roles. Never
include password hashes, tokens, or unnecessary full identity-document
contents.

## 3.2 Important indexes

-   `customers.cnicNormalized`: unique.
-   `customers.phone`: indexed if frequently searched.
-   `installmentPlans.accountNumber`: unique.
-   `installmentPlans.customerId + status`.
-   `payments.installmentPlanId + paidAt`.
-   `financialTransactions.occurredAt + sourceModule + type`.
-   `financialTransactions.transactionNumber`: unique.
-   `receipts.receiptNumber`: unique.
-   `bikes` on frequently searched registration/chassis/engine
    identifiers, based on actual fields.
-   `auditLogs.entityType + entityId + createdAt`.
-   `documents.ownerType + ownerId`.

## 3.3 Relationship overview

-   One customer → many installment plans.
-   One installment plan → many payments.
-   One bike → one purchase record and zero/one sale record in the
    simple MVP lifecycle.
-   One bike sale → optional installment plan.
-   One financial transaction → zero/one receipt, depending on
    transaction type and business policy.
-   One business record → many optional documents.
-   One record → many audit events.

## 3.4 Data integrity rules

-   Use integer money values; define whether stored units are whole PKR
    or paisa and apply consistently.
-   Do not permit negative remaining balances without an explicit
    adjustment/refund process.
-   Do not hard-delete posted financial transactions.
-   Use idempotency keys or equivalent duplicate-submission protection
    for payment creation.
-   Validate all references and ownership server-side.
-   Prefer MongoDB transactions for writes that must update multiple
    related documents atomically.
-   Recalculate balances from valid source events after
    correction/reversal.
