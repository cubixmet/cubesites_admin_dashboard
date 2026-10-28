<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- All mock data lives in `src/lib/mock/seed.ts`; components read only through `useData` in `src/lib/store.ts` — so the backend can replace one layer.
- Every admin mutation goes through `actions` in store.ts and appends an audit event — audit trail must stay complete.
- Pricing/tax math lives only in `src/lib/billing.ts` (tested) — single source of truth.
- Seed generation must stay deterministic (seeded PRNG, no Math.random at module scope) — Workers forbid random at global scope and SSR must match.
- Admin pages render only after the client-side demo session check in `_admin.tsx` — session lives in localStorage.
- tsconfig relaxes `exactOptionalPropertyTypes`/`noUncheckedIndexedAccess` — they added noise without value for this mock-heavy code.
