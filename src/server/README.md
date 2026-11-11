# src/server: server-only code

Every file here starts with `import "server-only"` so it can never end up in a client bundle.

| Folder | Holds |
|---|---|
| `config/` | Validated environment (`getEnv()`) |
| `db/` | Mongoose connection (`connectDB()`) and the `withTransaction()` helper |
| `models/` | Mongoose schemas (docs/03) |
| `services/` | Business logic, one folder per module: auth, users, customers, bikes, installment-plans, payments, transactions, receipts, documents, dashboard, audit |
| `auth/` | Session create/read/destroy, password hashing |
| `permissions/` | Role and permission checks (deny by default) |
| `validation/` | Zod schemas shared with forms |

Flow for every write: **route handler / Server Action → check session → validate input → service → (transaction) → audit log**.
