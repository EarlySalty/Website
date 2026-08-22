/**
 * /szene/ — lebende Auswertung der deutschen Deadlock-Twitch-Szene.
 *
 * Die Seite hat keine eingebauten Zahlen. Sie laedt zur Laufzeit
 * /szene/data/szene.json und zeichnet daraus dieselben Diagramme wie der
 * Blogpost, nur mit dem jeweils aktuellen Stand. Die Zeichenfunktionen kommen
 * aus src/charts.js und werden mit der Transparenz-Seite geteilt.
 *
 * Betrieb: die JSON-Datei schreibt taeglich ein Job im Twitch-Bot in ein
 * Laufzeit-Verzeichnis, Caddy liefert /szene/data/* daraus aus. Die Datei
 * unter public/szene/data/szene.json ist nur der Stub fuer die lokale
 * Vorschau. Details stehen in dl-landing/WORKFLOW.md.
 */

import {
  GOLD, TEAL, fmt, fmt1,
  TAGE, datumLang,
  buildTable, wireTableToggles, createCharts,
} from '../src/charts.js';

const {
  renderBars, renderGroupedBars, renderLine, renderHBars, renderHeatmap,
} = createCharts({ prefix: 'sz' });

const DATEN_URL = '/szene/data/szene.json';

/* ══════════════════════════════════════════════════════════════
   Adapter. Einzige Stelle, an der die Feldnamen aus szene.json
   vorkommen. Aendert sich der Vertrag, aendert sich nur diese
   Funktion, der Rest der Seite arbeitet mit den Namen von hier.
   ══════════════════════════════════════════════════════════════ */
function adapt(roh) {
  if (!roh || typeof roh !== 'object') throw new Error('Die Datei enthält kein Objekt.');

  const zahl = (v, ersatz = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : ersatz);
  const quote = (eintrag) => (eintrag && typeof eintrag === 'object'
    ? { quote: zahl(eintrag.rate), n: zahl(eintrag.n) }
    : null);

  const wochen = (Array.isArray(roh.weekly) ? roh.weekly : []).map((w) => ({
    woche: String(w.week),
    aktiv: zahl(w.active_channels),
    primetimeStreams: zahl(w.primetime_concurrent_avg),
    primetimeViewer: zahl(w.primetime_viewers_avg),
    neu: zahl(w.new_channels),
    weg: zahl(w.last_seen_channels),
  }));
  if (!wochen.length) throw new Error('Die Datei enthält keine Wochenreihe.');

  const dw = roh.this_week || {};
  const delta = dw.delta_prev_week || {};
  const letzte = wochen[wochen.length - 1];

  const ueberlebenGruppe = (schluessel, name) => {
    const block = (roh.survival || {})[schluessel] || {};
    return [['d30', 30], ['d90', 90], ['d180', 180]]
      .map(([feld, tage]) => {
        const wert = quote(block[feld]);
        return wert ? { gruppe: name, tage, quote: wert.quote, n: wert.n } : null;
      })
      .filter(Boolean);
  };

  const heatmap = Array.isArray(roh.heatmap) && roh.heatmap.length === 7
    ? roh.heatmap.map((zeile) => Array.from({ length: 24 }, (_, h) => zahl((zeile || [])[h])))
    : null;

  const anteile = (liste) => (Array.isArray(liste) ? liste : [])
    .map((e) => ({ label: String(e.label), anteil: zahl(e.share) }));

  return {
    stand: roh.generated_at ? new Date(roh.generated_at) : null,
    zeitraumVon: roh.data_start || null,
    zeitraumBis: roh.data_end || null,
    zeilen: zahl(roh.rows_used),
    wochen,
    dieseWoche: {
      aktiv: zahl(dw.active_channels, letzte.aktiv),
      primetimeStreams: zahl(dw.primetime_concurrent_avg, letzte.primetimeStreams),
      primetimeViewer: zahl(dw.primetime_viewers_avg, letzte.primetimeViewer),
      neu: zahl(dw.new_channels, letzte.neu),
      delta: {
        aktiv: zahl(delta.active_channels),
        primetimeStreams: zahl(delta.primetime_concurrent_avg),
        primetimeViewer: zahl(delta.primetime_viewers_avg),
        neu: zahl(delta.new_channels),
      },
    },
    ueberleben: [
      ...ueberlebenGruppe('overall', 'Alle Kanäle'),
      ...ueberlebenGruppe('network', 'Im Netzwerk'),
      ...ueberlebenGruppe('rest', 'Außerhalb'),
    ],
    heatmap,
    viewerKlassen: anteile(roh.viewer_classes),
    sessionDauer: anteile(roh.session_duration),
    top10Anteil: zahl((roh.concentration || {}).top10_share, null),
  };
}

/* ── Kleinkram ─────────────────────────────────────────────────── */
const q = (sel) => document.querySelector(sel);

const ZEITRAEUME = { '4w': 4, '3m': 13, alles: Infinity };

function vorzeichen(wert, nachkomma = 0) {
  const text = nachkomma ? fmt1(Math.abs(wert)) : fmt(Math.abs(wert));
  if (wert > 0) return `+${text}`;
  if (wert < 0) return `−${text}`;
  return `±${text}`;
}

function deltaKlasse(wert) {
  if (wert > 0) return 'is-up';
  if (wert < 0) return 'is-down';
  return 'is-flat';
}

/** Diagramm-Wirt leeren, inklusive der Legende, die neben ihm liegt. */
function leeren(host) {
  if (!host) return;
  host.innerHTML = '';
  host.parentElement.querySelectorAll('.sz-legend').forEach((el) => el.remove());
}

/* ── Kopf und Kacheln ──────────────────────────────────────────── */
function renderKopf(daten) {
  const stand = daten.stand
    ? daten.stand.toLocaleString('de-DE', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : 'unbekannt';
  q('[data-stand]').textContent = `Stand: ${stand} Uhr`;
  const zeitraum = daten.zeitraumVon && daten.zeitraumBis
    ? `Messzeitraum ${datumLang(daten.zeitraumVon)} bis ${datumLang(daten.zeitraumBis)}`
    : 'Messzeitraum unbekannt';
  q('[data-zeitraum]').textContent = daten.zeilen
    ? `${zeitraum} · ${fmt(daten.zeilen)} ausgewertete Snapshots`
    : zeitraum;

  const w = daten.dieseWoche;
  const kacheln = [
    { wert: fmt(w.aktiv), label: 'aktive Kanäle', delta: vorzeichen(w.delta.aktiv), roh: w.delta.aktiv },
    { wert: fmt1(w.primetimeStreams), label: 'Streams gleichzeitig in der Primetime', delta: vorzeichen(w.delta.primetimeStreams, 1), roh: w.delta.primetimeStreams },
    { wert: fmt1(w.primetimeViewer), label: 'Zuschauer in der Primetime', delta: vorzeichen(w.delta.primetimeViewer, 1), roh: w.delta.primetimeViewer },
    { wert: fmt(w.neu), label: 'Kanäle zum ersten Mal gesehen', delta: vorzeichen(w.delta.neu), roh: w.delta.neu },
  ];
  q('[data-kacheln]').innerHTML = kacheln.map((k) => `
    <div class="sz-tile">
      <span class="sz-tile-num">${k.wert}</span>
      <span class="sz-tile-label">${k.label}</span>
      <span class="sz-tile-delta ${deltaKlasse(k.roh)}">${k.delta} zur Vorwoche</span>
    </div>`).join('');
}

/* ── Wochenreihen, abhaengig von der Zeitwahl ──────────────────── */
function renderWochen(daten, schluessel) {
  const anzahl = ZEITRAEUME[schluessel] ?? Infinity;
  const reihe = anzahl === Infinity ? daten.wochen : daten.wochen.slice(-anzahl);
  const jedeZweite = reihe.length > 20 ? 2 : 1;
  const label = (w, i) => (i % jedeZweite === 0 ? w.woche.slice(8) + '.' + w.woche.slice(5, 7) : '');

  const aktivHost = q('[data-chart="aktiv"]');
  leeren(aktivHost);
  renderLine(aktivHost, reihe.map((w, i) => ({
    key: `Woche ab ${datumLang(w.woche)}`,
    label: label(w, i),
    value: w.aktiv,
    tip: [['Aktive Kanäle', fmt(w.aktiv)], ['Streams in der Primetime', fmt1(w.primetimeStreams)], ['Zuschauer in der Primetime', fmt1(w.primetimeViewer)]],
  })), { labelEvery: 1, height: 250, ariaLabel: 'Aktive deutsche Deadlock-Kanäle je Woche' });
  buildTable('aktiv', ['Woche ab', 'Aktive Kanäle', 'Streams gleichzeitig', 'Zuschauer im Schnitt'],
    reihe.map((w) => [datumLang(w.woche), fmt(w.aktiv), fmt1(w.primetimeStreams), fmt1(w.primetimeViewer)]));

  const primeHost = q('[data-chart="primetime"]');
  leeren(primeHost);
  renderLine(primeHost, reihe.map((w, i) => ({
    key: `Woche ab ${datumLang(w.woche)}`,
    label: label(w, i),
    value: w.primetimeStreams,
    tip: [['Streams gleichzeitig', fmt1(w.primetimeStreams)], ['Aktive Kanäle in der Woche', fmt(w.aktiv)]],
  })), { labelEvery: 1, height: 190, ariaLabel: 'Gleichzeitig laufende Streams in der Primetime je Woche' });
  buildTable('primetime', ['Woche ab', 'Streams gleichzeitig (Primetime)'],
    reihe.map((w) => [datumLang(w.woche), fmt1(w.primetimeStreams)]));

  const flussHost = q('[data-chart="fluss"]');
  leeren(flussHost);
  renderGroupedBars(flussHost, reihe.map((w, i) => ({
    key: `Woche ab ${datumLang(w.woche)}`,
    label: label(w, i),
    a: w.neu,
    b: w.weg,
    tip: [
      ['Zum ersten Mal gesehen', fmt(w.neu), GOLD],
      ['Zum letzten Mal gesehen', fmt(w.weg), TEAL],
      ['Netto', vorzeichen(w.neu - w.weg)],
    ],
  })), {
    height: 240, nameA: 'Zum ersten Mal gesehen', nameB: 'Zum letzten Mal gesehen',
    ariaLabel: 'Neue und zuletzt gesehene Kanäle je Woche',
  });
  buildTable('fluss', ['Woche ab', 'Neu', 'Zuletzt gesehen', 'Netto'],
    reihe.map((w) => [datumLang(w.woche), fmt(w.neu), fmt(w.weg), vorzeichen(w.neu - w.weg)]));
}

/* ── Die Bloecke ohne Zeitwahl ─────────────────────────────────── */
function renderRest(daten) {
  const farbe = { 'Alle Kanäle': GOLD, 'Im Netzwerk': GOLD, 'Außerhalb': TEAL };

  if (daten.ueberleben.length) {
    renderHBars(q('[data-chart="ueberleben"]'), daten.ueberleben.map((u) => ({
      name: `${u.gruppe}, ${u.tage} Tage`,
      sub: `${fmt(u.n)} Kanäle bewertbar`,
      value: u.quote,
      display: fmt1(u.quote),
      color: farbe[u.gruppe] || GOLD,
    })), { unit: ' %' });
    buildTable('ueberleben', ['Gruppe', 'Fenster', 'Noch aktiv', 'Bewertbare Kanäle'],
      daten.ueberleben.map((u) => [u.gruppe, `${u.tage} Tage`, `${fmt1(u.quote)} %`, fmt(u.n)]));
  } else {
    q('[data-figure="ueberleben"]').hidden = true;
  }

  if (daten.heatmap) {
    renderHeatmap(q('[data-heat="zeit"]'), daten.heatmap);
    buildTable('zeit', ['Wochentag', ...Array.from({ length: 24 }, (_, h) => String(h)), 'Summe'],
      daten.heatmap.map((zeile, wd) => [TAGE[wd], ...zeile.map((v) => fmt(v)), fmt(zeile.reduce((a, b) => a + b, 0))]));
  } else {
    q('[data-figure="zeit"]').hidden = true;
  }

  if (daten.viewerKlassen.length) {
    renderHBars(q('[data-chart="viewer"]'), daten.viewerKlassen.map((k) => ({
      name: `${k.label} Zuschauer`,
      value: k.anteil,
      display: fmt1(k.anteil),
    })), { unit: ' %' });
    buildTable('viewer', ['Zuschauer gleichzeitig', 'Anteil der Snapshots'],
      daten.viewerKlassen.map((k) => [k.label, `${fmt1(k.anteil)} %`]));
  } else {
    q('[data-figure="viewer"]').hidden = true;
  }

  if (daten.sessionDauer.length) {
    renderBars(q('[data-chart="dauer"]'), daten.sessionDauer.map((s) => ({
      key: `Streams von ${s.label}`,
      label: s.label,
      value: s.anteil,
      tip: [['Anteil', `${fmt1(s.anteil)} %`]],
    })), { height: 220, maxBarWidth: 74, valueOnMax: false, ariaLabel: 'Verteilung der Streamdauer' });
    buildTable('dauer', ['Länge', 'Anteil der Streams'],
      daten.sessionDauer.map((s) => [s.label, `${fmt1(s.anteil)} %`]));
  } else {
    q('[data-figure="dauer"]').hidden = true;
  }

  const konz = q('[data-konzentration]');
  if (daten.top10Anteil === null) {
    konz.hidden = true;
  } else {
    konz.innerHTML = `Die stärksten zehn Prozent der Kanäle sammeln <b>${fmt1(daten.top10Anteil)} Prozent</b> aller gemessenen Zuschauerminuten.`;
  }
}

/* ── Zeitwahl ──────────────────────────────────────────────────── */
function wireZeitwahl(daten) {
  const knoepfe = [...document.querySelectorAll('[data-range]')];
  knoepfe.forEach((btn) => {
    btn.addEventListener('click', () => {
      knoepfe.forEach((b) => {
        const aktiv = b === btn;
        b.classList.toggle('is-active', aktiv);
        b.setAttribute('aria-pressed', String(aktiv));
      });
      renderWochen(daten, btn.dataset.range);
    });
  });
}

/* ── Laden ─────────────────────────────────────────────────────── */
async function start() {
  const status = q('[data-status]');
  const inhalt = q('[data-inhalt]');
  try {
    const antwort = await fetch(DATEN_URL, { cache: 'no-cache' });
    if (!antwort.ok) throw new Error(`Der Server hat mit Status ${antwort.status} geantwortet.`);
    let roh;
    try {
      roh = JSON.parse(await antwort.text());
    } catch {
      // Kommt vor, wenn der Server statt der Datei eine HTML-Seite ausliefert.
      throw new Error('Die Antwort war keine gültige Datendatei.');
    }
    const daten = adapt(roh);

    renderKopf(daten);
    renderWochen(daten, '3m');
    renderRest(daten);
    wireZeitwahl(daten);
    wireTableToggles('sz');

    status.hidden = true;
    inhalt.hidden = false;
  } catch (fehler) {
    status.className = 'sz-status is-error';
    status.innerHTML = `
      <b>Die Zahlen sind gerade nicht abrufbar.</b>
      <span data-grund></span>
      <a href="/blog/twitch-szene-2026/">Zur ausführlichen Auswertung</a>`;
    // Der Fehlertext kommt von aussen, deshalb als Text setzen und nicht als HTML.
    status.querySelector('[data-grund]').textContent =
      `${fehler.message} Der Blogpost mit dem Stand August 2026 funktioniert weiterhin.`;
  }
}

start();
