# Review-Runde 1: objectives-blogpost

Reviewer: frischer Thread, Rolle review_1. HEAD 5c3f1f5. Nur Lesen, nur diese Datei geschrieben.

## Zusammenfassung

Der Post ist zahlenseitig sauber. Alle Aggregate in `data.js` habe ich aus den Kapitel-JSONs
neu berechnet (K1 bis K8), sie stimmen exakt. Alle `data-fill`-Fallbacks in der `index.html`
decken sich mit den Werten, die `post.js` aus `data.js` rendert. Tiles, Fliesstext, Tabellen,
JSON-LD, `og`/`twitter`-Description, `llms.txt`, `llms-full.txt` und die Blog-Karte tragen
durchgaengig dieselben Zahlen. Ehrlichkeits-Anforderungen (Shrine als Spaetphase, Urne-zuerst
als Spielablauf, Laeufer nur 38,5 Prozent erkennbar zuerst genannt, Rift als Nullbefund,
Ranked-only plus Zeitfenster) sind alle erfuellt. Keine Em-Dashes im neuen Inhalt, echte
Umlaute, Zeiten in Minuten. Es bleiben nur Nits.

## Geprueft und in Ordnung

- **Zahlen gegen die Quelle** (nachgerechnet, nicht nur abgelesen):
  - K1 Midboss: 523.602 Matches, 98,8 % mit Midboss, 75,2 % First-Claim, 0,25 Steals/Match,
    128.398 Steals gesamt, 43,2 % nach Steal, 3,98 % Abbrecher. Passt.
  - K2 Urne: Nenner 523.747 (QD-Lauf, korrekt in `META.matches_qd`), 99,9 %, 1,90/Team,
    erste Abgabe 55,3 %, mehr Abgaben 68,3 %. Passt.
  - K3 Shrine: 1.146.494 gefallene, 91,3 % Verlierer-Besitz, 93,1 % Zerstoerer. Passt.
  - K5 Reihenfolge: alle_drei 517.380, Urne zuerst 99,2 %, Verteilung 40,2/44,0/13,4/2,4.
    Passt.
  - K6 Kontrolle: mb 89,5/70,8/45,7 (n 233.797/199.036/84.608), shr 96,2/87,9/75,7,
    urn 71,9/55,7/38,0 (n je Klasse exakt reproduziert). Passt.
  - K7 Zeitklassen: alle 51 Werte (gesamt, niedrig/mittel/hoch, Steal-Anteil, Schichtung
    vorn/gleich/hinten) je Klasse aus den Ranggruppen-Summen nachgerechnet, 0 Abweichungen.
    Mediane 1714/1127, 2119/1687, 900/900 s. Passt.
  - K8 Laeufer: abgaben_gesamt 1.986.811, bekannt 38,5 %, je Ranggruppe Siegquote, ueber-Median,
    Median-Vorsprung, Rang 1/2 und 5/6, Todesrate, Soul-Swing nachgerechnet. Helden-Liste
    `helden_hoch` ist exakt die Top 6 nach Ueberrepraesentations-Faktor (Calico 2,64 bis
    Lash 1,13). Passt.
- **SEO/Seite**: `og:image` (og-logo.png, 1200x630) gesetzt, JSON-LD mit `Article`/`BlogPosting`
  und `BreadcrumbList`, `wordCount` 3782 (grobe Zaehlung des Artikeltexts rund 3.800, plausibel),
  `dateModified` 2026-09-18T18:00 aktuell, `robots.txt`-Allow fuer den Post-Pfad in beiden
  Bot-Bloecken ergaenzt, `sitemap.xml`-lastmod 2026-09-18. Jede Figur hat eine Tabellenansicht.
  `countUp` respektiert `prefers-reduced-motion`. HBar-Prozentcharts auf `maxValue: 100` skaliert.

## Maengel

### Nit 1: HBar-Charts ohne figure-level aria-label
- **Datei:Zeile**: `dl-landing/src/charts.js` (`renderHBars`) sowie `post.js:75,98,114,138`
- **Befund**: Die SVG-Charts (`renderLine`/`renderBars`) bekommen ueber `chartFrame`
  `role="img"` plus `aria-label`. Die HBar-Charts (Reihenfolge, Kontrolle, k7-midboss/shrine/urne,
  k8-helden) rendern reine `div`-Balken ohne `role`/`aria-label`. Der Maszstab nennt "jede Figur
  mit passendem aria-label".
- **Schwere**: nit. Nicht blockierend, weil jeder HBar-Balken Name und Wert als echten Text
  enthaelt (Screenreader liest sie), Titel und Note als sichtbarer Text darueberstehen und jede
  Figur zusaetzlich eine Tabellenansicht hat.
- **Vorschlag**: `renderHBars` ein `role="img"` mit `aria-label` (oder `role="list"` mit
  `role="listitem"` je Balken) geben und in `post.js` je Chart ein `ariaLabel` durchreichen,
  analog zu den SVG-Charts.

### Nit 2: Tooltip-Beschriftung "min:s min"
- **Datei:Zeile**: `dl-landing/blog/deadlock-objectives-2026/post.js:38,65`
- **Befund**: Chart-Tooltips setzen `` `${mmss(...)} min` ``, ergibt zum Beispiel "28:47 min".
  Der min:s-Wert wird mit "min" beschriftet. Die Tabellen-Header sagen sauber "(min:s)".
- **Schwere**: nit. Nur im Tooltip, inhaltlich eindeutig.
- **Vorschlag**: entweder das nachgestellte " min" im Tooltip weglassen oder als "min:s" fuehren.

### Nit 3: Em-Dashes in llms.txt (Bestand, nicht aus diesem Post)
- **Datei:Zeile**: `dl-landing/public/llms.txt`
- **Befund**: Die Datei enthaelt 15 Em-Dashes. Sie stehen alle in den aelteren Blog-Eintraegen,
  der neu ergaenzte Objectives-Eintrag ist Em-Dash-frei.
- **Schwere**: nit, ausserhalb dieses Auftrags. Nur gemeldet, weil die Datei angefasst wurde.
- **Vorschlag**: bei Gelegenheit in einem eigenen Durchgang saeubern, nicht in dieser Runde.

## Urteil

**FREIGABE.** Blockierende Punkte: 0. Wichtig: 0. Nits: 3.
