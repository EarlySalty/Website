import {
  STAND, META, MONATE,
  VERFREMDUNG, VERFREMDUNG_FORMEN, VERFREMDUNG_GESAMT,
  MARKEN, RU_DOMAINS,
  SCAM_MONATE, SCAM_KATEGORIEN, SCAM_PITCH, SCAM_DISCORD, SCAM_AKTIONEN,
  KONTOALTER, GELOESCHT, NAMENSMUSTER, VERHALTEN,
  BANRATE, REAKTIONSZEIT, PFADE, FEHLALARME, GLOBAL_BANLISTE,
  METHODIK,
  CHAT_GESAMT, BEISPIELE, ZIELE, REAKTION_DETAIL, TIMELINE,
} from './data.js';

import {
  GOLD, TEAL, fmt, fmt1, escapeHtml,
  monatKurz, monatLang, datumLang,
  buildTable, wireTableToggles, countUp,
  createCharts,
} from '../../src/charts.js';

const {
  renderBars, renderGroupedBars, renderHBars, renderStackedBars,
  renderTimeline, renderDualLine,
} = createCharts({ prefix: 'bl' });

wireTableToggles('bl');

const q = (sel) => document.querySelector(sel);
const pct = (n) => `${fmt1(n)} %`;
const p100 = (x) => x * 100;
const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);

function isoWeekKey(s) {
  const d = new Date(`${s}T00:00:00Z`);
  const dt = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = (dt.getUTCDay() + 6) % 7;
  dt.setUTCDate(dt.getUTCDate() - day + 3);
  const firstThu = new Date(Date.UTC(dt.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((dt - firstThu) / 86400000 - 3 + ((firstThu.getUTCDay() + 6) % 7)) / 7);
  return `${dt.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

const FORM_KURZ = {
  punkt_getrennt: 'Punkt getrennt',
  math_smallcaps: 'Sonderzeichen',
  leerzeichen_in_domain: 'Leerzeichen',
  homoglyph: 'kyrillisch',
  zero_width: 'unsichtbar',
  keine_verfremdung: 'unverfremdet',
};

function renderExamples(host, mode) {
  if (!host) return;
  host.innerHTML = BEISPIELE.spam_texte_je_monat.map((e) => {
    const src = mode === 'verfremdung' ? e.auffaelligste_verfremdung : e.haeufigste_normalform;
    const badges = mode === 'verfremdung'
      ? `<span class="bl-ex-tags">${e.auffaelligste_verfremdung.formen.map((f) => `<span class="bl-ex-tag">${FORM_KURZ[f] || f}</span>`).join('')}</span>`
      : '';
    return `
    <div class="bl-ex-row">
      <span class="bl-ex-meta">${monatKurz(e.monat)}</span>
      <code class="bl-ex-code is-struck">${escapeHtml(src.text)}</code>
      ${badges}
    </div>`;
  }).join('');
}

renderBars(q('[data-chart="monatsrate"]'), MONATE.map((m) => ({
  key: monatLang(m.monat),
  label: monatKurz(m.monat),
  value: m.je10k,
  dim: m.luecke === true,
  gap: m.luecke === true,
  gapLabel: 'keine Daten',
  tip: [
    ['Spam-Nachrichten je 10.000', m.luecke ? 'keine Chat-Daten' : fmt1(m.je10k)],
    ['Spam-Nachrichten im Chat', fmt(m.chat)],
    ['Spam-Nachrichten gesamt', fmt(m.gesamt)],
    ['Mitgelesene Kanäle', fmt(m.kanaele)],
  ],
})), { height: 240, valueOnMax: false, ariaLabel: 'Spam-Nachrichten je 10.000 mitgelesene Nachrichten je Monat' });

buildTable('monatsreihe',
  ['Monat', 'Mitgelesene Kanäle', 'Nachrichten', 'Spam-Nachrichten gesamt', 'davon im Chat', 'je 10.000 Nachrichten'],
  MONATE.map((m) => [monatLang(m.monat), fmt(m.kanaele), fmt(m.nachrichten), fmt(m.gesamt), fmt(m.chat), m.luecke ? 'Lücke' : fmt1(m.je10k)]));

renderExamples(q('[data-ex="chart1"]'), 'norm');

const stackFormen = VERFREMDUNG_FORMEN.filter((f) => VERFREMDUNG.some((m) => m[f.schluessel] > 0));
renderStackedBars(q('[data-chart="verfremdung"]'), VERFREMDUNG.map((m) => {
  const segments = VERFREMDUNG_FORMEN.map((f) => ({ name: f.name, value: m[f.schluessel], color: f.color }));
  return {
    key: monatLang(m.monat),
    label: monatKurz(m.monat),
    segments,
    tip: segments.filter((s) => s.value > 0).map((s) => [s.name, `${fmt(s.value)} (${fmt1((s.value / m.texte) * 100)} %)`, s.color]),
  };
}), { height: 240, ariaLabel: 'Verfremdungsformen der Spam-Texte je Monat', series: stackFormen });

buildTable('verfremdung',
  ['Monat', 'Texte', 'Punkt oder Wort statt Punkt', 'Leerzeichen im Namen', 'Math. und Kleinkapitälchen', 'Kyrillisch', 'Unsichtbar', 'Keine Verfremdung'],
  VERFREMDUNG.map((m) => [monatLang(m.monat), fmt(m.texte), fmt(m.punkt_getrennt), fmt(m.leerzeichen_in_domain), fmt(m.math_smallcaps), fmt(m.homoglyph), fmt(m.zero_width), fmt(m.keine_verfremdung)]));

renderExamples(q('[data-ex="chart2"]'), 'verfremdung');

renderHBars(q('[data-chart="marken"]'), MARKEN.map((m) => ({
  name: m.marke,
  sub: `${fmt(m.kanaele)} Kanäle`,
  value: m.vorfaelle,
  display: fmt(m.vorfaelle),
})), { unit: ' Spam-Nachrichten' });

buildTable('marken',
  ['Marke', 'Erstauftritt', 'Spam-Nachrichten', 'Kanäle', 'Lebensdauer (Tage)', 'Filter-Fragment gelernt', 'Reaktion bis Fragment (Tage)'],
  MARKEN.map((m) => [
    m.marke,
    datumLang(m.erstauftritt),
    fmt(m.vorfaelle),
    fmt(m.kanaele),
    fmt(m.lebensdauer),
    m.fragment ? datumLang(m.fragment) : 'kein Filter-Eintrag',
    m.fragment ? fmt(daysBetween(m.erstauftritt, m.fragment)) : 'ohne',
  ]));

const tlRows = [
  ...TIMELINE.marken.map((m) => ({
    name: m.name,
    sub: `${fmt(m.gesamt)} in ${fmt(m.kanaele)} Kanälen`,
    cells: m.wochen,
    fragmentWeek: m.fragment ? isoWeekKey(m.fragment) : null,
  })),
  {
    name: 'sonstige',
    sub: `${fmt(TIMELINE.sonstige.gesamt)} aus ${fmt(TIMELINE.sonstige.marken)} Marken`,
    cells: TIMELINE.sonstige.wochen,
    fragmentWeek: null,
  },
];
const tlMax = Math.max(...TIMELINE.marken.flatMap((m) => Object.values(m.wochen)));
renderTimeline(q('[data-chart="timeline"]'), {
  weeks: TIMELINE.weeks,
  rows: tlRows,
  max: tlMax,
  ariaLabel: 'Marken im Wochenraster von Februar bis September 2026; die Werte stehen in der Tabelle darunter',
});

buildTable('timeline',
  ['Marke', 'Erstauftritt', 'Chat-Nachrichten', 'Kanäle', 'Fragment gelernt'],
  [
    ...TIMELINE.marken.map((m) => [
      m.name, datumLang(m.erst), fmt(m.gesamt), fmt(m.kanaele),
      m.fragment ? datumLang(m.fragment) : 'kein Filter-Eintrag',
    ]),
    ['sonstige', 'gemischt', fmt(TIMELINE.sonstige.gesamt), 'diverse', `${fmt(TIMELINE.sonstige.marken)} Marken`],
  ]);

const kurveRows = TIMELINE.aktiv.map((w) => {
  const wk = TIMELINE.weeks.find((x) => x.key === w.woche);
  return {
    key: wk ? wk.title : w.woche,
    label: wk ? wk.label : '',
    a: w.aktiv,
    b: w.neu,
    tip: [['Aktive Marken', fmt(w.aktiv), GOLD], ['davon neu', fmt(w.neu), TEAL]],
  };
});
renderDualLine(q('[data-chart="marken-kurve"]'), kurveRows, {
  height: 200, nameA: 'Aktive Marken', nameB: 'davon neu',
  ariaLabel: 'Aktive Marken je Woche und davon neue Marken',
});

buildTable('marken-kurve', ['Woche', 'Aktive Marken', 'davon neu'],
  TIMELINE.aktiv.map((w) => {
    const wk = TIMELINE.weeks.find((x) => x.key === w.woche);
    return [wk ? wk.title.replace('Woche ab ', '') : w.woche, fmt(w.aktiv), fmt(w.neu)];
  }));

const scamHost = q('[data-ex="gespraech"]');
if (scamHost) scamHost.innerHTML = `<code class="bl-ex-code is-struck">${escapeHtml(BEISPIELE.gespraech)}</code>`;

renderHBars(q('[data-chart="scamkat"]'), SCAM_KATEGORIEN.map((k) => ({
  name: k.kategorie,
  value: k.vorfaelle,
  display: fmt(k.vorfaelle),
})), { unit: ' Fälle' });

buildTable('scamverdicts', ['Monat', 'Harmlos', 'Unsicher', 'Scam'],
  SCAM_MONATE.map((m) => [monatLang(m.monat), fmt(m.clean), fmt(m.unsure), fmt(m.scam)]));

renderGroupedBars(q('[data-chart="kontoalter"]'), [
  {
    key: 'Höchstens 7 Tage alt', label: '≤ 7 Tage',
    a: KONTOALTER.spam.le7, b: KONTOALTER.normal.le7,
    tip: [['Spam-Konten', pct(KONTOALTER.spam.le7), GOLD], ['Normale Chatter', pct(KONTOALTER.normal.le7), TEAL]],
  },
  {
    key: 'Höchstens 30 Tage alt', label: '≤ 30 Tage',
    a: KONTOALTER.spam.le30, b: KONTOALTER.normal.le30,
    tip: [['Spam-Konten', pct(KONTOALTER.spam.le30), GOLD], ['Normale Chatter', pct(KONTOALTER.normal.le30), TEAL]],
  },
], { height: 230, nameA: 'Spam-Konten', nameB: 'Normale Chatter', ariaLabel: 'Junge Konten: Anteil bei Spam gegen normale Chatter' });

buildTable('kontoalter',
  ['Gruppe', 'Konten', 'Median (Tage)', '25. Perzentil', '75. Perzentil', '≤ 7 Tage', '≤ 30 Tage', 'von Twitch gelöscht'],
  [
    ['Spam-Konten', fmt(KONTOALTER.spam.n), fmt1(KONTOALTER.spam.median), fmt1(KONTOALTER.spam.q1), fmt1(KONTOALTER.spam.q3), pct(KONTOALTER.spam.le7), pct(KONTOALTER.spam.le30), pct(GELOESCHT.spam.anteil)],
    ['Normale Chatter', fmt(KONTOALTER.normal.n), fmt(KONTOALTER.normal.median), fmt1(KONTOALTER.normal.q1), fmt1(KONTOALTER.normal.q3), pct(KONTOALTER.normal.le7), pct(KONTOALTER.normal.le30), pct(GELOESCHT.normal.anteil)],
  ]);

const loginHost = q('[data-ex="logins"]');
if (loginHost) loginHost.innerHTML = BEISPIELE.logins.map((l) => `<code class="bl-login">${escapeHtml(l)}</code>`).join('');

const ZK_KLASSEN = [
  ['k0_5', '0 bis 5'],
  ['k6_20', '6 bis 20'],
  ['k21_50', '21 bis 50'],
  ['k50p', 'über 50'],
];
renderGroupedBars(q('[data-chart="zuschauer"]'), ZK_KLASSEN.map(([k, label]) => ({
  key: `${label} Zuschauer`, label,
  a: p100(ZIELE.zuschauerklasse.spam_anteil[k]),
  b: p100(ZIELE.zuschauerklasse.streamstunden_anteil[k]),
  tip: [
    ['Spam-Nachrichten', pct(p100(ZIELE.zuschauerklasse.spam_anteil[k])), GOLD],
    ['Streamstunden', pct(p100(ZIELE.zuschauerklasse.streamstunden_anteil[k])), TEAL],
  ],
})), { height: 230, nameA: 'Spam-Nachrichten', nameB: 'Streamstunden', ariaLabel: 'Getroffene Kanäle nach Zuschauerklasse gegen Streamstunden' });

buildTable('zuschauer',
  ['Zuschauerklasse', 'Spam-Nachrichten', 'Anteil Spam', 'Anteil Streamstunden', 'Streamstunden'],
  ZK_KLASSEN.map(([k, label]) => [
    `${label} Zuschauer`,
    fmt(ZIELE.zuschauerklasse.spam_absolut[k]),
    pct(p100(ZIELE.zuschauerklasse.spam_anteil[k])),
    pct(p100(ZIELE.zuschauerklasse.streamstunden_anteil[k])),
    fmt1(ZIELE.zuschauerklasse.streamstunden_stunden[k]),
  ]));

const KONZ = [
  ['1_treffer', 'genau einmal getroffen'],
  ['2_bis_4', 'zwei- bis viermal'],
  ['5_bis_9', 'fünf- bis neunmal'],
  ['ab_10', 'zehnmal oder öfter'],
];
renderHBars(q('[data-chart="konzentration"]'), KONZ.map(([k, label]) => ({
  name: label,
  value: ZIELE.konzentration.verteilung[k],
  display: fmt(ZIELE.konzentration.verteilung[k]),
})), { unit: ' Kanäle' });

buildTable('konzentration', ['Trefferzahl je Kanal', 'Kanäle'],
  KONZ.map(([k, label]) => [label, fmt(ZIELE.konzentration.verteilung[k])]));

renderHBars(q('[data-chart="banrate"]'), BANRATE.map((m) => ({
  name: monatLang(m.monat),
  sub: `${fmt(m.mit_aktion)} von ${fmt(m.vorfaelle)} Spam-Nachrichten`,
  value: m.anteil,
  display: fmt1(m.anteil),
})), { unit: ' %', maxValue: 100 });

buildTable('banrate', ['Monat', 'Spam-Nachrichten', 'Mit Aktion', 'Anteil'],
  BANRATE.map((m) => [monatLang(m.monat), fmt(m.vorfaelle), fmt(m.mit_aktion), pct(m.anteil)]));

const DIST_SEG = [
  ['unter_1s', 'unter 1 s', '#c8a86b'],
  ['1_bis_2s', '1 bis 2 s', '#9c8550'],
  ['2_bis_5s', '2 bis 5 s', '#6f6a52'],
  ['ueber_5s', 'über 5 s', '#4a4740'],
];
function distBar(anteil) {
  return DIST_SEG.map(([k, label, c]) => {
    const w = p100(anteil[k]);
    return w > 0 ? `<span class="bl-dist-seg" style="width:${w}%;background:${c}" title="${label}: ${pct(w)}"></span>` : '';
  }).join('');
}
function reactRow(titel, quelle, r) {
  return `
  <div class="bl-react-row">
    <div class="bl-react-head">
      <span class="bl-react-title">${titel}</span>
      <span class="bl-react-quelle">${quelle}</span>
    </div>
    <div class="bl-react-stats">
      <span><b>${pct(p100(r.verteilung_anteil.unter_1s))}</b> unter 1 s</span>
      <span>Median <b>${fmt1(r.median_s)} s</b></span>
      <span>oberes Zehntel <b>${fmt1(r.p90_s)} s</b></span>
      <span>${fmt(r.n_paare)} Paare</span>
    </div>
    <div class="bl-dist" role="img" aria-label="Verteilung der Reaktionszeit">${distBar(r.verteilung_anteil)}</div>
  </div>`;
}
const reactHost = q('[data-react]');
if (reactHost) {
  reactHost.innerHTML = `
    ${reactRow('Ban über Twitchs Ereignis-Schnittstelle', 'Reihe 1', REAKTION_DETAIL.reihe1)}
    ${reactRow('Ban aus dem Bot-Log', 'Reihe 2', REAKTION_DETAIL.reihe2)}
    <div class="bl-dist-legend">${DIST_SEG.map(([, label, c]) => `<span><i style="background:${c}"></i>${label}</span>`).join('')}</div>`;
}

buildTable('reaktion',
  ['Quelle', 'Paare', 'Median', 'oberes Zehntel', 'unter 1 s', '1 bis 2 s', '2 bis 5 s', 'über 5 s'],
  [REAKTION_DETAIL.reihe1, REAKTION_DETAIL.reihe2].map((r, i) => [
    i === 0 ? 'Ereignis-Schnittstelle' : 'Bot-Log',
    fmt(r.n_paare), `${fmt1(r.median_s)} s`, `${fmt1(r.p90_s)} s`,
    pct(p100(r.verteilung_anteil.unter_1s)),
    pct(p100(r.verteilung_anteil['1_bis_2s'])),
    pct(p100(r.verteilung_anteil['2_bis_5s'])),
    pct(p100(r.verteilung_anteil.ueber_5s)),
  ]));

const scamGesamt = SCAM_KATEGORIEN.reduce((a, k) => a + k.vorfaelle, 0);
const mo = (m) => MONATE.find((x) => x.monat === m);
const vf = (m) => VERFREMDUNG.find((x) => x.monat === m);
const sc = (m) => SCAM_MONATE.find((x) => x.monat === m);
const streamboo = MARKEN.find((m) => m.marke === 'streamboo');
const streambooTl = TIMELINE.marken.find((m) => m.name === 'streamboo');
const twitchmaxTl = TIMELINE.marken.find((m) => m.name === 'twitchmax');
const augMarken = MARKEN.filter((m) => m.erstauftritt.startsWith('2026-08')).map((m) => m.erstauftritt).sort();
const augustSpanne = augMarken.length ? daysBetween(augMarken[0], augMarken[augMarken.length - 1]) : 0;
const alterExistierend = GELOESCHT.spam.angefragt - GELOESCHT.spam.fehlend;
const homoglyphGesamt = VERFREMDUNG.reduce((a, m) => a + m.homoglyph, 0);
const homoglyphMonate = VERFREMDUNG.filter((m) => m.homoglyph > 0).map((m) => monatLang(m.monat));
const zahlwort = (n) => ({ 0: 'kein Mal', 1: 'einmal', 2: 'zweimal' })[n] ?? `${fmt(n)}-mal`;
const spanne = (monate, key) => {
  const werte = monate.map((m) => mo(m)[key]);
  return `${fmt(Math.min(...werte))} bis ${fmt(Math.max(...werte))}`;
};
const kanaeleFebMar = spanne(['2026-02', '2026-03'], 'kanaele');
const kanaeleAprJun = spanne(['2026-04', '2026-05', '2026-06'], 'kanaele');

const fills = {
  stand: datumLang(STAND),

  'hero-vorfaelle': fmt(META.vorfaelle),
  'hero-konten': fmt(META.konten),
  'hero-paare': fmt(REAKTIONSZEIT.paare),
  't-geloescht-fehlend': fmt(GELOESCHT.spam.fehlend),
  't-geloescht-angefragt': fmt(GELOESCHT.spam.angefragt),
  't-geloescht-normal': pct(GELOESCHT.normal.anteil),

  'c1-vorfaelle': fmt(META.vorfaelle),
  'c1-konten': fmt(META.konten),
  'c1-banevents': fmt(META.quellen.ban_events),
  'c1-regex': fmt(META.quellen.regex),
  'c1-autoban': fmt(META.quellen.autoban),
  'c1-chatmod': fmt(META.quellen.chat_mod),
  'c1-kanaele-febmar': kanaeleFebMar,
  'c1-kanaele-aprjun': kanaeleAprJun,
  'c1-kanaele-jul': fmt(mo('2026-07').kanaele),
  'c1-kanaele-aug': fmt(mo('2026-08').kanaele),
  'c1-kanaele-mai': fmt(mo('2026-05').kanaele),
  'c1-rate-min': fmt1(mo('2026-07').je10k),
  'c1-rate-max': fmt1(mo('2026-05').je10k),

  'c2-texte': fmt(VERFREMDUNG_GESAMT),
  'c2-feb-punkt': fmt(vf('2026-02').punkt_getrennt),
  'c2-feb': fmt(vf('2026-02').texte),
  'c2-jul': fmt(vf('2026-07').punkt_getrennt),
  'c2-jul2': fmt(vf('2026-07').texte),
  'c2-mai-math': fmt(vf('2026-05').math_smallcaps),
  'c2-jun-math': fmt(vf('2026-06').math_smallcaps),
  'c2-homoglyph': zahlwort(homoglyphGesamt),
  'c2-homoglyph-monat': homoglyphMonate.join(' und '),

  'c3-streamboo-vorfaelle': fmt(streamboo.vorfaelle),
  'c3-streamboo-kanaele': fmt(streamboo.kanaele),
  'c3-streamboo-fragment': datumLang(streamboo.fragment),
  'c3-streamboo-reaktion': fmt(daysBetween(streamboo.erstauftritt, streamboo.fragment)),
  'c3-streamboo-erst': datumLang(streamboo.erstauftritt),
  'c3-august-spanne': fmt(augustSpanne),
  'c3-ru': RU_DOMAINS.join(', '),

  'c3t-chat': fmt(CHAT_GESAMT),
  'c3t-streamboo': fmt(streambooTl.gesamt),
  'c3t-streamboo-kan': fmt(streambooTl.kanaele),
  'c3t-twitchmax': fmt(twitchmaxTl.gesamt),
  'c3t-sonstige': fmt(TIMELINE.sonstige.gesamt),
  'c3t-sonstige-marken': fmt(TIMELINE.sonstige.marken),
  'c3t-chatbeginn': datumLang(TIMELINE.chatbeginn),

  'c4-scam-gesamt': fmt(scamGesamt),
  'c4-unsure-jul': fmt(sc('2026-07').unsure),
  'c4-unsure-aug': fmt(sc('2026-08').unsure),
  'c4-median-nachrichten': fmt(SCAM_PITCH.median_nachrichten),
  'c4-max-nachrichten': fmt(SCAM_PITCH.max),
  'c4-discord-gesamt': fmt(SCAM_DISCORD.gesamt),
  'c4-discord-mit': fmt(SCAM_DISCORD.mit_discord_bezug),
  'c4-banned': fmt(SCAM_AKTIONEN.banned),
  'c4-timeout': fmt(SCAM_AKTIONEN.timed_out),
  'c4-overturned': fmt(SCAM_AKTIONEN.overturned),

  'c5-median-spam': fmt1(KONTOALTER.spam.median),
  'c5-median-normal': fmt(KONTOALTER.normal.median),
  'c5-le7-spam': fmt1(KONTOALTER.spam.le7),
  'c5-le30-spam': fmt1(KONTOALTER.spam.le30),
  'c5-le7-normal': fmt1(KONTOALTER.normal.le7),
  'c5-le30-normal': fmt1(KONTOALTER.normal.le30),
  'c5-geloescht-spam': fmt1(GELOESCHT.spam.anteil),
  'c5-geloescht-normal': fmt1(GELOESCHT.normal.anteil),
  'c5-fehlend': fmt(GELOESCHT.spam.fehlend),
  'c5-angefragt': fmt(GELOESCHT.spam.angefragt),
  'c5-laenge-spam': fmt(NAMENSMUSTER.spam.laenge),
  'c5-laenge-normal': fmt(NAMENSMUSTER.normal.laenge),
  'c5-muster-spam': fmt1(NAMENSMUSTER.spam.zufallsschwanz),
  'c5-muster-normal': fmt1(NAMENSMUSTER.normal.zufallsschwanz),
  'c5-max-kanaele': fmt(VERHALTEN.kanaele_max),
  'c5-geloescht-spam2': fmt1(GELOESCHT.spam.anteil),
  'c5-n-spam': fmt(KONTOALTER.spam.n),
  'c5-verhalten': fmt(VERHALTEN.konten),
  'c5-konten': fmt(META.konten),

  'c6-chat': fmt(CHAT_GESAMT),
  'c6-k0_5-spam': pct(p100(ZIELE.zuschauerklasse.spam_anteil.k0_5)),
  'c6-k0_5-stunden': pct(p100(ZIELE.zuschauerklasse.streamstunden_anteil.k0_5)),
  'c6-kanaele': fmt(ZIELE.konzentration.kanaele_gesamt),
  'c6-k1': fmt(ZIELE.konzentration.verteilung['1_treffer']),
  'c6-k24': fmt(ZIELE.konzentration.verteilung['2_bis_4']),
  'c6-k59': fmt(ZIELE.konzentration.verteilung['5_bis_9']),
  'c6-k10': fmt(ZIELE.konzentration.verteilung.ab_10),
  'c6-top10': pct(p100(ZIELE.konzentration.top10_anteil_der_spamnachrichten)),
  'c6-partner-treffer': pct(p100(ZIELE.partner.spam_anteil.partner)),
  'c6-partner-stunden': pct(p100(ZIELE.partner.streamstunden_anteil.partner)),
  'c6-start10': pct(p100(ZIELE.streamstart.anteil_10min)),
  'c6-start30': pct(p100(ZIELE.streamstart.anteil_30min)),
  'c6-mitzuschauer': fmt(ZIELE.n.mit_zuschauerzahl),
  'c6-ohnesnapshot': fmt(ZIELE.zuschauerklasse.spam_unbekannt),

  'c7-jul': fmt1(BANRATE[0].anteil),
  'c7-aug': fmt1(BANRATE[1].anteil),
  'c7-sep': fmt1(BANRATE[2].anteil),
  'c7-spam': fmt(PFADE.spam),
  'c7-scam': fmt(PFADE.scam),
  'c7-guardbans': fmt(PFADE.scam_guard_bans),
  'c7-global': fmt(PFADE.global_ban),
  'c7-banliste-konten': fmt(GLOBAL_BANLISTE.konten),
  'c7-banliste-anwendungen': fmt(GLOBAL_BANLISTE.anwendungen),
  'c7-banliste-kanaele': fmt(GLOBAL_BANLISTE.kanaele),
  'c7-regex-harmlos': fmt(FEHLALARME.regex_harmlos),
  'c7-regex-geprueft': fmt(FEHLALARME.regex_geprueft),
  'c7-safe': fmt(FEHLALARME.safe_patterns),
  'c7-r1-unter1': pct(p100(REAKTION_DETAIL.reihe1.verteilung_anteil.unter_1s)),
  'c7-r1-median': fmt1(REAKTION_DETAIL.reihe1.median_s),
  'c7-r1-p90': fmt1(REAKTION_DETAIL.reihe1.p90_s),
  'c7-r1-paare': fmt(REAKTION_DETAIL.reihe1.n_paare),
  'c7-r2-unter1': pct(p100(REAKTION_DETAIL.reihe2.verteilung_anteil.unter_1s)),
  'c7-r2-median': fmt1(REAKTION_DETAIL.reihe2.median_s),
  'c7-r2-p90': fmt1(REAKTION_DETAIL.reihe2.p90_s),
  'c7-r2-paare': fmt(REAKTION_DETAIL.reihe2.n_paare),
  'c6-median': fmt1(REAKTIONSZEIT.median),
  'c6-p90': fmt1(REAKTIONSZEIT.p90),
  'c6-paare': fmt(REAKTIONSZEIT.paare),

  'm-kanaele-febmar': kanaeleFebMar,
  'm-kanaele-aprjun': kanaeleAprJun,
  'm-kanaele-jul': fmt(mo('2026-07').kanaele),
  'm-kanaele-aug': fmt(mo('2026-08').kanaele),
  'm-paare': fmt(REAKTIONSZEIT.paare),
  'm-unbans': fmt(METHODIK.massentbannung),
  'm-alter-n': fmt(KONTOALTER.spam.n),
  'm-alter-existing': fmt(alterExistierend),
  'm-chat-gesamt': fmt(CHAT_GESAMT),
  'm-vorfaelle': fmt(META.vorfaelle),
  'm-mitzuschauer': fmt(ZIELE.n.mit_zuschauerzahl),
  'm-ohnesnapshot': fmt(ZIELE.zuschauerklasse.spam_unbekannt),
};

Object.entries(fills).forEach(([key, value]) => {
  const el = q(`[data-fill="${key}"]`);
  if (el) el.textContent = value;
});

const counts = {
  vorfaelle: META.vorfaelle,
  streamboo: streamboo.vorfaelle,
  geloescht: GELOESCHT.spam.anteil,
  reaktion: REAKTIONSZEIT.median,
};

document.querySelectorAll('[data-fill-count]').forEach((el) => {
  const value = counts[el.dataset.fillCount];
  if (value === undefined) return;
  const dec = Number(el.dataset.decimals || 0);
  el.dataset.count = String(value);
  el.textContent = dec
    ? value.toFixed(dec).replace('.', ',')
    : fmt(value);
});

countUp();
