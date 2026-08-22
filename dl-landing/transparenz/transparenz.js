/**
 * Transparenz-Seite — Daten und Diagramme.
 *
 * Alle Werte sind Momentaufnahmen vom 31.07.2026, erhoben aus der
 * Produktionsdatenbank und dem Git-Verlauf der sieben Projekte.
 * Sie stehen bewusst als Literale hier drin: die Seite ist statisch,
 * hat keine Laufzeit-API und soll auch dann stimmen, wenn kein Dienst läuft.
 * Beim nächsten Stichtag wird dieser Block ersetzt, nicht ergänzt.
 *
 * Gezeichnet wird mit den geteilten Bausteinen aus src/charts.js; die
 * Diagramm-Regeln stehen dort.
 */

const STAND = '31.07.2026';

/**
 * Alle Mitgliederzahlen sind um Bot-Zuflüsse bereinigt. Ausgeschlossen sind
 * 846 Konten: die 424 mit der Rolle "Bot Acc" plus alle Beitritte an den fünf
 * Tagen, an denen die Kurve senkrecht stand (24./25./28.10.2025, 25.11.2025,
 * 21.02.2026). An diesen Tagen kamen bis zu 50 Konten pro Minute herein und
 * 2,0 % von ihnen haben je etwas getan; an jedem anderen Tag sind es 84,4 %.
 * Details und Gegenprobe stehen im Methodik-Kapitel der Seite.
 */
const JOINS = [
  ['2024-09', 1], ['2024-10', 0], ['2024-11', 4], ['2024-12', 15],
  ['2025-01', 29], ['2025-02', 25], ['2025-03', 19], ['2025-04', 21],
  ['2025-05', 21], ['2025-06', 23], ['2025-07', 19], ['2025-08', 65],
  ['2025-09', 41], ['2025-10', 45], ['2025-11', 37], ['2025-12', 44],
  ['2026-01', 104], ['2026-02', 298], ['2026-03', 221], ['2026-04', 150],
  ['2026-05', 147], ['2026-06', 113], ['2026-07', 144],
];

/** Sprachkanäle je Monat: [Monat, Sitzungen, Stunden]. Aufzeichnung seit 11/2025. */
const VOICE = [
  ['2025-11', 607, 389], ['2025-12', 3044, 2359], ['2026-01', 3605, 2115],
  ['2026-02', 10587, 3651], ['2026-03', 12314, 5128], ['2026-04', 13437, 4740],
  ['2026-05', 14295, 4184], ['2026-06', 6100, 3408], ['2026-07', 6394, 3999],
];

/** Ausgelieferte Code-Änderungen je Monat, alle sieben Projekte, Hauptzweig. */
const COMMITS = [
  ['2025-08', 20], ['2025-09', 202], ['2025-10', 448], ['2025-11', 101],
  ['2025-12', 60], ['2026-01', 165], ['2026-02', 534], ['2026-03', 346],
  ['2026-04', 477], ['2026-05', 384], ['2026-06', 1749], ['2026-07', 2064],
];

/** Code-Änderungen nach Tagesstunde, Index 0 = 00 Uhr. */
const HOURS = [
  300, 460, 316, 344, 413, 193, 186, 148, 158, 160, 181, 183,
  232, 258, 309, 280, 263, 279, 306, 400, 319, 282, 322, 258,
];

/**
 * Geschätzte Arbeitszeit je Monat, in Stunden.
 *
 * Verfahren: Commits werden zu Sitzungen gruppiert (Lücke über zwei Stunden
 * beendet eine Sitzung). Gezählt wird die Spanne vom ersten bis zum letzten
 * Commit einer Sitzung plus 30 Minuten Vorlauf fürs Einarbeiten. Das ist die
 * konservative Variante: Denken, Lesen, Testen und Deployen ohne Commit
 * fallen komplett raus, ebenso alles, was nie im Code landet — Discord-Support,
 * Moderation, Absprachen. Die Schätzung liegt damit eher zu niedrig.
 */
const WORK_MONTHS = [
  ['2025-08', 5], ['2025-09', 70], ['2025-10', 109], ['2025-11', 42],
  ['2025-12', 23], ['2026-01', 54], ['2026-02', 161], ['2026-03', 128],
  ['2026-04', 102], ['2026-05', 78], ['2026-06', 288], ['2026-07', 317],
];

/** Dieselbe Schätzung, aufgeteilt nach Projekt — zeigt, was parallel lief. */
const WORK_GRID = [
  ['Discord-Bots', [5, 62, 108, 40, 23, 53, 144, 22, 28, 23, 60, 127]],
  ['Twitch-Bot', [0, 0, 0, 0, 0, 0, 12, 77, 45, 41, 170, 98]],
  ['Steam-Bot', [0, 0, 0, 0, 0, 0, 4, 16, 9, 3, 25, 23]],
  ['Website', [0, 2, 1, 0, 0, 0, 0, 1, 11, 5, 8, 31]],
  ['Turniere', [0, 0, 0, 0, 0, 0, 0, 8, 9, 4, 5, 22]],
  ['Deadlock-Brain', [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 17, 13]],
  ['Patchnotes-Bot', [0, 6, 0, 2, 0, 1, 1, 4, 2, 2, 2, 4]],
];

/** Je Projekt: [Name, gesamt, davon im Juli]. Summen ergeben COMMITS. */
const REPOS = [
  ['Discord-Bots', 2838, 752],
  ['Twitch-Bot', 2468, 672],
  ['Steam-Bot', 449, 156],
  ['Website', 325, 213],
  ['Turniere', 235, 149],
  ['Deadlock-Brain', 140, 94],
  ['Patchnotes-Bot', 95, 28],
];

import {
  GOLD, fmt,
  monatKurz as monthLabel, monatLang as monthLong,
  buildTable, wireTableToggles, countUp,
  createCharts,
} from '../src/charts.js';

/*
 * Die Zeichenfunktionen liegen zentral in src/charts.js. Die Werte hier sind
 * die Masse und Klassennamen, mit denen diese Seite schon immer gezeichnet
 * wurde, damit sich am Bild nichts aendert.
 */
const { renderBars } = createCharts({
  prefix: 'tp',
  markClass: 'tp-bar',
  hitClass: 'tp-bar-hit',
  pad: { l: 42, r: 8, t: 18, b: 30 },
  minBarWidth: 6,
  maxBarWidth: 46,
  tooltipMinTop: 52,
  ariaFallback: 'Balkendiagramm',
  fixedSvgHeight: true,
  renderEmptyLabels: true,
  // Eine Serie, eine Farbe: jede Tooltip-Zeile traegt denselben goldenen Punkt.
  tooltipRow: (k, v) => `<div class="tp-tooltip-row"><i style="background:${GOLD}"></i>${k}<b>${v}</b></div>`,
});

wireTableToggles('tp');

/* ── Beitritte ────────────────────────────────────────────────── */
renderBars(
  document.querySelector('[data-chart="joins"]'),
  JOINS.map(([k, v]) => ({
    key: monthLong(k),
    label: monthLabel(k),
    value: v,
    tip: [['Neue Mitglieder', fmt(v)]],
  })),
  { labelEvery: 3, ariaLabel: 'Neue Mitglieder je Monat seit September 2024', valueName: 'Beitritte' },
);
buildTable('joins', ['Monat', 'Neue Mitglieder'], JOINS.map(([k, v]) => [monthLong(k), fmt(v)]));

/* ── Sprachzeit ───────────────────────────────────────────────── */
renderBars(
  document.querySelector('[data-chart="voice"]'),
  VOICE.map(([k, sessions, hours]) => ({
    key: monthLong(k),
    label: monthLabel(k),
    value: hours,
    tip: [['Stunden', fmt(hours)], ['Sitzungen', fmt(sessions)]],
  })),
  { labelEvery: 1, ariaLabel: 'Stunden in Sprachkanälen je Monat', valueName: 'Stunden' },
);
buildTable(
  'voice',
  ['Monat', 'Stunden', 'Sitzungen'],
  VOICE.map(([k, s, h]) => [monthLong(k), fmt(h), fmt(s)]),
);

/* ── Code-Änderungen ──────────────────────────────────────────── */
renderBars(
  document.querySelector('[data-chart="commits"]'),
  COMMITS.map(([k, v]) => ({
    key: monthLong(k),
    label: monthLabel(k),
    value: v,
    tip: [['Änderungen', fmt(v)]],
  })),
  { labelEvery: 1, ariaLabel: 'Ausgelieferte Code-Änderungen je Monat', valueName: 'Änderungen' },
);
buildTable('commits', ['Monat', 'Code-Änderungen'], COMMITS.map(([k, v]) => [monthLong(k), fmt(v)]));

/* ── Tageszeit ────────────────────────────────────────────────── */
renderBars(
  document.querySelector('[data-chart="hours"]'),
  HOURS.map((v, h) => ({
    key: `${String(h).padStart(2, '0')}:00 – ${String(h).padStart(2, '0')}:59 Uhr`,
    label: h % 6 === 0 ? `${String(h).padStart(2, '0')}h` : '',
    value: v,
    // Tagstunden gedimmt: die Nacht ist die Aussage, nicht eine zweite Kategorie.
    dim: h >= 6,
    tip: [['Änderungen', fmt(v)]],
  })),
  { labelEvery: 1, height: 210, valueOnMax: false, ariaLabel: 'Code-Änderungen nach Tageszeit', valueName: 'Änderungen' },
);

/* ── Arbeitszeit je Monat ─────────────────────────────────────── */
renderBars(
  document.querySelector('[data-chart="work"]'),
  WORK_MONTHS.map(([k, v]) => ({
    key: monthLong(k),
    label: monthLabel(k),
    value: v,
    tip: [['Geschätzte Arbeitszeit', `${fmt(v)} h`], ['Das sind', `${(v / 4.33).toFixed(0)} h pro Woche`]],
  })),
  { labelEvery: 1, ariaLabel: 'Geschätzte Arbeitszeit je Monat in Stunden', valueName: 'Stunden' },
);
buildTable(
  'work',
  ['Monat', 'Stunden', 'pro Woche'],
  WORK_MONTHS.map(([k, v]) => [monthLong(k), fmt(v), `${(v / 4.33).toFixed(0)} h`]),
);

/* ────────────────────────────────────────────────────────────────
   Arbeitszeit-Raster: Projekt × Monat.
   Sequenzielle Skala — eine Farbe, sechs Stufen von leer bis intensiv.
   Bewusst keine zweite Farbe: hier zählt Menge, nicht Zugehörigkeit.
   ──────────────────────────────────────────────────────────────── */
(function renderGrid() {
  const host = document.querySelector('[data-grid="work"]');
  if (!host) return;

  const months = WORK_MONTHS.map(([k]) => k);
  // Leere Zellen bewusst neutral statt goldgetönt — sonst liest sich
  // "kein Monat gearbeitet" wie "ein bisschen gearbeitet".
  const stufen = [
    { ab: 0, farbe: 'rgba(242,238,230,0.045)', text: 'keine Arbeit' },
    { ab: 1, farbe: 'rgba(201,168,106,0.26)', text: 'bis 15 h' },
    { ab: 16, farbe: 'rgba(201,168,106,0.45)', text: '16–40 h' },
    { ab: 41, farbe: 'rgba(210,180,116,0.65)', text: '41–80 h' },
    { ab: 81, farbe: 'rgba(224,197,138,0.85)', text: '81–130 h' },
    { ab: 131, farbe: '#efd49d', text: 'über 130 h' },
  ];
  const stufeVon = (v) => stufen.filter((s) => v >= s.ab).pop();

  const kopf = `<div class="tp-grid-row tp-grid-row--head"><span></span>${
    months.map((m) => `<span class="tp-grid-col-label">${monthLabel(m).split(' ')[0]}</span>`).join('')
  }</div>`;

  // Die Zellen sind bewusst nicht einzeln anspringbar — 84 Fokusstopps wären
  // per Tastatur unbenutzbar. Der Inhalt steht vollständig in der Tabelle darunter.
  const zeilen = WORK_GRID.map(([name, werte]) => {
    const summe = werte.reduce((a, b) => a + b, 0);
    const zellen = werte.map((v, i) => {
      const s = stufeVon(v);
      const titel = v === 0
        ? `${name}, ${monthLong(months[i])}: keine Arbeit`
        : `${name}, ${monthLong(months[i])}: rund ${fmt(v)} Stunden`;
      return `<span class="tp-grid-cell" style="background:${s.farbe}" title="${titel}"></span>`;
    }).join('');
    return `<div class="tp-grid-row"><span class="tp-grid-row-label">${name}<small>${fmt(summe)} h</small></span>${zellen}</div>`;
  }).join('');

  const legende = `<div class="tp-grid-legend"><span>weniger</span>${
    stufen.map((s) => `<i style="background:${s.farbe}" title="${s.text}"></i>`).join('')
  }<span>mehr</span></div>`;

  host.innerHTML = `<div role="img" aria-label="Raster der Arbeitszeit je Projekt und Monat; die Werte stehen in der Tabelle darunter">${kopf}${zeilen}</div>${legende}`;

  buildTable(
    'grid',
    ['Projekt', ...months.map(monthLabel), 'Summe'],
    WORK_GRID.map(([name, werte]) => [
      name,
      ...werte.map((v) => (v === 0 ? '–' : fmt(v))),
      fmt(werte.reduce((a, b) => a + b, 0)),
    ]),
  );
})();

/* ── Projekt-Ranking ──────────────────────────────────────────── */
(function renderRanks() {
  const host = document.querySelector('[data-ranks="repos"]');
  if (!host) return;
  const max = Math.max(...REPOS.map(([, total]) => total));

  REPOS.forEach(([name, total, july]) => {
    const row = document.createElement('div');
    row.className = 'tp-rank';
    row.innerHTML = `
      <span class="tp-rank-name">${name}</span>
      <span class="tp-rank-track"><span class="tp-rank-fill" style="width:${(total / max) * 100}%"></span></span>
      <span class="tp-rank-val">${fmt(total)}<small>${fmt(july)} im Juli</small></span>`;
    host.appendChild(row);
  });

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    host.querySelectorAll('.tp-rank').forEach((r) => r.classList.add('is-filled'));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e, i) => {
      if (!e.isIntersecting) return;
      setTimeout(() => e.target.classList.add('is-filled'), i * 70);
      io.unobserve(e.target);
    });
  }, { threshold: 0.3 });
  host.querySelectorAll('.tp-rank').forEach((r) => io.observe(r));
})();

/* ── Kennzahlen hochzählen ──────────────────────────────────── */
countUp();

/* Einblenden beim Scrollen und die Jahreszahl im Footer übernimmt site.js —
   hier bewusst nicht doppelt implementiert. */

export { STAND };
