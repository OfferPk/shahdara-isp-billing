# Isolated Supabase cloud edition

The cloud portal is implemented in [`cloud/`](cloud/). It is intentionally separate from the root offline-first app: the existing browser-storage ledger, JSON backup/merge logic, static assets, and GitHub Pages workflow have not been changed. No customer records or starter names are seeded into the cloud portal.

The portal adds invite-only Supabase Auth, an Admin dashboard, a read-only Customer portal, strict organization/customer RLS, idempotent actual receipt writes, and non-cash credit allocations. Schema scaffolding also covers incidents, private customer details, price history, inventory, expenses, and payroll date logs. See [`cloud/README.md`](cloud/README.md) for setup requirements, tests, and explicit security/deployment limitations.

**Not connected:** no Supabase project credentials are configured, no migration or function was deployed, and no database or production screenshot data was accessed. The project URL and publishable/anon key remain placeholders pending owner approval for a dedicated non-production project.
