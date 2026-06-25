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
// Ranks reflect approximate Indian home-loan disbursement scale; the unranked
// tail falls back to 999 and sorts alphabetically after the ranked lenders.
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
  // ── Long tail, continuing the disbursement-scale ordering ──
  "Punjab National Bank": 19,
  "Indian Bank": 20,
  "IndusInd Bank": 21,
  "Federal Bank": 22,
  "Indian Overseas Bank": 23,
  "Bank of Maharashtra": 24,
  "UCO Bank": 25,
  "Bajaj Finance": 26,
  "Aditya Birla Housing Finance": 27,
  "L&T Finance": 28,
  "Piramal Capital & Housing Finance": 29,
  "IIFL Home Finance": 30,
  "Can Fin Homes": 31,
  "Sundaram Home Finance": 32,
  "Godrej Housing Finance": 33,
  "Repco Home Finance": 34,
  "GIC Housing Finance": 35,
  "Sammaan Capital (Indiabulls)": 36,
  "Aavas Financiers": 37,
  "Bandhan Bank": 38,
  "Aadhar Housing Finance": 41,
  "Cholamandalam Finance": 42,
  "Home First Finance": 43,
  "India Shelter Finance": 44,
  "Muthoot Housing Finance": 47,
  "Hinduja Housing Finance": 48,
  "Poonawalla Fincorp": 49,
  "SMFG India Credit": 50,
  "Jammu & Kashmir Bank": 51,
  "South Indian Bank": 52,
  "Karur Vysya Bank": 53,
  "Karnataka Bank": 54,
  "City Union Bank": 55,
  "Punjab & Sind Bank": 56,
  "Ujjivan SFB": 57,
  "Jana SFB": 58,
  "Equitas SFB": 59,
  "Utkarsh Small Finance Bank": 60,
  "MAS Financial": 61,
  "JM Financial Services": 62,
  "Axis Finance": 63,
  "SK Finance": 64,
  "Motilal Oswal Home Finance": 66,
  "Hero Housing Finance": 67,
  "DCB Bank": 69,
  "CSB Bank": 70,
  "Tamilnad Mercantile Bank": 71,
  "Dhanlaxmi Bank": 72,
  "Suryoday Small Finance Bank": 73,
  "Capital Small Finance Bank": 75,
  "Shivalik Small Finance Bank": 78,
  "Nainital Bank": 80,
  "ICICI Home Finance": 81,
  "Cent Bank Home Finance": 82,
  "Edelweiss Housing Finance": 84,
  "Centrum Housing Finance": 91,
  "Nido Home Finance": 93,
  "Altum Credo Home Finance": 97,
  "Svatantra Micro Housing Finance": 98,
  "Easy Home Finance": 100,
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

  // ── Long tail ──
  "Punjab National Bank": ["pnb bank", "punjab national"],
  "Indian Bank": ["indian bank"],
  "Indian Overseas Bank": ["iob", "indian overseas"],
  "UCO Bank": ["uco"],
  "Bank of Maharashtra": ["mahabank", "boM", "maharashtra bank"],
  "Punjab & Sind Bank": ["punjab and sind", "psb bank", "punjab sind"],
  "IndusInd Bank": ["indusind", "indus ind"],
  "Federal Bank": ["federal"],
  "South Indian Bank": ["south indian", "sib"],
  "Karur Vysya Bank": ["karur", "kvb", "karur vysya"],
  "Karnataka Bank": ["karnataka", "ktk bank"],
  "City Union Bank": ["city union", "cub"],
  "DCB Bank": ["dcb", "development credit bank"],
  "Tamilnad Mercantile Bank": ["tmb", "tamilnad mercantile", "tamil nadu mercantile"],
  "CSB Bank": ["csb", "catholic syrian"],
  "Bandhan Bank": ["bandhan"],
  "Dhanlaxmi Bank": ["dhanlaxmi", "dhanlakshmi"],
  "Jammu & Kashmir Bank": ["j&k bank", "jk bank", "jammu and kashmir"],
  "Nainital Bank": ["nainital"],
  "Utkarsh Small Finance Bank": ["utkarsh", "utkarsh sfb"],
  "Suryoday Small Finance Bank": ["suryoday", "suryoday sfb"],
  "Capital Small Finance Bank": ["capital sfb", "capital small finance"],
  "Shivalik Small Finance Bank": ["shivalik", "shivalik sfb"],
  "ICICI Home Finance": ["icici home", "icici hfc"],
  "Repco Home Finance": ["repco"],
  "GIC Housing Finance": ["gic", "gic housing"],
  "Can Fin Homes": ["can fin", "canfin", "canfin homes"],
  "India Shelter Finance": ["india shelter"],
  "Motilal Oswal Home Finance": ["motilal", "motilal oswal", "aspire home"],
  "Godrej Housing Finance": ["godrej", "godrej housing"],
  "Piramal Capital & Housing Finance": ["piramal", "piramal housing", "dhfl"],
  "IIFL Home Finance": ["iifl", "iifl home", "india infoline"],
  "L&T Finance": ["l&t", "lnt finance", "l and t", "larsen"],
  "Sundaram Home Finance": ["sundaram", "sundaram home"],
  "Cent Bank Home Finance": ["cent bank", "centbank home"],
  "Poonawalla Fincorp": ["poonawalla", "magma"],
  "Edelweiss Housing Finance": ["edelweiss"],
  "Altum Credo Home Finance": ["altum", "altum credo"],
  "Bajaj Finance": ["bajaj finance"],
  "Aditya Birla Housing Finance": ["aditya birla", "abhfl", "birla housing"],
  "Hero Housing Finance": ["hero", "hero housing"],
  "SMFG India Credit": ["smfg", "fullerton", "sumitomo"],
  "Nido Home Finance": ["nido", "edelweiss housing"],
  "Easy Home Finance": ["easy home"],
  "Svatantra Micro Housing Finance": ["svatantra"],
  "Centrum Housing Finance": ["centrum"],
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
