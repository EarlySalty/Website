# Auftrag: objectives-blogpost (Paket A, Findings)

status: aktiv (2026-09-17)

## Ziel

Nutzerwunsch: "Blogpost machen: Deadlock API hat einen MCP Server. Schauen, wann Urne, Rift,
Midboss und Shrines zu welchem Erfolg geführt haben und ob es Muster gibt, über die Elos verteilt."

Am Ende gibt es einen Daten-Blogpost auf deutsche-deadlock-community.de. Paket A liefert nur die
Zahlen dafür (Findings), Paket B (eigener Thread, später) schreibt Text und Seite.

## Datenquelle (vom Intent-Agenten geprüft, 2026-09-17)

MCP-Server der Deadlock API: `POST https://api.deadlock-api.com/v1/mcp`, JSON-RPC, stateless,
Tool `execute_query` mit Argument `sql` (DuckDB-Dialekt, nur lesend). Antwort kommt als SSE-Zeile
`data: {...}`, das Ergebnis-JSON steckt in `result.content[].text` (`columns`, `rows`).
Deckel: 1.024 Zeilen und 50 KB je Abfrage, 300 s Timeout. Also immer serverseitig aggregieren.
`curl` ist in Agenten-Shells gesperrt, Abfragen per kleinem Skript (urllib) fahren.

Einzige relevante Tabelle: `match_player` (eine Zeile je Spieler und Match, Match-Felder stehen
in jeder der 12 Zeilen gleich). Fallen:
- Immer auf `start_time` filtern, Zeitstempel als `TIMESTAMPTZ '2026-08-13 00:00:00+00'` schreiben,
  in der Ausgabe `::VARCHAR` casten (sonst Serialisierungsfehler). MAP-Spalten ebenfalls casten.
- Bis zu 2 % doppelte Zeilen (inkrementeller Export): je (`match_id`, `account_id`) die neueste
  `created_at` behalten oder je Match über `any_value`/`DISTINCT` arbeiten.
- Rang gibt es nur bei `match_mode = 'Ranked'` (Spalte `average_badge`, Werte 11 bis 116, Zehner =
  Rangstufe, Einer = Unterstufe). `average_badge_team0/1` ist seit Ende Juli 2026 immer 0.
  Prüfen, ob `average_badge` je Spieler oder je Match gilt, und den Match-Rang sauber definieren.
- Midboss: `"mid_boss.team_killed"`, `"mid_boss.team_claimed"`, `"mid_boss.destroyed_time_s"`
  (Arrays, ein Eintrag je Midboss). killed ungleich claimed = geklauter Rejuvenator.
- Shrines: `"objectives.team_objective"` mit `TitanShieldGenerator1/2`, dazu
  `"objectives.team"` und `"objectives.destroyed_time_s"` (parallel indizierte Arrays). Vorher an
  Stichproben klären, ob `objectives.team` das Team ist, dem das Objective gehört, oder das
  zerstörende Team.
- Urne: kein eigenes Feld. `"stats.gold_treasure"` (Gold aus Urne und Idolen) ist je Spieler eine
  kumulierte Zeitreihe an den Stützstellen `"stats.time_stamp_s"` (180-s-Raster bis 900 s, danach
  300 s). Eine Abgabe zeigt sich als gleich hoher Sprung bei allen sechs Spielern eines Teams im
  selben Intervall (Beispiel Match 104753027: +445 bei allen um 900 s, der Läufer bekommt mehr).
  Erkennungsregel definieren (z. B. Minimum des Zuwachses über das Team > 0 bei mindestens 5 von 6),
  an 20 Matches von Hand gegenprüfen, Auflösung (Intervall statt Sekunde) offen benennen.
- Rift ("Unstable Rift"): in `match_player` hat der Intent-Agent kein Feld gefunden. Prüfen, ob es
  sich in `stats.gold_boss`, `power_up_buffs` oder den Demo-Endpunkten (`/v1/demo/...` in
  `https://api.deadlock-api.com/openapi.json`) zeigt. Lässt es sich nicht sauber messen: als
  Nullbefund mit Begründung in die Findings, nichts erfinden und keine Ersatzkennzahl bauen.

## Grundgesamtheit

`game_mode = 'Normal'`, `match_mode = 'Ranked'`, `match_outcome = 'TeamWin'`, Start
2026-08-13 00:00 UTC bis 2026-09-15 23:59 UTC (nach dem Patch vom 12.08., vor der Rift-Änderung
vom 16.09.). Rund 15.000 Matches je Tag. Matches mit Abbrechern (`abandon_match_time_s > 0`)
getrennt zählen und begründet ein- oder ausschließen. Rangklassen: die elf Rangstufen
(Zehnerstelle), bei dünnen Rändern zusammenlegen und das hinschreiben.

## Arbeitsschritte

1. Skill `daten-blogpost` lesen (`~/.claude/skills/daten-blogpost/SKILL.md`), Abschnitte Zahlen
   und Wirkungsaussagen sind bindend.
2. Definitionen klären (Rang je Match, Team-Zuordnung der Objectives, Urnen-Erkennung) und in
   `data/methodik.json` festhalten, mit Stichproben-Beleg.
3. Kapitel-Aggregate rechnen, je Kapitel eine Datei `data/kapitel-N.json`, alles je Rangstufe:
   - K1 Midboss: Anteil Matches mit Midboss, Zeitpunkt des ersten, Siegquote des Teams mit dem
     ersten Rejuvenator, Steal-Quote (killed ungleich claimed), Siegquote nach Steal.
   - K2 Urne: Abgaben je Match und Team, Zeitpunkt der ersten Abgabe, Siegquote des Teams mit der
     ersten Abgabe und mit mehr Abgaben.
   - K3 Shrines: Zeitpunkt des ersten Shrine-Falls, Siegquote des Teams, das zuerst einen Shrine
     zerstört, Abstand erster Shrine bis Matchende.
   - K4 Rift: nur wenn messbar, sonst Nullbefund.
   - K5 Reihenfolge und Kombination: welches der Objectives fällt zuerst, Siegquote nach Anzahl
     gewonnener "Erst-Objectives", Unterschiede zwischen niedrigen und hohen Rängen.
   - K6 Kontrolle, Pflicht: ein Team, das vorne liegt, holt Objectives leichter. Deshalb jede
     Siegquote zusätzlich nach Soul-Vorsprung zum Zeitpunkt davor schichten (Summe
     `stats.net_worth` je Team an der letzten Stützstelle vor dem Ereignis, Klassen etwa
     hinten, gleichauf innerhalb 5 %, vorne). Ohne diese Schichtung heißt es im Text "Beobachtung",
     nie "Wirkung".
4. `data/FINDINGS.md`: 3 bis 5 Sätze je Kapitel plus jede Datenunsicherheit, Nullbefunde
   ausdrücklich. `data/queries.sql`: jede verwendete Abfrage. Teilwerte einer Tabelle immer aus
   einem Query-Durchlauf mit `FILTER`, Summen müssen aufgehen, Nenner n überall mitführen.
5. Plausibilität: Siegquoten beider Teams je Klasse ergänzen sich, Matchzahlen je Rangstufe
   summieren sich zur Gesamtzahl, Tageszahlen ohne Löcher (sonst Lücke taggenau nennen).
6. Committen und den Branch pushen.

Ablage: `.tasks/2026-09-17-objectives-blogpost/data/` im Worktree.

## Was nicht angefasst wird

- Keine Seite, kein Text, kein `dl-landing/`: das ist Paket B.
- Keine Einzelspieler, keine Account-IDs und keine Namen in den Ausgaben, nur Aggregate.
- Der Prod-Checkout `~/repos/Website` und fremde Worktrees bleiben unberührt.
- Den MCP-Server schonen: keine Schleifen über Einzelmatches, Abfragen tageweise oder
  wochenweise bündeln, bei Fehlern Backoff.

## Fertig-Kriterium

`data/kapitel-1..6.json`, `FINDINGS.md`, `queries.sql`, `methodik.json` liegen auf dem Branch,
die Plausibilitätsprüfungen aus Schritt 5 stehen mit Ergebnis in `FINDINGS.md`.

## Deploy-Weg

Keiner nötig (Paket A liefert nur Daten).

## Rahmen

- Du bist der einzige Thread für dieses Paket. Keine Unter-Threads oder Unter-Agenten spawnen.
- Keine Code-Kommentare schreiben, Code erklärt sich selbst.
- Nur den eigenen Branch pushen, nie main.
- Auftrag größer als beschrieben: Bump-up-Nachricht an den Intent-Thread, dann stoppen.
