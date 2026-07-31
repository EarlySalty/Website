/**
 * Transparenz-Seite — Daten und Diagramme.
 *
 * Alle Werte sind Momentaufnahmen vom 31.07.2026, erhoben aus der
 * Produktionsdatenbank und dem Git-Verlauf der sieben Projekte.
 * Sie stehen bewusst als Literale hier drin: die Seite ist statisch,
 * hat keine Laufzeit-API und soll auch dann stimmen, wenn kein Dienst läuft.
 * Beim nächsten Stichtag wird dieser Block ersetzt, nicht ergänzt.
 *
 * Diagramm-Regeln (bewusst eng gehalten):
 *  - eine Datenserie pro Diagramm, Gold als einzige Serienfarbe
 *  - Hervorhebung nur über Deckkraft, nie über eine zweite Farbe
 *  - jedes Diagramm hat eine Tabellenansicht für Screenreader
 */

const STAND = '31.07.2026';

/** Neue Mitglieder je Monat. 2024-10 hatte keinen Beitritt. */
const JOINS = [
  ['2024-09', 1], ['2024-10', 0], ['2024-11', 4], ['2024-12', 15],
  ['2025-01', 29], ['2025-02', 26], ['2025-03', 19], ['2025-04', 22],
  ['2025-05', 21], ['2025-06', 23], ['2025-07', 19], ['2025-08', 65],
  ['2025-09', 42], ['2025-10', 477], ['2025-11', 142], ['2025-12', 45],
  ['2026-01', 108], ['2026-02', 622], ['2026-03', 231], ['2026-04', 155],
  ['2026-05', 153], ['2026-06', 123], ['2026-07', 159],
];

/** Sprachkanäle je Monat: [Monat, Sitzungen, Stunden]. Aufzeichnung seit 11/2025. */
const VOICE = [
  ['2025-11', 612, 392], ['2025-12', 3072, 2365], ['2026-01', 3609, 2116],
  ['2026-02', 10667, 3674], ['2026-03', 12328, 5130], ['2026-04', 13446, 4741],
  ['2026-05', 14300, 4184], ['2026-06', 6101, 3408], ['2026-07', 6406, 3997],
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

const GOLD = '#c8a86b';
const MONTHS_SHORT = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

const nf = new Intl.NumberFormat('de-DE');
const fmt = (n) => nf.format(n);

/** "2026-07" → "Jul 26" */
function monthLabel(key) {
  const [y, m] = key.split('-');
  return `${MONTHS_SHORT[Number(m) - 1]} ${y.slice(2)}`;
}

/** "2026-07" → "Juli 2026" (ausgeschrieben, für Tooltip und Tabelle) */
function monthLong(key) {
  const [y, m] = key.split('-');
  const long = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
    'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  return `${long[Number(m) - 1]} ${y}`;
}

/**
 * Achsenskala mit glatten Schritten.
 * Zuerst den Schrittabstand runden, dann die Obergrenze daraus ableiten —
 * andersherum entstehen Ticks wie 1875, die als "2k" beschriftet dann lügen.
 * Liefert { max, step, ticks }.
 */
function niceScale(value, targetTicks = 4) {
  if (value <= 0) return { max: 1, step: 1, ticks: 1 };
  const raw = value / targetTicks;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].find((s) => raw <= s * mag) * mag;
  const max = step * Math.ceil(value / step);
  return { max, step, ticks: Math.round(max / step) };
}

/** Achsenbeschriftung: "2k" nur bei glatten Tausendern, sonst die volle Zahl. */
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
   Balkendiagramm — eine Serie, senkrechte Balken, Hover-Tooltip.
   `rows`: [{ key, label, value, tip: [[Bezeichnung, Wert], …], dim }]
   ──────────────────────────────────────────────────────────────── */
function renderBars(host, rows, opts = {}) {
  const { unit = '', labelEvery = 1, valueOnMax = true } = opts;
  if (!host || !rows.length) return;

  const W = 760;
  const H = opts.height || 260;
  const padL = 42;
  const padR = 8;
  const padT = 18;
  const padB = 30;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const scale = niceScale(Math.max(...rows.map((r) => r.value)));
  const max = scale.max;
  const slot = plotW / rows.length;
  // 2px Abstand zwischen den Balken (Regel: Flächen berühren sich nie).
  const barW = Math.max(6, Math.min(46, slot - 6));

  const svg = svgEl('svg', {
    viewBox: `0 0 ${W} ${H}`,
    role: 'img',
    'aria-label': opts.ariaLabel || 'Balkendiagramm',
    preserveAspectRatio: 'none',
  });
  svg.style.height = `${H}px`;
  svg.style.maxHeight = `${H}px`;
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

  // Rasterlinien + Achsenwerte
  for (let i = 0; i <= scale.ticks; i += 1) {
    const v = scale.step * i;
    const y = padT + plotH - (v / max) * plotH;
    svg.appendChild(svgEl('line', {
      x1: padL, x2: W - padR, y1: y, y2: y, class: 'tp-grid-line',
    }));
    const t = svgEl('text', { x: padL - 8, y: y + 3.5, 'text-anchor': 'end', class: 'tp-axis-label' });
    t.textContent = axisLabel(v);
    svg.appendChild(t);
  }

  const maxIdx = rows.reduce((best, r, i) => (r.value > rows[best].value ? i : best), 0);

  rows.forEach((row, i) => {
    const x = padL + slot * i + (slot - barW) / 2;
    const h = max > 0 ? (row.value / max) * plotH : 0;
    const y = padT + plotH - h;

    // Balken mit abgerundetem Datenende, am Nullpunkt verankert.
    const r = Math.min(4, barW / 2, h);
    const bar = svgEl('path', {
      d: h <= r
        ? `M${x} ${padT + plotH} h${barW} v${-h} h${-barW} Z`
        : `M${x} ${padT + plotH} V${y + r} a${r} ${r} 0 0 1 ${r} ${-r} h${barW - 2 * r} a${r} ${r} 0 0 1 ${r} ${r} V${padT + plotH} Z`,
      fill: GOLD,
      opacity: row.dim ? 0.34 : 0.92,
      class: 'tp-bar',
    });
    bar.dataset.idx = String(i);
    svg.appendChild(bar);

    // Zahl über dem höchsten Balken — sparsam beschriften statt überall.
    if (valueOnMax && i === maxIdx && row.value > 0) {
      const lbl = svgEl('text', {
        x: x + barW / 2, y: y - 7, 'text-anchor': 'middle', class: 'tp-value-label',
      });
      lbl.textContent = fmt(row.value);
      svg.appendChild(lbl);
    }

    // X-Beschriftung, ausgedünnt damit sie sich nicht überlappt.
    if (i % labelEvery === 0 || i === rows.length - 1) {
      const t = svgEl('text', {
        x: x + barW / 2, y: H - 10, 'text-anchor': 'middle', class: 'tp-axis-label',
      });
      t.textContent = row.label;
      svg.appendChild(t);
    }

    // Trefferfläche über die volle Höhe — größer als der Balken selbst.
    const hit = svgEl('rect', {
      x: padL + slot * i, y: padT, width: slot, height: plotH, class: 'tp-bar-hit',
    });
    hit.dataset.idx = String(i);
    svg.appendChild(hit);
  });

  host.appendChild(svg);

  // ── Tooltip ──
  const tip = document.createElement('div');
  tip.className = 'tp-tooltip';
  tip.setAttribute('role', 'status');
  host.appendChild(tip);

  const bars = [...svg.querySelectorAll('.tp-bar')];

  function show(idx, evt) {
    const row = rows[idx];
    if (!row) return;
    const lines = (row.tip || [[opts.valueName || 'Wert', `${fmt(row.value)}${unit}`]])
      .map(([k, v]) => `<div class="tp-tooltip-row"><i style="background:${GOLD}"></i>${k}<b>${v}</b></div>`)
      .join('');
    tip.innerHTML = `<div class="tp-tooltip-key">${row.key}</div>${lines}`;
    tip.classList.add('is-visible');
    host.classList.add('is-hovering');
    bars.forEach((b, i) => b.classList.toggle('is-active', i === idx));

    const box = host.getBoundingClientRect();
    const x = evt.clientX - box.left;
    const w = tip.offsetWidth;
    tip.style.left = `${Math.max(w / 2 + 4, Math.min(box.width - w / 2 - 4, x))}px`;
    tip.style.top = `${Math.max(52, evt.clientY - box.top - 14)}px`;
  }

  function hide() {
    tip.classList.remove('is-visible');
    host.classList.remove('is-hovering');
    bars.forEach((b) => b.classList.remove('is-active'));
  }

  svg.addEventListener('pointermove', (e) => {
    const t = e.target.closest('.tp-bar-hit, .tp-bar');
    if (t) show(Number(t.dataset.idx), e); else hide();
  });
  svg.addEventListener('pointerleave', hide);
}

/* ────────────────────────────────────────────────────────────────
   Tabellenansicht — jedes Diagramm ist auch ohne Farbe lesbar.
   ──────────────────────────────────────────────────────────────── */
function buildTable(name, head, body) {
  const wrap = document.querySelector(`[data-table="${name}"]`);
  if (!wrap) return;
  wrap.innerHTML = `
    <table>
      <thead><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr></thead>
      <tbody>${body.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>
    </table>`;
}

document.querySelectorAll('.tp-table-toggle').forEach((btn) => {
  btn.addEventListener('click', () => {
    const wrap = document.querySelector(`[data-table="${btn.dataset.tableFor}"]`);
    if (!wrap) return;
    const open = wrap.classList.toggle('is-open');
    btn.setAttribute('aria-expanded', String(open));
    btn.textContent = open ? 'Tabelle ausblenden' : 'Als Tabelle anzeigen';
  });
});

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

/* ── Kennzahlen hochzählen ────────────────────────────────────── */
(function countUp() {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const targets = document.querySelectorAll('[data-count]');
  if (reduce || !targets.length) return;

  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      io.unobserve(el);
      const end = Number(el.dataset.count);
      const dur = 1100;
      const t0 = performance.now();
      const tick = (now) => {
        const p = Math.min(1, (now - t0) / dur);
        // Ease-out: schnell anlaufen, sanft ankommen.
        el.textContent = fmt(Math.round(end * (1 - (1 - p) ** 3)));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }, { threshold: 0.5 });

  targets.forEach((t) => io.observe(t));
})();

/* Einblenden beim Scrollen und die Jahreszahl im Footer übernimmt site.js —
   hier bewusst nicht doppelt implementiert. */

export { STAND };
