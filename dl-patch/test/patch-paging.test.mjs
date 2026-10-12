import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'
import { sourceFromUrl } from '../src/source-from-url.mjs'

const source = (await readFile(new URL('../src/patch.js', import.meta.url), 'utf8'))
  .replace(/^import .*$/gm, '')

function dashboard() {
  const pending = []
  const context = vm.createContext({
    Intl, URL, URLSearchParams, AbortController, sourceFromUrl,
    console: { warn() {}, error() {} },
    document: {
      documentElement: { classList: { add() {} } },
      querySelectorAll: () => [],
      querySelector: () => null,
      getElementById: () => null,
      addEventListener() {},
    },
    window: {
      location: { pathname: '/patch/' },
      matchMedia: () => ({ matches: true }),
      setTimeout, clearTimeout,
    },
    fetch: (url, options) => new Promise((resolve, reject) => {
      pending.push({ url, options, resolve: (body) => resolve({ ok: true, json: async () => body }), reject })
    }),
  })
  vm.runInContext(source, context)
  vm.runInContext("state.loading = false; state.timelineAvailable = true; state.entities = [{ entity_type: 'hero', entity_name: 'Shiv' }]; state.selectedEntityKey = 'hero:shiv'", context)
  return { pending, run: (code) => vm.runInContext(code, context) }
}

const event = (id) => ({ id, patch_id: 'patch-a', entity_type: 'hero', entity_name: 'Shiv' })

test('overview initialization does not override a filter selected while loading', () => {
  const { run } = dashboard()
  run("state.selectedEntityKey = ''; state.filters.entityType = 'item'; primeSelection()")
  assert.equal(run('state.selectedEntityKey'), '')
  run("state.filters.entityType = 'all'; state.filters.search = 'damage'; primeSelection()")
  assert.equal(run('state.selectedEntityKey'), '')
})

test('selection loads 20 events and appends the next 50 with the same filters', async () => {
  const { pending, run } = dashboard()
  const first = run('loadEvents()')
  const firstParams = new URL(pending[0].url, 'http://localhost').searchParams
  assert.equal(firstParams.get('limit'), '20')
  assert.equal(firstParams.get('entity'), 'Shiv')
  assert.equal(firstParams.get('entity_type'), 'hero')
  pending[0].resolve({ events: Array.from({ length: 20 }, (_, i) => event(i)), next_offset: 20 })
  await first
  const next = run('loadEvents(true)')
  const nextParams = new URL(pending[1].url, 'http://localhost').searchParams
  assert.equal(nextParams.get('limit'), '50')
  assert.equal(nextParams.get('offset'), '20')
  pending[1].resolve({ events: Array.from({ length: 50 }, (_, i) => event(i + 20)), next_offset: 70 })
  await next
  assert.equal(run('state.events.length'), 70)
  assert.equal(run('state.nextOffset'), 70)
})

test('a changed selection cancels the old request and rejects its stale response', async () => {
  const { pending, run } = dashboard()
  const old = run('loadEvents()')
  run("state.selectedEntityKey = ''; state.filters.search = 'damage'")
  const current = run('loadEvents()')
  assert.equal(pending[0].options.signal.aborted, true)
  const params = new URL(pending[1].url, 'http://localhost').searchParams
  assert.equal(params.get('search'), 'damage')
  assert.equal(params.has('entity'), false)
  pending[1].resolve({ events: [event('new')], next_offset: null })
  await current
  pending[0].resolve({ events: [event('stale')], next_offset: 20 })
  await old
  assert.equal(run('state.events[0].id'), 'new')
  assert.equal(run('state.nextOffset'), null)
  assert.equal(run('state.eventsLoading'), false)
})

test('failed pagination preserves loaded rows and the retry offset', async () => {
  const { pending, run } = dashboard()
  const first = run('loadEvents()')
  pending[0].resolve({ events: [event(1)], next_offset: 1 })
  await first
  run("document.activeElement = { hasAttribute: () => true }; window.focusRestored = false; document.querySelector = () => ({ hasAttribute: () => true, focus: () => { window.focusRestored = true } })")
  const next = run('loadEvents(true)')
  assert.equal(run('state.eventsLoading'), true)
  await run('loadEvents(true)')
  assert.equal(pending.length, 2)
  pending[1].reject(new Error('network unavailable'))
  await next
  assert.equal(run('state.events.length'), 1)
  assert.equal(run('state.nextOffset'), 1)
  assert.equal(run('Boolean(state.eventsError)'), true)
  assert.equal(run('window.focusRestored'), true)
})
