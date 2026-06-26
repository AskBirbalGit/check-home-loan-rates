"use client";

/* =============================================================================
   Calculator.tsx  —  The full stacked-box flow (ported from index-v2.html +
   js/app-v2.js into a single React client component).

     Box 1  inputs  ->  Box 2  rates  ->  Box 3  savings inputs  ->  Box 4 result

   Behaviour parity with the old static page: searchable disbursement-ranked bank
   combobox (type-to-filter + aliases + logo chip), CIBIL/employment inputs,
   rate lookup via lib/rate-engine, and the two-strategy switching savings via
   lib/savings. The journey-aware footer nudge and Enter-to-submit are preserved.
============================================================================= */

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  lenders,
  rateFor,
  formatRate,
  typeLabel,
  others as otherRates,
  bestRate,
  type EmploymentType,
} from "@/lib/rate-engine";
import { filterBanks, logoSlug, initials } from "@/lib/banks";
import {
  computeSavings,
  inr0,
  inrLakh,
  fmtYM,
  type SavingsResult,
} from "@/lib/savings";
import { logRateCheck, logSavings } from "@/lib/leads";

function cibilBandLabel(score: number): string {
  if (score >= 800) return "CIBIL 800+";
  if (score >= 750) return "CIBIL 750–799";
  if (score >= 700) return "CIBIL 700–749";
  if (score >= 650) return "CIBIL below 700";
  return "CIBIL 600–649";
}

function formatIndianNumberInput(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  const last3 = digits.slice(-3);
  const rest = digits.slice(0, -3);
  return rest ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + last3 : last3;
}

/* Logo chip with an initials fallback if the PNG is missing (mirrors the old
   inline <img onerror>). */
function BankLogo({
  name,
  size,
  className,
  fbClassName,
}: {
  name: string;
  size: number;
  className: string;
  fbClassName: string;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return <span className={fbClassName}>{initials(name)}</span>;
  }
  return (
    <span className={className}>
      {/* Static logos under public/logos; plain <img> keeps the markup parity
          with the original and avoids next/image config for tiny chips. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/logos/${logoSlug(name)}.png`}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        onError={() => setFailed(true)}
      />
    </span>
  );
}

const FOOTER_FULL =
  "Most borrowers pay more than they need to. Check your rate above and see what you could save.";
const FOOTER_TRIMMED = "Lower home loan rates are out there. See what you could save.";

interface RateView {
  hasBank: boolean;
  currentName: string;
  currentType: string;
  currentResult: number | null;
  others: { name: string; result: number | null }[];
  score: number;
  emp: EmploymentType;
}

export default function Calculator() {
  const allLenders = useMemo(() => lenders(), []);

  // ── Box 1 inputs ──────────────────────────────────────────────────────────
  const [emp, setEmp] = useState<EmploymentType>("sal");
  const [cibil, setCibil] = useState("");

  // Bank combobox
  const [committedBank, setCommittedBank] = useState("");
  const [bankQuery, setBankQuery] = useState("");
  const [listOpen, setListOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [showSelLogo, setShowSelLogo] = useState(true);
  const comboRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // The visible list: full ranked list when the query equals the committed
  // bank (i.e. freshly opened) or is empty, else the filtered matches.
  const matches = useMemo(() => {
    const q = bankQuery === committedBank ? "" : bankQuery;
    return filterBanks(q);
  }, [bankQuery, committedBank]);

  const commitBank = useCallback((name: string) => {
    setCommittedBank(name);
    setBankQuery(name);
    setShowSelLogo(true);
    setListOpen(false);
    setActiveIdx(-1);
  }, []);

  const focusBank = useCallback(() => {
    setBankQuery(""); // clear so typing starts fresh; committed stays safe
    setShowSelLogo(false);
    setListOpen(true);
    setActiveIdx(-1);
  }, []);

  // Click-away: close + restore the committed value/logo.
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (comboRef.current && !comboRef.current.contains(e.target as Node)) {
        setBankQuery(committedBank);
        setShowSelLogo(true);
        setListOpen(false);
        setActiveIdx(-1);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [committedBank]);

  function onBankInput(value: string) {
    setBankQuery(value);
    setShowSelLogo(false);
    setListOpen(true);
    setActiveIdx(-1);
  }

  function onBankKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!listOpen) {
        focusBank();
        return;
      }
      if (!matches.length) return;
      setActiveIdx((prev) =>
        e.key === "ArrowDown"
          ? (prev + 1) % matches.length
          : (prev - 1 + matches.length) % matches.length
      );
    } else if (e.key === "Enter") {
      if (listOpen && activeIdx >= 0 && matches[activeIdx]) {
        e.preventDefault();
        commitBank(matches[activeIdx].name);
      } else {
        e.preventDefault();
        setBankQuery(committedBank);
        setShowSelLogo(true);
        setListOpen(false);
        setActiveIdx(-1);
        runCheck();
      }
    } else if (e.key === "Escape") {
      setListOpen(false);
      setActiveIdx(-1);
    }
  }

  // Keep the highlighted option scrolled into view.
  useEffect(() => {
    if (activeIdx < 0) return;
    const el = document.getElementById(`bankOpt${activeIdx}`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIdx]);

  // ── Results + savings state ────────────────────────────────────────────────
  const [rateView, setRateView] = useState<RateView | null>(null);
  const [newRate, setNewRate] = useState<number | null>(null);
  const [footerText, setFooterText] = useState(FOOTER_FULL);
  const [footerHidden, setFooterHidden] = useState(false);

  const [savingsOpen, setSavingsOpen] = useState(false);
  const [curRate, setCurRate] = useState("");
  const [tenure, setTenure] = useState("");
  const [outstanding, setOutstanding] = useState("");
  const [savingsErr, setSavingsErr] = useState("");
  const [savingsErrTone, setSavingsErrTone] = useState<"error" | "ok">("error");
  const [savings, setSavings] = useState<SavingsResult | null>(null);

  const savingsInputRef = useRef<HTMLDivElement>(null);
  const savingsResultRef = useRef<HTMLDivElement>(null);

  // ── Box 1 -> Box 2 : check rates ───────────────────────────────────────────
  function runCheck() {
    const score = parseInt(cibil, 10);
    if (isNaN(score) || score < 600 || score > 850) {
      alert("Please enter a valid CIBIL score (600–850).");
      return;
    }
    const bankName = committedBank;
    const current = bankName
      ? allLenders.find((l) => l.name === bankName)
      : undefined;
    // Bank is optional. If they picked one we couldn't resolve, bail; but an
    // empty selection is fine — we just suggest the best rates for the profile.
    if (bankName && !current) return;

    const hasBank = Boolean(current);
    const currentResult = current ? rateFor(bankName, score, emp) : null;
    // With no current bank, `others` falls back to the global cheapest lenders.
    // Show 4 suggestions in that case so the column doesn't look thin without a
    // "your current bank" panel beside it.
    const others = otherRates(bankName, score, emp, hasBank ? 3 : 4);

    setRateView({
      hasBank,
      currentName: current?.name ?? "",
      currentType: current?.type ?? "",
      currentResult,
      others: others.map((o) => ({ name: o.name, result: o.result })),
      score,
      emp,
    });

    const best = bestRate(bankName, score, emp);
    setNewRate(best);
    setFooterText(FOOTER_TRIMMED);

    // Log the rate check (Box 1 inputs + Box 2 result). Fire-and-forget.
    void logRateCheck({
      bankName: bankName || null,
      cibil: score,
      employment: emp,
      currentRateShown: currentResult,
      bestRate: best,
    });

    // A fresh rate check resets any prior savings output/inputs.
    setSavingsOpen(false);
    setSavings(null);
    setSavingsErr("");
  }

  // ── Box 2 -> Box 3 : reveal savings inputs ─────────────────────────────────
  function openSavings() {
    setSavingsOpen(true);
    setFooterHidden(true);
    requestAnimationFrame(() =>
      savingsInputRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })
    );
  }

  // ── Box 3 -> Box 4 : compute + render savings ──────────────────────────────
  function runSavings() {
    setSavingsErr("");
    setSavingsErrTone("error");
    setSavings(null);

    const P = parseFloat(outstanding.replace(/,/g, ""));
    const cur = parseFloat(curRate);
    const years = parseFloat(tenure);
    const nr = newRate != null ? Number(newRate) : NaN;

    if (!(P > 0) || !(cur > 0) || !(years > 0)) {
      setSavingsErr(
        "Add your current rate, remaining tenure, and outstanding amount to see your savings."
      );
      return;
    }
    if (!(nr > 0)) {
      setSavingsErr(
        "Check your rate first so we know the best rate for your profile."
      );
      return;
    }
    if (nr >= cur) {
      setSavingsErrTone("ok");
      setSavingsErr(
        "👏 Well done! You've already got the best rate for your profile."
      );
      return;
    }

    const result = computeSavings(P, cur, years, nr);
    if (!result) {
      setSavingsErr("We couldn't calculate savings from those numbers. Double-check the values and try again.");
      return;
    }
    setSavings(result);
    requestAnimationFrame(() =>
      savingsResultRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })
    );

    // Log the savings step (Box 3 inputs + Box 4 result) onto the same row.
    void logSavings({
      currentRateInput: cur,
      tenureYears: years,
      outstanding: P,
      rateCut: result.rateCut,
      maxSaving: result.maxSaving,
    });
  }

  const empLabel = emp === "se" ? "Self-employed" : "Salaried";

  return (
    <div className="wrap">
      <div className="brandbar">
        {/* eslint-disable-next-line @next/next/no-img-element -- static brand
            lockup; plain <img> keeps markup parity with the bank logos */}
        <img className="brandbar-logo" src="/brand-logo.png" alt="Birbal" />
      </div>
      <header className="hero">
        <h1>Are You Paying the Right Home Loan Rate?</h1>
        <p className="sub">Birbal suggests the best interest rate for you in seconds.</p>
      </header>

      {/* BOX 1 — INPUTS */}
      <div className="box">
        <h2 className="box-head">Your details</h2>
        <section className="card input-bar">
          <div className="input-row">
            <label className="field">
                <span className="lbl">Your bank name</span>
              <div className="combo" id="bankCombo" ref={comboRef}>
                {showSelLogo && committedBank ? (
                  <span className="combo-selected-logo" aria-hidden="true">
                    <BankLogo
                      name={committedBank}
                      size={22}
                      className=""
                      fbClassName="combo-logo-fb"
                    />
                  </span>
                ) : null}
                <input
                  id="bankInput"
                  ref={inputRef}
                  type="text"
                  className="combo-input"
                  role="combobox"
                  aria-expanded={listOpen}
                  aria-controls="bankList"
                  aria-autocomplete="list"
                  aria-activedescendant={
                    activeIdx >= 0 ? `bankOpt${activeIdx}` : undefined
                  }
                  autoComplete="off"
                  placeholder="Search your current bank"
                  value={bankQuery}
                  onFocus={focusBank}
                  onClick={focusBank}
                  onChange={(e) => onBankInput(e.target.value)}
                  onKeyDown={onBankKeyDown}
                />
                <ul
                  className={`combo-list${listOpen ? "" : " hidden"}`}
                  id="bankList"
                  role="listbox"
                  aria-label="Banks"
                >
                  {matches.length === 0 ? (
                    <li className="combo-empty" role="presentation">
                      No banks match &quot;{bankQuery}&quot;
                    </li>
                  ) : (
                    matches.map((b, i) => (
                      <li
                        key={b.name}
                        className="combo-opt"
                        role="option"
                        id={`bankOpt${i}`}
                        aria-selected={i === activeIdx}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          commitBank(b.name);
                        }}
                      >
                        <BankLogo
                          name={b.name}
                          size={22}
                          className="combo-logo"
                          fbClassName="combo-logo-fb"
                        />
                        <span className="combo-name">{b.name}</span>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            </label>

            <label className="field">
              <span className="lbl">CIBIL score</span>
              <input
                id="cibil"
                type="number"
                min={600}
                max={850}
                value={cibil}
                placeholder="e.g. 810"
                onChange={(e) => setCibil(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    runCheck();
                  }
                }}
              />
            </label>

            <label className="field">
              <span className="lbl">Employment type</span>
              <div className="seg" id="empSeg">
                <button
                  type="button"
                  className={emp === "sal" ? "active" : ""}
                  onClick={() => setEmp("sal")}
                >
                  Salaried
                </button>
                <button
                  type="button"
                  className={emp === "se" ? "active" : ""}
                  onClick={() => setEmp("se")}
                >
                  Self-employed
                </button>
              </div>
            </label>

            <button className="cta" id="checkBtn" onClick={runCheck}>
              Show my fair rate
            </button>
          </div>
        </section>
      </div>

      {/* BOX 2 — RATE RESULTS */}
      {rateView && (
        <div className="box" id="resultsCard">
          <h2 className="box-head">The fair rate for your profile</h2>
          <section className="card results-card">
            <div className={`results-split${rateView.hasBank ? "" : " results-split--single"}`}>
              {rateView.hasBank && (
                <div className="rate-col">
                  <h3>Your current bank</h3>
                  <div id="currentRate">
                    <div className="rate-row current">
                      <BankLogo
                        name={rateView.currentName}
                        size={36}
                        className="bank-logo"
                        fbClassName="bank-logo-fallback"
                      />
                      <div className="bank">
                        {rateView.currentName}
                        <small>
                          {typeLabel(rateView.currentType)} ·{" "}
                          {cibilBandLabel(rateView.score)} · {empLabel}
                        </small>
                      </div>
                      <div className="rate">{formatRate(rateView.currentResult)}</div>
                    </div>
                  </div>
                </div>
              )}
              <div className="rate-col">
                <h3>
                  {rateView.hasBank
                    ? "Better-priced lenders"
                    : "Best rates for your profile"}
                </h3>
                {!rateView.hasBank && (
                  <p className="rate-col-sub">
                    {cibilBandLabel(rateView.score)} · {empLabel}
                  </p>
                )}
                <div id="otherRates">
                  {rateView.others.map((o) => (
                    <div className="rate-row" key={o.name}>
                      <BankLogo
                        name={o.name}
                        size={36}
                        className="bank-logo"
                        fbClassName="bank-logo-fallback"
                      />
                      <div className="bank">{o.name}</div>
                      <div className="rate">{formatRate(o.result)}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="results-foot">
              <p className="foot-note">
                These are today&apos;s fair rates for your profile. Paying more? See what
                you could save.
                <span
                  className="rate-note"
                  tabIndex={0}
                  role="button"
                  aria-label="How these rates are determined"
                >
                  <span className="rate-note-star" aria-hidden="true">
                    *
                  </span>
                  <span className="rate-note-pop" role="tooltip">
                    <span className="rate-note-li">
                      Rates come from our own market research and direct bank contacts.
                    </span>
                    <span className="rate-note-li">
                      Private banks tend to avoid cases below a 700 CIBIL score.
                    </span>
                    <span className="rate-note-li">
                      Smaller loans (under &#8377;10 lakh) often see better approval odds
                      with NBFCs and HFCs.
                    </span>
                  </span>
                </span>
              </p>
              <button className="cta" id="savingsCta" onClick={openSavings}>
                Show my savings
              </button>
            </div>
          </section>
        </div>
      )}

      {/* BOX 3 — SAVINGS INPUTS */}
      {savingsOpen && (
        <div className="box" id="savingsInputCard" ref={savingsInputRef}>
          <h2 className="box-head">Your loan details for savings.</h2>
          <section className="card savings-input-card">
            <div className="savings-input-row">
              <label className="field">
                <span className="lbl">Your current rate (%)</span>
                <input
                  id="curRate"
                  type="number"
                  step="0.01"
                  min={1}
                  placeholder="e.g. 8.60"
                  value={curRate}
                  onChange={(e) => setCurRate(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      runSavings();
                    }
                  }}
                />
              </label>
              <label className="field">
                <span className="lbl">Remaining tenure (years)</span>
                <input
                  id="tenure"
                  type="number"
                  min={1}
                  max={35}
                  placeholder="e.g. 18"
                  value={tenure}
                  onChange={(e) => setTenure(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      runSavings();
                    }
                  }}
                />
              </label>
              <label className="field">
                <span className="lbl">Outstanding amount (₹)</span>
                <input
                  id="outstanding"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9,]*"
                  placeholder="e.g. 40,00,000"
                  value={outstanding}
                  onChange={(e) => setOutstanding(formatIndianNumberInput(e.target.value))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      runSavings();
                    }
                  }}
                />
              </label>
              <button className="cta" id="calcSavingsBtn" onClick={runSavings}>
                Show my savings
              </button>
            </div>
            {savingsErr && (
              <div
                id="savingsErr"
                className={savingsErrTone === "ok" ? "err err--ok" : "err"}
              >
                {savingsErr}
              </div>
            )}
          </section>
        </div>
      )}

      {/* BOX 4 — SAVINGS RESULT */}
      {savings && (
        <div className="box" id="savingsResult" ref={savingsResultRef}>
          <h2 className="box-head">Here&apos;s what switching saves you</h2>
          <section className="savings-result-stage">
            <div className="sv-hero" id="svHero">
              <div className="sv-hero-line">
                A{" "}
                <span id="svRateCut">
                  {savings.rateCut.toFixed(2).replace(/\.?0+$/, "") + "%"}
                </span>{" "}
                Interest Rate Cut =
              </div>
              <div className="sv-hero-amt">
                <span id="svHeroAmt">{inrLakh(savings.maxSaving)}</span> Saved.
              </div>
            </div>

            <div className="sv-cards">
              {/* Reduce tenure, keep EMI */}
              <div className="sv-card sv-card-dark">
                <h3 className="sv-title">Debt-Free Faster</h3>
                <p className="sv-sub">Reduce Tenure, Keep EMI Same</p>
                <div className="sv-metric">
                  <div className="sv-metric-label">Total Saved</div>
                  <div className="sv-metric-val" id="svTenureTotal">
                    {inrLakh(savings.reduceTenureTotal)}
                  </div>
                </div>
                <div className="sv-metric">
                  <div className="sv-metric-label">Time Saved</div>
                  <div className="sv-metric-val" id="svTenureTime">
                    {fmtYM(savings.monthsSaved)} <small>earlier</small>
                  </div>
                </div>
              </div>

              {/* Reduce EMI, keep tenure */}
              <div className="sv-card sv-card-light">
                <h3 className="sv-title">More Cash Monthly</h3>
                <p className="sv-sub">Reduce EMI, Keep Tenure Same</p>
                <div className="sv-metric">
                  <div className="sv-metric-label">Total Saved</div>
                  <div className="sv-metric-val" id="svEmiTotal">
                    {inrLakh(savings.reduceEmiTotal)}
                  </div>
                </div>
                <div className="sv-metric">
                  <div className="sv-metric-label">Monthly Savings</div>
                  <div className="sv-metric-val" id="svEmiMonthly">
                    ₹{inr0(savings.monthlySave)} <small>/ mo</small>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      <footer
        className={`disc${footerHidden ? " hidden" : ""}`}
        id="discFooter"
      >
        {footerText}
      </footer>
    </div>
  );
}
