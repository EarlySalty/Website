# Base Guardians: Ergänzung der Guardian-Analyse

Stand: 22. September 2026.

## Arbeitsstand

Die Messdefinitionen, vier vollständige SQL-Abfragen und synthetische Prüffälle sind vorbereitet. Es liegen aus dieser Ergänzung keine gemessenen Base-Guardian-Siegquoten vor. Der GitHub-Schreibaufruf wurde blockiert; dieses Paket ist nicht im Remote-Branch gespeichert. Es wurde kein GitHub-Actions-Lauf gestartet, kein Artikel geändert und nichts gemerged oder deployt.

Vorgesehener Anschluss: Website, PR #141, Branch `feat/blog-guardian-impact-2026`, Aufgabenordner `.tasks/2026-09-22-guardian-impact/base-guardians/`. Die vorhandenen Guardian-, Walker- und Soul-Ergebnisse bleiben unverändert.

## Was die Ergänzung beantworten soll

### Wann fällt der erste Base Guardian?

Erfasst wird das erste eindeutig einem Besitzer-Team zuordenbare Base-Guardian-Ereignis des Matches. Die Auswertung zeigt den Fallzeitpunkt, die späteren Siege des angreifenden Teams, die Siege der verteidigenden Seite und die verbleibende Zeit bis zum Matchende.

Die Zeitfenster sind vor 15 Minuten, 15 bis unter 20, 20 bis unter 25, 25 bis unter 30, 30 bis unter 40 und ab 40 Minuten. Das sind vorab festgelegte Auswertungsgrenzen, keine behaupteten Spielmechaniken.

Die Unterteilung nach durchschnittlicher Match-Rangbewertung bleibt numerisch kompatibel mit dem bestehenden Report: Badges 10 bis 49, 50 bis 79 und 80 bis 119. Unbekannte Ränge werden ausgewiesen und nicht zur niedrigsten Gruppe gemacht. Die ausgeschriebenen Rangnamen müssen vor der Veröffentlichung gegen die für das Datenfenster gültigen Assets geprüft werden.

### Wie verändert sich das Bild nach dem ersten, zweiten und dritten Verlust?

Für jedes Besitzer-Team wird der erste, zweite und dritte unterschiedliche lanegebundene Base-Guardian-Eintrag bestimmt. Damit wird getrennt sichtbar, wann ein weiterer Teil der Basisverteidigung fällt und wie häufig die verteidigende Seite danach trotzdem gewinnt.

Das ist etwas anderes als die Endbilanz. Wer erst am Matchende nach drei verlorenen Einträgen auswählt, kennt bereits einen großen Teil des Spielverlaufs. Diese Auswahl wird nicht als unabhängiger Effekt der Anzahl verkauft.

Zusätzlich wird der Zustand nach genau 15, 20, 25, 30, 35 und 40 Minuten verglichen: null, ein, zwei oder drei eigene verlorene Einträge und gleichzeitig null, ein, zwei oder drei beim Gegner. Ein 1:0 wird damit nicht mit einem 1:2 vermischt. In diese Momentaufnahmen kommen Matches, die zu dem jeweiligen Zeitpunkt noch laufen. Ein Match, das bei 20:00 bereits endet, wird nicht als laufendes Match bei 20:00 gezählt.

### Ist es schon eine Vorentscheidung oder gelingt noch eine Verteidigung?

Für den ersten Fall und die weiteren Verluststufen werden die späteren Siege beider Seiten gezählt. „Verteidiger gewinnt trotz Base-Verlust“ ist zunächst eine beschreibende Aussage.

Ein wirtschaftliches Comeback wird separat eingeordnet: Lag die verteidigende Seite vor dem Fall auch bei den Souls hinten? Dafür wird die letzte gemeinsame Messung der zwölf Spieler strikt vor dem Ereignis genutzt. Sie darf höchstens 300 Sekunden zurückliegen. Fehlende oder ältere Messwerte ergeben eine eigene unbekannte Gruppe, keinen erfundenen Gleichstand.

Die Soul-Lagen aus Sicht des Angreifers sind: vorne bei mehr als fünf Prozent Vorsprung, hinten bei mehr als fünf Prozent Vorsprung des Gegners, sonst ungefähr gleichauf. Die Grenzen sind symmetrisch definiert; ein Verhältnis von 0,95 ist nicht automatisch das exakte Gegenstück von 1,05.

### Was passiert in den nächsten fünf Minuten?

Nach dem ersten Fall werden weitere Base-Guardian-Verluste derselben verteidigenden Seite und Gegenangriffe auf die andere Basis gezählt.

Dabei gibt es drei getrennte Ausgänge: Das Match endet innerhalb von fünf Minuten mit Sieg des Angreifers, es endet mit Sieg des Verteidigers, oder es läuft nach fünf Minuten weiter. Der weitere Gebäudeverlust unter den dann noch laufenden Matches bekommt einen eigenen Nenner. Ein früh beendetes Match wird nicht als „fünf Minuten ohne weiteren Druck“ gewertet.

Ereignisse genau fünf Minuten später gehören zum Fenster. Weitere Einträge in derselben Sekunde wie das Ausgangsereignis zählen zum ursprünglichen Zustand, nicht als spätere Folge.

## Die Zähleinheit muss vor der Veröffentlichung geklärt werden

Die geprüfte API-Zuordnung nennt `BarrackBossLane…` als Base Guardian. Sie belegt noch nicht, ob dessen Zeitstempel einen einzelnen Gegner oder die vollständige Base-Guardian-Gruppe derselben Lane abbildet.

Die SQL-Dateien zählen deshalb unterschiedliche Base-Guardian-Einträge nach Besitzer und Gebäude-ID. Sie rechnen die Einträge nicht in eine vermeintlich bekannte Anzahl einzelner Figuren um. Auch die Formulierung „vollständig geöffneter Base-Eingang“ braucht eine überprüfte Zuordnung.

Vor Veröffentlichung sind mehrere Match-Beispiele gegen sichtbare Ereignisse beziehungsweise geeignete Replay-Daten zu prüfen. Das bisherige Datenfenster verwendet Gebäude-IDs mit den Suffixen 1, 3 und 4. Ein anderer Base-Guardian-Suffix führt zum Ausschluss des betroffenen Matches und wird im Audit sichtbar. Er wird nicht still einer bekannten Lane zugewiesen. Spieler-Lane-IDs 1, 4 und 6 sind keine Zuordnungstabelle für diese Gebäude-IDs.

Shrines bleiben ein getrenntes Ereignis und erhalten hier keine zweite Analyse.

## Veröffentlichung

Vorgesehen ist ein zusätzliches Kapitel im bestehenden Guardian-Folgeartikel: „Base Guardians: Wie viel Verteidigung bleibt nach dem ersten Verlust?“

Die Ergebnisdarstellung soll vier Vergleiche enthalten: erster Fall nach Zeitpunkt und Ranggruppe; erste, zweite und dritte Verluststufe; Anzahl eigener und gegnerischer Verluste zu festen Spielzeiten; erste Verluste nach Soul-Lage und weiterem Verlauf.

Zu jeder Prozentzahl gehören Fallzahl, Blickrichtung und Bezugszeitpunkt. Kleine Zellen unter 200 Match-Fällen werden markiert und nicht zur Schlagzeile gemacht. Auch größere Zellen begründen keine Behauptung, dass der Gebäudeverlust allein die Siegchance um einen bestimmten Wert verändert.

Die bestehenden 63.438 Matches werden nicht ungeprüft als Nenner übernommen. Diese Ergänzung verlangt strengere Datenprüfungen und kann dadurch andere Fallzahlen haben. Ein direkter Vergleich mit Guardian oder Walker muss auf derselben geprüften Match-Auswahl neu gerechnet werden.

## Freigabe bleibt offen

1. SQL-Abfragen in DuckDB ausführen und die synthetischen Prüffälle gegen die tatsächlichen Abfragen bestehen.
2. Neue Live-Ergebnisse vollständig abrufen, ohne abgeschnittene Antworten, und die Nenner prüfen.
3. Die Base-Guardian-Zähleinheit bestätigen, Ergebnisse formulieren und den Blog samt Datenexporten aktualisieren.
4. Regulären Test- und Merge-Gate durchlaufen, nach main übernehmen, deployen, live prüfen und erst danach den Branch aufräumen.

TEXTNACHWEIS[DR-1]: Gedankenstriche 0 | ae/oe/ue/ss-Ersatz 0 | Absolutwörter 0 belegt | Senke: unveröffentlichtes Analysepaket
