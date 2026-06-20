# 0003 — Modular files so multiple agents can work in parallel

- **Status:** Accepted
- **Date:** 2026-06-20
- **Tags:** architecture, meta, calculator
- **Touches:** index.html, css/styles.css, js/data.js, js/savings.js, js/app.js

## Context

The calculator started as a single self-contained `index.html` (decision 0002). Three changes were
then requested to run "in parallel": a design-system restyle, a 10x-granular rate engine, and a
rebuilt savings tool. All three would edit the same `index.html`, so dispatching them as concurrent
sub-agents would cause write conflicts on one file.

## Decision

Split the single file into one-owner-per-concern modules, each with a documented public contract,
before running the agents:
- `css/styles.css` — all presentation (Agent 2).
- `js/data.js` — rate dataset + lookup, exposes `window.RateEngine` (Agent 3).
- `js/savings.js` — savings sub-calculator, exposes `window.Savings` (Agent 4).
- `js/app.js` — glue wiring inputs → RateEngine → Savings (integration-owned).
- `index.html` — markup only, references the above.

## Rationale (the why)

Clear file ownership plus small, documented contracts (`RateEngine`, `Savings`) let three agents run
concurrently with no merge conflicts, and let each be verified in isolation (`node --check`, unit
math tests, a DOM-shim end-to-end test) before integration. The contracts mean an agent can replace
the internals of its file (e.g. rateFor going from band-string to averaged number) without breaking
callers, as long as the documented signatures hold. This supersedes the "everything in one file"
shape of 0002 while keeping its spirit: still a zero-build, dependency-free static site that opens
directly in a browser.

## Consequences

The page now loads three scripts in order (data → savings → app); load order matters and is fixed in
`index.html`. Contracts must be honored on future edits — changing a `RateEngine`/`Savings` signature
means updating `app.js` too. Integration must re-verify cross-module behaviour after parallel edits
(as happened here: a dropped lender and a missing CSS class were caught and fixed post-merge).

## Alternatives considered

- **Keep one file, run agents sequentially** — rejected: the user explicitly asked for parallel
  execution; sequential would be slower and still risk each agent reformatting unrelated regions.
- **Run agents in parallel on the single file, then merge diffs by hand** — rejected: three
  overlapping rewrites of one large file is exactly the conflict-prone case modular ownership avoids.
- **Move to a bundler/framework** — rejected: overkill for a static single-screen tool; contradicts
  decision 0002's zero-build rationale.
