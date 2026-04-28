import './main.css'

import {
  fetchHeroCatalog,
  fetchTierlistHistory,
  formatPercent,
  formatUnixDateTime,
  getInitialBucket,
  normalizeBucket,
  persistBucket,
  resolveHeroCatalog,
  syncBucketInUrl,
} from './shared.js'

const FALLBACK_TOAST = 'Live-API nicht erreichbar — zeige statische Snapshot-Daten'

const state = {
  bucket: getInitialBucket(),
  snapshots: [],
  heroCatalog: new Map(),
  toastTimer: 0,
}

function qs(id) {
  return document.getElementById(id)
}

function showToast(message, isError = false) {
  const toast = qs('toast')
  if (!toast) {
    return
  }

  if (state.toastTimer) {
    window.clearTimeout(state.toastTimer)
  }

  toast.textContent = message
  toast.classList.toggle('is-error', isError)
  toast.classList.add('is-visible')
  state.toastTimer = window.setTimeout(() => {
    toast.classList.remove('is-visible')
  }, 3200)
}

function getHeroInitial(name) {
  return String(name ?? '?')
    .trim()
    .slice(0, 1)
    .toUpperCase()
}

function createHeroVisual(heroInfo) {
  if (heroInfo?.image_url) {
    const image = document.createElement('img')
    image.className = 'history-row__image'
    image.src = heroInfo.image_url
    image.alt = `${heroInfo.name} Portrait`
    image.loading = 'lazy'
    image.decoding = 'async'
    image.onerror = () => {
      image.replaceWith(createHeroPlaceholder(heroInfo.name))
    }
    return image
  }

  return createHeroPlaceholder(heroInfo?.name)
}

function createHeroPlaceholder(name) {
  const placeholder = document.createElement('div')
  placeholder.className = 'history-row__image is-placeholder'
  placeholder.textContent = getHeroInitial(name)
  placeholder.setAttribute('aria-label', `${name ?? 'Hero'} Platzhalter`)
  return placeholder
}

function createTierBadge(tier, modifier = '') {
  const badge = document.createElement('span')
  badge.className = `tier-badge${modifier ? ` ${modifier}` : ''}`
  badge.textContent = String(tier ?? '?')
  badge.style.setProperty(
    '--tier-accent',
    `var(--tier-${String(tier ?? 'c').toLowerCase().replace('+', 'plus')})`,
  )
  return badge
}

function renderHistory() {
  const container = qs('history-container')
  container.innerHTML = ''

  if (!state.snapshots.length) {
    container.innerHTML = '<div class="empty-state">Noch keine Snapshots vorhanden.</div>'
    return
  }

  const fragment = document.createDocumentFragment()

  state.snapshots.forEach((snapshot, index) => {
    const olderSnapshot = state.snapshots[index + 1]
    const olderTierByHero = new Map(
      Array.isArray(olderSnapshot?.heroes)
        ? olderSnapshot.heroes.map((hero) => [String(hero.hero_id), hero.tier])
        : [],
    )

    const section = document.createElement('section')
    section.className = 'snapshot-card'

    const header = document.createElement('div')
    header.className = 'snapshot-card__header'

    const title = document.createElement('div')
    title.className = 'snapshot-card__title'
    title.innerHTML = `
      <h2>${formatUnixDateTime(snapshot.fetched_at)}</h2>
      <p>Patch ${snapshot.patch_id ?? 'unbekannt'} · Snapshot #${snapshot.snapshot_id}</p>
    `

    const meta = document.createElement('span')
    meta.className = 'snapshot-card__count'
    meta.textContent = `${Array.isArray(snapshot.heroes) ? snapshot.heroes.length : 0} Heroes`

    header.append(title, meta)
    section.append(header)

    const list = document.createElement('div')
    list.className = 'snapshot-list'

    if (!Array.isArray(snapshot.heroes) || !snapshot.heroes.length) {
      list.innerHTML = '<p class="panel-empty">Keine Hero-Daten in diesem Snapshot.</p>'
    } else {
      snapshot.heroes.forEach((hero) => {
        const heroInfo =
          state.heroCatalog.get(String(hero.hero_id)) ?? {
            name: `Hero #${hero.hero_id}`,
            image_url: '',
          }
        const olderTier = olderTierByHero.get(String(hero.hero_id))
        const hasTierChange = olderTier && olderTier !== hero.tier

        const row = document.createElement('article')
        row.className = 'history-row'
        row.classList.toggle('history-row--changed', Boolean(hasTierChange))

        const heroCell = document.createElement('div')
        heroCell.className = 'history-row__hero'
        heroCell.append(createHeroVisual(heroInfo))

        const heroText = document.createElement('div')
        heroText.className = 'history-row__hero-copy'
        heroText.innerHTML = `
          <strong>${heroInfo.name}</strong>
          <span>Hero ID ${hero.hero_id}</span>
        `
        heroCell.append(heroText)

        const wr = document.createElement('span')
        wr.className = 'history-row__wr'
        wr.textContent = formatPercent(hero.wr)

        const tiers = document.createElement('div')
        tiers.className = 'history-row__tiers'
        if (hasTierChange) {
          const arrow = document.createElement('span')
          arrow.className = 'history-row__arrow'
          arrow.textContent = '→'
          tiers.append(createTierBadge(olderTier, 'tier-badge--old'), arrow, createTierBadge(hero.tier))
        } else {
          tiers.append(createTierBadge(hero.tier))
        }

        row.append(heroCell, wr, tiers)
        list.append(row)
      })
    }

    section.append(list)
    fragment.append(section)
  })

  container.append(fragment)
}

function syncControls() {
  qs('history-bucket-select').value = normalizeBucket(state.bucket)
}

async function loadHistoryForBucket(bucket) {
  state.bucket = normalizeBucket(bucket)
  persistBucket(state.bucket)
  syncBucketInUrl(state.bucket)
  qs('history-container').innerHTML = '<div class="loading-state">Lade Verlauf…</div>'

  try {
    const [historyResult, heroesResult] = await Promise.all([
      fetchTierlistHistory(state.bucket),
      fetchHeroCatalog(),
    ])

    state.snapshots = Array.isArray(historyResult.data?.snapshots) ? historyResult.data.snapshots : []
    state.heroCatalog = resolveHeroCatalog(heroesResult.data)
    renderHistory()

    if (historyResult.source !== 'live' || heroesResult.source !== 'live') {
      showToast(FALLBACK_TOAST, true)
    }
  } catch {
    qs('history-container').innerHTML =
      '<div class="error-state">Verlauf konnte nicht geladen werden.</div>'
  }
}

function bindEvents() {
  qs('history-bucket-select').addEventListener('change', (event) => {
    void loadHistoryForBucket(event.target.value)
  })
}

async function boot() {
  qs('year').textContent = String(new Date().getFullYear())
  syncControls()
  bindEvents()
  await loadHistoryForBucket(state.bucket)
}

void boot()
