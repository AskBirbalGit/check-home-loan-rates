/* =============================================================================
   savings.ts  —  EMI amortisation + switching-savings math.
   -----------------------------------------------------------------------------
   Ported verbatim from the v2 glue (js/app-v2.js, which mirrored js/savings.js).
   Two strategies when moving from `curRate` to a lower `newRate` on a loan with
   `P` outstanding over `years` remaining:
     - reduce-tenure: keep the OLD EMI at the NEW rate; the loan closes sooner.
     - reduce-EMI:    keep the SAME tenure, pay a lower EMI at the NEW rate.
============================================================================= */

export interface SavingsResult {
  rateCut: number;
  maxSaving: number;
  // reduce-EMI ("More Cash Monthly")
  reduceEmiTotal: number;
  monthlySave: number;
  emiNew: number;
  nMonths: number;
  // reduce-tenure ("Debt-Free Faster")
  reduceTenureTotal: number;
  monthsSaved: number;
  emiOld: number;
  nNew: number;
}

export function emi(P: number, r: number, n: number): number {
  if (r === 0) return P / n;
  const f = Math.pow(1 + r, n);
  return (P * r * f) / (f - 1);
}

// Indian-grouped integer rupees, e.g. 1234567 -> "12,34,567".
export function inr0(x: number): string {
  x = Math.round(x);
  const neg = x < 0;
  if (neg) x = -x;
  const s = x.toString();
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3);
  const out = rest ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + last3 : last3;
  return (neg ? "-" : "") + out;
}

export function fmtMonths(m: number): string {
  if (m <= 0) return "0 months";
  const y = Math.floor(m / 12);
  const mo = m % 12;
  const parts: string[] = [];
  if (y) parts.push(y + (y === 1 ? " yr" : " yrs"));
  if (mo) parts.push(mo + (mo === 1 ? " mo" : " mos"));
  return parts.join(" ");
}

// Compact "₹X.YY L" / "₹X.YY Cr" for the headline figures.
export function inrLakh(x: number): string {
  if (x >= 1e7) return "₹" + (x / 1e7).toFixed(2) + " Cr";
  return "₹" + (x / 1e5).toFixed(2) + " L";
}

// "3y 0m" style compact duration from a month count.
export function fmtYM(m: number): string {
  const y = Math.floor(m / 12);
  const mo = m % 12;
  return y + "y " + mo + "m";
}

// "17 Years 0 mo" verbose tenure from a month count.
export function fmtYearsMonths(m: number): string {
  const y = Math.floor(m / 12);
  const mo = m % 12;
  return y + (y === 1 ? " Year " : " Years ") + mo + " mo";
}

// Returns null when inputs are invalid for a switching comparison.
export function computeSavings(
  P: number,
  curRate: number,
  years: number,
  newRate: number
): SavingsResult | null {
  if (!(P > 0) || !(curRate > 0) || !(years > 0) || !(newRate > 0)) return null;
  if (newRate >= curRate) return null;

  const n = Math.round(years * 12);
  const rOld = curRate / 1200;
  const rNew = newRate / 1200;
  const emiOld = emi(P, rOld, n);
  const totalOld = emiOld * n;

  // Reduce-tenure: keep paying the OLD EMI at the NEW rate; loan closes sooner.
  const nNew = Math.ceil(-Math.log(1 - (P * rNew) / emiOld) / Math.log(1 + rNew));
  const reduceTenureTotal = totalOld - emiOld * nNew;
  const monthsSaved = n - nNew;

  // Reduce-EMI: keep the SAME tenure, pay a lower EMI at the NEW rate.
  const emiNew = emi(P, rNew, n);
  const monthlySave = emiOld - emiNew;
  const reduceEmiTotal = monthlySave * n;

  return {
    rateCut: curRate - newRate,
    maxSaving: Math.max(reduceTenureTotal, reduceEmiTotal),
    reduceEmiTotal,
    monthlySave,
    emiNew,
    nMonths: n,
    reduceTenureTotal,
    monthsSaved,
    emiOld,
    nNew,
  };
}
