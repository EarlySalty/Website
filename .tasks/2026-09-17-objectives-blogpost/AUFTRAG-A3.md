# Auftrag: objectives-blogpost (Paket A3, Urnen-Läufer)

status: geplant (2026-09-18), startet nach Abschluss von A2

## Ziel

Nutzerfrage: "Was hat die Urne für einen Impact, dass man sieht, wie die Person, die Personen
oder das Team, welches die macht, abschneidet." Paket A liefert nur den Team-Blick (erste
Abgabe, mehr Abgaben). A3 ergänzt den Läufer-Blick als `data/kapitel-8.json` plus Abschnitt
"Kapitel 8" in `data/FINDINGS.md`.

## Vorarbeit, wiederverwenden

`methodik.json` (Urnen-Erkennung: mindestens 5 von 6 Spielern eines Teams mit gleichem
minimalem positivem Zuwachs von `stats.gold_treasure` im selben Intervall), `query_chunks.py`
(Tages-Chunks, Skip-Logik, Wiederholung), `mcp_query.py`. Gleiche Grundgesamtheit wie A und A2.

## Definitionen

- Läufer: der Spieler des Abgabe-Teams, dessen Zuwachs an `stats.gold_treasure` im
  Abgabe-Intervall am größten ist und über dem Team-Minimum liegt. Bei Gleichstand oder
  fehlendem Mehrzuwachs: Läufer unbekannt, getrennt zählen.
- Läufer-Profil zum Abgabezeitpunkt: Rang des Läufers im Team nach `stats.net_worth` an der
  Stützstelle vor der Abgabe (1 = reichster, 6 = ärmster), `hero_id`, `assigned_lane`.
- Kosten: Tod des Läufers im Abgabe-Intervall (`death_details.game_time_s` zwischen den beiden
  Stützstellen) gegen die Todesrate desselben Spielers in seinen übrigen Intervallen.
- Nutzen fürs Team: Differenz der Team-Net-Worth-Summe zum Gegner an der Stützstelle nach der
  Abgabe minus davor, verglichen mit Intervallen ohne Abgabe beider Teams im selben Zeitfenster
  (gleiche Stützstelle), als Median und Mittel je Ranggruppe.
- Läufer-Ergebnis: Siegquote der Läufer, Endstand `net_worth`, `kills`, `deaths` des Läufers
  gegen den Median seiner fünf Teamkollegen, je Ranggruppe (niedrig 1 bis 4, mittel 5 bis 7,
  hoch 8 bis 11).

## Arbeitsschritte

1. Läufer-Erkennung an denselben 20 Stichproben-Matches wie in Paket A von Hand gegenprüfen
   (`urn_check_*.json`), Trefferquote in die Findings.
2. Aggregate je Ranggruppe: Verteilung Läufer-Rang im Team (1 bis 6), Top-10-Helden der Läufer
   mit Anteil, Anteil je Lane, Todesquote im Abgabe-Intervall gegen Vergleichsintervalle,
   Team-Soul-Swing mit und ohne Abgabe, Läufer-Endstatistik gegen Teamkollegen, Siegquote.
   Alle Teilwerte aus einem Query-Durchlauf mit `FILTER`, Nenner überall mitführen.
3. Plausibilität: Läufer bekannt plus unbekannt = Abgaben aus Kapitel 2 (Drift beziffern),
   Helden-Anteile summieren sich mit "übrige" zu 100, Siege plus Niederlagen = n.
4. `kapitel-8.json`, FINDINGS-Abschnitt (3 bis 5 Sätze plus Unsicherheiten, Nullbefunde
   ausdrücklich), Abfragen an `queries.sql` anhängen. Committen, Branch pushen.

## Was nicht angefasst wird

- `kapitel-1..7.json`, `methodik.json` nur lesen. Kein Text, keine Seite, kein `dl-landing/`.
- Der Checkout `~/repos/Website` und andere Worktrees.
- Keine Account-IDs, keine Namen in den Ausgaben.

## Fertig-Kriterium

`kapitel-8.json` und der FINDINGS-Abschnitt liegen auf `feat/blog-objectives-timing` auf origin.

## Deploy-Weg

Keiner.

## Rahmen

- Du bist der einzige Thread für dieses Paket. Keine Unter-Threads oder Unter-Agenten spawnen.
- Keine Code-Kommentare schreiben, Code erklärt sich selbst.
- Nur den eigenen Branch pushen. NIE nach main mergen oder pushen, NIE den Checkout
  `~/repos/Website` anfassen, Worktree und Branch NICHT löschen.
- Meldet ein Stop-Hook "offene Branch-Arbeit, erst mergen": den Ausweg nehmen, den der Hook selbst
  nennt, also in einem Satz melden, was offen bleibt, und stoppen. Nichts mergen, den Hook und
  seine State-Datei nicht anfassen.
- Auftrag größer als beschrieben: `[Bump-up] Paket A3: Grund: ... Erledigt: ... Worktree: ... Offen: ...`
  an den Intent-Thread c2c38ea7-35b4-44d6-ad7e-f6344be66f09, dann stoppen.
- Fertigmeldung im eigenen Thread: Branch, Commits (SHA), geänderte Dateien, was geprüft wurde,
  was offen ist. Danach stoppen.
