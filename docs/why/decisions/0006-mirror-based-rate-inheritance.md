# 0006 — Mirror-based rate inheritance for the long-tail lenders

- **Status:** Accepted
- **Date:** 2026-06-24

## Context

The picker shipped with 32 institutions, each carrying a first-party CIBIL-wise rate sheet
(8 cells: 4 CIBIL bands × salaried/self-employed) transcribed from the source ROI data. The
ask was to expand the picker to ~100 institutions — "the top 100 home-loan disbursed
institutions" — so users can find the lender they actually hold. We do **not** have rate
sheets for the ~68 new institutions, and sourcing real CIBIL-band ROI tables for each is
not feasible in this change.

The user's explicit instruction: for institutions where we don't have the rates, "give the
rates of the institution the picked institution is most closest to. usually, institutions
have the rates similar."

## Decision

Add an optional `mirror?: string` field to the `Lender` interface in `lib/rate-engine.ts`.
A lender with no own `b` (rate bands) instead names an existing lender to inherit from. The
new `resolveBands()` helper follows the `mirror` chain (guarding against cycles) to the
source lender's cells, so `rateFor`/`others`/`bestRate` all resolve a mirrored lender's rate
as if it were the source's — while the mirrored lender keeps its own display name, type, and
logo.

Each new institution is mapped to the closest comparable existing lender, chosen by lender
**type** (PSB/PVT/SFB/HFC) and rough **tier/scale** — e.g. Punjab National Bank → SBI,
Federal Bank → Kotak, Repco Home Finance → Aavas, Godrej Housing → Bajaj Housing.

## Rationale (the why)

- It directly implements the user's "closest institution" instruction with the minimum data:
  a single name reference per new lender, instead of fabricating 8 rate cells × 68 lenders of
  data we can't defend.
- Same-type, same-tier institutions genuinely price within a narrow band of each other in the
  Indian home-loan market, so inheriting a peer's curve is a reasonable approximation and is
  honest about its provenance (it's an explicit mapping, not invented precision).
- Keeping it in the data layer (`LENDERS` + `resolveBands`) means the picker, logos, rate
  lookup, similar-institutions ranking, and savings math all work unchanged — a mirrored
  lender is indistinguishable from a first-party one at every call site.
- A mirrored lender can later be "promoted" to first-party rates by simply giving it its own
  `b` array; `resolveBands` returns `b` first, so the mirror is ignored once real data exists.

## Consequences

- Mirrored rates are approximations by peer, not sourced per-lender ROI. Acceptable per the
  user's instruction; flagged here so a future contributor knows these aren't first-party.
- The mapping is editorial and must be hand-maintained, like `DISBURSE_RANK` (decision 0004).
- Cycle/typo safety: `resolveBands` returns `null` on a broken/cyclic `mirror`, which surfaces
  as a "—" rate rather than a crash. A verification harness asserts every lender resolves a
  non-null rate.

## Alternatives considered

- **Fabricate full rate sheets for each new lender.** Rejected: invents data we can't defend
  and is far more error-prone than a one-line peer mapping.
- **Group lenders into "rate archetypes" and reference an archetype.** More abstraction than
  needed; mirroring a concrete peer is simpler to reason about and lets any lender be promoted
  to first-party rates independently.
- **Keep only the 32 first-party lenders.** Rejected: doesn't meet the ask for ~100
  institutions in the picker.
