# 0009 — Spread-allocation CIBIL rate curve

- **Status:** Accepted
- **Date:** 2026-06-25

## Context

The rate engine originally averaged within each published 50-point CIBIL band (650–850,
plus a derived 600–649 cell) and floored the result to the nearest 0.05%. In practice this
made the score→rate relationship too close to a single straight line across the whole 600–850
domain: an 800-score profile landed well above the lender's true best rate, and the gap
between a 775 and an 800 score was almost as large as the gap between a 700 and a 750. That
does not match how lenders actually price risk — the top of the range is nearly flat (the best
profiles all cluster near the floor) and the penalty steepens sharply below 750.

The user specified the desired shape directly, as a fixed allocation of *each lender's own*
rate spread, band by band, with a worked SBI example to anchor it.

## Decision

For each lender + employment type, reduce the source sheet to two endpoints:

- `R_min` = low of the `800+` cell (best rate)
- `R_max` = high of the `<700` cell (worst rate; trailing `+` stripped)
- `S = R_max − R_min` (the lender's full spread)

Map the CIBIL score (clamped to [600, 850]) to a cumulative fraction `f` of `S` via a fixed,
lender-agnostic curve with these knots (high score → low score):

| Score | Cumulative `f` | Band below the knot | Slice of spread |
|-------|----------------|---------------------|-----------------|
| 850   | 0.00           | —                   | —               |
| 800   | 0.03           | >800                | 3%              |
| 775   | 0.10           | 775-800             | 7%              |
| 750   | 0.20           | 750-775             | 10%             |
| 700   | 0.40           | 700-750             | 20%             |
| 600   | 1.00           | 600-700             | 60%             |

`f` interpolates **linearly between adjacent knots**, so the curve is continuous and
piecewise-linear: a straight line *within* each band, with the slope changing band to band
(flattest at the top, steepest in 700-750). The raw rate is `R_min + f·S`; the final displayed
rate is **floored DOWN to the lower 0.05%** (7.19 → 7.15, 7.16 → 7.15, 7.20 → 7.20). Flooring is
applied **only** to the final raw value, never inside the interpolation, so error never
compounds across segments.

Implementation lives in `lib/rate-engine.ts`: a `CURVE` knot table + `curveFraction(score)`
helper, a `roundToRateStep` (floor-to-lower-0.05) helper, and a rewritten `rateFor`. The old
`bandFor`, `averagedRate`, `LOW_CIBIL_UPLIFT`, `STEPS`, and the floor-based `floorToRateStep`
are removed.

## Rationale (the why)

- The curve imposes the user's intended band-wise shape on top of each institution's own
  spread, so the *shape* is uniform while the *bps* scale per lender: a wide-spread HFC spreads
  the same curve over ~4% while a narrow-spread PSB (SBI, 1.45%) keeps the top tightly clustered
  near its floor — which is the whole point (good profiles get near-best rates everywhere).
- Endpoint-only anchoring is honest about what we know: the two extremes of each published
  sheet are the most reliable figures; the mid-band published values were coarse ranges anyway.
- Flooring to the lower 0.05 is conservative — the displayed rate never sits below the raw
  curve value — and is applied only to the final raw value (never the knots) so the math stays
  auditable.
- Keeping the curve and the rounding strictly separate keeps the math auditable: `curveFraction`
  is pure shape, `roundToRateStep` is pure display.

## Consequences

- The published 750-799 and 700-749 mid-band rate values are no longer used; only the `800+`
  low and `<700` high of each sheet feed the rate. This is intentional per the spec.
- The derived 600-649 risk uplift (PSB/PVT +0.5, SFB +0.75, HFC +1.0) is retired — the 600-700
  slice (40% of the spread) now carries the bottom of the curve directly. Supersedes that part
  of the prior lookup; `cibil/600-649` no longer exists as a separate computation.
- Both the old engine and this one floor to the lower 0.05, so the display-rounding direction
  is unchanged; the rate movement here comes from the new curve shape, not the rounding.
- This supersedes the **per-band averaging + flooring** math described in decision 0006. The
  `mirror`/`resolveBands` inheritance for long-tail lenders from 0006 is unaffected and stays.

## Alternatives considered

- **Keep per-band averaging, just re-weight bands.** Rejected: still anchored to coarse
  mid-band published values and couldn't produce the flat-top / steep-bottom shape cleanly.
- **Flat step per band (one rate per band).** Rejected: creates hard jumps at boundaries; the
  user asked for a curve that moves within each range, not a step function.
- **Fold rounding into the curve knots.** Rejected: rounding mid-computation compounds error
  across the piecewise segments; rounding only the final raw value keeps each score true to the
  curve.
