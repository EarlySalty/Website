#!/usr/bin/env bash
# Prüft an der echten HTTP-Antwort, ob Cloudflare Web Analytics laufen kann:
# die Seite muss den Beacon ausliefern und die CSP muss ihn durchlassen.
#
# Aufruf: scripts/check-beacon-live.sh [basis-url]
set -uo pipefail

BASIS="${1:-https://deutsche-deadlock-community.de}"
BEACON="https://static.cloudflareinsights.com"
RUM="https://cloudflareinsights.com"

# Routen mit Beacon. Bewusst draussen: /builds/admin, /report, /twitch/overlay,
# /twitch/pause-loop und die Demo-Dashboards.
ROUTEN=(
  /
  /beitreten
  /mitspieler
  /helden
  /transparenz
  /guides/anfaenger
  /survey
  /patch
  /builds
  /videos
  /aktivitaet
  /coaching
  /turnier
  /streamer
  /twitch/faq
  /twitch/onboarding
  /dokus
)

fehler=0
for route in "${ROUTEN[@]}"; do
  antwort=$(curl -sS --max-time 20 -D /tmp/beacon-header.$$ "${BASIS}${route}" 2>/dev/null)
  status=$(head -n1 /tmp/beacon-header.$$ | tr -d '\r' | awk '{print $2}')
  csp=$(grep -i '^content-security-policy:' /tmp/beacon-header.$$ | tr -d '\r')

  if [[ "$status" != "200" ]]; then
    printf 'FEHLT  %-22s HTTP %s\n' "$route" "${status:-keine Antwort}"
    fehler=1
    continue
  fi

  if ! grep -q 'static\.cloudflareinsights\.com/beacon\.min\.js' <<<"$antwort"; then
    printf 'FEHLT  %-22s Seite liefert keinen Beacon\n' "$route"
    fehler=1
    continue
  fi

  # Ohne CSP-Header gibt es nichts, was blocken koennte.
  if [[ -n "$csp" ]]; then
    script_src=$(tr ';' '\n' <<<"$csp" | grep -i 'script-src' | head -n1)
    connect_src=$(tr ';' '\n' <<<"$csp" | grep -i 'connect-src' | head -n1)
    if [[ -n "$script_src" && "$script_src" != *"$BEACON"* ]]; then
      printf 'BLOCKT %-22s script-src laesst den Beacon nicht zu\n' "$route"
      fehler=1
      continue
    fi
    if [[ -n "$connect_src" && "$connect_src" != *"$RUM"* ]]; then
      printf 'BLOCKT %-22s connect-src laesst den RUM-Upload nicht zu\n' "$route"
      fehler=1
      continue
    fi
  fi

  printf 'OK     %-22s Beacon ausgeliefert, CSP durchlaessig\n' "$route"
done

rm -f /tmp/beacon-header.$$
exit "$fehler"
