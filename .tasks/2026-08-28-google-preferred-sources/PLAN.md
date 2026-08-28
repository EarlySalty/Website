status: aktiv 2026-08-28

# Plan: Preferred Sources plus SEO

Ziel: CONTRACT.md. Belege: EVIDENCE.md.

## M1 Brand-Nav Knopf und Speculation-Datei
- `dl-brand/nav.js`: Footer-Knopf, Lazy-Load publisher.js, Deeplink-Fallback.
- `dl-brand/nav.css`: Stil passend zum Gold-Footer.
- `dl-brand/speculation.json`: prerender moderate, Ausschlüsse für Apps.
- Validierung: `python3 scripts/test-preferred-source.py`
- Stop: Test rot oder Knopf-Text mit Gedankenstrich.

## M2 Caddy CSP und Header
- news.google.com in script-src und connect-src der öffentlichen HTML-CSPs.
- Speculation-Rules-Header auf `/brand/speculation.json`.
- Validierung: `caddy validate`, Header live per curl.
- Stop: Dashboard-CSP hat Google oder validate scheitert.

## M3 Sitemap
- Generator behält bestehende locs und ergänzt `/beitreten/`.
- sitemap.xml um `/beitreten/` erweitern.
- Validierung: Test plus grep auf beitreten.
- Stop: Docs/Blog-URLs fehlen nach Generatorlauf.

## M4 FAQ
- faq_template.html lädt tokens + nav.css + nav.js.
- FAQ neu bauen, site/index.html prüfen.
- Validierung: Template-Test, `/faq/` enthält nav.js.

## M5 Live
- Caddyfile nach `/etc/caddy/Caddyfile`, reload.
- Browser: Homepage, Mitspieler, FAQ. Knopf sichtbar, Deeplink-Fallback ohne CSP-Fehler nach CSP-Fix.
- Stop: CSP blockt publisher.js oder Knopf fehlt im Footer.
