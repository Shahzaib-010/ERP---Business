# 1. Product Requirements Document

## 1.1 Product overview

Build a private web application for one business that operates: 1. A
motorcycle showroom that purchases and sells bikes. 2. An installment
business that can sell different kinds of products (bikes, mobiles,
laptops, and other items) on a mutually agreed fixed total price.

The application replaces handwritten registers and manual installment
records. It should make daily data entry, record lookup, payment
tracking, receipt printing, and business-level reporting easier.

**Stack confirmed:** MongoDB, Express.js, React.js, Node.js (MERN).

## 1.2 Goals

-   Digitize existing bike purchase/sale and installment records.
-   Track customer balances and supplier payables.
-   Record cash received and cash paid, with clear transaction history.
-   Provide reliable, understandable dashboard analytics.
-   Generate and reprint receipts for financial transactions.
-   Store optional private digital documents.
-   Support multiple staff roles with controlled permissions.
-   Preserve a full audit trail when records are corrected.

## 1.3 Out of scope for MVP

-   Public customer signup.
-   Public bike marketplace/showroom website.
-   Delivery, shipping, or dispatch workflows. Customers collect
    products themselves.
-   Complex stock management, warehouse management, barcode workflows,
    or multi-location inventory.
-   Multiple cash wallets/accounts, employee cash handovers, cash
    transfers, or bank reconciliation.
-   Automated online payments or payment gateway integration.
-   Customer ability to make payments, edit records, upload files, or
    download receipts.
-   A full accounting/ERP system.

A future version may add a public bike listing website, but this is not
part of the MVP.

## 1.4 Application areas

### A. Landing and authentication

-   Public landing page with a hero section and Login action.
-   No public signup.
-   Admin accounts are created by Superadmin.
-   Customer accounts are created internally; customers sign in using
    CNIC and password.
-   After login, route users to the correct interface for their account
    type and role.

### B. Main dashboard

The dashboard should communicate the most important business information
on one page, using clean layouts, charts, trend lines, summary cards,
and filters.

Recommended dashboard content: - Sales/revenue recorded in the selected
period. - Cash received in the selected period. - Cash paid / expenses
in the selected period. - Net cash movement. - Customer outstanding
receivables. - Supplier outstanding payables. - Active and completed
installment plans. - Overdue installment plans or expected payments,
based on the configured schedule. - Bikes currently available and bikes
sold in the selected period. - Recent transactions and recent activity.

Recommended filters: - Today, this week, this month, this year, and
custom date range. - Module/source filter (showroom, installment
business, general business). - Keep date filtering consistent across
dashboard widgets.

Dashboard figures must be clearly labelled. Do not present cash
collected as new sales revenue, or confuse revenue with profit.

### C. Universal search

Provide a universal search bar available from the main authenticated
application.

Search should support, where applicable: - Customer name, CNIC, and
phone number. - Customer account / installment plan number. - Bike
record identifiers and bike details. - Transaction reference and receipt
number.

Results must respect the signed-in user's permissions. A customer
account must never expose another customer's records.

### D. Customer management

-   Create and manage customer profiles.
-   CNIC is the unique customer identity.
-   A customer may have multiple active or completed installment plans.
-   Customer records should be searchable by CNIC, name, and phone.
-   Store contact and identity details required by the existing business
    workflow.
-   Do not expose private identity documents to customer portal users.

**Open detail:** Confirm the exact customer profile fields against the
existing register and receipt samples before implementation.

### E. Installment management

The installment module must support sales of any product, not only
motorcycles.

Confirmed business rules: - Each agreement has a fixed mutually agreed
total selling amount. - There is no interest rate calculation. - Support
no advance, partial advance, or full upfront payment. - Product
handover/payment timing can vary; the workflow must support recording
the agreed advance and the handover transaction. - Installment frequency
can be monthly, weekly, daily, or a custom interval. - Generate expected
due dates from the selected schedule, but accept payments on any date. -
A suggested/ideal installment amount is guidance, not a mandatory
amount. - Do not enforce a fixed minimum payment amount. - Record each
payment with amount, date, receipt/reference, and the staff member who
entered it. - Extra payments reduce the remaining balance and may
shorten the actual completion period. - Smaller payments leave a balance
outstanding; the final payment can be adjusted to the exact remaining
amount. - Preserve the original agreed schedule/target duration while
showing actual completion progress. - One customer may have multiple
installment plans.

Example: - Agreed amount: PKR 40,000. - Suggested monthly payment: PKR
10,000. - Target duration: 4 months. - If PKR 20,000 is paid in the
first month, the outstanding balance becomes PKR 20,000. The suggested
monthly amount remains PKR 10,000, and the plan may finish earlier than
the original target. - If a customer pays less than the suggested
amount, the remaining balance carries forward.

Do not mark a plan overdue solely because the customer did not pay the
exact suggested amount. Overdue status should be based on an agreed
expected schedule/grace rule. **Open decision:** the business must
define whether and when an expected installment becomes overdue, and
whether a grace period applies.

### F. Bike showroom

-   Record bike purchases from individuals or suppliers.
-   A bike purchase can be paid in full or partially.
-   A partial purchase payment creates an amount payable to the
    seller/supplier.
-   Record bike sales with full or partial customer payment.
-   A partial sale can use the same installment engine as other
    products.
-   Keep a simple register of individual bikes and their status.
-   Track purchase date, sale date, documents, and current status.
-   Use the bike-detail fields from the existing user-provided
    register/receipt samples. Do not invent a replacement field list
    without checking those source samples.
-   Avoid complex inventory workflows.

**Recommended default statuses (confirm against real workflow):**
Available, Reserved, Sold, Returned. Do not implement a status
transition that the business does not use.

### G. Financial transactions and cash-flow view

All cash-flow entries are entered manually by the owner/admin or an
authorized staff user.

Record transaction details such as: - Transaction type. - Amount and
date. - Category. - Description / notes. - Related customer, supplier,
bike, installment plan, or other source where applicable. - User who
created the record. - Receipt/reference number.

Examples: - Bike purchase payment. - Bike sale receipt / advance. -
Installment collection. - Supplier payment. - General business
purchase. - Shop rent, electricity, salaries, maintenance, and other
operating expenses. - Other income. - Owner investment / money added to
business. - Owner withdrawal.

Do not create cash accounts, wallets, employee balances, handover
tracking, transfers, or reconciliation in the MVP.

### H. Revenue, receivables, payables, and cash-flow rules

Use separate concepts for sale value and cash movement.

Confirmed rule: recognize the full agreed sale value at the time of
sale, then track the amount collected separately.

Example: - Bike sale value: PKR 200,000. - Customer pays PKR 50,000
initially. - Customer outstanding: PKR 150,000. - Record sales/revenue
of PKR 200,000 once at the sale/agreement date. - Record cash received
of PKR 50,000. - Later installment collections reduce customer
receivable and increase cash received; they must not create new sales
revenue.

Likewise: - A partial payment to a bike seller/supplier creates a
supplier payable for the unpaid amount. - Later supplier payments reduce
the payable and record cash paid. - Expenses and purchases must not be
confused with owner withdrawals or capital contributions.

The reporting layer must distinguish: - Sales/revenue. - Cash
received. - Cash paid. - Net cash movement. - Customer receivables. -
Supplier payables. - Purchase costs and operating expenses. - Profit
estimates, only where the necessary cost data is available.

Do not label net cash movement as profit.

### I. Receipts and printing

-   Provide one centralized receipt system for money received or paid
    across all relevant modules.
-   Generate a unique receipt/reference number.
-   Allow receipt preview, printing, and reprinting.
-   Link the receipt to its source transaction.
-   Keep a digital record of generated receipts.
-   Support A4, A5, and thermal receipt printing where practical.
-   Prefer a print stylesheet with selectable layouts and browser print
    support, rather than requiring a specific printer integration.
-   A5 is a sensible default layout; A4 and compact thermal layouts
    should be available if the content can be laid out reliably.
-   Ensure long descriptions and line items do not clip in print.
-   Customer portal users cannot download receipts; Admin and Superadmin
    can access and print/download them.

### J. Digital documents

Document upload is optional, not mandatory for every record.

Confirmed: - Upload from a phone camera or files created by scanning
apps such as CamScanner. - Support PDF and common image formats (PDF,
JPG, JPEG, PNG, WEBP). - Allow custom document labels/types. - Allow
multiple documents against a record. - Documents are private. - Admin
and Superadmin can access and download private documents. - Customer
portal users cannot view private documents.

Recommended document groups: - Customer identity documents. -
Installment agreement and supporting documents. - Bike purchase / seller
documents. - Bike registration / transfer documents. - Bike sale / buyer
documents. - Transaction proof. - General business documents.

Use private file storage. Keep document metadata and references in
MongoDB. Do not expose permanent public file URLs.

### K. User roles and permissions

There are three staff roles plus a separate customer portal account
type.

**Superadmin** - Full access to every module and record. - Creates,
edits, disables, and manages Admin accounts. - Manages staff users,
permissions, and system settings. - Accesses complete audit history. -
Can manage all business records.

**Admin** - Manages daily business records and operations. - Can
create/update customers, bikes, installment plans, payments, expenses,
and other permitted records. - Cannot create Admin accounts. - Cannot
change system-wide settings or grant themselves higher privileges. -
Financial record edits must be audited.

**User** - Permissions are configurable by Superadmin. - Recommended
default: access only assigned modules and allowed actions. - Possible
permissions include viewing records, creating customers, recording
payments, creating bike entries, and generating receipts. - No financial
record edit/delete by default. - No user management, system settings, or
unrestricted audit-log access by default.

**Customer portal** - Separate, simplified, read-only interface. -
Customer signs in using CNIC + password. - CNIC identifies the customer;
password authenticates them. CNIC alone must never grant access. -
Customer sees only their own installment plans and payment history. -
Customer cannot edit records, delete records, add payments, upload
documents, or download receipts. - A customer with multiple plans can
view all their own plans.

**Open decision:** Confirm whether Admin may create ordinary staff User
accounts, or whether only Superadmin can create them. Superadmin must
always be able to create Admin accounts.

### L. Audit history and corrections

-   Admin and Superadmin can correct ordinary and financial records,
    subject to permissions.
-   Every change must preserve an audit entry with the actor, timestamp,
    affected record, action, and before/after values.
-   Financial records must not disappear through silent hard deletion.
-   Use void/reversal/correction workflows for financial transactions.
-   Recalculate current balances and reporting from valid transactions
    after corrections.
-   Superadmin can access complete audit history.
-   Recommended default: Admin can view operational history relevant to
    their work, but not system/security-level audit events.

### M. Customer portal privacy

-   Customers must only see records linked to their own customer
    identity.
-   Enforce ownership checks in the API, not just in the React
    interface.
-   Do not return private CNIC fields or private documents
    unnecessarily.
-   Use secure password hashing and a safe password reset process.
-   Do not use CNIC as a password or as the only authentication factor.

## 1.5 Key workflows

### Record a bike purchase

1.  Find or create the seller/supplier record as needed.
2.  Create a bike purchase record using the existing bike fields.
3.  Enter total purchase amount.
4.  Enter amount paid now.
5.  System calculates remaining supplier payable.
6.  Record payment transaction and generate receipt.
7.  Attach optional supporting documents.
8.  Update bike register/status.

### Record a bike sale

1.  Find the bike and customer.
2.  Enter agreed sale value.
3.  Choose full payment or installment/partial payment.
4.  Record amount received now.
5.  If partial, create/link an installment plan using the same
    installment engine.
6.  Update bike status to sold.
7.  Generate receipt for the cash received.
8.  Update revenue, receivable, and cash-flow reporting without double
    counting.

### Create a non-bike installment sale

1.  Find or create customer.
2.  Enter product description/type and fixed agreed selling amount.
3.  Enter advance amount (including zero or full upfront payment).
4.  Configure suggested payment amount, frequency, and target duration
    if applicable.
5.  Generate expected dates.
6.  Record handover/agreement details.
7.  Generate receipt for money actually received.
8.  Track later payments against the plan.

### Record an installment payment

1.  Search customer or installment account.
2.  Open the relevant plan.
3.  Enter actual payment amount and payment date.
4.  System validates that payment does not exceed the remaining balance
    unless an explicitly permitted adjustment workflow is used.
5.  Save payment, update outstanding balance, and generate receipt.
6.  Record who entered it and preserve audit history.

### Record a general expense

1.  Select expense category.
2.  Enter amount, date, and description.
3.  Save transaction.
4.  Generate receipt/voucher for the payment.
5.  Update cash-flow and expense reports.

## 1.6 Non-functional requirements

-   Responsive UI for desktop, tablet, and mobile.
-   Clean, fast, low-clutter interface suitable for daily office use.
-   Accessible forms, clear validation, and understandable error
    messages.
-   Secure authentication and role-based authorization.
-   Server-side validation for every write operation.
-   Pagination and indexed search for growing datasets.
-   Consistent date/time handling; store timestamps in UTC and display
    in the business's configured timezone.
-   Backups and a documented restore process.
-   Private document storage and restricted access.
-   Auditability of financial changes.
-   Avoid unnecessary infrastructure and recurring costs for the MVP.

## 1.7 Open decisions to resolve before or during implementation

1.  Exact bike fields and customer fields from the original
    register/receipt samples.
2.  Overdue definition and any grace period for expected installment
    dates.
3.  Whether Admin can create ordinary staff User accounts.
4.  Which user actions/permissions should be enabled initially.
5.  Receipt numbering format and business name/logo/contact details.
6.  Whether receipt layout should include Urdu, English, or both.
7.  Final document storage provider and upload size limit.
8.  Exact bike status transitions used by the business.
9.  Password reset / customer identity verification procedure.
10. Whether the business needs a formal profit calculation or only
    sales, purchases, receivables, payables, and cash-flow reporting in
    MVP.
