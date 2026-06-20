# 0002 — Single-file static calculator with embedded rate data

- **Status:** Accepted
- **Date:** 2026-06-20
- **Tags:** calculator, home-loan, rates, architecture
- **Touches:** index.html, data/cibil-roi-bands

## Context

We need a home loan rate calculator that takes a bank name, CIBIL score, and employment type,
then shows the user's current-institution rate band plus three comparable institutions, and a
savings estimate. The rate data comes from a provided CIBIL-wise ROI spreadsheet (Jun 2026). The
project has no existing stack, build tooling, or backend.

## Decision

We will ship the calculator as a single self-contained `index.html` with embedded CSS and
JavaScript, and transcribe the rate bands into a JavaScript array literal inside that file. No
build step, no dependencies, no backend.

## Rationale (the why)

The dataset is small (32 lenders × 8 CIBIL/employment bands) and static, so a runtime data fetch
or database adds cost without benefit. A single HTML file opens directly in any browser, is
trivial to host on any static host or CDN, and has zero supply-chain surface. Embedding the data
keeps the lookup synchronous and the whole tool inspectable in one place. The rates are
indicative marketing data, not transactional, so there's no need for live API integration.

## Consequences

When the rate sheet is updated, the `LENDERS` array in `index.html` must be re-transcribed by
hand (or via a small script). If the lender list grows large or rates need to update frequently,
this should be revisited (e.g. split data into a JSON file or fetch from an API). Savings math is
done client-side with standard amortisation formulas; it is an estimate, not a quote.

## Alternatives considered

- **A framework app (React/Vite) + API** — rejected: heavy for a static, single-screen tool with
  a tiny fixed dataset; adds build and hosting complexity.
- **External JSON/CSV loaded at runtime** — rejected for now: introduces a fetch and a CORS/host
  dependency for data that changes rarely; can revisit if update cadence increases.
