# 0010 — Range-matched mirror targets for long-tail lenders

- **Status:** Superseded by 0011
- **Date:** 2026-06-25

## Context

Decision 0006 introduced `mirror`-based rate inheritance: each of the ~68 long-tail
institutions with no first-party rate sheet points at a comparable first-party lender via a
`mirror` field, and `resolveBands` follows it. The original mappings were **editorial** — chosen
by lender type and a rough sense of tier (e.g. "Godrej Housing → Bajaj Housing", "Can Fin Homes
→ LIC Housing"). In practice several were off: spot-checks of Can Fin Homes and Godrej Housing
didn't match their real public pricing, because the editorial pick optimised for "feels like a
peer" rather than for the actual rate band.

The ask: research the real current (2025-2026) public home-loan rate range — lowest floor and
highest cap — for every mirrored institution, and re-map each one to the first-party lender it
genuinely matches on those numbers. Do this **only** for mirrored institutions; the first-party
lenders that already carry real rate sheets are untouched.

## Decision

Map each mirrored institution by **range matching**, not editorially:

1. **Research** each institution's public rate range (low + high) from official lender
   interest-rate / quarterly-ROI pages first, with NoBroker / Wishfin / MyLoanCare /
   CreditDharma / Ambak / MagicBricks as secondary sources and Paisabazaar / BankBazaar only as
   a **last resort** where official sources were blocked or silent. (Run as 10 parallel research
   agents over the institution list.)
2. **Reduce** each first-party lender to the same two anchors the rate engine uses
   (decision 0009): `R_min` = low of its `800+` salaried cell, `R_max` = high of its `<700`
   salaried cell — i.e. the lender's own published `[low, high]` band.
3. **Match** each institution to the first-party lender of the **same type** (PSB / PVT / SFB /
   HFC) that minimises `|Δlow| + |Δhigh|`. The matcher is a deterministic script
   (`|researchLow − R_min| + |researchHigh − R_max|`, smallest wins), not a judgement call.

The resulting `mirror` targets are written into `LENDERS` in `lib/rate-engine.ts`; the full
researched range, sources, chosen mirror, and per-row reasoning live in
`docs/rate-mirror-mapping.md`.

## Rationale (the why)

- The mirror exists purely to borrow a rate curve. The honest way to pick it is by the numbers
  the curve is built from (R_min/R_max), so matching on the researched public band is strictly
  better than matching on brand vibe. It directly fixes the observed Can Fin / Godrej mismatches.
- Constraining candidates to the same lender type keeps the type label, similar-lender tiering
  (decision 0008), and UI grouping coherent — an HFC never inherits a bank's curve.
- Equal weighting of low and high captures both ends of risk pricing: the floor (prime profile)
  and the cap (sub-700 / self-employed). A lender that matches only the floor but not the cap is
  not actually a good rate proxy.
- Official-source-first improves defensibility. HFCs must publish quarterly ROI ranges and banks
  publish RLLR/EBLR + CIBIL spread tables, so the floor/cap are usually available first-hand;
  aggregators (especially Paisabazaar/BankBazaar) are only a fallback and are flagged per row.
- The mechanism from 0006/0009 is unchanged — only the *target* of each `mirror` moves. Any
  institution can still be promoted to a first-party `b` array later and the mirror is ignored.

## Consequences

- Many targets moved versus the 0006 editorial mapping. Notable shifts: most public-sector banks
  now mirror BoB/Canara (rate-band matched) rather than SBI/Bank of India by size; a cluster of
  private banks (IndusInd, KVB, CSB, Bandhan, DCB) now mirror Yes Bank because their researched
  caps (~10.5-15%) sit at the top of the private band; the high-yield affordable HFCs converge on
  SK Finance because it is the only first-party lender whose cap reaches ~16%, so 16-26% lenders
  all clamp to it (and still understate — flagged in the mapping doc).
- Several institutions publish only a floor ("onwards") or no rate at all (Star, Svatantra,
  Shubham, Ummeed, Indostar, Hinduja Leyland, Five-Star); their highs are peer estimates, marked
  `(est)` in the mapping doc, so those rows are lower-confidence by construction.
- Unity SFB and North East SFB (now slice) offer no home-loan product; they keep a same-type SFB
  mirror so the picker still resolves a non-null rate.
- The mapping remains hand-maintained: re-running the matcher needs the researched ranges as
  input. The deterministic script makes a refresh reproducible rather than re-litigated.

## Alternatives considered

- **Keep the 0006 editorial mapping.** Rejected: it produced visible mismatches (Can Fin,
  Godrej) because it optimised for type/tier feel, not the actual rate band.
- **Weight the floor more heavily than the cap** (since the floor is the headline rate).
  Rejected: the cap encodes how the lender prices risk for weak profiles, which is exactly what
  the CIBIL curve needs; dropping it would mis-price the bottom of the curve.
- **Match across all types, not within type.** Rejected: would let an HFC inherit a bank's curve
  and break the type/tier coherence the similar-lender logic depends on.
- **Give every researched institution its own first-party `b` array.** Rejected for now: most
  only publish a floor + cap, not the full CIBIL grid, so we'd be fabricating mid-band cells —
  the very thing 0009's endpoint-only curve was designed to avoid. Mirroring a matched peer is
  more honest until a full sheet exists.
