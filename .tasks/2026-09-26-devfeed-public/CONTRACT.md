# Vertrag: öffentliche DevFeed-Seite

Stand: 26.09.2026

## Adressen

- Seite: `https://deutsche-deadlock-community.de/devfeed/`
- API-Dokumentation: `https://deutsche-deadlock-community.de/devfeed/api-docs/`
- Öffentliche API: `https://deutsche-deadlock-community.de/devfeed/api/public/v1/messages`
- Authentifizierte API: `https://deutsche-deadlock-community.de/devfeed/api/v1/messages`

Die Browser-Seite verwendet ausschließlich die öffentliche, bereinigte API. Kein API-Schlüssel wird in JavaScript eingebettet.

## Deploy

Nach Merge exakt den gemergten Website-main-SHA in einem sauberen
Source-Worktree auschecken, `dl-landing` dort bauen und ausführen:

Der Checkout muss vollständig sauber sein; andernfalls bricht das Skript ab,
damit ein Release niemals uncommittete Inhalte unter dem freigegebenen SHA trägt.

`scripts/deploy-devfeed-web.sh <main-sha>`

Der Source-Worktree darf getrennt vom produktiven Checkout liegen. Der
produktive Caddy-Liveroot ist `/home/naniadm/Documents/Website`; dessen
fremde ungetrackte Dateien werden weder geprüft noch geändert.

Das Skript veröffentlicht einen unveränderlichen Release-Ordner unter
`/home/nathanael/Documents/Runtime/devfeed-web/releases/<sha>` und schaltet
`current` atomar um.
Release-Dateien werden zuerst in einem eindeutigen temporären Ordner
vollständig kopiert. Ein abgebrochener Lauf kann mit demselben SHA erneut
starten; unvollständige ältere Ordner bleiben zur Prüfung separat erhalten.

Im selben Deploy-Lauf erzeugt das Skript aus dem freigegebenen Source-Checkout
die Sitemap und ersetzt sie atomar im tatsächlichen Caddy-Liveroot unter
`dl-landing/dist/sitemap.xml`. Die Navigation unter `dl-brand/nav.js` wird
gezielt aus demselben SHA übernommen; andere Brand-Dateien bleiben erhalten.
Die beiden DevFeed-Adressen werden vor dem Umschalten geprüft.

Caddy liefert `/devfeed/*` aus `.../devfeed-web/current` aus und proxyt nur
`/devfeed/api/*` an `127.0.0.1:8789`.
