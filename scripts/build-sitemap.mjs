#!/usr/bin/env node
/**
 * Generiert dl-landing/public/sitemap.xml mit allen real existierenden
 * Subprojekt-Pfaden und echten lastmod-Werten aus den Source-File-mtimes.
 *
 * Aufruf: node scripts/build-sitemap.mjs
 *
 * Reihenfolge im Build:
 *   1. node scripts/build-sitemap.mjs  (vor Vite-Build)
 *   2. cd dl-landing && npm run build  (kopiert public/sitemap.xml nach dist/)
 */

import { writeFileSync, statSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '..')
const SITE = 'https://deutsche-deadlock-community.de'
const OUT = resolve(REPO_ROOT, 'dl-landing/public/sitemap.xml')

// path = öffentlicher URL-Pfad, src = Source-Datei für lastmod (relative zu REPO_ROOT)
const ENTRIES = [
  { path: '/',                       src: 'dl-landing/index.html' },
  { path: '/mitspieler/',            src: 'dl-landing/mitspieler/index.html' },
  { path: '/coaching/',              src: 'dl-landing/coaching/index.html' },
  { path: '/streamer/',              src: 'dl-landing/streamer/index.html' },
  { path: '/helden/',                src: 'dl-landing/helden/index.html' },
  { path: '/guides/anfaenger/',      src: 'dl-landing/guides/anfaenger/index.html' },
  { path: '/patch/',                 src: 'dl-patch/index.html' },
  { path: '/aktivitaet/',            src: 'dl-activity/index.html' },
  { path: '/builds/',                src: 'dl-tierlist/index.html' },
]

const todayIso = new Date().toISOString().slice(0, 10)

function lastmodOf(relPath) {
  const abs = resolve(REPO_ROOT, relPath)
  if (!existsSync(abs)) return todayIso
  try {
    const mtime = statSync(abs).mtime
    return mtime.toISOString().slice(0, 10)
  } catch {
    return todayIso
  }
}

const urls = ENTRIES
  .map(({ path, src }) => {
    const lastmod = lastmodOf(src)
    return `  <url>\n    <loc>${SITE}${path}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`
  })
  .join('\n')

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`

writeFileSync(OUT, xml, 'utf8')
console.log(`[build-sitemap] ${ENTRIES.length} URLs -> ${OUT}`)
