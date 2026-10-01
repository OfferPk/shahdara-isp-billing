# Shahdara Fiber Net cloud portal (review edition)

This folder is a separate, isolated cloud portal layered beside the existing offline application. The root app, its `shahdara-isp-billing-v1` local data, validated JSON backup/merge behavior, and the offline-only GitHub Pages deployment are unchanged. The cloud portal does not include the public starter-name list and starts with no customer data.

**This branch is not connected to any Supabase project.** No migration has been applied, no project created or changed, no deployment made, and no real customer records used. The production project visible in owner-provided screenshots was not opened or queried. The pgTAP fixtures in this folder use synthetic names and identifiers only.

## Current features

- Email magic-link sign-in with self-service sign-up disabled. Admin access comes from an explicit `owner`/`admin` organization membership; a customer sees only a customer account linked server-side.
- Admin overview for customer count, monthly billed amount, actual cash collected by receipt date, outstanding balance, and carry-forward credit; customer creation; monthly bill snapshots; receipt recording, correction, and deletion.
- Customer portal for the linked profile, bills, receipt history, and customer-visible incident summaries.
- Stable text IDs for customers, bills, and receipts. One bill per organization/customer/month. Receipt writes use an idempotent stable ID and an atomic RPC. Carry-forward credit is stored only as allocations from the original receipt; allocations are never counted as another payment. A receipt against an unpriced bill remains a receipt but does not create credit until a price is recorded, matching the offline ledger.
- RLS-protected schema for price history, staff-only customer/incident details, inventory and movements, expenses, and payroll date logs. The first UI pass focuses on customer, billing, receipt, and incident views; the other areas are schema scaffolding, not feature-complete portals.

## Local development

Requires Node.js 20.19+ or 22.12+ and npm.

```sh
cp .env.example .env.local
# Set only VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY when an owner approves a dedicated non-production project.
npm install
npm run dev
npm test
npm run build
```

Without both frontend variables, the portal shows a setup message and does not create a Supabase client or send requests. The browser build may contain **only** the project URL and publishable/legacy anon key. A service-role/secret key must never be placed in `.env.local`, Vite variables, source files, or browser output.

## Database and Auth setup — not performed here

Before any owner chooses to connect this edition, use a dedicated, non-production Supabase project that is explicitly approved for this purpose. Do not apply this migration to the existing production project merely because its name appears in screenshots. Confirm the destination, project owner, one-organization/multi-organization tenancy decision, administrator list, customer invitation process, Auth email provider, email delivery/rate limits, final site URL, and redirect URLs first. The schema supports multiple organizations; the initial portal selects the first authorized organization/account and should be extended with an explicit chooser before users are assigned to multiple organizations.

A project owner with database migration privileges must review and apply `supabase/migrations/20261001120000_cloud_portal.sql` to that isolated project. The migration enables RLS for every public customer-data table, revokes broad client grants, grants only intended operations to `authenticated`, creates no `anon` policies, and pins security-definer functions to an empty search path with schema-qualified references. Admin/customer identity links are not client-writable. Bootstrap the first owner membership through an owner-controlled process after migration; do not promote a user by changing browser data or JWT metadata.

The `invite-customer` Edge Function requires JWT verification, an exact `APP_ORIGIN`, a publishable key for validating the caller session, and the platform's server-side `SUPABASE_SERVICE_ROLE_KEY` environment secret for the invitation/link operation. That privileged key is expected only in server-side function configuration; it is not a frontend setup input and has not been requested or used here. Restrict invitation access to organization owners/admins. Review the function and SQL tests before deployment.

The app needs only these **frontend** values when the project is ready:

1. Supabase project URL.
2. Publishable key (or legacy anon key).

Also pending from the project owner are the approved project/tenant setup, database migration permission, Auth provider and redirect settings, and permission to deploy the server-side invitation function. No secret key is required in the browser. Do not supply a service-role key to this task.

## Tests and known limitations

`npm test` covers synthetic accounting calculations and static security-contract checks. `supabase/tests/cloud_portal_rls.test.sql` contains additional synthetic pgTAP scenarios for cross-organization/customer isolation, direct receipt-write denial, stable-ID retry behavior, and non-cash credit allocations. It requires a disposable local Supabase stack (`supabase test db`) and was not run here because the Supabase CLI and Docker are unavailable. No live or production database has been used.

This is a reviewable first cloud pass, not a production-ready migration or full parity replacement. Local backup import/export has intentionally not been wired to cloud writes; no real-data migration, offline outbox/sync, conflict workflow, invitation resend/recovery, multi-organization chooser, operational monitoring, rate-limit policy review, or independent penetration test is included. Keep the original offline app as the authoritative deployment until a separately authorized migration plan, full RLS integration test, project-owner review, backup/reconciliation rehearsal with synthetic data, and deployment approval are complete.
