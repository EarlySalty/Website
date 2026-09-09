# CONTRACT: dato-Linkseite

## Ziel
Kleine statische Linkseite (Linktree-Stil) fuer den Deadlock-Movement-Creator "dato" unter
https://deutsche-deadlock-community.de/dato im Schwarz-Gold-Look der Community.

## REQ
- REQ-1 Ordner dato/ mit index.html, lokaler CSS-Datei, avatar.png (und banner.png), kein Build, keine externen Skripte/Fonts.
- REQ-2 Avatar, Name "dato", Unterzeile "Movement Coach der Deutschen Deadlock Community", ein Satz zur Person.
- REQ-3 Linkkarten in Reihenfolge YouTube, Twitch, TikTok, Instagram, abgesetzt Discord; alle target=_blank rel=noopener; Icons inline SVG.
- REQ-4 Schwarz-Gold aus dl-brand, Goldkante an Karten, mobil zuerst, kein Glow-Geblinke, kein Marketing-Text.
- REQ-5 title, meta description, Open-Graph mit absolutem og:image, lang=de, robots normal; Footer mit Links Startseite, /twitch/impressum, /twitch/datenschutz.
- REQ-6 Caddy-Route: /dato und /dato/ liefern die Seite, /dato/* die Assets, Muster wie bestehende statische Routen; keine CSP-Ausnahme.
- REQ-7 Live-Beweis: GET /dato 200 mit Titel, /dato/avatar.png 200 image/png, alle fuenf Ziel-Links im HTML.

## Nicht-Ziele
Kein React, kein Build, keine Analytics, kein Tracking, keine Datenbank, keine Aenderung an anderen Seiten.

## Erlaubter Bereich
- Website-Repo: dato/*, .tasks/2026-09-09-dato-linkseite/*
- caddy-config-Repo: hosts/v50671/Caddyfile (eine neue statische Route)
