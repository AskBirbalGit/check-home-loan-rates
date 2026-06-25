# 0011 — Cross-type rate-matched mirror targets

- **Status:** Accepted
- **Date:** 2026-06-25

## Context

Decision 0010 matched each long-tail (mirrored) institution to the first-party lender with the
closest researched rate band `[R_min(800+), R_max(<700)]`, minimising `|Δlow| + |Δhigh|`, but
**constrained candidates to the same lender type** (PSB / PVT / SFB / HFC). Reviewing the
resulting mapping, several rows had large residual gaps that existed *only because* of the
same-type fence: DCB Bank (researched 9.75–14.50) was clamped to Yes Bank at Δ 4.65, CSB Bank
(10.50–13.95) to Yes Bank at Δ 4.85, Suryoday SFB (10.00–13.00) to Jana SFB at Δ 3.40 — while an
HFC band sat almost exactly on each range (Hinduja Housing Δ 0.75, Cholamandalam Δ 0.05, JM
Financial Δ 0.50).

The ask: the rates should match as closely as possible; for mirroring purposes there is no
type constraint — crisscross between any type is fine as long as the rate band lines up.

## Decision

Drop the same-type constraint from the mirror matcher. Each mirrored institution now maps to the
first-party lender of **any** type that minimises `|Δlow| + |Δhigh|`, ties broken toward the
closer floor (`|Δlow|`). The deterministic distance metric and the researched-range inputs from
0010 are unchanged; only the candidate pool widens from same-type to all 32 first-party lenders.

The institution keeps its own display `name` and `type` label; only the rate **curve** is
inherited via `resolveBands`. The new targets are written into `LENDERS` in `lib/rate-engine.ts`;
`docs/rate-mirror-mapping.md` records each researched range, the chosen mirror, its band, and the
match distance (with the prior same-type pick noted where it moved).

## Rationale (the why)

- The mirror exists solely to borrow a rate curve, so the only thing that should drive the pick
  is how closely the two bands line up. A type fence optimises for a label the user already sees
  on the row anyway, at the cost of the number being wrong — the opposite of the priority.
- It strictly improves the fit: 24 of 57 rate-carrying institutions move to a tighter band, none
  get worse (same-type remains in the candidate set, so it still wins when it was already best —
  e.g. PNB→BoB Δ 0.00, IOB→SBI, Tamilnad/Dhanlaxmi→RBL are unchanged). Standouts: Indian Bank →
  PNB Housing (Δ 0.00 vs 1.25), CSB → Cholamandalam (0.05 vs 4.85), DCB → Hinduja Housing
  (0.75 vs 4.65), Suryoday → JM Financial (0.50 vs 3.40), Capital SFB → Sammaan (0.35 vs 2.00).
- The display type is decoupled from the rate source, so coherence the user sees (the "PSB /
  PVT / SFB / HFC" tag, the picker grouping) is preserved even though a bank may now borrow an
  HFC's curve under the hood.

## Consequences

- Most banks and SFBs now inherit an HFC curve (HFCs publish the widest spread of bands, so they
  most often hold the closest match). This is invisible in the UI — only the borrowed numbers
  change — but anyone reading `LENDERS` will see, e.g., "Indian Bank" mirroring "PNB Housing
  Finance". The mapping doc explains why per row.
- Decision 0008's similar-lender tiering (`others()`) is unaffected: it already excludes mirrored
  lenders from the suggestion pool and tiers by the *displayed* type, not the mirror target.
- The genuinely high-yield lenders whose caps exceed the highest first-party cap (~16%, SK
  Finance) still understate at the top end — dropping the type fence cannot fix that, only a
  higher-cap first-party sheet would. Those large residual Δ rows (Manappuram, Muthoot, Shriram,
  Fincare, etc.) are flagged "cap understates" in the mapping doc. The eight lenders removed in
  the 2026-06-25 high-yield cleanup stay removed.
- Ties now resolve toward the closer floor, so a few HFC↔HFC equidistant picks moved to the
  lower-floor peer (e.g. India Shelter, Vastu, Manappuram → MAS Financial over SK Finance).

## Alternatives considered

- **Keep the same-type constraint (decision 0010).** Rejected: it forces visibly wrong rate
  bands (DCB/CSB/Suryoday Δ > 3–5) purely to preserve a type label the user already sees on the
  row regardless of the mirror.
- **Pool only the banks (PSB+PVT+SFB) and keep HFC within HFC.** Rejected: still leaves
  DCB/CSB/Suryoday/Capital materially mismatched, since the closest band for those is an HFC.
- **Cap the crisscross to cases where cross-type beats same-type by some Δ threshold.** Rejected
  as added complexity with no benefit: same-type is already in the candidate pool, so the
  pure-minimum rule keeps same-type wherever it was competitive and only crosses when it is
  strictly closer.
