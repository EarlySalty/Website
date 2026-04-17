# Workflow

- 2026-04-16: Worker A gestartet. Aufgabe: neues Vite-Projekt `dl-tierlist/` aufsetzen, Datendateien erzeugen, Fonts/Favicon kopieren, Hero-Bilder laden, `npm install` ausführen.
- 2026-04-16: `dl-tierlist/` mit Vite-Multipage-Grundgeruest, `public/data/*.json`, Fonts und Favicon angelegt.
- 2026-04-16: Steam-CDN-Download fuer alle 27 Hero-Portraits mit den vorgegebenen URL-Patterns ausgefuehrt. Ergebnis bisher: keine 200er-Treffer, Frontend faellt daher auf Platzhalter zurueck.
- 2026-04-16: `npm install` und `npm run build` in `dl-tierlist/` erfolgreich ausgefuehrt. Projekt ist lokal baubar.
- 2026-04-16: Worker B hat `index.html`, `history/index.html`, `admin/index.html` sowie `src/main.css`, `src/tierlist.js`, `src/history.js`, `src/admin.js` vollstaendig implementiert.
- 2026-04-16: Frontend mit vorhandenen JSON-Daten verifiziert; `npm run build` nach den Worker-B-Aenderungen erneut erfolgreich.

# Aktivitäts-Dashboard (2026-04-17)

## Ziel
`/aktivitaet/` als neues Vite-Subprojekt `dl-activity/`: Public-Leaderboards (Voice/Text getrennt), Personal-Dashboard mit Charts nach Discord-OAuth. Ersetzt die aktuellen 404-Links aus `dl-landing`-Footern.

## Plan
`/home/naniadm/.claude/plans/wir-haben-ja-aktivit-ts-piped-crown.md`

## Backend-Kontrakt (Deadlock-Bots / Port 8768)
- `GET /api/public/leaderboard/voice?limit=50` · `GET /api/public/leaderboard/text?limit=50`
- `GET /api/public/me` · `/me/stats` · `/me/voice-history` · `/me/text-history` · `/me/heatmap` · `/me/co-players`
- `GET /auth/discord/login` · `GET /auth/discord/callback` · `POST /auth/discord/logout`
Parallel von GPT-Worker implementiert.

## Erledigt
- (in Arbeit — Frontend von Claude, Backend von GPT-Workern)

## Offen
- Build-Orchestrator (falls existent) um `dl-activity` erweitern
- Footer-Links in `dl-landing/index.html:82`, `mitspieler/`, `streamer/`, `coaching/` zeigen bereits auf `/aktivitaet/` — nach Build prüfen dass kein 404 mehr
- Commit + Push erst nach E2E-Verifikation
