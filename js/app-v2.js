/* =============================================================================
   app-v2.js  —  Page glue for the stacked layout (index-v2.html)
   -----------------------------------------------------------------------------
   index-v2.html lays the flow out as four stacked full-width boxes:

     Box 1  inputs  ->  Box 2  rates  ->  Box 3  savings inputs  ->  Box 4 result

   Unlike app.js + savings.js (which mount the savings UI into a container), here
   the savings markup lives directly in the HTML, so this single file wires both
   the rate lookup and the savings math. It reuses window.RateEngine (js/data.js)
   unchanged; the savings amortisation is the same logic as js/savings.js.
============================================================================= */
(function () {
  "use strict";

  let emp = "sal";
  let ctx = { bestRate: null, profileLabel: "" };

  /* ── Disbursement ranking ──────────────────────────────────────────────────
     The picker opens to the biggest home-loan lenders first, ordered by rough
     annual disbursement scale in the Indian market (public-domain figures: SBI
     and HDFC dominate originations, followed by LIC HF / ICICI / BoB / PNB HF /
     Axis / Kotak / Bajaj …). Lower number = higher disbursement = shown first.
     Lenders not listed fall to the end, then sort alphabetically. This is a hand-
     maintained ordering, not live data — see decision 0004. Keyed by the exact
     RateEngine lender name. */
  const DISBURSE_RANK = {
    "SBI": 1,
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
    "RBL Bank": 18
  };

  /* ── Search aliases ─────────────────────────────────────────────────────────
     Alternate names / expansions people type for a lender, so "state bank of
     india" finds SBI, "indiabulls" finds Sammaan Capital, etc. Matching is on
     the lender name PLUS any of these strings (all lowercased, substring). */
  const ALIASES = {
    "SBI": ["state bank of india", "state bank"],
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
    "Axis Finance": ["axis finance"]
  };

  /* Full lender list ordered for the dropdown: by disbursement rank, then
     alphabetically for the unranked tail. Each carries a lowercased haystack
     (name + aliases) for fast filtering. */
  const ALL_BANKS = RateEngine.lenders()
    .map(l => {
      const aliases = ALIASES[l.name] || [];
      return {
        name: l.name,
        type: l.type,
        rank: DISBURSE_RANK[l.name] || 999,
        haystack: (l.name + " " + aliases.join(" ")).toLowerCase()
      };
    })
    .sort((a, b) => (a.rank - b.rank) || a.name.localeCompare(b.name));

  /* ── Searchable bank combobox ──────────────────────────────────────────────
     #bankInput is the visible type-to-filter field; #bank (hidden) holds the
     committed lender name the rest of the glue reads via bankSel.value. */
  const bankSel = document.getElementById("bank");        // hidden, holds chosen name
  const bankInput = document.getElementById("bankInput"); // visible search box
  const bankList = document.getElementById("bankList");   // dropdown <ul>
  const bankCombo = document.getElementById("bankCombo");
  const bankSelLogo = document.getElementById("bankSelLogo"); // leading logo chip
  let comboActive = -1; // keyboard-highlighted option index within the open list

  // Render the dropdown options for a given filter query.
  function renderBankList(query) {
    const q = (query || "").trim().toLowerCase();
    const matches = q
      ? ALL_BANKS.filter(b => b.haystack.includes(q))
      : ALL_BANKS;
    comboActive = -1;
    if (!matches.length) {
      bankList.innerHTML = `<li class="combo-empty" role="presentation">No banks match "${query}"</li>`;
      return;
    }
    bankList.innerHTML = matches.map((b, i) => `
      <li class="combo-opt" role="option" id="bankOpt${i}" data-name="${b.name}" aria-selected="false">
        <span class="combo-logo">
          <img src="logos/${logoSlug(b.name)}.png" alt="" width="22" height="22" loading="lazy"
               onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'combo-logo-fb',textContent:'${initials(b.name)}'}))" />
        </span>
        <span class="combo-name">${b.name}</span>
      </li>`).join("");
  }

  function openBankList() {
    renderBankList(bankInput.value === bankSel.value ? "" : bankInput.value);
    bankList.classList.remove("hidden");
    bankInput.setAttribute("aria-expanded", "true");
  }
  function closeBankList() {
    bankList.classList.add("hidden");
    bankInput.setAttribute("aria-expanded", "false");
    comboActive = -1;
  }
  function commitBank(name) {
    bankSel.value = name;
    bankInput.value = name;
    showSelectedLogo(name);
    closeBankList();
  }

  // Render the committed bank's logo into the input's leading slot (replacing
  // the search-glass icon); falls back to an initials chip if the file is gone.
  function showSelectedLogo(name) {
    if (!name) { bankSelLogo.classList.add("hidden"); return; }
    bankSelLogo.innerHTML =
      `<img src="logos/${logoSlug(name)}.png" alt="" width="22" height="22" ` +
      `onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'combo-logo-fb',textContent:'${initials(name)}'}))" />`;
    bankSelLogo.classList.remove("hidden");
  }

  // Open on focus/click. Clearing the visible text on focus means typing starts
  // fresh (not appended after the committed name like "HDFC Bank…"); the chosen
  // bank stays safe in #bank and is restored on click-away if nothing new is
  // picked. The full ranked list shows since the query is now empty.
  function focusBank() {
    bankInput.value = "";
    openBankList();
  }
  bankInput.addEventListener("focus", focusBank);
  bankInput.addEventListener("click", focusBank);

  // Type to filter. Hide the selected-bank logo while searching so the leading
  // slot reverts to the search glass; commitBank restores it on a fresh pick.
  bankInput.addEventListener("input", () => {
    bankSelLogo.classList.add("hidden");
    renderBankList(bankInput.value);
    bankList.classList.remove("hidden");
    bankInput.setAttribute("aria-expanded", "true");
  });

  // Click an option to choose it.
  bankList.addEventListener("mousedown", e => {
    // mousedown (not click) so it fires before the input's blur closes the list.
    const li = e.target.closest(".combo-opt");
    if (!li) return;
    e.preventDefault();
    commitBank(li.dataset.name);
  });

  // Keyboard: arrows move, Enter commits, Escape closes.
  bankInput.addEventListener("keydown", e => {
    const opts = [...bankList.querySelectorAll(".combo-opt")];
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (bankList.classList.contains("hidden")) { openBankList(); return; }
      if (!opts.length) return;
      comboActive = e.key === "ArrowDown"
        ? (comboActive + 1) % opts.length
        : (comboActive - 1 + opts.length) % opts.length;
      opts.forEach((o, i) => o.setAttribute("aria-selected", i === comboActive ? "true" : "false"));
      const act = opts[comboActive];
      bankInput.setAttribute("aria-activedescendant", act.id);
      act.scrollIntoView({ block: "nearest" });
    } else if (e.key === "Enter") {
      if (!bankList.classList.contains("hidden") && comboActive >= 0 && opts[comboActive]) {
        // A list option is highlighted — Enter picks it (doesn't run the check yet).
        e.preventDefault();
        commitBank(opts[comboActive].dataset.name);
      } else {
        // No active option (list closed or nothing highlighted) — Enter means
        // "go": restore the committed bank into the box, then run the rate check.
        e.preventDefault();
        bankInput.value = bankSel.value || "";
        showSelectedLogo(bankSel.value);
        closeBankList();
        document.getElementById("checkBtn").click();
      }
    } else if (e.key === "Escape") {
      closeBankList();
    }
  });

  // Clicking away closes the list; restore the committed value (+ its logo) if
  // the user left a half-typed query that doesn't match the chosen bank.
  document.addEventListener("mousedown", e => {
    if (!bankCombo.contains(e.target)) {
      bankInput.value = bankSel.value || "";
      showSelectedLogo(bankSel.value);
      closeBankList();
    }
  });

  // Default selection: HDFC Bank (matches the prior <select> default).
  if (ALL_BANKS.some(b => b.name === "HDFC Bank")) commitBank("HDFC Bank");
  else if (ALL_BANKS[0]) commitBank(ALL_BANKS[0].name);

  /* ── Employment segmented control ──────────────────────────────────────── */
  document.getElementById("empSeg").addEventListener("click", e => {
    const btn = e.target.closest("button");
    if (!btn) return;
    emp = btn.dataset.emp;
    [...e.currentTarget.children].forEach(b => b.classList.toggle("active", b === btn));
  });

  /* ── Helpers (logos, labels) ───────────────────────────────────────────── */
  function cibilBandLabel(score) {
    if (score >= 800) return "CIBIL 800+";
    if (score >= 750) return "CIBIL 750–799";
    if (score >= 700) return "CIBIL 700–749";
    return "CIBIL below 700";
  }

  function logoSlug(name) {
    return name
      .toLowerCase()
      .replace(/\([^)]*\)/g, " ")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function initials(name) {
    return name
      .replace(/\([^)]*\)/g, " ")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(w => w[0])
      .join("")
      .toUpperCase();
  }

  function logoMarkup(name) {
    const src = `logos/${logoSlug(name)}.png`;
    const fb = initials(name);
    return `<span class="bank-logo">` +
      `<img src="${src}" alt="" width="36" height="36" loading="lazy" ` +
      `onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'bank-logo-fallback',textContent:'${fb}'}))" />` +
      `</span>`;
  }

  /* ── Box 1 -> Box 2 : check rates ──────────────────────────────────────── */
  document.getElementById("checkBtn").addEventListener("click", () => {
    const score = parseInt(document.getElementById("cibil").value, 10);
    if (isNaN(score) || score < 650 || score > 850) {
      alert("Please enter a valid CIBIL score (650–850).");
      return;
    }
    const bankName = bankSel.value;

    const currentResult = RateEngine.rateFor(bankName, score, emp);
    const current = RateEngine.lenders().find(l => l.name === bankName);
    const others = RateEngine.others(bankName, score, emp, 3);

    renderRates(current, currentResult, others, score);
    document.getElementById("resultsCard").classList.remove("hidden");

    // The footer nudge progresses with the journey: once rates are on screen,
    // "Check yours above" is done, so drop it and point only at the savings step.
    const footer = document.getElementById("discFooter");
    if (footer) footer.textContent = "Lower home loan rates are out there. See what you could save.";

    // Stash the best rate + a human profile label for the savings step.
    ctx.bestRate = RateEngine.bestRate(bankName, score, emp);
    ctx.profileLabel = `${bankName} · CIBIL ${score} · ${emp === "se" ? "Self-employed" : "Salaried"}`;
    const v = Number(ctx.bestRate).toFixed(2);
    document.getElementById("saveNewRateVal").textContent = v + "%";

    // A fresh rate check resets any prior savings output/inputs.
    document.getElementById("savingsInputCard").classList.add("hidden");
    document.getElementById("savingsResult").classList.add("hidden");
    document.getElementById("savingsErr").classList.add("hidden");
  });

  // Enter inside the CIBIL field runs the rate check (mirrors the bank combobox).
  document.getElementById("cibil").addEventListener("keydown", e => {
    if (e.key === "Enter") {
      e.preventDefault();
      document.getElementById("checkBtn").click();
    }
  });

  function renderRates(current, currentResult, others, score) {
    document.getElementById("currentRate").innerHTML = `
      <div class="rate-row current">
        ${logoMarkup(current.name)}
        <div class="bank">${current.name}<small>${RateEngine.typeLabel(current.type)} · ${cibilBandLabel(score)} · ${emp === "se" ? "Self-employed" : "Salaried"}</small></div>
        <div class="rate">${RateEngine.formatRate(currentResult)}</div>
      </div>`;

    document.getElementById("otherRates").innerHTML = others.map(o => `
      <div class="rate-row">
        ${logoMarkup(o.name)}
        <div class="bank">${o.name}</div>
        <div class="rate">${RateEngine.formatRate(o.result)}</div>
      </div>`).join("");
  }

  /* ── Box 2 -> Box 3 : reveal savings inputs ────────────────────────────── */
  document.getElementById("savingsCta").addEventListener("click", () => {
    const panel = document.getElementById("savingsInputCard");
    panel.classList.remove("hidden");
    panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
    // Once the user has clicked "check savings", the footer nudge to "check
    // yours" no longer makes sense — hide it.
    const footer = document.getElementById("discFooter");
    if (footer) footer.classList.add("hidden");
  });

  /* ── Savings math (mirrors js/savings.js) ──────────────────────────────── */
  function emi(P, r, n) {
    if (r === 0) return P / n;
    const f = Math.pow(1 + r, n);
    return P * r * f / (f - 1);
  }
  function inr0(x) {
    x = Math.round(x);
    const neg = x < 0; if (neg) x = -x;
    const s = x.toString();
    const last3 = s.slice(-3);
    const rest = s.slice(0, -3);
    const out = rest ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + last3 : last3;
    return (neg ? "-" : "") + out;
  }
  function fmtMonths(m) {
    if (m <= 0) return "0 months";
    const y = Math.floor(m / 12), mo = m % 12, parts = [];
    if (y) parts.push(y + (y === 1 ? " yr" : " yrs"));
    if (mo) parts.push(mo + (mo === 1 ? " mo" : " mos"));
    return parts.join(" ");
  }
  // Compact "₹X.YY L" / "₹X.YY Cr" for the headline figures.
  function inrLakh(x) {
    if (x >= 1e7) return "₹" + (x / 1e7).toFixed(2) + " Cr";
    return "₹" + (x / 1e5).toFixed(2) + " L";
  }
  // "3y 0m" style compact duration from a month count.
  function fmtYM(m) {
    const y = Math.floor(m / 12), mo = m % 12;
    return y + "y " + mo + "m";
  }
  // "17 Years 0 mo" verbose tenure from a month count.
  function fmtYearsMonths(m) {
    const y = Math.floor(m / 12), mo = m % 12;
    return y + (y === 1 ? " Year " : " Years ") + mo + " mo";
  }

  function showErr(msg) {
    const e = document.getElementById("savingsErr");
    e.textContent = msg; e.classList.remove("hidden");
  }

  /* ── Box 3 -> Box 4 : compute + render savings ─────────────────────────── */
  document.getElementById("calcSavingsBtn").addEventListener("click", () => {
    const errEl = document.getElementById("savingsErr");
    const resEl = document.getElementById("savingsResult");
    errEl.classList.add("hidden"); resEl.classList.add("hidden");

    const P = parseFloat(document.getElementById("outstanding").value);
    const curRate = parseFloat(document.getElementById("curRate").value);
    const years = parseFloat(document.getElementById("tenure").value);
    const newRate = ctx.bestRate != null ? Number(ctx.bestRate) : NaN;

    if (!(P > 0) || !(curRate > 0) || !(years > 0)) {
      return showErr("Please fill your current rate, remaining tenure and outstanding amount with valid values.");
    }
    if (!(newRate > 0)) {
      return showErr("Check your rates first so we know the best rate available for your profile.");
    }
    if (newRate >= curRate) {
      return showErr("Your current rate is already at or below today's best fair rate for your profile. No switching savings to show.");
    }

    const n = Math.round(years * 12);
    const rOld = curRate / 1200, rNew = newRate / 1200;
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

    const maxSaving = Math.max(reduceTenureTotal, reduceEmiTotal);
    const rateCut = curRate - newRate;

    // ── Hero ───────────────────────────────────────────────────────────────
    document.getElementById("svRateCut").textContent = rateCut.toFixed(2).replace(/\.?0+$/, "") + "%";
    document.getElementById("svHeroAmt").textContent = inrLakh(maxSaving);

    // ── Card 1 — More Cash Monthly (reduce EMI, keep tenure) ─────────────────
    document.getElementById("svEmiSub").textContent =
      `Keep your ${fmtMonths(n)} timeline, but reduce your monthly out-of-pocket expense.`;
    document.getElementById("svEmiTotal").textContent = inrLakh(reduceEmiTotal);
    document.getElementById("svEmiMonthly").innerHTML = "₹" + inr0(monthlySave) + " <small>/ mo</small>";
    document.getElementById("svEmiEmi").textContent = "₹" + inr0(emiNew);
    document.getElementById("svEmiTenure").innerHTML = fmtMonths(n) + " <em>(Same)</em>";

    // ── Card 2 — Debt-Free Faster (reduce tenure, keep EMI) ──────────────────
    document.getElementById("svTenureSub").textContent =
      "Keep paying your current EMI amount, and watch your loan vanish years earlier.";
    document.getElementById("svTenureTotal").textContent = inrLakh(reduceTenureTotal);
    document.getElementById("svTenureTime").innerHTML = fmtYM(monthsSaved) + " <small>earlier</small>";
    document.getElementById("svTenureEmi").innerHTML = "₹" + inr0(emiOld) + " <em>(Same)</em>";
    document.getElementById("svTenureTenure").textContent = fmtYearsMonths(nNew);

    document.getElementById("saveSummary").innerHTML =
      `Based on an outstanding of <b>₹${inr0(P)}</b>, moving from <b>${curRate.toFixed(2)}%</b> to <b>${newRate.toFixed(2)}%</b>` +
      (ctx.profileLabel ? ` for <b>${ctx.profileLabel}</b>` : "") + `. ` +
      `${reduceTenureTotal >= reduceEmiTotal ? "Keeping your EMI the same and letting the tenure shrink" : "Keeping your tenure the same and lowering the EMI"} saves the most.`;

    resEl.classList.remove("hidden");
    resEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });

  // Enter in any of the three savings fields runs the savings calculation.
  ["curRate", "tenure", "outstanding"].forEach(id => {
    document.getElementById(id).addEventListener("keydown", e => {
      if (e.key === "Enter") {
        e.preventDefault();
        document.getElementById("calcSavingsBtn").click();
      }
    });
  });
})();
