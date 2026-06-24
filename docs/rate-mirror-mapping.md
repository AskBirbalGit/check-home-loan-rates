# Mirrored Institution Rate Mapping

These institutions do not carry first-party CIBIL-wise rate bands in `lib/rate-engine.ts`.
Their rates resolve by mirroring the listed first-party lender via `resolveBands`. Public rate
ranges below are indicative starting/observed figures only; actual offers vary by CIBIL,
income type, LTV, loan amount, geography, and campaign. Each mapping is anchored on the
first-party lender's own starting rate so the mirrored institution lands in a comparable band.

Sources were gathered from official lender pages plus rate aggregators (Paisabazaar,
BankBazaar, Wishfin, CreditDharma, MagicBricks, NoBroker). Static Google HTML returns an
enable-JS gate, so organic search-result scraping could not be used for ranking; the cited
references are the lender/aggregator pages reviewed for each institution.

## Public Sector Banks

| New institution | Rate range | Sources | Mapped to lender | Reasoning |
|---|---:|---|---|---|
| Punjab National Bank | 7.20%-9.30% | PNB, Paisabazaar, BankBazaar | SBI | Largest PSU peer, repo-linked, near-identical low start. |
| Indian Bank | 7.15%/7.40% onward | Indian Bank, BankBazaar, MagicBricks | Canara Bank | South-heavy PSU; 7.15 start = Canara. |
| Indian Overseas Bank | 7.10%-7.35% onward | IOB, Paisabazaar, NoBroker | Bank of India | 7.10 start = BoI; same mid-tier PSU profile. |
| UCO Bank | 7.40% onward | UCO Bank, BankBazaar, Wishfin | Central Bank of India | Smaller PSU, lower-cap public-bank curve. |
| Bank of Maharashtra | 7.10% onward | Bank of Maharashtra, BankBazaar, ET BFSI | Bank of Baroda | Large PSU, BoB-like ~7.1-7.2 pricing. |
| Punjab & Sind Bank | 7.30%-10.70% | Punjab & Sind Bank, Paisabazaar, BankBazaar | Bank of India | Wide range to ~10.7% fits BoI's wide curve (cap 10.25) better than Central Bank (cap 9.30). |

## Private Banks

| New institution | Rate range | Sources | Mapped to lender | Reasoning |
|---|---:|---|---|---|
| IndusInd Bank | mainstream private, current card not clear | IndusInd, Paisabazaar, UrbanMoney | Axis Bank | Broad mainstream private curve, no sub-peer teaser. |
| Federal Bank | 7.30%-10.75% | Federal Bank, Paisabazaar, BankBazaar | Axis Bank | 7.30 start = Axis; broad private fit beats Kotak. |
| South Indian Bank | 7.20% onward | South Indian Bank, BankBazaar, Wishfin | Axis Bank | Old private bank, ~7.2 teaser approx. Axis benchmark. |
| City Union Bank | old-private, current card not clear | City Union Bank, BankBazaar, Wishfin | Axis Bank | Traditional private bank; Axis broad curve is the safest fit. |
| Karur Vysya Bank | 8.50% onward | KVB, BankBazaar, Wishfin | RBL Bank | 8.50 start sits in RBL's higher private band (8.20). |
| Karnataka Bank | 7.32%-12.31% | Karnataka Bank, BankBazaar, Wishfin | RBL Bank | Wide range with high cap matches RBL's higher-spread curve. |
| DCB Bank | around 8%+ | DCB Bank, CreditDharma, Wishfin | RBL Bank | Smaller private bank, risk/pricing near RBL. |
| Tamilnad Mercantile Bank | 8.80% onward | TMB, BankBazaar, Wishfin | RBL Bank | 8.80 start lands in RBL's higher private band. |
| CSB Bank | small-private, current card not clear | CSB Bank, Paisabazaar, Wishfin | RBL Bank | Small private bank, thin card; RBL higher band is safest. |
| Bandhan Bank | 8.41% onward | Bandhan Bank, BankBazaar, Paisabazaar | RBL Bank | 8.41 start matches RBL, not IDFC First's 7.75. |
| Dhanlaxmi Bank | 8.20% onward | Dhanlaxmi Bank, BankBazaar, Wishfin | RBL Bank | 8.20 start = RBL exactly. |
| Jammu & Kashmir Bank | 7.25% onward | J&K Bank, BankBazaar, Wishfin | Bank of Baroda | Govt-linked regional bank, prices like a PSU (BoB) not Union's flat curve. |
| Nainital Bank | 8.40% onward | Nainital Bank, Wishfin, CodeForBanks | Bank of Baroda | BoB subsidiary; PSU-parent pricing (public teaser runs a bit higher). |

## Small Finance Banks

| New institution | Rate range | Sources | Mapped to lender | Reasoning |
|---|---:|---|---|---|
| Utkarsh Small Finance Bank | home-loan card not reliably found | Utkarsh, CreditDharma, Paisabazaar | Ujjivan SFB | MFI-origin SFB, prices above AU. |
| Suryoday Small Finance Bank | home-loan card not reliably found | Suryoday, CreditDharma, Paisabazaar | Jana SFB | MFI-origin, higher-risk segment. |
| ESAF Small Finance Bank | home-loan card not reliably found | ESAF, CreditDharma, Paisabazaar | Jana SFB | MFI-origin inclusion lender. |
| Capital Small Finance Bank | home-loan card not reliably found | Capital SFB, CreditDharma, Paisabazaar | AU Small Finance Bank | Conventional secured-lending SFB, most bank-like, so AU (lowest). |
| Unity Small Finance Bank | home-loan card not reliably found | Unity, CreditDharma, Paisabazaar | Jana SFB | Newer SFB, higher band. |
| Shivalik Small Finance Bank | home-loan card not reliably found | Shivalik, CreditDharma, Paisabazaar | Jana SFB | Small community SFB. |
| North East Small Finance Bank | home-loan card not reliably found | NESFB, CreditDharma, Paisabazaar | Jana SFB | Small regional MFI-origin SFB. |
| Fincare Small Finance Bank | merged into AU SFB | AU Bank, Fincare legacy, RBI/news | AU Small Finance Bank | Fincare merged into AU; map directly to AU. |

## Housing Finance & NBFCs

| New institution | Rate range | Sources | Mapped to lender | Reasoning |
|---|---:|---|---|---|
| ICICI Home Finance | about 9.00% onward | ICICI HFC, Paisabazaar, BankBazaar | ICICI Bank | Same group; ~9% start aligns with ICICI Bank's upper bands. |
| Repco Home Finance | 9.50%-12.50% | Repco Home, BankBazaar, Paisabazaar | Aavas Financiers | 9.5-12.5 fits Aavas's affordable-prime curve, not sub-8% prime HFCs. |
| GIC Housing Finance | 8.75%-13.00% | GIC Housing, BankBazaar, Paisabazaar | Aavas Financiers | 8.75-13 range matches Aavas, well above LIC's prime curve. |
| Can Fin Homes | 8.00%-11.00% | Can Fin Homes, Paisabazaar, BankBazaar | LIC Housing Finance | Bank-sponsored prime HFC; cap 11 mirrors LIC. |
| India Shelter Finance | 10.50%/11.00% onward | India Shelter, Paisabazaar | Aavas Financiers | Affordable, informal-income, Aavas peer. |
| Aptus Value Housing Finance | 11.00%-18.00% | Aptus, BankBazaar, Paisabazaar | Aadhar Housing Finance | High-yield self-employed range fits Aadhar (11.75-16), not Aavas. |
| Shriram Housing Finance | 11.50% onward | Shriram Housing, BankBazaar, Paisabazaar | Aadhar Housing Finance | Affordable high-yield; Aadhar over Hinduja. |
| Vastu Housing Finance | 10.50%-18.00% | Vastu, BankBazaar, Paisabazaar | Home First Finance | Tech-led affordable, salaried/SE mix. |
| Motilal Oswal Home Finance | 11.50%-18.00% | Motilal Oswal HFC, BankBazaar, Paisabazaar | Aadhar Housing Finance | High-yield affordable; Aadhar over Hinduja. |
| Godrej Housing Finance | 7.65% onward | Godrej Capital, Paisabazaar | Bajaj Housing Finance | Prime digital HFC, low start, Bajaj peer. |
| Piramal Capital & Housing Finance | 9.99% onward | Piramal Finance, Paisabazaar | Sammaan Capital (Indiabulls) | Large NBFC/HFC, broad risk appetite; Sammaan over prime PNB Housing. |
| IIFL Home Finance | 8.75% onward | IIFL, BankBazaar, Paisabazaar | Sammaan Capital (Indiabulls) | 8.75 start = Sammaan; broad prime+affordable NBFC/HFC. |
| L&T Finance | 7.65%/7.75% onward | L&T Finance, Paisabazaar | Tata Capital | Large diversified prime NBFC. |
| Sundaram Home Finance | 8.75%-12.50% | Sundaram Home, BankBazaar, Paisabazaar | LIC Housing Finance | Conservative prime south HFC, near LIC. |
| Cent Bank Home Finance | 8.45%-13.15% | Cent Bank HFL, BankBazaar, Paisabazaar | PNB Housing Finance | Public-sector-bank-linked HFC, like PNB Housing. |
| SRG Housing Finance | 13.00%-20.00% | SRG Housing, BankBazaar | SK Finance | Smallest/highest-yield affordable; only SK's top band reaches it. |
| Manappuram Home Finance | 11.50%-19.00% | Manappuram Home Finance, BankBazaar, Paisabazaar | Muthoot Housing Finance | Gold-loan-group affordable HFC peer. |
| Poonawalla Fincorp | 8.75% onward | Poonawalla Fincorp, BankBazaar, Paisabazaar | Tata Capital | Prime digital NBFC; 8.75 fits Tata's mid, not Chola's 10.5. |
| Edelweiss Housing Finance | 9.50%-18.00% | Nido, BankBazaar, Paisabazaar | JM Financial Services | Mid-market NBFC/HFC. |
| Capri Global Housing Finance | 10.25%-18.00% | Capri Loans, BankBazaar, Paisabazaar | Cholamandalam Finance | MSME/affordable NBFC. |
| Star Housing Finance | 11.00%-18.00% | Star HFL, BankBazaar, Paisabazaar | Home First Finance | Small-ticket affordable, 11 start = Home First. |
| Altum Credo Home Finance | 11.50%-18.00% | Altum Credo, BankBazaar, Paisabazaar | Aadhar Housing Finance | Affordable informal-income, high-yield, so Aadhar over Aavas. |
| Five-Star Business Finance | 18.00%-26.00% secured business/LAP | Five-Star, aggregator pages | SK Finance | Highest-yield secured lender; SK is the closest top peer (still understates). |
| Bajaj Finance | 7.15%-10.65% via group home-loan channel | Bajaj Housing, Paisabazaar | Bajaj Housing Finance | Same group home-loan channel. |
| Aditya Birla Housing Finance | 8.60%-13.50% | Aditya Birla HFC, BankBazaar, Paisabazaar | PNB Housing Finance | Near-prime group HFC; 8.6 start above Bajaj Housing 7.25, PNB Housing fits. |
| Hero Housing Finance | 9.50%-16.00% | Hero Housing, BankBazaar, Paisabazaar | Hinduja Housing Finance | Affordable/semi-urban HFC. |
| SMFG India Credit | 10.00%-18.00% secured/home-adjacent | SMFG India Credit, BankBazaar, Paisabazaar | Cholamandalam Finance | Secured retail at 10-18 fits Chola, not prime Tata. |
| Hinduja Leyland Finance | 11.00%-18.00% secured property/business | Hinduja Leyland Finance, aggregator pages | Cholamandalam Finance | Vehicle/MSME diversified NBFC. |
| Nido Home Finance | 9.50%-18.00% | Nido, aggregator pages | JM Financial Services | Edelweiss/Nido home brand, mid HFC. |
| DMI Housing Finance | 10.50%-18.00% | DMI Housing Finance, aggregator pages | Hinduja Housing Finance | Affordable HFC, similar segment. |
| Vridhi Home Finance | 11.00%-18.00% | Vridhi, aggregator pages | Home First Finance | Small-ticket affordable. |
| Easy Home Finance | 8.99% onward | Easy Home Finance, Paisabazaar | Aavas Financiers | 8.99 start approx. Aavas 9.0, below Home First's 11. |
| Roha Housing Finance | 11.50%-18.00% | Roha Housing, aggregator pages | Aadhar Housing Finance | Affordable informal-income, high-yield. |
| Svatantra Micro Housing Finance | 12.00%-21.00% | Svatantra, aggregator pages | SK Finance | Micro/affordable, very high yield; SK's top band is closest. |
| Muthoot Fincorp | 12.00%-18.00% secured/home-adjacent | Muthoot Fincorp, Muthoot Housing, aggregator pages | Muthoot Housing Finance | Same group, rural-affordable DNA. |
| Shubham Housing Finance | 10.45%-19.10% floating | Shubham, Paisabazaar, BankBazaar | Aadhar Housing Finance | Affordable informal-income, high upper band. |
| Ummeed Housing Finance | 11.00%-18.00% | Ummeed, aggregator pages | Aadhar Housing Finance | Affordable, informal/self-employed. |
| Aviom India Housing Finance | 12.00%-18.00% | Aviom, aggregator pages | Aadhar Housing Finance | Women-led affordable small-ticket. |
| Mahindra Rural Housing Finance | 12.00%-17.00% | Mahindra Home Finance, aggregator pages | Aadhar Housing Finance | Rural affordable high-yield; Aadhar fits better than Aavas. |
| Indostar Home Finance | 10.50%-18.00% | Indostar HFC, aggregator pages | Cholamandalam Finance | NBFC/HFC MSME overlap. |
| Centrum Housing Finance | 10.50%-18.00% | Centrum Housing, aggregator pages | Hinduja Housing Finance | Mid/small affordable HFC. |
