# Auftrag: objectives-blogpost (Paket A2, Zeitpunkte)

status: aktiv (2026-09-18)

## Ziel

Der Nutzer fragte ausdrücklich, WANN Urne, Midboss und Shrines zu welchem Erfolg geführt haben.
Paket A liefert Siegquoten je Rangstufe, aber keine Auswertung nach Zeitpunkt. A2 ergänzt genau
das als `data/kapitel-7.json` plus Abschnitt "Kapitel 7" in `data/FINDINGS.md`.

## Vorarbeit, wiederverwenden statt neu bauen

Alles unter `.tasks/2026-09-17-objectives-blogpost/data/`: `methodik.json` (Definitionen,
bindend), `queries.sql`, `mcp_query.py`, `query_chunks.py` (Tages-Chunks mit Skip-Logik und
Wiederholung). Wochenabfragen laufen beim MCP-Server in den 300-s-Timeout, deshalb tageweise.
Gleiche Grundgesamtheit, gleiche Duplikat-Regel, gleiche Urnen-Erkennung wie Paket A.

## Arbeitsschritte

1. Je Ereignis (erster Midboss-Claim, erste Urnen-Abgabe, erster Shrine-Fall) Zeitklassen bilden:
   Midboss und Shrine in 5-Minuten-Klassen nach Spielzeit, Urne auf dem Stützstellen-Raster
   (180-s-Schritte bis 900 s, danach 300 s). Dünne Randklassen zusammenlegen und benennen.
2. Je Zeitklasse und Ranggruppe (niedrig = Stufen 1 bis 4, mittel = 5 bis 7, hoch = 8 bis 11):
   n, Siege des Ereignis-Teams, Siegquote, dazu dieselben drei Werte geschichtet nach
   Soul-Vorsprung (vorn, gleichauf, hinten wie in Kapitel 6). Alle Teilwerte aus einem
   Query-Durchlauf mit `FILTER`.
3. Zusätzlich Median (nicht nur Mittel) des Ereigniszeitpunkts je Rangstufe für alle drei
   Ereignisse, und Steals: Anteil der Midboss-Ereignisse mit Steal je Zeitklasse und Ranggruppe.
4. Plausibilität: Summe der Zeitklassen = Nenner aus Kapitel 1, 2, 3 (Abweichung durch
   Daten-Drift beziffern), Siege plus Niederlagen = n je Zelle.
5. `kapitel-7.json`, Ergänzung in `FINDINGS.md` (3 bis 5 Sätze plus Unsicherheiten), neue
   Abfragen an `queries.sql` anhängen. Committen, Branch pushen.

## Was nicht angefasst wird

- `kapitel-1..6.json` und `methodik.json` bleiben unverändert (nur lesen).
- Kein `dl-landing/`, kein Text, keine Seite.
- Der Checkout `~/repos/Website` und alle anderen Worktrees.

## Fertig-Kriterium

`kapitel-7.json` und der FINDINGS-Abschnitt liegen auf `feat/blog-objectives-timing` auf origin.

## Deploy-Weg

Keiner.

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
