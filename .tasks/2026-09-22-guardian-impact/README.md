# Guardian-Impact: Ergänzung zum Objectives-Report

## Stand

22. September 2026. Neuer statischer Folgeartikel unter `/blog/deadlock-guardian-impact-2026/`, mit bestehendem Designsystem, vier Tabellen, Blog-Eintrag, Sitemap-Eintrag und gegenseitiger Verlinkung zum ursprünglichen Objectives-Artikel. Keine Änderungen an Dashboard-Styles, Datenbank oder Bot-Diensten.

Die Veröffentlichung erfolgt erst durch Merge und das reguläre Website-Deployment. Ein erfolgreicher lokaler Build ist kein Deployment.

## Ausgeführte Auswertungen

Alle drei JSON-Dateien stammen aus erfolgreichen, nicht abgeschnittenen Antworten des öffentlichen Deadlock-API-MCP-Werkzeugs `execute_query`. Daneben liegt jeweils die exakt ausgeführte SQL-Abfrage.

| Dateien | Aussage |
| --- | --- |
| `cohort.sql`, `cohort.json` | 63.438 erfasste Ranked-Matches im Match-ID-Fenster [106000000, 107000000). Starts 2026-09-16 17:53:31 UTC bis 2026-09-21 21:33:56 UTC. |
| `first_objectives.sql`, `first_objectives.json` | Global erstes Guardian-/Walker-Team, getrennt nach Fallzeitfenster und durchschnittlicher Match-Ranggruppe. |
| `souls_at_9m.sql`, `souls_at_9m.json` | Wirtschaftlich führende ursprünglich zugewiesene Lane-Paare bzw. führendes Gesamtteam bei exakt 540 Sekunden, mehr als 5 % Vorsprung. |

Hauptergebnisse: erster Guardian 37.280 Siege / 63.257 Fälle = 58,9 %; erster Walker 40.843 / 63.284 = 64,5 %; Team-Soul-Vorsprung bei 9:00 27.805 / 42.259 = 65,8 %. Die Nenner unterscheiden sich aufgrund der jeweiligen Eignungsbedingungen.

`FINDINGS.md` ist die vollständige lesbare Artikelfassung. `build_post.py` ist ein einmaliges redaktionelles Build-Skript ohne Netzwerkzugriff. Es erzeugt Artikel, CSV-Exporte und Prüfsummen aus den archivierten erfolgreichen Ergebnissen:

```sh
python3 .tasks/2026-09-22-guardian-impact/build_post.py
cd dl-landing
npm run build
```

Die exportierten Daten liegen unter `dl-landing/public/blog-data/guardian-impact-2026/`. Leere `elo`- oder `timing`-Felder in den CSV-Dateien bedeuten die jeweilige Gesamtgruppe, nicht fehlende Messwerte. Zeitwerte stehen in Sekunden, Anteile in Prozent. Wilson-Intervalle betreffen Anteilsunsicherheit und sind keine kausalen Effektintervalle. Spieler- oder Account-IDs werden nicht exportiert.

## Grenzen und offene Anschlussfragen

Diese Auswertung ist deskriptiv. Das Match-ID-Fenster ist weder zufällig gezogen noch eine Vollerhebung vollständiger Kalendertage. Die API-Abdeckung, wiederkehrende Spieler, Patches, Region und Heldenzusammensetzung können die Ergebnisse beeinflussen. Abbrecher wurden nicht gesondert ausgeschlossen. Die Gebäudequoten wurden nicht nach dem Soul-Vorsprung vor dem Ereignis bereinigt.

Die folgenden Arbeitsstände im Aufgabenordner wurden ausdrücklich NICHT als Datenquelle verwendet:

- `pre_guardian_souls.sql`: letzter Ausführungsversuch scheiterte beim Abruf einer öffentlichen Parquet-Datei mit HTTP 404; kein belastbares Ergebnis archiviert.
- `lane_objectives.sql`: formuliert, aber keine erfolgreich archivierte Ausführung für die Hauptstichprobe. Zusätzlich ist die Farbzuteilung der Gebäude-IDs noch ungeprüft. Spieler-Lane-IDs 1/4/6 dürfen nicht mit Gebäude-IDs 1/3/4 gleichgesetzt werden.
- `objective_timing.sql`, `fixture_result.json`: früher Prototyp mit synthetischem Test, keine Live-Ergebnisquelle für den Artikel. Die Ausgabe der Fixture ist kein Test der später tatsächlich verwendeten Hauptabfrage.

Nicht gemessen sind die Umwandlung Guardian -> Walker innerhalb von fünf Minuten, der spätere Soul-Zuwachs aufgrund eines Guardians und kausale Auswirkungen einer strategischen Entscheidung. Der Artikel benennt diese Grenzen ausdrücklich und erfindet keine farbige Gebäude-Rangliste.

## Prüfung

- Alle 51 Objective-Aggregate und 16 Soul-Aggregate vollständig, keine `truncated`-Antwort als Quelle.
- Rang- und Zeitgruppen summieren sich exakt zu den Gesamtzahlen; Siege liegen zwischen null und Fallzahl.
- CSV-Prozentwerte und Wilson-Intervalle direkt aus den Zählern berechnet.
- HTML: eindeutige IDs, vorhandene Inhaltsanker, vier sichtbare statische Tabellen, parsebares JSON-LD und vorhandene Daten-Downloads geprüft.
- `npm run build`: erfolgreich. Die bestehenden Build-Warnungen zu extern zur Laufzeit eingebundenen `/brand/`-Dateien bleiben bestehen. Kein visueller Browser-Screenshot-Test behauptet.
- Das temporäre `node_modules`-Symlink für den Build gehört nicht in Git und wird vor dem Commit entfernt.
