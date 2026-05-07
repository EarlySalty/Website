#!/usr/bin/env node
/**
 * Generiert dl-landing/helden/index.html aus scripts/data/heroes.json.
 * Pre-rendert die Hero-Übersicht statisch — gut für SEO (Googlebot
 * indexiert sofort, kein Client-Side Render nötig).
 *
 * Wann erneut ausführen:
 *  - Wenn ein neuer Hero im Spiel released wurde -> heroes.json updaten + Script laufen lassen
 *  - Wenn Tagline / Schwierigkeitsgrad / Lane-Zuordnung angepasst werden soll
 *
 * Aufruf: node scripts/gen-heroes-page.mjs
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '..')
const DATA_PATH = resolve(REPO_ROOT, 'scripts/data/heroes.json')
const OUT_PATH = resolve(REPO_ROOT, 'dl-landing/helden/index.html')

const SITE = 'https://deutsche-deadlock-community.de'

const data = JSON.parse(readFileSync(DATA_PATH, 'utf8'))
const heroes = data.heroes || []

if (heroes.length === 0) {
  throw new Error('heroes.json ist leer')
}

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

// ── Filter-Sets für Header-Pills ────────────────────────────────────────
const roles = [...new Set(heroes.map((h) => h.role))].sort()
const lanes = [...new Set(heroes.map((h) => h.lane))].sort()
const difficulties = ['Einsteiger', 'Fortgeschritten', 'Schwer']

// ── Hero-Cards ──────────────────────────────────────────────────────────
const cardsHtml = heroes
  .map(
    (h) => `      <article class="hero-card" data-role="${escapeHtml(h.role)}" data-lane="${escapeHtml(h.lane)}" data-difficulty="${escapeHtml(h.difficulty)}">
        <div class="hero-card-portrait">
          <img src="/heroes/${escapeHtml(h.slug)}.png" alt="${escapeHtml(h.name)} Portrait" width="160" height="160" loading="lazy" decoding="async" />
        </div>
        <div class="hero-card-body">
          <h3>${escapeHtml(h.name)}</h3>
          <div class="hero-card-tags">
            <span class="hero-tag hero-tag--role">${escapeHtml(h.role)}</span>
            <span class="hero-tag hero-tag--lane">${escapeHtml(h.lane)}-Lane</span>
            <span class="hero-tag hero-tag--difficulty hero-tag--difficulty-${escapeHtml(h.difficulty.toLowerCase())}">${escapeHtml(h.difficulty)}</span>
          </div>
          <p class="hero-card-tagline">${escapeHtml(h.tagline)}</p>
        </div>
      </article>`,
  )
  .join('\n')

// ── JSON-LD ItemList aller Helden ───────────────────────────────────────
const itemListJson = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'CollectionPage',
      '@id': `${SITE}/helden/#webpage`,
      name: 'Alle Deadlock Helden — Deutsche Übersicht',
      url: `${SITE}/helden/`,
      description: `Komplette Liste aller ${heroes.length} Deadlock-Helden mit Lane-Zuordnung, Rolle und Einsteiger-Empfehlung. Auf Deutsch, sortierbar, ständig aktualisiert.`,
      inLanguage: 'de-DE',
      isPartOf: { '@id': `${SITE}/#website` },
      breadcrumb: { '@id': `${SITE}/helden/#breadcrumb` },
      mainEntity: { '@id': `${SITE}/helden/#hero-list` },
    },
    {
      '@type': 'BreadcrumbList',
      '@id': `${SITE}/helden/#breadcrumb`,
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Start', item: `${SITE}/` },
        { '@type': 'ListItem', position: 2, name: 'Helden', item: `${SITE}/helden/` },
      ],
    },
    {
      '@type': 'ItemList',
      '@id': `${SITE}/helden/#hero-list`,
      name: 'Deadlock Helden',
      numberOfItems: heroes.length,
      itemListElement: heroes.map((h, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        item: {
          '@type': 'Thing',
          name: h.name,
          description: h.tagline,
          image: `${SITE}/heroes/${h.slug}.png`,
        },
      })),
    },
  ],
}

// ── Template ────────────────────────────────────────────────────────────
const filtersHtml = `
        <div class="filter-group" role="group" aria-label="Nach Schwierigkeit filtern">
          <button class="filter-pill is-active" type="button" data-filter-difficulty="all">Alle Schwierigkeiten</button>
          ${difficulties.map((d) => `<button class="filter-pill" type="button" data-filter-difficulty="${escapeHtml(d)}">${escapeHtml(d)}</button>`).join('\n          ')}
        </div>
        <div class="filter-group" role="group" aria-label="Nach Rolle filtern">
          <button class="filter-pill is-active" type="button" data-filter-role="all">Alle Rollen</button>
          ${roles.map((r) => `<button class="filter-pill" type="button" data-filter-role="${escapeHtml(r)}">${escapeHtml(r)}</button>`).join('\n          ')}
        </div>`

const html = `<!doctype html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Alle Deadlock Helden ( ${heroes.length} ) — Deutsche Übersicht | Deutsche Deadlock Community</title>
  <meta name="description" content="Übersicht aller ${heroes.length} Deadlock-Helden auf Deutsch. Mit Lane-Zuordnung, Rolle und Einsteiger-Empfehlung. Filter für Anfänger, Carry, Mage, Tank und mehr." />
  <link rel="canonical" href="${SITE}/helden/" />
  <link rel="alternate" hreflang="de" href="${SITE}/helden/" />
  <link rel="alternate" hreflang="x-default" href="${SITE}/helden/" />
  <meta name="theme-color" content="#07151d" />
  <meta name="keywords" content="Deadlock Helden, Deadlock Heroes, Deadlock Hero Liste, Deadlock Charaktere, Deadlock alle Helden, Deadlock Heroes deutsch, Deadlock Anfänger Helden, Deadlock einfache Helden" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${SITE}/helden/" />
  <meta property="og:title" content="Alle Deadlock Helden auf Deutsch ( ${heroes.length} )" />
  <meta property="og:description" content="Komplette Hero-Übersicht mit Lane, Rolle und Schwierigkeitsgrad. Auf Deutsch, sortier- und filterbar." />
  <meta property="og:image" content="${SITE}/images/og-image.png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="Alle Deadlock Helden auf Deutsch" />
  <meta name="twitter:description" content="${heroes.length} Helden mit Lane, Rolle und Schwierigkeit. Filter für Einsteiger und mehr." />
  <meta name="twitter:image" content="${SITE}/images/og-image.png" />
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <script type="application/ld+json">
${JSON.stringify(itemListJson, null, 2)}
  </script>
  <script type="module" src="/src/heroes.js"></script>
</head>
<body>
  <a href="#main" class="sr-only">Zum Inhalt springen</a>
  <div class="site-shell">
    <header class="site-header">
      <div class="container">
        <div class="header-row">
          <div class="header-left">
            <button class="menu-button" type="button" data-menu-toggle aria-expanded="false" aria-controls="nav-drawer" aria-label="Menü öffnen">
              <svg class="icon-menu" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
              <svg class="icon-close" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
            <a class="brand" href="/">
              <img src="/ddc-logo.svg" alt="Deutsche Deadlock Community" class="brand-logo" height="40" />
            </a>
          </div>
          <div class="header-actions">
            <span class="header-live" aria-label="Aktuell online im Discord">
              <span class="header-live-dot" aria-hidden="true"></span>
              <span class="header-live-text"><span data-stat="online">—</span> online</span>
            </span>
            <a class="button button-primary" href="https://discord.gg/PhkP3WgY7w" target="_blank" rel="noopener noreferrer">Beitreten</a>
          </div>
        </div>
      </div>
    </header>

    <div class="nav-drawer" id="nav-drawer" aria-hidden="true">
      <div class="nav-drawer-backdrop" data-menu-close></div>
      <nav class="nav-drawer-panel" aria-label="Hauptnavigation">
        <button class="nav-drawer-close" type="button" data-menu-close aria-label="Menü schließen">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
        <div class="nav-drawer-section">
          <a class="nav-drawer-link" href="/">Start</a>
          <a class="nav-drawer-link" href="/helden/" data-nav-link>Helden</a>
          <a class="nav-drawer-link" href="/mitspieler/" data-nav-link>Mitspieler</a>
          <a class="nav-drawer-link" href="/coaching/" data-nav-link>Coaching</a>
          <a class="nav-drawer-link" href="/patch/">Patchnotes</a>
        </div>
        <div class="nav-drawer-divider"></div>
        <span class="nav-drawer-label">Streamer</span>
        <div class="nav-drawer-section">
          <a class="nav-drawer-link" href="/streamer/">Streamer-Netzwerk</a>
          <a class="nav-drawer-link" href="/streamer/onboarding/">Onboarding</a>
          <a class="nav-drawer-link" href="/streamer/faq/">FAQ</a>
        </div>
        <div class="nav-drawer-divider"></div>
        <span class="nav-drawer-label">Plattformen</span>
        <div class="nav-drawer-section">
          <a class="nav-drawer-link" href="/turnier/">Turnierplattform</a>
          <a class="nav-drawer-link" href="/aktivitaet/">Aktivitäts-Tracker</a>
          <a class="nav-drawer-link" href="/builds/">Builds &amp; Items</a>
        </div>
        <div class="nav-drawer-divider"></div>
        <a class="button button-primary nav-drawer-cta" href="https://discord.gg/PhkP3WgY7w" target="_blank" rel="noopener noreferrer">Discord beitreten</a>
      </nav>
    </div>

    <main id="main">
      <section class="heroes-hero">
        <div class="container">
          <div data-reveal>
            <span class="heroes-eyebrow">${heroes.length} Helden · auf Deutsch</span>
            <h1>Alle Deadlock Helden im Überblick</h1>
            <p>Komplette Übersicht der ${heroes.length} spielbaren Charaktere mit Rolle, Lane-Zuordnung und Schwierigkeitsgrad. Such dir einen passenden Hero — dann komm in den Discord und lern ihn mit der Community.</p>
          </div>
        </div>
      </section>

      <section class="heroes-filters">
        <div class="container">
          <div class="filter-bar">${filtersHtml}
          </div>
          <p class="filter-hint" data-filter-hint><span data-filter-count>${heroes.length}</span> Helden angezeigt</p>
        </div>
      </section>

      <section class="heroes-grid-section">
        <div class="container">
          <div class="heroes-grid" data-heroes-grid>
${cardsHtml}
          </div>
        </div>
      </section>

      <section class="section section--alt cta-section">
        <div class="container" data-reveal>
          <h2>Du willst einen Hero richtig lernen?</h2>
          <p>Im Discord findest du Mitspieler für jede Lane — und Coaching für jeden Hero, kostenlos.</p>
          <div class="cta-actions">
            <a class="button button-primary" href="https://discord.gg/PhkP3WgY7w" target="_blank" rel="noopener noreferrer">Discord beitreten</a>
            <a class="button button-secondary" href="/coaching/">Zum Coaching</a>
          </div>
        </div>
      </section>
    </main>

    <footer class="footer">
      <div class="container">
        <div class="footer-grid">
          <section>
            <h3>Deutsche Deadlock Community</h3>
            <p class="mt-md">Die aktivste deutsche Community für Deadlock-Spieler, Coaches und Streamer.</p>
            <p class="mt-lg muted" style="font-size: 0.82rem;">Betrieben von EarlySalty</p>
          </section>
          <section>
            <h3>Navigation</h3>
            <nav class="footer-links mt-md" aria-label="Footer-Navigation">
              <a href="/">Start</a>
              <a href="/helden/">Helden</a>
              <a href="/mitspieler/">Mitspieler</a>
              <a href="/coaching/">Coaching</a>
              <a href="/streamer/">Streamer</a>
            </nav>
          </section>
          <section>
            <h3>Plattformen</h3>
            <nav class="footer-links mt-md" aria-label="Community-Plattformen">
              <a href="/turnier/">Turnierplattform</a>
              <a href="/aktivitaet/">Aktivitäts-Tracker</a>
              <a href="/builds/">Builds &amp; Items</a>
            </nav>
          </section>
          <section>
            <h3>Recht &amp; Links</h3>
            <nav class="footer-links mt-md" aria-label="Rechtliches">
              <a href="https://discord.gg/PhkP3WgY7w" target="_blank" rel="noopener noreferrer">Discord</a>
              <a href="/twitch/impressum" target="_blank" rel="noopener noreferrer">Impressum</a>
              <a href="/twitch/datenschutz" target="_blank" rel="noopener noreferrer">Datenschutz</a>
              <a href="/twitch/agb" target="_blank" rel="noopener noreferrer">AGB</a>
            </nav>
          </section>
        </div>
        <div class="footer-bottom">© <span data-current-year></span> Deutsche Deadlock Community</div>
      </div>
    </footer>
  </div>
</body>
</html>
`

mkdirSync(dirname(OUT_PATH), { recursive: true })
writeFileSync(OUT_PATH, html, 'utf8')
console.log(`[gen-heroes-page] ${heroes.length} Helden -> ${OUT_PATH}`)
