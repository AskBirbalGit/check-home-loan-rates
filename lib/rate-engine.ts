/* =============================================================================
   rate-engine.ts  —  Rate data + lookup engine
   -----------------------------------------------------------------------------
   Ported verbatim (algorithm-wise) from the original static js/data.js so the
   numbers stay identical. This module owns the CIBIL-wise rate dataset and the
   granular-averaging lookup logic; the React UI consumes it as a plain library.

   SPREAD-ALLOCATION CURVE (per-lender spread, fixed score→fraction curve)
   -----------------------------------------------------------------------------
   Each lender+employment is reduced to just TWO numbers from its source sheet:

       R_min = the LOW of the "800+" cell   (best rate the lender offers)
       R_max = the HIGH of the "<700" cell  (worst rate; trailing "+" stripped)
       S     = R_max - R_min                 (the lender's full rate spread)

   The customer's exact CIBIL score (clamped to 600–850) maps to a CUMULATIVE
   FRACTION of that spread via a fixed, lender-agnostic curve. The curve is
   intentionally NON-LINEAR: it stays nearly flat at the top (so 800+ profiles
   cluster near R_min) and steepens sharply below 750, matching how lenders
   price risk band-wise rather than smoothly.

       score 850 -> f = 0.00                                  (best rate, R_min)
       score 800 -> f = 0.03    ( >800  band carries  3% of the spread)
       score 775 -> f = 0.10    (775-800 band carries  7% of the spread)
       score 750 -> f = 0.20    (750-775 band carries 10% of the spread)
       score 700 -> f = 0.40    (700-750 band carries 20% of the spread)
       score 600 -> f = 1.00    (600-700 band carries 60% of the spread)

   `f` interpolates LINEARLY between adjacent knots, so the curve is continuous
   (kinked at each knot, not stepped). The published 750-799 / 700-749 mid-band
   rate values are NOT used — only the two endpoints anchor the spread.

   The rate is computed RAW and rounded only at the very end:
       raw  = R_min + f * S          (no rounding inside the curve)
       rate = floor to lower 0.05    (e.g. 7.19 -> 7.15, 7.16 -> 7.15)
   Single-value cells parse as lo==hi; trailing "+" cells have the "+" stripped.
============================================================================= */

export type EmploymentType = "sal" | "se";
export type LenderType = "PSB" | "PVT" | "SFB" | "HFC";

export interface Lender {
  name: string;
  type: LenderType;
  /* bands order: [800+ Sal, 800+ SE, 750-799 Sal, 750-799 SE,
                   700-749 Sal, 700-749 SE, <700 Sal, <700 SE]
     Optional: a lender with no own bands can `mirror` another lender by name,
     inheriting that lender's rate cells (see resolveBands). */
  b?: string[];
  /* Name of an existing lender whose bands this lender inherits. Used for the
     long tail of institutions we don't have first-party rate sheets for: each
     is mapped to the closest comparable lender (same type/tier), which in
     practice price very similarly. */
  mirror?: string;
}

export interface OtherRate {
  name: string;
  type: LenderType;
  result: number | null;
  low: number;
}

const LENDERS: Lender[] = [
  { name: "SBI", type: "PSB", b: ["7.25–7.65", "7.25–7.65", "7.65–8.05", "7.75–8.15", "8.05–8.40", "8.15–8.55", "8.40–8.70", "8.55–8.90"] },
  { name: "Bank of India", type: "PSB", b: ["7.10–7.50", "7.10–7.50", "7.50–8.00", "7.60–8.10", "8.00–8.50", "8.10–8.65", "8.50–10.00", "8.65–10.25"] },
  { name: "Bank of Baroda", type: "PSB", b: ["7.20–7.60", "7.20–7.60", "7.60–8.10", "7.70–8.20", "8.10–8.60", "8.20–8.70", "8.60–9.10", "8.70–9.20"] },
  { name: "Canara Bank", type: "PSB", b: ["7.15–7.55", "7.15–7.55", "7.55–8.00", "7.65–8.15", "8.00–8.50", "8.15–8.65", "8.50–10.00", "8.65–10.25"] },
  { name: "Union Bank of India", type: "PSB", b: ["7.15–7.55", "7.15–7.55", "7.55–8.00", "7.65–8.15", "8.00–8.50", "8.15–8.65", "8.50–10.00", "8.65–10.25"] },
  { name: "Central Bank of India", type: "PSB", b: ["7.10–7.50", "7.10–7.50", "7.50–7.90", "7.60–8.00", "7.90–8.30", "8.00–8.45", "8.30–9.15", "8.45–9.30"] },
  { name: "ICICI Bank", type: "PVT", b: ["7.45–7.85", "7.60–8.00", "7.85–8.25", "8.00–8.40", "8.25–8.65", "8.40–8.80", "8.65–9.05+", "8.80–9.20+"] },
  { name: "HDFC Bank", type: "PVT", b: ["7.15–7.55", "7.30–7.70", "7.55–7.95", "7.70–8.10", "7.95–8.35", "8.10–8.50", "8.35–8.75", "8.50–8.90"] },
  { name: "Axis Bank", type: "PVT", b: ["7.30–7.70", "7.45–7.85", "7.70–8.10", "7.85–8.25", "8.10–8.50", "8.25–8.65", "8.50–8.90", "8.65–9.05"] },
  { name: "Kotak Mahindra Bank", type: "PVT", b: ["7.60–7.70", "7.60–7.80", "7.70–8.00", "7.80–8.10", "8.00–8.50", "8.10–8.60", "8.50–9.25", "8.60–9.50"] },
  { name: "IDFC First Bank", type: "PVT", b: ["7.75–8.10", "7.90–8.25", "8.00–8.40", "8.10–8.50", "8.40–9.00", "8.50–9.25", "9.00–10.00", "9.25–10.25"] },
  { name: "Yes Bank", type: "PVT", b: ["9.00–9.40", "9.15–9.55", "9.40–9.80", "9.55–9.95", "9.80–10.20", "9.95–10.35", "10.20–10.60+", "10.35–10.75+"] },
  { name: "RBL Bank", type: "PVT", b: ["8.20–8.60", "8.35–8.75", "8.60–9.00", "8.75–9.15", "9.00–9.40", "9.15–9.55", "9.40–9.80+", "9.55–9.95+"] },
  { name: "AU Small Finance Bank", type: "SFB", b: ["8.25–8.65", "8.50–8.90", "8.65–9.05", "8.90–9.30", "9.05–9.45", "9.30–9.70", "9.45–9.85+", "9.70–10.10+"] },
  { name: "Ujjivan SFB", type: "SFB", b: ["8.75–9.15", "9.00–9.40", "9.15–9.55", "9.40–9.80", "9.55–9.95", "9.80–10.20", "9.95–10.35+", "10.20–10.60+"] },
  { name: "Jana SFB", type: "SFB", b: ["9.00–9.40", "9.25–9.65", "9.40–9.80", "9.65–10.05", "9.80–10.20", "10.05–10.45", "10.20–10.60+", "10.45–10.85+"] },
  { name: "Equitas SFB", type: "SFB", b: ["9.00–9.40", "9.25–9.65", "9.40–9.80", "9.65–10.05", "9.80–10.20", "10.05–10.45", "10.20–10.60+", "10.45–10.85+"] },
  { name: "Bajaj Housing Finance", type: "HFC", b: ["7.25–7.65", "7.35–7.80", "7.65–8.10", "7.80–8.30", "8.10–8.75", "8.30–9.00", "8.75–10.00+", "9.00–11.00"] },
  { name: "Tata Capital", type: "HFC", b: ["7.50–8.00", "7.70–8.25", "8.00–8.50", "8.25–8.75", "8.50–9.00", "8.75–9.25", "9.00–10.00+", "9.25–10.00+"] },
  { name: "LIC Housing Finance", type: "HFC", b: ["7.15–7.55", "7.50–7.90", "7.55–8.00", "7.90–8.40", "8.00–8.50", "8.40–8.90", "8.50–9.50+", "8.90–11.00+"] },
  { name: "PNB Housing Finance", type: "HFC", b: ["7.90–8.30", "7.90–8.35", "8.30–8.75", "8.35–8.85", "8.75–9.25", "8.85–9.40", "9.25–10.50+", "9.40–12.00+"] },
  { name: "Sammaan Capital (Indiabulls)", type: "HFC", b: ["8.75–9.25", "9.00–9.50", "9.25–9.75", "9.50–10.00", "9.75–10.50", "10.00–10.75", "10.50–12.00+", "10.75–12.50+"] },
  { name: "Muthoot Housing Finance", type: "HFC", b: ["11.25–11.75", "12.50–13.00", "11.75–12.25", "13.00–13.50", "12.25–12.75", "13.50–14.00", "12.75–14.00+", "14.00–15.50+"] },
  { name: "Aavas Financiers", type: "HFC", b: ["9.00–9.75", "9.50–10.25", "9.75–10.50", "10.25–11.00", "10.50–11.25", "11.00–11.75", "11.25–13.00+", "11.75–13.50+"] },
  { name: "Hinduja Housing Finance", type: "HFC", b: ["10.00–10.75", "10.50–11.25", "10.75–11.50", "11.25–12.00", "11.50–12.25", "12.00–12.75", "12.25–14.00+", "12.75–14.50+"] },
  { name: "Home First Finance", type: "HFC", b: ["11.00–11.50", "11.50–12.00", "11.50–12.00", "12.00–12.50", "12.00–12.75", "12.50–13.25", "12.75–14.00+", "13.25–14.50+"] },
  { name: "Aadhar Housing Finance", type: "HFC", b: ["11.75–12.25", "12.25–12.75", "12.25–12.75", "12.75–13.25", "12.75–13.50", "13.25–14.00", "13.50–15.00+", "14.00–16.00+"] },
  { name: "Cholamandalam Finance", type: "HFC", b: ["10.50–11.00", "10.75–11.25", "11.00–11.75", "11.25–12.00", "11.75–12.50", "12.00–12.75", "12.50–14.00+", "12.75–14.50+"] },
  { name: "SK Finance", type: "HFC", b: ["12.00–12.75", "12.50–13.25", "12.75–13.50", "13.25–14.00", "13.50–14.25", "14.00–14.75", "14.25–16.00+", "14.75–17.00+"] },
  { name: "MAS Financial", type: "HFC", b: ["11.00–11.75", "11.50–12.25", "11.75–12.50", "12.25–13.00", "12.50–13.25", "13.00–13.75", "13.25–15.00+", "13.75–15.50+"] },
  { name: "JM Financial Services", type: "HFC", b: ["10.00–10.75", "10.50–11.25", "10.75–11.50", "11.25–12.00", "11.50–12.25", "12.00–12.75", "12.25–13.50+", "12.75–14.00+"] },
  { name: "Axis Finance", type: "HFC", b: ["10.25–10.75", "10.50–11.00", "10.75–11.50", "11.00–11.75", "11.50–12.25", "11.75–12.50", "12.25–13.75+", "12.50–14.00+"] },

  /* ── Long tail (mirrored) ──────────────────────────────────────────────
     The institutions below carry NO first-party rate sheet of their own; each
     `mirror`s the closest comparable lender (same type + tier) above, since
     institutions in the same bracket price very similarly. Rates resolve via
     resolveBands(). Ordered to round the picker out to the top ~100 lenders. */

  // Public-sector banks -> priced like their PSB peers.
  { name: "Punjab National Bank", type: "PSB", mirror: "SBI" },
  { name: "Indian Bank", type: "PSB", mirror: "Canara Bank" },
  { name: "Indian Overseas Bank", type: "PSB", mirror: "Bank of India" },
  { name: "UCO Bank", type: "PSB", mirror: "Central Bank of India" },
  { name: "Bank of Maharashtra", type: "PSB", mirror: "Bank of Baroda" },
  { name: "Punjab & Sind Bank", type: "PSB", mirror: "Bank of India" },

  // Private banks -> priced like their private peers.
  { name: "IndusInd Bank", type: "PVT", mirror: "Axis Bank" },
  { name: "Federal Bank", type: "PVT", mirror: "Axis Bank" },
  { name: "South Indian Bank", type: "PVT", mirror: "Axis Bank" },
  { name: "Karur Vysya Bank", type: "PVT", mirror: "RBL Bank" },
  { name: "Karnataka Bank", type: "PVT", mirror: "RBL Bank" },
  { name: "City Union Bank", type: "PVT", mirror: "Axis Bank" },
  { name: "DCB Bank", type: "PVT", mirror: "RBL Bank" },
  { name: "Tamilnad Mercantile Bank", type: "PVT", mirror: "RBL Bank" },
  { name: "CSB Bank", type: "PVT", mirror: "RBL Bank" },
  { name: "Bandhan Bank", type: "PVT", mirror: "RBL Bank" },
  { name: "Dhanlaxmi Bank", type: "PVT", mirror: "RBL Bank" },
  { name: "Jammu & Kashmir Bank", type: "PVT", mirror: "Bank of Baroda" },
  { name: "Nainital Bank", type: "PVT", mirror: "Bank of Baroda" },

  // Small finance banks -> priced like the SFB peers.
  { name: "Utkarsh Small Finance Bank", type: "SFB", mirror: "Ujjivan SFB" },
  { name: "Suryoday Small Finance Bank", type: "SFB", mirror: "Jana SFB" },
  { name: "ESAF Small Finance Bank", type: "SFB", mirror: "Jana SFB" },
  { name: "Capital Small Finance Bank", type: "SFB", mirror: "AU Small Finance Bank" },
  { name: "Unity Small Finance Bank", type: "SFB", mirror: "Jana SFB" },
  { name: "Shivalik Small Finance Bank", type: "SFB", mirror: "Jana SFB" },
  { name: "North East Small Finance Bank", type: "SFB", mirror: "Jana SFB" },
  { name: "Fincare Small Finance Bank", type: "SFB", mirror: "AU Small Finance Bank" },

  // Housing-finance cos + NBFCs -> priced like the closest HFC/NBFC above.
  { name: "ICICI Home Finance", type: "HFC", mirror: "ICICI Bank" },
  { name: "Repco Home Finance", type: "HFC", mirror: "Aavas Financiers" },
  { name: "GIC Housing Finance", type: "HFC", mirror: "Aavas Financiers" },
  { name: "Can Fin Homes", type: "HFC", mirror: "LIC Housing Finance" },
  { name: "India Shelter Finance", type: "HFC", mirror: "Aavas Financiers" },
  { name: "Aptus Value Housing Finance", type: "HFC", mirror: "Aadhar Housing Finance" },
  { name: "Shriram Housing Finance", type: "HFC", mirror: "Aadhar Housing Finance" },
  { name: "Vastu Housing Finance", type: "HFC", mirror: "Home First Finance" },
  { name: "Motilal Oswal Home Finance", type: "HFC", mirror: "Aadhar Housing Finance" },
  { name: "Godrej Housing Finance", type: "HFC", mirror: "Bajaj Housing Finance" },
  { name: "Piramal Capital & Housing Finance", type: "HFC", mirror: "Sammaan Capital (Indiabulls)" },
  { name: "IIFL Home Finance", type: "HFC", mirror: "Sammaan Capital (Indiabulls)" },
  { name: "L&T Finance", type: "HFC", mirror: "Tata Capital" },
  { name: "Sundaram Home Finance", type: "HFC", mirror: "LIC Housing Finance" },
  { name: "Cent Bank Home Finance", type: "HFC", mirror: "PNB Housing Finance" },
  { name: "SRG Housing Finance", type: "HFC", mirror: "SK Finance" },
  { name: "Manappuram Home Finance", type: "HFC", mirror: "Muthoot Housing Finance" },
  { name: "Poonawalla Fincorp", type: "HFC", mirror: "Tata Capital" },
  { name: "Edelweiss Housing Finance", type: "HFC", mirror: "JM Financial Services" },
  { name: "Capri Global Housing Finance", type: "HFC", mirror: "Cholamandalam Finance" },
  { name: "Star Housing Finance", type: "HFC", mirror: "Home First Finance" },
  { name: "Altum Credo Home Finance", type: "HFC", mirror: "Aadhar Housing Finance" },
  { name: "Five-Star Business Finance", type: "HFC", mirror: "SK Finance" },
  { name: "Bajaj Finance", type: "HFC", mirror: "Bajaj Housing Finance" },
  { name: "Aditya Birla Housing Finance", type: "HFC", mirror: "PNB Housing Finance" },
  { name: "Hero Housing Finance", type: "HFC", mirror: "Hinduja Housing Finance" },
  { name: "SMFG India Credit", type: "HFC", mirror: "Cholamandalam Finance" },
  { name: "Hinduja Leyland Finance", type: "HFC", mirror: "Cholamandalam Finance" },
  { name: "Nido Home Finance", type: "HFC", mirror: "JM Financial Services" },
  { name: "DMI Housing Finance", type: "HFC", mirror: "Hinduja Housing Finance" },
  { name: "Vridhi Home Finance", type: "HFC", mirror: "Home First Finance" },
  { name: "Easy Home Finance", type: "HFC", mirror: "Aavas Financiers" },
  { name: "Roha Housing Finance", type: "HFC", mirror: "Aadhar Housing Finance" },
  { name: "Svatantra Micro Housing Finance", type: "HFC", mirror: "SK Finance" },
  { name: "Muthoot Fincorp", type: "HFC", mirror: "Muthoot Housing Finance" },
  { name: "Shubham Housing Finance", type: "HFC", mirror: "Aadhar Housing Finance" },
  { name: "Ummeed Housing Finance", type: "HFC", mirror: "Aadhar Housing Finance" },
  { name: "Aviom India Housing Finance", type: "HFC", mirror: "Aadhar Housing Finance" },
  { name: "Mahindra Rural Housing Finance", type: "HFC", mirror: "Aadhar Housing Finance" },
  { name: "Indostar Home Finance", type: "HFC", mirror: "Cholamandalam Finance" },
  { name: "Centrum Housing Finance", type: "HFC", mirror: "Hinduja Housing Finance" },
];

const TYPE_LABEL: Record<string, string> = {
  PSB: "Public Sector Bank",
  PVT: "Private Bank",
  SFB: "Small Finance Bank",
  HFC: "Housing Finance Co.",
};

// The non-linear spread-allocation curve: CIBIL score -> cumulative fraction of
// the lender's spread (0 = best/R_min, 1 = worst/R_max). Knots are ordered
// HIGH score -> LOW score. `f` interpolates linearly between adjacent knots.
//   850:0.00  800:0.03  775:0.10  750:0.20  700:0.40  600:1.00
const CURVE: { score: number; f: number }[] = [
  { score: 850, f: 0.0 },
  { score: 800, f: 0.03 },
  { score: 775, f: 0.1 },
  { score: 750, f: 0.2 },
  { score: 700, f: 0.4 },
  { score: 600, f: 1.0 },
];

// Map a CIBIL score to its raw cumulative spread fraction (no rounding here).
// Score is clamped to the [600, 850] curve domain.
function curveFraction(score: number): number {
  const s = Math.min(Math.max(score, 600), 850);
  for (let i = 0; i < CURVE.length - 1; i++) {
    const hi = CURVE[i] as { score: number; f: number }; // higher score, lower f
    const lo = CURVE[i + 1] as { score: number; f: number }; // lower score, higher f
    if (s <= hi.score && s >= lo.score) {
      const t = (hi.score - s) / (hi.score - lo.score); // 0 at hi.score → 1 at lo.score
      return hi.f + t * (lo.f - hi.f);
    }
  }
  return (CURVE[CURVE.length - 1] as { f: number }).f;
}

// Parse a source cell into { lo, hi }.
function parseCell(str: string): { lo: number; hi: number } {
  const nums = String(str).match(/\d+(?:\.\d+)?/g) || [];
  const lo = nums.length ? parseFloat(nums[0] as string) : Infinity;
  const hi = nums.length > 1 ? parseFloat(nums[1] as string) : lo;
  return { lo, hi };
}

// Floor a raw rate DOWN to the lower 0.05 percentage-point display increment
// (e.g. 7.19 -> 7.15, 7.16 -> 7.15, 7.20 -> 7.20). Applied ONLY as the final
// display step, never inside the curve math.
function roundToRateStep(n: number): number {
  return Math.round(Math.floor(n * 20 + 1e-9) / 20 * 100) / 100;
}

function lowBound(str: string): number {
  const m = String(str).match(/[\d.]+/);
  return m ? parseFloat(m[0]) : Infinity;
}

// Resolve a lender's rate cells, following a `mirror` chain to the closest
// comparable lender when the lender has no own bands. Guards against cycles.
function resolveBands(l: Lender, seen: Set<string> = new Set()): string[] | null {
  if (l.b) return l.b;
  if (!l.mirror || seen.has(l.name)) return null;
  seen.add(l.name);
  const src = LENDERS.find((x) => x.name === l.mirror);
  return src ? resolveBands(src, seen) : null;
}

export function lenders(): { name: string; type: LenderType }[] {
  return LENDERS.map((l) => ({ name: l.name, type: l.type }));
}

export function typeLabel(t: string): string {
  return TYPE_LABEL[t] || t;
}

export function rateFor(bankName: string, score: number, emp: EmploymentType): number | null {
  const l = LENDERS.find((x) => x.name === bankName);
  if (!l) return null;
  const bands = resolveBands(l);
  if (!bands) return null;
  const off = emp === "se" ? 1 : 0;
  // R_min = low of the "800+" cell; R_max = high of the "<700" cell.
  const rMin = parseCell(bands[0 + off] as string).lo;
  const rMax = parseCell(bands[6 + off] as string).hi;
  const spread = rMax - rMin;
  // Raw rate from the curve; round to nearest 0.05 only at the very end.
  const raw = rMin + curveFraction(score) * spread;
  return roundToRateStep(raw);
}

export function formatRate(result: number | null): string {
  if (result == null) return "—";
  return result.toFixed(2) + "%";
}

export function numericLow(result: number | null): number {
  if (result == null) return Infinity;
  return result;
}

// Lender hierarchy, best (cheapest tier) → worst:
//   PSU (PSB) > Private (PVT) > Small Finance Bank (SFB) > NBFC/HFC (HFC).
// A customer in a given tier can realistically move within their tier, and
// has a slimmer chance at a better tier. So suggestions are tier-aware: two
// same-tier options + one "stretch" option from a better tier (decision 0008).
//
// The stretch slot can draw from MORE THAN ONE candidate tier, and we take the
// single cheapest lender across those candidates ("whichever is lower"):
//   HFC → SFB or PVT      SFB → PVT or HFC      PVT → PSB      PSB → (none)
// HFC and SFB each get a same-tier-adjacent and a cross-tier candidate so the
// stretch row is genuinely the best realistic alternative, not a fixed rung.
const STRETCH_TIERS: Record<LenderType, LenderType[]> = {
  PSB: [],
  PVT: ["PSB"],
  SFB: ["PVT", "HFC"],
  HFC: ["SFB", "PVT"],
};

function stretchTiers(type: LenderType): LenderType[] {
  return STRETCH_TIERS[type];
}

export function others(
  bankName: string,
  score: number,
  emp: EmploymentType,
  count = 3
): OtherRate[] {
  const current = LENDERS.find((l) => l.name === bankName);
  const currentType = current?.type;

  // Eligible pool: every first-party lender except the current bank.
  // Mirrored lenders are excluded so we never surface a duplicate-rate row
  // (e.g. PNB mirrors SBI and would show SBI's exact number).
  const pool: OtherRate[] = LENDERS.filter((l) => l.name !== bankName && !l.mirror)
    .map((l) => {
      const r = rateFor(l.name, score, emp);
      return { name: l.name, type: l.type, result: r, low: numericLow(r) };
    })
    .sort((a, b) => a.low - b.low || a.name.localeCompare(b.name));

  // No identifiable current type → fall back to the global cheapest.
  if (!currentType) return pool.slice(0, count);

  const stretch = stretchTiers(currentType);
  const sameTierPicks = pool.filter((o) => o.type === currentType);
  // Candidate stretch lenders across all stretch tiers, cheapest-first
  // ("whichever is lower" rate wins, regardless of which tier it came from).
  const stretchPicks = stretch.length
    ? pool.filter((o) => stretch.includes(o.type))
    : [];

  const picks: OtherRate[] = [];
  const taken = new Set<string>();
  const take = (o: OtherRate | undefined) => {
    if (o && !taken.has(o.name)) {
      picks.push(o);
      taken.add(o.name);
    }
  };

  if (!stretch.length) {
    // Top tier (PSB): no better tier exists, so fill all slots same-tier.
    for (const o of sameTierPicks) {
      if (picks.length >= count) break;
      take(o);
    }
  } else {
    // Two same-tier, then one stretch option (cheapest across stretch tiers).
    const sameWanted = Math.max(count - 1, 0);
    for (const o of sameTierPicks) {
      if (picks.length >= sameWanted) break;
      take(o);
    }
    take(stretchPicks[0]);
  }

  // Top up from the rest of the pool (cheapest-first) if a tier ran short,
  // so the column always renders `count` rows.
  for (const o of pool) {
    if (picks.length >= count) break;
    take(o);
  }

  // Display order is cheapest-first regardless of tier grouping.
  return picks
    .slice(0, count)
    .sort((a, b) => a.low - b.low || a.name.localeCompare(b.name));
}

export function bestRate(bankName: string, score: number, emp: EmploymentType): number {
  const cur = numericLow(rateFor(bankName, score, emp));
  const oth = others(bankName, score, emp).map((o) => o.low);
  return Math.min(cur, ...oth);
}

// Re-export the lowBound helper in case future callers need raw-string parsing.
export { lowBound };
