# 0004 — Hand-maintained disbursement ranking for the bank picker

- **Status:** Accepted
- **Date:** 2026-06-20

## Context

The v2 bank picker was upgraded from a native `<select>` (alphabetical) to a searchable
combobox. The ask was that, when opened, it should show the biggest lenders first —
"check highest disbursed institution and order it by that". The repo has no disbursement
data: `js/data.js` carries only lender name + type + CIBIL-wise rate bands, and the site is
a zero-build static page (decision 0002) with no backend or data feed.

## Decision

Encode a hand-maintained `DISBURSE_RANK` map in `js/app-v2.js`, keyed by the exact
`RateEngine` lender name, assigning a rough ordinal by annual home-loan disbursement scale
in the Indian market (SBI, HDFC, LIC HF, ICICI, BoB, PNB HF, Axis, Kotak, Bajaj, …). The
combobox sorts by this rank, then alphabetically for any unranked tail (rank 999).

Pair it with an `ALIASES` map (also in `app-v2.js`) of alternate names people type — e.g.
"state bank of india" → SBI, "indiabulls" → Sammaan Capital — folded into a per-lender
lowercased search haystack.

## Rationale (the why)

- A static page can't pull live disbursement figures, and the exact rupee amounts don't
  matter for this UX — only the *ordering* the user sees does. An ordinal rank is the
  minimum data that satisfies "biggest first" and is trivial to eyeball and adjust.
- Keeping it in `app-v2.js` (the v2 glue) rather than `js/data.js` preserves the
  `RateEngine` data contract untouched, and keeps the change scoped to v2 (the only variant
  the user asked to change). `index.html`/`app.js` keep their alphabetical `<select>`.
- Aliases live next to the ranking because both are presentation/search concerns of the
  picker, not rate data.

## Consequences

- The ordering is an editorial estimate, not sourced data; it can drift from reality and must
  be updated by hand. Acceptable because it only affects display order, never the rates.
- Unranked lenders fall to the alphabetical tail, so adding a new lender to `data.js` still
  shows up in the picker without touching this file (just lower down until ranked).
- If `index.html` ever needs the same picker, the maps would need to move to a shared module.

## Alternatives considered

- **Live disbursement feed / API:** rejected — contradicts the zero-build static-site
  decision (0002) and is overkill for a display-order tweak.
- **Put rank in `js/data.js` per lender:** rejected — would change the shared RateEngine data
  shape used by both variants for a v2-only concern.
- **Sort by lowest rate instead of disbursement:** rejected — the user explicitly asked for
  disbursement order, and rate-sorting already drives the "Similar institutions" results.
