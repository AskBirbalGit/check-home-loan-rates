# Why index

An agent-maintained map of the reasoning in this repo. Update it whenever you add a journal entry
or decision record. It's a convenience layer — `rg` over `docs/why/` (the `Tags`/`Touches`
fields) is always the source of truth. See `SEARCH.md`.

> Keep entries terse. Link to the journal day or decision file that holds the full why.

## Topics

| Tag | Where | Summary |
|-----|-------|---------|
| meta | [journal](journal/), [0001](decisions/0001-record-architecture-decisions.md) | why-journal setup and conventions |
| calculator | [journal](journal/), [0002](decisions/0002-single-file-static-calculator.md) | home loan rate + savings calculator |
| home-loan | [journal](journal/) | rate bands, CIBIL/employment lookup |
| rates | [journal](journal/) | CIBIL-wise ROI data (Jun 2026); 10x-granular averaged lookup (650–850) |
| savings | [journal](journal/) | EMI/tenure savings math; "total saved" hero + two-ways boxes (reduce-EMI ₹/mo, reduce-tenure time) in js/savings.js |
| ui | [journal](journal/) | single-page calculator layout; Birbal design-system restyle; three-act flow with savings on its own full-width stage; stacked-box variant (index-v2) — one full-width rectangle per step, each with a section `<h2>` heading (Current loan details / Rates for your profile / Additional loan details for savings / Savings on rate reduction; v2 cols "In current institutions" / "Similar institutions"); hero trust-tags toned down to quiet muted outlines; hero sub-line broken with `<br>` after "against"; lender-count tag corrected from 100+ to 30+ |
| typography | [journal](journal/) | global two-font system (EB Garamond title+headings, Figtree body/UI) on a small token set (4 weights, 6 sizes, 3 line-heights) in css/styles.css :root; fonts loaded via Google Fonts `<link>` in both HTML heads |
| architecture | [journal](journal/), [0003](decisions/0003-modular-files-for-parallel-agents.md) | modular files (RateEngine/Savings contracts) for parallel agents |
| logos | [journal](journal/) | lender logos fetched from logo.dev into `logos/`; rendered on rate rows via slug match in js/app.js |
| banks | [journal](journal/), [0004](decisions/0004-hardcoded-disbursement-ranking.md) | v2 bank picker: searchable combobox, disbursement-ranked open order, type-to-filter, alias matching (e.g. "state bank of india"→SBI) in js/app-v2.js |
| deploy | [journal](journal/) | Vercel static deploy (no build); `/` rewritten to index-v2.html; security + cache headers; `.vercelignore` drops source/tooling |

## Entities

| Entity | Where touched | Why |
|--------|---------------|-----|
| docs/why | [journal](journal/) | Established why-tracking for the repo |
| index.html | [journal](journal/) | The calculator (markup, styles, data, logic) |
| data/cibil-roi-bands | [journal](journal/) | Embedded rate bands from the ROI sheet |
| RateEngine.rateFor | [journal](journal/) | 10x-granular averaged rate within 50-pt CIBIL bands |
| calc/emi | [journal](journal/) | EMI amortisation function |
| calc/savings | [journal](journal/) | Two-option savings calculation |
| css/styles.css | [journal](journal/) | Calculator styling restyled to the Birbal design system; global type tokens (font families + fw/fs/lh) live in its `:root`; active segmented-control pill is a raised white/navy-text pill (not navy fill) so it doesn't clash with the navy CTA |
| font/eb-garamond, font/figtree | [journal](journal/) | Brand fonts loaded via Google Fonts `<link>`; EB Garamond → title + headings, Figtree → all body/UI |
| js/savings.js | [journal](journal/) | Savings sub-calculator UI: "total saved" hero + reduce-EMI (₹/mo) / reduce-tenure (time) boxes; new rate from setContext.bestRate; hides #discFooter once savings is opened |
| js/data.js | [journal](journal/) | Rate engine module; `window.RateEngine` contract |
| js/app.js | [journal](journal/) | Glue wiring inputs → RateEngine → Savings; trims #discFooter copy once rates render |
| data/cibil-roi-rates.csv | [journal](journal/) | Source ROI sheet copied into the repo |
| scripts/fetch-logos.sh | [journal](journal/) | Reproducible logo.dev downloader (name→domain→slug, 128px PNG) |
| logos/ | [journal](journal/) | 32 lender logos pulled from logo.dev |
| vercel.json | [journal](journal/) | Static deploy config: `/`→index-v2.html rewrite, security headers, css/js/logos cache rules |
| .vercelignore | [journal](journal/) | Excludes data/, scripts/, docs/, git/OS cruft from the Vercel deploy bundle |
| index-v2.html | [journal](journal/) | Stacked-box layout variant: one full-width rectangle per step (inputs → rates → savings inputs → savings result) |
| css/styles-v2.css | [journal](journal/) | Stacked-layout overrides on top of styles.css tokens/components |
| js/app-v2.js | [journal](journal/) | Self-contained glue for index-v2: RateEngine lookup + inline savings math; trims #discFooter on rate check, hides it on the savings CTA; owns the searchable bank combobox (DISBURSE_RANK + ALIASES + ALL_BANKS) |

## Decisions

| # | Title | Status |
|---|-------|--------|
| [0001](decisions/0001-record-architecture-decisions.md) | Record architecture decisions | Accepted |
| [0002](decisions/0002-single-file-static-calculator.md) | Single-file static calculator with embedded rate data | Accepted |
| [0003](decisions/0003-modular-files-for-parallel-agents.md) | Modular files so multiple agents can work in parallel | Accepted |
| [0004](decisions/0004-hardcoded-disbursement-ranking.md) | Hand-maintained disbursement ranking for the bank picker | Accepted |
