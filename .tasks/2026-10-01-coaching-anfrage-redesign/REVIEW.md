# Merge-Gate, Runde 1

Datum: 01.10.2026
Reviewer: `gpt-6.1-sol`, high, vom zentralen Gate gewählt.
Branch: `feat/coaching-redesign`
Geprüfter Commit: `0f4b40e95a0de93d76c921d3055e757a7a18b72d`
Basis: `origin/main`, `e79bc96`
Urteil: BLOCK

## Offener blockierender Fund

1. `dl-coaching/src/pages/CoachingRequestPage.tsx:121` sowie Zeilen 122 und 123: Die Datum- und Zeitfelder nutzen `inputMode="numeric"`, verlangen aber Punkte beziehungsweise Doppelpunkte und setzen die Trennzeichen nicht automatisch. Reine Zifferntastaturen auf Mobilgeräten erlauben deshalb keine vollständige Eingabe. Urteil: berechtigt. Fix: Trennzeichen beim Tippen automatisch einsetzen oder eine Tastatur ohne diese Beschränkung verwenden. Die Pflicht zu deutscher Darstellung als TT.MM.JJJJ und HH:MM bleibt bestehen. Mit tatsächlicher Zifferneingabe im mobilen Browser prüfen, einschließlich Korrektur, Löschen und Einfügen.

## Weitere Hinweise des Gates

2. `dl-coaching/src/pages/CoachingRequestPage.tsx:28`: Zeitwünsche und Validierung entstehen beim Rendern und werden beim Absenden weiterverwendet. Nach einer längeren Pause kann ein inzwischen verstrichenes Zeitfenster gesendet werden. Urteil: berechtigter Randfall. Fix: Datum und Uhrzeit unmittelbar vor dem Absenden erneut gegen die aktuelle Zeit prüfen und aus denselben aktuellen Werten den Payload erstellen.

3. `dl-coaching/src/index.css:1304`: Der Reviewer konnte die behaupteten Screenshots nicht selbst sehen. Die Aufnahmen liegen unter `/home/nathanael/Documents/draft-screenshots/coaching-redesign-20261001`. Desktop- und Mobil-Aufnahmen wurden in diesem Thread tatsächlich mit `view_image` betrachtet. Kein bestätigter Layoutfehler. Nach dem Fix die mobile Eingabe prüfen und die Viewport-Serie erneut ansehen.

## Stand

Build, ESLint und 19 Tests waren vor dem Gate grün. Funktionaler Browsertest auf 320, 390, 640, 768, 980, 1024 und 1440 Pixeln, Rollenprüfung für Gast, Nutzer, Coach und Admin auf 320, 390 und 1440 Pixeln. Kein horizontaler Überlauf oder Überlappung in der Leiste, keine JavaScript-Seitenfehler. Die automatisierte Textbefüllung im Browsertest hatte die Einschränkung der Bildschirmtastatur nicht geprüft.

Kein Fix nach dem Gate im selben Implementierer-Kontext. Laut `orchestrierung/ABLAUF.md`, Schritt 7, übernimmt die neue Fix-Runde die offene Liste. Worktree und Branch bleiben bestehen. Nach Fix, Compiler/Linter/Tests und mobiler Sichtprüfung: committen, Branch pushen, denselben Gate mit demselben Reviewer wie in Runde 1 erneut prüfen lassen. Erst bei ALLOW Merge nach main, Push HEAD:main, Frontend veröffentlichen, Live-Prüfung, Cleanup und Selbst-Settlement.

# Merge-Gate, Runde 2

Datum: 01.10.2026
Reviewer: `gpt-6.1-sol`, high, dieselbe Gate-Kette wie in Runde 1.
Geprüfter Commit: `1a85a310213de54fa0eeeb7ab82d5d717789f523`
Basis: `origin/main`, `e79bc96`
Urteil: ALLOW
Wortlaut: "Automatic separators fix mobile entry; no confirmed regressions. Appearance unverified." FIXED: `dl-coaching/src/pages/CoachingRequestPage.tsx:121`

## Umsetzung der Funde

1. Datum und Uhrzeit setzen Punkte und Doppelpunkte beim Tippen selbst ein (`formatDateInput`, `formatTimeInput` in `dl-coaching/src/lib/coachingRequest.ts`). Löschen, Korrigieren in der Mitte und Einfügen (auch `2026-10-01` und `1.10.2026`) bleiben im deutschen Format, beim Verlassen des Feldes werden kurze Werte ergänzt (`18` wird `18:00`). `maxLength` entfällt, damit Einfügen nicht abgeschnitten wird.
2. Beim Absenden wird mit der aktuellen Zeit erneut geprüft und der Payload aus genau diesem Ergebnis gebaut. Der allgemeine Zeitwunsch-Fehler erscheint nur noch, wenn kein Zeitfenster einen eigenen Fehler hat; der Fokus springt dadurch auf das fehlerhafte Datumsfeld.
3. Viewport-Serie und Mobilaufnahme erneut selbst angesehen.

## Nachweise

- `npm test` 21 von 21 grün, `npm run build` und `npm run lint` ohne Fehler.
- `mobile-input-check.mjs` (Pixel 7, Touch, echte Tastenanschläge nur mit Ziffern, Backspace, Korrektur, Einfügen, Uhr per Playwright-Clock über die Startzeit gestellt): kein POST bei verstrichenem Zeitfenster, danach korrigiert gesendet.
- `form-check.mjs` auf 1440 bis 320 Pixeln grün, keine Seitenfehler.
- Live nach Deploy: `live-check.mjs` grün, Asset-Hashes gleich dem Build, Ziffern-Eingabe ergibt `02.10.2099` und `18:30`.
