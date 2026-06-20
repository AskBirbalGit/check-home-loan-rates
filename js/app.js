/* =============================================================================
   app.js  —  Page glue   (OWNER: integration; Agents may read, avoid editing)
   -----------------------------------------------------------------------------
   Wires the inputs to RateEngine (js/data.js) and the Savings controller
   (js/savings.js). Renders the current + other-institution rate rows.

   Depends on the public contracts documented in data.js and savings.js.
============================================================================= */
(function () {
  "use strict";

  let emp = "sal";
  const bankSel = document.getElementById("bank");

  // Populate bank dropdown from the engine
  RateEngine.lenders()
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .forEach(l => {
      const o = document.createElement("option");
      o.value = l.name; o.textContent = l.name;
      bankSel.appendChild(o);
    });
  if ([...bankSel.options].some(o => o.value === "HDFC Bank")) bankSel.value = "HDFC Bank";

  // Mount the savings sub-calculator into its container
  Savings.mount(document.getElementById("savingsRoot"));

  // Employment segmented control
  document.getElementById("empSeg").addEventListener("click", e => {
    const btn = e.target.closest("button");
    if (!btn) return;
    emp = btn.dataset.emp;
    [...e.currentTarget.children].forEach(b => b.classList.toggle("active", b === btn));
  });

  function cibilBandLabel(score) {
    if (score >= 800) return "CIBIL 800+";
    if (score >= 750) return "CIBIL 750–799";
    if (score >= 700) return "CIBIL 700–749";
    return "CIBIL below 700";
  }

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

    // Feed savings with the best available rate + a human profile label
    const profileLabel = `${bankName} · CIBIL ${score} · ${emp === "se" ? "Self-employed" : "Salaried"}`;
    Savings.setContext({ bestRate: RateEngine.bestRate(bankName, score, emp), profileLabel });
    Savings.reset();
  });

  function renderRates(current, currentResult, others, score) {
    document.getElementById("outEmpty").classList.add("hidden");
    document.getElementById("outResult").classList.remove("hidden");

    document.getElementById("currentRate").innerHTML = `
      <div class="rate-row current">
        <div class="bank">${current.name}<small>${RateEngine.typeLabel(current.type)} · ${cibilBandLabel(score)} · ${emp === "se" ? "Self-employed" : "Salaried"}</small></div>
        <div class="rate">${RateEngine.formatRate(currentResult)}</div>
      </div>`;

    document.getElementById("otherRates").innerHTML = others.map(o => `
      <div class="rate-row">
        <div class="bank">${o.name}<small>${RateEngine.typeLabel(o.type)}</small></div>
        <div class="rate">${RateEngine.formatRate(o.result)}</div>
      </div>`).join("");
  }
})();
