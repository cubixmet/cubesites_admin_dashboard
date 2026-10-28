# CubeSites Super Admin (demo frontend)

Separate administration portal for the CubeSites contractor bookkeeping SaaS. Frontend only, mock data, no real backend, payments, or Google Drive.

## Demo login
`admin@cubesites.in` / `Admin@123` — demo-only, NOT security.

## Stack
TanStack Start (React 19, TypeScript, Vite), TanStack Router (file routes — used instead of React Router, which this platform does not support), Tailwind v4, shadcn/ui, Lucide, jsPDF.

## Structure
- `src/lib/types.ts` — typed data models (API contract draft)
- `src/lib/mock/seed.ts` — deterministic centralized mock dataset (Kerala contractors, demo date 28 Oct 2026)
- `src/lib/store.ts` — mock service layer; all admin actions + audit logging; persisted to localStorage; `resetDemo()`
- `src/lib/billing.ts` — pure pricing/storage/tax/proration math (+ `billing.test.ts`)
- `src/lib/selectors.ts` — derived dashboard metrics and per-contractor bills
- `src/lib/exporters.ts` — CSV + PDF (invoice, reports) from filtered records
- `src/lib/auth.ts` — demo auth
- `src/components/admin/kit.tsx` — DataTable (sort/paginate), StatusBadge, ReasonDialog, etc.
- `src/routes/login.tsx`, `src/routes/_admin.tsx` (layout + guard), `src/routes/_admin/*` (pages)

## Backend integration points
Replace each function in `actions` (store.ts) and the `useData` reads with API calls. The backend must:
- authenticate admins, enforce super-admin roles, and write append-only audit logs server-side
- own billing calculations (mirror `billing.ts`), versioned pricing, and frozen tax snapshots on issued invoices
- verify payment gateway webhooks and prevent duplicate processing; store manual payment proofs
- measure CubeSites-managed storage daily (never unrelated Drive files)
- implement Google Drive OAuth, backup jobs, and verifiable restores
- run the 90-day retention policy with reminders and multi-step authorized deletion
- deliver email/SMS notifications

## Incomplete / backend-dependent
Real auth & sessions, MFA, password management; real suspension enforcement; payment gateway; proof file storage; real backups/restores; notification delivery; data deletion (intentionally absent); multi-admin roles; server-side search/pagination for large datasets.
