#!/usr/bin/env node

/* =============================================================================
   generate-ui-rate-dataset.mjs — UI-driven rate dataset generator
   -----------------------------------------------------------------------------
   Drives the live calculator UI (Next dev server) with the agent-browser CLI
   and scrapes the rendered Box 2 results. Nothing is read from the rate engine
   directly: every value comes from what the page actually displays.

   For each of the 32 first-party (non-mirrored) institutions, across 5 CIBIL
   bands (base 625/675/725/775/825, each randomized ±15) and both employment
   types, it records the current institution's rate plus the three
   better-priced lenders the UI surfaces. Output: data/ui-rate-dataset.csv.

   Each scenario is driven by its own `agent-browser eval` call that returns the
   scraped row synchronously, so there is no background polling to time out on.
============================================================================= */

import { randomInt } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT = resolve(ROOT, "data/ui-rate-dataset.csv");
const PORT = process.env.PORT || "3100";
const APP_URL = `http://127.0.0.1:${PORT}`;
const SESSION = `cibil-ui-dataset-${Date.now()}`;

// The 32 first-party institutions (those with their own `b` rate bands in
// lib/rate-engine.ts, before the mirrored long tail).
const INSTITUTIONS = [
  "SBI",
  "Bank of India",
  "Bank of Baroda",
  "Canara Bank",
  "Union Bank of India",
  "Central Bank of India",
  "ICICI Bank",
  "HDFC Bank",
  "Axis Bank",
  "Kotak Mahindra Bank",
  "IDFC First Bank",
  "Yes Bank",
  "RBL Bank",
  "AU Small Finance Bank",
  "Ujjivan SFB",
  "Jana SFB",
  "Equitas SFB",
  "Bajaj Housing Finance",
  "Tata Capital",
  "LIC Housing Finance",
  "PNB Housing Finance",
  "Sammaan Capital (Indiabulls)",
  "Muthoot Housing Finance",
  "Aavas Financiers",
  "Hinduja Housing Finance",
  "Home First Finance",
  "Aadhar Housing Finance",
  "Cholamandalam Finance",
  "SK Finance",
  "MAS Financial",
  "JM Financial Services",
  "Axis Finance",
];

// Five base CIBIL bands, each randomized ±15. One randomized score per band,
// reused across every institution + employment type so comparisons stay fair.
// Plus the two domain boundaries (600 lowest, 850 highest) as fixed, un-randomized
// endpoints so the dataset covers the full 600–850 CIBIL range.
const baseScores = [625, 675, 725, 775, 825];
const cibilScores = [
  { base: 600, score: 600 },
  ...baseScores.map((base) => ({ base, score: randomInt(base - 15, base + 16) })),
  { base: 850, score: 850 },
];

const scenarios = [];
for (const institution of INSTITUTIONS) {
  for (const { base, score } of cibilScores) {
    scenarios.push({ institution, baseCibil: base, cibil: score, employment: "Salaried", empKey: "sal" });
    scenarios.push({ institution, baseCibil: base, cibil: score, employment: "Self-employed", empKey: "se" });
  }
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: "utf8",
    stdio: options.stdio || ["pipe", "pipe", "pipe"],
    input: options.input,
    env: { ...process.env, ...options.env },
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed\n${result.stderr || result.stdout}`);
  }
  return (result.stdout || "").trim();
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function waitForApp(proc) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const result = spawnSync(
      process.execPath,
      ["-e", `fetch(${JSON.stringify(APP_URL)}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))`],
      { cwd: ROOT, stdio: "ignore" }
    );
    if (result.status === 0) return;
    if (proc.exitCode !== null) throw new Error("Next dev server exited before becoming ready.");
    sleep(500);
  }
  throw new Error(`Timed out waiting for ${APP_URL}`);
}

// agent-browser returns the eval result as a JSON string when our script
// returns a string. Unwrap one or two layers of JSON to land on the object.
function evalScenario(scenario) {
  const script = buildScenarioScript(scenario);
  const raw = run("agent-browser", ["--session", SESSION, "eval", "--stdin"], { input: script });
  let value = raw.trim();
  // First JSON.parse unwraps the outer quoted string agent-browser prints.
  try {
    value = JSON.parse(value);
  } catch {
    /* not quoted */
  }
  if (typeof value === "string") {
    value = JSON.parse(value);
  }
  if (value && value.error) {
    throw new Error(`Scenario failed (${scenario.institution} / ${scenario.cibil} / ${scenario.empKey}): ${value.error}`);
  }
  return value;
}

function buildScenarioScript(scenario) {
  return `
(async () => {
  try {
    const scenario = ${JSON.stringify(scenario)};
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const text = (el) => (el && el.textContent ? el.textContent : "").replace(/\\s+/g, " ").trim();
    const setInput = (input, value) => {
      input.focus();
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
      setter.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    };

    // Select the institution from the combobox.
    const bankInput = document.querySelector("#bankInput");
    bankInput.click();
    await sleep(40);
    setInput(bankInput, scenario.institution);
    await sleep(60);
    const opts = [...document.querySelectorAll("#bankList .combo-opt")];
    const opt = opts.find((o) => text(o.querySelector(".combo-name")) === scenario.institution);
    if (!opt) return JSON.stringify({ error: "bank option not found: " + scenario.institution });
    opt.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window }));
    await sleep(40);

    // CIBIL score.
    setInput(document.querySelector("#cibil"), String(scenario.cibil));
    await sleep(20);

    // Employment type.
    const empButton = [...document.querySelectorAll("#empSeg button")].find((b) =>
      scenario.empKey === "se" ? text(b) === "Self-employed" : text(b) === "Salaried"
    );
    if (!empButton) return JSON.stringify({ error: "employment button not found" });
    empButton.click();
    await sleep(20);

    // Submit.
    document.querySelector("#checkBtn").click();
    await sleep(120);

    const currentRow = document.querySelector("#currentRate .rate-row.current");
    if (!currentRow) return JSON.stringify({ error: "results did not render" });
    const small = document.querySelector("#currentRate small");
    const bandParts = text(small).split("\\u00b7").map((p) => p.trim());
    const better = [...document.querySelectorAll("#otherRates .rate-row")].map((row) => ({
      lender: text(row.querySelector(".bank")),
      rate: text(row.querySelector(".rate")),
    }));

    return JSON.stringify({
      institution: scenario.institution,
      employment_type: scenario.employment,
      base_cibil_score: scenario.baseCibil,
      cibil_score_used: scenario.cibil,
      cibil_band_shown: bandParts[1] || "",
      current_rate: text(currentRow.querySelector(".rate")),
      better_lender_1: better[0] ? better[0].lender : "",
      better_rate_1: better[0] ? better[0].rate : "",
      better_lender_2: better[1] ? better[1].lender : "",
      better_rate_2: better[1] ? better[1].rate : "",
      better_lender_3: better[2] ? better[2].lender : "",
      better_rate_3: better[2] ? better[2].rate : "",
    });
  } catch (e) {
    return JSON.stringify({ error: e && e.message ? e.message : String(e) });
  }
})()
`;
}

function quoteCsv(value) {
  const s = value == null ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function writeCsv(resultRows) {
  const headers = [
    "institution",
    "employment_type",
    "base_cibil_score",
    "cibil_score_used",
    "cibil_band_shown",
    "current_rate",
    "better_lender_1",
    "better_rate_1",
    "better_lender_2",
    "better_rate_2",
    "better_lender_3",
    "better_rate_3",
  ];
  const lines = [headers.join(",")];
  for (const row of resultRows) {
    lines.push(headers.map((h) => quoteCsv(row[h])).join(","));
  }
  if (!existsSync(dirname(OUTPUT))) mkdirSync(dirname(OUTPUT), { recursive: true });
  writeFileSync(OUTPUT, `${lines.join("\n")}\n`);
}

let server;
try {
  run("agent-browser", ["doctor", "--offline", "--quick"], { stdio: "inherit" });

  server = spawn("npm", ["run", "dev", "--", "--hostname", "127.0.0.1", "--port", PORT], {
    cwd: ROOT,
    stdio: ["ignore", "ignore", "pipe"],
    env: process.env,
  });
  waitForApp(server);

  run("agent-browser", ["--session", SESSION, "open", APP_URL], { stdio: "inherit" });

  const resultRows = [];
  let done = 0;
  for (const scenario of scenarios) {
    resultRows.push(evalScenario(scenario));
    done += 1;
    if (done % 20 === 0) console.log(`  ...${done}/${scenarios.length} scenarios scraped`);
  }

  writeCsv(resultRows);
  console.log(`\nWrote ${resultRows.length} rows to ${OUTPUT}`);
  console.log(`Randomized CIBIL scores: ${cibilScores.map(({ base, score }) => `${base}->${score}`).join(", ")}`);
} finally {
  try {
    run("agent-browser", ["--session", SESSION, "close"], { stdio: "ignore" });
  } catch {}
  if (server) server.kill("SIGTERM");
}
