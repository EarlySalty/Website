# Auftrag: objectives-blogpost (Paket B, Text und Seite)

status: aktiv (2026-09-18)

## Ziel

Nutzerwunsch: "Blogpost machen: Deadlock API hat einen MCP Server. Schauen, wann Urne, Rift,
Midboss und Shrines zu welchem Erfolg geführt haben und ob es Muster gibt, über die Elos verteilt."

Am Ende steht ein Daten-Blogpost unter `/blog/deadlock-objectives-2026/` im Repo
(`dl-landing/blog/deadlock-objectives-2026/`), gebaut wie die bestehenden Posts.

## Pflichtlektüre

1. `~/.claude/skills/daten-blogpost/SKILL.md` komplett, die Kritiker-Checkliste ist bindend.
2. Skills `no-em-dashes`, `dataviz`, `rolle-doku-redakteur`.
3. Memory `~/.claude/projects/-home-nathanael-Documents/memory/blogpost-wortwahl-nutzersprache.md`
   und `dl-landing-blog-deploy-in-place.md`.
4. Daten: `.tasks/2026-09-17-objectives-blogpost/data/FINDINGS.md`, `kapitel-1..6.json`,
   `methodik.json`. Kapitel 7 (Siegquote nach Zeitpunkt des Ereignisses) kommt aus Paket A2 auf
   Branch `origin/feat/blog-objectives-timing`; sobald es dort liegt, per
   `git merge origin/feat/blog-objectives-timing` holen. Bis dahin mit Kapitel 1 bis 6 anfangen.
5. Vorbild für Aufbau und Technik: `dl-landing/blog/deadlock-spirit-slop-2026/` und
   `dl-landing/blog/deadlock-stimmung-2026/` (geteiltes Modul `dl-landing/src/charts.js`, keine Kopie).

## Inhaltliche Leitplanken (vom Intent-Agenten nach Prüfung der Findings)

- Aufhänger: die Deadlock API hat einen öffentlichen MCP-Server (`api.deadlock-api.com/v1/mcp`,
  lesendes SQL auf stündlichen Snapshots), damit kann jeder solche Fragen selbst stellen. Kurz
  zeigen, wie, mit einer Beispielabfrage. Quelle verlinken und nennen.
- Nutzerwörter: Urne, Midboss, Rejuvenator, Shrines, Ränge mit ihren Spielnamen statt "Stufe 7".
  Rangnamen gegen eine Quelle prüfen, nicht raten.
- Siegquoten ohne Schichtung heißen "Beobachtung". Die Schichtung nach Soul-Vorsprung (Kapitel 6)
  ist der Kern: wer vorne liegt, holt Objectives leichter. Starke Werte als Kachel: hinten liegend
  und trotzdem den ersten Rejuvenator geholt 45,7 %, vorne 89,5 %.
- Shrines fallen im Mittel 289 Sekunden vor Spielende; die 93,1 % sind deshalb fast eine
  Tautologie und werden genau so eingeordnet, nicht als Geheimtipp verkauft.
- "Die Urne fällt in 99,2 % zuerst" folgt aus dem Spielablauf (Urne ab Minute 10, Midboss später)
  und ist kein Befund. Aus Kapitel 5 zählt nur, wie viele der drei Erst-Objectives der Sieger holt.
- Steals: 0,25 je Match, das klauende Team gewinnt nur in 43,2 %. Gut für einen eigenen Block.
- Rang-Muster: hohe Ränge holen den ersten Midboss rund zehn Minuten früher (1.097 s gegen
  1.727 s), und der erste Rejuvenator entscheidet oben seltener (69,1 % gegen 76,2 %).
- Rift: ehrlicher Nullbefund mit Begründung, kurz. Nichts erfinden.
- Urnen-Erkennung ist eine abgeleitete Regel mit 3- bis 5-Minuten-Raster: im Text und in der
  Methodik offen sagen.
- Nur Ranked, 13.08. bis 15.09.2026, 523.602 Matches; Rang gibt es in den Daten nur für Ranked.
- Jede Zahl aus einer `data.js`, per `data-fill` gerendert, nie getippt. Jede Figur mit
  Tabellenansicht. Bronze-Gold-Skalen statt Ampelfarben, warme gesättigte Töne.

## Arbeitsschritte

1. Post-Ordner, `data.js` aus den Kapitel-JSONs, Seite, Figuren, Methodik-Kapitel.
2. `vite.config`-Input, Blog-Index, Sitemap-Eintrag von Hand (`scripts/build-sitemap.mjs` NICHT
   ausführen), `robots.txt`, `llms.txt`, `llms-full.txt`, JSON-LD, OG-Tags nach Skill.
3. `npm run build` im Worktree (node_modules per Symlink aus `~/repos/Website/dl-landing`, danach
   Symlink entfernen), `npm test` in `dl-patch` und `dl-coaching`.
4. Kritiker-Checkliste des Skills selbst abarbeiten, Ergebnis in die Fertigmeldung.
5. Committen, Branch pushen, Fertigmeldung.

## Was nicht angefasst wird

- Die Daten unter `.tasks/.../data/` (nur lesen). Fehlt eine Zahl: melden, nicht selbst nachrechnen.
- Andere Blogposts, `charts.js` nur erweitern, wenn eine Figur es wirklich braucht.
- Der Checkout `~/repos/Website`, fremde Worktrees, Caddy, Deploy.

## Fertig-Kriterium

Build grün, Seite lokal unter dem Post-Pfad vollständig, alle Zahlen aus `data.js`, Branch
`feat/blog-objectives-seite` auf origin.

## Deploy-Weg

Macht der Intent-Agent nach den Review-Runden (ff auf main, `npm run build` in dl-landing).

## Rahmen

- Du bist der einzige Thread für dieses Paket. Keine Unter-Threads oder Unter-Agenten spawnen.
- Keine Code-Kommentare schreiben, Code erklärt sich selbst.
- Nur den eigenen Branch pushen. NIE nach main mergen oder pushen, NIE den Checkout
  `~/repos/Website` anfassen (kein checkout, kein merge dort), Worktree und Branch NICHT löschen.
- Meldet ein Stop-Hook "offene Branch-Arbeit, erst mergen": den Ausweg nehmen, den der Hook selbst
  nennt, also in einem Satz melden, was offen bleibt, und stoppen. Nichts mergen, den Hook und
  seine State-Datei nicht anfassen. Mergen ist Sache des Intent-Agenten nach den Review-Runden;
  Paket A hat genau hier die Regel gebrochen.
- Auftrag größer als beschrieben: `[Bump-up] Paket <x>: Grund: ... Erledigt: ... Worktree: ... Offen: ...`
  an den Intent-Thread c2c38ea7-35b4-44d6-ad7e-f6344be66f09, dann stoppen.
- Fertigmeldung im eigenen Thread: Branch, Commits (SHA), geänderte Dateien, was geprüft wurde,
  was offen ist. Danach stoppen.
