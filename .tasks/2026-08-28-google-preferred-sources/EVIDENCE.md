status: aktiv 2026-08-28

# Evidence: Preferred Sources und SEO-Bestand

## Offizielle Quelle
- Google Search Central, Stand 2026-08-20: https://developers.google.com/search/docs/appearance/preferred-sources
- Standard: `<script async src="https://news.google.com/swg/js/v1/publisher.js">` plus `<div google-add-preferred-source-btn>`.
- Eigenes UI: `preferred-sources-control="manual"`, dann `preferredSource.init({theme, lang})` und `preferredSource.addPreferredSource()`.
- Deeplink: `https://www.google.com/preferences/source?q=Your_Website's_URL`.
- Eligibility nur Domain/Subdomain, nicht Unterordner.

## Speculation Rules
- Chrome Docs: https://developer.chrome.com/docs/web-platform/prerender-pages
- Empfohlen: `prerender` mit `eagerness: moderate` auf Document-Links.
- CSP: `'inline-speculation-rules'` für Inline-Blöcke. Alternative: Header `Speculation-Rules` auf eine JSON-Datei derselben Herkunft.

## Einstieg Nav
- `dl-brand/nav.js:1` IIFE, hängt Elevator-Nav an `document.body`.
- `dl-brand/nav.js:92` Footer nur wenn `data-footer` nicht false und noch kein `footer`/`brand-footer` existiert.
- `dl-brand/README.md:3` Einbindung über `/brand/nav.js`.
- Caddy `hosts/v50671/Caddyfile:709` `handle_path /brand/*` → `Website/dl-brand`, Cache 3600s.

## Seiten mit Nav.js
- Homepage: `deco-elevator-new/index.html:27` plus eigener Footer `:235`.
- Landing: `dl-landing/index.html:131`, Footer `:457`.
- Weitere: mitspieler, coaching, streamer, helden, beitreten, blog, transparenz, guides, patch, activity, tierlist, dl-coaching. Tests: `scripts/test-phase1-elevator.py:8`.

## Seiten ohne Nav.js
- FAQ-Template `Deadlock-Docs/tools/faq_template.html:16` hat tokens.css, keinen Nav-Script. Footer `:283`.
- Docs-Korpus `Deadlock-Docs/public/index.html` ohne Brand-Nav.

## CSP öffentliche HTML
- Default `Caddyfile:198` script-src `'self' https://static.cloudflareinsights.com`, connect-src discord + cloudflare. Kein news.google.com, kein `'unsafe-inline'` für Scripts.
- Coaching `:229`, Patch `:236`, Turnier `:243`, Streamer `:416` und `:438`, Aktivität `:759`.
- Nicht anfassen: Dashboard `:210`, Overlay `:254`, Pause-Loop `:264`, Legal-Gate `:535`, Docks `:222`.

## Sitemap
- Live-Datei `dl-landing/public/sitemap.xml` enthält Docs, Blog, FAQ, Transparenz, Turnier. `/beitreten/` fehlt.
- Generator `scripts/build-sitemap.mjs:23` nur 10 Einträge (Home bis Builds). Lauf würde die restlichen locs löschen.
- SEO-Doku `docs/internal/seo-und-backlinks.md:1` beschreibt Search Console, IndexNow, Backlinks aus Own Properties.
