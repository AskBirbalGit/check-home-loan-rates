/* =============================================================================
   leads.ts  —  Funnel logging into the loan_leads table.
   -----------------------------------------------------------------------------
   One row per session. We generate an unguessable UUID once per page load and
   reuse it: `logRateCheck` upserts (insert-or-update) the row with the Box 1
   inputs + Box 2 rate result; `logSavings` updates the SAME row with the Box 3
   inputs + Box 4 result. Savings columns stay NULL until the user gets there.

   Everything is best-effort and fire-and-forget: a logging failure must never
   surface to the user or break the calculator, so errors are only console-warned
   in development.
============================================================================= */
import { getSupabase } from "./supabase";
import type { EmploymentType } from "./rate-engine";

const TABLE = "loan_leads";

// One session id per page load, reused across both log calls.
let sessionId: string | null = null;
// Tracks whether the session row has been INSERTed yet. We deliberately avoid
// upsert(): PostgREST's ON CONFLICT path needs a SELECT policy to read the
// conflicting row back, but this table is write-only for anon by design. So we
// INSERT once, then UPDATE the same row on every later write.
let inserted = false;

function getSessionId(): string {
  if (sessionId) return sessionId;
  sessionId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : // Fallback for very old browsers.
        `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return sessionId;
}

function warn(scope: string, err: unknown) {
  if (process.env.NODE_ENV !== "production") {
    console.warn(`[leads] ${scope} failed:`, err);
  }
}

export interface RateCheckLog {
  bankName: string;
  cibil: number;
  employment: EmploymentType;
  currentRateShown: number | null;
  bestRate: number | null;
}

export interface SavingsLog {
  currentRateInput: number;
  tenureYears: number;
  outstanding: number;
  rateCut: number;
  maxSaving: number;
}

/** Box 1 + Box 2: log the session row when the user checks their rates.
    Re-clicking "Check my rates" updates the same row instead of inserting. */
export async function logRateCheck(data: RateCheckLog): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const row = {
    checked_rates: true,
    bank_name: data.bankName,
    cibil: data.cibil,
    employment: data.employment,
    current_rate_shown: data.currentRateShown,
    best_rate: data.bestRate,
  };
  try {
    if (inserted) {
      const { error } = await sb
        .from(TABLE)
        .update(row)
        .eq("id", getSessionId());
      if (error) warn("logRateCheck(update)", error);
    } else {
      const { error } = await sb
        .from(TABLE)
        .insert({ id: getSessionId(), ...row });
      if (error) {
        warn("logRateCheck(insert)", error);
      } else {
        inserted = true;
      }
    }
  } catch (err) {
    warn("logRateCheck", err);
  }
}

/** Box 3 + Box 4: update the same session row when the user checks savings. */
export async function logSavings(data: SavingsLog): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  try {
    const { error } = await sb
      .from(TABLE)
      .update({
        checked_savings: true,
        current_rate_input: data.currentRateInput,
        tenure_years: data.tenureYears,
        outstanding: data.outstanding,
        rate_cut: data.rateCut,
        max_saving: data.maxSaving,
      })
      .eq("id", getSessionId());
    if (error) warn("logSavings", error);
  } catch (err) {
    warn("logSavings", err);
  }
}
