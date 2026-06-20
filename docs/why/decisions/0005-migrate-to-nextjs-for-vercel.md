# 0005 — Migrate to Next.js (App Router) for first-class Vercel deployment

- **Status:** Accepted
- **Date:** 2026-06-20
- **Tags:** deploy, architecture, calculator
- **Touches:** package.json, app/, lib/, next.config.ts, index-v2.html, js/data.js, js/app-v2.js
- **Supersedes:** [0002](0002-single-file-static-calculator.md) (the zero-build single-file approach)

## Context

The project was a zero-build static site (decision 0002 / 0003): `index-v2.html` plus
`js/data.js` (the `RateEngine`), `js/app-v2.js` (UI glue + savings math), and `css/styles*.css`,
deployed to Vercel as raw static assets via a `vercel.json` rewrite. The user asked to make the
app "Vercel equivalent" — to run as a first-class Vercel app rather than static files behind a
rewrite — and explicitly chose a Next.js conversion over keeping the static site or wrapping it
in a thin build tool.

## Decision

Convert the app to **Next.js 15 (App Router) + React 19 + TypeScript**, the framework Vercel is
built around and detects/optimises with zero configuration. Concretely:

- Rate engine, bank-picker data, and savings math move from the browser-global IIFE files into
  typed library modules: `lib/rate-engine.ts`, `lib/banks.ts`, `lib/savings.ts`. The
  granular-averaging algorithm and the amortisation math are ported **verbatim** so outputs are
  byte-for-byte identical.
- The entire `index-v2.html` + `js/app-v2.js` flow becomes one client component,
  `app/Calculator.tsx`, rendered by `app/page.tsx` under `app/layout.tsx`.
- The two existing stylesheets (`css/styles.css`, `css/styles-v2.css`) are kept as-is and imported
  in the layout; the only change is the two font-family tokens now point at `next/font` CSS
  variables instead of a Google Fonts `<link>`.
- Security + cache headers move from `vercel.json` into `next.config.ts` `headers()`. `vercel.json`
  and `.vercelignore` are deleted — Vercel auto-detects the Next.js preset.

## Rationale (the why)

The user explicitly picked this path. Beyond that: Next.js is Vercel's native target, so deploys
need no `vercel.json` — the framework preset, build command, output, caching, and CDN are wired
automatically. Moving the rate/savings logic into typed `lib/` modules makes the math testable and
type-checked (the build now type-checks the whole app) without changing any numbers — verified the
canonical 40L · 8.60→7.30 · 18y case still yields ₹12,39,798 max / ₹6,78,188 reduce-EMI / ₹3,140
mo / 34 months. Reusing the existing CSS untouched preserves the whole Birbal design system and
the stacked-box v2 layout; only the font loader changed (to `next/font`, which self-hosts the
fonts at build time and removes the runtime request to Google). The page stays fully static —
it prerenders to HTML (`○ (Static)` in the build output) and hydrates the calculator on the
client, so there's no server cost and the same CDN-served performance as before.

## Consequences

- The app now has a build step and a `node_modules` dependency tree (Next/React/TypeScript +
  toolchain), where before it was zero-dependency. This is the tradeoff for the framework
  integration the user asked for; supersedes 0002's "no build, no dependencies" stance.
- Rate-sheet updates now edit `lib/rate-engine.ts` (typed array) instead of `js/data.js`.
- Decision 0003's "modular files for parallel agents" still holds in spirit — the modules are now
  `lib/*.ts` with typed contracts instead of `window.*` globals.
- `next lint` is deprecated in Next 16; a future migration to the ESLint CLI may be needed.

## Alternatives considered

- **Keep the static site, just verify the existing `vercel.json`** — already working, lowest
  effort, but the user explicitly wanted a real Next.js app.
- **Wrap the existing HTML/JS in Vite** — produces a `dist/` bundle but isn't Vercel-native and
  adds tooling without the framework benefits (typed server, routing, `next/font`, image/asset
  optimisation) that motivated the move.
