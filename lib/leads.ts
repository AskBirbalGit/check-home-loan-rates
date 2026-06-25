/* =============================================================================
   leads.ts  —  Funnel logging into the loan_leads table.
   -----------------------------------------------------------------------------
   One row per session. We generate an unguessable UUID once per page load and
   reuse it across both steps.

   Writes go through two SECURITY DEFINER RPCs (see supabase/schema.sql), NOT
   direct table writes:
     - log_rate_check()  upserts the row with Box 1 inputs + Box 2 rate result.
     - log_savings()     updates the SAME row with Box 3 inputs + Box 4 result.

   Why RPCs instead of .from(TABLE).update(): the table is write-only for anon
   (no SELECT policy). But Postgres applies the SELECT policy when resolving an
   UPDATE's WHERE clause, so an anon `update().eq("id", …)` silently matches 0
   rows — savings never persisted. A SECURITY DEFINER function runs as the table
   owner and bypasses RLS entirely, so the UPDATE finds the row; anon only gets
   EXECUTE on the function, never direct table access.

   Everything is best-effort and fire-and-forget: a logging failure must never
   surface to the user or break the calculator, so errors are only console-warned
   in development.
============================================================================= */
import { getSupabase } from "./supabase";
import type { EmploymentType } from "./rate-engine";

// One session id per page load, reused across both log calls.
let sessionId: string | null = null;

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
  bankName: string | null;
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
    Idempotent — re-checking rates updates the same row. */
export async function logRateCheck(data: RateCheckLog): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  try {
    const { error } = await sb.rpc("log_rate_check", {
      p_id: getSessionId(),
      p_bank_name: data.bankName,
      p_cibil: data.cibil,
      p_employment: data.employment,
      p_current_rate_shown: data.currentRateShown,
      p_best_rate: data.bestRate,
    });
    if (error) warn("logRateCheck", error);
  } catch (err) {
    warn("logRateCheck", err);
  }
}

/** Box 3 + Box 4: update the same session row when the user checks savings. */
export async function logSavings(data: SavingsLog): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  try {
    const { error } = await sb.rpc("log_savings", {
      p_id: getSessionId(),
      p_current_rate_input: data.currentRateInput,
      p_tenure_years: data.tenureYears,
      p_outstanding: data.outstanding,
      p_rate_cut: data.rateCut,
      p_max_saving: data.maxSaving,
    });
    if (error) warn("logSavings", error);
  } catch (err) {
    warn("logSavings", err);
  }
}
