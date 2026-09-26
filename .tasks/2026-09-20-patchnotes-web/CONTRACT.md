# Patchnotes-Navigation: verbindlicher Cross-Repo-Release

## Nutzerauftrag
Neue Patches sollen automatisch als vollständige deutsche Web-Version mit den bekannten Discord-Emojis veröffentlicht werden. Das Menü und der Startseiten-Footer führen auf diese Lesefassung. Die bestehende Balance-Timeline bleibt erhalten.

## Zusammengehörige Implementierung, gemeinsam prüfen

- Publisher: `/home/nathanael/.worktrees/patchnotes-web-20260920`, Branch `feat/patchnotes-web-20260920`, HEAD `c7145f9`. `web_publish.py` schreibt Archiv, feste Einzeladressen, Assets und Sitemap. `main.py` startet den persistenten Outbox-Worker; das Bootstrap nutzt vorhandene Übersetzungen ohne neue Discord-Posts.
- Auslieferung: `/home/nathanael/.worktrees/caddy-patchnotes-web-20260920`, Branch `feat/patchnotes-web-route-20260920`, HEAD `c9e6fe9`. Der eigene Diff gegen `origin/master` enthält die neue statische `/patchnotes/*`-Route samt CSP und Matcher-Ausnahme. Der Ausgabepfad ist `/home/nathanael/Documents/Runtime/patchnotes-web`.
- Dieses Repository ergänzt ausschließlich die Navigation und deren Integrationsdokumentation. Es erzeugt die Patchseiten nicht selbst. `/api/patchnotes` und `dl-patch` werden nicht umbenannt.

Die Seiten fehlen vor dem gemeinsamen Deploy absichtlich auf der Live-Strecke. Das ist eine Release-Voraussetzung, kein Verweis auf ein nicht implementiertes Ziel. Publisher und Caddy-Gegenstück müssen im Review mitgelesen werden; ein Review nur gegen die alte Vite-Pfadtabelle erfasst den Auftrag nicht.

## Umfang
Klasse: mittel. `dl-brand/nav.js`, `deco-elevator-new/index.html`, `scripts/test-phase3-footer-links.py`, `docs/internal/deployment.md`, `.tasks/2026-09-20-patchnotes-web/**`. Keine Änderung der übrigen Frontends, APIs, Dienste oder Betreiberdateien.

## Aktivierung und Rückfall

1. Alle drei Codeanteile reviewen und per Gate freigeben. Ein vorliegendes BLOCK wird nicht umgangen.
2. Caddy: ausschließlich den eigenen, auf die aktuelle Live-Datei angewendeten Patch installieren. Gegenprobe per Rückwärts-Patch byteidentisch; vor Installation auf parallele Änderungen prüfen. Kein Volltausch aus dem Worktree, keine verlorenen `/local-pyramide`, `/usage-extra` oder `/twitch/connect`-Routen.
3. Publisher samt vorhandener TOML-Web-Tabelle aktivieren und bestehende Übersetzungen durch dessen Worker übernehmen. Archiv und Einzelpatch müssen öffentlich HTTP 200 liefern; fehlende Seiten und versteckte Dateien HTTP 404.
4. Erst danach die Navigation und den Startseiten-Footer dieses Repositories aktivieren. Keine Verzeichnislöschung; fremde `social-preview/`-Dateien bleiben erhalten. Das Menü markiert sowohl auf `/patchnotes/` als auch auf `/patch/` die Patchnotes-Etage.
5. Live-Browserprüfung von Archiv, Artikel, Logo, Emojis, Suche, Filter und Menü. Eine misslungene Publikation aktiviert den neuen Website-Link nicht.

## Prüfnachweis vor Live-Abnahme

Publisher: 132 Tests + 30 Untertests grün. Website: 3 Footer-Tests grün. Browserprüfung: Archiv und Artikel jeweils 320/390/768/1440 Pixel, keine Menüüberdeckung oder Seitenüberläufe, lesbares vollständiges Logo, Suche/Filter/Sprünge und Lesefassung ohne JavaScript erfolgreich. Die Ausgangsprüfungen mit ihren behobenen Befunden stehen im Publisher unter `.tasks/2026-09-20-patchnotes-web/{REVIEW,VISUAL,FIXES}.md`.
