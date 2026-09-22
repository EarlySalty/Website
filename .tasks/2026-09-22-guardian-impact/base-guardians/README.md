# Base-Guardian-Analysepaket

## Status

Vorbereiteter Arbeitsstand, kein Ergebnisbericht. Die SQL-Dateien wurden in dieser Sitzung nicht in einem SQL-System und nicht gegen die Live-Daten ausgeführt. Die beigefügten Prüffälle sind keine gemessenen Matches.

Der direkte Datenabruf war nicht erreichbar. Der Versuch, `core.sql` über die GitHub-Verbindung in den bestehenden Feature-Branch zu schreiben, wurde blockiert. Deshalb liegt das Paket als lokale Anlage vor. Es wurde kein alternativer Schreibweg, kein Merge und kein Deployment ausgeführt.

## Dateien

- `ANALYSE-ERGAENZUNG.md`: Fragen, Zähleinheit, Ergebnisdarstellung und Freigabeschritte.
- `queries/audit.sql`: Vollständige, schreibgeschützte Prüfung von Fallzahlen, Ausschlüssen, fehlenden Rängen, Erstereignissen und Beobachtungsfenstern.
- `queries/first.sql`: Erstes Base-Guardian-Ereignis, Zeitpunkt, Ranggruppe, Soul-Lage, verbleibende Matchzeit und Verlauf der folgenden fünf Minuten.
- `queries/milestones.sql`: Erster, zweiter und dritter unterschiedlicher Eintrag je Besitzer-Team.
- `queries/counts.sql`: Eigene und gegnerische Verluste bei festen Spielzeiten.
- `core.sql`, `audit.sql`, `first.sql`, `milestones.sql`, `counts.sql`: Gemeinsame Abfragelogik und einzelne Ausgabezweige. Die vollständigen Dateien unter `queries/` sind aus diesen Teilen zusammengesetzt.
- `tests/run.sql`: Eigenständige synthetische Prüfsammlung für eine leere DuckDB-Sitzung. Sie enthält 21 künstliche Matches und 31 vorbereitete Assertions.
- `tests/setup.sql`, `tests/assertions.sql`: Bestandteile derselben Prüfsammlung.
- `manifest.json`: Status und SHA-256-Prüfsummen, keine Live-Ergebnisse.

## Anbindung an den bestehenden Auswertungspfad

Die vollständigen Dateien unter `queries/` enthalten jeweils eine SELECT-Abfrage mit CTEs. Sie passen zur DuckDB-Abfragesprache des vorhandenen Deadlock-API-MCP-Pfads. Der veraltete REST-SQL-Endpunkt verwendet dagegen ClickHouse; die Dateien sind dafür nicht gedacht.

Der bereits im Website-Repo vorhandene Aufrufer kann weiterverwendet werden. Vom Repo-Wurzelverzeichnis aus, nach Ablage dieses Pakets im vorgesehenen Aufgabenordner:

```sh
python3 .tasks/2026-09-17-objectives-blogpost/data/mcp_query.py < .tasks/2026-09-22-guardian-impact/base-guardians/queries/audit.sql
```

Die weiteren drei Abfragen werden entsprechend ausgeführt. Das Paket führt diesen Aufrufer nicht automatisch aus und enthält keine Zugangsdaten. Die öffentliche Quelle benötigt laut ihrer Dokumentation keine API-Zugangsdaten.

Antworten gelten erst dann als verwendbare Messung, wenn `success` wahr ist, kein `truncated`-Hinweis vorliegt und die empfangene Zeilenzahl mit `rowCount` übereinstimmt. Bei HTTP-Fehlern, Zeitüberschreitungen oder fehlenden Daten wird keine leere Antwort als Nullbefund gespeichert.

Bei einem notwendigen Aufteilen des Match-ID-Fensters müssen Teilfenster lückenlos und überlappungsfrei sein. Häufigkeiten sind addierbar; Teilfenster-Mediane dürfen nicht zu einem Gesamtmedian gemittelt werden. Für eine korrekte Zusammenführung sind Ereigniszeit-Histogramme oder passende Rohwerte nötig.

## Synthetische Prüfung

Mit einer installierten DuckDB-CLI:

```sh
duckdb -bail :memory: < tests/run.sql
```

Erwarteter Ausgang nach erfolgreicher Ausführung: 31 Assertions, 31 bestanden. Dies ist eine Sollvorgabe, kein in dieser Sitzung beobachtetes Testergebnis.

Die künstlichen Fälle decken unter anderem Besitzer-/Angreifer-Zuordnung, ältere Doppelzeilen, widersprüchliche neueste Zeilen, identische Ereignisdubletten, widersprüchliche Fallzeiten, Nullzeitstempel, ungültige Zeiten, fehlende Spieler, fehlende Objective-Telemetrie, ungleiche Arrays, neue Gebäude-IDs, gegnerische Gleichzeitigkeit, Gleichzeitigkeit derselben Seite, fehlende Souls, veraltete Souls, strikte Vorher-Messung und die Grenzen fester Zeitpunkte ab.

`tests/run.sql` erzeugt temporäre Testtabellen. Diese Datei wird nicht an den öffentlichen MCP-Server und nicht an eine Produktionsdatenbank geschickt.

## Datenregeln

Das Match-ID-Fenster bleibt [106000000, 107000000). Normal, Ranked und TeamWin werden wie im bestehenden Report gefiltert. Die tatsächliche neue Match-Anzahl ist noch unbekannt.

Die neueste vollständige Spielerzeile wird je Match und Slot ausgewählt. Bei mehreren unterschiedlichen Zeilen mit demselben neuesten Zeitstempel wird das Match ausgeschlossen. Match-Metadaten müssen über die zwölf Spieler übereinstimmen. Die Metadaten müssen außerdem einen gültigen Core-Verlust des Verlierer-Teams enthalten. Damit wird ein insgesamt leerer Objective-Datensatz nicht als „kein Base Guardian gefallen“ ausgegeben. Dieser zusätzliche Filter kann beispielsweise Aufgabe-Matches ohne reguläres Endereignis ausschließen; das begrenzt die Vergleichbarkeit mit dem bisherigen Report.

Base-Ereignisse mit Zeitstempel null zählen nicht als zerstört. Identische Dubletten werden zusammengefasst. Verschiedene positive Zeitstempel für denselben Besitzer und dieselbe Base-ID werden nicht willkürlich auf den ersten oder letzten Wert reduziert; das betroffene Match wird ausgeschlossen.

Bei den Soul-Werten müssen zwölf verschiedene Spieler an derselben Stützstelle vorliegen. Für ein Ereignis wird eine gemeinsame Stützstelle strikt davor verwendet, maximal 300 Sekunden alt. Die Statistiken genau in der Ereignissekunde gehören nicht zur Vorher-Kontrolle.

Abbrecher sind grundsätzlich enthalten, soweit die übrigen Qualitätsbedingungen erfüllt sind. Die Ausgabe enthält zusätzliche Zähler zum Nachrechnen ohne markierte Abbrecher. Der Abbrecherstatus stammt aus `abandon_match_time_s > 0`.

Die Rohdaten werden von der Quelle nachträglich aktualisiert. Abfragen gegen verschiedene Snapshot-Stände können abweichende Nenner erzeugen. Für den publizierten Stand sind Snapshot beziehungsweise Abrufzeit, exakte Query und unveränderte Antwort zu archivieren.

## Ergebnisregeln

`attacker_wins / matches` beschreibt beim ersten Fall die beobachtete Siegquote des Angreifers. `defender_wins / matches` beschreibt Siege trotz des erfassten Verlusts. Die Spalten zu den folgenden fünf Minuten teilen sich in früh beendete und weiterlaufende Matches; Folgeereignisse der weiterlaufenden Matches verwenden deren Zahl als Nenner.

In den Verluststufen und Momentaufnahmen kann dasselbe Match beide Team-Perspektiven beitragen. `team_observations` und `distinct_matches` sind deshalb getrennt. Die Perspektiven sind keine unabhängigen Match-Beobachtungen. In der gespiegelten Matrix ergeben symmetrische Zustände wie 1:1 durch die Konstruktion genau 50 Prozent Siege; daraus wird kein eigener Befund abgeleitet. Für Unsicherheitsintervalle über solche Team-Beobachtungen ist eine Auswertung mit Match-Clustern erforderlich.

Die getrennten `map_version`-Ausgaben werden nicht ungeprüft zusammengemischt. `low`, `mid`, `high` bezeichnen die Badge-Gruppen 10 bis 49, 50 bis 79 und 80 bis 119. `all` ist jeweils die Gesamtgruppe. `unknown` bei Souls bezeichnet tatsächlich fehlende oder ungeeignete Messwerte.

Die Grundraten sind keine kausalen Gebäude-Effekte. Auch nach Aufteilung nach Souls bleiben Zeitpunkt, andere Objectives, Teamzusammensetzung und Spielverlauf mögliche Erklärungen. Die Momentaufnahmen betreffen zu diesem Zeitpunkt noch laufende Matches.

## Quellen und Ausgangsstand

- Öffentliche Datenquelle und MCP: https://deadlock-api.com/data-dumps
- MCP-Endpunkt: https://api.deadlock-api.com/v1/mcp
- API-Zuordnung von Base Guardians und Objective-Besitzer: https://github.com/deadlock-api/deadlock-api/blob/master/website/src/queries/tracker-queries.ts
- Bestehender Analyse-Branch: https://github.com/EarlySalty/Website/pull/141
- Ausgangscommit des vorhandenen Reports: `e7910e7e3e27c12c5023f5e2c7bf5725d39126ca`

Die semantische Prüfung „einzelne Figur oder ganze Base-Guardian-Gruppe je Lane“ bleibt offen. Die Queries geben deshalb Einträge und nicht eine umgerechnete Figurenanzahl aus.
