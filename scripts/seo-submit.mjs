#!/usr/bin/env node
/**
 * SEO-Submission via IndexNow.
 *
 * Liest URLs aus dl-landing/public/sitemap.xml, sucht den IndexNow-Key-File
 * im selben public-Ordner (32 Hex-Char.txt), und postet die URL-Liste an
 * api.indexnow.org. Bing, Yandex, Naver, Seznam und alle Cloudflare-fronted
 * Crawler reagieren darauf in Sekunden bis Minuten.
 *
 * Google indexiert NICHT über IndexNow — dafür ist die Submission via
 * Search Console nötig (siehe SETUP-SEARCH-CONSOLE.md).
 *
 * Usage:
 *   node scripts/seo-submit.mjs            # dry-run, zeigt nur was passiert
 *   node scripts/seo-submit.mjs --apply    # tatsächlich submitten
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '..')
const PUBLIC_DIR = resolve(REPO_ROOT, 'dl-landing/public')
const SITEMAP_PATH = resolve(PUBLIC_DIR, 'sitemap.xml')
const HOST = 'deutsche-deadlock-community.de'
const ENDPOINT = 'https://api.indexnow.org/indexnow'

const apply = process.argv.includes('--apply')

function fail(msg) {
  console.error(`[seo-submit] ERROR: ${msg}`)
  process.exit(1)
}

function findKeyFile() {
  if (!existsSync(PUBLIC_DIR)) fail(`Public-Dir fehlt: ${PUBLIC_DIR}`)
  const entries = readdirSync(PUBLIC_DIR)
  const candidates = entries.filter((name) => /^[0-9a-f]{32}\.txt$/i.test(name))
  if (candidates.length === 0) fail('Kein IndexNow-Key-File im public-Ordner gefunden (Pattern: 32-hex.txt)')
  if (candidates.length > 1) fail(`Mehrere Key-Files gefunden: ${candidates.join(', ')} — bitte nur eins behalten`)
  return candidates[0]
}

function loadSitemapUrls() {
  if (!existsSync(SITEMAP_PATH)) fail(`Sitemap fehlt: ${SITEMAP_PATH} — erst 'node scripts/build-sitemap.mjs' laufen lassen`)
  const xml = readFileSync(SITEMAP_PATH, 'utf8')
  const matches = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
  return matches.map((m) => m[1].trim()).filter(Boolean)
}

const keyFile = findKeyFile()
const key = keyFile.replace(/\.txt$/, '')
const keyLocation = `https://${HOST}/${keyFile}`
const urls = loadSitemapUrls()

if (urls.length === 0) fail('Keine URLs in der Sitemap gefunden')

const payload = {
  host: HOST,
  key,
  keyLocation,
  urlList: urls,
}

console.log('[seo-submit] IndexNow-Submission')
console.log(`  Endpoint: ${ENDPOINT}`)
console.log(`  Host:     ${HOST}`)
console.log(`  Key-File: ${keyLocation}`)
console.log(`  URLs:     ${urls.length}`)
urls.forEach((u) => console.log(`    - ${u}`))

if (!apply) {
  console.log('\n[seo-submit] DRY-RUN — keine Änderung. Mit --apply tatsächlich senden.')
  process.exit(0)
}

const res = await fetch(ENDPOINT, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify(payload),
})

const text = await res.text()
console.log(`\n[seo-submit] HTTP ${res.status} ${res.statusText}`)
if (text) console.log(`[seo-submit] Body: ${text}`)

// IndexNow-Response-Codes:
//   200 OK    — angenommen
//   202 Accepted — angenommen, Key-Validierung läuft async
//   400/403/422 — ungültiger Key oder Body
//   429 Too Many Requests
if (res.status !== 200 && res.status !== 202) {
  process.exit(1)
}
