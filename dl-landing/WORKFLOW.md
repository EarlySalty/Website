# Landing-Page Redesign

## Ziel
Die Hauptseite deutsche-deadlock-community.de zum Aushängeschild der Community machen: stylisch, klar navigierbar, alle Community-Tools sauber erreichbar.

## Status
**In Bearbeitung** – HTML-Worker 1 fertig, CSS/JS offen (2026-04-13)

## Aufgaben

### HTML (alle 4 Seiten: index, mitspieler, coaching, streamer)
- [x] Logo → „Deutsche Deadlock Community" als Gradient-Text
- [x] Header umstrukturieren: Hamburger links | Logo | Beitreten rechts
- [x] Nav-Drawer HTML einbauen (Slide-In von links, alle Links strukturiert)
- [x] Services-Hub-Sektion entfernen (nur index.html, Zeilen 232–274)
- [x] Footer auf 4 Spalten (neu: Plattformen + AGB im Rechtliches-Block)

### CSS (site.css)
- [x] `.menu-button` immer sichtbar (kein `display: none` mehr)
- [ ] `.nav-links` im Header entfernen (nav-drawer übernimmt)
- [x] Nav-Drawer CSS hinzufügen (Backdrop, Panel, Labels, Links)
- [x] Footer-Grid auf 4 Spalten, Responsive anpassen
- [x] Button-Shadow: `rgba(255,122,24,...)` → `rgba(6,182,212,...)`
- [x] Button-Border-Fix: `border: none` auf Primary-Button

### JS (site.js)
- [x] `setupMobileMenu` → `setupNavDrawer` mit is-open Klasse, Backdrop-Click, Escape

## Fortschritt
- 2026-04-13: Worker 2 hat `src/site.css` und `src/site.js` für den neuen Nav-Drawer, Footer-Grid und Button/Header-Fixes umgesetzt.
- 2026-04-13: Nav-Fix linksbündig in `src/site.css` ergänzt, Domains in `mitspieler/`, `coaching/` und `streamer/` aktualisiert sowie `public/robots.txt` und `public/sitemap.xml` für die saubere Build-Ausgabe angepasst; Build/Verifikation erfolgreich.

## Entscheidungen
- Drawer slide-in von links, Backdrop-Click schließt ihn
- Discord-Link: `https://discord.gg/z5TfVHuQq2`
- Rechtliches Footer: `/twitch/impressum`, `/twitch/datenschutz`, `/twitch/agb`
- Nav-Drawer Struktur: Community (Start/Mitspieler/Coaching) | Streamer (Netzwerk/Onboarding/FAQ) | Plattformen (Turnier/Aktivität/Builds)

## Relevante Dateien
- `/home/naniadm/Documents/Website/dl-landing/index.html`
- `/home/naniadm/Documents/Website/dl-landing/mitspieler/index.html`
- `/home/naniadm/Documents/Website/dl-landing/coaching/index.html`
- `/home/naniadm/Documents/Website/dl-landing/streamer/index.html`
- `/home/naniadm/Documents/Website/dl-landing/src/site.css`
- `/home/naniadm/Documents/Website/dl-landing/src/site.js`

---
*Vorheriger Workflow (SEO & Bild-Fix) → abgeschlossen, wurde durch diesen ersetzt*

---

## /szene/ als lebende Auswertung (2026-08-22)

Die Seite `szene/index.html` enthält keine Zahlen. Sie holt beim Laden
`/szene/data/szene.json` und zeichnet daraus alle Diagramme.

### Was der Betrieb dafür braucht

- **Datenjob:** ein täglicher Lauf im Twitch-Bot (06:00) schreibt `szene.json`
  nach `/home/naniadm/Documents/Runtime/szene-stats` (Symlink auf das
  gleichnamige Verzeichnis unter `/home/nathanael/`). Das ist der einzige
  Laufzeitpfad, andere Ablagen gibt es nicht. Der Job liegt nicht in diesem Repo.
- **Caddy-Route:** `/szene/data/*` wird aus genau diesem Verzeichnis
  ausgeliefert, nicht aus `dist/`. Nötig sind Leserechte für Caddy,
  `Content-Type: application/json` und `Cache-Control: max-age=600`, so steht
  es in der Caddy-Konfiguration. Die Datei wechselt einmal täglich, zehn
  Minuten Vorhaltezeit sind dafür unkritisch; die Seite bittet deshalb auch
  nicht um einen frischen Abruf.
  Die Route ist seit dem 22.08.2026 eingerichtet und verifiziert. Sie muss
  Vorrang vor der statischen Auslieferung behalten, deshalb liegt im Repo
  bewusst keine Datei unter `public/szene/data/`.
- **Fehlerfall:** liefert die Route 404 oder etwas anderes als JSON, zeigt die
  Seite eine Meldung und verlinkt den Blogpost. Es bleibt also nie leer.

### Lokale Vorschau

Im Repo liegt keine Datendatei mehr. `/szene/data/*` liefert Caddy live aus
`/home/naniadm/Documents/Runtime/szene-stats`, deshalb würde eine mitgebaute Datei den echten Stand nur
verdecken. Wer die Seite lokal mit Zahlen sehen will, kopiert die aktuelle Datei
von Hand nach `dl-landing/public/szene/data/szene.json`; der Pfad ist in
`.gitignore` ausgenommen und landet nie im Commit. Ohne Datei zeigt die Seite
ihre Fehlermeldung und verlinkt den Blogpost, das ist der gewollte Zustand.

### JSON-Vertrag

Alle Feldnamen werden ausschließlich in `adapt()` in `szene/szene.js` gelesen.
Ändert sich der Vertrag, ist das die einzige Stelle, die angefasst wird.

```
{ generated_at, data_start, data_end, rows_used,
  snapshot_interval_seconds, weighting,
  weekly: [{ week, active_channels, primetime_concurrent_avg,
             primetime_viewers_avg, new_channels, last_seen_channels }],
  this_week: { week, active_channels, primetime_concurrent_avg, new_channels,
               delta_prev_week: { … } },
  survival: { overall: { d30: {n, rate}, d90: {…}, d180: {…} },
              network: {…}, rest: {…} },
  heatmap: [[24 Werte] × 7],
  viewer_classes: [{ label, share }],
  session_duration: [{ label, share }],
  concentration: { top10_share } }
```

Maßeinheiten, die die Seite fest annimmt:

- `generated_at`, `data_start` und `data_end` sind RFC-3339-Zeitstempel, die
  Seite kürzt die beiden Datumsfelder auf den Tag.
- Alle `share`- und `rate`-Werte sind Brüche zwischen 0 und 1, keine Prozente.
- `snapshot_interval_seconds` ist der aktuelle Median-Abstand zweier Messungen
  desselben Kanals und erscheint im Kopfstempel als Auflösung.
- `weighting` benennt das Gewichtungsverfahren der Gesamtzeitraum-Werte und
  wird im Methodik-Block ausformuliert. Bekannt ist
  `time_weighted_capped_600s`, jeder andere Wert erscheint als Verfahrensname.
- `this_week.week` ist der Montag der laufenden Woche und wird gebraucht, um
  die passende Zeile in `weekly` zu finden. `this_week` trägt keinen
  Zuschauerwert, den holt die Seite aus dieser Zeile.
- `heatmap` sind zeitgewichtete gleichzeitige Streams im Schnitt, keine
  Zählungen. Zeile 0 ist Montag, Spalte 0 ist 0 Uhr, alles in Berliner Zeit.
  Deshalb zeigt die Seite dort eine Nachkommastelle und in der Tabelle einen
  Tagesschnitt statt einer Summe.
- `weekly[].last_seen_channels` steht für die jüngsten Wochen systembedingt auf
  0, weil ein Abgang erst nach 30 Tagen ohne Sichtung feststeht. Die Seite
  lässt jede Woche weg, deren Sonntag hinter `data_end` minus 30 Tage liegt.

Fehlende Blöcke sind erlaubt: ein leerer oder fehlender Survival-Punkt wie
`survival.network.d30` blendet die Zeile aus, ein fehlender `heatmap`-Block
blendet die ganze Abbildung aus. Ohne `weekly` zeigt die Seite die
Fehlermeldung.

### Diagramm-Code

`niceScale`, `axisLabel`, `svgEl`, `fmt`, `buildTable`, `renderBars` und die
übrigen Zeichenfunktionen liegen seit 2026-08-22 einmal in `src/charts.js` und
werden von `/transparenz/`, dem Blogpost und `/szene/` gemeinsam genutzt.
`createCharts({ prefix })` liefert die Zeichenfunktionen mit den Klassennamen
der jeweiligen Seite.
