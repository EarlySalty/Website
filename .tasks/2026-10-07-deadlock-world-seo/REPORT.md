# Umsetzung und Prüfbelege

## Stand

Die fünf öffentlichen Einstiege sind umgesetzt und lokal geprüft. Merge-Gate, Push, Auslieferung und Liveprüfung stehen noch aus. Dieser Zwischenstand ist keine Fertigmeldung.

## Änderungen und Suchintentionen

| Einstieg | Suchintention | Umsetzung |
| --- | --- | --- |
| `/` | Deutsche Deadlock Community, Deadlock deutsch | Stadtplakat, Heldenportrait-Reihe, blaue Mitspieler-Collage, gelbe Coaching-Bühne, Geisterabschluss |
| `/mitspieler/` | Deadlock LFG, Mitspieler | Industriegassen-Hero, vorhandener Turm und Live-Anzeige, ursprünglicher Tracking-Invite |
| `/beitreten/` | Deadlock Discord auf Deutsch | Nachtclub-Hero, direkter Beitritt und konkrete Schritte |
| `/coaching/` | Deadlock Coaching, deutschsprachiger Coach | Gemeinsamer Hero in statischem Build-HTML und React, bestehende Coachliste und Anfrage, ehrliche Zustände |
| `/patch/` | Deadlock Patchnotes auf Deutsch | Geister-Hero, vorhandener Verlauf, Filter und Originalquellen |

Individuelle Titles, Beschreibungen und Canonicals sind im gebauten HTML vorhanden. Keine neuen Meta-Keywords oder erfundenen strukturierten Daten. Private Coaching-Routen setzen noindex und verlassen den Gestaltungsscope. Sitemap und robots wurden nicht geändert. Kein neuer Backend-, Datenbank- oder Produktionslaufzeitpfad.

## Quellen und Nutzungsbasis

Die vier unveränderten Nutzeroriginale und ihre vollständigen Attachmentpfade stehen in `AUFTRAG.md`, Abschnitt Bildmaterial. Zuordnung: Rattenfigur/Stadt → `city`; Club → `club`; Industriegasse → `alley`; Geisterpassage → `ghost`. Die Weiterverwendung erfolgt für den ausdrücklich beauftragten Community-Auftritt. Eine pauschale Weiterverteilungslizenz für Valve-Material wird nicht behauptet. Der Footer nennt das inoffizielle Community-Projekt und Valve. Keine privaten Discord-Bilder oder Nutzernamen wurden übernommen. Die Portraitreihe verwendet sechs bereits vorhandene Heldenassets aus `/new/assets/heroes/`.

Beide Valve-Referenzen wurden vollständig gerendert geprüft. Die Referenzbelege stehen in `VISUELLE-PRAEZISIERUNG.md` und `REFERENZEN-VOLLSTAENDIG.md`. Übernommen wurden Druckmaterial, Plakatschrift und wechselnde Kompositionen; Valve-Fonts wurden nicht kopiert.

Skranji Bold und Barlow Condensed Bold stammen aus dem Google-Fonts-Repository, jeweils `ofl/skranji` bzw. `ofl/barlowcondensed` auf https://github.com/google/fonts . Die OFL-Dateien liegen neben den lokalen Fonts. Die SVG-Körnung wurde selbst erstellt.

Bildoptimierung mit vorhandenem ffmpeg: WebP quality 78, AVIF libaom CRF 34, still-picture, Breiten 960 und 1920. Desktop-AVIFs liegen zwischen 43.037 und 121.848 Bytes, mobile zwischen 19.070 und 50.846 Bytes. WebP-Fallbacks maximal 152.386 bzw. 62.126 Bytes. Mobile Ausschnitte entstehen im Layout; es gibt keine separaten mobilen Crop-Dateien. Hero priorisiert, tiefe Bilder lazy, Bilddimensionen reserviert.

## Befehle und Resultate

Im eigenen Worktree `/home/nathanael/.worktrees/website-deadlock-world-20261007`:

- `npm --prefix dl-landing run build`, `npm --prefix dl-coaching run build`, `npm --prefix dl-patch run build`: jeweils Exit 0. Patch meldet eine zur Laufzeit aufzulösende bestehende `/fonts/sora-latin.woff2`-Referenz; der echte Browserlauf meldet keinen Ladefehler.
- `npm --prefix dl-coaching run lint` und `dl-coaching/node_modules/.bin/tsc --noEmit -p dl-coaching/tsconfig.node.json`: Exit 0.
- `npm --prefix dl-coaching test`: 21 passed, 0 failed, 0 skipped. `npm --prefix dl-patch test`: 1 passed, 0 failed, 0 skipped.
- `python3 scripts/test-phase1-elevator.py`: 4 passed. `python3 scripts/test-phase2b-subpages.py`: 4 passed. `python3 scripts/test-phase3-footer-links.py`: 3 passed. `python3 scripts/test-mitspieler-tower.py`: 10 passed. Jeweils Exit 0, keine übersprungenen Tests.
- `node /home/nathanael/Documents/claude-config/skills/impeccable/scripts/detect.mjs --json deco-elevator-new/index.html dl-brand/world.css dl-landing/mitspieler/index.html dl-landing/beitreten/index.html dl-coaching/src/components/CoachingPublic.tsx dl-coaching/src/pages/CoachesPage.tsx dl-patch/index.html`: `[]`, Exit 0.

Die erste Testserie hatte fünf Vertragsfehler. Footerlinks, Mitgliederstatistik und Tracking-Invite wurden erhalten bzw. wiederhergestellt. Der an das entfernte Hero-PNG gekoppelte Unterseitentest prüft jetzt die responsive Bildstruktur. Keine Suite wurde entfernt, abgeschwächt oder übersprungen. Ein unveränderter Baselinelauf wurde nicht behauptet.

TESTNACHWEIS[TW-1]: 43 passed, 0 ignored | Baseline: nicht gemessen rot
TEXTNACHWEIS[DR-1]: Gedankenstriche 0 | ae/oe/ue/ss-Ersatz 0 | Absolutwörter 0 belegt | Senke: neue öffentliche Seitentexte

## Browserbelege

`WORLD_OUT=/tmp/deadlock-world-confirm-20261007 xvfb-run -a node /tmp/deadlock-world-browser-20261007.cjs`: Exit 0. Isolierter eigener Brave-/Playwright-Prozess, keine persönliche Browsersitzung. Read-only-Proxy für echte öffentliche API-Antworten, keine Live-Mockdaten. Analytics-/Google-Aufrufe sind im Prüfbrowser unterdrückt und werden nicht mitgeprüft.

20 Routen-/Breiten-/JavaScriptkombinationen: 390 und 1440 px, fünf Einstiege, JS an/aus. Dokumentbreite höchstens Viewportbreite, genau eine H1, individuelle Canonicals und Titles, keine Anwendungsausnahmen, keine Console-Fehler, geprüfte sichtbare Bilder geladen. Die Patch-Timeline scrollt innerhalb ihres Containers. Zehn Tastaturmenüprüfungen erfolgreich. Turmetagenwechsel und Patchfilter jeweils auf beiden Breiten erfolgreich. Coaching-Anfrage erreicht `/coaching/anfrage`, setzt noindex und entfernt den öffentlichen Scope; Zurücknavigation stellt den Übersichtstitel wieder her. Helden, Anfänger-Guide und Blog haben auf beiden Breiten ihre H1 und keinen World-Scope.

Viewportbelege unter `/tmp/deadlock-world-confirm-20261007/`: `home-390-js-top.png`, `home-1440-js-top.png`, `home-1440-js-coaching.png`, `coaching-390-nojs-top.png`, `desktop-overview.png`, `mobile-overview.png`, weitere routebezogene Top-/Middle-Ansichten. Messergebnisse: `results.json`. Zwei gebündelte Sichtprüfungsrunden beendet, keine zusätzliche Polierschleife.

## Noch offen

Der zentrale Gate muss den committed Stand freigeben. Erst danach folgt der autorisierte Fast-Forward-Push und die statische Auslieferung des aktuellen Remote-main. Kein Bot-Neustart ist erforderlich. Mergeprotokoll und LIVEBEWEIS werden nach tatsächlichem Abschluss ergänzt.
