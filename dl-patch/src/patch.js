import '@shared/site.css'
import './patch.css'

const TIMELINE_API_URL = '/api/public/patch-timeline'
const PATCH_NOTES_API_URL = '/api/public/patch-notes'
const ASSET_ITEMS_URL = 'https://api.deadlock-api.com/v1/assets/items'
const ASSET_HEROES_URL = 'https://api.deadlock-api.com/v1/assets/heroes'

const DATE_SHORT = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

const NUMBER = new Intl.NumberFormat('de-DE')

const CHANGE_LABELS = {
  all: 'Alle',
  buff: 'Buffs',
  nerf: 'Nerfs',
  mechanic_change: 'Mechanik',
  fix: 'Fixes',
  added: 'Neu',
  removed: 'Entfernt',
  rework: 'Reworks',
}

const ENTITY_LABELS = {
  all: 'Alles',
  hero: 'Heroes',
  item: 'Items',
  ability: 'Abilities',
  general: 'Systeme',
}

// Heroes mit gepflegter Balance-Historie-Seite unter /patch/hero/<slug>.html
const HERO_DOCS = new Set([
  'abrams', 'apollo', 'bebop', 'billy', 'calico', 'celeste', 'drifter', 'dynamo',
  'graves', 'grey-talon', 'haze', 'holliday', 'infernus', 'ivy', 'kelvin', 'lady-geist',
  'lash', 'mcginnis', 'mina', 'mirage', 'mo-and-krill', 'paige', 'paradox', 'pocket',
  'rem', 'seven', 'shiv', 'silver', 'sinclair', 'the-doorman', 'venator', 'victor',
  'vindicta', 'viscous', 'vyper', 'warden', 'wraith', 'yamato',
])

const heroSlug = (name) =>
  String(name).toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

function heroDocLink(entity) {
  if (!entity || entity.entity_type !== 'hero') return ''
  const slug = heroSlug(entity.entity_name)
  if (!HERO_DOCS.has(slug)) return ''
  return `<a class="detail-history" href="/patch/hero/${slug}.html">Balance-Historie ansehen →</a>`
}

const state = {
  loading: true,
  error: '',
  summary: {},
  patches: [],
  entities: [],
  events: [],
  assets: {
    hero: new Map(),
    item: new Map(),
  },
  filters: {
    entityType: 'all',
    changeType: 'all',
    source: 'all',
    search: '',
  },
  selectedPatchId: '',
  selectedEntityKey: '',
}

document.documentElement.classList.add('js')
setActiveNav()
setupNavDrawer()
setupReveal()

document.addEventListener('DOMContentLoaded', () => {
  if (!document.getElementById('patch-dashboard')) return
  setupControls()
  loadDashboard()
})

async function loadDashboard() {
  setStatus('Lade Brain Timeline')

  try {
    const timeline = await fetchJson(TIMELINE_API_URL)
    applyTimelinePayload(timeline)
    setStatus('Live aus PG Brain')
  } catch (error) {
    console.warn('[patch] Timeline-Endpunkt nicht erreichbar, nutze Fallback:', error)
    try {
      const fallback = await fetchJson(PATCH_NOTES_API_URL)
      applyPatchNotesFallback(fallback)
      setStatus('Patchnotes Fallback')
    } catch (fallbackError) {
      console.error('[patch] Fehler beim Laden:', fallbackError)
      state.error = 'Patchdaten konnten nicht geladen werden.'
      state.loading = false
      render()
      return
    }
  }

  state.loading = false
  primeSelection()
  render()
  window.setTimeout(() => loadAssetCatalog().then(render), 0)
}

async function loadAssetCatalog() {
  const [itemsResult, heroesResult] = await Promise.allSettled([
    fetchJson(ASSET_ITEMS_URL, 8000),
    fetchJson(ASSET_HEROES_URL, 8000),
  ])

  if (itemsResult.status === 'fulfilled' && Array.isArray(itemsResult.value)) {
    itemsResult.value.forEach((item) => {
      const name = String(item?.name ?? '').trim()
      const image = String(item?.shop_image || item?.image_webp || item?.image || '').trim()
      if (!name || !image) return
      state.assets.item.set(normalizeKey(name), {
        name,
        image,
        tier: item?.item_tier ?? null,
        slot: item?.item_slot_type ?? '',
      })
    })
  }

  if (heroesResult.status === 'fulfilled' && Array.isArray(heroesResult.value)) {
    heroesResult.value.forEach((hero) => {
      const name = String(hero?.name ?? '').trim()
      const images = hero?.images ?? {}
      const image = String(
        images.icon_image_small_webp ||
          images.icon_image_small ||
          images.icon_hero_card_webp ||
          images.icon_hero_card ||
          '',
      ).trim()
      if (!name || !image) return
      state.assets.hero.set(normalizeKey(name), {
        name,
        image,
        heroType: hero?.hero_type ?? '',
      })
    })
  }
}

async function fetchJson(url, timeoutMs = 12000) {
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return await response.json()
  } finally {
    window.clearTimeout(timeoutId)
  }
}

function applyTimelinePayload(payload) {
  state.summary = payload?.summary ?? {}
  state.patches = normalizePatches(payload?.patches ?? [])
  state.entities = normalizeEntities(payload?.entities ?? [])
  state.events = normalizeEvents(payload?.events ?? [])
}

function applyPatchNotesFallback(payload) {
  const patches = Array.isArray(payload?.patches) ? payload.patches : []
  state.events = []
  state.entities = []
  state.patches = patches
    .map((patch) => ({
      patch_id: String(patch.id ?? ''),
      title: String(patch.title ?? 'Patch Notes'),
      url: String(patch.url ?? ''),
      source_kind: sourceFromUrl(patch.url),
      posted_at: normalizeDateValue(patch.posted_at),
      event_count: estimateChangeLines(patch.translated_content),
      hero_events: Number(patch.sections?.includes('helden') ? 1 : 0),
      item_events: Number(patch.sections?.includes('items') ? 1 : 0),
      ability_events: 0,
      general_events: Number(patch.sections?.includes('allgemein') ? 1 : 0),
      buff_events: 0,
      nerf_events: 0,
      fix_events: 0,
      rework_events: 0,
      value_events: 0,
      top_entities: [],
    }))
    .filter((patch) => patch.patch_id)
    .sort((left, right) => dateMs(left.posted_at) - dateMs(right.posted_at))

  state.summary = {
    total_events: state.patches.reduce((sum, patch) => sum + patch.event_count, 0),
    total_patches: state.patches.length,
    named_entities: 0,
    value_events: 0,
    first_posted_at: state.patches[0]?.posted_at ?? null,
    latest_posted_at: state.patches.at(-1)?.posted_at ?? null,
  }
}

function normalizePatches(patches) {
  return patches
    .map((patch) => ({
      patch_id: String(patch.patch_id ?? patch.id ?? ''),
      title: String(patch.title ?? 'Patch Notes'),
      url: String(patch.url ?? ''),
      source_kind: String(patch.source_kind ?? sourceFromUrl(patch.url) ?? 'other'),
      posted_at: normalizeDateValue(patch.posted_at),
      event_count: toNumber(patch.event_count),
      hero_events: toNumber(patch.hero_events),
      item_events: toNumber(patch.item_events),
      ability_events: toNumber(patch.ability_events),
      general_events: toNumber(patch.general_events),
      buff_events: toNumber(patch.buff_events),
      nerf_events: toNumber(patch.nerf_events),
      fix_events: toNumber(patch.fix_events),
      rework_events: toNumber(patch.rework_events),
      value_events: toNumber(patch.value_events),
      top_entities: Array.isArray(patch.top_entities) ? patch.top_entities : [],
    }))
    .filter((patch) => patch.patch_id)
}

function normalizeEntities(entities) {
  return entities
    .map((entity) => ({
      entity_type: String(entity.entity_type ?? 'general'),
      entity_name: String(entity.entity_name ?? 'General'),
      event_count: toNumber(entity.event_count),
      patch_count: toNumber(entity.patch_count),
      first_posted_at: normalizeDateValue(entity.first_posted_at),
      latest_posted_at: normalizeDateValue(entity.latest_posted_at),
      buff_events: toNumber(entity.buff_events),
      nerf_events: toNumber(entity.nerf_events),
      fix_events: toNumber(entity.fix_events),
      mechanic_events: toNumber(entity.mechanic_events),
      added_events: toNumber(entity.added_events),
      removed_events: toNumber(entity.removed_events),
      value_events: toNumber(entity.value_events),
      latest_patch_id: String(entity.latest_patch_id ?? ''),
      latest_patch_title: String(entity.latest_patch_title ?? ''),
      latest_patch_url: String(entity.latest_patch_url ?? ''),
      latest_change_type: String(entity.latest_change_type ?? ''),
      latest_line: String(entity.latest_line ?? ''),
    }))
    .filter((entity) => entity.entity_name)
}

function normalizeEvents(events) {
  return events
    .map((event) => ({
      id: String(event.id ?? ''),
      patch_id: String(event.patch_id ?? ''),
      patch_title: String(event.patch_title ?? 'Patch Notes'),
      url: String(event.url ?? ''),
      source_kind: String(event.source_kind ?? sourceFromUrl(event.url) ?? 'other'),
      posted_at: normalizeDateValue(event.posted_at),
      line_index: toNumber(event.line_index),
      section: String(event.section ?? ''),
      entity_type: String(event.entity_type ?? 'general'),
      entity_name: String(event.entity_name ?? event.subject ?? ''),
      subject: String(event.subject ?? ''),
      change_type: String(event.change_type ?? 'mechanic_change'),
      normalized_line: String(event.normalized_line ?? ''),
      old_value: event.old_value == null ? '' : String(event.old_value),
      new_value: event.new_value == null ? '' : String(event.new_value),
      confidence: Number(event.confidence ?? 0),
    }))
    .filter((event) => event.patch_id)
}

function setupControls() {
  document.querySelectorAll('[data-entity-filter]').forEach((button) => {
    button.addEventListener('click', () => {
      state.filters.entityType = button.dataset.entityFilter || 'all'
      state.selectedEntityKey = ''
      syncActiveButtons('[data-entity-filter]', state.filters.entityType)
      render()
    })
  })

  document.querySelectorAll('[data-change-filter]').forEach((button) => {
    button.addEventListener('click', () => {
      state.filters.changeType = button.dataset.changeFilter || 'all'
      syncActiveButtons('[data-change-filter]', state.filters.changeType)
      render()
    })
  })

  const sourceSelect = document.getElementById('patch-source-filter')
  sourceSelect?.addEventListener('change', () => {
    state.filters.source = sourceSelect.value || 'all'
    render()
  })

  const searchInput = document.getElementById('patch-search')
  if (searchInput) {
    let timer = 0
    searchInput.addEventListener('input', () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        state.filters.search = searchInput.value.trim().toLowerCase()
        render()
      }, 160)
    })
  }
}

function syncActiveButtons(selector, value) {
  document.querySelectorAll(selector).forEach((button) => {
    const active = Object.values(button.dataset).includes(value)
    button.classList.toggle('is-active', active)
    button.setAttribute('aria-pressed', String(active))
  })
}

function primeSelection() {
  const topHero = state.entities.find((entity) => entity.entity_type === 'hero')
  const topEntity = topHero || state.entities[0]
  if (topEntity) {
    state.selectedEntityKey = entityKey(topEntity.entity_type, topEntity.entity_name)
  }
}

function render() {
  if (state.error) {
    renderError()
    return
  }

  if (state.loading) {
    renderLoading()
    return
  }

  const filteredEvents = getFilteredEvents()
  const filteredMode = hasActiveFilters()
  const patchStats = filteredEvents.length || !filteredMode ? buildPatchStats(filteredEvents) : []
  const entityStats = buildEntityStats(filteredEvents)
  const visibleEntities = filteredEvents.length || filteredMode ? entityStats : state.entities

  renderKpis(filteredEvents, patchStats, visibleEntities)
  renderTimeline(patchStats)
  renderEntityGrid(visibleEntities)
  renderDetailPanel(visibleEntities, filteredEvents)
  renderEventFeed(filteredEvents)
  renderLatestPatch()
}

function renderLoading() {
  const kpis = document.getElementById('patch-kpis')
  const timeline = document.getElementById('timeline-track')
  const entities = document.getElementById('entity-grid')
  const feed = document.getElementById('event-feed')
  if (kpis) kpis.innerHTML = Array.from({ length: 4 }, () => '<div class="skeleton-box"></div>').join('')
  if (timeline) timeline.innerHTML = '<div class="timeline-loading"></div>'
  if (entities) entities.innerHTML = Array.from({ length: 12 }, () => '<div class="entity-skeleton"></div>').join('')
  if (feed) feed.innerHTML = Array.from({ length: 6 }, () => '<div class="event-skeleton"></div>').join('')
}

function renderError() {
  const dashboard = document.getElementById('patch-dashboard')
  if (!dashboard) return
  dashboard.innerHTML = `
    <div class="container">
      <div class="patch-error">${escapeHtml(state.error)}</div>
    </div>
  `
}

function renderKpis(filteredEvents, patchStats, visibleEntities) {
  const kpis = document.getElementById('patch-kpis')
  if (!kpis) return

  const filteredMode = hasActiveFilters()
  const totalEvents = filteredMode ? filteredEvents.length : toNumber(state.summary.total_events)
  const totalPatches = filteredMode ? patchStats.length : toNumber(state.summary.total_patches)
  const valueEvents = filteredMode
    ? filteredEvents.filter((event) => event.old_value || event.new_value).length
    : toNumber(state.summary.value_events)
  const latestDate = latestPatch(patchStats || state.patches)?.posted_at || state.summary.latest_posted_at

  const cards = [
    { label: 'Events', value: NUMBER.format(totalEvents), sub: `${NUMBER.format(totalPatches)} Patches` },
    { label: 'Entities', value: NUMBER.format(visibleEntities.length || toNumber(state.summary.named_entities)), sub: activeFilterLabel() },
    { label: 'Werte', value: NUMBER.format(valueEvents), sub: 'Old/New Deltas' },
    { label: 'Aktuell', value: latestDate ? formatDate(latestDate) : '-', sub: latestPatch(patchStats)?.title || 'Patch Timeline' },
  ]

  kpis.innerHTML = cards
    .map(
      (card) => `
        <div class="kpi-card">
          <span>${escapeHtml(card.label)}</span>
          <strong>${escapeHtml(card.value)}</strong>
          <small>${escapeHtml(card.sub)}</small>
        </div>
      `,
    )
    .join('')
}

function renderTimeline(patches) {
  const track = document.getElementById('timeline-track')
  const count = document.getElementById('timeline-count')
  if (!track) return

  const source = patches.length ? patches : state.patches
  if (count) count.textContent = `${NUMBER.format(source.length)} Patches`

  if (!source.length) {
    track.innerHTML = '<div class="panel-empty">Keine Timeline-Daten.</div>'
    return
  }

  const maxEvents = Math.max(...source.map((patch) => patch.event_count), 1)
  track.innerHTML = source
    .map((patch) => {
      const height = Math.max(8, Math.round((patch.event_count / maxEvents) * 100))
      const total = Math.max(patch.event_count, 1)
      const selected = state.selectedPatchId === patch.patch_id
      const parts = [
        ['buff', patch.buff_events],
        ['nerf', patch.nerf_events],
        ['fix', patch.fix_events],
        ['rework', patch.rework_events],
        ['other', Math.max(total - patch.buff_events - patch.nerf_events - patch.fix_events - patch.rework_events, 0)],
      ].filter((part) => part[1] > 0)
      const stacks = parts
        .map(([type, value]) => `<span class="timeline-stack is-${type}" style="height:${Math.max(5, (value / total) * 100)}%"></span>`)
        .join('')
      return `
        <button class="timeline-bar ${selected ? 'is-selected' : ''}" style="--bar-height:${height}%" data-patch-id="${escapeHtml(patch.patch_id)}" title="${escapeHtml(patch.title)} · ${NUMBER.format(patch.event_count)} Events">
          <span class="timeline-bar-inner">${stacks}</span>
          <span class="timeline-dot"></span>
        </button>
      `
    })
    .join('')

  track.querySelectorAll('[data-patch-id]').forEach((button) => {
    button.addEventListener('click', () => {
      const patchId = button.dataset.patchId || ''
      state.selectedPatchId = state.selectedPatchId === patchId ? '' : patchId
      render()
    })
  })
}

function renderEntityGrid(entities) {
  const grid = document.getElementById('entity-grid')
  const count = document.getElementById('entity-count')
  if (!grid) return

  const visible = entities
    .filter((entity) => state.filters.entityType === 'all' || entity.entity_type === state.filters.entityType)
    .slice(0, 48)

  if (count) count.textContent = `${NUMBER.format(visible.length)} angezeigt`

  if (!visible.length) {
    grid.innerHTML = '<div class="panel-empty">Keine Entities im Filter.</div>'
    return
  }

  grid.innerHTML = visible
    .map((entity) => {
      const key = entityKey(entity.entity_type, entity.entity_name)
      const selected = key === state.selectedEntityKey
      const image = resolveEntityImage(entity)
      const movement = entity.buff_events - entity.nerf_events
      return `
        <button class="entity-tile ${selected ? 'is-selected' : ''}" data-entity-key="${escapeHtml(key)}">
          <span class="entity-avatar ${image ? 'has-image' : ''}">
            ${image ? `<img src="${escapeHtml(image)}" alt="" loading="lazy" />` : `<span>${escapeHtml(initials(entity.entity_name))}</span>`}
          </span>
          <span class="entity-copy">
            <strong>${escapeHtml(entity.entity_name)}</strong>
            <small>${escapeHtml(ENTITY_LABELS[entity.entity_type] || entity.entity_type)} · ${NUMBER.format(entity.event_count)} Events</small>
          </span>
          <span class="entity-score ${movement > 0 ? 'is-up' : movement < 0 ? 'is-down' : ''}">${formatSigned(movement)}</span>
        </button>
      `
    })
    .join('')

  grid.querySelectorAll('[data-entity-key]').forEach((button) => {
    button.addEventListener('click', () => {
      const key = button.dataset.entityKey || ''
      const entity = visible.find((item) => entityKey(item.entity_type, item.entity_name) === key)
      if (entity && entity.entity_type === 'hero') {
        const slug = heroSlug(entity.entity_name)
        if (HERO_DOCS.has(slug)) {
          window.location.href = `/patch/hero/${slug}.html`
          return
        }
      }
      state.selectedEntityKey = key
      render()
    })
  })
}

function renderDetailPanel(entities, filteredEvents) {
  const panel = document.getElementById('detail-panel')
  if (!panel) return

  const selected = entities.find((entity) => entityKey(entity.entity_type, entity.entity_name) === state.selectedEntityKey) || entities[0]
  if (!selected) {
    panel.innerHTML = '<div class="panel-empty">Keine Detaildaten.</div>'
    return
  }

  const image = resolveEntityImage(selected)
  const events = filteredEvents
    .filter((event) => entityKey(event.entity_type, event.entity_name || 'General') === entityKey(selected.entity_type, selected.entity_name))
    .sort((left, right) => dateMs(right.posted_at) - dateMs(left.posted_at) || right.line_index - left.line_index)
    .slice(0, 10)

  const total = Math.max(selected.event_count, 1)
  const buffShare = Math.round((selected.buff_events / total) * 100)
  const nerfShare = Math.round((selected.nerf_events / total) * 100)
  const mechanicShare = Math.round((selected.mechanic_events / total) * 100)

  panel.innerHTML = `
    <div class="detail-head">
      <span class="detail-avatar ${image ? 'has-image' : ''}">
        ${image ? `<img src="${escapeHtml(image)}" alt="" />` : `<span>${escapeHtml(initials(selected.entity_name))}</span>`}
      </span>
      <div>
        <span class="panel-kicker">${escapeHtml(ENTITY_LABELS[selected.entity_type] || selected.entity_type)}</span>
        <h2>${escapeHtml(selected.entity_name)}</h2>
        <p>${NUMBER.format(selected.patch_count || 0)} Patches · ${NUMBER.format(selected.event_count)} Events · ${NUMBER.format(selected.value_events || 0)} Wert-Deltas</p>
        ${heroDocLink(selected)}
      </div>
    </div>
    <div class="detail-bars">
      <div><span>Buff</span><strong>${NUMBER.format(selected.buff_events)}</strong><i style="--w:${buffShare}%"></i></div>
      <div><span>Nerf</span><strong>${NUMBER.format(selected.nerf_events)}</strong><i style="--w:${nerfShare}%"></i></div>
      <div><span>Mechanik</span><strong>${NUMBER.format(selected.mechanic_events)}</strong><i style="--w:${mechanicShare}%"></i></div>
    </div>
    <div class="detail-latest">
      ${events.length ? events.map(renderCompactEvent).join('') : renderFallbackLatest(selected)}
    </div>
  `
}

function renderCompactEvent(event) {
  return `
    <article class="compact-event">
      <div>
        <time datetime="${escapeHtml(event.posted_at || '')}">${escapeHtml(formatDate(event.posted_at))}</time>
        <span class="change-badge is-${escapeHtml(event.change_type)}">${escapeHtml(CHANGE_LABELS[event.change_type] || event.change_type)}</span>
      </div>
      <p>${escapeHtml(event.normalized_line || event.subject || 'Patch change')}</p>
      ${event.url ? `<a href="${escapeHtml(sanitizeUrl(event.url))}" target="_blank" rel="noopener">Quelle</a>` : ''}
    </article>
  `
}

function renderFallbackLatest(entity) {
  if (!entity.latest_line) return '<div class="panel-empty">Keine Events im aktuellen Filter.</div>'
  return `
    <article class="compact-event">
      <div>
        <time datetime="${escapeHtml(entity.latest_posted_at || '')}">${escapeHtml(formatDate(entity.latest_posted_at))}</time>
        <span class="change-badge is-${escapeHtml(entity.latest_change_type)}">${escapeHtml(CHANGE_LABELS[entity.latest_change_type] || entity.latest_change_type)}</span>
      </div>
      <p>${escapeHtml(entity.latest_line)}</p>
      ${entity.latest_patch_url ? `<a href="${escapeHtml(sanitizeUrl(entity.latest_patch_url))}" target="_blank" rel="noopener">Quelle</a>` : ''}
    </article>
  `
}

function renderEventFeed(events) {
  const feed = document.getElementById('event-feed')
  const count = document.getElementById('event-count')
  if (!feed) return

  let visible = events
  if (state.selectedPatchId) {
    visible = visible.filter((event) => event.patch_id === state.selectedPatchId)
  }

  visible = visible
    .slice()
    .sort((left, right) => dateMs(right.posted_at) - dateMs(left.posted_at) || right.line_index - left.line_index)

  if (count) count.textContent = `${NUMBER.format(visible.length)} Events`

  if (!visible.length) {
    feed.innerHTML = '<div class="panel-empty">Keine Events im Filter.</div>'
    return
  }

  feed.innerHTML = visible.slice(0, 90).map(renderEventRow).join('')
}

function renderEventRow(event) {
  const values = event.old_value || event.new_value
    ? `<span class="value-delta">${escapeHtml(event.old_value || '-')} → ${escapeHtml(event.new_value || '-')}</span>`
    : ''
  const entity = event.entity_name || event.subject || event.section || 'General'
  const sourceUrl = sanitizeUrl(event.url)
  return `
    <article class="event-row">
      <div class="event-row-meta">
        <time datetime="${escapeHtml(event.posted_at || '')}">${escapeHtml(formatDate(event.posted_at))}</time>
        <span class="change-badge is-${escapeHtml(event.change_type)}">${escapeHtml(CHANGE_LABELS[event.change_type] || event.change_type)}</span>
        <span>${escapeHtml(event.source_kind)}</span>
      </div>
      <div class="event-row-main">
        <strong>${escapeHtml(entity)}</strong>
        <p>${escapeHtml(event.normalized_line || event.subject || 'Patch change')}</p>
      </div>
      <div class="event-row-side">
        ${values}
        ${sourceUrl ? `<a href="${escapeHtml(sourceUrl)}" target="_blank" rel="noopener">Link</a>` : ''}
      </div>
    </article>
  `
}

function renderLatestPatch() {
  const title = document.getElementById('latest-patch-title')
  const meta = document.getElementById('latest-patch-meta')
  const link = document.getElementById('latest-patch-link')
  const patch = latestPatch(state.patches)
  if (!patch) return

  if (title) title.textContent = patch.title
  if (meta) meta.textContent = `${formatDate(patch.posted_at)} · ${NUMBER.format(patch.event_count)} Events`
  if (link) {
    const url = sanitizeUrl(patch.url)
    link.hidden = !url
    if (url) link.href = url
  }
}

function getFilteredEvents() {
  if (!state.events.length) return []
  return state.events.filter((event) => {
    if (state.filters.entityType !== 'all' && event.entity_type !== state.filters.entityType) return false
    if (state.filters.changeType !== 'all' && event.change_type !== state.filters.changeType) return false
    if (state.filters.source !== 'all' && event.source_kind !== state.filters.source) return false
    if (!state.filters.search) return true

    const haystack = [
      event.patch_title,
      event.entity_name,
      event.subject,
      event.section,
      event.change_type,
      event.normalized_line,
      event.old_value,
      event.new_value,
    ]
      .join(' ')
      .toLowerCase()
    return haystack.includes(state.filters.search)
  })
}

function buildPatchStats(events) {
  if (!events.length) return state.patches
  const map = new Map()
  events.forEach((event) => {
    const current = map.get(event.patch_id) || {
      patch_id: event.patch_id,
      title: event.patch_title,
      url: event.url,
      source_kind: event.source_kind,
      posted_at: event.posted_at,
      event_count: 0,
      hero_events: 0,
      item_events: 0,
      ability_events: 0,
      general_events: 0,
      buff_events: 0,
      nerf_events: 0,
      fix_events: 0,
      rework_events: 0,
      value_events: 0,
      top_entities: [],
    }
    current.event_count += 1
    current[`${event.entity_type}_events`] = (current[`${event.entity_type}_events`] || 0) + 1
    if (event.change_type === 'buff') current.buff_events += 1
    if (event.change_type === 'nerf') current.nerf_events += 1
    if (event.change_type === 'fix') current.fix_events += 1
    if (event.change_type === 'rework') current.rework_events += 1
    if (event.old_value || event.new_value) current.value_events += 1
    map.set(event.patch_id, current)
  })
  return [...map.values()].sort((left, right) => dateMs(left.posted_at) - dateMs(right.posted_at))
}

function buildEntityStats(events) {
  if (!events.length) return []
  const map = new Map()
  events.forEach((event) => {
    const name = event.entity_name || event.subject || 'General'
    const key = entityKey(event.entity_type, name)
    const current = map.get(key) || {
      entity_type: event.entity_type,
      entity_name: name,
      event_count: 0,
      patch_count: 0,
      patches: new Set(),
      first_posted_at: event.posted_at,
      latest_posted_at: event.posted_at,
      buff_events: 0,
      nerf_events: 0,
      fix_events: 0,
      mechanic_events: 0,
      added_events: 0,
      removed_events: 0,
      value_events: 0,
    }
    current.event_count += 1
    current.patches.add(event.patch_id)
    current.patch_count = current.patches.size
    if (dateMs(event.posted_at) < dateMs(current.first_posted_at)) current.first_posted_at = event.posted_at
    if (dateMs(event.posted_at) > dateMs(current.latest_posted_at)) current.latest_posted_at = event.posted_at
    if (event.change_type === 'buff') current.buff_events += 1
    if (event.change_type === 'nerf') current.nerf_events += 1
    if (event.change_type === 'fix') current.fix_events += 1
    if (event.change_type === 'mechanic_change') current.mechanic_events += 1
    if (event.change_type === 'added') current.added_events += 1
    if (event.change_type === 'removed') current.removed_events += 1
    if (event.old_value || event.new_value) current.value_events += 1
    map.set(key, current)
  })

  return [...map.values()]
    .map((entity) => ({ ...entity, patches: undefined }))
    .sort((left, right) => right.event_count - left.event_count || right.patch_count - left.patch_count || left.entity_name.localeCompare(right.entity_name, 'de'))
}

function latestPatch(patches) {
  return patches
    .filter((patch) => patch.posted_at)
    .slice()
    .sort((left, right) => dateMs(right.posted_at) - dateMs(left.posted_at))[0]
}

function activeFilterLabel() {
  const labels = []
  if (state.filters.entityType !== 'all') labels.push(ENTITY_LABELS[state.filters.entityType])
  if (state.filters.changeType !== 'all') labels.push(CHANGE_LABELS[state.filters.changeType])
  if (state.filters.source !== 'all') labels.push(state.filters.source)
  return labels.length ? labels.join(' · ') : 'Alle Filter'
}

function hasActiveFilters() {
  return Boolean(
    state.filters.entityType !== 'all' ||
      state.filters.changeType !== 'all' ||
      state.filters.source !== 'all' ||
      state.filters.search,
  )
}

function resolveEntityImage(entity) {
  const type = entity.entity_type === 'hero' ? 'hero' : entity.entity_type === 'item' ? 'item' : ''
  if (!type) return ''
  return state.assets[type].get(normalizeKey(entity.entity_name))?.image || ''
}

function setStatus(text) {
  const status = document.getElementById('data-status')
  if (status) status.textContent = text
}

function sourceFromUrl(url) {
  const value = String(url ?? '').toLowerCase()
  if (value.includes('store.steampowered.com')) return 'steam'
  if (value.includes('forums.playdeadlock.com')) return 'forum'
  return 'other'
}

function estimateChangeLines(content) {
  return String(content ?? '')
    .split('\n')
    .filter((line) => line.trim().startsWith('- '))
    .length
}

function normalizePath(pathname) {
  if (!pathname) return '/'
  const clean = pathname.endsWith('/') ? pathname : `${pathname}/`
  return clean.replace(/\/+/g, '/')
}

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function setActiveNav() {
  const current = normalizePath(window.location.pathname)
  document.querySelectorAll('[data-nav-link]').forEach((link) => {
    const target = normalizePath(link.getAttribute('href'))
    const active = target === current
    link.classList.toggle('is-active', active)
    if (active) {
      link.setAttribute('aria-current', 'page')
    } else {
      link.removeAttribute('aria-current')
    }
  })
}

function setupNavDrawer() {
  const toggle = document.querySelector('[data-menu-toggle]')
  const drawer = document.getElementById('nav-drawer')
  if (!toggle || !drawer) return

  const iconMenu = toggle.querySelector('.icon-menu')
  const iconClose = toggle.querySelector('.icon-close')

  function setDrawerState(open) {
    toggle.setAttribute('aria-expanded', String(open))
    toggle.setAttribute('aria-label', open ? 'Menü schließen' : 'Menü öffnen')
    drawer.classList.toggle('is-open', open)
    drawer.setAttribute('aria-hidden', String(!open))
    document.body.classList.toggle('menu-open', open)
    if (iconMenu && iconClose) {
      iconMenu.style.display = open ? 'none' : ''
      iconClose.style.display = open ? '' : 'none'
    }
  }

  toggle.addEventListener('click', () => {
    setDrawerState(!drawer.classList.contains('is-open'))
  })

  drawer.querySelectorAll('.nav-drawer-link, .nav-drawer-cta').forEach((link) => {
    link.addEventListener('click', () => setDrawerState(false))
  })

  drawer.querySelector('[data-menu-backdrop]')?.addEventListener('click', () => {
    setDrawerState(false)
  })

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && drawer.classList.contains('is-open')) {
      setDrawerState(false)
    }
  })
}

function setupReveal() {
  const reduceMotion = prefersReducedMotion()
  const items = document.querySelectorAll('[data-reveal]')

  if (reduceMotion || !('IntersectionObserver' in window)) {
    items.forEach((item) => item.classList.add('is-visible'))
    return
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible')
          observer.unobserve(entry.target)
        }
      })
    },
    { rootMargin: '0px 0px -10% 0px', threshold: 0.15 },
  )

  items.forEach((item) => observer.observe(item))
}

function entityKey(type, name) {
  return `${type}:${normalizeKey(name)}`
}

function normalizeKey(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function normalizeDateValue(raw) {
  if (!raw) return null
  if (/^\d+$/.test(String(raw).trim())) {
    return new Date(Number.parseInt(raw, 10) * 1000).toISOString()
  }
  const date = new Date(raw)
  return Number.isNaN(date.getTime()) ? String(raw) : date.toISOString()
}

function dateMs(raw) {
  if (!raw) return 0
  const date = new Date(raw)
  return Number.isNaN(date.getTime()) ? 0 : date.getTime()
}

function formatDate(raw) {
  if (!raw) return '-'
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return String(raw)
  return DATE_SHORT.format(date)
}

function formatSigned(value) {
  const number = Number(value)
  if (!Number.isFinite(number) || number === 0) return '0'
  return number > 0 ? `+${NUMBER.format(number)}` : NUMBER.format(number)
}

function initials(value) {
  const words = String(value ?? '').trim().split(/\s+/).filter(Boolean)
  if (!words.length) return '?'
  return words.slice(0, 2).map((word) => word[0]).join('').toUpperCase()
}

function toNumber(value) {
  const number = Number(value ?? 0)
  return Number.isFinite(number) ? number : 0
}

function sanitizeUrl(value) {
  try {
    const url = new URL(String(value ?? ''))
    if (url.protocol === 'http:' || url.protocol === 'https:') return url.toString()
  } catch {
    return ''
  }
  return ''
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
