# Vertrag: öffentliche DevFeed-Seite

Stand: 26.09.2026

## Adressen

- Seite: `https://deutsche-deadlock-community.de/devfeed/`
- API-Dokumentation: `https://deutsche-deadlock-community.de/devfeed/api-docs/`
- Öffentliche API: `https://deutsche-deadlock-community.de/devfeed/api/public/v1/messages`
- Authentifizierte API: `https://deutsche-deadlock-community.de/devfeed/api/v1/messages`

Die Browser-Seite verwendet ausschließlich die öffentliche, bereinigte API. Kein API-Schlüssel wird in JavaScript eingebettet.

## Deploy

Nach Merge exakt den gemergten Website-main-SHA auschecken und ausführen:

`scripts/deploy-devfeed-web.sh <main-sha>`

Das Skript veröffentlicht einen unveränderlichen Release-Ordner unter
`/home/nathanael/Documents/Runtime/devfeed-web/releases/<sha>` und schaltet
`current` atomar um.

Caddy liefert `/devfeed/*` aus `.../devfeed-web/current` aus und proxyt nur
`/devfeed/api/*` an `127.0.0.1:8789`.
