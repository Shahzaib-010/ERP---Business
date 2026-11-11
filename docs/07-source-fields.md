# 7. Source Fields from the Paper Records (Phase 0)

Taken from photos of the owner's paper records (2026-11-06):

1. **Agreement form** (ایگریمنٹ): the printed agreement the customer and guarantor sign.
2. **Installment ledger card** for a new account: the register page kept for each account.
3. **Installment ledger card** for a finished account: same card, fully paid and crossed out.

The photos contain real customer data. They are **not** stored in this repo. The
amounts below are copied only to show how the business calculates.

No bike purchase register or seller receipt was provided yet. **Bike purchase
and seller fields are still open.**

---

## 7.1 Business identity (printed header)

| Field | Value on the form |
|---|---|
| Business name | شہروز ٹریڈرز (Shahroz Traders) |
| Address | بالمقابل غلہ منڈی گیٹ، آٹو مارکیٹ، رحیم یار خان (Opposite Ghalla Mandi Gate, Auto Market, Rahim Yar Khan) |
| Contact 1 | چوہدری محمد اسلم (Ch. Muhammad Aslam): 0302-8688539 |
| Contact 2 | محمد انور (Muhammad Anwar): 0300-8678024 |
| Language | Urdu (amounts and dates are written in Western digits) |
| Date format | `D-M-YY`, for example `1-9-26` |

## 7.2 Customer fields (applicant, درخواست دہندہ)

| Urdu label | English | Notes |
|---|---|---|
| نام درخواست دہندہ | Name | required |
| والد / شوہر، ولدیت | Father's or husband's name | on both forms |
| قوم | Caste or tribe | agreement form only, often blank |
| پیشہ | Profession | |
| عہدہ | Designation or job title | agreement form only |
| موبائل / فون نمبر | Mobile number | Pakistani mobile, `03XX XXXXXXX` |
| سکنہ / مستقل پتہ | Home (permanent) address | |
| قسط وصولی کا پتہ | Address for collecting installments | can differ from home address |
| ایڈریس کاروبار / آفس | Business or office address | agreement form only |
| شناختی کارڈ نمبر | CNIC | blank on the samples; the system makes it required and unique (doc 01 §D) |

## 7.3 Guarantor fields (ضامن), new

The guarantor is **not in docs 01–03**. Both forms have it and the guarantor signs
the agreement. The ledger box is labelled "نمبر ۱" (No. 1), so a plan may have
more than one guarantor.

| Urdu label | English |
|---|---|
| نام | Name |
| ولدیت | Father's name |
| پیشہ | Profession |
| پتہ | Address |
| فون نمبر | Phone number(s); one sample has two numbers |

## 7.4 Security cheque (ضمانت چیک), new

From the agreement form: "I am giving cheque no. ___, bank ___, amount ___ as
security." The cheque is returned after full payment. If the customer defaults,
the business may cash it.

| Field | |
|---|---|
| Cheque number | optional |
| Bank | optional |
| Amount | optional, integer PKR |
| Status | held / returned / cashed (proposed; needs confirming) |

## 7.5 Agreement / plan fields

| Urdu label | English | Sample A (new) | Sample B (finished) |
|---|---|---|---|
| اکاؤنٹ نمبر | Account number | 4-digit number | 4-digit number |
| سابقہ اکاؤنٹ نمبر | Previous account number | blank | blank |
| رسید نمبر | Receipt number (for the advance) | 4-digit number | blank |
| تاریخ | Agreement date | 1-9-26 | 30-6-25 |
| حاصل کردہ چیز | Item taken | bike | bike (used, colour noted) |
| ماڈل نمبر | Model | e.g. "CD70 Dream 2026" | e.g. "125 2025" |
| سیریل نمبر | Serial number | registration-style number written nearby | blank |
| نقد قیمت | Cash price | 155,000 | 228,000 |
| کل کرایہ | Total markup ("rent") | blank (implied 45,000) | blank (implied 69,000) |
| کل قیمت بمعہ کرایہ | Total price incl. markup = **agreed total** | 200,000 | 297,000 |
| پیشگی وصول | Advance received | 70,000 | 100,000 |
| کل بقایا | Balance after advance | 130,000 | 197,000 |
| ماہوار ادائیگی | Monthly installment | 11,000 | 16,000 |
| تعداد اقساط | Number of installments | blank | blank |
| تاریخ ادائیگی | Due day of the month | "10" (by the 10th of each month) | "1st, from August" |
| نوٹ | Note | free text | free text (one crossed-out change of amount) |

Findings:

- **Agreed total = cash price + markup.** It is a fixed amount, not an interest
  rate, so it matches doc 01. The system should store **both** cash price and
  agreed total; markup is the difference. This also answers part of open decision
  10 (profit): the markup is known per agreement.
- **The schedule is "monthly amount, due by day N of each month".** The number
  of installments is usually blank. The target duration follows from
  `ceil(balance ÷ monthly amount)`; for sample A that is 12 months.
- **Account numbers are plain sequential numbers**, and the agreement form
  number matches the ledger card. The previous-account-number field suggests
  repeat customers get a new account that points to the old one.
- **Receipt numbers are plain sequential numbers** from a paper receipt book.
- The bike on an agreement is described with free text (model, year, colour,
  new or used, registration number). It should link to the bike register when
  the item is a bike from the showroom.

## 7.6 Payment ledger (بقایا table)

Columns: **تاریخ** (date) · **رسید نمبر** (receipt no.) · **رقم وصول** (amount
received) · **بقایا رقم** (balance). Two copies of these columns sit side by side
on one card.

Finished sample B shows real behaviour:

- 12 payments of 16,000, made between the 29th and the 4th of each month, so a
  few days early or late around the due date.
- Then one payment of **20,000** (more than the monthly amount), leaving 1,000.
- The last 1,000 was **written off**: the card shows "NIL 1000 Less". The
  account was closed with a discount, not a payment.
- The receipt-number column is blank on every row, so receipts were not always
  issued or written down.

So the system must support:

1. Payments of any amount on any date (already in doc 01).
2. **A settlement discount / write-off that closes the remaining balance.** It
   is not cash. It reduces the receivable without adding cash received. **New
   rule; needs owner confirmation.**
3. Payments that have no receipt number from the past (for importing old cards).

## 7.7 Agreement terms printed on the form (summary)

- The item is given on "rent" (کرایہ) until fully paid; ownership passes after
  the full amount is paid.
- If the customer does not pay, the security cheque may be cashed and legal
  action taken.
- The customer and guarantor accept the terms; signatures and thumbprints from
  the manager, the applicant and the guarantor.

The agreement may need to be printed from the system later (Urdu). See open
question Q7 in doc 06.
