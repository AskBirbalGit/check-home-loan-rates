#!/usr/bin/env bash
# =============================================================================
# fetch-logos.sh — download lender logos via logo.dev into ./logos/
# -----------------------------------------------------------------------------
# The institutions we model live in js/data.js (name + type only, no domain).
# This script attaches a domain to each lender and pulls a 128px PNG logo from
# logo.dev. Filenames are name-derived slugs (logos/<slug>.png) so they're
# readable and stable regardless of any future domain changes.
#
# logo.dev returns HTTP 200 with a REAL logo, or HTTP 202 with a tiny generated
# monogram when it has no logo for the domain. We treat 202 (and suspiciously
# small files) as a "fallback" and warn so the domain can be corrected.
#
# Usage:  scripts/fetch-logos.sh
# Re-run any time; existing files are overwritten.
# =============================================================================
set -euo pipefail

# logo.dev publishable token. Override via env if it ever rotates.
TOKEN="${LOGO_DEV_TOKEN:-pk_SWusOBiJTFmmYOALCrh-zg}"
SIZE=128
FORMAT=png

# Resolve repo root (this script lives in scripts/).
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$ROOT/logos"
mkdir -p "$OUT"

# slug|domain — one lender per line. Slugs match js/data.js names.
# Domains verified against logo.dev (real logo, not a monogram fallback).
read -r -d '' LENDERS <<'EOF' || true
sbi|sbi.co.in
bank-of-india|bankofindia.co.in
bank-of-baroda|bankofbaroda.in
canara-bank|canarabank.com
union-bank-of-india|unionbankofindia.co.in
central-bank-of-india|centralbankofindia.co.in
icici-bank|icicibank.com
hdfc-bank|hdfcbank.com
axis-bank|axisbank.com
kotak-mahindra-bank|kotak.com
idfc-first-bank|idfcfirstbank.com
yes-bank|yesbank.in
rbl-bank|rblbank.com
au-small-finance-bank|aubank.in
ujjivan-sfb|ujjivansfb.in
jana-sfb|janabank.com
equitas-sfb|equitasbank.com
bajaj-housing-finance|bajajhousingfinance.in
tata-capital|tatacapital.com
lic-housing-finance|lichousing.com
pnb-housing-finance|pnbhousing.com
sammaan-capital|sammaancapital.com
muthoot-housing-finance|muthoothomefin.com
aavas-financiers|aavas.in
hinduja-housing-finance|hindujahousingfinance.com
home-first-finance|homefirstindia.com
aadhar-housing-finance|aadharhousing.com
cholamandalam-finance|cholamandalam.com
sk-finance|skfin.in
mas-financial|mas.co.in
jm-financial-services|jmfl.com
axis-finance|axisfinance.in
EOF

echo "Downloading logos -> $OUT (size=${SIZE}px, format=${FORMAT})"
echo

fail=0
warn=0
ok=0

while IFS='|' read -r slug domain; do
  [ -z "$slug" ] && continue
  url="https://img.logo.dev/${domain}?token=${TOKEN}&size=${SIZE}&format=${FORMAT}"
  dest="$OUT/${slug}.png"

  code=$(curl -s -w '%{http_code}' -o "$dest" "$url" || echo "000")
  bytes=$(wc -c < "$dest" | tr -d ' ')

  if [ "$code" = "200" ]; then
    printf "  ok       %-26s %s  (%s bytes)\n" "$slug" "$domain" "$bytes"
    ok=$((ok + 1))
  elif [ "$code" = "202" ]; then
    printf "  FALLBACK %-26s %s  (monogram, %s bytes) — fix domain\n" "$slug" "$domain" "$bytes"
    warn=$((warn + 1))
  else
    printf "  FAIL     %-26s %s  (HTTP %s)\n" "$slug" "$domain" "$code"
    rm -f "$dest"
    fail=$((fail + 1))
  fi
done <<< "$LENDERS"

echo
echo "Done: $ok real, $warn fallback(s), $fail failed."
[ "$fail" -eq 0 ]
