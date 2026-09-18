# Findings: Objectives und Erfolg über Ränge (Paket A)

Datenbasis: Deadlock-API-MCP-Server (`match_player`), Normal/Ranked/TeamWin, 2026-08-13 bis
2026-09-15 UTC, 523.602 Matches (QB-Lauf; QD-Lauf kurz danach 523.747, siehe Unsicherheiten).
Alle Werte je Rangstufe in `kapitel-1.json` bis `kapitel-6.json`, je Zeitklasse und Ranggruppe
in `kapitel-7.json`, Definitionen in `methodik.json`, jede Abfrage in `queries.sql`. Siegquoten
sind Beobachtungen ohne Kausalitätsaussage; Kapitel 6 schichtet zusätzlich nach Soul-Vorsprung,
Kapitel 7 wertet nach Zeitpunkt aus.

## Kapitel 1: Midboss (Rejuvenator)

In 517.296 von 523.602 Matches (98,8 Prozent) fiel mindestens ein Midboss; der erste Claim
geschah im Mittel nach 1.511 Sekunden, von 1.727 Sekunden auf Stufe 1 bis 1.097 Sekunden auf
Stufe 11, das Spiel wird nach oben also deutlich schneller ausgespielt. Das Team mit dem
ersten Rejuvenator gewann in 75,2 Prozent aller Fälle, mit leicht fallender Tendenz von 76,2
Prozent (Stufe 1) auf 72,1 Prozent (Stufe 10) und 69,1 Prozent (Stufe 11). Rejuvenator-Steals
(killed ungleich claimed) kamen auf 0,25 je Match vor, und je Steal-Ereignis gewann das
steilende Team nur in 43,2 Prozent der Fälle: Steals sind also häufig, aber kein Sieggarant.
3,98 Prozent aller
Matches hatten mindestens einen Abbrecher, sie bleiben enthalten (Begründung in methodik.json).

## Kapitel 2: Soul Urn

In 523.296 von 523.747 Matches (99,9 Prozent) wurde mindestens eine Urne abgeliefert, im
Mittel 1,90 Abgaben je Team und Match. Das Team mit der ersten Abgabe gewann in 55,3 Prozent
der Fälle (Nenner 511.560 Matches mit bestimmtem ersten Team, siehe Unsicherheiten), das Team
mit mehr Abgaben gewann in 68,3 Prozent (Nenner 431.152 Matches mit Abgabedifferenz). Die
Erkennungsregel (mindestens 5 von 6 Spielern eines Teams mit gleichem minimalem positiven
Zuwachs von `stats.gold_treasure` im selben Intervall) wurde an 20 zufällig gezogenen Matches
über das ganze Fenster von Hand gegengeprüft: 83 Regel-Abgaben, alle entsprechen sichtbaren
Team-Mustern, kein Idol-Sprung hat ausgelöst. Die erste Abgabe war im Mittel nach 902
Sekunden sichtbar (Checkpoint-Raster: 180 s bis 900 s, danach 300 s, je Stufe in
kapitel-2.json).

## Kapitel 3: Shrines (TitanShieldGenerator)

In 523.597 von 523.602 Matches (100,0 Prozent) fiel mindestens ein Shrine; jeder Versehene
hat 4 Shrines (2 je Team), insgesamt 1.146.494 Shrine-Fälle. Der erste Shrine-Fall geschah im
Mittel nach 1.944 Sekunden (1.654 bis 2.149 Sekunden je Stufe), das zerstörende Team gewann
in 93,1 Prozent der Fälle (92,2 bis 93,8 Prozent je Stufe). Vom ersten Shrine-Fall bis zum
Matchende vergingen im Mittel 289 Sekunden. `objectives.team` ist das Besitzer-Team: 91,3
Prozent aller gefallenen Shrines gehörten dem Verlierer-Team, bei Zerstoerer-Semantik müsste
der Anteil umgekehrt ausfallen.

## Kapitel 4: Unstable Rift

Nullbefund: Der Rift lässt sich aus `match_player` nicht messbar machen. Es gibt kein
Rift-Feld (alle 150 Spalten geprüft), `stats.gold_boss`/`stats.gold_boss_orb` zeigen je-Spieler-
Zuwachse ohne Teammuster und sind nicht rift-trennscharf, `power_up_buffs.type` enthält in der
Stichprobe nur Perma-Pickup- und Runen-Typen, die Demo-Endpunkte liefern für alle getesteten
Matches HTTP 404 und sind je Einzelmatch rate-limitiert, und `match_tracked_stats` ist eine
ID-Map ohne öffentliche Zuordnung. Wir haben deshalb, wie beauftragt, keine Ersatzkennzahl
gebaut; die Rift-Änderung vom 16.09. liegt zudem hinter dem Auswertungsfenster.

## Kapitel 5: Reihenfolge und Kombination

Basis sind 517.380 Matches (98,8 Prozent) mit allen drei Erst-Events. Die Urne fiel in 99,2
Prozent dieser Matches zuerst (Unterschranke, weil die Urnen-Zeit nur als Checkpoint-Upper-Bound
vorliegt), der Midboss in 0,8 Prozent, ein Shrine in 45 Matches (0,01 Prozent). Das spätere
Sieger-Team holte 3 der 3 Erst-Objectives in 40,2 Prozent und 2 in 44,0 Prozent der Fälle,
nur 2,4 Prozent der Sieger hatten keines geholt. Das Team mit der Mehrheit der Erst-Objectives
gewann in 84,2 Prozent der Matches (Unterschranke, siehe Unsicherheiten).

## Kapitel 6: Kontrolle, Soul-Vorsprung zum Ereigniszeitpunkt

Geschichtet nach der Net-Worth-Differenz des Ereignis-Teams zum Gegner an der letzten
Stützstelle vor dem Ereignis (vorn über 105 Prozent, gleichauf 95 bis 105 Prozent, hinten
unter 95 Prozent), bleibt in allen drei Kapiteln ein deutlicher Gradient: Ein Team, das beim
ersten Midboss-Claim vorn lag, gewann in 89,5 Prozent, gleichauf in 70,8, hinten in 45,7
Prozent. Beim ersten Shrine-Fall sind es 96,2, 87,9 und 75,7 Prozent, bei der ersten
Urnen-Abgabe 71,9, 55,7 und 38,0 Prozent. Das sind Beobachtungen, keine Wirkungen: die
Ereignis-Zeitpunkte sind nicht randomisiert, und der Soul-Vorsprung ist selbst eine Folge des
Spielverlaufs. Auffällig ist der Abstand zwischen Midboss und Shrine: ein hinten liegendes
Team gewinnt nach erstem Shrine-Fall noch in 75,7 Prozent, nach Erst-Claim aber nur in 45,7
Prozent der Fälle.

## Kapitel 7: Siegquote nach Zeitpunkt der Erst-Objectives

Je Zeitklasse (5-Minuten-Klassen für Midboss und Shrine, Stützstellen-Raster für die Urne) und
Ranggruppe (niedrig 1 bis 4, mittel 5 bis 7, hoch 8 bis 11) in `kapitel-7.json`, A2-Lauf vom
2026-09-18 tageweise wie QD. Der Gradient der Siegquoten über die Zeitklassen fällt je Ereignis
unterschiedlich aus: Beim ersten Midboss-Claim steigt die Quote des Claim-Teams von 72,9 Prozent
(Claim zwischen Minute 5 und 20) auf 78,1 Prozent (ab Minute 35) und bei der ersten Urnen-Abgabe
von 52,7 auf 59,9 Prozent, während sie beim ersten Shrine-Fall von 98,7 Prozent (vor Minute 20)
auf 82,9 Prozent (nach Minute 50) fällt: Ein früher erster Shrine-Fall ist praktisch immer ein
Zeichen für ein schon entschiedenes Spiel. Die Schichtung nach Soul-Vorsprung hebt die
Gradienten nicht auf: Beim Midboss gewinnt das Claim-Team auch innerhalb jeder Soul-Klasse mit
späterem Claim häufiger (von der frühesten bis zur Klasse 30 bis 35 Minuten: vorn 87 auf 91,
gleichauf 66 auf 74, hinten 39 auf 49 Prozent), bei der Urne steigen in den beiden großen
Klassen bis 900 s (98 Prozent der Fälle) nur vorn und gleichauf leicht an (67 auf 73 und 51 auf
56 Prozent), während hinten liegende Teams mit früher wie später erster Abgabe gleich selten
gewinnen (34 bis 41 Prozent), und beim ersten Shrine-Fall gilt der umgekehrte Gradient in jeder
Schicht (niedrige Ränge: vorn 99,7 auf 87,5, hinten 100,0 auf 74,2 Prozent von der frühesten
bis zur spätesten Klasse). Der Median des ersten Midboss-Claims sinkt von 1.714 Sekunden
(Stufe 1) auf 1.127 Sekunden (Stufe 10+11), der des ersten Shrine-Falls von 2.119 auf 1.687
Sekunden, die erste Urnen-Abgabe liegt in jeder Stufe bei Median 900 Sekunden (Checkpoint-
Raster). Frühe Midboss-Claims sind öfter umkämpft: Der Steal-Anteil am ersten Claim sinkt bei
niedrigen Rängen von 12,0 Prozent (vor Minute 20) auf 6,6 Prozent (ab Minute 35), bei hohen
von 13,3 auf 11,8 Prozent.

## Unsicherheiten

- Daten-drift: Die Quelle schreibt nachträglich Zeilen. QA und QB liefen back-to-back und
  stimmen exakt überein (523.602), QD kurz danach weicht um +145 Matches (+0,028 Prozent) ab.
  Alle Kapitel-6- und K5-Nenner tragen das.
- Urnen-Erkennung ist eine Regel, keine Spiel-Telemetrie: Auflösung nur auf das
  Checkpoint-Raster, mehrere Abgaben im selben Intervall würden zusammenfallen, und bei
  Gleichstand beider Teams im selben Intervall (11.736 Matches, 2,2 Prozent) ist das erste
  Team nicht bestimmbar und bleibt aus den Urnen-Siegquoten außen vor.
- Abbrecher-Matches (3,98 Prozent, je Stufe 1,6 bis 7,6 Prozent) sind enthalten; Ausschluss
  hätte vor allem lange und enge Partien entfernt.
- Stufe 11 (490 Matches, 0,09 Prozent) ist mit Stufe 10 als "10+11" zusammengelegt.
- Die Urnen-Werte in Kapitel 5 zählen bei Urnen-Gleichstand konservativ 0, die 84,2 Prozent
  zur Mehrheit sind also eine Unterschranke.
- Kapitel 7 wurde einen Tag später geladen (A2-Lauf 2026-09-18): Die Zeitklassen-Summen weichen
  um +347 (Midboss), +349 (Shrine) und -253 (Urne) Matches von den Kapitel-1-bis-3-Nennern ab
  (0,05 bis 0,07 Prozent Daten-drift, Details in plausibilitaet-a2.json). Ausgegliedert und
  nicht in den Klassen gezählt: 451 Urnen-Events mit Ereignis-Team, aber fehlendem Zeitgitter
  (Zahl deckungsgleich mit den urn_unbekannt aus Kapitel 6) und 5 Shrine-Zeilen, in denen kein
  Shrine tatsächlich zerstört wurde (nur destroyed_time_s = 0).
- Kapitel-7-Zeitklassen: dünne Randklassen unter max(1000, 0,5 Prozent) der Ereignisse sind mit
  der Nachbarklasse verschmolzen; wenige Matches mit unregelmäßigen Urnen-Stützpunkten (rund
  0,2 Prozent) sind beim Klassenbau auf den nächsten Rasterpunkt gehoben. Mediane sind für
  Midboss und Shrine auf 60-Sekunden-Raster interpoliert, für die Urne exakt; Urnen-Klassen
  sind obere Stützstellenwerte, keine exakten Abgabezeiten.
- Siegquoten sind Teamvergleiche ohne Kausalitätsaussage; die Schichtung in Kapitel 6 ist
  eine Beobachtung, kein Wirksamkeitsnachweis.

## Plausibilitätsprüfungen (Schritt 5)

Ergebnisse aus `plausibilitaet.json` (Lauf 2026-09-17):

- Tagesabdeckung ohne Löcher: 34 Tage, 2026-08-13 bis 2026-09-15, keine Lücken.
- Duplikate: 4.644 von 6.285.779 Zeilen (0,07 Prozent), je (match_id, account_id) auf die
  neueste `created_at` reduziert.
- Matchzahlen summieren sich: QB 523.602 = QA 523.602 (exakt), QD 523.747 (+145, Daten-drift,
  siehe oben).
- match_outcome-Filter schränkt nicht ein: matches_all = matches_teamwin = 523.602.
- Siegquoten ergänzen sich zu 100 Prozent: First-Claim 75,2 Prozent gegen 24,8 Prozent
  (Nenner 517.296); je Klasse gilt Siege plus Niederlagen = n (K6).
- Shrine-Semantik: 91,3 Prozent der gefallenen Shrines gehören dem Verlierer-Team, belegt
  Besitzer-Semantik von `objectives.team`.
- K5: f0 bis f3 summieren sich zu n_all3 (517.380), genau ein Erst-Event je Match (Gleich-
  stand in fester Reihenfolge Midboss, Urne, Shrine).
- K6: vorn + gleichauf + hinten + unbekannt = Ereignisfälle je Ereignis; unbekannt ist mit
  0 (Midboss), 5 (Shrine) und 451 (Urne) verschwindend klein.
- Urnen-Abgaben je Team annähernd symmetrisch: 993.354 (Team0) gegen 992.161 (Team1).

## Plausibilitätsprüfungen (Paket A2)

Ergebnisse aus `plausibilitaet-a2.json` (Lauf 2026-09-18):

- Zeitklassen-Summen gegen die Kapitel-Nenner: Midboss 517.643 gegen 517.296 (+347, +0,07
  Prozent), Shrine 523.946 gegen 523.597 (+349, +0,07 Prozent), Urne 511.307 gegen 511.560
  (-253, -0,05 Prozent); gegen die K6-Nenner aus dem QD-Lauf bleiben nach Ausweis der
  Sonderfälle +202, +204 und +198 Matches (Daten-drift zum Vortag).
- Zellen-Integrität: In allen 51 Klassen-mal-Ranggruppen-Zellen gilt n = vorn + gleichauf +
  hinten + unbekannt, und die Siege-Teilwerte der Schichtung summieren sich zu den Siegen der
  Zelle (0 Verletzungen).
- Histogramm-Konsistenz: Die je Rangstufe gelieferten Histogramme zählen je Ereignis exakt
  so viele Matches wie die Zeitklassen (517.643, 523.946, 511.307).
- Tagesabdeckung: 34 Tages-Dateien ohne Lücken, je Tag alle sechs Auswertungszweige.
