/**
 * Diagramme zum Blogpost "Zehn Monate deutsche Deadlock-Streamer auf Twitch".
 *
 * Hier stehen nur noch die Daten und ihre Zuordnung zu den Diagrammen.
 * Die Zeichenfunktionen und die Diagramm-Regeln liegen in src/charts.js und
 * werden von der Transparenz-Seite und von /szene/ mitgenutzt.
 */

import {
  WOCHEN, SPRACHPROBE,
  ZU_UND_ABGANG,
  UEBERLEBEN,
  HEATMAP, SESSIONDAUER,
  VIEWER_KLASSEN, VIEWER_META,
  PATCHES,
  NETZWERK, NETZWERK_BEITRITTE, NETZWERK_ALTER, RAIDS, RAID_GROESSEN, MATCHED,
  METHODIK,
} from './data.js';

import {
  GOLD, TEAL, fmt, fmt1,
  TAGE, monatKurz, monatLang, datumLang,
  buildTable, wireTableToggles, countUp,
  createCharts,
} from '../../src/charts.js';

const {
  renderBars, renderGroupedBars, renderLine, renderHBars, renderHeatmap,
} = createCharts({ prefix: 'bl' });

wireTableToggles('bl');

/** Zwei feste Nachkommastellen. Nur der Blogpost braucht diese Genauigkeit. */
const fmt2 = (n) => new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

const q = (sel) => document.querySelector(sel);

/* ══ Kapitel 1: Groesse der Szene ═════════════════════════════ */
renderLine(q('[data-chart="szene"]'), WOCHEN.map(([w, aktiv, viewer, streams]) => ({
  key: `Woche ab ${datumLang(w)}`,
  label: w.endsWith('-01') || w.slice(8) <= '07' ? monatKurz(w) : '',
  value: aktiv,
  tip: [['Aktive Streamer', fmt(aktiv)], ['Streams in der Primetime', fmt1(streams)], ['Viewer in der Primetime', fmt1(viewer)]],
})), { labelEvery: 1, height: 250, ariaLabel: 'Aktive deutsche Deadlock-Streamer je Woche von Oktober 2025 bis August 2026' });

renderLine(q('[data-chart="primetime"]'), WOCHEN.map(([w, aktiv, viewer, streams]) => ({
  key: `Woche ab ${datumLang(w)}`,
  label: w.endsWith('-01') || w.slice(8) <= '07' ? monatKurz(w) : '',
  value: streams,
  tip: [['Streams gleichzeitig', fmt1(streams)], ['Aktive Streamer in der Woche', fmt(aktiv)]],
})), { labelEvery: 1, height: 170, ariaLabel: 'Gleichzeitig laufende deutsche Deadlock-Streams in der Primetime je Woche' });

buildTable('szene', ['Woche ab', 'Aktive Streamer', 'Streams gleichzeitig (Primetime)', 'Viewer im Schnitt (Primetime)'],
  WOCHEN.map(([w, aktiv, viewer, streams]) => [datumLang(w), fmt(aktiv), fmt1(streams), fmt1(viewer)]));

buildTable('sprachprobe', ['Tag', 'Deadlock-Streamer weltweit', 'davon deutsch', 'Anteil'],
  SPRACHPROBE.map(([d, alle, de]) => [datumLang(d), fmt(alle), fmt(de), `${fmt1((de / alle) * 100)} %`]));

/* ══ Kapitel 2: Zu- und Abgaenge ══════════════════════════════ */
renderGroupedBars(q('[data-chart="fluss"]'), ZU_UND_ABGANG.map(([m, neu, weg, netto]) => ({
  key: monatLang(m),
  label: monatKurz(m),
  a: neu,
  b: weg,
  tip: [['Neu aufgetaucht', fmt(neu), GOLD], ['Nicht wiedergekommen', fmt(weg), TEAL], ['Netto', `${netto > 0 ? '+' : ''}${fmt(netto)}`]],
})), {
  height: 250, nameA: 'Zum ersten Mal gesehen', nameB: 'Zum letzten Mal gesehen',
  ariaLabel: 'Neue und verschwundene Streamer je Monat',
});
buildTable('fluss', ['Monat', 'Neu', 'Weg', 'Netto'],
  ZU_UND_ABGANG.map(([m, neu, weg, netto]) => [monatLang(m), fmt(neu), fmt(weg), `${netto > 0 ? '+' : ''}${fmt(netto)}`]));

/* ══ Kapitel 3: Wer bleibt ════════════════════════════════════ */
renderHBars(q('[data-chart="ueberleben"]'), UEBERLEBEN.map((u) => ({
  name: `${u.tage} Tage danach`,
  sub: `${fmt(u.bewertbar)} Streamer bewertbar`,
  value: u.anteil,
  display: fmt1(u.anteil),
})), { unit: ' %' });
buildTable('ueberleben', ['Fenster', 'Noch aktiv', 'Bewertbare Streamer', 'Wegen Zensierung ausgeschlossen'],
  UEBERLEBEN.map((u) => [`${u.tage} Tage`, `${fmt1(u.anteil)} %`, fmt(u.bewertbar), fmt(METHODIK.streamer - u.bewertbar)]));

/* ══ Kapitel 4: Wann gestreamt wird ═══════════════════════════ */
renderHeatmap(q('[data-heat="zeit"]'), HEATMAP, {
  ariaLabel: 'Raster der Messpunkte nach Wochentag und Stunde; die Werte stehen in der Tabelle darunter',
});
buildTable('zeit', ['Wochentag', ...Array.from({ length: 24 }, (_, h) => String(h)), 'Summe'],
  HEATMAP.map((row, wd) => [TAGE[wd], ...row.map((v) => fmt(v)), fmt(row.reduce((a, b) => a + b, 0))]));

renderBars(q('[data-chart="dauer"]'), SESSIONDAUER.map(([b, n]) => ({
  key: `Sessions von ${b.replace('min', ' Minuten').replace('h+', ' Stunden und mehr').replace('h', ' Stunden')}`,
  label: b,
  value: n,
  tip: [['Sessions', fmt(n)], ['Anteil', `${fmt1((n / METHODIK.sessions) * 100)} %`]],
})), { height: 220, maxBarWidth: 74, ariaLabel: 'Verteilung der Sessiondauer' });
buildTable('dauer', ['Länge', 'Sessions', 'Anteil'],
  SESSIONDAUER.map(([b, n]) => [b, fmt(n), `${fmt1((n / METHODIK.sessions) * 100)} %`]));

/* ══ Kapitel 5: Viewer-Realitaet ══════════════════════════════ */
renderHBars(q('[data-chart="viewer"]'), VIEWER_KLASSEN.map(([b, n]) => ({
  name: `${b} Zuschauer`,
  sub: `${fmt(n)} Snapshots`,
  value: (n / VIEWER_META.zeilen) * 100,
  display: fmt1((n / VIEWER_META.zeilen) * 100),
})), { unit: ' %' });
buildTable('viewer', ['Zuschauer gleichzeitig', 'Snapshots', 'Anteil'],
  VIEWER_KLASSEN.map(([b, n]) => [b, fmt(n), `${fmt1((n / VIEWER_META.zeilen) * 100)} %`]));

/* ══ Kapitel 6: Patches ═══════════════════════════════════════ */
renderGroupedBars(q('[data-chart="patches"]'), PATCHES.map(([datum, titel, sv, sn, vv, vn]) => ({
  key: `${titel}, ${datumLang(datum)}`,
  label: datum.slice(5).replace('-', '.'),
  a: sv,
  b: sn,
  tip: [
    ['Streams gleichzeitig davor', fmt1(sv), GOLD],
    ['Streams gleichzeitig danach', fmt1(sn), TEAL],
    ['Viewer je Stream davor', fmt1(vv)],
    ['Viewer je Stream danach', fmt1(vn)],
  ],
})), {
  height: 240, nameA: 'Woche davor', nameB: 'Woche danach',
  ariaLabel: 'Gleichzeitig laufende Streams zur besten Sendezeit in der Woche vor und nach jedem Patch',
});
buildTable('patches', ['Patch', 'Datum', 'Streams gleichzeitig davor', 'Streams gleichzeitig danach', 'Viewer je Stream davor', 'Viewer je Stream danach'],
  PATCHES.map(([datum, titel, sv, sn, vv, vn]) => [titel, datumLang(datum), fmt1(sv), fmt1(sn), fmt1(vv), fmt1(vn)]));

/* ══ Kapitel 7: Netzwerk und Rest ═════════════════════════════ */
renderBars(q('[data-chart="beitritte"]'), NETZWERK_BEITRITTE.map(([monat, n]) => ({
  key: monatLang(monat),
  label: monatKurz(monat),
  value: n,
  tip: [['Beitritte in diesem Monat', fmt(n)]],
})), {
  height: 200,
  ariaLabel: 'Beitritte ins Streamer-Netzwerk je Monat',
});
buildTable('beitritte', ['Monat', 'Beitritte'],
  NETZWERK_BEITRITTE.map(([monat, n]) => [monatLang(monat), fmt(n)]));

/* Die Alters-Kennzahlen stehen nicht als Text in der Seite, sondern kommen aus data.js. */
const alterSpan = q('[data-fill="netz-alter"]');
if (alterSpan) {
  alterSpan.textContent = `${NETZWERK_ALTER.unter90Tage} der ${NETZWERK_ALTER.gesamt} Kanäle sind weniger als 90 Tage dabei, `
    + `${NETZWERK_ALTER.unter180Tage} weniger als 180 Tage; im Median sind es ${fmt(NETZWERK_ALTER.medianTage)} Tage.`;
}

renderHBars(q('[data-chart="frequenz"]'), [
  { name: 'Im Netzwerk', sub: `${NETZWERK.imNetz.n} Streamer`, value: NETZWERK.imNetz.sessionsProWoche, display: fmt1(NETZWERK.imNetz.sessionsProWoche), color: GOLD },
  { name: 'Ausserhalb', sub: `${fmt(NETZWERK.ausserhalb.n)} Streamer`, value: NETZWERK.ausserhalb.sessionsProWoche, display: fmt1(NETZWERK.ausserhalb.sessionsProWoche), color: TEAL },
], { unit: ' Streams/Woche' });

renderHBars(q('[data-chart="netz-ueberleben"]'), [
  { name: 'Im Netzwerk', sub: `${NETZWERK.imNetz.bewertbar90} bewertbar`, value: NETZWERK.imNetz.ueberleben90, display: fmt1(NETZWERK.imNetz.ueberleben90), color: GOLD },
  { name: 'Ausserhalb', sub: `${fmt(NETZWERK.ausserhalb.bewertbar90)} bewertbar`, value: NETZWERK.ausserhalb.ueberleben90, display: fmt1(NETZWERK.ausserhalb.ueberleben90), color: TEAL },
], { unit: ' %' });

renderGroupedBars(q('[data-chart="matched"]'), MATCHED.map((p) => ({
  key: `Start ${monatLang(p.monat)}, Größenklasse ${p.bucket}`,
  label: monatKurz(p.monat),
  a: p.netzM3 / p.netzStart,
  b: p.ctrlM3 / p.ctrlStart,
  tip: [
    ['Netzwerk, Faktor nach 3 Monaten', fmt1(p.netzM3 / p.netzStart), GOLD],
    ['Kontrolle, Faktor nach 3 Monaten', fmt1(p.ctrlM3 / p.ctrlStart), TEAL],
    ['Streamer im Paar', `${p.nNetz} zu ${p.nCtrl}`],
  ],
})), {
  height: 230, nameA: 'Netzwerk', nameB: 'Kontrollgruppe',
  ariaLabel: 'Viewer-Wachstum nach drei Monaten, Netzwerk gegen gematchte Kontrollgruppe',
});
buildTable('matched', ['Startmonat', 'Größenklasse', 'Netzwerk Start', 'Netzwerk nach 3 Monaten', 'Kontrolle Start', 'Kontrolle nach 3 Monaten', 'Streamer'],
  MATCHED.map((p) => [monatLang(p.monat), String(p.bucket), fmt1(p.netzStart), fmt1(p.netzM3), fmt1(p.ctrlStart), fmt1(p.ctrlM3), `${p.nNetz} zu ${p.nCtrl}`]));

renderGroupedBars(q('[data-chart="raid-wirkung"]'), RAID_GROESSEN.map((r) => ({
  key: `Raid mit ${r.klasse}`,
  label: r.klasse,
  a: r.raidSchnitt20,
  b: r.kontrollSchnitt20,
  tip: [
    ['Raid, Zuwachs nach 20 Minuten im Schnitt', fmt2(r.raidSchnitt20), GOLD],
    ['Kontrollfenster, Zuwachs im Schnitt', fmt2(r.kontrollSchnitt20), TEAL],
    ['Raid, Zuwachs im Median', fmt2(r.raid20)],
    ['Differenz je Paar, Median', fmt2(r.differenz20)],
    ['Raids in dieser Klasse', fmt(r.n)],
  ],
})), {
  height: 220, nameA: 'Raid', nameB: 'Kontrollfenster ohne Raid',
  ariaLabel: 'Zuschauerzuwachs des Ziels 20 Minuten nach dem Raid, verglichen mit einem Kontrollfenster ohne Raid',
});
buildTable('raids', ['Raid-Größe', 'Raids', 'Zuschauer vorher', 'Gesendet', 'Zuwachs Raid, Median', 'Zuwachs Kontrolle, Median', 'Differenz je Paar, Median', 'Zuwachs Raid, Schnitt', 'Zuwachs Kontrolle, Schnitt'],
  RAID_GROESSEN.map((r) => [r.klasse, fmt(r.n), fmt2(r.basis), fmt(r.gesendet), fmt2(r.raid20), fmt2(r.kontroll20), fmt2(r.differenz20), fmt2(r.raidSchnitt20), fmt2(r.kontrollSchnitt20)]));

buildTable('raid-kennzahlen', ['Kennzahl', 'Raid', 'Kontrollfenster'], [
  ['Zuwachs nach 10 Minuten, Median', fmt2(RAIDS.raidZuwachs10), fmt2(RAIDS.kontrollZuwachs10)],
  ['Differenz je Paar nach 10 Minuten, Median', fmt2(RAIDS.differenz10), ''],
  ['Differenz je Paar nach 20 Minuten, Median', fmt2(RAIDS.differenz20), ''],
  ['Zuwachs nach 20 Minuten, Median', fmt2(RAIDS.raidZuwachs20), fmt2(RAIDS.kontrollZuwachs20)],
  ['Zuwachs nach 20 Minuten, Schnitt', fmt2(RAIDS.raidSchnitt20), fmt2(RAIDS.kontrollSchnitt20)],
  ['Über dem Ausgangswert nach 10 Minuten', `${fmt1(RAIDS.raidUeber10)} %`, `${fmt1(RAIDS.kontrollUeber10)} %`],
  ['Über dem Ausgangswert nach 20 Minuten', `${fmt1(RAIDS.raidUeber20)} %`, `${fmt1(RAIDS.kontrollUeber20)} %`],
  ['Faktor zum Ausgangswert nach 20 Minuten, Median', fmt2(RAIDS.faktor20Raid), fmt2(RAIDS.faktor20Kontroll)],
  ['Faktor zum Ausgangswert nach 20 Minuten, oberes Viertel', fmt2(RAIDS.faktor20RaidP75), fmt2(RAIDS.faktor20KontrollP75)],
]);

renderHBars(q('[data-chart="chatter"]'), [
  { name: 'Stammpublikum', sub: `${fmt(NETZWERK.streams.stammchatter)} Chatter`, value: 100 - NETZWERK.streams.erstchatterPct, display: fmt1(100 - NETZWERK.streams.erstchatterPct), color: GOLD },
  { name: 'Erstbesucher', sub: `${fmt(NETZWERK.streams.erstchatter)} Chatter`, value: NETZWERK.streams.erstchatterPct, display: fmt1(NETZWERK.streams.erstchatterPct), color: TEAL },
], { unit: ' %' });

/* ══ Methodik: Zeilenbilanz ═══════════════════════════════════ */
buildTable('zeilen', ['Schritt', 'Zeilen'], [
  ['Roh erfasst', fmt(METHODIK.zeilenRoh)],
  ['Verworfen, Sprache nicht deutsch', `minus ${fmt(METHODIK.zeilenVerworfenSprache)}`],
  ['Verworfen, Störungstage ohne Sprachlabel', `minus ${fmt(METHODIK.zeilenVerworfenStoerung)}`],
  ['Ausgewertet', fmt(METHODIK.zeilenBehalten)],
]);

/* ── Kennzahlen hochzaehlen, bei reduzierter Bewegung sofort ── */
countUp();

/* Die Jahreszahl im Footer setzt site.js, hier bewusst nicht doppelt. */
