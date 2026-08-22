/**
 * Geteilte Diagramm-Bausteine der Site.
 *
 * Vorher lagen dieselben Funktionen (niceScale, axisLabel, svgEl, fmt,
 * buildTable, renderBars) doppelt in transparenz/transparenz.js und in
 * blog/twitch-szene-2026/post.js. Sie stehen jetzt einmal hier und werden
 * ueber createCharts() an die Klassennamen und Masse der jeweiligen Seite
 * angepasst. Das Ergebnis im DOM ist bewusst identisch zu vorher.
 *
 * Diagramm-Regeln, bewusst eng gehalten:
 *  - hoechstens zwei Serien pro Diagramm, Gold ist die Hauptserie, Teal die Vergleichsserie
 *  - bei zwei Serien immer eine Legende, damit die Farbe nie das einzige Merkmal ist
 *  - Hervorhebung innerhalb einer Serie nur ueber Deckkraft, nie ueber eine dritte Farbe
 *  - jedes Diagramm hat eine Tabellenansicht, damit es auch ohne Farbe lesbar bleibt
 *  - nie zwei Y-Achsen in einem Bild: unterschiedliche Groessen bekommen eigene Diagramme
 */

export const GOLD = '#c8a86b';
export const TEAL = '#55978f';

const nf = new Intl.NumberFormat('de-DE');

/** Ganze Zahl im deutschen Format. */
export const fmt = (n) => nf.format(n);

/** Eine Nachkommastelle, kaufmaennisch gerundet. */
export const fmt1 = (n) => nf.format(Math.round(n * 10) / 10);

export const MONATE_KURZ = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
export const MONATE_LANG = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
export const TAGE = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
export const TAGE_KURZ = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

/** "2026-07" oder "2026-07-13" zu "Jul 26" */
export function monatKurz(key) {
  const [y, m] = key.split('-');
  return `${MONATE_KURZ[Number(m) - 1]} ${y.slice(2)}`;
}

/** "2026-07" zu "Juli 2026" */
export function monatLang(key) {
  const [y, m] = key.split('-');
  return `${MONATE_LANG[Number(m) - 1]} ${y}`;
}

/** "2026-07-13" zu "13. Juli 2026" */
export function datumLang(key) {
  const [y, m, d] = key.split('-');
  return `${Number(d)}. ${MONATE_LANG[Number(m) - 1]} ${y}`;
}

/**
 * Achsenskala mit glatten Schritten. Erst den Schrittabstand runden, dann die
 * Obergrenze daraus ableiten, sonst entstehen Ticks wie 1875, die als "2k"
 * beschriftet dann luegen. Liefert { max, step, ticks }.
 */
export function niceScale(value, targetTicks = 4) {
  if (value <= 0) return { max: 1, step: 1, ticks: 1 };
  const raw = value / targetTicks;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].find((s) => raw <= s * mag) * mag;
  const max = step * Math.ceil(value / step);
  return { max, step, ticks: Math.round(max / step) };
}

/** Achsenbeschriftung: "2k" nur bei glatten Tausendern, sonst die volle Zahl. */
export function axisLabel(v) {
  if (v === 0) return '0';
  if (v >= 1000 && v % 1000 === 0) return `${v / 1000}k`;
  return fmt(v);
}

/**
 * Text fuer den Einbau in innerHTML entschaerfen. Gedacht fuer Beschriftungen,
 * die aus einer Datendatei kommen und nicht im Repo stehen.
 */
export function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (z) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[z]);
}

export const svgEl = (name, attrs = {}) => {
  const node = document.createElementNS('http://www.w3.org/2000/svg', name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
};

/**
 * Tabellenansicht. Jedes Diagramm ist auch ohne Farbe und ohne Maus lesbar.
 */
export function buildTable(name, head, body, root = document) {
  const wrap = root.querySelector(`[data-table="${name}"]`);
  if (!wrap) return;
  wrap.innerHTML = `
    <table>
      <thead><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr></thead>
      <tbody>${body.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>
    </table>`;
}

/** Verdrahtet die "Als Tabelle anzeigen"-Schalter einer Seite. */
export function wireTableToggles(prefix, root = document) {
  root.querySelectorAll(`.${prefix}-table-toggle`).forEach((btn) => {
    btn.addEventListener('click', () => {
      const wrap = root.querySelector(`[data-table="${btn.dataset.tableFor}"]`);
      if (!wrap) return;
      const open = wrap.classList.toggle('is-open');
      btn.setAttribute('aria-expanded', String(open));
      btn.textContent = open ? 'Tabelle ausblenden' : 'Als Tabelle anzeigen';
    });
  });
}

/**
 * Zaehlt [data-count]-Kennzahlen beim Einscrollen hoch. Bei reduzierter
 * Bewegung passiert nichts, der Endwert steht dann schon im HTML.
 */
export function countUp(root = document) {
  const targets = root.querySelectorAll('[data-count]');
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
        // Ease-out: schnell anlaufen, sanft ankommen.
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
}

/**
 * Baut die Zeichenfunktionen fuer eine Seite.
 *
 * `prefix` bestimmt die CSS-Klassen (bl, tp, sz). Die uebrigen Felder gibt es
 * nur, weil die beiden Bestandsseiten sich in Kleinigkeiten unterscheiden und
 * ihr bisheriges Aussehen behalten sollen.
 */
export function createCharts(config = {}) {
  const cfg = {
    prefix: 'bl',
    pad: { l: 44, r: 10, t: 20, b: 30 },
    minBarWidth: 5,
    maxBarWidth: 46,
    tooltipMinTop: 60,
    ariaFallback: 'Diagramm',
    fixedSvgHeight: false,
    renderEmptyLabels: false,
    ...config,
  };
  const p = cfg.prefix;
  const markClass = cfg.markClass || `${p}-mark`;
  const hitClass = cfg.hitClass || `${p}-hit`;

  const tooltipRow = cfg.tooltipRow || ((k, v, c) => (c
    ? `<div class="${p}-tooltip-row"><i style="background:${c}"></i>${k}<b>${v}</b></div>`
    : `<div class="${p}-tooltip-row ${p}-tooltip-row--plain">${k}<b>${v}</b></div>`));

  const defaultTip = cfg.defaultTip
    || ((row, opts) => [[opts.valueName || 'Wert', `${fmt(row.value)}${opts.unit || ''}`]]);

  /* ──────────────────────────────────────────────────────────────
     Tooltip-Schicht. Ein Diagramm im Browser ist interaktiv, also
     bekommt jede Marke einen Hover-Wert. Die Trefferflaeche ist immer
     groesser als die Marke selbst.
     ────────────────────────────────────────────────────────────── */
  function attachTooltip(host, svg, rows, opts = {}) {
    const tip = document.createElement('div');
    tip.className = `${p}-tooltip`;
    tip.setAttribute('role', 'status');
    host.appendChild(tip);
    const marks = [...svg.querySelectorAll(`.${markClass}`)];

    function show(idx, evt) {
      const row = rows[idx];
      if (!row) return;
      const lines = (row.tip || defaultTip(row, opts))
        .map(([k, v, c]) => tooltipRow(k, v, c))
        .join('');
      tip.innerHTML = `<div class="${p}-tooltip-key">${row.key}</div>${lines}`;
      tip.classList.add('is-visible');
      host.classList.add('is-hovering');
      marks.forEach((m) => m.classList.toggle('is-active', m.dataset.idx === String(idx)));

      const box = host.getBoundingClientRect();
      const w = tip.offsetWidth;
      tip.style.left = `${Math.max(w / 2 + 4, Math.min(box.width - w / 2 - 4, evt.clientX - box.left))}px`;
      tip.style.top = `${Math.max(cfg.tooltipMinTop, evt.clientY - box.top - 14)}px`;
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
    const padL = opts.padL ?? cfg.pad.l;
    const padR = opts.padR ?? cfg.pad.r;
    const padT = opts.padT ?? cfg.pad.t;
    const padB = opts.padB ?? cfg.pad.b;
    const svg = svgEl('svg', {
      viewBox: `0 0 ${W} ${H}`,
      role: 'img',
      'aria-label': opts.ariaLabel || cfg.ariaFallback,
      preserveAspectRatio: 'xMidYMid meet',
    });
    if (cfg.fixedSvgHeight) {
      svg.style.height = `${H}px`;
      svg.style.maxHeight = `${H}px`;
    }
    host.appendChild(svg);
    return { svg, W, H, padL, padR, padT, padB, plotW: W - padL - padR, plotH: H - padT - padB };
  }

  function drawGrid(f, scale) {
    for (let i = 0; i <= scale.ticks; i += 1) {
      const v = scale.step * i;
      const y = f.padT + f.plotH - (v / scale.max) * f.plotH;
      f.svg.appendChild(svgEl('line', {
        x1: f.padL, x2: f.W - f.padR, y1: y, y2: y, class: `${p}-grid-line`,
      }));
      const t = svgEl('text', { x: f.padL - 8, y: y + 3.5, 'text-anchor': 'end', class: `${p}-axis-label` });
      t.textContent = axisLabel(v);
      f.svg.appendChild(t);
    }
  }

  /** Balken mit abgerundetem Datenende, am Nullpunkt verankert. */
  function barPath(x, baseline, w, h, maxRadius) {
    const r = Math.min(maxRadius, w / 2, h);
    return h <= r
      ? `M${x} ${baseline} h${w} v${-h} h${-w} Z`
      : `M${x} ${baseline} V${baseline - h + r} a${r} ${r} 0 0 1 ${r} ${-r} h${w - 2 * r} a${r} ${r} 0 0 1 ${r} ${r} V${baseline} Z`;
  }

  function xLabel(f, row, i, rows, opts, x) {
    if (!row.label && !cfg.renderEmptyLabels) return;
    if (i % (opts.labelEvery || 1) !== 0 && i !== rows.length - 1) return;
    const t = svgEl('text', { x, y: f.H - 10, 'text-anchor': 'middle', class: `${p}-axis-label` });
    t.textContent = row.label;
    f.svg.appendChild(t);
  }

  function hitArea(f, i, slot) {
    const hit = svgEl('rect', {
      x: f.padL + slot * i, y: f.padT, width: slot, height: f.plotH, class: hitClass,
    });
    hit.dataset.idx = String(i);
    f.svg.appendChild(hit);
  }

  /* ── Balken, eine Serie ──────────────────────────────────────── */
  function renderBars(host, rows, opts = {}) {
    if (!host || !rows.length) return;
    const f = chartFrame(host, opts);
    const scale = niceScale(Math.max(...rows.map((r) => r.value)));
    drawGrid(f, scale);

    const slot = f.plotW / rows.length;
    // Mindestens 6px Luft zwischen zwei Balken: Flaechen beruehren sich nie.
    const barW = Math.max(cfg.minBarWidth, Math.min(opts.maxBarWidth || cfg.maxBarWidth, slot - 6));
    const baseline = f.padT + f.plotH;
    const maxIdx = rows.reduce((best, r, i) => (r.value > rows[best].value ? i : best), 0);

    rows.forEach((row, i) => {
      const x = f.padL + slot * i + (slot - barW) / 2;
      const h = (row.value / scale.max) * f.plotH;
      const bar = svgEl('path', {
        d: barPath(x, baseline, barW, h, 4),
        fill: GOLD,
        opacity: row.dim ? 0.34 : 0.92,
        class: markClass,
      });
      bar.dataset.idx = String(i);
      f.svg.appendChild(bar);

      // Zahl nur ueber dem hoechsten Balken: sparsam beschriften statt ueberall.
      if ((opts.valueOnMax ?? true) && i === maxIdx && row.value > 0) {
        const lbl = svgEl('text', {
          x: x + barW / 2, y: baseline - h - 7, 'text-anchor': 'middle', class: `${p}-value-label`,
        });
        lbl.textContent = fmt(row.value);
        f.svg.appendChild(lbl);
      }
      xLabel(f, row, i, rows, opts, x + barW / 2);
      hitArea(f, i, slot);
    });

    attachTooltip(host, f.svg, rows, opts);
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
    const baseline = f.padT + f.plotH;

    rows.forEach((row, i) => {
      const gx = f.padL + slot * i + (slot - (barW * 2 + 2)) / 2;
      [[row.a, GOLD, 0], [row.b, TEAL, barW + 2]].forEach(([value, color, dx]) => {
        const h = (value / scale.max) * f.plotH;
        const bar = svgEl('path', {
          d: barPath(gx + dx, baseline, barW, h, 3),
          fill: color,
          opacity: 0.92,
          class: markClass,
        });
        bar.dataset.idx = String(i);
        f.svg.appendChild(bar);
      });
      xLabel(f, row, i, rows, opts, gx + barW + 1);
      hitArea(f, i, slot);
    });

    attachTooltip(host, f.svg, rows, opts);
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

    const gradId = `${p}-grad-${Math.random().toString(36).slice(2, 8)}`;
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
      const dot = svgEl('circle', { cx: x(i), cy: y(row.value), r: 3.2, fill: GOLD, class: `${markClass} ${p}-dot` });
      dot.dataset.idx = String(i);
      f.svg.appendChild(dot);
      if (row.label && (i % (opts.labelEvery || 1) === 0)) {
        const t = svgEl('text', { x: x(i), y: f.H - 10, 'text-anchor': 'middle', class: `${p}-axis-label` });
        t.textContent = row.label;
        f.svg.appendChild(t);
      }
      const hit = svgEl('rect', {
        x: x(i) - f.plotW / rows.length / 2, y: f.padT,
        width: f.plotW / rows.length, height: f.plotH, class: hitClass,
      });
      hit.dataset.idx = String(i);
      f.svg.appendChild(hit);
    });

    attachTooltip(host, f.svg, rows, opts);
  }

  /* ── Waagerechte Balken, eine Serie, immer direkt beschriftet ── */
  function renderHBars(host, rows, opts = {}) {
    if (!host || !rows.length) return;
    // Prozentserien bekommen mit maxValue: 100 die volle Skala, sonst wuerde
    // der groesste Wert immer als voller Balken erscheinen, egal wie klein er ist.
    const max = opts.maxValue ?? Math.max(...rows.map((r) => r.value));
    host.innerHTML = rows.map((row) => `
    <div class="${p}-hbar">
      <span class="${p}-hbar-name">${row.name}${row.sub ? `<small>${row.sub}</small>` : ''}</span>
      <span class="${p}-hbar-track">
        <span class="${p}-hbar-fill" style="width:${max > 0 ? (row.value / max) * 100 : 0}%;background:${row.color || GOLD}"></span>
      </span>
      <span class="${p}-hbar-val">${row.display ?? fmt(row.value)}${opts.unit || ''}</span>
    </div>`).join('');
  }

  /* ── Heatmap Wochentag mal Stunde ────────────────────────────── */
  function renderHeatmap(host, matrix, opts = {}) {
    if (!host) return;
    const max = Math.max(...matrix.flat());
    const einheit = opts.unitLabel || 'Snapshots';
    const wert = opts.formatValue || fmt;
    // Sequenzielle Skala: ein Farbton, sechs Stufen. Die leerste Stufe ist
    // bewusst neutral statt goldgetoent, damit "fast nichts" nicht wie
    // "ein bisschen" aussieht.
    const stufe = (v) => {
      const anteil = max > 0 ? v / max : 0;
      if (anteil < 0.05) return 'rgba(242,238,230,0.05)';
      if (anteil < 0.15) return 'rgba(201,168,106,0.22)';
      if (anteil < 0.3) return 'rgba(201,168,106,0.4)';
      if (anteil < 0.5) return 'rgba(210,180,116,0.6)';
      if (anteil < 0.75) return 'rgba(224,197,138,0.82)';
      return '#efd49d';
    };

    const kopf = `<div class="${p}-heat-row ${p}-heat-row--head"><span></span>${
      Array.from({ length: 24 }, (_, h) => `<span class="${p}-heat-col-label">${h % 3 === 0 ? h : ''}</span>`).join('')
    }</div>`;

    // Die Zellen sind bewusst nicht einzeln anspringbar: 168 Fokusstopps waeren
    // per Tastatur unbenutzbar, der Inhalt steht vollstaendig in der Tabelle.
    const zeilen = matrix.map((row, wd) => {
      const zellen = row.map((v, h) => {
        const titel = `${TAGE[wd]}, ${String(h).padStart(2, '0')} bis ${String(h).padStart(2, '0')}:59 Uhr: ${wert(v)} ${einheit}`;
        return `<span class="${p}-heat-cell" style="background:${stufe(v)}" title="${titel}"></span>`;
      }).join('');
      return `<div class="${p}-heat-row"><span class="${p}-heat-row-label">${TAGE_KURZ[wd]}</span>${zellen}</div>`;
    }).join('');

    const legende = `<div class="${p}-heat-legend"><span>weniger</span>${
      [0, 0.1, 0.22, 0.4, 0.6, 1].map((anteil) => `<i style="background:${stufe(anteil * max)}"></i>`).join('')
    }<span>mehr</span></div>`;

    host.innerHTML = `<div role="img" aria-label="${opts.ariaLabel || 'Raster der Sendezeit nach Wochentag und Stunde; die Werte stehen in der Tabelle darunter'}">${kopf}${zeilen}</div>${legende}`;
  }

  /* ── Legende ─────────────────────────────────────────────────── */
  function legend(host, entries) {
    const box = document.createElement('div');
    box.className = `${p}-legend`;
    box.innerHTML = entries.map(([label, color]) => `<span><i style="background:${color}"></i>${label}</span>`).join('');
    host.parentElement.insertBefore(box, host.nextSibling);
  }

  return {
    renderBars, renderGroupedBars, renderLine, renderHBars, renderHeatmap,
    legend, attachTooltip, chartFrame, drawGrid,
  };
}
