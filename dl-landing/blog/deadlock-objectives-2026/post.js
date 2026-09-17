import {
  STAND, META, RAENGE, MIDBOSS, URNE, SHRINE, REIHENFOLGE, KONTROLLE,
} from './data.js';

import {
  GOLD, fmt, fmt1, datumLang,
  buildTable, wireTableToggles, countUp, createCharts,
} from '../../src/charts.js';

const { renderLine, renderBars, renderHBars } = createCharts({ prefix: 'bl' });

wireTableToggles('bl');

const q = (sel) => document.querySelector(sel);
const nf2 = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (n) => `${fmt1(n)} %`;

/* Zeiten kommen als Rohsekunden aus data.js; die Umrechnung in Minuten
   passiert nur hier. minuten() liefert den Zahlenwert fuer die Achsen,
   mmss() die Tabellen- und Tooltip-Form, minRund() die gerundete Textform. */
const minuten = (sek) => sek / 60;
const mmss = (sek) => {
  const m = Math.floor(sek / 60);
  const s = Math.round(sek - m * 60);
  return `${m}:${String(s).padStart(2, '0')}`;
};
const minRund = (sek) => String(Math.round(sek / 60));

const nameOf = (stufe) => RAENGE.find((r) => r.stufe === stufe).name;
const kurzOf = (stufe) => RAENGE.find((r) => r.stufe === stufe).kurz;

/* ── Midboss: erster Rejuvenator nach Rang ────────────────────── */
renderLine(q('[data-chart="midboss-zeit"]'), MIDBOSS.stufen.map((s) => ({
  key: nameOf(s.stufe),
  label: kurzOf(s.stufe),
  value: minuten(s.erster_claim_sekunden),
  tip: [['Erster Rejuvenator', `${mmss(s.erster_claim_sekunden)} min`], ['Siegquote erster Claim', pct(s.siegquote_erster_claim)]],
})), { height: 250, padT: 26, targetTicks: 6, ariaLabel: 'Minuten bis zum ersten Rejuvenator je Rangstufe, vom Initiate bis zu Ascendant und Eternus' });

buildTable('midboss',
  ['Rang', 'Erster Rejuvenator (min:s)', 'Siegquote erster Claim', 'Steals je Match', 'Siegquote nach Steal'],
  MIDBOSS.stufen.map((s) => [
    nameOf(s.stufe), mmss(s.erster_claim_sekunden), pct(s.siegquote_erster_claim),
    nf2.format(s.steals_je_match), pct(s.siegquote_nach_steal),
  ]));

/* ── Urne: Siegquote nach mehr Abgaben, nach Rang ─────────────── */
renderLine(q('[data-chart="urne-mehr"]'), URNE.stufen.map((s) => ({
  key: nameOf(s.stufe),
  label: kurzOf(s.stufe),
  value: s.siegquote_mehr_abgaben,
  tip: [['Mehr Urnen-Abgaben', pct(s.siegquote_mehr_abgaben)], ['Erste Abgabe', pct(s.siegquote_erste_abgabe)]],
})), { height: 250, padT: 26, ariaLabel: 'Siegquote des Teams mit mehr Urnen-Abgaben je Rangstufe' });

buildTable('urne',
  ['Rang', 'Siegquote erste Abgabe', 'Siegquote mehr Abgaben'],
  URNE.stufen.map((s) => [nameOf(s.stufe), pct(s.siegquote_erste_abgabe), pct(s.siegquote_mehr_abgaben)]));

/* ── Shrine: Fenster vom ersten Fall bis Matchende ────────────── */
renderBars(q('[data-chart="shrine-luecke"]'), SHRINE.stufen.map((s) => ({
  key: nameOf(s.stufe),
  label: kurzOf(s.stufe),
  value: minuten(s.luecke_bis_ende_sekunden),
  tip: [['Bis Matchende', `${mmss(s.luecke_bis_ende_sekunden)} min`], ['Erster Shrine-Fall', `${mmss(s.erster_fall_sekunden)} min`]],
})), { height: 230, valueOnMax: false, targetTicks: 2, ariaLabel: 'Minuten vom ersten Shrine-Fall bis zum Matchende je Rangstufe' });

buildTable('shrine',
  ['Rang', 'Erster Shrine-Fall (min:s)', 'Siegquote Zerstörer', 'Bis Matchende (min:s)'],
  SHRINE.stufen.map((s) => [
    nameOf(s.stufe), mmss(s.erster_fall_sekunden), pct(s.siegquote_erster_zerstoerer), mmss(s.luecke_bis_ende_sekunden),
  ]));

/* ── Reihenfolge: wie viele der drei Erst-Objectives der Sieger holt ─ */
renderHBars(q('[data-chart="reihenfolge"]'), REIHENFOLGE.aggregat.verteilung.map((v) => ({
  name: `${v.anzahl} von 3`,
  value: v.prozent,
  display: pct(v.prozent),
  color: GOLD,
})), { maxValue: 100 });

buildTable('reihenfolge',
  ['Erst-Objectives beim Sieger', 'Anteil der Matches'],
  REIHENFOLGE.aggregat.verteilung.map((v) => [`${v.anzahl} von 3`, pct(v.prozent)]));

/* ── Kontrolle: Siegquote je Soul-Lage zum Ereigniszeitpunkt ──── */
const C_GLEICH = 'rgba(200,168,107,0.6)';
const C_HINTEN = 'rgba(200,168,107,0.32)';
const kontrolleRows = [];
['midboss', 'shrine', 'urne'].forEach((key) => {
  const e = KONTROLLE[key];
  kontrolleRows.push(
    { name: `${e.label} · vorn`, sub: `Soul-Vorsprung, n = ${fmt(e.vorn.n)}`, value: e.vorn.siegquote, display: pct(e.vorn.siegquote), color: GOLD },
    { name: `${e.label} · gleichauf`, sub: `n = ${fmt(e.gleich.n)}`, value: e.gleich.siegquote, display: pct(e.gleich.siegquote), color: C_GLEICH },
    { name: `${e.label} · hinten`, sub: `Soul-Rückstand, n = ${fmt(e.hinten.n)}`, value: e.hinten.siegquote, display: pct(e.hinten.siegquote), color: C_HINTEN },
  );
});
renderHBars(q('[data-chart="kontrolle"]'), kontrolleRows, { maxValue: 100 });

buildTable('kontrolle',
  ['Ereignis', 'Soul-Lage', 'Siegquote', 'Ereignisfälle'],
  [['midboss', 'Erster Rejuvenator'], ['shrine', 'Erster Shrine-Fall'], ['urne', 'Erste Urnen-Abgabe']].flatMap(([key, lbl]) => {
    const e = KONTROLLE[key];
    return [
      [lbl, 'vorn (Soul-Vorsprung)', pct(e.vorn.siegquote), fmt(e.vorn.n)],
      [lbl, 'gleichauf', pct(e.gleich.siegquote), fmt(e.gleich.n)],
      [lbl, 'hinten (Soul-Rückstand)', pct(e.hinten.siegquote), fmt(e.hinten.n)],
    ];
  }));

/* ── Zahlen im Text ───────────────────────────────────────────── */
const mb = MIDBOSS.aggregat;
const ur = URNE.aggregat;
const sh = SHRINE.aggregat;
const rf = REIHENFOLGE.aggregat;
const fills = {
  stand: datumLang(STAND),
  matches: fmt(META.matches),

  'mb-mit': pct(mb.mit_midboss_prozent),
  'mb-claim-min': minRund(mb.erster_claim_sekunden),
  'mb-siegquote': pct(mb.siegquote_erster_claim),
  'mb-steals': nf2.format(mb.steals_je_match),
  'mb-steal-win': pct(mb.siegquote_nach_steal),
  'mb-abandon': pct(mb.abandon_prozent),
  'mb-zeit-hoch': minRund(MIDBOSS.stufen[0].erster_claim_sekunden),
  'mb-zeit-tief': minRund(MIDBOSS.stufen[9].erster_claim_sekunden),
  'mb-win-hoch': pct(MIDBOSS.stufen[0].siegquote_erster_claim),
  'mb-win-tief': pct(MIDBOSS.stufen[9].siegquote_erster_claim),

  'urn-mit': pct(ur.mit_abgabe_prozent),
  'urn-abgaben': nf2.format(ur.abgaben_je_team_je_match),
  'urn-erste-win': pct(ur.siegquote_erste_abgabe),
  'urn-mehr-win': pct(ur.siegquote_mehr_abgaben),
  'urn-zeit': minRund(ur.erste_abgabe_sekunden),
  'urn-mehr-hoch': pct(URNE.stufen[0].siegquote_mehr_abgaben),
  'urn-mehr-tief': pct(URNE.stufen[9].siegquote_mehr_abgaben),

  'shr-win': pct(sh.siegquote_erster_zerstoerer),
  'shr-luecke': minRund(sh.luecke_bis_ende_sekunden),
  'shr-erster': minRund(sh.erster_fall_sekunden),
  'shr-verlierer': pct(sh.verlierer_besitz_prozent),

  'reihen-anteil': pct(rf.anteil_alle_drei_prozent),
  'reihen-urnezuerst': pct(rf.urne_zuerst_prozent),
  'reihen-mehrheit': pct(rf.siegquote_mehrheit),
  'reihen-3': pct(rf.verteilung[0].prozent),
  'reihen-2': pct(rf.verteilung[1].prozent),
  'reihen-0': pct(rf.verteilung[3].prozent),
  'reihen-mehrheit-hoch': pct(REIHENFOLGE.stufen[1].siegquote_mehrheit),
  'reihen-mehrheit-tief': pct(REIHENFOLGE.stufen[9].siegquote_mehrheit),

  'k6-mb-vorn': pct(KONTROLLE.midboss.vorn.siegquote),
  'k6-mb-gleich': pct(KONTROLLE.midboss.gleich.siegquote),
  'k6-mb-hinten': pct(KONTROLLE.midboss.hinten.siegquote),
  'k6-shr-hinten': pct(KONTROLLE.shrine.hinten.siegquote),
  'k6-urn-vorn': pct(KONTROLLE.urne.vorn.siegquote),
  'k6-urn-hinten': pct(KONTROLLE.urne.hinten.siegquote),
};

Object.entries(fills).forEach(([key, value]) => {
  const el = q(`[data-fill="${key}"]`);
  if (el) el.textContent = value;
});

const counts = {
  't-hinten': KONTROLLE.midboss.hinten.siegquote,
  't-vorn': KONTROLLE.midboss.vorn.siegquote,
  't-claim': MIDBOSS.aggregat.siegquote_erster_claim,
  't-steal': MIDBOSS.aggregat.siegquote_nach_steal,
};
document.querySelectorAll('[data-fill-count]').forEach((el) => {
  const value = counts[el.dataset.fillCount];
  if (value === undefined) return;
  el.dataset.count = String(value);
  el.dataset.decimals = '1';
  el.textContent = fmt1(value);
});

countUp();
