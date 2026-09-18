import {
  STAND, META, RAENGE, MIDBOSS, URNE, SHRINE, REIHENFOLGE, KONTROLLE, KAPITEL7, KAPITEL8,
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
const fak = (n) => `${fmt1(n)}-fach`;

const nameOf = (stufe) => RAENGE.find((r) => r.stufe === stufe).name;
const kurzOf = (stufe) => RAENGE.find((r) => r.stufe === stufe).kurz;

/* ── Midboss: erster Rejuvenator nach Rang ────────────────────── */
renderLine(q('[data-chart="midboss-zeit"]'), MIDBOSS.stufen.map((s) => ({
  key: nameOf(s.stufe),
  label: kurzOf(s.stufe),
  value: minuten(s.erster_claim_sekunden),
  tip: [['Erster Rejuvenator', `${mmss(s.erster_claim_sekunden)}`], ['Siegquote erster Claim', pct(s.siegquote_erster_claim)]],
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
  tip: [['Bis Matchende', `${mmss(s.luecke_bis_ende_sekunden)}`], ['Erster Shrine-Fall', `${mmss(s.erster_fall_sekunden)}`]],
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
})), { maxValue: 100, ariaLabel: 'Wie viele der drei Erst-Objectives der Sieger holt' });

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
    { name: `${e.label} · vorn`, sub: `Soul-Vorsprung, ${fmt(e.vorn.n)} Matches`, value: e.vorn.siegquote, display: pct(e.vorn.siegquote), color: GOLD },
    { name: `${e.label} · gleichauf`, sub: `${fmt(e.gleich.n)} Matches`, value: e.gleich.siegquote, display: pct(e.gleich.siegquote), color: C_GLEICH },
    { name: `${e.label} · hinten`, sub: `Soul-Rückstand, ${fmt(e.hinten.n)} Matches`, value: e.hinten.siegquote, display: pct(e.hinten.siegquote), color: C_HINTEN },
  );
});
renderHBars(q('[data-chart="kontrolle"]'), kontrolleRows, { maxValue: 100, ariaLabel: 'Siegquote je Objective, getrennt nach Soul-Lage' });

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

/* ── Kapitel 8: Siegquote nach Zeitpunkt des Objectives ───────── */
[['midboss', 'k7-midboss', 'Erster Rejuvenator: Siegquote je Zeitklasse'],
 ['shrine', 'k7-shrine', 'Erster Shrine-Fall: Siegquote je Zeitklasse'],
 ['urne', 'k7-urne', 'Erste Urnen-Abgabe: Siegquote je Zeitklasse']].forEach(([key, host, label]) => {
  const ev = KAPITEL7[key];
  renderHBars(q(`[data-chart="${host}"]`), ev.klassen.map((k) => ({
    name: k.label,
    value: k.gesamt,
    display: pct(k.gesamt),
    color: GOLD,
  })), { maxValue: 100, ariaLabel: label });
});

const rangHead = (mitSteal) => mitSteal
  ? ['Zeitklasse', 'Niedrig', 'Mittel', 'Hoch', 'Gesamt', 'Steal-Anteil']
  : ['Zeitklasse', 'Niedrig', 'Mittel', 'Hoch', 'Gesamt'];
[['midboss', 'k7-mb', true], ['shrine', 'k7-sh', false], ['urne', 'k7-ur', false]].forEach(([key, id, mitSteal]) => {
  const ev = KAPITEL7[key];
  buildTable(`${id}-rang`, rangHead(mitSteal), ev.klassen.map((k) => {
    const row = [k.label, pct(k.niedrig), pct(k.mittel), pct(k.hoch), pct(k.gesamt)];
    if (mitSteal) row.push(pct(k.steal_anteil));
    return row;
  }));
  buildTable(`${id}-sch`,
    ['Zeitklasse', 'Soul-Vorsprung', 'gleichauf', 'Soul-Rückstand'],
    ev.klassen.map((k) => [k.label, pct(k.sch.vorn), pct(k.sch.gleich), pct(k.sch.hinten)]));
});

/* ── Kapitel 9: Der Urnen-Läufer ──────────────────────────────── */
renderHBars(q('[data-chart="k8-helden"]'), KAPITEL8.helden_hoch.map((h) => ({
  name: h.name,
  value: h.faktor,
  display: fak(h.faktor),
  color: GOLD,
})), { maxValue: KAPITEL8.helden_hoch[0].faktor, ariaLabel: 'Am stärksten überrepräsentierte Läufer-Helden auf hohen Rängen' });

buildTable('k8-helden',
  ['Held', 'Überrepräsentation unter Läufern'],
  KAPITEL8.helden_hoch.map((h) => [h.name, fak(h.faktor)]));

buildTable('k8-laeufer',
  ['Ranggruppe', 'Läufer erkennbar', 'Läufer-Siegquote', 'Über Kollegen-Median', 'Median-Vorsprung (Seelen)', 'Rang 1 oder 2 im Team'],
  KAPITEL8.ranggruppen.map((r) => [
    r.label, pct(r.bekannt), pct(r.siegquote), pct(r.ueber_median), fmt(r.median_vorsprung), pct(r.rang12),
  ]));

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

  'k7-mb-frueh': pct(KAPITEL7.midboss.klassen[0].gesamt),
  'k7-mb-spaet': pct(KAPITEL7.midboss.klassen[4].gesamt),
  'k7-mb-vorn-frueh': pct(KAPITEL7.midboss.klassen[0].sch.vorn),
  'k7-mb-vorn-spaet': pct(KAPITEL7.midboss.klassen[3].sch.vorn),
  'k7-mb-hinten-frueh': pct(KAPITEL7.midboss.klassen[0].sch.hinten),
  'k7-mb-hinten-spaet': pct(KAPITEL7.midboss.klassen[3].sch.hinten),
  'k7-mb-med-niedrig': minRund(KAPITEL7.midboss.median_niedrig_s),
  'k7-mb-med-hoch': minRund(KAPITEL7.midboss.median_hoch_s),
  'k7-steal-frueh': pct(KAPITEL7.midboss.klassen[0].steal_anteil),
  'k7-steal-spaet': pct(KAPITEL7.midboss.klassen[4].steal_anteil),

  'k7-sh-frueh': pct(KAPITEL7.shrine.klassen[0].gesamt),
  'k7-sh-spaet': pct(KAPITEL7.shrine.klassen[7].gesamt),
  'k7-sh-med-niedrig': minRund(KAPITEL7.shrine.median_niedrig_s),
  'k7-sh-med-hoch': minRund(KAPITEL7.shrine.median_hoch_s),

  'k7-ur-frueh': pct(KAPITEL7.urne.klassen[0].gesamt),
  'k7-ur-spaet': pct(KAPITEL7.urne.klassen[3].gesamt),
  'k7-ur-hinten-frueh': pct(KAPITEL7.urne.klassen[0].sch.hinten),
  'k7-ur-hinten-spaet': pct(KAPITEL7.urne.klassen[3].sch.hinten),
  'k7-ur-med': minRund(KAPITEL7.urne.median_niedrig_s),

  'k8-abgaben': fmt(KAPITEL8.abgaben_gesamt),
  'k8-bekannt': pct(KAPITEL8.bekannt_gesamt_prozent),
  'k8-sq-niedrig': pct(KAPITEL8.ranggruppen[0].siegquote),
  'k8-sq-hoch': pct(KAPITEL8.ranggruppen[2].siegquote),
  'k8-ueber': String(KAPITEL8.ueber_median_rund),
  'k8-vorsprung-niedrig': fmt(KAPITEL8.ranggruppen[0].median_vorsprung),
  'k8-vorsprung-hoch': fmt(KAPITEL8.ranggruppen[2].median_vorsprung),
  'k8-rang12-hi': pct(KAPITEL8.ranggruppen[0].rang12),
  'k8-rang12-lo': pct(KAPITEL8.ranggruppen[1].rang12),
  'k8-rang56-hi': pct(KAPITEL8.ranggruppen[0].rang56),
  'k8-rang56-lo': pct(KAPITEL8.ranggruppen[2].rang56),
  'k8-tode-niedrig': fmt1(KAPITEL8.ranggruppen[0].tode_abgabe),
  'k8-tode-hoch': fmt1(KAPITEL8.ranggruppen[2].tode_abgabe),
  'k8-swing-hoch': fmt(KAPITEL8.ranggruppen[2].swing_median),
  'k8-swing-niedrig': fmt(KAPITEL8.ranggruppen[0].swing_median),
  'k8-swing-sonst-lo': fmt(KAPITEL8.ranggruppen[1].swing_sonst),
  'k8-swing-sonst-hi': fmt(KAPITEL8.ranggruppen[2].swing_sonst),
  'k8-calico-niedrig': fak(KAPITEL8.calico_faktor.niedrig),
  'k8-calico-mittel': fak(KAPITEL8.calico_faktor.mittel),
  'k8-calico-hoch': fak(KAPITEL8.calico_faktor.hoch),
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
