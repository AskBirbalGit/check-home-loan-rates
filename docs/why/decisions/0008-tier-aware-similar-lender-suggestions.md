# 0008 — Tier-aware "better-priced lenders" suggestions

- **Status:** Accepted
- **Date:** 2026-06-24

## Context

Box 2 shows the customer's current bank rate beside a "Better-priced lenders" column of
three suggestions. Until now `others()` returned the three globally cheapest first-party
lenders (rate-sorted, with a PSB→PVT→other tie-break). In practice a customer rarely jumps
straight from an NBFC/HFC to a prime PSU — eligibility and underwriting cut against it. The
realistic ladder is:

1. PSU (PSB)
2. Private (PVT)
3. Small Finance Bank (SFB)
4. NBFC/HFC (HFC)

A customer who can't qualify at a better tier is unlikely to qualify even one rung up, and
much less so two rungs up. So a flat "cheapest three anywhere" list oversells where they can
actually move.

## Decision

`others()` in `lib/rate-engine.ts` is now **tier-aware**. For a customer in tier T it returns
**two same-tier** suggestions plus **one "stretch" option** drawn from a better tier. The top
tier (PSB) has no better tier, so it returns **three same-tier** instead.

The stretch slot can draw from **more than one candidate tier**, and we take the single
cheapest lender across those candidates ("whichever is lower"):

- HFC customer → 2 HFC + 1 from SFB **or** PVT (whichever is cheaper)
- SFB customer → 2 SFB + 1 from PVT **or** HFC (whichever is cheaper)
- PVT customer → 2 PVT + 1 PSB
- PSB customer → 3 PSB

HFC and SFB each reach across two candidate tiers because their realistic best alternative
isn't a fixed rung — an NBFC/HFC borrower may find a cheaper private bank than any SFB, and an
SFB borrower may find a cheaper private bank or HFC. Letting the stretch row be the cheapest
across both candidate tiers surfaces the genuinely better option instead of a fixed tier.

Mechanics:
- Eligible pool = all first-party lenders except the current bank; **mirrored lenders stay
  excluded** so we never show a duplicate-rate row (e.g. PNB mirrors SBI's exact sheet).
- Same-tier picks and stretch candidates are each chosen cheapest-first; the stretch slot
  takes the single cheapest lender across all that tier's stretch candidates.
- Same-tier picks are the two cheapest in-tier **regardless** of whether they beat the
  customer's current rate, so the column always renders consistently.
- A fallback tops up from the rest of the pool (cheapest-first) if a tier runs short of
  candidates, guaranteeing three rows.
- The final three are **sorted by rate ascending** for display; tier logic decides *who* is
  picked, rate decides the order they appear in.

The `OtherRate` shape is unchanged, so `app/Calculator.tsx` needs no edits and keeps the
"Better-priced lenders" heading.

## Rationale (the why)

- Suggestions now match how borrowers actually refinance: mostly sideways within their tier,
  with one aspirational option one rung up. It's honest about reach instead of dangling a
  prime-PSU rate at a sub-prime HFC borrower.
- Keeping the change entirely inside `others()` means the picker, logos, savings math, and
  lead logging are untouched — the contract (three `OtherRate`s) is preserved.
- Excluding mirrored lenders (carried over from prior behavior) avoids confusing duplicate
  numbers, since a mirror inherits its source's exact rate cells.

## Consequences

- `bestRate()` takes the min of the current rate and the `others()` results. Because
  `others()` is now tier-constrained rather than global-cheapest, the "best rate" feeding the
  savings calculation is a **realistic switch target**, not the absolute market floor. Displayed
  savings may be marginally lower than under the old logic. This is intentional and more
  defensible, but it does change the savings number for some profiles.
- The tier ladder (PSB > PVT > SFB > HFC) and the per-tier stretch candidates are encoded as
  `STRETCH_TIERS`; reordering tiers or adding a new `LenderType` requires updating it.
- For PSB customers there are six first-party PSBs, so the three-row cap (chosen over listing
  all PSUs) means the cheapest three PSBs show. This supersedes an initial "show all PSUs"
  framing in the request.

## Alternatives considered

- **Keep the global-cheapest list.** Rejected: oversells unreachable tiers.
- **Show every same-tier lender for PSB customers.** Rejected during planning in favour of a
  consistent three-row column.
- **Restrict same-tier picks to lenders strictly cheaper than the current rate.** Rejected:
  would leave ragged columns with fewer than three rows; chose "cheapest in-tier regardless".
