# Review-Runde 1: objectives-blogpost

Reviewer: frischer Thread, Rolle review_1. Nur lesen und `REVIEW.md` schreiben, keinen Code ändern.

## Gegenstand

Blogpost `dl-landing/blog/deadlock-objectives-2026/` (index.html, data.js, post.js, post.css)
plus `blog/index.html`, `public/{robots.txt,sitemap.xml,llms.txt,llms-full.txt}`,
`vite.config.js`, `src/charts.js` auf Branch `feat/blog-objectives-seite` (HEAD 5c3f1f5,
identisch mit main, live unter https://deutsche-deadlock-community.de/blog/deadlock-objectives-2026/).
Diff gegen 63e193f (Stand vor dem Auftrag): `git diff 63e193f..HEAD -- dl-landing`.
Datenquelle: `.tasks/2026-09-17-objectives-blogpost/data/` (FINDINGS.md, kapitel-1..8.json,
methodik.json, plausibilitaet*.json). Auftrag des Autors: `AUFTRAG-B.md` im selben Ordner.

## Prüfmaßstab (bindend)

1. `~/.claude/skills/daten-blogpost/SKILL.md`, Abschnitt "Was der Kritiker jedes Mal findet":
   jede Zahl gegen die Kapitel-JSONs, Zahlen an mehreren Stellen identisch (Kacheln, Text,
   Tabellen, llms-full.txt, JSON-LD, description), Summen gehen auf, Nenner überall, gleiche
   Bezeichnung gleiche Definition, Mittel und Median benannt, Wirkungsaussagen nur mit
   Kontrolle, Selektionsfilter offengelegt, Nullbefunde als Ergebnis.
2. Sprache: echte Umlaute, keine Em-Dashes, Spielersprache im Haupttext, Fachwörter nur in der
   Methodik, kein KI-Klang, keine Ersatzschreibung. Zeiten in Minuten.
3. Seite und SEO: og:image, JSON-LD BlogPosting plus BreadcrumbList, wordCount aus dem Artikel,
   dateModified aktuell, robots.txt-Allow nur für den Post-Pfad, Sitemap-lastmod, jede Figur
   mit Tabellenansicht und passendem aria-label, Prozentbalken auf 100 skaliert,
   reduced-motion.
4. Inhaltliche Ehrlichkeit: Shrine-93 % als Spätphase eingeordnet, Urne-zuerst-99 % als
   Spielablauf, Läufer nur in 38,5 % erkennbar steht vorn, Rift als Nullbefund, Ranked-only
   und Zeitfenster genannt.

## Ausgabe

`.tasks/2026-09-17-objectives-blogpost/REVIEW.md`: Mängelliste, je Mangel Datei:Zeile, Befund,
Schwere (blockierend, wichtig, nit), Vorschlag. Am Ende Urteil FREIGABE oder NACHBESSERN mit
Anzahl blockierender Punkte. Datei committen und auf `feat/blog-objectives-seite` pushen
(nur diese eine Datei). Nicht nach main mergen, nichts sonst ändern.

## Rahmen

- Du bist der einzige Thread für dieses Paket. Keine Unter-Threads oder Unter-Agenten spawnen.
- Meldet ein Stop-Hook "offene Branch-Arbeit, erst mergen": in einem Satz melden, was offen
  bleibt, und stoppen. Nichts mergen, Hook und State-Datei nicht anfassen.
- Fertigmeldung im eigenen Thread mit Urteil und Zahl der Mängel je Schwere, dann stoppen.
