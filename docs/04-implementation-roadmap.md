# 4. Implementation Roadmap

Build in small working increments. Do not generate the entire
application in one pass.

## Phase 0 --- Confirm source fields and rules

-   Inspect the original bike register, installment register, and
    receipt samples.
-   Extract exact bike, customer, seller, and agreement fields.
-   Confirm overdue/grace-period behavior.
-   Confirm who creates ordinary staff User accounts.
-   Confirm receipt language, business identity, and numbering format.
-   Confirm document storage provider and maximum upload size.

**Exit criteria:** field list and unresolved business rules are
documented.

## Phase 1 --- Project foundation and authentication

-   Create client/server project structure.
-   Configure MongoDB connection and environment variables.
-   Add centralized error handling and request validation.
-   Implement staff login and role-based authorization.
-   Implement Superadmin bootstrap process securely (one-time seed or
    protected setup).
-   Implement staff account management: Superadmin creates Admins;
    permissions configurable for User role.
-   Implement customer login with CNIC + password and strict
    customer-only route scope.
-   Build public landing/login and role-specific layouts.

**Exit criteria:** staff and customers can log in and are routed to
their own interface; unauthorized API requests are blocked.

## Phase 2 --- Customers and universal search

-   Customer create/read/update.
-   CNIC uniqueness and normalization.
-   Customer profile detail page.
-   Universal search across customer, CNIC, phone, account number, bike
    identifier, transaction and receipt number.
-   Search results filtered by permissions.

**Exit criteria:** staff can find a customer and reach their related
records quickly; customer users cannot search other customers.

## Phase 3 --- Bike register and showroom

-   Bike create/edit/view.
-   Purchase entry with full/partial payment and supplier payable.
-   Sale entry with full/partial payment.
-   Bike status lifecycle.
-   Optional document attachments.
-   Connect partial bike sales to generic installment plans.

**Exit criteria:** showroom can record a bike from purchase through sale
and show correct payable/receivable values.

## Phase 4 --- Installment engine

-   Create generic installment agreement for any product.
-   Flexible advance amount.
-   Daily, weekly, monthly, and custom schedule configuration.
-   Suggested amount and target duration.
-   Accept payments on any date and in any amount up to outstanding
    balance.
-   Generate due dates.
-   Show original target vs actual payment progress.
-   Multiple plans per customer.
-   Overdue logic only after business rule is confirmed.

**Exit criteria:** test cases cover full upfront, zero advance, partial
advance, early extra payment, small/late payment, final exact balance,
and multiple plans per customer.

## Phase 5 --- Financial transactions and reporting

-   Central financial transaction service.
-   Revenue and receivable logic at sale/agreement time.
-   Customer payment cash inflow and receivable reduction.
-   Supplier payable and payment logic.
-   Expenses, other income, owner investment, owner withdrawal.
-   Dashboard filters and summary cards.
-   Module-specific charts and tables.
-   Ensure no double counting.

**Exit criteria:** reconcile test scenarios by hand and verify revenue,
cash received, cash paid, receivables, payables, and cash movement
independently.

## Phase 6 --- Receipts and documents

-   Unique receipt numbering.
-   Receipt preview and reprint.
-   A4, A5, thermal print layouts using browser print.
-   Private document uploads and access control.
-   Custom labels and multiple attachments.
-   Customer portal cannot access receipts/downloads/private docs.

**Exit criteria:** sample receipts print legibly on each supported
layout; unauthorized document access is denied.

## Phase 7 --- Audit, hardening, and deployment

-   Before/after audit events for edits.
-   Void/reversal workflow for financial corrections.
-   Permission review.
-   Security tests and input validation.
-   Backup/restore test.
-   Responsive UI and usability polish.
-   Production deployment, HTTPS, monitoring, and admin onboarding.

**Exit criteria:** critical workflows pass end-to-end tests and a backup
can be restored.

## Essential test scenarios

1.  Create a customer and two installment plans; verify both appear in
    the same customer profile.
2.  Create a PKR 40,000 plan, receive PKR 20,000, and verify PKR 20,000
    outstanding.
3.  Receive an additional payment on a different date and verify balance
    and payment history.
4.  Sell a bike for PKR 200,000, receive PKR 50,000, and verify sales =
    PKR 200,000, cash received = PKR 50,000, receivable = PKR 150,000.
5.  Receive later PKR 25,000 installment; verify sales do not increase
    again, cash received increases by PKR 25,000, receivable decreases
    by PKR 25,000.
6.  Buy a bike for PKR 100,000 and pay PKR 60,000; verify supplier
    payable = PKR 40,000.
7.  Pay supplier the remaining PKR 40,000; verify payable = zero and
    cash paid increases.
8.  Edit a posted payment with permission; verify before/after audit
    history and recalculated balance.
9.  Void/reverse a financial transaction; verify it remains visible in
    history and totals update correctly.
10. Log in as a customer; verify only their own plans and payment
    history are visible.
11. Attempt to access another customer's plan by changing an ID in the
    API request; verify access is denied.
12. Attempt to access private documents as a customer; verify access is
    denied.
13. Print one receipt in A4, A5, and thermal layouts and check for
    clipping.
14. Search by CNIC, phone, account number, bike identifier, and receipt
    number.
15. Verify a User cannot perform an action that Superadmin has not
    granted.
