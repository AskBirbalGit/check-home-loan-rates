-- =============================================================================
--  loan_leads  —  one row per visitor session through the rate/savings funnel.
-- -----------------------------------------------------------------------------
--  The client generates an unguessable UUID per session. We INSERT (upsert) on
--  "Check my rates" and UPDATE the same row on "Show my savings", so a row holds
--  exactly what the user has done so far — savings columns stay NULL until they
--  reach that step.
--
--  Run this in the Supabase SQL editor (Dashboard -> SQL).
-- =============================================================================

create table if not exists public.loan_leads (
  id                  uuid primary key,                       -- client-generated session id
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  -- Box 1 inputs + Box 2 rate result (filled on "Check my rates")
  checked_rates       boolean     not null default false,
  bank_name           text,
  cibil               integer,
  employment          text,                                   -- 'sal' | 'se'
  current_rate_shown  numeric,                                -- fair rate for their current bank
  best_rate           numeric,                                -- best rate for their profile

  -- Box 3 inputs + Box 4 result (filled on "Show my savings")
  checked_savings     boolean     not null default false,
  current_rate_input  numeric,                                -- the rate they actually pay
  tenure_years        numeric,
  outstanding         numeric,
  rate_cut            numeric,
  max_saving          numeric
);

-- Keep updated_at fresh on every change.
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_loan_leads_updated_at on public.loan_leads;
create trigger trg_loan_leads_updated_at
  before update on public.loan_leads
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
--  Row Level Security
-- -----------------------------------------------------------------------------
--  Writes come from the browser via the publishable key (role `anon`). We allow
--  anonymous INSERT and UPDATE so the funnel can log without user auth. The row
--  id is an unguessable UUID, so an UPDATE only matches a row whose id the
--  client already holds. We intentionally do NOT grant SELECT to anon, so the
--  table is write-only from the public side (read it from the dashboard or with
--  the service role key).
alter table public.loan_leads enable row level security;

-- Postgres table-level privilege (RLS sits on top of this).
grant insert, update on public.loan_leads to anon;

drop policy if exists "anon insert leads"  on public.loan_leads;
drop policy if exists "anon update leads"  on public.loan_leads;

-- Target `public` so the policy applies regardless of which built-in role the
-- publishable key resolves to (anon today, but robust to Supabase key changes).
create policy "anon insert leads"
  on public.loan_leads for insert
  to public
  with check (true);

create policy "anon update leads"
  on public.loan_leads for update
  to public
  using (true)
  with check (true);
