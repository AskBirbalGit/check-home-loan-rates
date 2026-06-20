/* =============================================================================
   banks.ts  —  Bank-picker support: disbursement ranking, search aliases, and
   logo/initials helpers.
   -----------------------------------------------------------------------------
   Ported from the v2 glue (js/app-v2.js). The picker opens to the biggest
   home-loan lenders first (DISBURSE_RANK), supports type-to-filter with common
   alternate spellings (ALIASES), and renders each lender's logo with an
   initials fallback. See decision 0004 for the hand-maintained ranking.
============================================================================= */
import { lenders, type LenderType } from "./rate-engine";

// Lower number = higher disbursement = shown first. Keyed by exact lender name.
const DISBURSE_RANK: Record<string, number> = {
  SBI: 1,
  "HDFC Bank": 2,
  "LIC Housing Finance": 3,
  "ICICI Bank": 4,
  "Bank of Baroda": 5,
  "PNB Housing Finance": 6,
  "Axis Bank": 7,
  "Kotak Mahindra Bank": 8,
  "Bajaj Housing Finance": 9,
  "Canara Bank": 10,
  "Union Bank of India": 11,
  "Bank of India": 12,
  "Central Bank of India": 13,
  "Tata Capital": 14,
  "IDFC First Bank": 15,
  "Yes Bank": 16,
  "AU Small Finance Bank": 17,
  "RBL Bank": 18,
};

// Alternate names / expansions people type for a lender. Matching is on the
// lender name PLUS any of these strings (all lowercased, substring).
const ALIASES: Record<string, string[]> = {
  SBI: ["state bank of india", "state bank"],
  "HDFC Bank": ["hdfc", "housing development finance"],
  "ICICI Bank": ["icici"],
  "Axis Bank": ["axis", "uti bank"],
  "Kotak Mahindra Bank": ["kotak", "kotak bank", "kotak mahindra"],
  "Bank of Baroda": ["bob", "baroda"],
  "Bank of India": ["boi"],
  "Union Bank of India": ["union bank", "ubi"],
  "Central Bank of India": ["central bank", "cbi"],
  "Canara Bank": ["canara"],
  "IDFC First Bank": ["idfc", "idfc first", "idfc bank"],
  "Yes Bank": ["yes"],
  "RBL Bank": ["rbl", "ratnakar bank"],
  "AU Small Finance Bank": ["au bank", "au sfb", "au small finance"],
  "Ujjivan SFB": ["ujjivan", "ujjivan small finance"],
  "Jana SFB": ["jana", "jana small finance"],
  "Equitas SFB": ["equitas", "equitas small finance"],
  "Bajaj Housing Finance": ["bajaj", "bajaj finance", "bajaj housing", "bajaj hfc"],
  "Tata Capital": ["tata", "tata housing", "tata capital housing"],
  "LIC Housing Finance": ["lic", "lic hf", "lichfl", "lic housing"],
  "PNB Housing Finance": ["pnb", "pnb housing", "punjab national bank housing"],
  "Sammaan Capital (Indiabulls)": ["indiabulls", "indiabulls housing", "sammaan", "ihfl"],
  "Muthoot Housing Finance": ["muthoot", "muthoot housing"],
  "Aavas Financiers": ["aavas"],
  "Hinduja Housing Finance": ["hinduja"],
  "Home First Finance": ["home first", "hffc", "homefirst"],
  "Aadhar Housing Finance": ["aadhar", "aadhar housing"],
  "Cholamandalam Finance": ["chola", "cholamandalam", "chola finance"],
  "SK Finance": ["sk", "sk finance"],
  "MAS Financial": ["mas", "mas financial"],
  "JM Financial Services": ["jm", "jm financial"],
  "Axis Finance": ["axis finance"],
};

export interface BankOption {
  name: string;
  type: LenderType;
  rank: number;
  haystack: string;
}

// Full lender list ordered for the dropdown: by disbursement rank, then
// alphabetically for the unranked tail. Each carries a lowercased haystack
// (name + aliases) for fast filtering.
export const ALL_BANKS: BankOption[] = lenders()
  .map((l) => {
    const aliases = ALIASES[l.name] || [];
    return {
      name: l.name,
      type: l.type,
      rank: DISBURSE_RANK[l.name] || 999,
      haystack: (l.name + " " + aliases.join(" ")).toLowerCase(),
    };
  })
  .sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name));

export function filterBanks(query: string): BankOption[] {
  const q = (query || "").trim().toLowerCase();
  return q ? ALL_BANKS.filter((b) => b.haystack.includes(q)) : ALL_BANKS;
}

export function logoSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function initials(name: string): string {
  return name
    .replace(/\([^)]*\)/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}
