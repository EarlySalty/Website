# Deploy-Hinweise: Video-Bibliothek

Kein Deploy und keine Infrastrukturänderung sind Teil dieses Branches.

## Caddy

- `/videos` auf `deutsche-deadlock-community.de` an den Website-Frontend-/Backend-Stack auf Port `8772` anbinden; `/api/videos*` muss denselben Backend-Port erreichen.
- Die SPA-Fallback-Regel muss `/videos`, `/videos/playlists/{id}` und `/videos/creators/{id}` auf das gebaute Frontend ausliefern.

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
- Platzhaltertexte im Frontend durch final freigegebene Texte ersetzen.
