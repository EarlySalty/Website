/**
 * Diagramme zum Blogpost "Zehn Monate deutsche Deadlock-Streamer auf Twitch".
 *
 * Regeln, bewusst eng gehalten und aus der Transparenz-Seite uebernommen:
 *  - hoechstens zwei Serien pro Diagramm, Gold ist die Hauptserie, Teal die Vergleichsserie
 *  - bei zwei Serien immer eine Legende, damit die Farbe nie das einzige Merkmal ist
 *  - Hervorhebung innerhalb einer Serie nur ueber Deckkraft, nie ueber eine dritte Farbe
 *  - jedes Diagramm hat eine Tabellenansicht, damit es auch ohne Farbe lesbar bleibt
 *  - nie zwei Y-Achsen in einem Bild: unterschiedliche Groessen bekommen eigene Diagramme
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

const GOLD = '#c8a86b';
const TEAL = '#55978f';

const nf = new Intl.NumberFormat('de-DE');
const fmt = (n) => nf.format(n);
const fmt1 = (n) => nf.format(Math.round(n * 10) / 10);
const MONATE_KURZ = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
const MONATE_LANG = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const TAGE = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
const TAGE_KURZ = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

/** "2026-07" oder "2026-07-13" zu "Jul 26" */
function monatKurz(key) {
  const [y, m] = key.split('-');
  return `${MONATE_KURZ[Number(m) - 1]} ${y.slice(2)}`;
}

/** "2026-07" zu "Juli 2026" */
function monatLang(key) {
  const [y, m] = key.split('-');
  return `${MONATE_LANG[Number(m) - 1]} ${y}`;
}

/** "2026-07-13" zu "13. Juli 2026" */
function datumLang(key) {
  const [y, m, d] = key.split('-');
  return `${Number(d)}. ${MONATE_LANG[Number(m) - 1]} ${y}`;
}

/**
 * Achsenskala mit glatten Schritten. Erst den Schrittabstand runden, dann die
 * Obergrenze daraus ableiten, sonst entstehen Ticks, die beschriftet luegen.
 */
function niceScale(value, targetTicks = 4) {
  if (value <= 0) return { max: 1, step: 1, ticks: 1 };
  const raw = value / targetTicks;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].find((s) => raw <= s * mag) * mag;
  const max = step * Math.ceil(value / step);
  return { max, step, ticks: Math.round(max / step) };
}

function axisLabel(v) {
  if (v === 0) return '0';
  if (v >= 1000 && v % 1000 === 0) return `${v / 1000}k`;
  return fmt(v);
}

const svgEl = (name, attrs = {}) => {
  const node = document.createElementNS('http://www.w3.org/2000/svg', name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
};

/* ────────────────────────────────────────────────────────────────
   Tooltip-Schicht. Ein Diagramm im Browser ist interaktiv, also
   bekommt jede Marke einen Hover-Wert. Die Trefferflaeche ist immer
   groesser als die Marke selbst.
   ──────────────────────────────────────────────────────────────── */
function attachTooltip(host, svg, rows, markSelector) {
  const tip = document.createElement('div');
  tip.className = 'bl-tooltip';
  tip.setAttribute('role', 'status');
  host.appendChild(tip);
  const marks = [...svg.querySelectorAll(markSelector)];

  function show(idx, evt) {
    const row = rows[idx];
    if (!row) return;
    const lines = row.tip
      .map(([k, v, c]) => (c
        ? `<div class="bl-tooltip-row"><i style="background:${c}"></i>${k}<b>${v}</b></div>`
        : `<div class="bl-tooltip-row bl-tooltip-row--plain">${k}<b>${v}</b></div>`))
      .join('');
    tip.innerHTML = `<div class="bl-tooltip-key">${row.key}</div>${lines}`;
    tip.classList.add('is-visible');
    host.classList.add('is-hovering');
    marks.forEach((m) => m.classList.toggle('is-active', m.dataset.idx === String(idx)));

    const box = host.getBoundingClientRect();
    const w = tip.offsetWidth;
    tip.style.left = `${Math.max(w / 2 + 4, Math.min(box.width - w / 2 - 4, evt.clientX - box.left))}px`;
    tip.style.top = `${Math.max(60, evt.clientY - box.top - 14)}px`;
  }

  function hide() {
    tip.classList.remove('is-visible');
    host.classList.remove('is-hovering');
    marks.forEach((m) => m.classList.remove('is-active'));
  }

  svg.addEventListener('pointermove', (e) => {
    const t = e.target.closest('[data-idx]');
    if (t) show(Number(t.dataset.idx), e); else hide();
  });
  svg.addEventListener('pointerleave', hide);
}

function chartFrame(host, opts) {
  const W = 760;
  const H = opts.height || 260;
  const padL = opts.padL ?? 44;
  const padR = opts.padR ?? 10;
  const padT = opts.padT ?? 20;
  const padB = opts.padB ?? 30;
  const svg = svgEl('svg', {
    viewBox: `0 0 ${W} ${H}`,
    role: 'img',
    'aria-label': opts.ariaLabel || 'Diagramm',
    preserveAspectRatio: 'xMidYMid meet',
  });
  host.appendChild(svg);
  return { svg, W, H, padL, padR, padT, padB, plotW: W - padL - padR, plotH: H - padT - padB };
}

function drawGrid(f, scale) {
  for (let i = 0; i <= scale.ticks; i += 1) {
    const v = scale.step * i;
    const y = f.padT + f.plotH - (v / scale.max) * f.plotH;
    f.svg.appendChild(svgEl('line', {
      x1: f.padL, x2: f.W - f.padR, y1: y, y2: y, class: 'bl-grid-line',
    }));
    const t = svgEl('text', { x: f.padL - 8, y: y + 3.5, 'text-anchor': 'end', class: 'bl-axis-label' });
    t.textContent = axisLabel(v);
    f.svg.appendChild(t);
  }
}

/* ── Balken, eine Serie ──────────────────────────────────────── */
function renderBars(host, rows, opts = {}) {
  if (!host || !rows.length) return;
  const f = chartFrame(host, opts);
  const scale = niceScale(Math.max(...rows.map((r) => r.value)));
  drawGrid(f, scale);

  const slot = f.plotW / rows.length;
  const barW = Math.max(5, Math.min(opts.maxBarWidth || 46, slot - 6));
  const maxIdx = rows.reduce((best, r, i) => (r.value > rows[best].value ? i : best), 0);

  rows.forEach((row, i) => {
    const x = f.padL + slot * i + (slot - barW) / 2;
    const h = (row.value / scale.max) * f.plotH;
    const y = f.padT + f.plotH - h;
    const r = Math.min(4, barW / 2, h);
    const bar = svgEl('path', {
      d: h <= r
        ? `M${x} ${f.padT + f.plotH} h${barW} v${-h} h${-barW} Z`
        : `M${x} ${f.padT + f.plotH} V${y + r} a${r} ${r} 0 0 1 ${r} ${-r} h${barW - 2 * r} a${r} ${r} 0 0 1 ${r} ${r} V${f.padT + f.plotH} Z`,
      fill: GOLD,
      opacity: row.dim ? 0.34 : 0.92,
      class: 'bl-mark',
    });
    bar.dataset.idx = String(i);
    f.svg.appendChild(bar);

    if (opts.valueOnMax !== false && i === maxIdx) {
      const lbl = svgEl('text', { x: x + barW / 2, y: y - 7, 'text-anchor': 'middle', class: 'bl-value-label' });
      lbl.textContent = fmt(row.value);
      f.svg.appendChild(lbl);
    }
    if (row.label && (i % (opts.labelEvery || 1) === 0 || i === rows.length - 1)) {
      const t = svgEl('text', { x: x + barW / 2, y: f.H - 10, 'text-anchor': 'middle', class: 'bl-axis-label' });
      t.textContent = row.label;
      f.svg.appendChild(t);
    }
    const hit = svgEl('rect', { x: f.padL + slot * i, y: f.padT, width: slot, height: f.plotH, class: 'bl-hit' });
    hit.dataset.idx = String(i);
    f.svg.appendChild(hit);
  });

  attachTooltip(host, f.svg, rows, '.bl-mark');
}

/* ── Balken, zwei Serien nebeneinander ───────────────────────── */
function renderGroupedBars(host, rows, opts = {}) {
  if (!host || !rows.length) return;
  const f = chartFrame(host, opts);
  const scale = niceScale(Math.max(...rows.flatMap((r) => [r.a, r.b])));
  drawGrid(f, scale);

  const slot = f.plotW / rows.length;
  // 2px Luft zwischen den beiden Balken einer Gruppe, damit sich die
  // Flaechen nie beruehren und die Gruppe als Paar lesbar bleibt.
  const barW = Math.max(4, Math.min(20, (slot - 10) / 2));

  rows.forEach((row, i) => {
    const gx = f.padL + slot * i + (slot - (barW * 2 + 2)) / 2;
    [[row.a, GOLD, 0], [row.b, TEAL, barW + 2]].forEach(([value, color, dx]) => {
      const h = (value / scale.max) * f.plotH;
      const y = f.padT + f.plotH - h;
      const r = Math.min(3, barW / 2, h);
      const bar = svgEl('path', {
        d: h <= r
          ? `M${gx + dx} ${f.padT + f.plotH} h${barW} v${-h} h${-barW} Z`
          : `M${gx + dx} ${f.padT + f.plotH} V${y + r} a${r} ${r} 0 0 1 ${r} ${-r} h${barW - 2 * r} a${r} ${r} 0 0 1 ${r} ${r} V${f.padT + f.plotH} Z`,
        fill: color, opacity: 0.92, class: 'bl-mark',
      });
      bar.dataset.idx = String(i);
      f.svg.appendChild(bar);
    });
    if (row.label && (i % (opts.labelEvery || 1) === 0 || i === rows.length - 1)) {
      const t = svgEl('text', { x: gx + barW + 1, y: f.H - 10, 'text-anchor': 'middle', class: 'bl-axis-label' });
      t.textContent = row.label;
      f.svg.appendChild(t);
    }
    const hit = svgEl('rect', { x: f.padL + slot * i, y: f.padT, width: slot, height: f.plotH, class: 'bl-hit' });
    hit.dataset.idx = String(i);
    f.svg.appendChild(hit);
  });

  attachTooltip(host, f.svg, rows, '.bl-mark');
  legend(host, [[opts.nameA, GOLD], [opts.nameB, TEAL]]);
}

/* ── Linie mit Flaeche, eine Serie ───────────────────────────── */
function renderLine(host, rows, opts = {}) {
  if (!host || !rows.length) return;
  const f = chartFrame(host, opts);
  const scale = niceScale(Math.max(...rows.map((r) => r.value)));
  drawGrid(f, scale);

  const x = (i) => f.padL + (f.plotW / Math.max(1, rows.length - 1)) * i;
  const y = (v) => f.padT + f.plotH - (v / scale.max) * f.plotH;
  const d = rows.map((r, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(r.value).toFixed(1)}`).join(' ');

  const gradId = `bl-grad-${Math.random().toString(36).slice(2, 8)}`;
  const defs = svgEl('defs');
  const grad = svgEl('linearGradient', { id: gradId, x1: 0, y1: 0, x2: 0, y2: 1 });
  grad.appendChild(svgEl('stop', { offset: '0%', 'stop-color': GOLD, 'stop-opacity': 0.3 }));
  grad.appendChild(svgEl('stop', { offset: '100%', 'stop-color': GOLD, 'stop-opacity': 0 }));
  defs.appendChild(grad);
  f.svg.appendChild(defs);

  f.svg.appendChild(svgEl('path', {
    d: `${d} L${x(rows.length - 1)} ${f.padT + f.plotH} L${f.padL} ${f.padT + f.plotH} Z`,
    fill: `url(#${gradId})`, stroke: 'none',
  }));
  f.svg.appendChild(svgEl('path', {
    d, fill: 'none', stroke: GOLD, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round',
  }));

  rows.forEach((row, i) => {
    const dot = svgEl('circle', { cx: x(i), cy: y(row.value), r: 3.2, fill: GOLD, class: 'bl-mark bl-dot' });
    dot.dataset.idx = String(i);
    f.svg.appendChild(dot);
    if (row.label && (i % (opts.labelEvery || 1) === 0)) {
      const t = svgEl('text', { x: x(i), y: f.H - 10, 'text-anchor': 'middle', class: 'bl-axis-label' });
      t.textContent = row.label;
      f.svg.appendChild(t);
    }
    const hit = svgEl('rect', {
      x: x(i) - f.plotW / rows.length / 2, y: f.padT,
      width: f.plotW / rows.length, height: f.plotH, class: 'bl-hit',
    });
    hit.dataset.idx = String(i);
    f.svg.appendChild(hit);
  });

  attachTooltip(host, f.svg, rows, '.bl-mark');
}

/* ── Waagerechte Balken, eine Serie, immer direkt beschriftet ── */
function renderHBars(host, rows, opts = {}) {
  if (!host || !rows.length) return;
  const max = Math.max(...rows.map((r) => r.value));
  host.innerHTML = rows.map((row) => `
    <div class="bl-hbar">
      <span class="bl-hbar-name">${row.name}${row.sub ? `<small>${row.sub}</small>` : ''}</span>
      <span class="bl-hbar-track">
        <span class="bl-hbar-fill" style="width:${(row.value / max) * 100}%;background:${row.color || GOLD}"></span>
      </span>
      <span class="bl-hbar-val">${row.display ?? fmt(row.value)}${opts.unit || ''}</span>
    </div>`).join('');
}

/* ── Heatmap Wochentag mal Stunde ────────────────────────────── */
function renderHeatmap(host, matrix) {
  if (!host) return;
  const max = Math.max(...matrix.flat());
  // Sequenzielle Skala: ein Farbton, sechs Stufen. Die leerste Stufe ist
  // bewusst neutral statt goldgetoent, damit "fast nichts" nicht wie
  // "ein bisschen" aussieht.
  const stufe = (v) => {
    const p = v / max;
    if (p < 0.05) return 'rgba(242,238,230,0.05)';
    if (p < 0.15) return 'rgba(201,168,106,0.22)';
    if (p < 0.3) return 'rgba(201,168,106,0.4)';
    if (p < 0.5) return 'rgba(210,180,116,0.6)';
    if (p < 0.75) return 'rgba(224,197,138,0.82)';
    return '#efd49d';
  };

  const kopf = `<div class="bl-heat-row bl-heat-row--head"><span></span>${
    Array.from({ length: 24 }, (_, h) => `<span class="bl-heat-col-label">${h % 3 === 0 ? h : ''}</span>`).join('')
  }</div>`;

  // Die Zellen sind bewusst nicht einzeln anspringbar: 168 Fokusstopps waeren
  // per Tastatur unbenutzbar, der Inhalt steht vollstaendig in der Tabelle.
  const zeilen = matrix.map((row, wd) => {
    const zellen = row.map((v, h) => {
      const titel = `${TAGE[wd]}, ${String(h).padStart(2, '0')} bis ${String(h).padStart(2, '0')}:59 Uhr: ${fmt(v)} Snapshots`;
      return `<span class="bl-heat-cell" style="background:${stufe(v)}" title="${titel}"></span>`;
    }).join('');
    return `<div class="bl-heat-row"><span class="bl-heat-row-label">${TAGE_KURZ[wd]}</span>${zellen}</div>`;
  }).join('');

  const legende = `<div class="bl-heat-legend"><span>weniger</span>${
    [0, 0.1, 0.22, 0.4, 0.6, 1].map((p) => `<i style="background:${stufe(p * max)}"></i>`).join('')
  }<span>mehr</span></div>`;

  host.innerHTML = `<div role="img" aria-label="Raster der Sendezeit nach Wochentag und Stunde; die Werte stehen in der Tabelle darunter">${kopf}${zeilen}</div>${legende}`;
}

/* ── Legende und Tabellen ────────────────────────────────────── */
function legend(host, entries) {
  const box = document.createElement('div');
  box.className = 'bl-legend';
  box.innerHTML = entries.map(([label, color]) => `<span><i style="background:${color}"></i>${label}</span>`).join('');
  host.parentElement.insertBefore(box, host.nextSibling);
}

function buildTable(name, head, body) {
  const wrap = document.querySelector(`[data-table="${name}"]`);
  if (!wrap) return;
  wrap.innerHTML = `
    <table>
      <thead><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr></thead>
      <tbody>${body.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>
    </table>`;
}

document.querySelectorAll('.bl-table-toggle').forEach((btn) => {
  btn.addEventListener('click', () => {
    const wrap = document.querySelector(`[data-table="${btn.dataset.tableFor}"]`);
    if (!wrap) return;
    const open = wrap.classList.toggle('is-open');
    btn.setAttribute('aria-expanded', String(open));
    btn.textContent = open ? 'Tabelle ausblenden' : 'Als Tabelle anzeigen';
  });
});

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
renderHeatmap(q('[data-heat="zeit"]'), HEATMAP);
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

renderHBars(q('[data-chart="raid-halb"]'), RAID_GROESSEN.map((r) => ({
  name: r.klasse,
  sub: `${fmt(r.n)} Raids`,
  value: r.halb20,
  display: fmt1(r.halb20),
  color: GOLD,
})), { unit: ' %' });
buildTable('raids', ['Raid-Größe', 'Raids', 'Zuschauer vorher', 'Gesendet', 'Zuwachs nach 10 Minuten', 'Zuwachs nach 20 Minuten', 'Mindestens die Hälfte nach 10 Minuten', 'Mindestens die Hälfte nach 20 Minuten'],
  RAID_GROESSEN.map((r) => [r.klasse, fmt(r.n), fmt1(r.basis), fmt1(r.gesendet), fmt1(r.zuwachs10), fmt1(r.zuwachs20), `${fmt1(r.halb10)} %`, `${fmt1(r.halb20)} %`]));

/* ══ Methodik: Zeilenbilanz ═══════════════════════════════════ */
buildTable('zeilen', ['Schritt', 'Zeilen'], [
  ['Roh erfasst', fmt(METHODIK.zeilenRoh)],
  ['Verworfen, Sprache nicht deutsch', `minus ${fmt(METHODIK.zeilenVerworfenSprache)}`],
  ['Verworfen, Störungstage ohne Sprachlabel', `minus ${fmt(METHODIK.zeilenVerworfenStoerung)}`],
  ['Ausgewertet', fmt(METHODIK.zeilenBehalten)],
]);

/* ── Kennzahlen hochzaehlen, bei reduzierter Bewegung sofort ── */
(function countUp() {
  const targets = document.querySelectorAll('[data-count]');
  if (!targets.length) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      io.unobserve(el);
      const end = Number(el.dataset.count);
      const nachkomma = Number(el.dataset.decimals || 0);
      const t0 = performance.now();
      const tick = (now) => {
        const p = Math.min(1, (now - t0) / 1100);
        const v = end * (1 - (1 - p) ** 3);
        el.textContent = nachkomma
          ? v.toFixed(nachkomma).replace('.', ',')
          : fmt(Math.round(v));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }, { threshold: 0.5 });
  targets.forEach((t) => io.observe(t));
})();

/* Die Jahreszahl im Footer setzt site.js, hier bewusst nicht doppelt. */
export { GOLD, TEAL };
