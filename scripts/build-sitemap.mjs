#!/usr/bin/env node
/**
 * Generiert dl-landing/public/sitemap.xml.
 *
 * Aufruf: node scripts/build-sitemap.mjs
 *
 * Bestehende locs aus der aktuellen sitemap.xml bleiben erhalten. Der Generator
 * darf Docs, Blog und FAQ nicht löschen. Bekannte Hauptseiten bekommen lastmod
 * aus der Source-Datei.
 */

import { readFileSync, writeFileSync, statSync, existsSync, readdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '..')
const SITE = 'https://deutsche-deadlock-community.de'
const OUT = resolve(REPO_ROOT, 'dl-landing/public/sitemap.xml')
const DOCS_ROOT_CANDIDATES = [
  process.env.DEADLOCK_DOCS_ROOT,
  resolve(REPO_ROOT, '..', 'Deadlock-Docs'),
  resolve(REPO_ROOT, '..', '..', 'Documents', 'Deadlock-Docs'),
].filter(Boolean)
const DOCS_ROOT =
  DOCS_ROOT_CANDIDATES.find((candidate) => existsSync(resolve(candidate, 'public'))) ??
  DOCS_ROOT_CANDIDATES[0]

const ENTRIES = [
  { path: '/',                        src: resolve(REPO_ROOT, 'deco-elevator-new/index.html') },
  { path: '/mitspieler/',             src: resolve(REPO_ROOT, 'dl-landing/mitspieler/index.html') },
  { path: '/coaching/',               src: resolve(REPO_ROOT, 'dl-landing/coaching/index.html') },
  { path: '/streamer/',               src: resolve(REPO_ROOT, 'dl-landing/streamer/index.html') },
  { path: '/helden/',                 src: resolve(REPO_ROOT, 'dl-landing/helden/index.html') },
  { path: '/guides/anfaenger/',       src: resolve(REPO_ROOT, 'dl-landing/guides/anfaenger/index.html') },
  { path: '/beitreten/',              src: resolve(REPO_ROOT, 'dl-landing/beitreten/index.html') },
  { path: '/patch/',                  src: resolve(REPO_ROOT, 'dl-patch/index.html') },
  { path: '/devfeed/',                src: resolve(REPO_ROOT, 'dl-devfeed/index.html') },
  { path: '/devfeed/api-docs/',       src: resolve(REPO_ROOT, 'dl-devfeed/api-docs/index.html') },
  { path: '/aktivitaet/',             src: resolve(REPO_ROOT, 'dl-activity/index.html') },
  { path: '/builds/',                 src: resolve(REPO_ROOT, 'dl-tierlist/index.html') },
  { path: '/transparenz/',            src: resolve(REPO_ROOT, 'dl-landing/transparenz/index.html') },
  { path: '/blog/',                   src: resolve(REPO_ROOT, 'dl-landing/blog/index.html') },
  { path: '/blog/twitch-szene-2026/', src: resolve(REPO_ROOT, 'dl-landing/blog/twitch-szene-2026/index.html') },
  { path: '/faq/',                    src: resolve(DOCS_ROOT, 'site/index.html') },
  { path: '/docs/',                   src: resolve(DOCS_ROOT, 'public/index.html') },
]

const todayIso = new Date().toISOString().slice(0, 10)

function lastmodOf(absPath) {
  if (!existsSync(absPath)) return todayIso
  try {
    return statSync(absPath).mtime.toISOString().slice(0, 10)
  } catch {
    return todayIso
  }
}

function existingLocs(xmlPath) {
  if (!existsSync(xmlPath)) return new Map()
  const xml = readFileSync(xmlPath, 'utf8')
  const locs = new Map()
  const re = /<url>\s*<loc>([^<]+)<\/loc>\s*(?:<lastmod>([^<]*)<\/lastmod>)?/g
  let match
  while ((match = re.exec(xml))) {
    const loc = match[1].trim()
    const path = loc.startsWith(SITE) ? loc.slice(SITE.length) || '/' : loc
    locs.set(path, match[2] || todayIso)
  }
  return locs
}

function walkHtml(root) {
  if (!existsSync(root)) return []
  const found = []
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const absolute = resolve(root, entry.name)
    if (entry.isDirectory()) {
      found.push(...walkHtml(absolute))
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      found.push(absolute)
    }
  }
  return found
}

function docsPath(absPath) {
  const relative = absPath.slice(DOCS_ROOT.length + '/public/'.length).replaceAll('\\', '/')
  if (relative === 'index.html') return '/docs/'
  if (relative.endsWith('/index.html')) return `/docs/${relative.slice(0, -'index.html'.length)}`
  return `/docs/${relative}`
}

function docsEntries() {
  const publicRoot = resolve(DOCS_ROOT, 'public')
  return walkHtml(publicRoot)
    .map((src) => ({ path: docsPath(src), src }))
    .filter(({ path }) => !path.startsWith('/docs/dokus/datenschutz/'))
}

const merged = existingLocs(OUT)

// Docs werden aus dem aktuellen public/-Baum neu aufgebaut. So verschwinden
// gelöschte Dokumente aus der Sitemap und neue Seiten landen ohne Handpflege
// mit ihrem echten Änderungsdatum darin.
for (const path of [...merged.keys()]) {
  if (path === '/docs/' || path.startsWith('/docs/')) merged.delete(path)
}
for (const { path, src } of docsEntries()) {
  merged.set(path, lastmodOf(src))
}

for (const { path, src } of ENTRIES) {
  merged.set(path, lastmodOf(src))
}

for (const noIndex of [
  '/twitch/impressum',
  '/twitch/impressum/',
  '/twitch/datenschutz',
  '/twitch/datenschutz/',
  '/twitch/agb',
  '/twitch/agb/',
]) {
  merged.delete(noIndex)
}

const urls = [...merged.entries()]
  .sort((a, b) => {
    if (a[0] === '/') return -1
    if (b[0] === '/') return 1
    return a[0].localeCompare(b[0], 'de')
  })
  .map(([path, lastmod]) => `  <url>\n    <loc>${SITE}${path}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`)
  .join('\n')

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`

writeFileSync(OUT, xml, 'utf8')
console.log(`[build-sitemap] ${merged.size} URLs -> ${OUT}`)
