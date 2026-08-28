status: aktiv 2026-08-28

# Contract: Google Preferred Sources plus SEO-Grundlagen

## Ziel
Auf den öffentlichen Community-Seiten können Leser die Domain deutsche-deadlock-community.de per Knopf als bevorzugte Google-Quelle merken. Beim Klick auf interne Links lädt Chrome die nächste Seite vor. Sitemap und Generator bleiben vollständig.

## REQ
- REQ-1 Öffentliche Seiten mit Brand-Nav zeigen im Footer einen Knopf "Als bevorzugte Quelle merken". Klick startet Googles Preferred-Sources-Flow und bringt den Leser danach auf dieselbe Seite zurück. Schlägt Googles Skript fehl, öffnet sich der Deeplink zur Quellenauswahl.
- REQ-2 Das Google-Skript `publisher.js` wird erst beim Klick geladen, nicht bei jedem Seitenaufruf.
- REQ-3 Sprache Deutsch, dunkles Theme, Texte mit Umlauten, ohne Gedankenstrich.
- REQ-4 Caddy erlaubt das Skript und die Verbindung zu news.google.com auf den öffentlichen HTML-Pfaden. Dashboards, OBS-Docks, Overlay und Admin bleiben unverändert.
- REQ-5 Öffentliche HTML-Antworten tragen den Header Speculation-Rules auf `/brand/speculation.json`. Prerender gilt für gleiche Herkunft, nicht für `/twitch/*`, `/uplink/*`, Dashboards, `nofollow` und `_blank`.
- REQ-6 `/beitreten/` steht in der Sitemap. Der Generator löscht vorhandene Docs-, Blog- und FAQ-URLs nicht mehr.
- REQ-7 Die FAQ-Seite unter `/faq/` lädt Brand-Nav und damit denselben Knopf.

## INV
- INV-1 Keine neuen Secrets, keine neuen OAuth-Wege, keine neuen Flags.
- INV-2 Admin, Overlay, Pause-Loop, Uplink-Docks und Dashboard-CSP bleiben ohne news.google.com.
- INV-3 Footer-Linkziele und Discord-Invite bleiben unverändert.
- INV-4 Preferred Sources gilt nur domainweit für deutsche-deadlock-community.de, nicht für Unterpfade als eigene Quelle.
- INV-5 earlysalty.com/me, Vault, TradingBot und Admin-SPA bekommen den Knopf nicht.

## Nicht-Ziele
- Kein Ranking-Versprechen. Der Knopf macht die Seite nicht erst eligible.
- Kein Umbau der Landing-Inhalte, keine neue Marketingseite.
- Keine Search-Console-Klicks im Namen des Nutzers.
- Kein Preferred-Sources-Knopf in eingeloggten Dashboards.

## Erlaubter Bereich
- `/home/nathanael/repos/Website/dl-brand/`
- `/home/nathanael/repos/Website/scripts/build-sitemap.mjs`
- `/home/nathanael/repos/Website/dl-landing/public/sitemap.xml`
- `/home/nathanael/repos/Website/scripts/test-preferred-source.py` (neu)
- `/home/nathanael/repos/Deadlock-Docs/tools/faq_template.html`
- `/home/nathanael/repos/Deadlock-Docs/site/index.html` (Build-Ausgabe der FAQ)
- `/home/nathanael/repos/Caddy/hosts/v50671/Caddyfile`

## Verbotener Bereich
- Dashboard-, Overlay-, Dock- und Admin-CSP.
- Bot-Backends, Auth, Infisical.
- Community-Ankündigungen ohne Go.

## Offene Produktfragen
Keine. Preferred Sources ist der neue Knopf vom 20.08.2026. Speculation Rules ist die SEO-Leistung beim selben Durchgang.
