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
| savings | [journal](journal/) | EMI/tenure savings math; max-savings hero + reduce-EMI/reduce-tenure boxes (js/savings.js) |
| ui | [journal](journal/) | single-page calculator layout; Birbal design-system restyle |
| architecture | [journal](journal/), [0003](decisions/0003-modular-files-for-parallel-agents.md) | modular files (RateEngine/Savings contracts) for parallel agents |

## Entities

| Entity | Where touched | Why |
|--------|---------------|-----|
| docs/why | [journal](journal/) | Established why-tracking for the repo |
| index.html | [journal](journal/) | The calculator (markup, styles, data, logic) |
| data/cibil-roi-bands | [journal](journal/) | Embedded rate bands from the ROI sheet |
| RateEngine.rateFor | [journal](journal/) | 10x-granular averaged rate within 50-pt CIBIL bands |
| calc/emi | [journal](journal/) | EMI amortisation function |
| calc/savings | [journal](journal/) | Two-option savings calculation |
| css/styles.css | [journal](journal/) | Calculator styling restyled to the Birbal design system |
| js/savings.js | [journal](journal/) | Savings sub-calculator UI: max-savings hero + reduce-EMI/reduce-tenure boxes; new rate from setContext.bestRate |
| js/data.js | [journal](journal/) | Rate engine module; `window.RateEngine` contract |
| js/app.js | [journal](journal/) | Glue wiring inputs → RateEngine → Savings |
| data/cibil-roi-rates.csv | [journal](journal/) | Source ROI sheet copied into the repo |

## Decisions

| # | Title | Status |
|---|-------|--------|
| [0001](decisions/0001-record-architecture-decisions.md) | Record architecture decisions | Accepted |
| [0002](decisions/0002-single-file-static-calculator.md) | Single-file static calculator with embedded rate data | Accepted |
| [0003](decisions/0003-modular-files-for-parallel-agents.md) | Modular files so multiple agents can work in parallel | Accepted |
