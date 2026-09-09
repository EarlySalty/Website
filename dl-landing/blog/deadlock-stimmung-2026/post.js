import {
  STAND, META, KAP1, PATCH_MARKER, PATCH_DELTA,
  SZENE, ABSCHNITTE, CHAT, TOTDEAD, CHAT_BEISPIELE, NEWCOMERS,
  VOICE, VOICE_MONAT, TAGESZEIT, MITGLIEDER, MITGLIEDER_STAND,
  TEXT, PRESENCE, LEAVE, STEAM,
} from './data.js';

import {
  GOLD, TEAL, fmt, fmt1, escapeHtml, MONATE_KURZ, TAGE,
  datumLang,
  buildTable, wireTableToggles, countUp,
  createCharts,
} from '../../src/charts.js';

const {
  renderLine, renderDualLine, renderHBars, renderStackedBars, renderHeatmap,
} = createCharts({ prefix: 'bl' });

wireTableToggles('bl');

const q = (sel) => document.querySelector(sel);
const nf1 = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtRate = (n) => (n < 1 ? nf2.format(n) : nf1.format(n));
const pct = (n) => `${fmt1(n)} %`;
const round0 = (n) => fmt(Math.round(n));
const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);

function isoMonday(wk) {
  const [y, w] = wk.split('-').map(Number);
  const jan4 = new Date(Date.UTC(y, 0, 4));
  const jan4Dow = (jan4.getUTCDay() + 6) % 7;
  const week1 = new Date(jan4);
  week1.setUTCDate(jan4.getUTCDate() - jan4Dow);
  const mon = new Date(week1);
  mon.setUTCDate(week1.getUTCDate() + (w - 1) * 7);
  return mon;
}
function wkNice(wk) {
  const [, w] = wk.split('-');
  const m = isoMonday(wk);
  return `KW ${Number(w)}, ${MONATE_KURZ[m.getUTCMonth()]} ${m.getUTCFullYear()}`;
}
function monthLabels(weeks) {
  let last = null;
  return weeks.map((wk) => {
    const mo = isoMonday(wk).getUTCMonth();
    if (mo === last) return '';
    last = mo;
    return MONATE_KURZ[mo];
  });
}
function markerIndices(weeks) {
  return PATCH_MARKER
    .map((p) => ({ i: weeks.indexOf(p.wk), big: p.typ !== 'balance' }))
    .filter((m) => m.i >= 0);
}

const chatFull = CHAT.filter((c) => !c.partial);
const sumF = (f) => chatFull.reduce((s, c) => s + (c[f] || 0), 0);
const msgsTotal = sumF('msgs');
const labeledTotal = sumF('labeled');
const rate = (f) => (sumF(f) / msgsTotal) * 1000;
const share = (f) => (sumF(f) / labeledTotal) * 100;

const hypeRate = rate('kw_hype');
const totdeadRate = rate('kw_totdead');
const patchRate = rate('kw_patch');
const valveRate = rate('kw_valve');
const heldRate = rate('kw_held');
const wannRate = rate('kw_wann');
const langwRate = rate('kw_langw');
const effektivTotdead = totdeadRate * (TOTDEAD.spiel / TOTDEAD.stichprobe);

const coverageWeeks = CHAT.filter((c) => c.dlSessions && c.sessWithMsg > 0).map((c) => (c.sessWithMsg / c.dlSessions) * 100);
const coverageAvg = coverageWeeks.reduce((a, b) => a + b, 0) / coverageWeeks.length;

const vm = (m) => VOICE_MONAT.find((x) => x.monat === m);
const voiceMean = (a, b) => {
  const s = VOICE.filter((v) => v.wk >= a && v.wk <= b);
  return s.reduce((x, v) => x + v.hours, 0) / s.length;
};

/* ── Kapitel 1: Patch-Zeitleiste ──────────────────────────────── */
const patchRows = [
  { datum: KAP1.patch.old_gods_new_blood.start, art: 'Großer Inhalts-Patch', was: 'Old Gods, New Blood (Start, sechs Helden)' },
  { datum: KAP1.patch.old_gods_new_blood.ende, art: 'Großer Inhalts-Patch', was: 'Abschluss (Apollo)' },
  ...KAP1.patch.gameplay_updates_2026.map((d, i) => ({
    datum: d, art: 'Gameplay-Update', was: i === KAP1.patch.gameplay_updates_2026.length - 1 ? 'Letztes Gameplay-Update' : 'Gameplay-Update',
  })),
  ...['2026-06-11', '2026-06-30', '2026-07-09', '2026-07-28', '2026-08-12', '2026-08-22']
    .map((d) => ({ datum: d, art: 'Balance-Patch', was: 'Balance-Patch' })),
];
buildTable('patchliste',
  ['Datum', 'Art', 'Was', 'Tage seit vorigem'],
  patchRows.map((r, i) => [
    datumLang(r.datum), r.art, r.was,
    i === 0 ? '' : fmt(daysBetween(patchRows[i - 1].datum, r.datum)),
  ]));

/* ── Kapitel 2: Szene ─────────────────────────────────────────── */
const szeneFull = SZENE.filter((r) => !r.partial);
const szeneWeeks = szeneFull.map((r) => r.wk);
const szeneLabels = monthLabels(szeneWeeks);
const szeneMarkers = markerIndices(szeneWeeks);

renderLine(q('[data-chart="sendezeit"]'), szeneFull.map((r, i) => ({
  key: wkNice(r.wk),
  label: szeneLabels[i],
  value: r.streamH,
  tip: [
    ['Stream-Stunden', fmt1(r.streamH)],
    ['Zuschauer-Stunden', fmt1(r.zuschauerH)],
    ['Peak gleichzeitig', fmt(r.peak)],
  ],
})), { height: 250, padT: 26, markers: szeneMarkers, ariaLabel: 'Stream-Stunden der deutschen Szene je Woche mit Patch-Tagen' });

buildTable('sendezeit',
  ['Woche', 'Stream-Stunden', 'Zuschauer-Stunden', 'Peak gleichzeitig', 'Kanäle je Tag'],
  szeneFull.map((r) => [wkNice(r.wk), fmt1(r.streamH), fmt1(r.zuschauerH), fmt(r.peak), fmt(r.chanDay)]));

renderLine(q('[data-chart="reichweite"]'), szeneFull.map((r, i) => ({
  key: wkNice(r.wk),
  label: szeneLabels[i],
  value: r.peak,
  tip: [
    ['Peak gleichzeitig', fmt(r.peak)],
    ['Kanäle je Tag', fmt(r.chanDay)],
    ['Streams gleichzeitig (Median)', fmt(r.medStreams)],
  ],
})), { height: 230, padT: 26, markers: szeneMarkers, ariaLabel: 'Höchste Zahl gleichzeitiger Zuschauer je Woche mit Patch-Tagen' });

buildTable('reichweite',
  ['Woche', 'Peak gleichzeitig', 'Kanäle je Tag', 'Streams gleichzeitig (Median)'],
  szeneFull.map((r) => [wkNice(r.wk), fmt(r.peak), fmt(r.chanDay), fmt(r.medStreams)]));

/* ── Kapitel 3: Chat ──────────────────────────────────────────── */
const STICH = [
  { name: 'Hype (hype, endlich, geil, nice)', rate: hypeRate, key: 'kw_hype' },
  { name: 'tot / dead', rate: totdeadRate, key: 'kw_totdead' },
  { name: 'patch / update', rate: patchRate, key: 'kw_patch' },
  { name: 'neuer Held', rate: heldRate, key: 'kw_held' },
  { name: 'Valve / Yoshi', rate: valveRate, key: 'kw_valve' },
  { name: 'wann kommt', rate: wannRate, key: 'kw_wann' },
  { name: 'langweilig / boring', rate: langwRate, key: 'kw_langw' },
].sort((a, b) => b.rate - a.rate);

renderHBars(q('[data-chart="stichworte"]'), STICH.map((s) => ({
  name: s.name, value: s.rate, display: fmtRate(s.rate),
})), { unit: ' je 1.000', maxValue: Math.max(...STICH.map((s) => s.rate)) });

buildTable('stichworte',
  ['Wortgruppe', 'je 1.000 Nachrichten', 'Treffer insgesamt'],
  STICH.map((s) => [s.name, fmtRate(s.rate), fmt(sumF(s.key))]));

const TD = [
  { name: 'Spielertod im Match', value: TOTDEAD.spielertod },
  { name: 'Etwas anderes (müde, andere Spiele, leiser Chat)', value: TOTDEAD.anderes },
  { name: 'Das Spiel oder seine Gesundheit', value: TOTDEAD.spiel },
];
renderHBars(q('[data-chart="totdead"]'), TD.map((t) => ({
  name: t.name, value: t.value, display: fmt(t.value),
})), { unit: ` von ${TOTDEAD.stichprobe}`, maxValue: TOTDEAD.stichprobe });

buildTable('totdead',
  ['Bedeutung', 'Treffer', 'Anteil'],
  TD.map((t) => [t.name, fmt(t.value), pct((t.value / TOTDEAD.stichprobe) * 100)]));

const ARTEN = [
  { key: 'reaction', name: 'Reaktion', color: '#c8a86b' },
  { key: 'game', name: 'Spielbezug', color: '#55978f' },
  { key: 'question', name: 'Frage', color: '#e2c98d' },
  { key: 'social', name: 'Sozial', color: '#9a9488' },
  { key: 'hype', name: 'Hype', color: '#b56a44' },
  { key: 'feedback', name: 'Feedback', color: '#6d6a63' },
  { key: 'rest', name: 'Aussage und Sonstiges', color: '#3f3d38' },
];
const artenWeeks = chatFull.filter((c) => c.labeled > 0);
const artenLabels = monthLabels(artenWeeks.map((c) => c.wk));
renderStackedBars(q('[data-chart="arten"]'), artenWeeks.map((c, i) => {
  const rest = c.labeled - (c.reaction + c.game + c.question + c.social + c.hype + c.feedback);
  const vals = { ...c, rest };
  const segments = ARTEN.map((a) => ({ name: a.name, value: vals[a.key], color: a.color }));
  return {
    key: wkNice(c.wk),
    label: artenLabels[i],
    segments,
    tip: segments.filter((s) => s.value > 0).map((s) => [s.name, `${pct((s.value / c.labeled) * 100)}`, s.color]),
  };
}), { height: 240, ariaLabel: 'Anteile der Nachrichtenarten je Woche', series: ARTEN });

buildTable('arten',
  ['Woche', 'Reaktion', 'Spielbezug', 'Frage', 'Sozial', 'Hype', 'Feedback', 'Aussage/Sonstiges'],
  artenWeeks.map((c) => {
    const rest = c.labeled - (c.reaction + c.game + c.question + c.social + c.hype + c.feedback);
    return [wkNice(c.wk), fmt(c.reaction), fmt(c.game), fmt(c.question), fmt(c.social), fmt(c.hype), fmt(c.feedback), fmt(rest)];
  }));

const twHost = q('[data-ex="twitch"]');
if (twHost) {
  twHost.innerHTML = [...CHAT_BEISPIELE.twitch_totdead.slice(0, 3), ...CHAT_BEISPIELE.twitch_patch.slice(0, 3)]
    .map((t) => `<span class="bl-quote">${escapeHtml(t)}</span>`).join('');
}

/* ── Kapitel 4: Discord ───────────────────────────────────────── */
const voiceWeeks = VOICE.map((v) => v.wk);
const voiceLabels = monthLabels(voiceWeeks);
const voiceMarkers = markerIndices(voiceWeeks);
renderLine(q('[data-chart="voice"]'), VOICE.map((v, i) => ({
  key: wkNice(v.wk),
  label: voiceLabels[i],
  value: v.hours,
  tip: [['Voice-Stunden', fmt1(v.hours)], ['Verschiedene Nutzer', fmt(v.users)]],
})), { height: 240, padT: 26, markers: voiceMarkers, ariaLabel: 'Voice-Stunden im Discord je Woche mit Patch-Tagen' });

buildTable('voice',
  ['Woche', 'Voice-Stunden', 'Verschiedene Nutzer'],
  VOICE.map((v) => [wkNice(v.wk), fmt1(v.hours), fmt(v.users)]));

renderHeatmap(q('[data-chart="tageszeit"]'), TAGESZEIT.summer.matrix, {
  unitLabel: 'Std. je Wochentag',
  formatValue: fmt1,
  ariaLabel: 'Voice-Stunden im Sommer nach Wochentag und Uhrzeit; die Werte stehen in der Tabelle darunter',
});

const tzRows = TAGESZEIT.summer.matrix.map((row, wd) => {
  const summe = row.reduce((a, b) => a + b, 0);
  const peakH = row.reduce((best, v, h) => (v > row[best] ? h : best), 0);
  return [TAGE[wd], fmt1(summe), `${String(peakH).padStart(2, '0')} Uhr`, fmt1(row[peakH])];
});
buildTable('tageszeit',
  ['Wochentag', 'Stunden je Tag (Schnitt)', 'Stärkste Zeit', 'Stunden dort'],
  tzRows);

renderDualLine(q('[data-chart="mitglieder"]'), MITGLIEDER.map((m, i) => ({
  key: wkNice(m.wk),
  label: monthLabels(MITGLIEDER.map((x) => x.wk))[i],
  a: m.joins,
  b: m.leaves,
  tip: [['Beitritte', fmt(m.joins), GOLD], ['Austritte', fmt(m.leaves), TEAL], ['Netto', (m.net >= 0 ? '+' : '') + fmt(m.net)]],
})), { height: 220, nameA: 'Beitritte', nameB: 'Austritte', ariaLabel: 'Beitritte und Austritte je Woche' });

buildTable('mitglieder',
  ['Woche', 'Beitritte', 'Austritte', 'Netto'],
  MITGLIEDER.map((m) => [wkNice(m.wk), fmt(m.joins), fmt(m.leaves), (m.net >= 0 ? '+' : '') + fmt(m.net)]));

/* ── Kapitel 5: Steam ─────────────────────────────────────────── */
const MONAT_LANG = { '2026-06': 'Juni 2026', '2026-07': 'Juli 2026', '2026-08': 'August 2026', '2026-09': 'September 2026 (bis 9.)' };
renderHBars(q('[data-chart="steam"]'), STEAM.rank_monthly.map((m) => ({
  name: MONAT_LANG[m.monat] || m.monat, value: m.konten, display: fmt(m.konten),
})), { unit: ' Konten', maxValue: Math.max(...STEAM.rank_monthly.map((m) => m.konten)) });

buildTable('steam',
  ['Monat', 'Konten mit Rangbewegung', 'von verifizierten'],
  STEAM.rank_monthly.map((m) => [MONAT_LANG[m.monat] || m.monat, fmt(m.konten), fmt(STEAM.verified)]));

/* ── Kapitel 6: Synthese ──────────────────────────────────────── */
buildTable('synthese',
  ['Kennzahl', 'Frühjahr', 'Spätsommer'],
  [
    ['Twitch: Sendezeit je Woche', `${round0(ABSCHNITTE.fruehjahr.streamH)} h`, `${round0(ABSCHNITTE.spaetsommer.streamH)} h`],
    ['Twitch: Peak gleichzeitige Zuschauer', fmt1(ABSCHNITTE.fruehjahr.peak), fmt1(ABSCHNITTE.spaetsommer.peak)],
    ['Discord: Voice-Stunden je Woche', `${round0(voiceMean('2026-15', '2026-26'))} h`, `${round0(voiceMean('2026-31', '2026-36'))} h`],
  ]);

/* ── Zahlen im Text ───────────────────────────────────────────── */
const fills = {
  stand: datumLang(STAND),

  't-sendezeit-frueh': round0(ABSCHNITTE.fruehjahr.streamH),
  't-totdead-anteil': fmt(Math.round((TOTDEAD.spiel / TOTDEAD.stichprobe) * 100)),
  't-presence-jul': fmt(PRESENCE[0].median),

  'c1-anlass': datumLang(META.anlass_datum),
  'c1-steam-feb': fmt(KAP1.steam.monatsschnitt_feb_2026),
  'c1-steam-mai': fmt(KAP1.steam.schnitt_30_tage_bis_2026_05_07),
  'c1-steam-aug': fmt(KAP1.steam.snapshot_2026_08_09.im_spiel),
  'c1-valve-datum': datumLang(KAP1.valve.datum),
  'c1-tage-gameplay': fmt(KAP1.patch.tage_seit_letztem_gameplay_update_am_stichtag),

  'c2-scout': fmt(META.scout_kanaele),
  'c2-frueh': round0(ABSCHNITTE.fruehjahr.streamH),
  'c2-spaet': round0(ABSCHNITTE.spaetsommer.streamH),
  'c2-herbst': round0(ABSCHNITTE.herbst2025.streamH),
  'c2-peak-frueh': fmt1(ABSCHNITTE.fruehjahr.peak),
  'c2-peak-spaet': fmt1(ABSCHNITTE.spaetsommer.peak),
  'c2-peak-delta': fmt1(ABSCHNITTE.peak_rueckgang_pct),
  'c2-peak-max': fmt(ABSCHNITTE.allzeit_peak.wert),
  'c2-og-stream': fmt1(PATCH_DELTA.old_gods.delta_stream),
  'c2-og-zuschauer': fmt(PATCH_DELTA.old_gods.delta_zuschauer),
  'c2-og-stream2': fmt1(Math.abs(PATCH_DELTA.old_gods.plus2_stream)),
  'c2-og-zuschauer2': fmt(Math.abs(PATCH_DELTA.old_gods.plus2_zuschauer)),
  'c2-0728-stream': fmt1(PATCH_DELTA.p0728.delta_stream),
  'c2-0728-zuschauer': fmt1(PATCH_DELTA.p0728.delta_zuschauer),

  'c3-msgs': fmt(msgsTotal),
  'c3-reaction': fmt1(share('reaction')),
  'c3-game': fmt1(share('game')),
  'c3-question': fmt1(share('question')),
  'c3-hype-rate': fmtRate(hypeRate),
  'c3-totdead-rate': fmtRate(totdeadRate),
  'c3-patch-rate': fmtRate(patchRate),
  'c3-langw-rate': fmtRate(langwRate),
  'c3-wann-rate': fmtRate(wannRate),
  'c3-td-stichprobe': fmt(TOTDEAD.stichprobe),
  'c3-td-spiel': fmt(TOTDEAD.spiel),
  'c3-td-spiel-pct': fmt(Math.round((TOTDEAD.spiel / TOTDEAD.stichprobe) * 100)),
  'c3-td-tod': fmt(TOTDEAD.spielertod),
  'c3-td-anderes': fmt(TOTDEAD.anderes),
  'c3-td-effektiv': fmtRate(effektivTotdead),
  'c3-coverage': fmt1(coverageAvg),
  'c3-newcomer': fmt(NEWCOMERS.summe),
  'c3-cfe-rows': fmt(NEWCOMERS.confirmed_rows),

  'c4-voice-maerz': fmt(vm('2026-03').stunden),
  'c4-voice-mai': fmt(vm('2026-05').stunden),
  'c4-voice-juni': fmt(vm('2026-06').stunden),
  'c4-voice-juli': fmt(vm('2026-07').stunden),
  'c4-voice-aug': fmt(vm('2026-08').stunden),
  'c4-abend-frueh': fmt1(TAGESZEIT.spring.share16_22),
  'c4-abend-sommer': fmt1(TAGESZEIT.summer.share16_22),
  'c4-present': fmt(MITGLIEDER_STAND.present_mensch_ohne_spike),
  'c4-present-vorher': fmt(MITGLIEDER_STAND.vorher),
  'c4-presence-jul': fmt(PRESENCE[0].median),
  'c4-presence-aug': fmt(PRESENCE[1].median),
  'c4-presence-sep': fmt(PRESENCE[2].median),
  'c4-leave-gesamt': fmt(LEAVE.gesamt),
  'c4-leave-sent': fmt(LEAVE.sent),

  'c5-frozen': datumLang(STEAM.live_frozen_since),
  'c5-verified': fmt(STEAM.verified),
  'c5-jun': fmt(STEAM.rank_monthly[0].konten),
  'c5-jul': fmt(STEAM.rank_monthly[1].konten),
  'c5-aug': fmt(STEAM.rank_monthly[2].konten),
  'c5-sep': fmt(STEAM.rank_monthly[3].konten),
  'c5-match': fmt(STEAM.match_referenz),

  'm-scout': fmt(META.scout_kanaele),
  'm-td-pct': fmt(Math.round((TOTDEAD.spiel / TOTDEAD.stichprobe) * 100)),
};

Object.entries(fills).forEach(([key, value]) => {
  const el = q(`[data-fill="${key}"]`);
  if (el) el.textContent = value;
});

const counts = {
  't-sendezeit': ABSCHNITTE.spaetsommer.streamH,
  't-reichweite': ABSCHNITTE.peak_rueckgang_pct,
  't-totdead': totdeadRate,
  't-presence': PRESENCE[2].median,
};

document.querySelectorAll('[data-fill-count]').forEach((el) => {
  const value = counts[el.dataset.fillCount];
  if (value === undefined) return;
  const dec = Number(el.dataset.decimals || 0);
  el.dataset.count = String(value);
  el.textContent = dec ? value.toFixed(dec).replace('.', ',') : fmt(Math.round(value));
});

countUp();
