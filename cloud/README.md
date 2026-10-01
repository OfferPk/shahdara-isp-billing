# Shahdara Fiber Net cloud portal (review edition)

This folder is a separate cloud portal beside the existing offline application. The root app, its localStorage data and backup/merge behavior, and the offline-only GitHub Pages deployment remain unchanged. The cloud portal has no imported customer data and uses only synthetic fixtures in tests.

## Current project state

The owner-approved non-production Supabase project is isolated from production. The cloud schema migration has already been applied there with authorization, and pgTAP was enabled separately with approval. The first 13-assertion fixture attempt failed during customer setup because the original `BEFORE INSERT` price-history trigger tried to write a row referencing the not-yet-created customer. The test transaction rolled back; the project was subsequently confirmed empty across its public tables and `auth.users`.

The corrected base migration and synthetic fixture are in this branch. A separate manual patch for the already-applied project is at `supabase/review/20261001130000_customer_price_history_trigger_fix.sql`. It has **not** been applied remotely. No further database SQL or DDL, Auth-setting change, app deployment, or invitation-function deployment is part of this work.

## Cloud portal and Supabase client

The browser client is created only when `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` contain a valid HTTPS project URL and a non-placeholder publishable key. The browser uses the Supabase JS client with persistent Auth sessions; its configuration does not accept a database connection string or service-role key. Query helpers use the signed-in user's session and surface Supabase errors to the UI. RLS remains the authority for every row returned or changed.

The portal is auth-first: it sends no anonymous data queries, does not enable self-service sign-up, and requests sign-in only for an already-provisioned account (`shouldCreateUser: false`). There is currently no first administrator Auth user, organization, or owner membership bootstrapped in the project, so no one can yet access organization data. The project owner must provision the initial authenticated administrator and create the organization/owner membership through an owner-controlled process before normal sign-in can succeed. Do not weaken RLS or use anonymous access as a bootstrap shortcut.

Admin features include customer creation, monthly bill snapshots, receipt recording/correction/deletion through RPCs, and incident summaries. Customer views are scoped to the server-linked customer account. Stable IDs and the idempotent receipt RPC flow are preserved. The invite-customer Edge Function remains source-only and is not deployed; customer invitations require a separately approved server-function setup.

## Local development

Requires Node.js 20.19+ or 22.12+ and npm.

```sh
cp .env.example .env.local
# Set only the isolated project's HTTPS URL and publishable/legacy anon key in .env.local.
npm install
npm test
npm run build
npm run dev
```

`.env.local` is ignored by git. A publishable/legacy anon key is intended for the browser; a database connection string, service-role key, or other privileged credential is not. Never commit local environment files or generated build output. If the two frontend variables are absent or still placeholders, the portal shows setup guidance and creates no Supabase client.

## Manual SQL review

The corrective patch is additive and wrapped in a transaction. It replaces the trigger function, removes only the prior trigger definition, and creates an `AFTER INSERT` trigger plus a `BEFORE UPDATE` trigger. This allows initial price history to reference an existing customer row while retaining subsequent plan/price history and `updated_at` behavior. It does not create/drop tables, delete rows, change RLS policies, or grant anonymous access.

A project owner/reviewer should inspect that exact patch and, if accepted, manually apply it only to the approved isolated non-production project. It is not part of the automatic migration directory and has not been run remotely. If rollback is ever needed, restore the old trigger only after correcting its FK-ordering issue; reverting to the old trigger unchanged would bring back the insert failure. No table/data rollback is needed for this patch.

## Tests and limitations

`npm test` runs synthetic ledger tests, static security-contract checks, tests for the client configuration and query/RPC adapter with mocked Supabase responses, and checks for the trigger correction. The pgTAP fixture now has 16 assertions covering RLS, stable receipt retry behavior, credit allocations, and customer price-history inserts/updates. It requires a disposable local Supabase stack (`supabase test db`); the Supabase CLI and Docker are unavailable here, so pgTAP cannot be run in this environment. No synthetic fixture or real customer record was written to the remote project during this implementation.

This remains a reviewable first cloud pass, not a production-ready replacement or full offline parity port. Local backup import/export is not connected to cloud writes; there is no offline sync/outbox, conflict workflow, multi-organization chooser, invitation recovery, operational monitoring, rate-limit review, or independent penetration test. Keep the existing offline app as the authoritative deployment until project-owner bootstrap, local database integration tests, review, reconciliation rehearsal, and separate deployment approval are complete.
