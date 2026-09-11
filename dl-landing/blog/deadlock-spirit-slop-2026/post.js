import {
  STAND, META, SPIELER, SPIELER_2026, SPIELER_STAND,
  PRESSURE, TIMELINE, PATCHDETAIL,
} from './data.js';

import {
  GOLD, TEAL, fmt, MONATE_KURZ, MONATE_LANG,
  datumLang,
  buildTable, wireTableToggles, countUp,
  createCharts,
} from '../../src/charts.js';

const { renderLine, renderHBars } = createCharts({ prefix: 'bl' });

wireTableToggles('bl');

const q = (sel) => document.querySelector(sel);
const nf1 = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const signed = (n) => (n > 0 ? '+' : n < 0 ? '−' : '±') + nf1.format(Math.abs(n));
const monatKurz = (key) => MONATE_KURZ[Number(key.split('-')[1]) - 1];
const monatLang = (key) => {
  const [y, m] = key.split('-');
  return `${MONATE_LANG[Number(m) - 1]} ${y}`;
};

/* ── Spielerzahlen 2025 ───────────────────────────────────────── */
renderLine(q('[data-chart="spieler"]'), SPIELER.map((r) => ({
  key: monatLang(r.monat),
  label: monatKurz(r.monat),
  value: r.wert,
  tip: [['Gleichzeitige Spieler (Schnitt)', fmt(r.wert)]],
})), { height: 250, padT: 26, ariaLabel: 'Durchschnittliche gleichzeitige Deadlock-Spieler je Monat, Maerz bis September 2025' });

buildTable('spieler',
  ['Monat', 'Gleichzeitige Spieler (Schnitt)'],
  [...SPIELER, ...SPIELER_2026].map((r) => [monatLang(r.monat), fmt(r.wert)]));

/* ── Meta-Pressure-Index ──────────────────────────────────────── */
const pressureMax = Math.max(...PRESSURE.map((p) => Math.abs(p.index)));
renderHBars(q('[data-chart="pressure"]'), PRESSURE.map((p) => ({
  name: datumLang(p.datum),
  sub: p.effekt,
  value: Math.abs(p.index),
  display: signed(p.index),
  color: p.index >= 0 ? GOLD : TEAL,
})), { maxValue: pressureMax });

buildTable('pressure',
  ['Patch', 'Index', 'Kerneffekt'],
  PRESSURE.map((p) => [datumLang(p.datum), signed(p.index), p.effekt]));

/* ── Zeitleiste ───────────────────────────────────────────────── */
buildTable('timeline',
  ['Zeitraum', 'Population / Meta', 'Bewertung'],
  TIMELINE.map((t) => [t.zeit, t.lage, t.urteil]));

/* ── Patchdetails ─────────────────────────────────────────────── */
const detailRows = (rows) => rows.map((r) => [r.was, r.von || '–', r.auf]);
buildTable('juni17', ['Was', 'Vorher', 'Nachher'], detailRows(PATCHDETAIL.juni17));
buildTable('juli04', ['Was', 'Vorher', 'Nachher'], detailRows(PATCHDETAIL.juli04));
buildTable('juli29', ['Was', 'Vorher', 'Nachher'], detailRows(PATCHDETAIL.juli29));

/* ── Zahlen im Text ───────────────────────────────────────────── */
const fills = {
  stand: datumLang(STAND),
  'april-wert': fmt(SPIELER_STAND.april_wert),
  'juli-wert': fmt(SPIELER_STAND.tiefpunkt_wert),
  'maerz-2025': fmt(SPIELER[0].wert),
  'mai-2025': fmt(SPIELER[2].wert),
  'aug-2025': fmt(SPIELER[5].wert),
  'sep-2025': fmt(SPIELER[6].wert),
  'jan-2026': fmt(SPIELER_2026[0].wert),
  'feb-2026': fmt(SPIELER_STAND.hoch_wert),
  'aug-2026': fmt(SPIELER_2026[3].wert),
  'heute-ca': fmt(SPIELER_STAND.recherchetag_ca),
  'kipp-datum': datumLang(META.kipp_datum),
};

Object.entries(fills).forEach(([key, value]) => {
  const el = q(`[data-fill="${key}"]`);
  if (el) el.textContent = value;
});

const counts = {
  't-april': SPIELER_STAND.april_wert,
  't-juli': SPIELER_STAND.tiefpunkt_wert,
  't-feb': SPIELER_STAND.hoch_wert,
};
document.querySelectorAll('[data-fill-count]').forEach((el) => {
  const value = counts[el.dataset.fillCount];
  if (value === undefined) return;
  el.dataset.count = String(value);
  el.textContent = fmt(Math.round(value));
});

countUp();
