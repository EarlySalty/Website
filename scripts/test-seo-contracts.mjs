import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, cpSync, rmSync, utimesSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'

// Build dl-landing, dl-coaching and dl-patch first. A missing artifact is a failure,
// not a skipped test: the deployed HTML, rather than unused legacy pages, is the contract.
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SITE = 'https://deutsche-deadlock-community.de'
const read = (file) => readFileSync(resolve(ROOT, file), 'utf8')
const pages = [
  ['/', 'deco-elevator-new/index.html', 'Deadlock deutsch'],
  ['/beitreten/', 'dl-landing/dist/beitreten/index.html', 'Deadlock Discord deutsch'],
  ['/mitspieler/', 'dl-landing/dist/mitspieler/index.html', 'Deadlock LFG deutsch'],
  ['/coaching/', 'dl-coaching/dist/index.html', 'Deadlock Coaching auf Deutsch'],
  ['/patch/', 'dl-patch/dist/index.html', 'Deadlock Patch Notes'],
]
const values = (html, expression) => [...html.matchAll(expression)].map((match) => match[1])
const only = (html, expression) => {
  const found = values(html, expression)
  assert.equal(found.length, 1, 'Expected exactly one ' + expression)
  return found[0]
}
const meta = (html, key) => only(html, new RegExp('<meta\\s+(?:name|property)="' + key + '"\\s+content="([^"]+)"[^>]*>', 'g'))
const text = (html) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()

for (const [route, file, intent] of pages) {
  test(route + ' serves distinct, consistent metadata and visible content without JS', () => {
    const html = read(file)
    const title = only(html, /<title>([^<]+)<\/title>/g)
    assert.ok(title.startsWith(intent))
    const description = meta(html, 'description')
    assert.ok(description.length > 70)
    assert.equal(meta(html, 'og:title'), title)
    assert.equal(meta(html, 'twitter:title'), title)
    assert.equal(meta(html, 'og:description'), description)
    assert.equal(meta(html, 'twitter:description'), description)
    assert.equal(only(html, /<link\s+rel="canonical"\s+href="([^"]+)"[^>]*>/g), SITE + route)
    assert.equal(meta(html, 'og:url'), SITE + route)
    assert.match(meta(html, 'robots'), /^index,\s*follow/)
    assert.match(html, /<html lang="de"/)
    assert.match(text(only(html, /<h1\b[^>]*>([\s\S]*?)<\/h1>/g)), /Deadlock/)
    assert.doesNotMatch(html, /<meta name="keywords"/)
    assert.equal((html.match(/static\.cloudflareinsights\.com\/beacon\.min\.js/g) || []).length, 1)
    const nodes = values(html, /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)
      .flatMap((json) => JSON.parse(json)['@graph'] || [])
    const page = nodes.find((node) => node['@type'] === 'WebPage')
    assert.ok(page, 'WebPage structured data missing')
    assert.equal(page.url, SITE + route)
    assert.equal(page.name, title)
    assert.equal(page.description, description)
    assert.equal(page.inLanguage, 'de-DE')
  })
}

test('the five intents have unique titles and stable existing URLs', () => {
  assert.equal(new Set(pages.map(([, file]) => only(read(file), /<title>([^<]+)<\/title>/g))).size, 5)
  const home = read(pages[0][1])
  for (const [route] of pages.slice(1)) assert.ok(home.includes('href="' + route + '"') || home.includes('href="' + SITE + route + '"'))
  assert.doesNotMatch(home, /href="\/patchnotes\/"/)
  const sitemap = read('dl-landing/public/sitemap.xml')
  for (const [route] of pages) assert.equal(sitemap.split('<loc>' + SITE + route + '</loc>').length - 1, 1)
})

test('page-specific invitation attribution is preserved', () => {
  for (const [file, invite] of [
    ['deco-elevator-new/index.html', 'PhkP3WgY7w'],
    ['dl-landing/beitreten/index.html', 'PhkP3WgY7w'],
    ['dl-landing/mitspieler/index.html', 'GrdVBQtf2y'],
    ['dl-patch/index.html', 'PhkP3WgY7w'],
  ]) {
    assert.deepEqual([...new Set(values(read(file), /discord\.gg\/([A-Za-z0-9]+)/g))], [invite])
  }
})

test('coaching prerenders the same public components without querying user data', () => {
  const html = read('dl-coaching/dist/index.html')
  assert.doesNotMatch(html, /<div id="root"><\/div>/)
  for (const copy of ['Finde einen Deadlock Coach', 'Fragen zum Deadlock Coaching', 'Anfrage auf der Website']) assert.ok(html.includes(copy), copy)
  for (const route of ['/coaching/anfrage', '/coaching/me', '/beitreten/']) assert.ok(html.includes('href="' + route + '"'))
  const source = read('dl-coaching/src/components/CoachingPublic.tsx')
  assert.doesNotMatch(source, /\b(?:fetch|useAuth|useQuery)\s*\(|window\.|document\./)
  const interactive = read('dl-coaching/src/pages/CoachesPage.tsx')
  for (const component of ['CoachingHero', 'CoachingProcess', 'CoachingQuestions']) assert.ok(interactive.includes('<' + component))
  assert.ok(html.includes('wird JavaScript benötigt'))
})

test('revealed sections remain visible without JavaScript and patch language is not overstated', () => {
  for (const [, file] of pages.filter(([route]) => route !== '/coaching/')) {
    assert.match(read(file), /<noscript><style>[\s\S]*?opacity:\s*1\s*!important;[\s\S]*?<\/style><\/noscript>/)
  }
  const patch = read('dl-patch/dist/index.html')
  assert.ok(patch.includes('Originalsprache'))
  assert.ok(patch.includes('JavaScript benötigt'))
})

test('sitemap dates use committed live sources, preserve unavailable Docs and ignore checkout mtimes', () => {
  const root = mkdtempSync(resolve(tmpdir(), 'website-seo-sitemap-'))
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  const put = (file, value) => { mkdirSync(dirname(resolve(root, file)), { recursive: true }); writeFileSync(resolve(root, file), value) }
  try {
    cpSync(resolve(ROOT, 'scripts/build-sitemap.mjs'), resolve(root, 'build-sitemap.mjs'))
    // Place the script at its real relative depth.
    mkdirSync(resolve(root, 'scripts'))
    cpSync(resolve(root, 'build-sitemap.mjs'), resolve(root, 'scripts/build-sitemap.mjs'))
    const original = '<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
      '<url><loc>' + SITE + '/docs/existing/</loc><lastmod>2026-08-01</lastmod></url>' +
      '<url><loc>' + SITE + '/coaching/</loc><lastmod>2026-08-02</lastmod></url></urlset>'
    put('dl-landing/public/sitemap.xml', original)
    put('dl-coaching/src/components/CoachingPublic.tsx', 'public content')
    put('dl-landing/coaching/index.html', 'unused legacy coaching')
    git('init', '--quiet')
    git('add', '.')
    execFileSync('git', ['-c', 'user.name=SEO test', '-c', 'user.email=seo-test@example.invalid', 'commit', '--quiet', '-m', 'fixture'], {
      cwd: root, env: { ...process.env, GIT_AUTHOR_DATE: '2026-09-12T12:00:00Z', GIT_COMMITTER_DATE: '2026-09-12T12:00:00Z' },
    })
    // A checkout timestamp must not become a false update date.
    utimesSync(resolve(root, 'dl-coaching/src/components/CoachingPublic.tsx'), new Date('2030-01-01'), new Date('2030-01-01'))
    const output = resolve(root, 'result.xml')
    const run = () => execFileSync(process.execPath, [resolve(root, 'scripts/build-sitemap.mjs'), output], {
      cwd: root, env: { ...process.env, DEADLOCK_DOCS_ROOT: resolve(root, 'missing-docs') },
    })
    run()
    const first = readFileSync(output, 'utf8')
    assert.match(first, /<loc>https:\/\/deutsche-deadlock-community\.de\/coaching\/<\/loc>\s*<lastmod>2026-09-12<\/lastmod>/)
    assert.match(first, /<loc>https:\/\/deutsche-deadlock-community\.de\/docs\/existing\/<\/loc>\s*<lastmod>2026-08-01<\/lastmod>/)
    assert.doesNotMatch(first, /2030-|undefined|null/)
    assert.equal(readFileSync(resolve(root, 'dl-landing/public/sitemap.xml'), 'utf8'), original)
    run()
    assert.equal(readFileSync(output, 'utf8'), first)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
