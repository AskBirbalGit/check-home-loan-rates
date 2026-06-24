-- =============================================================================
--  loan_leads  —  one row per visitor session through the rate/savings funnel.
-- -----------------------------------------------------------------------------
--  The client generates an unguessable UUID per session. On "Check my rates" we
--  log Box 1 inputs + Box 2 result; on "Show my savings" we fill the same row's
--  savings columns. Savings columns stay NULL until the user reaches that step.
--
--  Writes go through two SECURITY DEFINER functions (not direct table writes).
--  The table is write-only for anon — there is NO select/insert/update grant to
--  the browser. The functions run as the owner and bypass RLS, so the UPDATE in
--  log_savings() can actually find the existing row by id (a direct anon UPDATE
--  silently matches 0 rows, because Postgres applies the missing SELECT policy
--  when resolving the UPDATE's WHERE clause).
--
--  Run this whole block in the Supabase SQL editor (Dashboard -> SQL).
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
--  Lock the table down completely from the public side: RLS on, and NO policies
--  for anon. All writes flow through the SECURITY DEFINER functions below, which
--  run as the table owner and so are not subject to RLS. This is strictly more
--  locked-down than direct anon INSERT/UPDATE policies — the browser can neither
--  read nor write the table directly, only call the two logging functions.
alter table public.loan_leads enable row level security;

-- Clean up the earlier direct-write policies/grants if they were applied.
drop policy if exists "anon insert leads" on public.loan_leads;
drop policy if exists "anon update leads" on public.loan_leads;
drop policy if exists "temp anon read"    on public.loan_leads;
revoke insert, update, select on public.loan_leads from anon;

-- -----------------------------------------------------------------------------
--  Logging functions (SECURITY DEFINER — run as owner, bypass RLS)
-- -----------------------------------------------------------------------------

-- Box 1 + Box 2: upsert the session row. Idempotent on re-check.
create or replace function public.log_rate_check(
  p_id                 uuid,
  p_bank_name          text,
  p_cibil              integer,
  p_employment         text,
  p_current_rate_shown numeric,
  p_best_rate          numeric
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.loan_leads as l (
    id, checked_rates, bank_name, cibil, employment,
    current_rate_shown, best_rate
  ) values (
    p_id, true, p_bank_name, p_cibil, p_employment,
    p_current_rate_shown, p_best_rate
  )
  on conflict (id) do update set
    checked_rates      = true,
    bank_name          = excluded.bank_name,
    cibil              = excluded.cibil,
    employment         = excluded.employment,
    current_rate_shown = excluded.current_rate_shown,
    best_rate          = excluded.best_rate;
end;
$$;

-- Box 3 + Box 4: fill the savings columns on the same row. If the row does not
-- exist yet (e.g. savings somehow logged first), create it.
create or replace function public.log_savings(
  p_id                 uuid,
  p_current_rate_input numeric,
  p_tenure_years       numeric,
  p_outstanding        numeric,
  p_rate_cut           numeric,
  p_max_saving         numeric
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.loan_leads as l (
    id, checked_savings, current_rate_input, tenure_years,
    outstanding, rate_cut, max_saving
  ) values (
    p_id, true, p_current_rate_input, p_tenure_years,
    p_outstanding, p_rate_cut, p_max_saving
  )
  on conflict (id) do update set
    checked_savings    = true,
    current_rate_input = excluded.current_rate_input,
    tenure_years       = excluded.tenure_years,
    outstanding        = excluded.outstanding,
    rate_cut           = excluded.rate_cut,
    max_saving         = excluded.max_saving;
end;
$$;

-- Only the two functions are callable from the browser; nothing else.
revoke all on function public.log_rate_check(uuid, text, integer, text, numeric, numeric) from public;
revoke all on function public.log_savings(uuid, numeric, numeric, numeric, numeric, numeric)   from public;
grant execute on function public.log_rate_check(uuid, text, integer, text, numeric, numeric) to anon;
grant execute on function public.log_savings(uuid, numeric, numeric, numeric, numeric, numeric)   to anon;
