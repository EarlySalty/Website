status: aktiv 2026-08-28

# Research: Google Preferred Sources

Belege in EVIDENCE.md. Hier nur die Schlussfolgerungen.

## Was "Google prevered" ist
Gemeint ist Preferred Sources, nicht Prerender. Google hat am 20.08.2026 den einbettbaren Knopf veröffentlicht. Leser merken eine Domain als bevorzugte Quelle. Danach taucht sie für diese Person häufiger in Top Stories auf und kann in AI Overviews und AI Mode das Label "preferred" tragen. Eligibility liegt auf Domain- oder Subdomain-Ebene. Ein Unterordner wie `/blog` ist keine eigene Quelle.

Der Knopf macht eine Seite nicht erst eligible. Er ist ein Weg für bestehende Leser, die Auswahl ohne Umweg über die Google-Einstellungen zu setzen. Ranking für alle anderen Suchenden ändert sich dadurch nicht.

## Einbau
Drei offizielle Wege: Standard-Div, eigenes UI plus SDK, Deeplink. Für uns: eigenes UI in der Brand-Nav, SDK erst beim Klick, Deeplink als Fallback. Sprache `de`, Theme `dark`. Skript: `https://news.google.com/swg/js/v1/publisher.js`.

## Anknüpfung im Bestand
`dl-brand/nav.js` hängt schon auf Homepage, Landing-Unterseiten, Patch, Tierlist, Activity, Coaching, Blog, Streamer-V1. Footer existiert auf fast allen diesen Seiten. Nav.js ist der einzige sinnvolle Einstieg, sonst müsste derselbe Knopf in Dutzende HTML-Dateien.

`/brand/*` wird ohne Build live aus `dl-brand` gelesen. Caddy setzt CSP. Die Default-CSP erlaubt `'self'` plus Cloudflare, nicht news.google.com. Ohne CSP-Änderung stirbt der Klick im Browser.

FAQ und Docs-Korpus laden Nav.js bisher nicht. FAQ bekommt Nav. Die vielen Docs-HTML-Dateien bleiben in diesem Schnitt außen vor.

## SEO-Befund
Landing, Blog und FAQ haben Titel, Canonical, Open Graph, JSON-LD, robots, llms.txt, IndexNow. Das ist tragfähig.

Lücken, die in diesem Auftrag liegen:
- Speculation Rules fehlen komplett. Chrome kann interne Klicks vorbereiten. Datei plus Response-Header, kein Inline-Skript, weil Default-CSP kein `'unsafe-inline'` für Scripts hat.
- `/beitreten/` ist in der Nav, fehlt in der Sitemap.
- `scripts/build-sitemap.mjs` kennt nur 10 URLs. Ein Lauf würde Blog, FAQ und Docs aus der Live-Sitemap löschen.

Nicht in diesem Auftrag: Search Console manuell bedienen, Backlink-Spam, Inhalte umschreiben.
