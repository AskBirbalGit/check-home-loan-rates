#!/usr/bin/env node

/* =============================================================================
   generate-all-institution-rates.mjs — per-institution rate dataset (all 92)
   -----------------------------------------------------------------------------
   Drives the live calculator UI (Next dev server) with the agent-browser CLI
   and scrapes the rendered Box 2 "Your current bank" rate for EVERY institution
   in the picker — all 78 (the 32 first-party + the 46 mirrored long-tail), not
   just the first-party ones. Nothing is read from the rate engine for the rate
   value: it comes from what the page actually displays.

   The institution list itself is read from lib/rate-engine.ts `lenders()` so it
   always tracks the live set (currently 78). For each institution × 10 fixed
   CIBIL points × {Salaried, Self-employed}, it records one row:

       institution, institution_type, cibil_score, employment_type, interest_rate

   Output: data/all-institution-rates-<UTC>.csv  (OUTPUT_CSV overrides).
============================================================================= */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const STAMP = new Date()
  .toISOString()
  .replace(/[-:]/g, "")
  .replace(/\..+$/, "")
  .replace("T", "-");
const OUTPUT = process.env.OUTPUT_CSV
  ? resolve(ROOT, process.env.OUTPUT_CSV)
  : resolve(ROOT, `data/all-institution-rates-${STAMP}.csv`);
const PORT = process.env.PORT || "3100";
const APP_URL = `http://127.0.0.1:${PORT}`;
const SESSION = `cibil-all-rates-${Date.now()}`;

// Full institution list (name + type) mirrored from lib/rate-engine.ts LENDERS —
// all 78 the picker renders: the 32 first-party rows + the 46 mirrored long-tail.
// Kept here as a plain JS list because this repo has no TS loader (tsx/ts-node)
// to import the .ts engine directly; the prior dataset script hardcoded its list
// the same way. Type labels match RateEngine.typeLabel().
const TYPE_LABELS = {
  PSB: "Public Sector Bank",
  PVT: "Private Bank",
  SFB: "Small Finance Bank",
  HFC: "Housing Finance Co.",
};
const LENDER_TYPES = [
  // First-party (own rate sheet)
  ["SBI", "PSB"], ["Bank of India", "PSB"], ["Bank of Baroda", "PSB"],
  ["Canara Bank", "PSB"], ["Union Bank of India", "PSB"], ["Central Bank of India", "PSB"],
  ["ICICI Bank", "PVT"], ["HDFC Bank", "PVT"], ["Axis Bank", "PVT"],
  ["Kotak Mahindra Bank", "PVT"], ["IDFC First Bank", "PVT"], ["Yes Bank", "PVT"],
  ["RBL Bank", "PVT"], ["AU Small Finance Bank", "SFB"], ["Ujjivan SFB", "SFB"],
  ["Jana SFB", "SFB"], ["Equitas SFB", "SFB"], ["Bajaj Housing Finance", "HFC"],
  ["Tata Capital", "HFC"], ["LIC Housing Finance", "HFC"], ["PNB Housing Finance", "HFC"],
  ["Sammaan Capital (Indiabulls)", "HFC"], ["Muthoot Housing Finance", "HFC"],
  ["Aavas Financiers", "HFC"], ["Hinduja Housing Finance", "HFC"], ["Home First Finance", "HFC"],
  ["Aadhar Housing Finance", "HFC"], ["Cholamandalam Finance", "HFC"], ["SK Finance", "HFC"],
  ["MAS Financial", "HFC"], ["JM Financial Services", "HFC"], ["Axis Finance", "HFC"],
  // Mirrored long tail (no own sheet; rate resolves through a peer)
  ["Punjab National Bank", "PSB"], ["Indian Bank", "PSB"], ["Indian Overseas Bank", "PSB"],
  ["UCO Bank", "PSB"], ["Bank of Maharashtra", "PSB"], ["Punjab & Sind Bank", "PSB"],
  ["IndusInd Bank", "PVT"], ["Federal Bank", "PVT"], ["South Indian Bank", "PVT"],
  ["Karur Vysya Bank", "PVT"], ["Karnataka Bank", "PVT"], ["City Union Bank", "PVT"],
  ["DCB Bank", "PVT"], ["Tamilnad Mercantile Bank", "PVT"], ["CSB Bank", "PVT"],
  ["Bandhan Bank", "PVT"], ["Dhanlaxmi Bank", "PVT"], ["Jammu & Kashmir Bank", "PVT"],
  ["Nainital Bank", "PVT"], ["Utkarsh Small Finance Bank", "SFB"],
  ["Suryoday Small Finance Bank", "SFB"],
  ["Capital Small Finance Bank", "SFB"],
  ["Shivalik Small Finance Bank", "SFB"],
  ["ICICI Home Finance", "HFC"],
  ["Repco Home Finance", "HFC"], ["GIC Housing Finance", "HFC"], ["Can Fin Homes", "HFC"],
  ["India Shelter Finance", "HFC"],
  ["Motilal Oswal Home Finance", "HFC"],
  ["Godrej Housing Finance", "HFC"], ["Piramal Capital & Housing Finance", "HFC"],
  ["IIFL Home Finance", "HFC"], ["L&T Finance", "HFC"], ["Sundaram Home Finance", "HFC"],
  ["Cent Bank Home Finance", "HFC"],
  ["Poonawalla Fincorp", "HFC"], ["Edelweiss Housing Finance", "HFC"],
  ["Altum Credo Home Finance", "HFC"],
  ["Bajaj Finance", "HFC"], ["Aditya Birla Housing Finance", "HFC"],
  ["Hero Housing Finance", "HFC"], ["SMFG India Credit", "HFC"],
  ["Nido Home Finance", "HFC"],
  ["Easy Home Finance", "HFC"], ["Svatantra Micro Housing Finance", "HFC"],
  ["Centrum Housing Finance", "HFC"],
];
const INSTITUTIONS = LENDER_TYPES.map(([name, typeCode]) => ({
  name,
  typeCode,
  typeLabel: TYPE_LABELS[typeCode],
}));

// Fixed CIBIL score points (no randomization) — same 10 points the prior
// dataset runs settled on, so this is reproducible and comparable.
const CIBIL_SCORES = [600, 625, 675, 700, 720, 750, 775, 790, 815, 850];

const EMPLOYMENTS = [
  { label: "Salaried", key: "sal" },
  { label: "Self-employed", key: "se" },
];

const scenarios = [];
for (const inst of INSTITUTIONS) {
  for (const score of CIBIL_SCORES) {
    for (const emp of EMPLOYMENTS) {
      scenarios.push({
        institution: inst.name,
        institutionType: inst.typeLabel,
        cibil: score,
        employment: emp.label,
        empKey: emp.key,
      });
    }
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

// agent-browser prints the eval result as a JSON string when our script returns
// a string. Unwrap one or two layers of JSON to land on the object.
function evalScenario(scenario) {
  const script = buildScenarioScript(scenario);
  const raw = run("agent-browser", ["--session", SESSION, "eval", "--stdin"], { input: script });
  let value = raw.trim();
  try {
    value = JSON.parse(value);
  } catch {
    /* not quoted */
  }
  if (typeof value === "string") {
    value = JSON.parse(value);
  }
  if (value && value.error) {
    throw new Error(
      `Scenario failed (${scenario.institution} / ${scenario.cibil} / ${scenario.empKey}): ${value.error}`
    );
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

    return JSON.stringify({
      institution: scenario.institution,
      institution_type: scenario.institutionType,
      cibil_score: scenario.cibil,
      employment_type: scenario.employment,
      interest_rate: text(currentRow.querySelector(".rate")),
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
    "institution_type",
    "cibil_score",
    "employment_type",
    "interest_rate",
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

  console.log(
    `Scraping ${INSTITUTIONS.length} institutions × ${CIBIL_SCORES.length} CIBIL points × ${EMPLOYMENTS.length} employment = ${scenarios.length} rows`
  );

  const resultRows = [];
  let done = 0;
  for (const scenario of scenarios) {
    resultRows.push(evalScenario(scenario));
    done += 1;
    if (done % 50 === 0) console.log(`  ...${done}/${scenarios.length} scenarios scraped`);
  }

  writeCsv(resultRows);
  console.log(`\nWrote ${resultRows.length} rows to ${OUTPUT}`);
} finally {
  try {
    run("agent-browser", ["--session", SESSION, "close"], { stdio: "ignore" });
  } catch {}
  if (server) server.kill("SIGTERM");
}
