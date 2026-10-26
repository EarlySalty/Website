import {
  ANKUNFT, ANLAUF, DAUER, LIVETAGE, ERSTBESUCH, STILL, ANTWORT, RAID, ENDE, FOLLOW,
  NULL, STARTZEIT, TITEL,
} from './data.js';

import { FILL, n0, d1, d2, p1, s1, s2 } from './fill.js';

import {
  GOLD, TEAL, buildTable, wireTableToggles, countUp, createCharts,
} from '../../src/charts.js';

const { renderBars, renderGroupedBars, renderHBars } = createCharts({ prefix: 'bl' });

const q = (sel) => document.querySelector(sel);

document.querySelectorAll('[data-fill]').forEach((el) => {
  const value = FILL[el.dataset.fill];
  if (value !== undefined) el.textContent = value;
});

wireTableToggles('bl');
countUp();

renderGroupedBars(q('[data-chart="ankunft"]'), ANKUNFT.zeilen.map((z) => ({
  key: z.label,
  label: z.label,
  a: z.stamm,
  b: z.neu,
  tip: [['schon einmal da', d1(z.stamm), GOLD], ['zum ersten Mal da', d1(z.neu), TEAL], ['Anteil Bekannte', p1(z.stammAnteil)]],
})), {
  height: 250,
  nameA: 'schon einmal im Kanal',
  nameB: 'zum ersten Mal im Kanal',
  ariaLabel: 'Ankünfte je 100 Streamminuten nach Streamphase, bekannte und neue Zuschauer',
});

buildTable('ankunft',
  ['Streamphase', 'schon einmal da', 'zum ersten Mal da', 'Anteil Bekannte'],
  ANKUNFT.zeilen.map((z) => [z.label, d1(z.stamm), d1(z.neu), p1(z.stammAnteil)]));

renderBars(q('[data-chart="anlauf"]'), ANLAUF.zeilen.map((z) => ({
  key: z.key,
  label: z.key,
  value: z.anteil,
  tip: [['Anteil am üblichen Wert', p1(z.anteil)], ['Streams', n0(z.sessions)]],
})), { height: 230, ariaLabel: 'Zuschauer in Prozent des üblichen Werts zu Beginn, nach 5, 15 und 30 Minuten' });

buildTable('anlauf',
  ['Zeitpunkt', 'Anteil am üblichen Wert', 'Streams'],
  ANLAUF.zeilen.map((z) => [z.key, p1(z.anteil), n0(z.sessions)]));

renderBars(q('[data-chart="dauer"]'), DAUER.zeilen.map((z) => ({
  key: z.key,
  label: z.key,
  value: z.index,
  tip: [['Index', d1(z.index)], ['Intervall', `${d1(z.von)} bis ${d1(z.bis)}`], ['Streams', n0(z.sessions)]],
})), { height: 230, ariaLabel: 'Zuschauer nach Streamlänge bei Start zwischen 19 und 20 Uhr, 100 ist der Durchschnitt des Kanals' });

buildTable('dauer',
  ['Streamlänge', 'Index (100 = eigener Schnitt)', '95-%-Intervall', 'Streams'],
  DAUER.zeilen.map((z) => [z.key, d1(z.index), `${d1(z.von)} bis ${d1(z.bis)}`, n0(z.sessions)]));

renderGroupedBars(q('[data-chart="tage-anteil"]'), LIVETAGE.stufen.map((s) => ({
  key: s.key,
  label: s.key,
  a: s.de.anteil,
  b: s.alle.anteil,
  tip: [['deutsche Kanäle', p1(s.de.anteil), GOLD], ['alle Sprachen', p1(s.alle.anteil), TEAL]],
})), {
  height: 240,
  nameA: 'deutsche Kanäle',
  nameB: 'alle Sprachen',
  ariaLabel: 'Anteil der Neuen nach weiteren Live-Tagen des Kanals in den sieben Tagen danach, deutsche Kanäle und alle Sprachen',
});

buildTable('tage-anteil',
  ['Weitere Live-Tage', 'deutsch: Neue', 'deutsch: Anteil', 'alle: Neue', 'alle: Anteil'],
  LIVETAGE.stufen.map((s) => [s.key, n0(s.de.n), p1(s.de.anteil), n0(s.alle.n), p1(s.alle.anteil)]));

renderGroupedBars(q('[data-chart="tage-rueckkehr"]'), LIVETAGE.stufen.map((s) => ({
  key: s.key,
  label: s.key,
  a: s.de.ret7,
  b: s.alle.ret7,
  tip: [['deutsche Kanäle', p1(s.de.ret7), GOLD], ['alle Sprachen', p1(s.alle.ret7), TEAL]],
})), {
  height: 240,
  nameA: 'deutsche Kanäle',
  nameB: 'alle Sprachen',
  ariaLabel: 'Rückkehr innerhalb von sieben Tagen nach weiteren Live-Tagen des Kanals, deutsche Kanäle und alle Sprachen',
});

buildTable('tage-rueckkehr',
  ['Weitere Live-Tage', 'deutsch: Rückkehr', 'alle: Rückkehr'],
  LIVETAGE.stufen.map((s) => [s.key, p1(s.de.ret7), p1(s.alle.ret7)]));

renderBars(q('[data-chart="erstbesuch"]'), ERSTBESUCH.zeilen.map((z) => ({
  key: z.label,
  label: z.label,
  value: z.zurueck,
  tip: [['kommen wieder', p1(z.zurueck)], ['Neue', n0(z.n)]],
})), { height: 230, ariaLabel: 'Rückkehr innerhalb von 30 Tagen nach Zahl der Nachrichten im ersten Stream' });

buildTable('erstbesuch',
  ['Erster Stream', 'Neue', 'kommen innerhalb von 30 Tagen wieder'],
  ERSTBESUCH.zeilen.map((z) => [z.label, n0(z.n), p1(z.zurueck)]));

renderHBars(q('[data-chart="still"]'), STILL.map((s) => ({
  name: s.label,
  sub: `${d2(s.chatterJeZuschauer)} Chatter je Zuschauer`,
  value: s.anteil,
  display: `${n0(s.anteil)} %`,
  color: GOLD,
})), { maxValue: 100, ariaLabel: 'Anteil stiller Zuschauer nach Kanalgröße' });

buildTable('still',
  ['Kanalgröße (Durchschnitt)', 'stiller Anteil', 'Chatter je Zuschauer'],
  STILL.map((s) => [s.label, `${n0(s.anteil)} %`, d2(s.chatterJeZuschauer)]));

buildTable('antwort',
  ['Frage', 'Unterschied', '95-%-Intervall', 'Einordnung'],
  ANTWORT.zeilen.map((z) => [z.frage, z.ergebnis, z.intervall, z.urteil]));

renderHBars(q('[data-chart="raid-follow"]'), RAID.follows.map((f) => ({
  name: f.label,
  sub: `${n0(f.follows)} Follows`,
  value: f.wert,
  display: d1(f.wert),
  color: GOLD,
})), { ariaLabel: 'Follows je 100 Zuschauerstunden nach einem Raid und in der restlichen Sendezeit' });

buildTable('raid-follow',
  ['Zeitraum', 'Follows je 100 Zuschauerstunden', 'Follows'],
  RAID.follows.map((f) => [f.label, d1(f.wert), n0(f.follows)]));

buildTable('raid-bleiben',
  ['Ziel des Raids', 'Raids', 'nach 15 Min.', 'nach 30 Min.', 'nach 60 Min.'],
  RAID.proRaider.map((r) => [r.key, n0(r.raids), s2(r.m15), s2(r.m30), s2(r.m60)]));

buildTable('ende',
  ['Vergleich', 'Paare', 'nächster Start', '95-%-Intervall'],
  ENDE.zeilen.map((z) => [z.label, n0(z.paare), `${s1(z.wert)} %`, `${s1(z.von)} bis ${s1(z.bis)}`]));

renderBars(q('[data-chart="follow-zeit"]'), FOLLOW.zeilen.map((z) => ({
  key: `Minute ${z.key}`,
  label: z.key,
  value: z.wert,
  tip: [['Follows je 100 Zuschauerstunden', d1(z.wert)], ['Follows', n0(z.n)]],
})), { height: 240, ariaLabel: 'Follows je 100 Zuschauerstunden nach Streamminute' });

buildTable('follow-zeit',
  ['Streamminute', 'Follows je 100 Zuschauerstunden', 'Follows'],
  FOLLOW.zeilen.map((z) => [z.key, d1(z.wert), n0(z.n)]));

buildTable('titel',
  ['Merkmal', 'alle Streams', 'gegen eigene Streams aus 14 Tagen', 'Kanäle im Abgleich'],
  TITEL.zeilen.map((z) => [z.merkmal, `${s1(z.roh)} %`, `${s1(z.abgleich)} %`, n0(z.kanaele)]));

renderBars(q('[data-chart="startzeit"]'), STARTZEIT.map((z) => ({
  key: z.key,
  label: z.key,
  value: z.index,
  tip: [['Index', d1(z.index)], ['Streams', n0(z.sessions)]],
})), { height: 230, valueOnMax: false, ariaLabel: 'Zuschauer nach Startzeit für Kanäle mit bis zu vier Zuschauern, 100 ist der Durchschnitt des Kanals' });

buildTable('startzeit',
  ['Start', 'Index (100 = eigener Schnitt)', 'Streams'],
  STARTZEIT.map((z) => [z.key, d1(z.index), n0(z.sessions)]));

buildTable('nichts',
  ['Idee', 'Ergebnis'],
  NULL.map((z) => [z.idee, z.ergebnis]));
