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
import { ALL_BANKS, filterBanks, logoSlug, initials } from "@/lib/banks";
import {
  computeSavings,
  inr0,
  inrLakh,
  fmtMonths,
  fmtYM,
  fmtYearsMonths,
  type SavingsResult,
} from "@/lib/savings";

function cibilBandLabel(score: number): string {
  if (score >= 800) return "CIBIL 800+";
  if (score >= 750) return "CIBIL 750–799";
  if (score >= 700) return "CIBIL 700–749";
  return "CIBIL below 700";
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
  "Lower home loan rates are out there. Check yours above and see what you could save.";
const FOOTER_TRIMMED = "Lower home loan rates are out there. See what you could save.";

interface RateView {
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
  const [cibil, setCibil] = useState("810");

  // Bank combobox
  const defaultBank = ALL_BANKS.some((b) => b.name === "HDFC Bank")
    ? "HDFC Bank"
    : ALL_BANKS[0]?.name || "";
  const [committedBank, setCommittedBank] = useState(defaultBank);
  const [bankQuery, setBankQuery] = useState(defaultBank);
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
  const [savings, setSavings] = useState<SavingsResult | null>(null);

  const savingsInputRef = useRef<HTMLDivElement>(null);
  const savingsResultRef = useRef<HTMLDivElement>(null);

  // ── Box 1 -> Box 2 : check rates ───────────────────────────────────────────
  function runCheck() {
    const score = parseInt(cibil, 10);
    if (isNaN(score) || score < 650 || score > 850) {
      alert("Please enter a valid CIBIL score (650–850).");
      return;
    }
    const bankName = committedBank;
    const current = allLenders.find((l) => l.name === bankName);
    if (!current) return;

    const currentResult = rateFor(bankName, score, emp);
    const others = otherRates(bankName, score, emp, 3);

    setRateView({
      currentName: current.name,
      currentType: current.type,
      currentResult,
      others: others.map((o) => ({ name: o.name, result: o.result })),
      score,
      emp,
    });

    const best = bestRate(bankName, score, emp);
    setNewRate(best);
    setFooterText(FOOTER_TRIMMED);

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
    setSavings(null);

    const P = parseFloat(outstanding);
    const cur = parseFloat(curRate);
    const years = parseFloat(tenure);
    const nr = newRate != null ? Number(newRate) : NaN;

    if (!(P > 0) || !(cur > 0) || !(years > 0)) {
      setSavingsErr(
        "Please fill your current rate, remaining tenure and outstanding amount with valid values."
      );
      return;
    }
    if (!(nr > 0)) {
      setSavingsErr(
        "Check your rates first so we know the best rate available for your profile."
      );
      return;
    }
    if (nr >= cur) {
      setSavingsErr(
        "Your current rate is already at or below today's best fair rate for your profile. No switching savings to show."
      );
      return;
    }

    const result = computeSavings(P, cur, years, nr);
    if (!result) {
      setSavingsErr("Could not compute savings for those inputs.");
      return;
    }
    setSavings(result);
    requestAnimationFrame(() =>
      savingsResultRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })
    );
  }

  const empLabel = emp === "se" ? "Self-employed" : "Salaried";

  return (
    <div className="wrap">
      <header className="hero">
        <h1>Are you Paying the Right Home Loan Rate?</h1>
        <p className="sub">Birbal suggests the best interest rate for you in seconds.</p>
      </header>

      {/* BOX 1 — INPUTS */}
      <div className="box">
        <h2 className="box-head">Your details</h2>
        <section className="card input-bar">
          <div className="input-row">
            <label className="field">
              <span className="lbl">Bank name</span>
              <div className="combo" id="bankCombo" ref={comboRef}>
                <span
                  className={`combo-selected-logo${showSelLogo && committedBank ? "" : " hidden"}`}
                  aria-hidden="true"
                >
                  {showSelLogo && committedBank ? (
                    <BankLogo
                      name={committedBank}
                      size={22}
                      className=""
                      fbClassName="combo-logo-fb"
                    />
                  ) : null}
                </span>
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
                  placeholder="Search your bank"
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
                min={650}
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
              Check my rates
            </button>
          </div>
        </section>
      </div>

      {/* BOX 2 — RATE RESULTS */}
      {rateView && (
        <div className="box" id="resultsCard">
          <h2 className="box-head">Rates for your profile</h2>
          <section className="card results-card">
            <div className="results-split">
              <div className="rate-col">
                <h3>In current institutions</h3>
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
              <div className="rate-col">
                <h3>Similar institutions</h3>
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
                These are today&apos;s fair rates for your profile. If your current rate is
                higher, you can save on your home loan.
              </p>
              <button className="cta" id="savingsCta" onClick={openSavings}>
                Check my savings
              </button>
            </div>
          </section>
        </div>
      )}

      {/* BOX 3 — SAVINGS INPUTS */}
      {savingsOpen && (
        <div className="box" id="savingsInputCard" ref={savingsInputRef}>
          <h2 className="box-head">Additional loan details for savings</h2>
          <section className="card savings-input-card">
            <div className="save-newrate">
              New rate from your best profile match:{" "}
              <b id="saveNewRateVal">
                {newRate != null ? Number(newRate).toFixed(2) + "%" : "—"}
              </b>
            </div>
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
                  type="number"
                  min={1}
                  placeholder="e.g. 4000000"
                  value={outstanding}
                  onChange={(e) => setOutstanding(e.target.value)}
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
              <div id="savingsErr" className="err">
                {savingsErr}
              </div>
            )}
          </section>
        </div>
      )}

      {/* BOX 4 — SAVINGS RESULT */}
      {savings && (
        <div className="box" id="savingsResult" ref={savingsResultRef}>
          <h2 className="box-head">Savings on rate reduction</h2>
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
              {/* Reduce EMI, keep tenure */}
              <div className="sv-card sv-card-light">
                <span className="sv-badge">Reduce EMI Keeping Tenure Same</span>
                <h3 className="sv-title">More Cash Monthly</h3>
                <p className="sv-sub" id="svEmiSub">
                  Keep your {fmtMonths(savings.nMonths)} timeline, but reduce your monthly
                  out-of-pocket expense.
                </p>
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
                <div className="sv-facts">
                  <div className="sv-fact">
                    <span className="sv-fact-key">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M6 3h12M6 8h12M9 13l9 8M6 13h3a5 5 0 0 0 0-10" />
                      </svg>
                      EMI
                    </span>
                    <span className="sv-fact-val" id="svEmiEmi">
                      ₹{inr0(savings.emiNew)}
                    </span>
                  </div>
                  <div className="sv-fact">
                    <span className="sv-fact-key">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <circle cx="12" cy="12" r="9" />
                        <path d="M12 7v5l3 2" />
                      </svg>
                      Tenure
                    </span>
                    <span className="sv-fact-val" id="svEmiTenure">
                      {fmtMonths(savings.nMonths)} <em>(Same)</em>
                    </span>
                  </div>
                </div>
              </div>

              {/* Reduce tenure, keep EMI */}
              <div className="sv-card sv-card-dark">
                <span className="sv-badge">Reduce Tenure Keeping EMI Same</span>
                <h3 className="sv-title">Debt-Free Faster</h3>
                <p className="sv-sub" id="svTenureSub">
                  Keep paying your current EMI amount, and watch your loan vanish years
                  earlier.
                </p>
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
                <div className="sv-facts">
                  <div className="sv-fact">
                    <span className="sv-fact-key">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M6 3h12M6 8h12M9 13l9 8M6 13h3a5 5 0 0 0 0-10" />
                      </svg>
                      EMI
                    </span>
                    <span className="sv-fact-val" id="svTenureEmi">
                      ₹{inr0(savings.emiOld)} <em>(Same)</em>
                    </span>
                  </div>
                  <div className="sv-fact">
                    <span className="sv-fact-key">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <circle cx="12" cy="12" r="9" />
                        <path d="M12 7v5l3 2" />
                      </svg>
                      Tenure
                    </span>
                    <span className="sv-fact-val" id="svTenureTenure">
                      {fmtYearsMonths(savings.nNew)}
                    </span>
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
