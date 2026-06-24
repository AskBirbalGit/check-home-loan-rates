# 0007 — Browser-side lead logging with Supabase

- **Status:** Accepted
- **Date:** 2026-06-24

## Context

The calculator already had a pure client-side funnel. The new requirement is to log
anonymous lead activity as users move through the rate and savings flow, without adding
server-side app code or making the calculator depend on auth.

The repository deploys as a static Next.js app, so the logging path needs to work from the
browser with only public configuration. The tracked data also needs to stay write-only from
the client side.

## Decision

Add a browser Supabase client in `lib/supabase.ts` using the public `NEXT_PUBLIC_` URL and
publishable key. Keep the client cached per page load and return `null` when env vars are
missing so the calculator degrades gracefully.

Log funnel activity through `lib/leads.ts` into `public.loan_leads`:

- `logRateCheck()` INSERTs one row per session with Box 1 inputs and Box 2 rate results, then
  UPDATEs that same row if the user re-checks rates.
- `logSavings()` updates the same row with Box 3 inputs and Box 4 savings results.

Model the table in `supabase/schema.sql` with a UUID primary key, timestamps, funnel columns,
and RLS policies that allow anonymous INSERT/UPDATE but no SELECT.

## Rationale (the why)

- It keeps the app static and avoids introducing a server runtime just for analytics.
- The publishable Supabase key is safe to expose in the browser when RLS blocks reads and
  restricts writes to the known row shape.
- One row per session preserves the funnel history without inventing a separate event model.
- Making logging best-effort ensures a storage outage cannot break the calculator UX.

## Consequences

- Lead logging now depends on Supabase availability and the dashboard schema being applied.
- The client can write lead rows but cannot read them back.
- Because the table is write-only for anon, we cannot use PostgREST `upsert` (its ON CONFLICT
  path needs a SELECT policy to return the conflicting row). The client instead tracks an
  `inserted` flag per page load: INSERT once, UPDATE thereafter.
- The anon INSERT/UPDATE policies use `to public with check (true)`, so any holder of the public
  key can write arbitrary rows. The unguessable per-session UUID stops one visitor clobbering
  another's row, but it does not stop spam inserts. Acceptable for public funnel logging; the
  lock-down path is a server route with the service-role key (the rejected alternative below).
- Future funnel steps should extend the same row rather than create a second logging path.

## Alternatives considered

- **Add a server action / API route.** Rejected: unnecessary server surface for a static app.
- **Use a generic third-party analytics event stream.** Rejected: the app needs structured funnel
  rows tied to the calculator inputs, not opaque events.
- **Store leads in local state only.** Rejected: it would not persist anything useful.
