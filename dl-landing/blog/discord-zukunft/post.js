/**
 * Diagramme und Zahlenfüllung für den Discord-Brief.
 * Zeichenfunktionen kommen aus src/charts.js, Zahlen aus data.js.
 */

import { JOINS, VOICE, REPOS, NUM } from './data.js';

import {
  GOLD, fmt,
  monatKurz, monatLang,
  buildTable, wireTableToggles, countUp,
  createCharts,
} from '../../src/charts.js';

const { renderBars } = createCharts({
  prefix: 'bl',
  tooltipRow: (k, v) => `<div class="bl-tooltip-row"><i style="background:${GOLD}"></i>${k}<b>${v}</b></div>`,
});

wireTableToggles('bl');

const q = (sel) => document.querySelector(sel);

function fill() {
  document.querySelectorAll('[data-fill]').forEach((el) => {
    const key = el.getAttribute('data-fill');
    const val = NUM[key];
    if (val == null) return;
    el.textContent = typeof val === 'number' ? fmt(val) : String(val);
  });
}

fill();
countUp();

renderBars(
  q('[data-chart="joins"]'),
  JOINS.map(([k, v]) => ({
    key: monatLang(k),
    label: monatKurz(k),
    value: v,
    tip: [['Neue Mitglieder', fmt(v)]],
  })),
  { labelEvery: 3, ariaLabel: 'Bereinigte neue Mitglieder je Monat, die am 30. August 2026 noch auf dem Server sind', valueName: 'Beitritte' },
);
buildTable('joins', ['Monat', 'Neue Mitglieder'], JOINS.map(([k, v]) => [monatLang(k), fmt(v)]));

renderBars(
  q('[data-chart="voice"]'),
  VOICE.map(([k, sessions, hours]) => ({
    key: monatLang(k),
    label: monatKurz(k),
    value: hours,
    tip: [['Stunden', fmt(hours)], ['Sitzungen', fmt(sessions)]],
  })),
  { labelEvery: 1, ariaLabel: 'Stunden in Sprachkanälen je Monat seit November 2025', valueName: 'Stunden' },
);
buildTable(
  'voice',
  ['Monat', 'Stunden', 'Sitzungen'],
  VOICE.map(([k, s, h]) => [monatLang(k), fmt(h), fmt(s)]),
);

renderBars(
  q('[data-chart="commits"]'),
  REPOS.map(([name, total, august]) => ({
    key: name,
    label: name.replace('Deadlock-', '').replace('-Bot', '').replace('Patchnotes', 'Patch'),
    value: total,
    tip: [['Änderungen gesamt', fmt(total)], ['davon August 2026', fmt(august)]],
  })),
  { labelEvery: 1, ariaLabel: 'Ausgelieferte Code-Änderungen je Projekt auf dem Hauptzweig', valueName: 'Änderungen' },
);
buildTable(
  'commits',
  ['Projekt', 'Änderungen', 'August 2026'],
  REPOS.map(([n, t, a]) => [n, fmt(t), fmt(a)]),
);
