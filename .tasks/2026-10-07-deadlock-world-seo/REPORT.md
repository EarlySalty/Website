# Umsetzung und Prüfbelege

## Stand

Die fünf öffentlichen Einstiege sind umgesetzt, zentral freigegeben, nach main gepusht, statisch ausgeliefert und live geprüft. Produktstand: `6b217488cb5c85b169ce7afbd43a5521adc4d036`, Implementierungscommit `05de267`. Die abschließende Berichtssicherung und das anschließende Entfernen des eigenen Branches/Worktrees erfolgen nach den unten dokumentierten Nachweisen.

## Änderungen und Suchintentionen

| Einstieg | Suchintention | Umsetzung |
| --- | --- | --- |
| `/` | Deutsche Deadlock Community, Deadlock deutsch | Stadtplakat, Heldenportrait-Reihe, blaue Mitspieler-Collage, gelbe Coaching-Bühne, Geisterabschluss |
| `/mitspieler/` | Deadlock LFG, Mitspieler | Industriegassen-Hero, vorhandener Turm und Live-Anzeige, ursprünglicher Tracking-Invite |
| `/beitreten/` | Deadlock Discord auf Deutsch | Nachtclub-Hero, direkter Beitritt und konkrete Schritte |
| `/coaching/` | Deadlock Coaching, deutschsprachiger Coach | Gemeinsamer Hero in statischem Build-HTML und React, bestehende Coachliste und Anfrage, ehrliche Zustände |
| `/patch/` | Deadlock Patchnotes auf Deutsch | Geister-Hero, vorhandener Verlauf, Filter und Originalquellen |

Individuelle Titles, Beschreibungen und Canonicals sind im gebauten HTML vorhanden. Keine neuen Meta-Keywords oder erfundenen strukturierten Daten. Private Coaching-Routen setzen nach dem JavaScriptstart noindex und verlassen den Gestaltungsscope; das gemeinsame HTTP-Fallback-HTML hat weiterhin den öffentlichen Übersichtstitel und Canonical. Sitemap und robots wurden nicht geändert. Kein neuer Backend-, Datenbank- oder Produktionslaufzeitpfad.

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

## Gate und verbleibender Abschluss

Der zentrale Gate hat Implementierungscommit `05de267` gegen `origin/main` geprüft: `[gpt-6.1-sol] ALLOW: No confirmed merge-blocking defect in the supplied diff.`, Exit 0. Keine blockierenden Funde, keine Fixerrunde. Nicht blockierende Grenzen stehen in `REVIEW.md`. Die zusätzliche Artefaktprüfung bestätigt je eine H1, Canonical und Description in den fünf ausgelieferten HTML-Dateien. Sitemap und robots sind bytegleich mit ihren Quellen; die Sitemap enthält die fünf Einstiege.

## Integration und Auslieferung

Die erste Integration erfolgte ausschließlich mit einzelnen Git-Aufrufen: Fetch, gezieltes Add und Implementierungscommit, Add und Belegcommit, `git push origin HEAD:main`, Fast-Forward des sauberen kanonischen main-Checkouts. Ein vorheriger Pushaufruf wurde vom Rollenlade-Hook vor der Git-Ausführung angehalten; nach dem vorgeschriebenen Lesen der Merge-Schleuse gelang der Push. Kein BLOCK, kein Override, keine PR, keine GitHub Actions.

MERGEPROTOKOLL[MS-1]: 7 Git-Schritte einzeln | Anläufe: 2 | Gate: [gpt-6.1-sol] ALLOW

Diese Zahl protokolliert die erste Produktintegration. Berichtssicherung und abschließende Bereinigung folgen separat, ebenfalls mit einzelnen Git-Aufrufen.

Caddy liefert die bestehende Startseite und Marke direkt aus `/home/nathanael/repos/Website`; der konfigurierte Pfad `/home/naniadm/Documents/Website` ist derselbe Checkout. Die drei Frontends werden aus ihren bisherigen `dist`-Verzeichnissen geliefert. Es wurde kein allgemeiner Website-Publisher gefunden; `scripts/deploy-devfeed-web.sh` veröffentlicht nur DevFeed und wurde nicht zweckentfremdet.

Deshalb wurde der bestehende statische Build-/Kopierweg mit einem auf diesen Auftrag begrenzten, kurz laufenden Shell-Publisher serialisiert: `/tmp/deadlock-world-publish-20261007.sh`, Lock `/home/nathanael/Documents/Runtime/website-public.deploy.lock`. Der Wrapper prüft saubere getrackte Quellen, exakte HEAD-/Live-SHA und aktuellen Remote-main vor Build und Veröffentlichung. Builds entstehen im eigenen Worktree. `rsync -a --delay-updates` veröffentlicht in die bestehenden Caddy-Ziele; alte gehashte Assets bleiben erhalten. Fremde ungetrackte `dl-brand/social-preview/` wurden nicht angefasst. Keine Caddy-Änderung, kein Bot-/Backend-Neustart, keine Datenbankänderung.

`bash /tmp/deadlock-world-publish-20261007.sh`: Exit 0, erneute tatsächliche Vite-Builds 868 ms / 2,96 s / 253 ms, veröffentlichter SHA `6b217488cb5c85b169ce7afbd43a5521adc4d036`. Log: `/tmp/deadlock-world-deploy-20261007.log`. Homepage, world.css und die drei Buildindizes haben zwischen eigenem Build und Live-Dateisystem identische SHA-256-Werte. Nach dem reinen Berichtscommit wird der dann aktuelle Remote-main nochmals durch denselben Wrapper gebaut und geprüft; die Produktquellen bleiben dabei unverändert.

## Liveprüfung

`WORLD_LIVE=1 WORLD_OUT=/tmp/deadlock-world-live-20261007 xvfb-run -a node /tmp/deadlock-world-browser-20261007.cjs`: Exit 0. 20 Livekombinationen und sechs Nachbarseitenprüfungen. Kein Dokument-Overflow, genau eine H1, keine Anwendungsausnahmen, keine Console-Fehler, geprüfte Bilder geladen. Menü 10/10; Turm und Patchfilter jeweils 2/2. Vier tatsächliche Coachprofile sichtbar auf beiden Breiten. Anfrage und Rücknavigation funktionieren; noindex und Gestaltungsscope wechseln entsprechend. Patchstatus: „PATCHDATEN GELADEN“. Die bekannten Analytics-/Google-Prüfausnahmen gelten auch hier.

HTTP-Prüfung: fünf Einstiege, `/brand/world.css`, `/brand/world/city-960.avif`, `/robots.txt` und `/sitemap.xml` jeweils 200, passender Content-Type und bytegleich mit dem gemergten Build. Beispielsweise Homepage SHA-256 `058eb77f80dc692f0eb0bbde67cc049c68dd102f9b0237f549e0b5a44e33f697`, Coaching-HTML `807f7bf3e6270322991cf9a639c8f79deb8e7ae2568a4e582b029b5e3904376d`, world.css `c8d0d584e2eb5e781cdfb34ff4e1a8a4b5b9cb321e4fc10d8621c15e6a89f828`.

Livebilder: `/tmp/deadlock-world-live-20261007/home-1440-js-top.png`, `home-390-js-top.png`, `home-1440-js-coaching.png`, die weiteren fünf Routen jeweils mit Top-/Middle-Ansichten und JS-/No-JS-Topansichten. Messergebnisse: `results.json`. Dies ist ein Auslieferungsnachweis, keine weitere Gestaltungsschleife.

LIVEBEWEIS[DV-1]: PID unverändert (statisches Frontend) | exe nicht zutreffend | journal nicht zutreffend | Anker "world-poster" im HTTP-HTML | Funktion: fünf Einstiege sichtbar, Menü, Turm, Coach-Anfrage und Patchfilter geprüft | Ort: https://deutsche-deadlock-community.de/ und /mitspieler/, /beitreten/, /coaching/, /patch/

## Grenzen und Bereinigung

Die Deep-Route `/coaching/anfrage` hat im initialen HTTP-Fallback weiterhin den öffentlichen Übersichtstitel, Canonical `/coaching/` und keinen X-Robots-Tag. Die spezifischen Metadaten werden nach dem JavaScriptstart gesetzt. Der Gate hat dies als nicht blockierenden Hinweis benannt. Die Anfrage funktioniert ohne JavaScript nicht; der sichtbare Discordweg bleibt verfügbar. Für ein serverseitiges Metadatenrouting wurde kein neuer Backendpfad angelegt.

Die Originalbilder, fremden Worktrees und fremden ungetrackten Dateien bleiben erhalten. Nach Sicherung dieses Berichts werden HEAD gegen aktuellen origin/main als Vorfahr geprüft, der eigene Worktree entfernt, der eigene Branch gelöscht und Worktrees gepruned. Screenshots und Logs liegen außerhalb des zu entfernenden Worktrees. Die Hauptsession besitzt weiterhin `REGISTER.md`; dieser Bericht überschreibt dessen Status nicht.
