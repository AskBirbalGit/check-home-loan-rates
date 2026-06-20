/* =============================================================================
   rate-engine.ts  —  Rate data + lookup engine
   -----------------------------------------------------------------------------
   Ported verbatim (algorithm-wise) from the original static js/data.js so the
   numbers stay identical. This module owns the CIBIL-wise rate dataset and the
   granular-averaging lookup logic; the React UI consumes it as a plain library.

   GRANULAR-AVERAGING ENGINE (10x granularity, single averaged rate)
   -----------------------------------------------------------------------------
   The source sheet gives each lender+employment four coarse CIBIL bands, each a
   rate RANGE like "7.50–8.00". We make the lookup 10x more granular and return a
   single AVERAGED number for the customer's exact score.

   CIBIL domain = 650–850, split into four 50-point bands:

       score >= 800  -> "800+"     band, CIBIL coverage [800, 850]
       score >= 750  -> "750–799"  band, CIBIL coverage [750, 800]
       score >= 700  -> "700–749"  band, CIBIL coverage [700, 750]
       else (<700)   -> "<700"     band, CIBIL coverage [650, 700]

   Within a band each side (CIBIL coverage + rate range) is split into 10 equal
   slices. A HIGHER CIBIL earns a LOWER (better) rate, so the slice index is
   inverted when mapping CIBIL -> rate step. Single-value cells parse as lo==hi;
   trailing "+" cells have the "+" stripped.
============================================================================= */

export type EmploymentType = "sal" | "se";
export type LenderType = "PSB" | "PVT" | "SFB" | "HFC";

export interface Lender {
  name: string;
  type: LenderType;
  /* bands order: [800+ Sal, 800+ SE, 750-799 Sal, 750-799 SE,
                   700-749 Sal, 700-749 SE, <700 Sal, <700 SE] */
  b: string[];
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
  { name: "Union Bank of India", type: "PSB", b: ["7.15", "7.15", "7.35", "7.50", "7.95", "8.10", "8.85+", "9.00+"] },
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
  { name: "Bajaj Housing Finance", type: "HFC", b: ["7.25–7.65", "7.35–7.80", "7.65–8.10", "7.80–8.30", "8.10–8.75", "8.30–9.00", "8.75–10.00+", "9.00–20.00+"] },
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
];

const TYPE_LABEL: Record<string, string> = {
  PSB: "Public Sector Bank",
  PVT: "Private Bank",
  SFB: "Small Finance Bank",
  HFC: "Housing Finance Co.",
};

// Number of granular slices within each band (10x granularity per the spec).
const STEPS = 10;

// Selects the band's base column index AND that band's CIBIL coverage [cMin, cMax].
function bandFor(score: number): { col: number; cMin: number; cMax: number } {
  if (score >= 800) return { col: 0, cMin: 800, cMax: 850 }; // "800+"
  if (score >= 750) return { col: 2, cMin: 750, cMax: 800 }; // "750–799"
  if (score >= 700) return { col: 4, cMin: 700, cMax: 750 }; // "700–749"
  return { col: 6, cMin: 650, cMax: 700 }; // "<700"
}

// Parse a source cell into { lo, hi }.
function parseCell(str: string): { lo: number; hi: number } {
  const nums = String(str).match(/\d+(?:\.\d+)?/g) || [];
  const lo = nums.length ? parseFloat(nums[0] as string) : Infinity;
  const hi = nums.length > 1 ? parseFloat(nums[1] as string) : lo;
  return { lo, hi };
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

// The granular-averaging core. Higher score -> lower rate step.
function averagedRate(score: number, cMin: number, cMax: number, lo: number, hi: number): number {
  if (lo === hi) return round3(lo); // single-value cell: every slice is the same
  const span = cMax - cMin;
  const sliceSize = span / STEPS;
  const clamped = Math.min(Math.max(score, cMin), cMax);
  let i = Math.floor((clamped - cMin) / sliceSize);
  if (i >= STEPS) i = STEPS - 1; // score == cMax lands in the top slice
  if (i < 0) i = 0;
  const stepIndex = STEPS - 1 - i; // higher score -> lower rate
  const stepRate = (hi - lo) / STEPS;
  return round3(lo + (stepIndex + 0.5) * stepRate);
}

function lowBound(str: string): number {
  const m = String(str).match(/[\d.]+/);
  return m ? parseFloat(m[0]) : Infinity;
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
  const band = bandFor(score);
  const cell = l.b[band.col + (emp === "se" ? 1 : 0)] as string;
  const { lo, hi } = parseCell(cell);
  return averagedRate(score, band.cMin, band.cMax, lo, hi);
}

export function formatRate(result: number | null): string {
  if (result == null) return "—";
  return result.toFixed(2) + "%";
}

export function numericLow(result: number | null): number {
  if (result == null) return Infinity;
  return result;
}

export function others(
  bankName: string,
  score: number,
  emp: EmploymentType,
  count = 3
): OtherRate[] {
  return LENDERS.filter((l) => l.name !== bankName)
    .map((l) => {
      const r = rateFor(l.name, score, emp);
      return { name: l.name, type: l.type, result: r, low: numericLow(r) };
    })
    .sort((a, b) => a.low - b.low || a.name.localeCompare(b.name))
    .slice(0, count);
}

export function bestRate(bankName: string, score: number, emp: EmploymentType): number {
  const cur = numericLow(rateFor(bankName, score, emp));
  const oth = others(bankName, score, emp).map((o) => o.low);
  return Math.min(cur, ...oth);
}

// Re-export the lowBound helper in case future callers need raw-string parsing.
export { lowBound };
