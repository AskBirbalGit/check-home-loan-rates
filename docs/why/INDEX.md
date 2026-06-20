# Why index

An agent-maintained map of the reasoning in this repo. Update it whenever you add a journal entry
or decision record. It's a convenience layer — `rg` over `docs/why/` (the `Tags`/`Touches`
fields) is always the source of truth. See `SEARCH.md`.

> Keep entries terse. Link to the journal day or decision file that holds the full why.

## Topics

| Tag | Where | Summary |
|-----|-------|---------|
| meta | [journal](journal/), [0001](decisions/0001-record-architecture-decisions.md) | why-journal setup and conventions |
| calculator | [journal](journal/), [0002](decisions/0002-single-file-static-calculator.md), [0005](decisions/0005-migrate-to-nextjs-for-vercel.md) | home loan rate + savings calculator (now a Next.js app — app/Calculator.tsx) |
| home-loan | [journal](journal/) | rate bands, CIBIL/employment lookup |
| rates | [journal](journal/) | CIBIL-wise ROI data (Jun 2026); 10x-granular averaged lookup (650–850) in lib/rate-engine.ts |
| savings | [journal](journal/) | EMI/tenure savings math; "total saved" hero + two-ways boxes (reduce-EMI ₹/mo, reduce-tenure time) in lib/savings.ts; reduce-tenure total now amortises the partial final month (was overstating EMIs paid → understating savings by ~½ EMI) |
| ui | [journal](journal/) | stacked-box layout (now app/Calculator.tsx, a React client component), one full-width rectangle per step, each with a section `<h2>` heading above its card (Your details / Rates for your profile / Additional loan details for savings / Savings on rate reduction; cols "In current institutions" / "Similar institutions"); Birbal design-system restyle; section cards carry a light-teal wash (`.box .card`) mirroring the hero panel; the Box 4 savings panels (`.sv-hero`/`.sv-card-*`) share that same frame — accent-24% border + shadow-sm, with the hero alone at shadow-md as the one allowed accent |
| typography | [journal](journal/) | consolidated phone-first type ramp in css/styles.css :root: **7 sizes** (display/heading/money/lead/body 16/label 13/eyebrow 12 — the big 4 use `clamp()` so they step down on phone), **4 weights** (400/500/600/700 as an emphasis axis), **3 line-heights** (1.1/1.4/1.55), **3 letter-spacing tokens** (--ls-display/-tight/-eyebrow); EB Garamond → display(hero+showcase ₹)+headings, Figtree → all body/UI + tabular data figures; fonts loaded via `next/font` (app/layout.tsx), self-hosted at build |
| architecture | [journal](journal/), [0003](decisions/0003-modular-files-for-parallel-agents.md), [0005](decisions/0005-migrate-to-nextjs-for-vercel.md) | Next.js (App Router) + React + TS; rate/savings logic in typed lib/*.ts modules |
| logos | [journal](journal/) | lender logos fetched from logo.dev into `public/logos/`; rendered on rate rows + picker via slug match in app/Calculator.tsx |
| banks | [journal](journal/), [0004](decisions/0004-hardcoded-disbursement-ranking.md) | bank picker: searchable combobox, disbursement-ranked open order, type-to-filter, alias matching (e.g. "state bank of india"→SBI) in lib/banks.ts + app/Calculator.tsx |
| deploy | [journal](journal/), [0005](decisions/0005-migrate-to-nextjs-for-vercel.md) | Vercel-native Next.js deploy (auto-detected, no vercel.json); security + cache headers in next.config.ts; static prerender + client hydration |

## Entities

| Entity | Where touched | Why |
|--------|---------------|-----|
| docs/why | [journal](journal/) | Established why-tracking for the repo |
| index.html | [journal](journal/) | Removed — original side-by-side v1 page, superseded by index-v2.html |
| data/cibil-roi-bands | [journal](journal/) | Embedded rate bands from the ROI sheet |
| RateEngine.rateFor | [journal](journal/) | 10x-granular averaged rate within 50-pt CIBIL bands |
| calc/emi | [journal](journal/) | EMI amortisation function |
| calc/savings | [journal](journal/) | Two-option savings calculation |
| css/styles.css | [journal](journal/) | Shared tokens + component styles (v2 reuses them); global type tokens (font families + fw/fs/lh) live in its `:root`; `--font-head`/`--font-body` now point at `next/font` CSS vars; active segmented-control pill is a raised white/navy-text pill (not navy fill) so it doesn't clash with the navy CTA |
| font/eb-garamond, font/figtree | [journal](journal/) | Brand fonts loaded via `next/font` (app/layout.tsx), self-hosted at build; EB Garamond → title + headings, Figtree → all body/UI |
| js/savings.js | [journal](journal/) | Removed with v1 — was the mounted savings sub-calculator UI for index.html |
| js/data.js | [journal](journal/) | Removed in the Next.js migration — `RateEngine` logic ported verbatim to lib/rate-engine.ts |
| js/app.js | [journal](journal/) | Removed with v1 — was the page glue for index.html |
| data/cibil-roi-rates.csv | [journal](journal/) | Source ROI sheet copied into the repo |
| scripts/fetch-logos.sh | [journal](journal/) | Reproducible logo.dev downloader (name→domain→slug, 128px PNG) |
| public/logos/ | [journal](journal/) | 32 lender logos pulled from logo.dev (moved from logos/ into Next's static root) |
| vercel.json | [journal](journal/) | Removed in the Next.js migration — Vercel auto-detects the framework; headers moved to next.config.ts |
| .vercelignore | [journal](journal/) | Removed in the Next.js migration |
| app/Calculator.tsx | [journal](journal/) | The whole stacked-box flow as a React client component (ported from index-v2.html + js/app-v2.js); owns the bank combobox state + journey-aware footer; hero h1 title-cased "Are You Paying the Right Home Loan Rate?" |
| app/layout.tsx, app/page.tsx | [journal](journal/) | Next App Router root: layout loads next/font + the two stylesheets; page renders Calculator; `<title>` kept in sync with the hero h1 |
| lib/rate-engine.ts | [journal](journal/) | Typed port of the RateEngine: 10x-granular averaged rate within 50-pt CIBIL bands |
| lib/banks.ts | [journal](journal/) | DISBURSE_RANK + ALIASES + ALL_BANKS + logoSlug/initials for the picker |
| lib/savings.ts | [journal](journal/) | EMI amortisation + two-strategy switching-savings math (verbatim port) |
| next.config.ts | [journal](journal/) | Security + logo cache headers (ported from the old vercel.json) |
| css/styles-v2.css | [journal](journal/) | Stacked-layout overrides on top of styles.css tokens/components; `.box .card` light-teal section wash mirroring the hero panel |

## Decisions

| # | Title | Status |
|---|-------|--------|
| [0001](decisions/0001-record-architecture-decisions.md) | Record architecture decisions | Accepted |
| [0002](decisions/0002-single-file-static-calculator.md) | Single-file static calculator with embedded rate data | Superseded by 0005 |
| [0003](decisions/0003-modular-files-for-parallel-agents.md) | Modular files so multiple agents can work in parallel | Accepted |
| [0004](decisions/0004-hardcoded-disbursement-ranking.md) | Hand-maintained disbursement ranking for the bank picker | Accepted |
| [0005](decisions/0005-migrate-to-nextjs-for-vercel.md) | Migrate to Next.js (App Router) for first-class Vercel deployment | Accepted (supersedes 0002) |
