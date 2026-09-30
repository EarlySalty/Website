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
PUBLISHED = '2026-09-22'
MODIFIED = '2026-09-23'
URL = 'https://deutsche-deadlock-community.de/blog/' + SLUG + '/'
DATA_URL = '/blog-data/guardian-impact-2026/'
TITLE = 'Win lane, lose game? Was ein früher Guardian über den Sieg verrät'
DESC = '63.438 Ranked-Matches: Das Team mit dem ersten Guardian gewinnt 58,9 Prozent, mit dem ersten Walker 64,5. Guardian-Timing, Elo und Lane-Souls offen ausgewertet. Zusätzlich: Base Guardians, wenn die eigene Basis erstmals fällt.'
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
base_audit = load('base_audit')[0]
base_first = load('base_first')
base_miles = load('base_milestones')
base_counts = load('base_counts')
assert cohort['matches'] == 63438
assert base_audit['invalid_milestones'] == 0 and base_audit['invalid_counts'] == 0

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

def share(wins: int, n: int) -> str:
    return f'{100 * wins / n:.1f}'.replace('.', ',') + ' %'

def flag(n: int) -> str:
    return '' if n >= 200 else ' *'

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

# Base-Guardian chapter: extraction and reconciliation on the stricter base filters.
BASE_TIMINGS = [('00-15','Vor 15:00'),('15-20','15:00 bis vor 20:00'),('20-25','20:00 bis vor 25:00'),
                ('25-30','25:00 bis vor 30:00'),('30-40','30:00 bis vor 40:00'),('40+','Ab 40:00')]
BASE_RANKS = [('low','Initiate bis Arcanist'),('mid','Ritualist bis Archon'),('high','Oracle bis Eternus')]
BA = base_audit
mv_totals = {r['map_version']: r['matches'] for r in base_first
             if r['elo']=='all' and r['timing']=='all' and r['soul_state']=='all'}
assert mv_totals
BASE_MV = max(mv_totals, key=mv_totals.get)
BASE_MV_OTHERS = sorted(v for v in mv_totals if v != BASE_MV)

def bfirst(elo=None, timing=None, soul=None):
    found = [r for r in base_first if r['map_version']==BASE_MV
             and r['elo']==(elo or 'all') and r['timing']==(timing or 'all')
             and r['soul_state']==(soul or 'all')]
    assert len(found) == 1, (elo, timing, soul)
    return found[0]

def bfirst_opt(elo=None, timing=None, soul=None):
    found = [r for r in base_first if r['map_version']==BASE_MV
             and r['elo']==(elo or 'all') and r['timing']==(timing or 'all')
             and r['soul_state']==(soul or 'all')]
    assert len(found) <= 1, (elo, timing, soul)
    return found[0] if found else None

def bmile(milestone, elo=None, timing=None, soul=None):
    found = [r for r in base_miles if r['map_version']==BASE_MV and r['milestone']==milestone
             and r['elo']==(elo or 'all') and r['timing']==(timing or 'all')
             and r['soul_state']==(soul or 'all')]
    assert len(found) == 1, (milestone, elo, timing, soul)
    return found[0]

def bcount(minute, elo=None):
    return [r for r in base_counts if r['map_version']==BASE_MV
            and r['minute']==minute and r['elo']==(elo or 'all')]

def bstate(rows, pred):
    n = sum(r['team_observations'] for r in rows if pred(r))
    w = sum(r['wins'] for r in rows if pred(r))
    if n == 0:
        return 'keine Beobachtung'
    return share(w, n) + flag(n)

BF = bfirst()
assert BF['ended_with_attacker_win_by_5m'] + BF['ended_with_defender_win_by_5m'] + BF['still_playing_after_5m'] == BF['matches']
for r in base_first:
    assert r['attacker_wins'] + r['defender_wins'] == r['matches']
for key, _ in BASE_RANKS:
    assert sum(bfirst(key, t)['matches'] for t, _ in BASE_TIMINGS) == bfirst(key)['matches']
    assert sum(bfirst(key, t)['attacker_wins'] for t, _ in BASE_TIMINGS) == bfirst(key)['attacker_wins']
assert sum(bfirst(None, t)['matches'] for t, _ in BASE_TIMINGS) == BF['matches']
assert sum(bfirst(None, t)['attacker_wins'] for t, _ in BASE_TIMINGS) == BF['attacker_wins']
for s in ('ahead','even','behind','unknown'):
    r = bfirst_opt(soul=s)
    if r is not None:
        assert r['ended_with_attacker_win_by_5m'] + r['ended_with_defender_win_by_5m'] + r['still_playing_after_5m'] == r['matches']
for m in (1, 2, 3):
    tot = bmile(m)
    assert tot['attacker_wins'] + tot['defender_wins'] == tot['team_observations']
    assert tot['distinct_matches'] <= tot['team_observations']
    assert sum(bmile(m, e)['team_observations'] for e, _ in BASE_RANKS) == tot['team_observations']
for r in base_counts:
    assert r['wins'] + r['losses'] == r['team_observations']
for minute in (15, 20, 25, 30, 35, 40):
    total = sum(x['team_observations'] for x in bcount(minute))
    per_rank = sum(sum(x['team_observations'] for x in bcount(minute, e)) for e, _ in BASE_RANKS)
    assert total == per_rank

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

d.section('base', 'Base Guardians: Wie viel Verteidigung bleibt nach dem ersten Verlust?')
d.paragraph(f'Nach Lane-Guardians und Walkern geht es um die letzte Verteidigungslinie: Base Guardians stehen vor dem eigenen Patron. Erfasst werden die Ereignisse mit den Gebäude-Kennungen 1, 3 und 4. Diese Abfragen stellen strengere Anforderungen als die Kapitel oben, deshalb ist der Ausschnitt kleiner: Von {num(BA["candidate_matches"])} Kandidaten-Matches bleiben {num(BA["eligible_matches"])} nach allen Prüfungen übrig; {num(BA["rejected_metadata_matches"])} scheitern an den Metadaten-Prüfungen und {num(BA["rejected_base_matches"])} an widersprüchlichen oder ungeeigneten Base-Ereignissen. Gemessen wird der erste eindeutig einem Besitzer-Team zuzuordnende Verlust und danach, wie das Match weitergeht.')
btime_rows = []
for t, label in BASE_TIMINGS:
    r = bfirst(None, t)
    btime_rows.append([label, share(r['attacker_wins'], r['matches']) + flag(r['matches']), num(r['matches']), ci({'wins': r['attacker_wins'], 'n': r['matches']}), clock(r['median_remaining_s'])])
d.table('Siegquote des Angreifers nach dem ersten Base-Guardian-Verlust, nach Fallzeitpunkt', ['Erster Base-Verlust','Angreifer gewinnt','Matches','95%-Intervall','Restspielzeit im Median'], btime_rows, 'Blickrichtung: Team des zerstörten Gebäudes gegen Team des ersten Base-Kills, alle Matches mit eindeutigem ersten Verlust der Karten-Version ' + str(BASE_MV) + '. Restspielzeit = Median vom ersten Fall bis zum Matchende. Sternchen: unter 200 Matches. Quelle: base_first.json.')
d.paragraph(f'Über alle Fallzeiten hinweg gewinnt der Angreifer des ersten Base Guardians in <strong>{share(BF["attacker_wins"], BF["matches"])}</strong> der Fälle, die verteidigende Seite noch in <strong>{share(BF["defender_wins"], BF["matches"])}</strong>. Späte erste Verluste sind dabei das schärfere Signal: ein Verlust nach Minute 40 fällt meist in ein Match, das ohnehin schon in eine Richtung gelaufen ist. Der Median der Restspielzeit zeigt das direkt: Nach einem frühen Verlust bleibt viel Zeit, nach einem späten kaum noch.')
d.paragraph(f'Nach Ranggruppen liegt die Angreifer-Quote bei {share(bfirst("low")["attacker_wins"], bfirst("low")["matches"])} in der niedrigen, {share(bfirst("mid")["attacker_wins"], bfirst("mid")["matches"])} in der mittleren und {share(bfirst("high")["attacker_wins"], bfirst("high")["matches"])} in der hohen Gruppe. Matches ohne Rangwert fließen in die Base-Tabellen nicht ein und stehen im Audit.')
bm_rows = []
for m in (1, 2, 3):
    r = bmile(m)
    bm_rows.append(['Erster Verlust' if m == 1 else ('Zweiter Verlust' if m == 2 else 'Dritter Verlust'),
                    share(r['attacker_wins'], r['team_observations']) + flag(r['team_observations']),
                    share(r['defender_wins'], r['team_observations']),
                    num(r['team_observations']), num(r['distinct_matches']), clock(r['median_fallen_s'])])
d.table('Erster, zweiter und dritter eigener Base-Verlust: spätere Siege beider Seiten', ['Verluststufe','Angreifer gewinnt','Verteidiger gewinnt','Team-Sichten','Matches','Fallzeit im Median'], bm_rows, 'Team-Sichten zählen beide Seiten eines Matches gesondert; dasselbe Match kann mehrere Stufen beitragen, deshalb sind Team-Sichten und Matches verschieden. „Verteidiger gewinnt“ ist der spätere Matchsieg trotz dieses Verlusts, eine Beschreibung und keine Wirkungsaussage. Quelle: base_milestones.json.')
d.paragraph('Der Vergleich der Stufen ist eine Beschreibung des Spielverlaufs und keine isolierte Wirkung des Verlusts: Ein Match kommt erst in die dritte Stufe, wenn zwei Verluste schon geschehen sind. Die Fallzeit-Spalte zeigt, wie spät das üblicherweise passiert, und die späten Stufen liegen meist in Matches, die ohnehin schon in eine Richtung gelaufen sind.')
bc_rows = []
for minute in (15, 20, 25, 30, 35, 40):
    rows = bcount(minute)
    bc_rows.append(['Bei ' + str(minute) + ':00', num(sum(r['team_observations'] for r in rows)),
                    bstate(rows, lambda r: r['lost'] == 0), bstate(rows, lambda r: r['lost'] == 1),
                    bstate(rows, lambda r: r['lost'] >= 2)])
d.table('Team-Sichten auf noch laufende Matches: Siege nach Anzahl eigener Base-Verluste bis zur jeweiligen Minute', ['Spielminute','Team-Sichten','Sieg ohne eigenen Verlust','Sieg mit genau einem','Sieg mit zwei bis drei'], bc_rows, 'Beobachtungseinheit ist die Team-Sicht eines Matches, das zur jeweiligen Minute noch läuft; jedes Match zählt hier zweimal, einmal je Seite. Eigene und gegnerische Verluste werden getrennt gezählt, ein 1:0 wird also nicht mit einem 1:2 vermischt; die feinen Kombinationen stehen im Datenexport. Sternchen: unter 200 Beobachtungen. Quelle: base_counts.json.')
d.paragraph('Die Spalten sind bewusst als Momentaufnahmen gelesen und nicht als Verlaufskurve desselben Matches: Ein Team mit zwei Verlusten bei 30:00 ist eine Auswahl besonders lange laufender, ungleicher Spiele. Gespiegelte Zustände wie ein beidseitiges 1:1 liegen durch die Konstruktion bei der halben Siegquote; dieser Konstruktionseffekt wird im Methodik-Kapitel eingeordnet und bringt keinen eigenen Befund.')
bsoul_rows = []
SOUL_KEYS = [('ahead','Angreifer wirtschaftlich vorne'),('even','ungefähr gleichauf'),('behind','Angreifer wirtschaftlich hinten'),('unknown','ohne geeignete Soul-Messung')]
BSOUL_PRESENT = [k for k, _ in SOUL_KEYS if bfirst_opt(soul=k) is not None]
for key, label in [(k, l) for k, l in SOUL_KEYS if k in BSOUL_PRESENT]:
    r = bfirst(soul=key)
    n = r['matches']
    bsoul_rows.append([label, num(n), share(r['attacker_wins'], n) + flag(n),
                       share(r['ended_with_attacker_win_by_5m'], n), share(r['ended_with_defender_win_by_5m'], n),
                       share(r['still_playing_after_5m'], n)])
d.table('Erster Base-Verlust nach Soul-Lage des Angreifers und Verlauf der nächsten fünf Minuten', ['Soul-Lage des Angreifers','Matches','Angreifer gewinnt','Ende in 5 Min: Angreifer','Ende in 5 Min: Verteidiger','läuft weiter'], bsoul_rows, 'Soul-Lage aus der letzten gemeinsamen Messung aller zwölf Spieler strikt vor dem Ereignis, höchstens 300 Sekunden alt; der größere Wert muss mehr als das 1,05-Fache des kleineren sein. Die drei Ausgangsspalten addieren sich zu 100 Prozent. Von den weiterlaufenden Matches stehen weitere Base-Verluste und Gegenangriffe im Export.' + ('' if 'unknown' in BSOUL_PRESENT else ' Fehlende geeignete Soul-Messung trat beim ersten Verlust nicht auf.') + ' Quelle: base_first.json.')
d.paragraph(f'Von den Matches, in denen der Angreifer beim ersten Base-Verlust wirtschaftlich vorne lag, enden {share(bfirst(soul="ahead")["ended_with_attacker_win_by_5m"], bfirst(soul="ahead")["matches"])} schon in den folgenden fünf Minuten mit dem Matchsieg des Angreifers. Bei wirtschaftlichem Rückstand sind es {share(bfirst(soul="behind")["ended_with_attacker_win_by_5m"], bfirst(soul="behind")["matches"])}. Der Base-Verlust ist damit auch eine Frage, was die Angreifer mit dem Vorteil anfangen: Ein Teil der Spiele entscheidet sich direkt, ein Teil läuft weiter, und gerade dort kann die verteidigende Seite den Verlust noch überstehen.')
d.paragraph('Zwei Grenzen gehören zu diesem Kapitel: Ob ein Base-Guardian-Eintrag einen einzelnen Gegner oder die Gruppe derselben Lane meint, ist an diesen Daten nicht geprüft, gezählt werden Einträge. Und alle Quoten sind beobachtete Grundraten ohne Kontrolle für Teamstärke, restliche Objectives oder Spielverlauf. Ein späterer Base-Verlust ist auch ein Merkmal eines bereits ungleichen Spiels.')

d.section('verlauf', 'Was daraus für den weiteren Spielverlauf folgt, und was offenbleibt')
d.paragraph('Für den späteren Ausgang liefert der erste Guardian ein positives, aber begrenztes Signal. Früh ist dieses Signal stärker, über die großen Ranggruppen hinweg bleibt es ähnlich. Der erste Walker hängt stärker mit dem Endergebnis zusammen, und ein teamweiter wirtschaftlicher Vorsprung ist informativer als die isolierte wirtschaftlich gewonnene Lane.')
d.paragraph('Unsere spielerische Einordnung daraus ist bewusst vorsichtig: <strong>Behandle den gefallenen Guardian als erreichten Vorteil, nicht als Anspruch auf den Sieg.</strong> Der Spruch ist kein Argument dafür, einen sicher erreichbaren Guardian absichtlich stehen zu lassen. Ob danach Rotation, weiterer Druck oder Farm die beste Nutzung dieses Vorteils ist, wurde in dieser Auswertung nicht direkt verglichen.')
d.paragraph('Für eine echte Entwicklungskurve müssten wir den Soul-Stand vor dem Guardian mit späteren Messpunkten vergleichen und ähnliche Ausgangslagen gegenüberstellen. <strong>Für diese Anschlussfrage enthält dieser Report weiterhin keine abgeschlossene Messung.</strong> Wie es nach dem ersten Verlust der eigenen Basis weitergeht, messen wir dagegen im Base-Guardian-Kapitel oben, einschließlich der folgenden fünf Minuten. Der Walker derselben Lane und der Ausgleich des Guardian-Vorteils bleiben dort genauso offen wie der Soul-Verlauf. Die publizierten Quoten beziehen sich auf den späteren Matchsieg, nicht auf gemessenen zusätzlichen Soul-Gewinn durch den Guardian.')
d.paragraph('Auch eine Rangliste einzelner Guardian- und Walker-Lanes wäre derzeit verfrüht. Die Spielerdaten verwenden für Gelb, Blau und Lila die IDs 1, 4 und 6. Die Gebäudeereignisse tragen dagegen Bezeichnungen wie Tier1Lane1, Tier1Lane3 und Tier1Lane4. Ohne geprüfte Zuordnung und vollständigen Vergleich wäre eine farbige „Wichtigster Walker“-Tabelle Scheingenauigkeit. Die fast gleichen Soul-Lane-Quoten oben ersetzen diesen Gebäude-Vergleich ausdrücklich nicht.')
d.paragraph('Der belastbare Zwischenstand ist deshalb konkreter als „Objectives sind wichtig“, aber schmaler als eine perfekte Handlungsanweisung: <strong>Win lane, lose game passiert häufig. Win lane, win game passiert trotzdem häufiger.</strong> Gerade das macht den Unterschied zwischen einem Vorteil und einer Entscheidung aus.')

d.section('methodik', 'Methodik: Was genau in diesen Zahlen steckt')
d.paragraph('<strong>Quelle und Fenster.</strong> Read-only-Abfragen über das Werkzeug execute_query des öffentlichen MCP-Servers der Deadlock-API, Tabelle match_player. Auswahl: Match-IDs ab 106.000.000 und unter 107.000.000, game_mode Normal, match_mode Ranked, match_outcome TeamWin. Die erfassten Matchstarts reichen vom 16. September 2026, 17:53:31 UTC, bis 21. September 2026, 21:33:56 UTC. Das sind keine sechs vollständigen Kalendertage und keine Zufallsstichprobe aller Deadlock-Partien. Abruf und Archivierung: 22. September 2026.')
d.paragraph('<strong>Datenabdeckung.</strong> Gemeint sind die öffentlich erfassten Matches dieser API, nicht ausschließlich deutsche Spieler, nicht ausschließlich Europa und nicht eine garantierte Vollerhebung des Spiels. Fehlende Rangwerte werden nicht geschätzt. Die Ergebnisse sind ein zeitlich begrenzter Datenbefund, keine universelle Aussage für jeden Patch. Region, Heldenauswahl und Patchunterschiede werden hier nicht separat kontrolliert. Abbrecher werden in diesen Abfragen nicht gesondert ausgeschlossen.')
d.paragraph('<strong>Doppelzählungen.</strong> Für die Gebäude-Abfrage wird die Metadatenkopie von player_slot 1 verwendet und je match_id die zuletzt erfasste Version anhand von created_at ausgewählt. Die Datenbank verwendet Spieler-Slots 1 bis 12, nicht 0 bis 11. Für die Soul-Abfrage wird je Match und Spieler-Slot die letzte Version gewählt. So wird ein Gebäudeereignis nicht zwölfmal als unabhängiger Fall gezählt.')
d.paragraph('<strong>Welches Team?</strong> objectives.team bezeichnet den Besitzer des gefallenen Gebäudes, nicht das Team, das es zerstört hat. Das Erst-Team ist daher die Gegenseite. Für Guardians werden Tier1Lane-Ereignisse verwendet, für Walker Tier2Lane-Ereignisse. Base Guardians werden nicht mit den Lane-Guardians vermischt. Nur positive Fallzeitpunkte innerhalb der Matchdauer und gültige Teamnamen werden berücksichtigt; die parallelen Ereignisarrays müssen gleich lang sein.')
d.paragraph('<strong>Base Guardians: strenge Zählregeln.</strong> Das Base-Kapitel betrachtet BarrackBossLane-Ereignisse mit den Gebäude-Kennungen 1, 3 und 4, also die Verteidigungslinien vor dem Patron. Ob ein Zeitstempel einen einzelnen Gegner oder die komplette Base-Guardian-Gruppe derselben Lane abbildet, ist an diesen Daten ungeprüft; gezählt werden deshalb Einträge, ohne sie in eine Figurenanzahl umzurechnen. Ein Match fließt nur ein, wenn alle zwölf Spielerzeilen konsistent sind, die Metadaten übereinstimmen und der Datensatz den Core-Verlust des Verlierer-Teams enthält. Ein leerer Objective-Datensatz gilt damit als ungeeignet und nicht als Match ohne Base-Verlust. Widersprüchliche Fallzeiten für denselben Besitzer und dasselbe Gebäude führen zum Ausschluss, identische Dubletten werden zusammengefasst, Zeitstempel null gelten nicht als Zerstörung.')
d.paragraph(f'<strong>Base Guardians: Nenner und Perspektiven.</strong> Von {num(BA["candidate_matches"])} Kandidaten-Matches bleiben {num(BA["eligible_matches"])} auswertbar, davon {num(BA["matches_with_abandon"])} mit Abbrecher-Meldung; die Grundgesamtheit von {num(cohort["matches"])} Matches ist hier bewusst kein Nenner, und ein Vergleich mit Guardian oder Walker müsste auf dieser geprüften Auswahl neu gerechnet werden. Die Base-Abfragen stammen aus dem Abruf am 23. September 2026, die Erstauswertung vom 22.; die Quelle aktualisiert Rohdaten nachträglich, deshalb stehen die Kapitel auf unterschiedlichen Abrufständen desselben Fensters. '
 + ('In keinem auswertbaren Match fehlt die Base-Telemetrie vollständig.' if BA['matches_without_recorded_base_loss'] == 0 else f'{num(BA["matches_without_recorded_base_loss"])} auswertbare Matches enthalten keinen Base-Eintrag und zählen nur in den Momentaufnahmen.')
 + f' Die Soul-Einordnung nutzt die letzte gemeinsame Messung aller zwölf Spieler strikt vor dem Ereignis, höchstens 300 Sekunden alt; ohne geeignete Messung bleibt die Lage unbekannt. Abbrecher-Matches bleiben enthalten, der Datenexport zählt Siege zusätzlich ohne sie aus. Verluststufen und Momentaufnahmen zählen Team-Sichten, dasselbe Match kann beide Perspektiven beitragen; sie sind keine unabhängigen Match-Beobachtungen. Gespiegelte Zustände wie ein beidseitiges 1:1 liegen durch die Konstruktion bei der halben Siegquote; daraus wird kein Befund abgeleitet. Die Ausgaben je Karten-Version werden getrennt ausgewiesen, die Tabellen zeigen Version ' + str(BASE_MV) + ('; die übrigen Versionen stehen im Export.' if BASE_MV_OTHERS else '.'))
d.paragraph('<strong>Gleichzeitige Erst-Ereignisse.</strong> Zerstören beide Teams in derselben Sekunde erstmals ein Gebäude dieser Kategorie, wird kein willkürliches Erst-Team gewählt. Mehrere gleichzeitige Erst-Fälle zugunsten desselben Teams bleiben eindeutig. Nach den Filtern sind 63.257 Guardian- und 63.284 Walker-Matches auswertbar. Die Differenz zur Grundgesamtheit darf nicht pauschal als Zahl gleichzeitiger Kills gelesen werden; auch andere Eignungsfilter können Fälle entfernen.')
d.paragraph('<strong>Rang, Zeit und Souls.</strong> Ranggruppen beruhen auf average_badge, nicht auf einem einzelnen Account. Zeitwerte in den Rangtabellen sind Mediane. Zeitfenster sind links geschlossen und rechts offen. Bei der Soul-Messung wird der vorhandene Messpunkt bei exakt 540 Sekunden verwendet. Fehlende Werte sind unbekannt, nicht null Souls. Der größere Soul-Wert muss mehr als das 1,05-Fache des kleineren betragen.')
d.paragraph('<strong>Unsicherheit und Ursache.</strong> Die 95-Prozent-Intervalle sind Wilson-Intervalle für die angezeigten Anteile. Sie berücksichtigen weder systematische Auswahlfehler der API noch mögliche Abhängigkeiten durch wiederkehrende Spieler. Die Haupttabellen sind deskriptiv und nicht um den Vorsprung vor dem Ereignis bereinigt. Deshalb sprechen wir von beobachteten Siegquoten und Signalen, nicht von bewiesenen zusätzlichen Siegen durch einen Tower-Kill.')
d.paragraph('<strong>Reproduzierbarkeit.</strong> Die sieben erfolgreich ausgeführten SQL-Abfragen (drei zur Erstauswertung, vier zur Base-Guardian-Ergänzung), ihre vollständigen JSON-Aggregate und die daraus berechneten CSV-Tabellen sind archiviert. Abgeschnittene Rohdatenantworten sowie fehlgeschlagene oder unvollständige Zusatzabfragen sind keine Grundlage der veröffentlichten Zahlen. Ein späterer Live-Aufruf kann wegen neuer oder korrigierter API-Daten leicht andere Werte ergeben; für diesen Artikel gelten die archivierten Ergebnisse.')

d.section('quellen', 'Daten, Abfragen und Quellen')
d.paragraph('<a href="https://www.deadlock-api.com/data-dumps">Deadlock-API: Datenzugang und MCP</a> beschreibt den öffentlichen Zugang. Der Quellcode des API-Projekts dokumentiert die <a href="https://github.com/deadlock-api/deadlock-api/blob/master/website/src/lib/tracker/objectives.ts">Perspektive bei Gebäudeereignissen</a>, den <a href="https://github.com/deadlock-api/deadlock-api/blob/master/website/src/lib/tracker/lane-matchup.ts">Neun-Minuten-Vergleich der Lanes</a> und die <a href="https://github.com/deadlock-api/deadlock-api/blob/master/website/src/lib/team-builder/lanes.ts">Spieler-Lane-IDs</a>. Die Auswertungsregeln dieses Artikels stehen oben und müssen nicht in jedem Detail denen des API-Trackers entsprechen.')
d.paragraph(f'<a href="{DATA_URL}first_objectives.csv">Guardian-/Walker-Tabellen als CSV</a>, <a href="{DATA_URL}souls_at_9m.csv">Soul-Lane-Tabellen als CSV</a> und <a href="{DATA_URL}cohort.json">Grundgesamtheit als JSON</a>. Die SQL-Abfragen: <a href="{DATA_URL}cohort.sql">Grundgesamtheit</a>, <a href="{DATA_URL}first_objectives.sql">erste Gebäude</a> und <a href="{DATA_URL}souls_at_9m.sql">Souls bei 9:00</a>. Die vollständigen JSON-Aggregate liegen unter <a href="{DATA_URL}first_objectives.json">first_objectives.json</a> und <a href="{DATA_URL}souls_at_9m.json">souls_at_9m.json</a>.')
d.paragraph(f'Zum Base-Guardian-Kapitel: <a href="{DATA_URL}base_first.csv">erste Verluste als CSV</a>, <a href="{DATA_URL}base_milestones.csv">Verluststufen als CSV</a> und <a href="{DATA_URL}base_counts.csv">Momentaufnahmen als CSV</a>. Die vollständigen JSON-Aggregate: <a href="{DATA_URL}base_first.json">base_first.json</a>, <a href="{DATA_URL}base_milestones.json">base_milestones.json</a>, <a href="{DATA_URL}base_counts.json">base_counts.json</a> und das Audit <a href="{DATA_URL}base_audit.json">base_audit.json</a>. Die SQL-Abfragen: <a href="{DATA_URL}base_audit.sql">Audit</a>, <a href="{DATA_URL}base_first.sql">erste Verluste</a>, <a href="{DATA_URL}base_milestones.sql">Verluststufen</a> und <a href="{DATA_URL}base_counts.sql">Momentaufnahmen</a>.')
d.paragraph('Dieser Text ergänzt den <a href="/blog/deadlock-objectives-2026/">Objectives-Report über Urne, Midboss und Shrines</a>. Er beantwortet die Guardian-Frage mit einer eigenen aktuellen Stichprobe, ohne die alten Objective-Quoten als neue Guardian-Ergebnisse auszugeben.')

lede = f'Du holst den ersten Guardian und verlierst trotzdem. Ein Blick auf {num(cohort["matches"])} Ranked-Matches zeigt: Das passiert oft, aber nicht öfter als der Sieg. Wie sich frühe und späte Guardians unterscheiden, was die Elo daran ändert und warum eine gewonnene Lane noch kein führendes Team ist.'
source_index = (SITE/'blog/index.html').read_text()
header = re.search(r'<header class="site-header">.*?</header>', source_index, re.S).group(0)
footer = re.search(r'<footer class="footer">.*?</footer>', source_index, re.S).group(0)
article_sections=[]
for i,s in enumerate(d.sections,1):
    article_sections.append(f'<section class="bl-section" id="{s["id"]}"><div class="container"><div class="bl-narrow"><p class="bl-eyebrow">Kapitel {i}</p><h2 class="bl-h2">{html.escape(s["title"])}</h2></div>'+''.join(s['html'])+'</div></section>')
md = '# '+TITLE+'\n\nStand: 23. September 2026, ergänzt um das Base-Guardian-Kapitel. Datenfenster: 16. bis 21. September 2026 (genaue UTC-Grenzen in der Methodik).\n\n'+lede+'\n\n'
md += '\n\n'.join('## '+s['title']+'\n\n'+'\n\n'.join(s['md']) for s in d.sections)+'\n'
(TASK/'FINDINGS.md').write_text(md)
word_count=len(re.findall(r'\S+', re.sub('<[^>]+>',' ', ''.join(article_sections))))
jsonld={
 '@context':'https://schema.org', '@type':['Article','BlogPosting'],
 'headline':TITLE,'description':DESC,'datePublished':PUBLISHED,'dateModified':MODIFIED,
 'inLanguage':'de-DE','url':URL,'mainEntityOfPage':URL,
 'image':'https://deutsche-deadlock-community.de/images/og-logo.png',
 'isAccessibleForFree':True,'articleSection':'Daten-Report','wordCount':word_count,
 'author':{'@type':'Organization','name':'Deutsche Deadlock Community','url':'https://deutsche-deadlock-community.de/'},
 'publisher':{'@type':'Organization','name':'Deutsche Deadlock Community','logo':{'@type':'ImageObject','url':'https://deutsche-deadlock-community.de/brand/logo/logo-192.png'}},
 'citation':['https://www.deadlock-api.com/data-dumps', 'https://github.com/deadlock-api/deadlock-api/blob/master/website/src/lib/tracker/objectives.ts']
}
tiles=''
for value,label,sub in [(pct(G),'Siege mit dem ersten Guardian',f'{num(G["n"])} auswertbare Matches'),(pct(LOSS),'Trotz erstem Guardian verloren','Ein Vorteil ist keine Vorentscheidung'),(pct(W),'Siege mit dem ersten Walker',f'{num(W["n"])} auswertbare Matches'),(pct(T),'Siege mit Team-Soul-Vorsprung','Mehr als 5 % Vorsprung bei 9:00'),(share(BF['defender_wins'],BF['matches']),'Verteidiger gewinnt trotz erstem Base-Verlust','Zusatzkapitel: Base Guardians')]:
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
<meta property="og:site_name" content="Deutsche Deadlock Community"><meta property="article:published_time" content="{PUBLISHED}"><meta property="article:modified_time" content="{MODIFIED}">
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
<p class="bl-stamp"><b>Stand: 23. September 2026</b> · Matchstarts 16. bis 21. September · Deadlock-API, Ranked</p>
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
for name in ('cohort','first_objectives','souls_at_9m','base_audit','base_first','base_milestones','base_counts'):
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
for name,rows,wf,nf in [('base_first',base_first,'attacker_wins','matches'),('base_milestones',base_miles,'attacker_wins','team_observations'),('base_counts',base_counts,'wins','team_observations')]:
    fields=list(rows[0])+['attacker_win_rate_percent','wilson_95_low_percent','wilson_95_high_percent']
    with (PUBLIC/f'{name}.csv').open('w',newline='') as f:
        writer=csv.DictWriter(f,fieldnames=fields,lineterminator='\n')
        writer.writeheader()
        for r in rows:
            lo,hi=interval({'wins':r[wf],'n':r[nf]})
            writer.writerow(dict(r,attacker_win_rate_percent=round(100*r[wf]/r[nf],6),wilson_95_low_percent=round(lo,6),wilson_95_high_percent=round(hi,6)))
(PUBLIC/'article.md').write_text(md)
manifest={'accessed':PUBLISHED,'base_accessed':MODIFIED,'source':'https://api.deadlock-api.com/v1/mcp','tool':'execute_query',
 'scope':'Contiguous match-ID window [106000000,107000000), not random sampling or complete calendar days.',
 'cohort':cohort,'base_audit':base_audit,
 'base_scope':'Base-guardian chapter uses stricter quality filters; its denominators are smaller than the 63,438 cohort.',
 'files':{f.name:hashlib.sha256(f.read_bytes()).hexdigest() for f in sorted(PUBLIC.iterdir()) if f.name!='manifest.json'}}
(PUBLIC/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')

# llms.txt and llms-full.txt are maintained from the same data as the article.
BATT=share(BF['attacker_wins'],BF['matches'])
BDEF=share(BF['defender_wins'],BF['matches'])
BM1=bmile(1)
LLMS_SUMMARY=(f'Auswertung von {num(cohort["matches"])} Ranked-Matches aus dem öffentlichen MCP-Server der Deadlock-API '
 f'(Tabelle match_player, nur lesende SQL), 16. bis 21. September 2026, mit Zusatzkapitel zu Base Guardians auf {num(BA["eligible_matches"])} geprüften Matches aus einem späteren Abruf desselben Match-ID-Fensters. '
 f'Kernbefund: Der frühe Gebäudevorteil ist ein Signal, keine Vorentscheidung. Das Team mit dem ersten Guardian gewinnt {pct(G)}, mit dem ersten Walker {pct(W)}; ein teamweiter Soul-Vorsprung bei 9:00 geht mit {pct(T)} Siegen einher. '
 f'Nach dem ersten Base-Guardian-Verlust (Median {clock(BM1["median_fallen_s"])}) gewinnt der Angreifer {BATT}, die verteidigende Seite noch {BDEF}. '
 'Alle Quoten sind beobachtete Grundraten ohne Kausalaussage und ohne Kontrolle für Teamstärke oder Spielverlauf; das Base-Kapitel nutzt strengere Qualitätsfilter und dadurch kleinere Nenner als die Erstauswertung. Der Text darf mit Quelle und Zeitraum zitiert werden.')
llms=SITE/'public/llms.txt'
llms_text=llms.read_text()
if SLUG not in llms_text:
    needle='## Blog\n\n'
    assert llms_text.count(needle)==1
    llms.write_text(llms_text.replace(needle,needle+f'- [{TITLE}]({URL}) (22. September 2026, ergänzt 23. September 2026)\n  {LLMS_SUMMARY}\n',1))
llmsf=SITE/'public/llms-full.txt'
llmsf_text=llmsf.read_text()
if SLUG not in llmsf_text:
    entry=f'- [{TITLE}]({URL}) (22. September 2026, ergänzt 23. September 2026)\n  {LLMS_SUMMARY}\n\n'
    needle='## Blog\n\n'
    assert llmsf_text.count(needle)==1
    llmsf_text=llmsf_text.replace(needle,needle+entry,1)
    kern_bullet=(f'- Grundgesamtheit: {num(cohort["matches"])} Ranked-Matches, Match-IDs [106000000, 107000000), 16. bis 21. September 2026; die Base-Guardian-Abfragen stammen aus einem späteren Abruf desselben Fensters und prüfen schärfer, deshalb sind ihre Nenner kleiner ({num(BA["eligible_matches"])} von {num(BA["candidate_matches"])} Kandidaten-Matches). '
 'Rang aus average_badge in drei Gruppen; fehlende Ränge werden nicht geschätzt. Alle Quoten sind Beobachtungen ohne Kausalaussage.\n'
 f'- Kapitel Lane: Das Team mit dem ersten gegnerischen Guardian gewinnt {pct(G)} ({num(G["n"])} auswertbare Matches), verliert also noch {pct(LOSS)}. Gemeint ist der erste Guardian der Karte, nicht die eigene Lane.\n'
 f'- Kapitel Elo: Der erste Guardian fällt in der hohen Gruppe im Median bei {clock(objective("Tier1Lane","high")["median_s"])} gegenüber {clock(objective("Tier1Lane","low")["median_s"])} in der niedrigen; die Siegquoten des Erst-Teams liegen bei {pct(objective("Tier1Lane","high"))}, {pct(objective("Tier1Lane","mid"))} und {pct(objective("Tier1Lane","low"))}. Zeitwerte sind Mediane, keine Siegversprechen.\n'
 f'- Kapitel Timing: Die Siegquote des Erst-Teams sinkt von {pct(objective("Tier1Lane",timing="00-05"))} vor Minute fünf auf {pct(objective("Tier1Lane",timing="11-15"))} zwischen elf und fünfzehn Minuten; die Zeitfenster sind Auswertungsgrenzen. Ein später Fall kann für einen ausgeglichenen Verlauf stehen, die Uhrzeit ist auch ein Merkmal des bisherigen Spiels.\n'
 f'- Kapitel Walker: Das Team mit dem ersten gegnerischen Walker gewinnt {pct(W)} aus {num(W["n"])} Fällen, ein stärkerer unbereinigter Zusammenhang als beim Guardian.\n'
 f'- Kapitel Souls: Ein teamweiter Soul-Vorsprung bei 9:00 geht mit {pct(T)} Siegen einher, der Vorsprung der ursprünglich zugewiesenen Lane bei {pct(soul("1"))}, {pct(soul("4"))} und {pct(soul("6"))}. Gemessen wird der Stand zugewiesener Spieler, nicht ununterbrochene Lane-Duelle.\n'
 f'- Kapitel Base Guardians: Nach dem ersten Base-Verlust (Median {clock(BM1["median_fallen_s"])}) gewinnt der Angreifer {BATT}, die Verteidiger noch {BDEF}; auf jeder Stufe sinkt die Verteidiger-Quote weiter. In {share(BF["ended_with_attacker_win_by_5m"], BF["matches"])} endet das Match schon in den folgenden fünf Minuten mit dem Angreifer-Sieg. Ob ein Eintrag einen einzelnen Gegner oder die Gruppe derselben Lane meint, ist ungeprüft, gezählt werden Einträge. Team-Sichten sind keine unabhängigen Match-Beobachtungen.\n'
 '- Kapitel Verlauf: Win lane, lose game passiert häufig, win lane, win game trotzdem häufiger. Die Soul-Entwicklungskurve nach dem Guardian bleibt ohne abgeschlossene Messung.\n'
 '- Methodik und Vorbehalte: Wilson-Intervalle ohne systematische Fehler; Abbrecher im Base-Kapitel enthalten und im Export zusätzlich ausgezählt; die Kapitel nutzen unterschiedliche Abrufstände desselben Fensters und werden nicht direkt verglichen.\n')
    kern='### Kernzahlen des Guardian-Folgeartikels, Kapitel für Kapitel\n\n'+kern_bullet
    needle2='### Kernzahlen des Objectives-Reports'
    assert llmsf_text.count(needle2)==1
    llmsf.write_text(llmsf_text.replace(needle2,kern+'\n'+needle2,1))

CARD_P='63.438 Ranked-Matches: Das Team mit dem ersten Guardian gewinnt 58,9 Prozent, mit dem ersten Walker 64,5. Frühe und späte Fallzeitpunkte, Elo-Gruppen, Lane-Souls und das Zusatzkapitel zu Base Guardians, mit Fallzahlen, Unsicherheit und offenen Anschlussfragen.'
CARD_OLD_P='63.438 Ranked-Matches: Das Team mit dem ersten Guardian gewinnt 58,9 Prozent, mit dem ersten Walker 64,5. Frühe und späte Fallzeitpunkte, Elo-Gruppen und Lane-Souls im Vergleich, mit Fallzahlen, Unsicherheit und offenen Anschlussfragen.'
card=f'''            <a class="bl-card" href="/blog/{SLUG}/">
              <p class="bl-card-meta">22. September 2026 · Daten-Report</p>
              <h2>{html.escape(TITLE)}</h2>
              <p>{CARD_P}</p>
            </a>
'''
if CARD_OLD_P in source_index:
    source_index=source_index.replace(CARD_OLD_P,CARD_P,1)
    (SITE/'blog/index.html').write_text(source_index)
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
    sitemap.write_text(sitemap_text.replace('</urlset>',f'  <url><loc>{URL}</loc><lastmod>{PUBLISHED}</lastmod></url>\n</urlset>'))
elif f'<loc>{URL}</loc><lastmod>{PUBLISHED}</lastmod>' in sitemap_text:
    sitemap.write_text(sitemap_text.replace(f'<loc>{URL}</loc><lastmod>{PUBLISHED}</lastmod>',f'<loc>{URL}</loc><lastmod>{MODIFIED}</lastmod>',1))
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
assert page.count('<h1>')==1 and page.count('<table>')==8
assert 'data-fill' not in page
assert '\u2014' not in md
json.loads(re.search(r'<script type="application/ld\+json">(.*?)</script>',page,re.S).group(1))
print(json.dumps({'status':'PASS','word_count':word_count,'guardian':pct(G),'guardian_losses':pct(LOSS),'walker':pct(W),'team_souls':pct(T),'tables':4,'article':str(POST/'index.html')},ensure_ascii=False))
