# Mirrored Institution Rate Mapping

These institutions do not carry first-party CIBIL-wise rate bands in `lib/rate-engine.ts`.
Their rates resolve by mirroring the listed first-party lender via `resolveBands`.

**Mapping method (rate-matched across ALL types, not editorial).** For each institution we
researched the current (2025-2026) public home-loan rate range — its lowest published/floor rate
and its highest cap (for low-CIBIL / self-employed / high-risk borrowers). We then matched it to
the first-party lender whose own salaried band `[R_min(800+), R_max(<700)]` is closest, minimising
`|Δlow| + |Δhigh|`. **As of decision 0011 the same-type constraint is dropped:** the mirror is
whichever first-party lender of ANY type (PSB / PVT / SFB / HFC) gives the closest rate band, ties
broken toward the closer floor. The institution still displays its own name and type label; only
the rate *curve* is borrowed. The matcher is deterministic; the tables below show each
institution's researched range, the chosen mirror, that mirror's own band, and the match distance.

**Why cross-type.** The mirror exists purely to borrow a rate curve, so the only thing that
matters is how closely the numbers line up. The earlier same-type rule (decision 0010) forced
visibly bad fits — e.g. DCB Bank (9.75-14.50) clamped to Yes Bank with Δ 4.65, CSB Bank
(10.50-13.95) to Yes Bank with Δ 4.85 — when an HFC band sat almost exactly on their range
(Hinduja Housing Δ 0.75, Cholamandalam Δ 0.05). Allowing crisscross fixes 24 such rows; the
type label shown to the user is unchanged.

**Removed institutions.** Genuinely high-yield lenders whose real rate band runs well
beyond the highest first-party cap (~16%, SK Finance) were **removed from the system** rather
than mirrored to a peer that would materially understate their rates: Aptus Value Housing,
SRG Housing Finance, Star Housing Finance, Five-Star Business Finance, Roha Housing Finance,
Shubham Housing Finance, Mahindra Rural Housing Finance, and Indostar Home Finance. A further
batch was removed on editorial request (no longer carried regardless of band fit): Unity SFB,
North East SFB (slice), Fincare SFB, ESAF SFB, Capri Global Housing Finance, Ummeed Housing
Finance, Manappuram Home Finance, Muthoot Fincorp, Shriram Housing (Truhome), Aviom India
Housing Finance, DMI Housing Finance, Vridhi Home Finance, Hinduja Leyland Finance, and Vastu
Housing Finance. Their rows below are retained for the record marked "— removed".

**Sources.** Official lender interest-rate / ROI-disclosure pages were used first (HFCs publish
quarterly ROI ranges; banks publish RLLR/EBLR + CIBIL-tiered spread tables). NoBroker / Wishfin
/ MyLoanCare / CreditDharma / Ambak / MagicBricks were used as secondary sources. Paisabazaar
and BankBazaar were treated as a **last resort** only where official and other sources were
blocked or did not disclose a figure. Ranges are indicative; actual offers vary by CIBIL,
income type, LTV, loan amount, geography, and campaign. A `+` / `(est)` high end means the
lender publishes only a floor ("onwards") and the cap is inferred from peers.

First-party lender bands used as match targets (salaried `R_min..R_max`):

| Lender | Type | Band | Lender | Type | Band |
|---|---|---|---|---|---|
| SBI | PSB | 7.25–8.70 | Bajaj Housing Finance | HFC | 7.25–10.00 |
| Bank of India | PSB | 7.10–10.00 | Tata Capital | HFC | 7.50–10.00 |
| Bank of Baroda | PSB | 7.20–9.10 | LIC Housing Finance | HFC | 7.15–9.50 |
| Canara Bank | PSB | 7.15–10.00 | PNB Housing Finance | HFC | 7.90–10.50 |
| Union Bank of India | PSB | 7.15–10.00 | Sammaan Capital (Indiabulls) | HFC | 8.75–12.00 |
| Central Bank of India | PSB | 7.10–9.15 | Muthoot Housing Finance | HFC | 11.25–14.00 |
| ICICI Bank | PVT | 7.45–9.05 | Aavas Financiers | HFC | 9.00–13.00 |
| HDFC Bank | PVT | 7.15–8.75 | Hinduja Housing Finance | HFC | 10.00–14.00 |
| Axis Bank | PVT | 7.30–8.90 | Home First Finance | HFC | 11.00–14.00 |
| Kotak Mahindra Bank | PVT | 7.60–9.25 | Aadhar Housing Finance | HFC | 11.75–15.00 |
| IDFC First Bank | PVT | 7.75–10.00 | Cholamandalam Finance | HFC | 10.50–14.00 |
| Yes Bank | PVT | 9.00–10.60 | SK Finance | HFC | 12.00–16.00 |
| RBL Bank | PVT | 8.20–9.80 | MAS Financial | HFC | 11.00–15.00 |
| AU Small Finance Bank | SFB | 8.25–9.85 | JM Financial Services | HFC | 10.00–13.50 |
| Ujjivan SFB | SFB | 8.75–10.35 | Axis Finance | HFC | 10.25–13.75 |
| Jana SFB / Equitas SFB | SFB | 9.00–10.60 | | | |

## Public Sector Banks

| New institution | Researched range | Sources | Mapped to (band) | Reasoning |
|---|---:|---|---|---|
| Punjab National Bank | 7.20%-9.10% | PNB official CIBIL-tier ROI page | Bank of Baroda (7.20–9.10) | Exact band match (Δ 0.00); official CIBIL tiers. |
| Indian Bank | 7.90%-10.50% (high est) | BankBazaar (last resort; official 404) | PNB Housing Finance (7.90–10.50) | Exact band match (Δ 0.00) cross-type; was Canara (Δ 1.25). |
| Indian Overseas Bank | 7.35%-8.45% | IOB Subha Gruha tiers (Paisabazaar last resort; official scheme only) | SBI (7.25–8.70) | Tight low-cap band = SBI (Δ 0.35). |
| UCO Bank | 7.40%-9.50% | UCO official Repo/ROI + home-loan pages | LIC Housing Finance (7.15–9.50) | 9.50 cap exact; Δ 0.25 cross-type (was BoB Δ 0.60). |
| Bank of Maharashtra | 7.35%-9.90% | Maha Super tiers (Paisabazaar last resort; official unreachable) | Bajaj Housing Finance (7.25–10.00) | Δ 0.20 cross-type (was Canara Δ 0.30). |
| Punjab & Sind Bank | 7.30%-10.70% | Apna Ghar tiers (Paisabazaar last resort; official unreachable) | Bajaj Housing Finance (7.25–10.00) | Δ 0.75 cross-type (was Canara Δ 0.85). |

## Private Banks

| New institution | Researched range | Sources | Mapped to (band) | Reasoning |
|---|---:|---|---|---|
| IndusInd Bank | 8.25%-10.75% (est) | IndusInd official (EBLR, undisclosed) | PNB Housing Finance (7.90–10.50) | Δ 0.60 cross-type (was RBL Δ 1.00). |
| Federal Bank | 7.30%-9.50% | BankBazaar (last resort; official 404) | ICICI Bank (7.45–9.20) | Manual override — mirror set to ICICI Bank per editorial request (was LIC Housing Finance). |
| South Indian Bank | 7.20%-9.85% | BankBazaar (last resort; official 403) | IDFC First Bank (7.75–10.25) | Manual override — mirror set to IDFC First Bank per editorial request (was Canara Bank). |
| Karur Vysya Bank | 8.50%-10.90% | KVB NRI scheme (BankBazaar last resort; official down) | Ujjivan SFB (8.75–10.35) | Δ 0.80 cross-type (was RBL Δ 1.40). |
| Karnataka Bank | 7.30%-12.31% | BankBazaar (last resort; official 403) | Sammaan Capital (Indiabulls) (8.75–12.00) | Very wide; Δ 1.76 cross-type (was IDFC First Δ 2.76). |
| City Union Bank | 8.25%-10.50% | CUB CIBIL tiers (Paisabazaar last resort; official migrating) | PNB Housing Finance (7.90–10.50) | 10.50 cap exact; Δ 0.35 cross-type (was RBL Δ 0.75). |
| DCB Bank | 9.75%-14.50% | DCB official (product only; Paisabazaar last resort) | Hinduja Housing Finance (10.00–14.00) | Δ 0.75 cross-type (was Yes Bank Δ 4.65). |
| Tamilnad Mercantile Bank | 8.15%-9.50% | TMB Elite (Paisabazaar last resort; official 404) | RBL Bank (8.20–9.80) | Mid band = RBL (Δ 0.35); unchanged. |
| CSB Bank | 10.50%-13.95% (est) | Official CAPTCHA-blocked; market est | Cholamandalam Finance (10.50–14.00) | 10.50 floor exact; Δ 0.05 cross-type (was Yes Bank Δ 4.85). |
| Bandhan Bank | 8.41%-15.00% | Bandhan Su-awas (Paisabazaar last resort; official 404) | Aavas Financiers (9.00–13.00) | Δ 2.59 cross-type (was RBL Δ 5.41); cap still understates. |
| Dhanlaxmi Bank | 7.90%-9.75% | Dhanlaxmi rating grid (Paisabazaar last resort; official partial) | RBL Bank (8.20–9.80) | Mid band = RBL (Δ 0.35); unchanged. |
| Jammu & Kashmir Bank | 7.50%-8.60% | J&K Bank official HLRLLR ± spread | SBI (7.25–8.70) | Tight low band; Δ 0.35 cross-type (was HDFC Δ 0.50). |
| Nainital Bank | 8.15%-11.00% | Nainital official "Apna Aashiana" NRLLR spread | PNB Housing Finance (7.90–10.50) | Δ 0.75 cross-type (was RBL Δ 1.25). |

## Small Finance Banks

| New institution | Researched range | Sources | Mapped to (band) | Reasoning |
|---|---:|---|---|---|
| Utkarsh Small Finance Bank | 9.50%-15.00% | Utkarsh official scheme grid | Hinduja Housing Finance (10.00–14.00) | Δ 1.50 cross-type (was Jana SFB Δ 4.90). |
| Suryoday Small Finance Bank | 10.00%-13.00% | Suryoday official 10–13 band | JM Financial Services (10.00–13.50) | 10.00 floor exact; Δ 0.50 cross-type (was Jana Δ 3.40). |
| ESAF Small Finance Bank | 7.77%-17.50% | ESAF official + NoBroker | — removed | Removed on editorial request. |
| Capital Small Finance Bank | 8.40%-12.00% (est) | Capital official EBLR + NoBroker | Sammaan Capital (Indiabulls) (8.75–12.00) | 12.00 cap exact; Δ 0.35 cross-type (was Ujjivan Δ 2.00). |
| Unity Small Finance Bank | no home-loan product | Unity official (no HL) | — removed | Removed on editorial request. |
| Shivalik Small Finance Bank | 7.75%-15.00% | Shivalik official (housing 7.75–15) | Aavas Financiers (9.00–13.00) | Δ 3.25 cross-type (was AU Δ 5.65). |
| North East Small Finance Bank | no home-loan product (now slice) | slice official (no HL) | — removed | Removed on editorial request. |
| Fincare Small Finance Bank | 8.00%-22.00% (est) | AU official (merged) + NoBroker | — removed | Removed on editorial request. |

## Housing Finance & NBFCs

| New institution | Researched range | Sources | Mapped to (band) | Reasoning |
|---|---:|---|---|---|
| ICICI Home Finance | 7.80%-15.00% | ICICI HFC official service-charges range | Aavas Financiers (9.00–13.00) | Δ 3.20 (was Tata Capital Δ 5.30). |
| Repco Home Finance | 8.75%-13.20% | Repco official floor + Paisabazaar high | Aavas Financiers (9.00–13.00) | Affordable-prime band ≈ Aavas (Δ 0.45). |
| GIC Housing Finance | 8.20%-11.30% | GIC official CIBIL-linked ROI chart | PNB Housing Finance (7.90–10.50) | Prime-ish HFC; PNB Housing closest (Δ 1.10). |
| Can Fin Homes | 8.95%-14.95% | Can Fin official IHL grid | Aavas Financiers (9.00–13.00) | SE-fixed top pulls it to Aavas band (Δ 2.00). |
| India Shelter Finance | 11.00%-16.00% (high est) | India Shelter official floor; high est | MAS Financial (11.00–15.00) | 11.00 floor exact; Δ 1.00 (was SK Δ 1.00 tie → closer floor). |
| Shriram Housing (Truhome) | 8.50%-21.00% | Truhome official rate card | — removed | Removed on editorial request. |
| Vastu Housing Finance | 10.25%-19.50% | Vastu official ROI + product page | — removed | Removed on editorial request. |
| Motilal Oswal Home Finance | 10.00%-17.75% | Motilal Oswal official disbursed ROI | Hinduja Housing Finance (10.00–14.00) | 10.00 floor exact; Δ 3.75 (was Aadhar Δ 4.50). |
| Godrej Housing Finance | 7.75%-11.00% (high est) | Godrej official (no number) + Ambak | PNB Housing Finance (7.90–10.50) | Prime digital HFC; PNB Housing closest (Δ 0.65). |
| Piramal Capital & Housing | 9.99%-18.00% (high est) | Piramal official floor; high est | Hinduja Housing Finance (10.00–14.00) | 9.99 ≈ Hinduja floor (Δ 4.01). |
| IIFL Home Finance | 8.90%-18.00% | IIFL official quarterly range | Aavas Financiers (9.00–13.00) | 8.90 ≈ Aavas floor (Δ 5.10). |
| L&T Finance | 7.75%-10.75% | L&T official floor + grid + Ambak | PNB Housing Finance (7.90–10.50) | Prime NBFC; PNB Housing closest (Δ 0.40). |
| Sundaram Home Finance | 8.75%-11.25% | Sundaram official (PLR) + secondary | Sammaan Capital (Indiabulls) (8.75–12.00) | 8.75 floor = Sammaan exactly (Δ 0.75). |
| Cent Bank Home Finance | 10.00%-12.85% | Cent Bank CIBIL tiers (Paisabazaar last resort; official down) | JM Financial Services (10.00–13.50) | 10.00 floor = JM; cap closest (Δ 0.65). |
| Manappuram Home Finance | 11.00%-24.00% (high est) | Manappuram official floor; high est | — removed | Removed on editorial request. |
| Poonawalla Fincorp | 9.00%-12.50% | Poonawalla official (no HL page) + Ambak | Aavas Financiers (9.00–13.00) | 9.00 floor = Aavas (Δ 0.50). |
| Edelweiss Housing Finance | 9.00%-17.75% | Nido official quarterly (same entity) | Aavas Financiers (9.00–13.00) | 9.00 floor = Aavas (Δ 4.75). |
| Capri Global Housing Finance | 10.00%-24.00% | Capri official quarterly + "up to 24%" cap | — removed | Removed on editorial request. |
| Altum Credo Home Finance | 12.00%-18.00% | Altum Credo official 12–18 | SK Finance (12.00–16.00) | 12.00 floor = SK exactly (Δ 2.00). |
| Bajaj Finance | 7.25%-10.85% | Bajaj Housing official (group HL channel) | Bajaj Housing Finance (7.25–10.00) | Same-group home-loan channel; exact floor (Δ 0.85). |
| Aditya Birla Housing Finance | 8.60%-16.00% (high est) | Aditya Birla official floor; high est | Aavas Financiers (9.00–13.00) | Near-prime affordable; Aavas closest (Δ 3.40). |
| Hero Housing Finance | 9.50%-18.00% (high est) | Hero official (no number) + secondary floor | Hinduja Housing Finance (10.00–14.00) | Affordable semi-urban; Hinduja closest (Δ 4.50). |
| SMFG India Credit | 9.25%-18.00% | SMFG Grihashakti official quarterly range | Hinduja Housing Finance (10.00–14.00) | Secured retail 9–18; Hinduja closest (Δ 4.75). |
| Hinduja Leyland Finance | 10.50%-20.00% (est) | HLF official (no rate); peer est | — removed | Removed on editorial request. |
| Nido Home Finance | 9.00%-17.75% | Nido official quarterly RoI tables | Aavas Financiers (9.00–13.00) | 9.00 floor = Aavas (Δ 4.75). |
| DMI Housing Finance | 9.50%-19.50% | DMI official ROI disclosure (PLR 14.75) | — removed | Removed on editorial request. |
| Vridhi Home Finance | 12.00%-22.00% | Vridhi official ROI disclosure | — removed | Removed on editorial request. |
| Easy Home Finance | 8.99%-18.00% (high est) | Easy official floor; high est | Aavas Financiers (9.00–13.00) | 8.99 ≈ Aavas floor (Δ 5.01). |
| Svatantra Micro Housing | 11.50%-20.00% (est) | Svatantra official (no rate); peer est | SK Finance (12.00–16.00) | Micro affordable high-yield; SK closest (Δ 4.50). |
| Muthoot Fincorp | 11.00%-24.00% | Muthoot Homefin official range | — removed | Removed on editorial request. |
| Shubham Housing Finance | 10.50%-24.00% (est) | Shubham official (no number); est | — removed | Informal-income to ~24% exceeds the first-party cap (~16%); removed rather than misrepresent. |
| Ummeed Housing Finance | 10.50%-24.00% (est) | Ummeed official (no number); est | — removed | Removed on editorial request. |
| Aviom India Housing Finance | 12.00%-24.00% (est, in CIRP) | Aviom official (under insolvency); est | — removed | Removed on editorial request. |
| Mahindra Rural Housing Finance | 10.25%-22.00% | Mahindra official EMI slider (8.5–25) | — removed | Rural flat-rate to ~22–26% exceeds the first-party cap (~16%); removed rather than misrepresent. |
| Indostar Home Finance | 10.50%-20.00% (est) | Indostar official site down; peer est | — removed | MSME/affordable to ~18–20% exceeds the first-party cap (~16%); removed rather than misrepresent. |
| Centrum Housing Finance | 10.49%-14.99% | Centrum official fixed-ROI band | MAS Financial (11.00–15.00) | Profile-banded affordable; MAS closest (Δ 0.52). |
