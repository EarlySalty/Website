#!/usr/bin/env python3
"""One-off editorial build from archived, successful public MCP query results.
No network calls. Re-run from this worktree to reproduce the static article.
"""
from __future__ import annotations
import csv
import hashlib
import html
import json
import math
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TASK = Path(__file__).resolve().parent
SITE = ROOT / 'dl-landing'
SLUG = 'deadlock-guardian-impact-2026'
POST = SITE / 'blog' / SLUG
PUBLIC = SITE / 'public' / 'blog-data' / 'guardian-impact-2026'
URL = 'https://deutsche-deadlock-community.de/blog/' + SLUG + '/'
DATA_URL = '/blog-data/guardian-impact-2026/'
TITLE = 'Win lane, lose game? Was ein früher Guardian über den Sieg verrät'
DESC = '63.438 Ranked-Matches: Das Team mit dem ersten Guardian gewinnt 58,9 Prozent, mit dem ersten Walker 64,5. Guardian-Timing, Elo und Lane-Souls offen ausgewertet.'
POST.mkdir(parents=True, exist_ok=True)
PUBLIC.mkdir(parents=True, exist_ok=True)

def load(name: str) -> list[dict]:
    d = json.loads((TASK / f'{name}.json').read_text())
    assert d.get('success') and not d.get('truncated'), name
    assert len(d['rows']) == d['rowCount'], name
    return [dict(zip(d['columns'], row)) for row in d['rows']]

cohort = load('cohort')[0]
objectives = load('first_objectives')
souls = load('souls_at_9m')
assert cohort['matches'] == 63438

def objective(kind: str, elo=None, timing=None) -> dict:
    found = [r for r in objectives if r['k'] == kind and r['elo'] == elo and r['timing'] == timing]
    assert len(found) == 1, (kind, elo, timing)
    return found[0]

def soul(lane: str, elo=None) -> dict:
    found = [r for r in souls if r['lane'] == lane and r['elo'] == elo]
    assert len(found) == 1, (lane, elo)
    return found[0]

def num(value: int) -> str:
    return f'{value:,}'.replace(',', '.')

def pct(r: dict) -> str:
    return f"{100 * r['wins'] / r['n']:.1f}".replace('.', ',') + ' %'

def clock(seconds: float) -> str:
    seconds = round(seconds)
    return f'{seconds // 60}:{seconds % 60:02d}'

def interval(r: dict) -> tuple[float, float]:
    n, wins, z = r['n'], r['wins'], 1.959963984540054
    p = wins / n
    denominator = 1 + z*z/n
    center = (p + z*z/(2*n))/denominator
    half = z * math.sqrt(p*(1-p)/n + z*z/(4*n*n))/denominator
    return (100*(center-half), 100*(center+half))

def ci(r: dict) -> str:
    lo, hi = interval(r)
    return f'{lo:.1f} bis {hi:.1f} %'.replace('.', ',')

# Count reconciliation is checked before rendering, including all time/rank splits.
for k in ('Tier1Lane', 'Tier2Lane'):
    total = objective(k)
    for dimension in ('elo', 'timing'):
        other = 'timing' if dimension == 'elo' else 'elo'
        parts = [r for r in objectives if r['k']==k and r[dimension] is not None and r[other] is None]
        assert sum(r['n'] for r in parts) == total['n']
        assert sum(r['wins'] for r in parts) == total['wins']
    for rank in ('low', 'mid', 'high'):
        parts = [r for r in objectives if r['k']==k and r['elo']==rank and r['timing'] is not None]
        assert sum(r['n'] for r in parts) == objective(k, rank)['n']
        assert sum(r['wins'] for r in parts) == objective(k, rank)['wins']
for lane in ('1', '4', '6', 'team'):
    assert sum(soul(lane, rank)['n'] for rank in ('low','mid','high')) == soul(lane)['n']
    assert sum(soul(lane, rank)['wins'] for rank in ('low','mid','high')) == soul(lane)['wins']
for r in objectives + souls:
    assert 0 <= r['wins'] <= r['n'] and r['n'] > 0
    lo, hi = interval(r)
    assert -1e-8 <= lo <= 100*r['wins']/r['n'] + 1e-8 <= hi + 1e-8 <= 100 + 1e-8

G = objective('Tier1Lane')
W = objective('Tier2Lane')
LOSS = {'wins': G['n']-G['wins'], 'n': G['n']}
T = soul('team')

class Document:
    def __init__(self):
        self.sections = []
        self.current = None
    def section(self, anchor, title):
        self.current = {'id':anchor,'title':title,'html':[],'md':[]}
        self.sections.append(self.current)
    def paragraph(self, text):
        self.current['html'].append('<p class="bl-p">'+text+'</p>')
        plain = re.sub(r'<a href="([^"]+)"[^>]*>(.*?)</a>', r'[\2](\1)', text)
        plain = re.sub(r'</?strong>', '**', plain)
        plain = re.sub(r'</?em>', '*', plain)
        self.current['md'].append(html.unescape(re.sub(r'<[^>]+>', '', plain)))
    def table(self, caption, heads, rows, note=''):
        h = '<div class="gi-table-wrap" tabindex="0" role="region" aria-label="'+html.escape(caption, quote=True)+'"><table><caption>'+html.escape(caption)+'</caption><thead><tr>'
        h += ''.join('<th scope="col">'+html.escape(x)+'</th>' for x in heads)+'</tr></thead><tbody>'
        for row in rows:
            h += '<tr><th scope="row">'+html.escape(str(row[0]))+'</th>'
            h += ''.join('<td>'+html.escape(str(x))+'</td>' for x in row[1:])+'</tr>'
        h += '</tbody></table></div>'
        if note: h += '<p class="gi-note">'+html.escape(note)+'</p>'
        self.current['html'].append(h)
        md = [caption, '', '| '+' | '.join(heads)+' |', '| '+' | '.join('---' for _ in heads)+' |']
        md += ['| '+' | '.join(str(v) for v in row)+' |' for row in rows]
        if note: md += ['', note]
        self.current['md'].append('\n'.join(md))

d = Document()
d.section('lane-sieg', 'Eine gewonnene Lane ist noch kein gewonnenes Spiel')
d.paragraph('Der Guardian fällt, die eigene Lane fühlt sich entschieden an, und zwanzig Minuten später ist trotzdem der eigene Patron weg. „Win lane, lose game“ beschreibt genau diesen Frust. Aber steckt dahinter mehr als eine Erinnerung an besonders ärgerliche Niederlagen?')
d.paragraph('Für diesen Folgeartikel haben wir den öffentlichen MCP-Server der Deadlock-API erneut abgefragt. Die neue Grundgesamtheit umfasst <strong>63.438 Ranked-Matches</strong> in einem fest abgegrenzten Match-ID-Bereich vom 16. bis 21. September 2026. Das ist eine andere Stichprobe als im <a href="/blog/deadlock-objectives-2026/">ersten Objectives-Report über Urne, Midboss und Shrines</a>. Die beiden Datensätze werden hier nicht zusammengeworfen.')
d.paragraph(f'Das Team, das den <strong>ersten gegnerischen Guardian des gesamten Matches</strong> zerstört, gewinnt in <strong>{pct(G)}</strong> der auswertbaren Fälle. Umgekehrt verliert es noch in <strong>{pct(LOSS)}</strong>. Das sind {num(G["wins"])} Siege und {num(LOSS["wins"])} Niederlagen aus {num(G["n"])} Matches mit eindeutigem Erst-Team. Der frühe Gebäudevorteil ist also ein positives Signal, aber bei Weitem keine Vorentscheidung.')
d.paragraph('Wichtig ist die Definition: Hier geht es zunächst um den ersten Guardian irgendwo auf der Karte, nicht automatisch um den Guardian auf deiner eigenen Lane und auch nicht um den Spieler mit den meisten Kills. Weiter unten prüfen wir „Lane gewonnen“ deshalb noch einmal unabhängig davon anhand der Souls der ursprünglich zugewiesenen Lane-Spieler.')
d.paragraph('Der Spruch wird dadurch weder zur Regel noch zum Unsinn. Die Niederlage trotz frühem Vorteil ist häufig genug, dass viele Spieler sie kennen. Die Zahlen zeigen aber gerade nicht, dass man wegen eines gewonnenen Guardian-Rennens häufiger verliert als gewinnt.')

d.section('elo', 'Hohe Elo: früherer Guardian, nicht automatisch mehr Siege')
d.paragraph('Wir teilen die durchschnittliche Match-Rangbewertung in drei Gruppen. „Elo“ ist hier die lesbare Kurzform für diese Gruppen, nicht der persönliche Rang des Spielers, der den letzten Treffer auf das Gebäude setzt. Die API-Badges 10 bis 49 bilden Initiate bis Arcanist ab, 50 bis 79 Ritualist bis Archon und 80 bis 119 Oracle bis Eternus.')
rank_labels = [('low','Initiate bis Arcanist'),('mid','Ritualist bis Archon'),('high','Oracle bis Eternus')]
rows=[]
for key,label in rank_labels:
    g,w=objective('Tier1Lane',key),objective('Tier2Lane',key)
    rows.append([label,pct(g),clock(g['median_s']),num(g['n']),pct(w),clock(w['median_s']),num(w['n'])])
d.table('Erstes Guardian- und Walker-Team nach durchschnittlichem Match-Rang', ['Ranggruppe','Guardian: Siege','Guardian: Median','Guardian: n','Walker: Siege','Walker: Median','Walker: n'], rows, 'Median = Zeitpunkt des ersten Falls in Minuten:Sekunden. Die Siegquote gehört dem Team, das das gegnerische Gebäude zerstört hat. Quelle: first_objectives.json.')
d.paragraph('Der erste Guardian fällt in der hohen Gruppe im Median bei <strong>7:08</strong>, in der niedrigen bei <strong>8:08</strong>. Das ist eine volle Minute Unterschied. Die Siegquoten sind dagegen fast gleich: 59,3 gegenüber 59,2 Prozent; die mittlere Gruppe liegt bei 58,2 Prozent. Ein Rangaufstieg macht aus dem ersten Guardian in diesen Daten also keinen nahezu sicheren Sieg.')
d.paragraph('Beim ersten Walker ist das Bild ähnlich. In der hohen Gruppe fällt er im Median bei 14:57, in der niedrigen bei 16:19. Die zugehörigen Siegquoten bleiben trotzdem zwischen 64,3 und 64,7 Prozent. Der auffälligste Rangunterschied liegt hier im Tempo, nicht in einer dramatisch anderen Erfolgsquote nach dem ersten Gebäude.')
d.paragraph('Das bedeutet nicht, dass alle Ränge identisch spielen. Die großen Ranggruppen mischen unterschiedliche Helden, Teams und Matchverläufe. Die Tabelle zeigt nur, dass sich eine pauschale Erzählung wie „In hoher Elo ist nach dem ersten Guardian Schluss“ mit diesen Ergebnissen nicht halten lässt.')

d.section('timing', 'Früh ist das Signal stärker, aber es gibt keine magische Minute')
d.paragraph('Über alle Ränge hinweg sinkt die beobachtete Siegquote mit einem späteren ersten Guardian. Wir verwenden feste Zeitfenster: „5 bis unter 8 Minuten“ schließt 5:00 ein, 8:00 aber aus. Die Grenzen sind Auswertungsgrenzen, keine vermuteten spielinternen Schalter.')
time_labels=[('00-05','Vor 5:00'),('05-08','5:00 bis vor 8:00'),('08-11','8:00 bis vor 11:00'),('11-15','11:00 bis vor 15:00')]
d.table('Siegquote des Teams mit dem ersten Guardian nach Fallzeitpunkt', ['Erster Guardian','Siege','Matches','95%-Intervall'], [[label,pct(objective('Tier1Lane',timing=t)),num(objective('Tier1Lane',timing=t)['n']),ci(objective('Tier1Lane',timing=t))] for t,label in time_labels], '95%-Wilson-Intervalle beschreiben rechnerische Unsicherheit der Anteile, nicht den kausalen Effekt des Guardians oder die Repräsentativität der API-Daten. Quelle: first_objectives.json.')
d.paragraph('Vor Minute fünf gewinnt das Erst-Team in 63,0 Prozent der Fälle. Zwischen Minute acht und elf sind es 57,0 Prozent, zwischen elf und fünfzehn 55,6 Prozent. Ein sehr früher erster Guardian ist damit das stärkere positive Signal. Aber selbst in der frühesten Gruppe verliert noch mehr als jedes dritte Team.')
d.paragraph('Auch innerhalb der Ranggruppen ist der grobe Unterschied zwischen sehr früh und später sichtbar. Beispielsweise liegen in der hohen Gruppe vor Minute fünf 64,5 Prozent Siege vor, zwischen acht und elf Minuten 55,6 Prozent. Die sehr späte High-Elo-Gruppe umfasst dagegen nur 44 Matches. Für eine starke Aussage über diese kleine Untergruppe reicht uns das nicht; sie steht vollständig in den Rohaggregaten, wird aber nicht zur Schlagzeile gemacht.')
d.paragraph('<strong>Aus dieser Tabelle folgt nicht, dass Warten den Sieg kostet.</strong> Teams, die den ersten Guardian besonders früh zerstören, können schon vorher stärker gewesen sein. Ein später Erst-Fall kann für einen ausgeglichenen Verlauf stehen. Die Uhrzeit ist damit auch ein Merkmal des bisherigen Spiels, nicht nur eine Entscheidung, die man isoliert verändern kann.')
d.paragraph('Ebenso wenig folgt daraus, dass nach Minute fünfzehn keine Guardians mehr stehen. Gemessen wird der erste Fall des gesamten Matches. Andere Guardians können deutlich später fallen. Eine Aussage über den letzten verbliebenen Guardian wäre eine andere Auswertung.')

d.section('walker', 'Der erste Walker verrät mehr über den späteren Sieger')
d.paragraph(f'Das Team mit dem ersten gegnerischen Walker gewinnt in <strong>{pct(W)}</strong> der auswertbaren Matches: {num(W["wins"])} Siege aus {num(W["n"])} Fällen. Das ist ein stärkerer unbereinigter Zusammenhang als beim ersten Guardian. Der Walker fällt im Median aber auch erst bei <strong>{clock(W["median_s"])}</strong>, der erste Guardian bereits bei <strong>{clock(G["median_s"])}</strong>. Zu diesem späteren Zeitpunkt hat das Match schon mehr über die Stärkeverhältnisse gezeigt.')
walker_times=[('08-11','8:00 bis vor 11:00'),('11-15','11:00 bis vor 15:00'),('15-20','15:00 bis vor 20:00'),('20-25','20:00 bis vor 25:00'),('25+','Ab 25:00')]
d.table('Siegquote des Teams mit dem ersten Walker nach Fallzeitpunkt', ['Erster Walker','Siege','Matches'], [[label,pct(objective('Tier2Lane',timing=t)),num(objective('Tier2Lane',timing=t)['n'])] for t,label in walker_times], 'Die 88 Fälle vor Minute acht bleiben in der Gesamtquote enthalten; die getrennten Kleingruppen stehen im Datenexport. Quelle: first_objectives.json.')
d.paragraph('Auch hier ist ein früher Fall mit mehr Siegen verbunden. Der Verlauf ist aber nicht in jedem Zeitfenster streng fallend. Ab Minute 25 liegt der Anteil wieder geringfügig höher als im vorherigen Fenster. Aus kleinen Unterschieden zwischen solchen Gruppen bauen wir keine optimale Push-Uhrzeit.')
d.paragraph('Die vorsichtige Lesart lautet: <strong>Der erste Walker ist in dieser Stichprobe ein stärkeres Ergebnissignal als der erste Guardian.</strong> Das ist nicht dasselbe wie „Ein Walker bringt exakt 5,6 Prozentpunkte mehr Siegchance“. Die Ereignisse liegen an verschiedenen Punkten des Spiels, und wir vergleichen keine zufällig zugeteilten, ansonsten identischen Teams.')

d.section('souls', '„Lane gewonnen“ noch einmal über Souls geprüft')
d.paragraph('Ein Guardian kann durch Rotation, eine andere Lane oder eine kurze Überzahl fallen. Deshalb stellen wir dem Gebäude-Signal eine zweite Messung gegenüber: Wer hat nach genau neun Minuten mehr Souls unter den ursprünglich dieser Lane zugewiesenen Spielern?')
d.paragraph('Pro Lane verlangen wir zwei Spieler je Team und gültige Soul-Werte aller vier Spieler bei 9:00. Als klaren Vorsprung zählen wir nur Fälle, in denen die stärkere Seite mehr als fünf Prozent über der anderen liegt. Enge Gleichstände und fehlende Messwerte werden nicht als gewonnene Lane umetikettiert. Die neun Minuten sind ein fester Vergleichspunkt, kein behauptetes offizielles Ende der Laning-Phase.')
labels=[('1','Gelb'),('4','Blau'),('6','Lila'),('team','Gesamtes Team')]
d.table('Späterer Matchsieg bei mehr als fünf Prozent Soul-Vorsprung nach neun Minuten', ['Vergleich','Siege des führenden Teams','Auswertbare Fälle','95%-Intervall'], [[label,pct(soul(lane)),num(soul(lane)['n']),ci(soul(lane))] for lane,label in labels], 'Die Team-Zeile verlangt sechs gegen sechs Spieler. Ein Match kann in mehreren Lane-Zeilen vorkommen; die Lane-Zahlen dürfen nicht als unabhängige Matches addiert werden. Quelle: souls_at_9m.json.')
d.paragraph('Die drei Lanes liegen bei 59,1, 59,1 und 59,2 Prozent. Auch mit dieser zweiten Definition verliert also ungefähr vier von zehn Mal das Team der führenden Lane. Der Guardian-Befund ist damit nicht bloß ein sprachlicher Trick, bei dem ein einzelnes zerstörtes Gebäude zur kompletten gewonnenen Lane erklärt wird.')
d.paragraph(f'Ein <strong>teamweiter</strong> Soul-Vorsprung nach neun Minuten geht dagegen mit <strong>{pct(T)}</strong> Siegen einher. Das passt zu einer einfachen Interpretation: Eine starke Lane und ein insgesamt führendes Team sind zwei verschiedene Dinge. Es beweist aber keinen isolierten Mehrwert von 6,7 Prozentpunkten, denn die Bedingungen wählen unterschiedliche Matchgruppen aus.')
d.paragraph('In der hohen Ranggruppe gewinnt das teamweit führende Team in 67,5 Prozent der Fälle, in der niedrigen in 65,4 Prozent. Die jeweils führenden Lane-Paare liegen oben bei rund 60 bis 61 Prozent. Auch dort bleibt ein lokaler Vorteil deutlich unsicherer als die Vorstellung eines schon gewonnenen Matches.')
d.paragraph('Die Zuordnung verwendet die ursprüngliche Lane-Zuweisung der Spieler. Sie verrät nicht, wo diese Spieler bei 9:00 tatsächlich standen. Ihre Souls können auch durch Rotationen oder andere Aktionen entstanden sein. Wir messen den wirtschaftlichen Stand der zugewiesenen Lane-Paare, nicht neun Minuten ununterbrochenes Duell auf derselben Straße.')

d.section('verlauf', 'Was daraus für den weiteren Spielverlauf folgt, und was offenbleibt')
d.paragraph('Für den späteren Ausgang liefert der erste Guardian ein positives, aber begrenztes Signal. Früh ist dieses Signal stärker, über die großen Ranggruppen hinweg bleibt es ähnlich. Der erste Walker hängt stärker mit dem Endergebnis zusammen, und ein teamweiter wirtschaftlicher Vorsprung ist informativer als die isolierte wirtschaftlich gewonnene Lane.')
d.paragraph('Unsere spielerische Einordnung daraus ist bewusst vorsichtig: <strong>Behandle den gefallenen Guardian als erreichten Vorteil, nicht als Anspruch auf den Sieg.</strong> Der Spruch ist kein Argument dafür, einen sicher erreichbaren Guardian absichtlich stehen zu lassen. Ob danach Rotation, weiterer Druck oder Farm die beste Nutzung dieses Vorteils ist, wurde in dieser Auswertung nicht direkt verglichen.')
d.paragraph('Für eine echte Entwicklungskurve müssten wir den Soul-Stand vor dem Guardian mit späteren Messpunkten vergleichen und ähnliche Ausgangslagen gegenüberstellen. Ebenso interessant wäre, wie oft innerhalb der nächsten fünf Minuten der Walker derselben Lane fällt oder der Gegner den Guardian-Vorteil ausgleicht. <strong>Für diese Anschlussfragen enthält dieser Report noch keine abgeschlossene Messung.</strong> Die publizierten Quoten beziehen sich auf den späteren Matchsieg, nicht auf gemessenen zusätzlichen Soul-Gewinn durch den Guardian.')
d.paragraph('Auch eine Rangliste einzelner Guardian- und Walker-Lanes wäre derzeit verfrüht. Die Spielerdaten verwenden für Gelb, Blau und Lila die IDs 1, 4 und 6. Die Gebäudeereignisse tragen dagegen Bezeichnungen wie Tier1Lane1, Tier1Lane3 und Tier1Lane4. Ohne geprüfte Zuordnung und vollständigen Vergleich wäre eine farbige „Wichtigster Walker“-Tabelle Scheingenauigkeit. Die fast gleichen Soul-Lane-Quoten oben ersetzen diesen Gebäude-Vergleich ausdrücklich nicht.')
d.paragraph('Der belastbare Zwischenstand ist deshalb konkreter als „Objectives sind wichtig“, aber schmaler als eine perfekte Handlungsanweisung: <strong>Win lane, lose game passiert häufig. Win lane, win game passiert trotzdem häufiger.</strong> Gerade das macht den Unterschied zwischen einem Vorteil und einer Entscheidung aus.')

d.section('methodik', 'Methodik: Was genau in diesen Zahlen steckt')
d.paragraph('<strong>Quelle und Fenster.</strong> Read-only-Abfragen über das Werkzeug execute_query des öffentlichen MCP-Servers der Deadlock-API, Tabelle match_player. Auswahl: Match-IDs ab 106.000.000 und unter 107.000.000, game_mode Normal, match_mode Ranked, match_outcome TeamWin. Die erfassten Matchstarts reichen vom 16. September 2026, 17:53:31 UTC, bis 21. September 2026, 21:33:56 UTC. Das sind keine sechs vollständigen Kalendertage und keine Zufallsstichprobe aller Deadlock-Partien. Abruf und Archivierung: 22. September 2026.')
d.paragraph('<strong>Datenabdeckung.</strong> Gemeint sind die öffentlich erfassten Matches dieser API, nicht ausschließlich deutsche Spieler, nicht ausschließlich Europa und nicht eine garantierte Vollerhebung des Spiels. Fehlende Rangwerte werden nicht geschätzt. Die Ergebnisse sind ein zeitlich begrenzter Datenbefund, keine universelle Aussage für jeden Patch. Region, Heldenauswahl und Patchunterschiede werden hier nicht separat kontrolliert. Abbrecher werden in diesen Abfragen nicht gesondert ausgeschlossen.')
d.paragraph('<strong>Doppelzählungen.</strong> Für die Gebäude-Abfrage wird die Metadatenkopie von player_slot 1 verwendet und je match_id die zuletzt erfasste Version anhand von created_at ausgewählt. Die Datenbank verwendet Spieler-Slots 1 bis 12, nicht 0 bis 11. Für die Soul-Abfrage wird je Match und Spieler-Slot die letzte Version gewählt. So wird ein Gebäudeereignis nicht zwölfmal als unabhängiger Fall gezählt.')
d.paragraph('<strong>Welches Team?</strong> objectives.team bezeichnet den Besitzer des gefallenen Gebäudes, nicht das Team, das es zerstört hat. Das Erst-Team ist daher die Gegenseite. Für Guardians werden Tier1Lane-Ereignisse verwendet, für Walker Tier2Lane-Ereignisse. Base Guardians werden nicht mit den Lane-Guardians vermischt. Nur positive Fallzeitpunkte innerhalb der Matchdauer und gültige Teamnamen werden berücksichtigt; die parallelen Ereignisarrays müssen gleich lang sein.')
d.paragraph('<strong>Gleichzeitige Erst-Ereignisse.</strong> Zerstören beide Teams in derselben Sekunde erstmals ein Gebäude dieser Kategorie, wird kein willkürliches Erst-Team gewählt. Mehrere gleichzeitige Erst-Fälle zugunsten desselben Teams bleiben eindeutig. Nach den Filtern sind 63.257 Guardian- und 63.284 Walker-Matches auswertbar. Die Differenz zur Grundgesamtheit darf nicht pauschal als Zahl gleichzeitiger Kills gelesen werden; auch andere Eignungsfilter können Fälle entfernen.')
d.paragraph('<strong>Rang, Zeit und Souls.</strong> Ranggruppen beruhen auf average_badge, nicht auf einem einzelnen Account. Zeitwerte in den Rangtabellen sind Mediane. Zeitfenster sind links geschlossen und rechts offen. Bei der Soul-Messung wird der vorhandene Messpunkt bei exakt 540 Sekunden verwendet. Fehlende Werte sind unbekannt, nicht null Souls. Der größere Soul-Wert muss mehr als das 1,05-Fache des kleineren betragen.')
d.paragraph('<strong>Unsicherheit und Ursache.</strong> Die 95-Prozent-Intervalle sind Wilson-Intervalle für die angezeigten Anteile. Sie berücksichtigen weder systematische Auswahlfehler der API noch mögliche Abhängigkeiten durch wiederkehrende Spieler. Die Haupttabellen sind deskriptiv und nicht um den Vorsprung vor dem Ereignis bereinigt. Deshalb sprechen wir von beobachteten Siegquoten und Signalen, nicht von bewiesenen zusätzlichen Siegen durch einen Tower-Kill.')
d.paragraph('<strong>Reproduzierbarkeit.</strong> Die drei erfolgreich ausgeführten SQL-Abfragen, ihre vollständigen JSON-Aggregate und die daraus berechneten CSV-Tabellen sind archiviert. Abgeschnittene Rohdatenantworten sowie fehlgeschlagene oder unvollständige Zusatzabfragen sind keine Grundlage der veröffentlichten Zahlen. Ein späterer Live-Aufruf kann wegen neuer oder korrigierter API-Daten leicht andere Werte ergeben; für diesen Artikel gelten die archivierten Ergebnisse.')

d.section('quellen', 'Daten, Abfragen und Quellen')
d.paragraph('<a href="https://www.deadlock-api.com/data-dumps">Deadlock-API: Datenzugang und MCP</a> beschreibt den öffentlichen Zugang. Der Quellcode des API-Projekts dokumentiert die <a href="https://github.com/deadlock-api/deadlock-api/blob/master/website/src/lib/tracker/objectives.ts">Perspektive bei Gebäudeereignissen</a>, den <a href="https://github.com/deadlock-api/deadlock-api/blob/master/website/src/lib/tracker/lane-matchup.ts">Neun-Minuten-Vergleich der Lanes</a> und die <a href="https://github.com/deadlock-api/deadlock-api/blob/master/website/src/lib/team-builder/lanes.ts">Spieler-Lane-IDs</a>. Die Auswertungsregeln dieses Artikels stehen oben und müssen nicht in jedem Detail denen des API-Trackers entsprechen.')
d.paragraph(f'<a href="{DATA_URL}first_objectives.csv">Guardian-/Walker-Tabellen als CSV</a>, <a href="{DATA_URL}souls_at_9m.csv">Soul-Lane-Tabellen als CSV</a> und <a href="{DATA_URL}cohort.json">Grundgesamtheit als JSON</a>. Die SQL-Abfragen: <a href="{DATA_URL}cohort.sql">Grundgesamtheit</a>, <a href="{DATA_URL}first_objectives.sql">erste Gebäude</a> und <a href="{DATA_URL}souls_at_9m.sql">Souls bei 9:00</a>. Die vollständigen JSON-Aggregate liegen unter <a href="{DATA_URL}first_objectives.json">first_objectives.json</a> und <a href="{DATA_URL}souls_at_9m.json">souls_at_9m.json</a>.')
d.paragraph('Dieser Text ergänzt den <a href="/blog/deadlock-objectives-2026/">Objectives-Report über Urne, Midboss und Shrines</a>. Er beantwortet die Guardian-Frage mit einer eigenen aktuellen Stichprobe, ohne die alten Objective-Quoten als neue Guardian-Ergebnisse auszugeben.')

lede = f'Du holst den ersten Guardian und verlierst trotzdem. Ein Blick auf {num(cohort["matches"])} Ranked-Matches zeigt: Das passiert oft, aber nicht öfter als der Sieg. Wie sich frühe und späte Guardians unterscheiden, was die Elo daran ändert und warum eine gewonnene Lane noch kein führendes Team ist.'
source_index = (SITE/'blog/index.html').read_text()
header = re.search(r'<header class="site-header">.*?</header>', source_index, re.S).group(0)
footer = re.search(r'<footer class="footer">.*?</footer>', source_index, re.S).group(0)
article_sections=[]
for i,s in enumerate(d.sections,1):
    article_sections.append(f'<section class="bl-section" id="{s["id"]}"><div class="container"><div class="bl-narrow"><p class="bl-eyebrow">Kapitel {i}</p><h2 class="bl-h2">{html.escape(s["title"])}</h2></div>'+''.join(s['html'])+'</div></section>')
md = '# '+TITLE+'\n\nStand: 22. September 2026. Datenfenster: 16. bis 21. September 2026 (genaue UTC-Grenzen in der Methodik).\n\n'+lede+'\n\n'
md += '\n\n'.join('## '+s['title']+'\n\n'+'\n\n'.join(s['md']) for s in d.sections)+'\n'
(TASK/'FINDINGS.md').write_text(md)
word_count=len(re.findall(r'\S+', re.sub('<[^>]+>',' ', ''.join(article_sections))))
jsonld={
 '@context':'https://schema.org', '@type':['Article','BlogPosting'],
 'headline':TITLE,'description':DESC,'datePublished':'2026-09-22','dateModified':'2026-09-22',
 'inLanguage':'de-DE','url':URL,'mainEntityOfPage':URL,
 'image':'https://deutsche-deadlock-community.de/images/og-logo.png',
 'isAccessibleForFree':True,'articleSection':'Daten-Report','wordCount':word_count,
 'author':{'@type':'Organization','name':'Deutsche Deadlock Community','url':'https://deutsche-deadlock-community.de/'},
 'publisher':{'@type':'Organization','name':'Deutsche Deadlock Community','logo':{'@type':'ImageObject','url':'https://deutsche-deadlock-community.de/brand/logo/logo-192.png'}},
 'citation':['https://www.deadlock-api.com/data-dumps', 'https://github.com/deadlock-api/deadlock-api/blob/master/website/src/lib/tracker/objectives.ts']
}
tiles=''
for value,label,sub in [(pct(G),'Siege mit dem ersten Guardian',f'{num(G["n"])} auswertbare Matches'),(pct(LOSS),'Trotz erstem Guardian verloren','Ein Vorteil ist keine Vorentscheidung'),(pct(W),'Siege mit dem ersten Walker',f'{num(W["n"])} auswertbare Matches'),(pct(T),'Siege mit Team-Soul-Vorsprung','Mehr als 5 % Vorsprung bei 9:00')]:
    tiles+='<div class="bl-tile"><span class="bl-tile-num">'+html.escape(value)+'</span><span class="bl-tile-label">'+html.escape(label)+'</span><span class="bl-tile-sub">'+html.escape(sub)+'</span></div>'
toc='<nav class="bl-toc" aria-label="Inhalt des Artikels"><h2>Inhalt</h2><ol>'+''.join(f'<li><a href="#{s["id"]}">{html.escape(s["title"])}</a></li>' for s in d.sections)+'</ol></nav>'
page=f'''<!doctype html>
<html lang="de"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">
<title>{html.escape(TITLE)} | Deutsche Deadlock Community</title>
<meta name="description" content="{html.escape(DESC,quote=True)}">
<link rel="canonical" href="{URL}"><link rel="alternate" hreflang="de" href="{URL}">
<meta property="og:type" content="article"><meta property="og:title" content="{html.escape(TITLE,quote=True)}">
<meta property="og:description" content="{html.escape(DESC,quote=True)}"><meta property="og:url" content="{URL}">
<meta property="og:image" content="https://deutsche-deadlock-community.de/images/og-logo.png">
<meta property="og:image:alt" content="Logo der Deutschen Deadlock Community"><meta property="og:locale" content="de_DE">
<meta property="og:site_name" content="Deutsche Deadlock Community"><meta property="article:published_time" content="2026-09-22">
<meta property="article:section" content="Daten-Report"><meta name="theme-color" content="#0b0b0b">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="{html.escape(TITLE,quote=True)}">
<meta name="twitter:description" content="{html.escape(DESC,quote=True)}"><meta name="twitter:image" content="https://deutsche-deadlock-community.de/images/og-logo.png">
<link rel="sitemap" type="application/xml" href="/sitemap.xml"><link rel="icon" type="image/png" href="/brand/logo/favicon-64.png">
<link rel="stylesheet" href="/brand/tokens.css"><link rel="stylesheet" href="/brand/nav.css"><link rel="stylesheet" href="./post.css">
<script src="/brand/nav.js" defer></script><script type="application/ld+json">{json.dumps(jsonld,ensure_ascii=False)}</script>
</head><body>
<a href="#main" class="sr-only">Zum Inhalt springen</a><div class="site-shell">{header}
<main id="main" class="bl-main gi-report"><article>
<section class="bl-hero"><div class="container"><p class="bl-eyebrow">Objectives · Daten-Report</p>
<h1>Win lane, lose game? <em>Was ein früher Guardian über den Sieg verrät</em></h1>
<p class="bl-hero-lede">{html.escape(lede)}</p>
<p class="bl-stamp"><b>Stand: 22. September 2026</b> · Matchstarts 16. bis 21. September · Deadlock-API, Ranked</p>
<div class="bl-tiles">{tiles}</div>
<p class="gi-note">Beobachtete Zusammenhänge, keine bewiesenen kausalen Effekte. Fallzahlen und Messregeln stehen bei den Tabellen.</p>
{toc}</div></section>{''.join(article_sections)}</article></main>
{footer}</div><script type="module" src="/src/site.js"></script></body></html>'''
(POST/'index.html').write_text(page)
(POST/'post.css').write_text('''@import url('../twitch-szene-2026/post.css');
/* Article-local additions only: do not change shared dashboard dimensions. */
.gi-report .bl-section .bl-p { max-width: 74ch; }
.gi-report .bl-hero h1 { max-width: 24ch; }
.gi-report .gi-table-wrap { margin: 1.8rem 0 1rem; overflow-x: auto; border: 1px solid var(--line-soft); border-radius: 14px; background: var(--panel); }
.gi-report .gi-table-wrap:focus-visible { outline: 2px solid var(--gold); outline-offset: 4px; }
.gi-report table { width: 100%; border-collapse: collapse; font-size: .87rem; line-height: 1.55; }
.gi-report caption { padding: 1rem 1.1rem; text-align: left; color: var(--bone); font-weight: 600; }
.gi-report th, .gi-report td { padding: .8rem 1.1rem; border-top: 1px solid var(--line-soft); vertical-align: top; }
.gi-report thead th { color: var(--bone); text-align: right; font-size: .77rem; }
.gi-report thead th:first-child, .gi-report tbody th { text-align: left; }
.gi-report tbody th { color: var(--bone); font-weight: 500; min-width: 11rem; }
.gi-report td { color: var(--bone-dim); text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
.gi-report .gi-note { max-width: 90ch; color: var(--bone-faint); font-size: .82rem; line-height: 1.65; margin: .9rem 0 1.7rem; }
.gi-report .bl-p { overflow-wrap: anywhere; }
@media (max-width: 600px) { .gi-report th, .gi-report td { padding: .7rem .8rem; } .gi-report .bl-stamp { border-radius: 14px; } }
''')

# Public research exports contain only successful aggregates, not player accounts.
for name in ('cohort','first_objectives','souls_at_9m'):
    for ext in ('json','sql'):
        shutil.copyfile(TASK/f'{name}.{ext}',PUBLIC/f'{name}.{ext}')
for name,rows in [('first_objectives',objectives),('souls_at_9m',souls)]:
    fields=list(rows[0])+['win_rate_percent','wilson_95_low_percent','wilson_95_high_percent']
    with (PUBLIC/f'{name}.csv').open('w',newline='') as f:
        writer=csv.DictWriter(f,fieldnames=fields,lineterminator='\n')
        writer.writeheader()
        for r in rows:
            lo,hi=interval(r)
            writer.writerow(dict(r,win_rate_percent=round(100*r['wins']/r['n'],6),wilson_95_low_percent=round(lo,6),wilson_95_high_percent=round(hi,6)))
(PUBLIC/'article.md').write_text(md)
manifest={'accessed':'2026-09-22','source':'https://api.deadlock-api.com/v1/mcp','tool':'execute_query',
 'scope':'Contiguous match-ID window [106000000,107000000), not random sampling or complete calendar days.',
 'cohort':cohort,'files':{f.name:hashlib.sha256(f.read_bytes()).hexdigest() for f in sorted(PUBLIC.iterdir()) if f.name!='manifest.json'}}
(PUBLIC/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')

card=f'''            <a class="bl-card" href="/blog/{SLUG}/">
              <p class="bl-card-meta">22. September 2026 · Daten-Report</p>
              <h2>{html.escape(TITLE)}</h2>
              <p>63.438 Ranked-Matches: Das Team mit dem ersten Guardian gewinnt 58,9 Prozent, mit dem ersten Walker 64,5. Frühe und späte Falls, Elo-Gruppen und Lane-Souls im Vergleich, mit Fallzahlen, Unsicherheit und offenen Anschlussfragen.</p>
            </a>
'''.replace('Frühe und späte Falls','Frühe und späte Fallzeitpunkte')
if f'href="/blog/{SLUG}/"' not in source_index:
    source_index=source_index.replace('          <div class="bl-list">','          <div class="bl-list">\n'+card,1)
    (SITE/'blog/index.html').write_text(source_index)
vite=SITE/'vite.config.js'
vite_text=vite.read_text()
if f'blog/{SLUG}/index.html' not in vite_text:
    needle="        blogDeadlockObjectives2026: 'blog/deadlock-objectives-2026/index.html',"
    assert vite_text.count(needle)==1
    vite.write_text(vite_text.replace(needle,needle+f"\n        blogDeadlockGuardianImpact2026: 'blog/{SLUG}/index.html',"))
sitemap=SITE/'public/sitemap.xml'
sitemap_text=sitemap.read_text()
if URL not in sitemap_text:
    assert sitemap_text.count('</urlset>')==1
    sitemap.write_text(sitemap_text.replace('</urlset>',f'  <url><loc>{URL}</loc><lastmod>2026-09-22</lastmod></url>\n</urlset>'))
# Add a contextual forward link; do not change the original report's statistics.
oldpost=SITE/'blog/deadlock-objectives-2026/index.html'
oldhtml=oldpost.read_text()
if f'/blog/{SLUG}/' not in oldhtml:
    needle='            <div class="bl-tiles">'
    assert oldhtml.count(needle)==1
    note=f'            <p class="bl-p">Neu am 22. September: <a href="/blog/{SLUG}/">Was ein früher Guardian über den Sieg verrät</a>. Der Folgeartikel untersucht Guardian-Timing, Walker und Lane-Souls nach Elo in einer eigenen Stichprobe.</p>\n\n'
    oldpost.write_text(oldhtml.replace(needle,note+needle))

# Minimal static checks are independent of Vite and the browser.
ids=re.findall(r'\bid="([^"]+)"',page)
assert len(ids)==len(set(ids)), 'Duplicate HTML ids'
for anchor in re.findall(r'href="#([^"]+)"',page):
    assert anchor in ids, anchor
for path in re.findall(r'href="(/blog-data/[^"#]+)"',page):
    assert (SITE/'public'/path.lstrip('/')).is_file(), path
assert page.count('<h1>')==1 and page.count('<table>')==4
assert 'data-fill' not in page
assert '\u2014' not in md
json.loads(re.search(r'<script type="application/ld\+json">(.*?)</script>',page,re.S).group(1))
print(json.dumps({'status':'PASS','word_count':word_count,'guardian':pct(G),'guardian_losses':pct(LOSS),'walker':pct(W),'team_souls':pct(T),'tables':4,'article':str(POST/'index.html')},ensure_ascii=False))
