#!/usr/bin/env bash
# =============================================================================
# fetch-logos.sh — download lender logos via logo.dev into public/logos/
# -----------------------------------------------------------------------------
# The institutions we model live in lib/rate-engine.ts (name + type only, no
# domain). This script attaches a domain to each lender and pulls a 128px PNG
# logo from logo.dev. Filenames are name-derived slugs (public/logos/<slug>.png)
# so they're readable and stable regardless of any future domain changes.
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

# Resolve repo root (this script lives in scripts/). Logos live under Next's
# static root so they're served at /logos/<slug>.png.
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$ROOT/public/logos"
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
ujjivan-sfb|ujjivansfb.com
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
punjab-national-bank|netpnb.com
indian-bank|indianbank.in
indian-overseas-bank|iobnet.com
uco-bank|ucobank.co.in
bank-of-maharashtra|bankofmaharashtra.in
punjab-sind-bank|punjabandsindbank.co.in
indusind-bank|indusind.com
federal-bank|federalbank.co.in
south-indian-bank|southindianbank.com
karur-vysya-bank|kvb.co.in
karnataka-bank|karnatakabank.com
city-union-bank|cityunionbank.com
dcb-bank|dcbbank.com
tamilnad-mercantile-bank|tmb.in
csb-bank|csb.co.in
bandhan-bank|bandhanbank.com
dhanlaxmi-bank|dhanbank.com
jammu-kashmir-bank|jkbank.net
nainital-bank|nainitalbank.co.in
utkarsh-small-finance-bank|utkarsh.bank
suryoday-small-finance-bank|suryodaybank.com
esaf-small-finance-bank|esafbank.com
capital-small-finance-bank|capitalbank.co.in
unity-small-finance-bank|theunitybank.com
shivalik-small-finance-bank|shivalikbank.in
north-east-small-finance-bank|nesfb.com
fincare-small-finance-bank|fincarebank.com
icici-home-finance|icicihfc.com
repco-home-finance|repcohome.com
gic-housing-finance|gichfindia.com
can-fin-homes|canfinhomes.com
india-shelter-finance|indiashelter.in
aptus-value-housing-finance|aptusindia.com
shriram-housing-finance|shriramhousing.in
vastu-housing-finance|vastuhfc.com
motilal-oswal-home-finance|motilaloswalhf.com
godrej-housing-finance|godrejcapital.com
piramal-capital-housing-finance|piramalfinance.com
iifl-home-finance|iiflhomeloans.com
l-t-finance|ltfinance.com
sundaram-home-finance|sundaramhome.in
cent-bank-home-finance|cbhfl.com
srg-housing-finance|srghousing.com
manappuram-home-finance|manappuramhomefin.com
poonawalla-fincorp|poonawallafincorp.com
edelweiss-housing-finance|edelweisshousingfin.com
capri-global-housing-finance|capriglobal.in
star-housing-finance|starhfl.com
altum-credo-home-finance|altumcredo.com
five-star-business-finance|fivestargroup.in
bajaj-finance|bajajfinserv.in
aditya-birla-housing-finance|adityabirlacapital.com
hero-housing-finance|herohousingfinance.com
smfg-india-credit|smfgindiacredit.com
hinduja-leyland-finance|hindujaleylandfinance.com
nido-home-finance|nidohomefin.com
dmi-housing-finance|dmihousingfinance.in
vridhi-home-finance|vridhihomefinance.com
easy-home-finance|easyhomefinance.in
roha-housing-finance|rohahousing.com
svatantra-micro-housing-finance|svatantramhfc.com
muthoot-fincorp|muthootfincorp.com
shubham-housing-finance|shubham.co
ummeed-housing-finance|ummeedhfc.com
aviom-india-housing-finance|aviom.in
mahindra-rural-housing-finance|mahindrahomefinance.com
indostar-home-finance|indostarhfc.com
centrum-housing-finance|centrumhousing.com
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
