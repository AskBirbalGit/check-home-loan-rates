/* =============================================================================
   data.js  —  Rate data + lookup engine   (OWNER: Agent 3)
   -----------------------------------------------------------------------------
   This module owns the CIBIL-wise rate dataset and the lookup logic.

   PUBLIC CONTRACT (do not change these signatures — app-v2.js depends
   on them):

     window.RateEngine = {
       lenders(): Array<{ name, type }>           // for the bank dropdown
       typeLabel(type): string                    // "PSB" -> "Public Sector Bank"

       // Core lookup. score is a CIBIL number, emp is "sal" | "se".
       // Returns a single numeric rate (averaged from the granular bucket per
       // Agent 3's spec) OR a {low, high} object — see `rateFor` doc below.
       rateFor(bankName, score, emp): RateResult

       // Convenience for display.
       formatRate(result): string                 // e.g. "7.03%" or "7.10–7.50%"

       // The 3 best alternative institutions for the profile, excluding `bankName`.
       // Each item: { name, type, result: RateResult, low: number }
       others(bankName, score, emp, count=3): Array<...>

       // Lowest available numeric rate across the on-screen options (current + others).
       // Used by app-v2.js to pre-fill the "new rate".
       bestRate(bankName, score, emp): number
     }

   RateResult is either:
     - a number (preferred, the averaged granular rate), or
     - { low: number, high: number } for legacy range display.
   Helpers below normalise both, so app-v2.js can stay agnostic.

   GRANULAR-AVERAGING ENGINE (10x granularity, single averaged rate)
   -----------------------------------------------------------------------------
   The source sheet gives each lender+employment four coarse CIBIL bands, each a
   rate RANGE like "7.50–8.00". We make the lookup 10x more granular and return a
   single AVERAGED number for the customer's exact score.

   CIBIL domain = 650–850, split into four 50-point bands (column selection
   thresholds unchanged from the original sheet):

       score >= 800  -> "800+"     band, CIBIL coverage [800, 850]
       score >= 750  -> "750–799"  band, CIBIL coverage [750, 800]
       score >= 700  -> "700–749"  band, CIBIL coverage [700, 750]
       else (<700)   -> "<700"     band, CIBIL coverage [650, 700]

   Within a band each side (CIBIL coverage and the rate range) is split into 10
   equal slices. A HIGHER CIBIL earns a LOWER (better) rate, so the slice index
   is inverted when mapping CIBIL -> rate step.

   Worked anchor (from the user): band CIBIL 750–800 with rate 7.00–7.50.
     - CIBIL slices of 5 pts: 750–755, 755–760, …, 795–800   (i = 0..9 bottom→top)
     - rate steps of 0.05:    [7.00,7.05], [7.05,7.10], …, [7.45,7.50]
     - Top CIBIL slice 795–800 (i = 9) maps to the LOWEST rate step [7.00,7.05],
       whose midpoint is 7.025.  ->  score 799 returns 7.025.  ✓
     Mapping: stepIndex = 9 - i  (i counts CIBIL slices from the bottom).
       rate = lo + (stepIndex + 0.5) * (hi - lo) / 10
       for i=9: stepIndex=0 -> 7.00 + 0.5*0.05 = 7.025.

   Single-value cells ("7.15") parse as lo == hi, so every slice averages to that
   same value. Trailing "+" cells ("8.85+", "9.00–20.00+") have the "+" stripped;
   single-value-with-plus becomes a flat value, range-with-plus uses its lo/hi as
   given (the "20.00+" outlier parses cleanly, it does not break anything).
============================================================================= */
(function () {
  "use strict";

  /* bands order: [800+ Sal, 800+ SE, 750-799 Sal, 750-799 SE,
                   700-749 Sal, 700-749 SE, <700 Sal, <700 SE] */
  const LENDERS = [
    { name: "SBI", type: "PSB", b: ["7.25–7.65","7.25–7.65","7.65–8.05","7.75–8.15","8.05–8.40","8.15–8.55","8.40–8.70","8.55–8.90"] },
    { name: "Bank of India", type: "PSB", b: ["7.10–7.50","7.10–7.50","7.50–8.00","7.60–8.10","8.00–8.50","8.10–8.65","8.50–10.00","8.65–10.25"] },
    { name: "Bank of Baroda", type: "PSB", b: ["7.20–7.60","7.20–7.60","7.60–8.10","7.70–8.20","8.10–8.60","8.20–8.70","8.60–9.10","8.70–9.20"] },
    { name: "Canara Bank", type: "PSB", b: ["7.15–7.55","7.15–7.55","7.55–8.00","7.65–8.15","8.00–8.50","8.15–8.65","8.50–10.00","8.65–10.25"] },
    { name: "Union Bank of India", type: "PSB", b: ["7.15","7.15","7.35","7.50","7.95","8.10","8.85+","9.00+"] },
    { name: "Central Bank of India", type: "PSB", b: ["7.10–7.50","7.10–7.50","7.50–7.90","7.60–8.00","7.90–8.30","8.00–8.45","8.30–9.15","8.45–9.30"] },
    { name: "ICICI Bank", type: "PVT", b: ["7.45–7.85","7.60–8.00","7.85–8.25","8.00–8.40","8.25–8.65","8.40–8.80","8.65–9.05+","8.80–9.20+"] },
    { name: "HDFC Bank", type: "PVT", b: ["7.15–7.55","7.30–7.70","7.55–7.95","7.70–8.10","7.95–8.35","8.10–8.50","8.35–8.75","8.50–8.90"] },
    { name: "Axis Bank", type: "PVT", b: ["7.30–7.70","7.45–7.85","7.70–8.10","7.85–8.25","8.10–8.50","8.25–8.65","8.50–8.90","8.65–9.05"] },
    { name: "Kotak Mahindra Bank", type: "PVT", b: ["7.60–7.70","7.60–7.80","7.70–8.00","7.80–8.10","8.00–8.50","8.10–8.60","8.50–9.25","8.60–9.50"] },
    { name: "IDFC First Bank", type: "PVT", b: ["7.75–8.10","7.90–8.25","8.00–8.40","8.10–8.50","8.40–9.00","8.50–9.25","9.00–10.00","9.25–10.25"] },
    { name: "Yes Bank", type: "PVT", b: ["9.00–9.40","9.15–9.55","9.40–9.80","9.55–9.95","9.80–10.20","9.95–10.35","10.20–10.60+","10.35–10.75+"] },
    { name: "RBL Bank", type: "PVT", b: ["8.20–8.60","8.35–8.75","8.60–9.00","8.75–9.15","9.00–9.40","9.15–9.55","9.40–9.80+","9.55–9.95+"] },
    { name: "AU Small Finance Bank", type: "SFB", b: ["8.25–8.65","8.50–8.90","8.65–9.05","8.90–9.30","9.05–9.45","9.30–9.70","9.45–9.85+","9.70–10.10+"] },
    { name: "Ujjivan SFB", type: "SFB", b: ["8.75–9.15","9.00–9.40","9.15–9.55","9.40–9.80","9.55–9.95","9.80–10.20","9.95–10.35+","10.20–10.60+"] },
    { name: "Jana SFB", type: "SFB", b: ["9.00–9.40","9.25–9.65","9.40–9.80","9.65–10.05","9.80–10.20","10.05–10.45","10.20–10.60+","10.45–10.85+"] },
    { name: "Equitas SFB", type: "SFB", b: ["9.00–9.40","9.25–9.65","9.40–9.80","9.65–10.05","9.80–10.20","10.05–10.45","10.20–10.60+","10.45–10.85+"] },
    { name: "Bajaj Housing Finance", type: "HFC", b: ["7.25–7.65","7.35–7.80","7.65–8.10","7.80–8.30","8.10–8.75","8.30–9.00","8.75–10.00+","9.00–20.00+"] },
    { name: "Tata Capital", type: "HFC", b: ["7.50–8.00","7.70–8.25","8.00–8.50","8.25–8.75","8.50–9.00","8.75–9.25","9.00–10.00+","9.25–10.00+"] },
    { name: "LIC Housing Finance", type: "HFC", b: ["7.15–7.55","7.50–7.90","7.55–8.00","7.90–8.40","8.00–8.50","8.40–8.90","8.50–9.50+","8.90–11.00+"] },
    { name: "PNB Housing Finance", type: "HFC", b: ["7.90–8.30","7.90–8.35","8.30–8.75","8.35–8.85","8.75–9.25","8.85–9.40","9.25–10.50+","9.40–12.00+"] },
    { name: "Sammaan Capital (Indiabulls)", type: "HFC", b: ["8.75–9.25","9.00–9.50","9.25–9.75","9.50–10.00","9.75–10.50","10.00–10.75","10.50–12.00+","10.75–12.50+"] },
    { name: "Muthoot Housing Finance", type: "HFC", b: ["11.25–11.75","12.50–13.00","11.75–12.25","13.00–13.50","12.25–12.75","13.50–14.00","12.75–14.00+","14.00–15.50+"] },
    { name: "Aavas Financiers", type: "HFC", b: ["9.00–9.75","9.50–10.25","9.75–10.50","10.25–11.00","10.50–11.25","11.00–11.75","11.25–13.00+","11.75–13.50+"] },
    { name: "Hinduja Housing Finance", type: "HFC", b: ["10.00–10.75","10.50–11.25","10.75–11.50","11.25–12.00","11.50–12.25","12.00–12.75","12.25–14.00+","12.75–14.50+"] },
    { name: "Home First Finance", type: "HFC", b: ["11.00–11.50","11.50–12.00","11.50–12.00","12.00–12.50","12.00–12.75","12.50–13.25","12.75–14.00+","13.25–14.50+"] },
    { name: "Aadhar Housing Finance", type: "HFC", b: ["11.75–12.25","12.25–12.75","12.25–12.75","12.75–13.25","12.75–13.50","13.25–14.00","13.50–15.00+","14.00–16.00+"] },
    { name: "Cholamandalam Finance", type: "HFC", b: ["10.50–11.00","10.75–11.25","11.00–11.75","11.25–12.00","11.75–12.50","12.00–12.75","12.50–14.00+","12.75–14.50+"] },
    { name: "SK Finance", type: "HFC", b: ["12.00–12.75","12.50–13.25","12.75–13.50","13.25–14.00","13.50–14.25","14.00–14.75","14.25–16.00+","14.75–17.00+"] },
    { name: "MAS Financial", type: "HFC", b: ["11.00–11.75","11.50–12.25","11.75–12.50","12.25–13.00","12.50–13.25","13.00–13.75","13.25–15.00+","13.75–15.50+"] },
    { name: "JM Financial Services", type: "HFC", b: ["10.00–10.75","10.50–11.25","10.75–11.50","11.25–12.00","11.50–12.25","12.00–12.75","12.25–13.50+","12.75–14.00+"] },
    { name: "Axis Finance", type: "HFC", b: ["10.25–10.75","10.50–11.00","10.75–11.50","11.00–11.75","11.50–12.25","11.75–12.50","12.25–13.75+","12.50–14.00+"] }
  ];

  const TYPE_LABEL = { PSB: "Public Sector Bank", PVT: "Private Bank", SFB: "Small Finance Bank", HFC: "Housing Finance Co." };

  // Number of granular slices within each band (10x granularity per the spec).
  const STEPS = 10;

  // Selects the band's base column index AND that band's CIBIL coverage [cMin, cMax].
  // Coverage spans the full 650–850 domain in four 50-point bands. Scores are
  // clamped sensibly at the edges: >=800 uses 800–850, <=650 uses 650–700.
  function bandFor(score) {
    if (score >= 800) return { col: 0, cMin: 800, cMax: 850 }; // "800+"
    if (score >= 750) return { col: 2, cMin: 750, cMax: 800 }; // "750–799"
    if (score >= 700) return { col: 4, cMin: 700, cMax: 750 }; // "700–749"
    return { col: 6, cMin: 650, cMax: 700 };                   // "<700"
  }

  // Parse a source cell into { lo, hi }. Handles:
  //   "7.50–8.00"  -> { lo: 7.5,  hi: 8.0 }   (range; en-dash or hyphen)
  //   "7.15"       -> { lo: 7.15, hi: 7.15 }  (single value)
  //   "8.85+"      -> { lo: 8.85, hi: 8.85 }  (single value, "+" stripped)
  //   "9.00–20.00+"-> { lo: 9.0,  hi: 20.0 }  (range, trailing "+" stripped)
  function parseCell(str) {
    const nums = String(str).match(/\d+(?:\.\d+)?/g) || [];
    const lo = nums.length ? parseFloat(nums[0]) : Infinity;
    const hi = nums.length > 1 ? parseFloat(nums[1]) : lo;
    return { lo, hi };
  }

  // The granular-averaging core. Given a score and a band [cMin, cMax] plus the
  // source rate range [lo, hi], return the midpoint of the single rate step the
  // score's CIBIL slice maps to. Higher score -> lower rate step.
  //   i        = CIBIL slice index from the BOTTOM of the band (0 = lowest scores)
  //   stepIndex= 9 - i  (invert: top CIBIL slice -> lowest/first rate step)
  //   rate     = lo + (stepIndex + 0.5) * (hi - lo) / STEPS
  // Anchor: band 750–800, rate 7.00–7.50, score 799 -> i=9 -> stepIndex=0
  //         -> 7.00 + 0.5 * 0.05 = 7.025.
  function averagedRate(score, cMin, cMax, lo, hi) {
    if (lo === hi) return round3(lo); // single-value cell: every slice is the same
    const span = cMax - cMin;
    const sliceSize = span / STEPS;
    // Clamp score into [cMin, cMax] then find slice index 0..STEPS-1 from bottom.
    const clamped = Math.min(Math.max(score, cMin), cMax);
    let i = Math.floor((clamped - cMin) / sliceSize);
    if (i >= STEPS) i = STEPS - 1; // score == cMax lands in the top slice
    if (i < 0) i = 0;
    const stepIndex = (STEPS - 1) - i;          // higher score -> lower rate
    const stepRate = (hi - lo) / STEPS;
    return round3(lo + (stepIndex + 0.5) * stepRate);
  }

  function round3(n) {
    return Math.round(n * 1000) / 1000;
  }

  function lowBound(str) {
    const m = String(str).match(/[\d.]+/);
    return m ? parseFloat(m[0]) : Infinity;
  }

  function rateFor(bankName, score, emp) {
    const l = LENDERS.find(x => x.name === bankName);
    if (!l) return null;
    const band = bandFor(score);
    const cell = l.b[band.col + (emp === "se" ? 1 : 0)];
    const { lo, hi } = parseCell(cell);
    return averagedRate(score, band.cMin, band.cMax, lo, hi); // single averaged number
  }

  function formatRate(result) {
    if (result == null) return "—";
    if (typeof result === "number") return result.toFixed(2) + "%";
    if (typeof result === "object") {
      return result.low === result.high
        ? result.low.toFixed(2) + "%"
        : result.low.toFixed(2) + "–" + result.high.toFixed(2) + "%";
    }
    return String(result) + "%"; // band string
  }

  // numeric "lowest" of any RateResult (number | {low,high} | string)
  function numericLow(result) {
    if (result == null) return Infinity;
    if (typeof result === "number") return result;
    if (typeof result === "object") return result.low;
    return lowBound(result);
  }

  function others(bankName, score, emp, count) {
    count = count || 3;
    return LENDERS
      .filter(l => l.name !== bankName)
      .map(l => {
        const r = rateFor(l.name, score, emp);
        return { name: l.name, type: l.type, result: r, low: numericLow(r) };
      })
      .sort((a, b) => a.low - b.low || a.name.localeCompare(b.name))
      .slice(0, count);
  }

  function bestRate(bankName, score, emp) {
    const cur = numericLow(rateFor(bankName, score, emp));
    const oth = others(bankName, score, emp).map(o => o.low);
    return Math.min(cur, ...oth);
  }

  window.RateEngine = {
    lenders: () => LENDERS.map(l => ({ name: l.name, type: l.type })),
    typeLabel: (t) => TYPE_LABEL[t] || t,
    rateFor,
    formatRate,
    numericLow,
    others,
    bestRate
  };
})();
