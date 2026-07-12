# Deploy-Hinweise: Video-Bibliothek

Kein Deploy und keine Infrastrukturänderung sind Teil dieses Branches.

## Caddy

- `/videos` auf `deutsche-deadlock-community.de` an den Website-Frontend-/Backend-Stack auf Port `8772` anbinden; `/api/videos*` muss denselben Backend-Port erreichen.
- Die SPA-Fallback-Regel muss `/videos`, `/videos/playlists/{id}` und `/videos/creators/{id}` auf das gebaute Frontend ausliefern.

## Frontend-Builds

- Builds-Plattform unverändert unter `/builds`: `cd builds/frontend && npm run build:builds`.
- DDL-Video-Bibliothek unter `/videos` mit Root-API `/api`: `cd builds/frontend && npm run build:ddl`.
- Beide Kommandos schreiben nach `builds/frontend/dist`; deshalb die Artefakte nacheinander bauen und jeweils getrennt ausliefern. Der DDL-Build verwendet `/videos/` nur als Asset-Basis, der Router bleibt auf `/` und Video-/Auth-Aufrufe gehen an `/api`.

## Datenbankmigration

- Nach `2026071999_video_library.sql` wird `2026072000_video_action_audit.sql` automatisch durch `db::init` angewendet.
- Die neue Tabelle `video_library.action_audit_log` protokolliert manuelle Video-, Playlist-, Taxonomie- und Featured-Änderungen mit Akteur und Objekt.

## Discord OAuth

Zusätzliche Redirect-URI in der Discord-Anwendung registrieren:

`https://deutsche-deadlock-community.de/api/auth/discord/callback`

Die bestehende Session-/Cookie-Konfiguration muss die DDL-Domain einschließen.

## Environment

- `DDL_CREATOR_ROLE_ID`: Discord-Rollen-ID der Creator-Rolle in Guild `1289721245281292288`.
- `YOUTUBE_API_KEY`: YouTube Data API v3 Key für Tag-Prüfung, Handle-Auflösung und Uploads-Backfill. Ohne Key bleiben neue Videos sicher auf `pending`.

## Content Security Policy

- `img-src`: `https://i.ytimg.com` ergänzen.
- `frame-src`: `https://www.youtube-nocookie.com` ergänzen.

## Offene Punkte vor Livegang

- Creator-Rolle in Discord anlegen und `DDL_CREATOR_ROLE_ID` setzen.
- OAuth-Redirect, Caddy-Routen und CSP deployen und live prüfen.
- YouTube-API-Quota und 15-Minuten-Ingest im Betrieb beobachten.
- Warnungen `video playlist sync failed` beobachten; ein fehlgeschlagener Abruf lässt die bisherigen Playlist-Items unverändert.
- `decision_log` wächst nur noch bei neuen Videos oder echten Statusänderungen; Aufbewahrung für `action_audit_log` betrieblich festlegen.
- Platzhaltertexte im Frontend durch final freigegebene Texte ersetzen.
