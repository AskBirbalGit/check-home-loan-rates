/* =============================================================================
   savings.js  —  Savings sub-calculator   (OWNER: Agent 4)
   -----------------------------------------------------------------------------
   Renders the savings tool INSIDE #savingsRoot and exposes a small controller
   app.js calls after rates are shown.

   PUBLIC CONTRACT (do not change — app.js depends on it):

     window.Savings = {
       mount(rootEl): void          // build the savings UI inside rootEl (once)
       setContext({ bestRate, profileLabel }): void
                                     // called by app.js each time rates are shown:
                                     //   bestRate     = lowest numeric rate available
                                     //   profileLabel = e.g. "HDFC Bank · CIBIL 810 · Salaried"
       reset(): void                // collapse/clear results (on new rate check)
     }

   LAYOUT (this revision): a single full-width HERO box on top shows the MAX
   total rupees saved (the larger of the two strategies) — this is the headline
   "total saved". Below it a 2-up grid shows the TWO WAYS to take that benefit:
   a "reduce EMI" box headlined in ₹/month relief, and a "reduce tenure" box
   headlined in time saved. Each box keeps its own lifetime total in the small
   meta line so the hero rupee figure is never duplicated as a box headline.
   The "new rate" the savings are computed against is NOT user-entered — it is
   sourced from setContext.bestRate (the lowest fair rate for the user's
   suggested profile) and shown read-only. Keep the public contract intact.
============================================================================= */
(function () {
  "use strict";

  let ctx = { bestRate: null, profileLabel: "" };
  let root = null;

  // EMI(P, r, n): standard amortised monthly instalment. r is the MONTHLY rate.
  function emi(P, r, n) {
    if (r === 0) return P / n;
    const f = Math.pow(1 + r, n);
    return P * r * f / (f - 1);
  }
  // Indian-grouped rupee integer formatting (e.g. 1234567 -> "12,34,567").
  function inr0(x) {
    x = Math.round(x);
    const neg = x < 0; if (neg) x = -x;
    const s = x.toString();
    const last3 = s.slice(-3);
    const rest = s.slice(0, -3);
    const out = rest ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + last3 : last3;
    return (neg ? "-" : "") + out;
  }
  // Human "X yrs Y mos" from a month count.
  function fmtMonths(m) {
    if (m <= 0) return "0 months";
    const y = Math.floor(m / 12), mo = m % 12, parts = [];
    if (y) parts.push(y + (y === 1 ? " yr" : " yrs"));
    if (mo) parts.push(mo + (mo === 1 ? " mo" : " mos"));
    return parts.join(" ");
  }

  function mount(rootEl) {
    root = rootEl;
    root.innerHTML = `
      <button class="cta secondary" id="savingsToggle">Check my savings</button>
      <div id="savingsPanel" class="savings-panel hidden">
        <div class="save-newrate" id="saveNewRate">
          New rate from your best profile match: <b id="saveNewRateVal">—</b>
        </div>
        <div class="savings-inputs">
          <label class="field" style="margin:0">
            <span class="lbl">Your current rate (%)</span>
            <input id="curRate" type="number" step="0.01" min="1" placeholder="e.g. 8.60" />
          </label>
          <label class="field" style="margin:0">
            <span class="lbl">Remaining tenure (years)</span>
            <input id="tenure" type="number" min="1" max="35" placeholder="e.g. 18" />
          </label>
          <label class="field" style="margin:0">
            <span class="lbl">Remaining / outstanding amount (₹)</span>
            <input id="outstanding" type="number" min="1" placeholder="e.g. 4000000" />
          </label>
        </div>
        <button class="cta" id="calcSavingsBtn">Show my savings</button>
        <div id="savingsErr" class="err hidden"></div>
        <div id="savingsResult" class="hidden">
          <div class="save-card save-hero" id="saveHero">
            <div class="tagline">Total you could save</div>
            <div class="big" id="saveMaxAmt"></div>
            <div class="meta" id="saveMaxMeta"></div>
          </div>
          <div class="save-cards">
            <div class="save-card" id="saveEmiCard">
              <div class="tagline">Reduce your EMI</div>
              <div class="big" id="saveEmiAmt"></div>
              <div class="meta" id="saveEmiMeta"></div>
            </div>
            <div class="save-card" id="saveTenureCard">
              <div class="tagline">Reduce your tenure</div>
              <div class="big" id="saveTenureAmt"></div>
              <div class="meta" id="saveTenureMeta"></div>
            </div>
          </div>
          <div class="save-summary" id="saveSummary"></div>
        </div>
      </div>`;

    root.querySelector("#savingsToggle").addEventListener("click", () => {
      const p = root.querySelector("#savingsPanel");
      const hidden = p.classList.toggle("hidden");
      root.querySelector("#savingsToggle").textContent = hidden ? "Check my savings" : "Hide savings";
      // Once the user has engaged with savings, the footer nudge to "check yours"
      // no longer makes sense — hide it.
      const footer = document.getElementById("discFooter");
      if (footer) footer.classList.add("hidden");
    });
    root.querySelector("#calcSavingsBtn").addEventListener("click", calc);
  }

  function setContext(next) {
    ctx = Object.assign({}, ctx, next);
    // The "new rate" is driven entirely by setContext.bestRate — never typed by
    // the user. Mirror it into the read-only context line above the inputs.
    if (root && ctx.bestRate != null) {
      const v = Number(ctx.bestRate).toFixed(2);
      root.querySelector("#saveNewRateVal").textContent = v + "%";
    }
  }

  function reset() {
    if (!root) return;
    root.querySelector("#savingsPanel").classList.add("hidden");
    root.querySelector("#savingsResult").classList.add("hidden");
    root.querySelector("#savingsErr").classList.add("hidden");
    root.querySelector("#savingsToggle").textContent = "Check my savings";
  }

  function showErr(msg) {
    const e = root.querySelector("#savingsErr");
    e.textContent = msg; e.classList.remove("hidden");
  }

  function calc() {
    const errEl = root.querySelector("#savingsErr");
    const resEl = root.querySelector("#savingsResult");
    errEl.classList.add("hidden"); resEl.classList.add("hidden");

    const P = parseFloat(root.querySelector("#outstanding").value);
    const curRate = parseFloat(root.querySelector("#curRate").value);
    const years = parseFloat(root.querySelector("#tenure").value);
    // newRate comes from setContext.bestRate, not user input.
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

    // Reduce-tenure: keep paying the OLD EMI at the NEW rate; the loan closes
    // sooner. nNew = months to clear P at emiOld and rNew.
    const nNew = Math.ceil(-Math.log(1 - (P * rNew) / emiOld) / Math.log(1 + rNew));
    const reduceTenureTotal = totalOld - emiOld * nNew;
    const monthsSaved = n - nNew;

    // Reduce-EMI: keep the SAME tenure, pay a lower EMI at the NEW rate.
    const emiNew = emi(P, rNew, n);
    const monthlySave = emiOld - emiNew;
    const reduceEmiTotal = monthlySave * n;

    // Headline: the most they can save across the two strategies.
    const maxSaving = Math.max(reduceTenureTotal, reduceEmiTotal);
    const maxIsTenure = reduceTenureTotal >= reduceEmiTotal;

    // Hero — the single headline figure: the most rupees you can save.
    root.querySelector("#saveMaxAmt").textContent = "₹" + inr0(maxSaving);
    root.querySelector("#saveMaxMeta").textContent = maxIsTenure
      ? `Switching to ${newRate.toFixed(2)}% saves you the most by keeping your EMI the same and closing the loan ${fmtMonths(monthsSaved)} sooner. Here are both ways to take it.`
      : `Switching to ${newRate.toFixed(2)}% saves you the most by keeping your tenure the same and lowering your monthly EMI. Here are both ways to take it.`;

    // Reduce-EMI box — headline the monthly relief, lifetime total in the meta.
    root.querySelector("#saveEmiAmt").textContent = "₹" + inr0(monthlySave) + "/mo";
    root.querySelector("#saveEmiMeta").textContent =
      `EMI drops ₹${inr0(emiOld)} → ₹${inr0(emiNew)} over the same ${years} yrs — about ₹${inr0(reduceEmiTotal)} saved in all.`;

    // Reduce-tenure box — headline the time saved, lifetime total in the meta.
    root.querySelector("#saveTenureAmt").textContent = fmtMonths(monthsSaved) + " sooner";
    root.querySelector("#saveTenureMeta").textContent =
      `EMI stays ₹${inr0(emiOld)}; closing early saves about ₹${inr0(reduceTenureTotal)} in all.`;

    // Highlight whichever box matches the headline strategy.
    root.querySelector("#saveEmiCard").classList.toggle("best", !maxIsTenure);
    root.querySelector("#saveTenureCard").classList.toggle("best", maxIsTenure);

    root.querySelector("#saveSummary").innerHTML =
      `Based on an outstanding of <b>₹${inr0(P)}</b>, moving from <b>${curRate.toFixed(2)}%</b> to <b>${newRate.toFixed(2)}%</b>` +
      (ctx.profileLabel ? ` for <b>${ctx.profileLabel}</b>` : "") + `. ` +
      `${maxIsTenure ? "Keeping your EMI the same and letting the tenure shrink" : "Keeping your tenure the same and lowering the EMI"} saves the most.`;
    resEl.classList.remove("hidden");
  }

  window.Savings = { mount, setContext, reset };
})();
