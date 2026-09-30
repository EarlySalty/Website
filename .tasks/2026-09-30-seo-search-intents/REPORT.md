# Suchintentionen aus der Search Console

## Auftrag und Abgrenzung

Die vorhandenen öffentlichen Seiten sollen die im Screenshot sichtbaren Suchen beantworten, ohne neue Keyword-Duplikate oder einen Designwechsel. Der Screenshot zeigt zehn von dreißig Suchanfragen, aber weder Zeitraum noch durchschnittliche Positionen. Daraus wird keine Ursache für niedrige Klickzahlen und keine Ranking-Prognose abgeleitet.

| Suchgruppe | Bestehende Zielseite | Sichtbare Ausgangswerte |
| --- | --- | --- |
| deadlock deutsch / german / community | `/` | 135 / 22 / 16 Impressionen, jeweils 0 Klicks |
| deadlock discord deutsch | `/beitreten/` | 37 Impressionen, 0 Klicks |
| deadlock coaching / coach | `/coaching/` | 33 / 11 Impressionen, 1 / 0 Klicks |
| deadlock lfg | `/mitspieler/` | 3 Impressionen, 0 Klicks |
| deadlock patch notes | `/patch/` | 6 Impressionen, 0 Klicks |

Unklare Suchbegriffe und DBD-Mischanfragen führen nicht zu erfundenen Angeboten oder neuen Seiten. Deutsch/German werden als dieselbe Sprachintention behandelt.

## Tatsächlich ausgelieferte Quellen

- `/`: `deco-elevator-new/index.html`, direkt statisch. Nicht die alte `dl-landing/index.html`.
- Beitreten und Mitspieler: `dl-landing/dist`, Vite-Multipage-Einträge.
- Coaching: `dl-coaching/dist`, React-Anwendung. Nicht die ungenutzte `dl-landing/coaching/index.html`.
- Patch-Verlauf: `dl-patch/dist`.
- Sitemap und öffentliche Textzusammenfassungen: `dl-landing/public`, beim Build nach `dist` kopiert.

Caddy-Routen, Backends, Authentifizierung, Bot-Dienste und Streamer-Website werden nicht umgestellt. Ein statischer Website-Deploy benötigt keinen Bot-Neustart.

## Änderungen

Seitentitel, Beschreibungen, Open Graph, Twitter-Texte, sichtbare Überschriften und WebPage-Daten stimmen je Suchintention überein. Die bestehenden URLs und das Markendesign bleiben erhalten. Die Startseite verlinkt ausdrücklich den Discord-Einstieg und direkt das kanonische `/patch/` statt `/patchnotes/`.

Beitreten beantwortet Einstieg, Voice und Hilfe; die Mitspielerseite erklärt Gruppenwahl und LFG; die Patch-Seite erklärt Filter und Quellenstand. Native aufklappbare Antworten halten die Seiten übersichtlich. Die jeweiligen Tracking-Invites bleiben unverändert: `GrdVBQtf2y` für Mitspieler, `PhkP3WgY7w` für die übrigen angefassten Seiten.

Die Coaching-Seite enthält bereits im ersten HTML-Abruf das öffentliche Angebot, den Ablauf, weiterführende Links und Fragen. Vite rendert dafür dieselben reinen React-Komponenten wie die interaktive Seite. Es werden keine Profile, Bewertungen, Anmeldungen oder anderen personenbezogenen Daten beim Build abgefragt. Die aktuelle Coach-Liste und Terminverwaltung bleiben interaktiv. Die Navigation setzt passende Metadaten; öffentliche Coach-Profil-IDs dürfen numerisch oder UUIDs sein.

Grenze: Tiefe SPA-Routen erhalten von Caddy zunächst dieselbe öffentliche HTML-Hülle. Ihre eigenen Metadaten und das `noindex` für persönliche Ansichten werden erst nach JavaScript-Ausführung gesetzt. Das ist keine serverseitige Zugriffssperre und kein Ersatz für die unveränderte Authentifizierung. Es werden keine persönlichen Inhalte vorgerendert.

Reveal-Animationen verdecken die bearbeiteten statischen Seiten nicht mehr bei abgeschaltetem JavaScript. Unbelegte Superlative und Sofort-Zusagen wurden in den angefassten Einstiegen und den allgemeinen Textzusammenfassungen entfernt. Historische Blog-Auswertungen bleiben unverändert. Die Patch-Seite verspricht keine vollständige Übersetzung aller Originalquellen.

Die fünf materiell geänderten Sitemap-Einträge tragen den 30.09.2026. Der Generator verwendet für weitere Läufe Commit-Daten statt Checkout-Dateizeiten und für Coaching die tatsächlich ausgelieferten Quellen. Ohne vorhandenen Docs-Quellbaum bleiben dessen bestehende URLs erhalten; fehlende Quellen bekommen kein erfundenes Tagesdatum. Robots-Regeln wurden nicht verändert.

## Reproduzierbare Prüfung

Zuerst in `dl-landing`, `dl-coaching` und `dl-patch` jeweils `npm ci` und `npm run build`. Getestet wurde mit frisch aus den Lockfiles installierten Abhängigkeiten, nicht nur mit dem älteren `node_modules` des Live-Checkouts.

Danach:

```text
cd dl-coaching
npm run lint
./node_modules/.bin/tsc --noEmit -p tsconfig.node.json
npm test

cd ../dl-patch
npm test

cd ../dl-landing
npm run test:seo
```

Ergebnis der Vor-Merge-Prüfung: alle drei Builds erfolgreich; Coaching-Linter und Vite-Konfigurations-Typecheck erfolgreich; Coaching 19/19, Patch 1/1, SEO-Artefaktverträge 10/10. Die SEO-Prüfung scheitert absichtlich bei fehlenden Builds und prüft die tatsächlich ausgelieferten Artefakte, nicht die alten parallelen Landing-Dateien.

Zusätzlich bestanden: Elevator 4/4, Unterseiten 4/4, Footer 3/3, Mitspieler-Turm 10/10. Die Footer-Erwartung wurde ausschließlich auf den direkten Patch-Link und die neue Discord-Beschriftung angepasst.

Browser-Preview in Chromium: fünf Seiten, 390 und 1440 Pixel Breite, jeweils mit und ohne JavaScript, insgesamt 20 Kombinationen. Jeweils eine sichtbare H1, korrektes Canonical, kein horizontaler Seitenüberlauf und keine JavaScript-Ausnahme. Hin- und Rücknavigation zwischen Coaching und Anfrage setzt die Metadaten zurück. Der Preview verwendet bewusst lokale API-Fixtures und keine Produktionsanmeldung. Ergebnisse und Screenshots liegen lokal unter `/tmp/website-seo-preview/`; diese Preview ist kein Live-Beweis.

### Bereits vorhandene Prüfprobleme

Unverändert auch auf dem kanonischen `main` reproduziert:

- `test-phase0-brand-patch.py`: zwei Subtests vergleichen ein Favicon-Tag bytegenau und lehnen die gleichwertige selbstschließende Schreibweise in Blog und Wohin ab.
- `test-phase2-wordmark.py`: erwartet im unveränderten Coaching-Brand-Link zusätzlich den früheren Text `Coaching-Etage`.
- `test-phase4-logo-round.py`: das System-Python hat kein Pillow (`PIL`).

Diese Altbefunde werden nicht als erfolgreiche Prüfungen ausgegeben. Die betroffenen fremden Inhalte beziehungsweise alten Erwartungen werden für diesen SEO-Auftrag nicht umgeschrieben.

## Auswertung nach dem Ausrollen

Erst nach erneutem Crawling vergleichbare Zeiträume je Suchgruppe und Zielseite in Search Console betrachten: Impressionen, Klicks, CTR und Position gemeinsam. Ein besser passender Seitentitel garantiert weder die von Google gewählte Darstellung noch eine bessere Platzierung. Es werden keine Backlink-Posts, Nachrichten, automatischen Search-Console-Anmeldungen oder Ranking-Zusagen erzeugt.

Fachliche Referenz: Google Search Central, Titel-Links, JavaScript-SEO, Sitemap-lastmod und Spamrichtlinien. Technische Referenz: Vite `transformIndexHtml` und SSR-Modullader.
