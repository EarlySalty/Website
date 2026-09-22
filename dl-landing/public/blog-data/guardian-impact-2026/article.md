# Win lane, lose game? Was ein früher Guardian über den Sieg verrät

Stand: 22. September 2026. Datenfenster: 16. bis 21. September 2026 (genaue UTC-Grenzen in der Methodik).

Du holst den ersten Guardian und verlierst trotzdem. Ein Blick auf 63.438 Ranked-Matches zeigt: Das passiert oft, aber nicht öfter als der Sieg. Wie sich frühe und späte Guardians unterscheiden, was die Elo daran ändert und warum eine gewonnene Lane noch kein führendes Team ist.

## Eine gewonnene Lane ist noch kein gewonnenes Spiel

Der Guardian fällt, die eigene Lane fühlt sich entschieden an, und zwanzig Minuten später ist trotzdem der eigene Patron weg. „Win lane, lose game“ beschreibt genau diesen Frust. Aber steckt dahinter mehr als eine Erinnerung an besonders ärgerliche Niederlagen?

Für diesen Folgeartikel haben wir den öffentlichen MCP-Server der Deadlock-API erneut abgefragt. Die neue Grundgesamtheit umfasst **63.438 Ranked-Matches** in einem fest abgegrenzten Match-ID-Bereich vom 16. bis 21. September 2026. Das ist eine andere Stichprobe als im [ersten Objectives-Report über Urne, Midboss und Shrines](/blog/deadlock-objectives-2026/). Die beiden Datensätze werden hier nicht zusammengeworfen.

Das Team, das den **ersten gegnerischen Guardian des gesamten Matches** zerstört, gewinnt in **58,9 %** der auswertbaren Fälle. Umgekehrt verliert es noch in **41,1 %**. Das sind 37.280 Siege und 25.977 Niederlagen aus 63.257 Matches mit eindeutigem Erst-Team. Der frühe Gebäudevorteil ist also ein positives Signal, aber bei Weitem keine Vorentscheidung.

Wichtig ist die Definition: Hier geht es zunächst um den ersten Guardian irgendwo auf der Karte, nicht automatisch um den Guardian auf deiner eigenen Lane und auch nicht um den Spieler mit den meisten Kills. Weiter unten prüfen wir „Lane gewonnen“ deshalb noch einmal unabhängig davon anhand der Souls der ursprünglich zugewiesenen Lane-Spieler.

Der Spruch wird dadurch weder zur Regel noch zum Unsinn. Die Niederlage trotz frühem Vorteil ist häufig genug, dass viele Spieler sie kennen. Die Zahlen zeigen aber gerade nicht, dass man wegen eines gewonnenen Guardian-Rennens häufiger verliert als gewinnt.

## Hohe Elo: früherer Guardian, nicht automatisch mehr Siege

Wir teilen die durchschnittliche Match-Rangbewertung in drei Gruppen. „Elo“ ist hier die lesbare Kurzform für diese Gruppen, nicht der persönliche Rang des Spielers, der den letzten Treffer auf das Gebäude setzt. Die API-Badges 10 bis 49 bilden Initiate bis Arcanist ab, 50 bis 79 Ritualist bis Archon und 80 bis 119 Oracle bis Eternus.

Erstes Guardian- und Walker-Team nach durchschnittlichem Match-Rang

| Ranggruppe | Guardian: Siege | Guardian: Median | Guardian: n | Walker: Siege | Walker: Median | Walker: n |
| --- | --- | --- | --- | --- | --- | --- |
| Initiate bis Arcanist | 59,2 % | 8:08 | 26.674 | 64,6 % | 16:19 | 26.693 |
| Ritualist bis Archon | 58,2 % | 7:50 | 18.684 | 64,7 % | 16:12 | 18.680 |
| Oracle bis Eternus | 59,3 % | 7:08 | 17.899 | 64,3 % | 14:57 | 17.911 |

Median = Zeitpunkt des ersten Falls in Minuten:Sekunden. Die Siegquote gehört dem Team, das das gegnerische Gebäude zerstört hat. Quelle: first_objectives.json.

Der erste Guardian fällt in der hohen Gruppe im Median bei **7:08**, in der niedrigen bei **8:08**. Das ist eine volle Minute Unterschied. Die Siegquoten sind dagegen fast gleich: 59,3 gegenüber 59,2 Prozent; die mittlere Gruppe liegt bei 58,2 Prozent. Ein Rangaufstieg macht aus dem ersten Guardian in diesen Daten also keinen nahezu sicheren Sieg.

Beim ersten Walker ist das Bild ähnlich. In der hohen Gruppe fällt er im Median bei 14:57, in der niedrigen bei 16:19. Die zugehörigen Siegquoten bleiben trotzdem zwischen 64,3 und 64,7 Prozent. Der auffälligste Rangunterschied liegt hier im Tempo, nicht in einer dramatisch anderen Erfolgsquote nach dem ersten Gebäude.

Das bedeutet nicht, dass alle Ränge identisch spielen. Die großen Ranggruppen mischen unterschiedliche Helden, Teams und Matchverläufe. Die Tabelle zeigt nur, dass sich eine pauschale Erzählung wie „In hoher Elo ist nach dem ersten Guardian Schluss“ mit diesen Ergebnissen nicht halten lässt.

## Früh ist das Signal stärker, aber es gibt keine magische Minute

Über alle Ränge hinweg sinkt die beobachtete Siegquote mit einem späteren ersten Guardian. Wir verwenden feste Zeitfenster: „5 bis unter 8 Minuten“ schließt 5:00 ein, 8:00 aber aus. Die Grenzen sind Auswertungsgrenzen, keine vermuteten spielinternen Schalter.

Siegquote des Teams mit dem ersten Guardian nach Fallzeitpunkt

| Erster Guardian | Siege | Matches | 95%-Intervall |
| --- | --- | --- | --- |
| Vor 5:00 | 63,0 % | 2.349 | 61,0 bis 64,9 % |
| 5:00 bis vor 8:00 | 60,3 % | 33.928 | 59,7 bis 60,8 % |
| 8:00 bis vor 11:00 | 57,0 % | 25.431 | 56,4 bis 57,6 % |
| 11:00 bis vor 15:00 | 55,6 % | 1.549 | 53,2 bis 58,1 % |

95%-Wilson-Intervalle beschreiben rechnerische Unsicherheit der Anteile, nicht den kausalen Effekt des Guardians oder die Repräsentativität der API-Daten. Quelle: first_objectives.json.

Vor Minute fünf gewinnt das Erst-Team in 63,0 Prozent der Fälle. Zwischen Minute acht und elf sind es 57,0 Prozent, zwischen elf und fünfzehn 55,6 Prozent. Ein sehr früher erster Guardian ist damit das stärkere positive Signal. Aber selbst in der frühesten Gruppe verliert noch mehr als jedes dritte Team.

Auch innerhalb der Ranggruppen ist der grobe Unterschied zwischen sehr früh und später sichtbar. Beispielsweise liegen in der hohen Gruppe vor Minute fünf 64,5 Prozent Siege vor, zwischen acht und elf Minuten 55,6 Prozent. Die sehr späte High-Elo-Gruppe umfasst dagegen nur 44 Matches. Für eine starke Aussage über diese kleine Untergruppe reicht uns das nicht; sie steht vollständig in den Rohaggregaten, wird aber nicht zur Schlagzeile gemacht.

**Aus dieser Tabelle folgt nicht, dass Warten den Sieg kostet.** Teams, die den ersten Guardian besonders früh zerstören, können schon vorher stärker gewesen sein. Ein später Erst-Fall kann für einen ausgeglichenen Verlauf stehen. Die Uhrzeit ist damit auch ein Merkmal des bisherigen Spiels, nicht nur eine Entscheidung, die man isoliert verändern kann.

Ebenso wenig folgt daraus, dass nach Minute fünfzehn keine Guardians mehr stehen. Gemessen wird der erste Fall des gesamten Matches. Andere Guardians können deutlich später fallen. Eine Aussage über den letzten verbliebenen Guardian wäre eine andere Auswertung.

## Der erste Walker verrät mehr über den späteren Sieger

Das Team mit dem ersten gegnerischen Walker gewinnt in **64,5 %** der auswertbaren Matches: 40.843 Siege aus 63.284 Fällen. Das ist ein stärkerer unbereinigter Zusammenhang als beim ersten Guardian. Der Walker fällt im Median aber auch erst bei **15:57**, der erste Guardian bereits bei **7:46**. Zu diesem späteren Zeitpunkt hat das Match schon mehr über die Stärkeverhältnisse gezeigt.

Siegquote des Teams mit dem ersten Walker nach Fallzeitpunkt

| Erster Walker | Siege | Matches |
| --- | --- | --- |
| 8:00 bis vor 11:00 | 70,1 % | 1.225 |
| 11:00 bis vor 15:00 | 66,1 % | 25.474 |
| 15:00 bis vor 20:00 | 63,6 % | 29.412 |
| 20:00 bis vor 25:00 | 61,7 % | 6.622 |
| Ab 25:00 | 62,0 % | 463 |

Die 88 Fälle vor Minute acht bleiben in der Gesamtquote enthalten; die getrennten Kleingruppen stehen im Datenexport. Quelle: first_objectives.json.

Auch hier ist ein früher Fall mit mehr Siegen verbunden. Der Verlauf ist aber nicht in jedem Zeitfenster streng fallend. Ab Minute 25 liegt der Anteil wieder geringfügig höher als im vorherigen Fenster. Aus kleinen Unterschieden zwischen solchen Gruppen bauen wir keine optimale Push-Uhrzeit.

Die vorsichtige Lesart lautet: **Der erste Walker ist in dieser Stichprobe ein stärkeres Ergebnissignal als der erste Guardian.** Das ist nicht dasselbe wie „Ein Walker bringt exakt 5,6 Prozentpunkte mehr Siegchance“. Die Ereignisse liegen an verschiedenen Punkten des Spiels, und wir vergleichen keine zufällig zugeteilten, ansonsten identischen Teams.

## „Lane gewonnen“ noch einmal über Souls geprüft

Ein Guardian kann durch Rotation, eine andere Lane oder eine kurze Überzahl fallen. Deshalb stellen wir dem Gebäude-Signal eine zweite Messung gegenüber: Wer hat nach genau neun Minuten mehr Souls unter den ursprünglich dieser Lane zugewiesenen Spielern?

Pro Lane verlangen wir zwei Spieler je Team und gültige Soul-Werte aller vier Spieler bei 9:00. Als klaren Vorsprung zählen wir nur Fälle, in denen die stärkere Seite mehr als fünf Prozent über der anderen liegt. Enge Gleichstände und fehlende Messwerte werden nicht als gewonnene Lane umetikettiert. Die neun Minuten sind ein fester Vergleichspunkt, kein behauptetes offizielles Ende der Laning-Phase.

Späterer Matchsieg bei mehr als fünf Prozent Soul-Vorsprung nach neun Minuten

| Vergleich | Siege des führenden Teams | Auswertbare Fälle | 95%-Intervall |
| --- | --- | --- | --- |
| Gelb | 59,1 % | 49.095 | 58,7 bis 59,6 % |
| Blau | 59,1 % | 48.135 | 58,6 bis 59,5 % |
| Lila | 59,2 % | 49.471 | 58,7 bis 59,6 % |
| Gesamtes Team | 65,8 % | 42.259 | 65,3 bis 66,2 % |

Die Team-Zeile verlangt sechs gegen sechs Spieler. Ein Match kann in mehreren Lane-Zeilen vorkommen; die Lane-Zahlen dürfen nicht als unabhängige Matches addiert werden. Quelle: souls_at_9m.json.

Die drei Lanes liegen bei 59,1, 59,1 und 59,2 Prozent. Auch mit dieser zweiten Definition verliert also ungefähr vier von zehn Mal das Team der führenden Lane. Der Guardian-Befund ist damit nicht bloß ein sprachlicher Trick, bei dem ein einzelnes zerstörtes Gebäude zur kompletten gewonnenen Lane erklärt wird.

Ein **teamweiter** Soul-Vorsprung nach neun Minuten geht dagegen mit **65,8 %** Siegen einher. Das passt zu einer einfachen Interpretation: Eine starke Lane und ein insgesamt führendes Team sind zwei verschiedene Dinge. Es beweist aber keinen isolierten Mehrwert von 6,7 Prozentpunkten, denn die Bedingungen wählen unterschiedliche Matchgruppen aus.

In der hohen Ranggruppe gewinnt das teamweit führende Team in 67,5 Prozent der Fälle, in der niedrigen in 65,4 Prozent. Die jeweils führenden Lane-Paare liegen oben bei rund 60 bis 61 Prozent. Auch dort bleibt ein lokaler Vorteil deutlich unsicherer als die Vorstellung eines schon gewonnenen Matches.

Die Zuordnung verwendet die ursprüngliche Lane-Zuweisung der Spieler. Sie verrät nicht, wo diese Spieler bei 9:00 tatsächlich standen. Ihre Souls können auch durch Rotationen oder andere Aktionen entstanden sein. Wir messen den wirtschaftlichen Stand der zugewiesenen Lane-Paare, nicht neun Minuten ununterbrochenes Duell auf derselben Straße.

## Was daraus für den weiteren Spielverlauf folgt, und was offenbleibt

Für den späteren Ausgang liefert der erste Guardian ein positives, aber begrenztes Signal. Früh ist dieses Signal stärker, über die großen Ranggruppen hinweg bleibt es ähnlich. Der erste Walker hängt stärker mit dem Endergebnis zusammen, und ein teamweiter wirtschaftlicher Vorsprung ist informativer als die isolierte wirtschaftlich gewonnene Lane.

Unsere spielerische Einordnung daraus ist bewusst vorsichtig: **Behandle den gefallenen Guardian als erreichten Vorteil, nicht als Anspruch auf den Sieg.** Der Spruch ist kein Argument dafür, einen sicher erreichbaren Guardian absichtlich stehen zu lassen. Ob danach Rotation, weiterer Druck oder Farm die beste Nutzung dieses Vorteils ist, wurde in dieser Auswertung nicht direkt verglichen.

Für eine echte Entwicklungskurve müssten wir den Soul-Stand vor dem Guardian mit späteren Messpunkten vergleichen und ähnliche Ausgangslagen gegenüberstellen. Ebenso interessant wäre, wie oft innerhalb der nächsten fünf Minuten der Walker derselben Lane fällt oder der Gegner den Guardian-Vorteil ausgleicht. **Für diese Anschlussfragen enthält dieser Report noch keine abgeschlossene Messung.** Die publizierten Quoten beziehen sich auf den späteren Matchsieg, nicht auf gemessenen zusätzlichen Soul-Gewinn durch den Guardian.

Auch eine Rangliste einzelner Guardian- und Walker-Lanes wäre derzeit verfrüht. Die Spielerdaten verwenden für Gelb, Blau und Lila die IDs 1, 4 und 6. Die Gebäudeereignisse tragen dagegen Bezeichnungen wie Tier1Lane1, Tier1Lane3 und Tier1Lane4. Ohne geprüfte Zuordnung und vollständigen Vergleich wäre eine farbige „Wichtigster Walker“-Tabelle Scheingenauigkeit. Die fast gleichen Soul-Lane-Quoten oben ersetzen diesen Gebäude-Vergleich ausdrücklich nicht.

Der belastbare Zwischenstand ist deshalb konkreter als „Objectives sind wichtig“, aber schmaler als eine perfekte Handlungsanweisung: **Win lane, lose game passiert häufig. Win lane, win game passiert trotzdem häufiger.** Gerade das macht den Unterschied zwischen einem Vorteil und einer Entscheidung aus.

## Methodik: Was genau in diesen Zahlen steckt

**Quelle und Fenster.** Read-only-Abfragen über das Werkzeug execute_query des öffentlichen MCP-Servers der Deadlock-API, Tabelle match_player. Auswahl: Match-IDs ab 106.000.000 und unter 107.000.000, game_mode Normal, match_mode Ranked, match_outcome TeamWin. Die erfassten Matchstarts reichen vom 16. September 2026, 17:53:31 UTC, bis 21. September 2026, 21:33:56 UTC. Das sind keine sechs vollständigen Kalendertage und keine Zufallsstichprobe aller Deadlock-Partien. Abruf und Archivierung: 22. September 2026.

**Datenabdeckung.** Gemeint sind die öffentlich erfassten Matches dieser API, nicht ausschließlich deutsche Spieler, nicht ausschließlich Europa und nicht eine garantierte Vollerhebung des Spiels. Fehlende Rangwerte werden nicht geschätzt. Die Ergebnisse sind ein zeitlich begrenzter Datenbefund, keine universelle Aussage für jeden Patch. Region, Heldenauswahl und Patchunterschiede werden hier nicht separat kontrolliert. Abbrecher werden in diesen Abfragen nicht gesondert ausgeschlossen.

**Doppelzählungen.** Für die Gebäude-Abfrage wird die Metadatenkopie von player_slot 1 verwendet und je match_id die zuletzt erfasste Version anhand von created_at ausgewählt. Die Datenbank verwendet Spieler-Slots 1 bis 12, nicht 0 bis 11. Für die Soul-Abfrage wird je Match und Spieler-Slot die letzte Version gewählt. So wird ein Gebäudeereignis nicht zwölfmal als unabhängiger Fall gezählt.

**Welches Team?** objectives.team bezeichnet den Besitzer des gefallenen Gebäudes, nicht das Team, das es zerstört hat. Das Erst-Team ist daher die Gegenseite. Für Guardians werden Tier1Lane-Ereignisse verwendet, für Walker Tier2Lane-Ereignisse. Base Guardians werden nicht mit den Lane-Guardians vermischt. Nur positive Fallzeitpunkte innerhalb der Matchdauer und gültige Teamnamen werden berücksichtigt; die parallelen Ereignisarrays müssen gleich lang sein.

**Gleichzeitige Erst-Ereignisse.** Zerstören beide Teams in derselben Sekunde erstmals ein Gebäude dieser Kategorie, wird kein willkürliches Erst-Team gewählt. Mehrere gleichzeitige Erst-Fälle zugunsten desselben Teams bleiben eindeutig. Nach den Filtern sind 63.257 Guardian- und 63.284 Walker-Matches auswertbar. Die Differenz zur Grundgesamtheit darf nicht pauschal als Zahl gleichzeitiger Kills gelesen werden; auch andere Eignungsfilter können Fälle entfernen.

**Rang, Zeit und Souls.** Ranggruppen beruhen auf average_badge, nicht auf einem einzelnen Account. Zeitwerte in den Rangtabellen sind Mediane. Zeitfenster sind links geschlossen und rechts offen. Bei der Soul-Messung wird der vorhandene Messpunkt bei exakt 540 Sekunden verwendet. Fehlende Werte sind unbekannt, nicht null Souls. Der größere Soul-Wert muss mehr als das 1,05-Fache des kleineren betragen.

**Unsicherheit und Ursache.** Die 95-Prozent-Intervalle sind Wilson-Intervalle für die angezeigten Anteile. Sie berücksichtigen weder systematische Auswahlfehler der API noch mögliche Abhängigkeiten durch wiederkehrende Spieler. Die Haupttabellen sind deskriptiv und nicht um den Vorsprung vor dem Ereignis bereinigt. Deshalb sprechen wir von beobachteten Siegquoten und Signalen, nicht von bewiesenen zusätzlichen Siegen durch einen Tower-Kill.

**Reproduzierbarkeit.** Die drei erfolgreich ausgeführten SQL-Abfragen, ihre vollständigen JSON-Aggregate und die daraus berechneten CSV-Tabellen sind archiviert. Abgeschnittene Rohdatenantworten sowie fehlgeschlagene oder unvollständige Zusatzabfragen sind keine Grundlage der veröffentlichten Zahlen. Ein späterer Live-Aufruf kann wegen neuer oder korrigierter API-Daten leicht andere Werte ergeben; für diesen Artikel gelten die archivierten Ergebnisse.

## Daten, Abfragen und Quellen

[Deadlock-API: Datenzugang und MCP](https://www.deadlock-api.com/data-dumps) beschreibt den öffentlichen Zugang. Der Quellcode des API-Projekts dokumentiert die [Perspektive bei Gebäudeereignissen](https://github.com/deadlock-api/deadlock-api/blob/master/website/src/lib/tracker/objectives.ts), den [Neun-Minuten-Vergleich der Lanes](https://github.com/deadlock-api/deadlock-api/blob/master/website/src/lib/tracker/lane-matchup.ts) und die [Spieler-Lane-IDs](https://github.com/deadlock-api/deadlock-api/blob/master/website/src/lib/team-builder/lanes.ts). Die Auswertungsregeln dieses Artikels stehen oben und müssen nicht in jedem Detail denen des API-Trackers entsprechen.

[Guardian-/Walker-Tabellen als CSV](/blog-data/guardian-impact-2026/first_objectives.csv), [Soul-Lane-Tabellen als CSV](/blog-data/guardian-impact-2026/souls_at_9m.csv) und [Grundgesamtheit als JSON](/blog-data/guardian-impact-2026/cohort.json). Die SQL-Abfragen: [Grundgesamtheit](/blog-data/guardian-impact-2026/cohort.sql), [erste Gebäude](/blog-data/guardian-impact-2026/first_objectives.sql) und [Souls bei 9:00](/blog-data/guardian-impact-2026/souls_at_9m.sql). Die vollständigen JSON-Aggregate liegen unter [first_objectives.json](/blog-data/guardian-impact-2026/first_objectives.json) und [souls_at_9m.json](/blog-data/guardian-impact-2026/souls_at_9m.json).

Dieser Text ergänzt den [Objectives-Report über Urne, Midboss und Shrines](/blog/deadlock-objectives-2026/). Er beantwortet die Guardian-Frage mit einer eigenen aktuellen Stichprobe, ohne die alten Objective-Quoten als neue Guardian-Ergebnisse auszugeben.
