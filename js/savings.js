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

   This BASELINE keeps the existing two-option layout (reduce-tenure /
   reduce-EMI). Agent 4 restructures it into: one big "max savings" hero box on
   top, then two boxes below (reduce EMI, reduce tenure), calculated against the
   lowest rate from the suggested profile (passed in via setContext.bestRate).
   Keep the public contract intact.
============================================================================= */
(function () {
  "use strict";

  let ctx = { bestRate: null, profileLabel: "" };
  let root = null;

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

  function mount(rootEl) {
    root = rootEl;
    root.innerHTML = `
      <button class="cta secondary" id="savingsToggle">Check my savings</button>
      <div id="savingsPanel" class="savings-panel hidden">
        <div class="savings-inputs">
          <label class="field" style="margin:0">
            <span class="lbl">Outstanding amount (₹)</span>
            <input id="outstanding" type="number" min="1" placeholder="e.g. 4000000" />
          </label>
          <label class="field" style="margin:0">
            <span class="lbl">Your current rate (%)</span>
            <input id="curRate" type="number" step="0.01" min="1" placeholder="e.g. 8.60" />
          </label>
          <label class="field" style="margin:0">
            <span class="lbl">Remaining tenure (years)</span>
            <input id="tenure" type="number" min="1" max="35" placeholder="e.g. 18" />
          </label>
          <label class="field" style="margin:0">
            <span class="lbl">New rate available (%)</span>
            <input id="newRate" type="number" step="0.01" readonly />
          </label>
        </div>
        <button class="cta" id="calcSavingsBtn">Show my savings</button>
        <div id="savingsErr" class="err hidden"></div>
        <div id="savingsResult" class="hidden">
          <div class="save-cards">
            <div class="save-card best">
              <div class="tagline">Keep EMI same, cut tenure</div>
              <div class="big" id="saveTenureAmt"></div>
              <div class="meta" id="saveTenureMeta"></div>
            </div>
            <div class="save-card">
              <div class="tagline">Keep tenure same, cut EMI</div>
              <div class="big" id="saveEmiAmt"></div>
              <div class="meta" id="saveEmiMeta"></div>
            </div>
          </div>
          <div class="save-summary" id="saveSummary"></div>
        </div>
      </div>`;

    root.querySelector("#savingsToggle").addEventListener("click", () => {
      const p = root.querySelector("#savingsPanel");
      const hidden = p.classList.toggle("hidden");
      root.querySelector("#savingsToggle").textContent = hidden ? "Check my savings" : "Hide savings";
    });
    root.querySelector("#calcSavingsBtn").addEventListener("click", calc);
  }

  function setContext(next) {
    ctx = Object.assign({}, ctx, next);
    if (root && ctx.bestRate != null) {
      root.querySelector("#newRate").value = Number(ctx.bestRate).toFixed(2);
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
    const newRate = parseFloat(root.querySelector("#newRate").value);

    if (!(P > 0) || !(curRate > 0) || !(years > 0) || !(newRate > 0)) {
      return showErr("Please fill outstanding amount, current rate and remaining tenure with valid values.");
    }
    if (newRate >= curRate) {
      return showErr("Your current rate is already at or below today's best fair rate for your profile. No switching savings to show.");
    }

    const n = Math.round(years * 12);
    const rOld = curRate / 1200, rNew = newRate / 1200;
    const emiOld = emi(P, rOld, n), totalOld = emiOld * n;

    const nNew = Math.ceil(-Math.log(1 - (P * rNew) / emiOld) / Math.log(1 + rNew));
    const saveA = totalOld - emiOld * nNew;
    const monthsSaved = n - nNew;

    const emiNew = emi(P, rNew, n);
    const monthlySave = emiOld - emiNew;
    const saveB = monthlySave * n;

    root.querySelector("#saveTenureAmt").textContent = "₹" + inr0(saveA);
    root.querySelector("#saveTenureMeta").textContent =
      `Loan closes ${fmtMonths(monthsSaved)} sooner. EMI stays ₹${inr0(emiOld)}.`;
    root.querySelector("#saveEmiAmt").textContent = "₹" + inr0(saveB);
    root.querySelector("#saveEmiMeta").textContent =
      `EMI drops by ₹${inr0(monthlySave)} (₹${inr0(emiOld)} → ₹${inr0(emiNew)}) over ${years} yrs.`;
    root.querySelector("#saveSummary").innerHTML =
      `Based on an outstanding of <b>₹${inr0(P)}</b>, moving from <b>${curRate.toFixed(2)}%</b> to <b>${newRate.toFixed(2)}%</b>. ` +
      `Keeping your EMI the same and letting the tenure shrink saves the most.`;
    resEl.classList.remove("hidden");
  }

  window.Savings = { mount, setContext, reset };
})();
