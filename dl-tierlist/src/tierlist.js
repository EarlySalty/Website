import './main.css'

import {
  BUCKET_OPTIONS,
  fetchTierlist,
  formatMatches,
  formatPercent,
  formatUnixDate,
  formatUnixDateTime,
  formatWinrateDelta,
  getInitialBucket,
  getInitialViewMode,
  normalizeBucket,
  persistBucket,
  persistViewMode,
  postBuildVote,
  syncBucketInUrl,
} from './shared.js'

const FALLBACK_TOAST = 'Backend offline — zeige zuletzt gespeicherte Tierliste'
const BUILD_LINK_BASE = 'https://www.deadlock-api.com/builds/'

const state = {
  bucket: getInitialBucket(),
  viewMode: getInitialViewMode(),
  search: '',
  tierlist: null,
  activeHeroId: null,
  activeTierKey: null,
  pendingVotes: new Set(),
  toastTimer: 0,
}

function qs(id) {
  return document.getElementById(id)
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function sanitizeUrl(value) {
  try {
    const url = new URL(value)
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return url.toString()
    }
  } catch {
    // Ignore invalid URLs.
  }

  return ''
}

function renderInlineMarkdown(text) {
  return escapeHtml(text)
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_, label, url) => {
      const safeUrl = sanitizeUrl(url)
      if (!safeUrl) {
        return escapeHtml(label)
      }

      return `<a href="${safeUrl}" target="_blank" rel="noreferrer noopener">${label}</a>`
    })
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/_([^_]+)_/g, '<em>$1</em>')
}

function renderMiniMarkdown(source) {
  const text = String(source ?? '').trim()
  if (!text) {
    return '<p class="panel-empty">Keine Beschreibung vorhanden.</p>'
  }

  return text
    .split(/\n{2,}/)
    .filter(Boolean)
    .map((paragraph) => `<p>${renderInlineMarkdown(paragraph).replace(/\n/g, '<br>')}</p>`)
    .join('')
}

function getVoteStorageKey(buildId) {
  return `vote_${buildId}`
}

function hasVoted(buildId) {
  try {
    return Boolean(window.localStorage.getItem(getVoteStorageKey(buildId)))
  } catch {
    return false
  }
}

function markVoted(buildId, vote) {
  try {
    window.localStorage.setItem(getVoteStorageKey(buildId), vote)
  } catch {
    // Ignore storage failures.
  }
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

function createHeroMedia(hero, className = 'tier-card__image') {
  if (hero.image_url) {
    const img = document.createElement('img')
    img.className = className
    img.src = hero.image_url
    img.alt = `${hero.name} Portrait`
    img.loading = 'lazy'
    img.decoding = 'async'
    img.onerror = () => {
      img.replaceWith(createHeroPlaceholder(hero, `${className} is-placeholder`))
    }
    return img
  }

  return createHeroPlaceholder(hero, `${className} is-placeholder`)
}

function createHeroPlaceholder(hero, className) {
  const placeholder = document.createElement('div')
  placeholder.className = className
  placeholder.textContent = getHeroInitial(hero.name)
  placeholder.setAttribute('aria-label', `${hero.name} Platzhalter`)
  return placeholder
}

function getTierRangeLabel(tier) {
  if (!tier) {
    return '—'
  }

  if (Number.isFinite(tier.min_wr) && tier.max_wr == null) {
    return `≥ ${Number(tier.min_wr).toFixed(0)}% WR`
  }

  if (Number.isFinite(tier.min_wr) && Number.isFinite(tier.max_wr)) {
    return `${Number(tier.min_wr).toFixed(0)}–${Number(tier.max_wr).toFixed(0)}% WR`
  }

  if (tier.max_wr != null) {
    return `< ${Number(tier.max_wr).toFixed(0)}% WR`
  }

  return '—'
}

function getAllHeroes() {
  return Array.isArray(state.tierlist?.tiers)
    ? state.tierlist.tiers.flatMap((tier) => tier.heroes ?? [])
    : []
}

function findHero(heroId) {
  return getAllHeroes().find((hero) => String(hero.hero_id) === String(heroId)) ?? null
}

function findBuild(buildId) {
  for (const hero of getAllHeroes()) {
    const build = (hero.builds ?? []).find((item) => Number(item.build_id) === Number(buildId))
    if (build) {
      return build
    }
  }
  return null
}

function matchesSearch(hero, query) {
  if (!query) {
    return true
  }

  const needle = query.trim().toLowerCase()
  if (!needle) {
    return true
  }

  return [hero.name, hero.slug]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(needle))
}

function closePanel() {
  if (!state.activeHeroId) {
    return
  }

  state.activeHeroId = null
  state.activeTierKey = null
  renderTierlist()
}

function openPanel(hero, tierKey) {
  if (String(state.activeHeroId) === String(hero.hero_id)) {
    closePanel()
    return
  }

  state.activeHeroId = hero.hero_id
  state.activeTierKey = tierKey
  renderTierlist()
}

async function copyBuildLink(buildId) {
  const link = `${BUILD_LINK_BASE}${buildId}`
  try {
    await navigator.clipboard.writeText(link)
    showToast(`Build-Link kopiert: ${buildId}`)
  } catch {
    showToast('Build-Link konnte nicht kopiert werden', true)
  }
}

async function submitVote(buildId, vote) {
  if (hasVoted(buildId) || state.pendingVotes.has(buildId)) {
    return
  }

  state.pendingVotes.add(buildId)
  renderTierlist()

  try {
    const payload = await postBuildVote(buildId, vote)
    const build = findBuild(buildId)
    if (build) {
      build.upvotes = Number(payload?.upvotes ?? build.upvotes ?? 0)
      build.downvotes = Number(payload?.downvotes ?? build.downvotes ?? 0)
    }
    markVoted(buildId, vote)
    showToast(vote === 'up' ? 'Build positiv bewertet' : 'Build negativ bewertet')
  } catch (error) {
    if (error?.status === 429) {
      showToast('Vote-Limit erreicht — bitte kurz warten', true)
    } else if (error?.status === 404) {
      showToast('Build nicht gefunden', true)
    } else {
      showToast('Vote konnte nicht gespeichert werden', true)
    }
  } finally {
    state.pendingVotes.delete(buildId)
    renderTierlist()
  }
}

function createBuildCard(build) {
  const voted = hasVoted(build.build_id)
  const pending = state.pendingVotes.has(build.build_id)
  const card = document.createElement('article')
  card.className = 'build-card'

  const head = document.createElement('div')
  head.className = 'build-card__head'

  const nameButton = document.createElement('button')
  nameButton.type = 'button'
  nameButton.className = 'build-card__name'
  nameButton.textContent = `${build.build_name} (${build.build_id})`
  nameButton.addEventListener('click', () => {
    void copyBuildLink(build.build_id)
  })

  const author = document.createElement('span')
  author.className = 'build-card__author'
  author.textContent = `von ${build.author_name}`

  head.append(nameButton, author)
  card.append(head)

  const votes = document.createElement('div')
  votes.className = 'build-card__votes'

  const up = document.createElement('button')
  up.type = 'button'
  up.className = 'vote-button'
  up.textContent = `👍 ${Number(build.upvotes ?? 0)}`
  up.disabled = voted || pending
  up.title = voted ? 'Bereits abgestimmt' : 'Build positiv bewerten'
  up.addEventListener('click', () => {
    void submitVote(build.build_id, 'up')
  })

  const down = document.createElement('button')
  down.type = 'button'
  down.className = 'vote-button vote-button--down'
  down.textContent = `👎 ${Number(build.downvotes ?? 0)}`
  down.disabled = voted || pending
  down.title = voted ? 'Bereits abgestimmt' : 'Build negativ bewerten'
  down.addEventListener('click', () => {
    void submitVote(build.build_id, 'down')
  })

  votes.append(up, down)
  card.append(votes)

  if (voted) {
    const hint = document.createElement('p')
    hint.className = 'build-card__hint'
    hint.textContent = 'Bereits abgestimmt'
    card.append(hint)
  }

  return card
}

function createStreamerLink(streamer) {
  const link = document.createElement('a')
  link.className = 'streamer-button'
  link.href = `https://twitch.tv/${streamer.twitch_login}`
  link.target = '_blank'
  link.rel = 'noreferrer noopener'
  link.textContent = streamer.display_name
  link.title = `Twitch: ${streamer.twitch_login}`
  return link
}

function createPanel(hero) {
  const panel = document.createElement('section')
  panel.className = 'hero-panel'
  panel.dataset.heroPanel = 'true'

  const header = document.createElement('div')
  header.className = 'hero-panel__header'

  const heroSummary = document.createElement('div')
  heroSummary.className = 'hero-panel__hero'
  heroSummary.append(createHeroMedia(hero, 'hero-panel__image'))

  const copy = document.createElement('div')
  copy.className = 'hero-panel__copy'

  const title = document.createElement('h2')
  title.textContent = hero.name

  const stats = document.createElement('div')
  stats.className = 'hero-panel__stats'

  const wr = document.createElement('span')
  wr.className = 'stat-pill'
  wr.textContent = `Winrate ${formatPercent(hero.wr)}`

  const delta = formatWinrateDelta(hero.wr_change)
  const change = document.createElement('span')
  change.className = `stat-pill stat-pill--${delta.tone}`
  change.textContent = `Δ ${delta.text}`

  const matches = document.createElement('span')
  matches.className = 'stat-pill'
  matches.textContent = `${formatMatches(hero.matches)} Matches`

  stats.append(wr, change, matches)
  copy.append(title, stats)
  heroSummary.append(copy)

  const close = document.createElement('button')
  close.type = 'button'
  close.className = 'hero-panel__close'
  close.textContent = 'Schließen'
  close.addEventListener('click', closePanel)

  header.append(heroSummary, close)
  panel.append(header)

  const body = document.createElement('div')
  body.className = 'hero-panel__body'

  const description = document.createElement('section')
  description.className = 'panel-section'
  description.innerHTML = `
    <div class="panel-section__head">
      <h3>Hero Notes</h3>
    </div>
    <div class="panel-section__content markdown-content">${renderMiniMarkdown(hero.description)}</div>
  `

  const buildsSection = document.createElement('section')
  buildsSection.className = 'panel-section'
  const buildsHead = document.createElement('div')
  buildsHead.className = 'panel-section__head'
  buildsHead.innerHTML = '<h3>Recommended Builds</h3>'
  buildsSection.append(buildsHead)

  const buildsBody = document.createElement('div')
  buildsBody.className = 'panel-grid'
  if (Array.isArray(hero.builds) && hero.builds.length) {
    hero.builds.forEach((build) => buildsBody.append(createBuildCard(build)))
  } else {
    buildsBody.innerHTML = '<p class="panel-empty">Keine Builds hinterlegt.</p>'
  }
  buildsSection.append(buildsBody)

  const streamersSection = document.createElement('section')
  streamersSection.className = 'panel-section'
  const streamersHead = document.createElement('div')
  streamersHead.className = 'panel-section__head'
  streamersHead.innerHTML = '<h3>Players to Watch</h3>'
  streamersSection.append(streamersHead)

  const streamersBody = document.createElement('div')
  streamersBody.className = 'streamer-list'
  if (Array.isArray(hero.streamers) && hero.streamers.length) {
    hero.streamers.forEach((streamer) => streamersBody.append(createStreamerLink(streamer)))
  } else {
    streamersBody.innerHTML = '<p class="panel-empty">Keine Streamer hinterlegt.</p>'
  }
  streamersSection.append(streamersBody)

  body.append(description, buildsSection, streamersSection)
  panel.append(body)
  return panel
}

function createHeroCard(hero, tierKey) {
  const isMatch = matchesSearch(hero, state.search)
  const delta = formatWinrateDelta(hero.wr_change)
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'tier-card'
  button.dataset.heroCard = 'true'
  button.dataset.heroId = String(hero.hero_id)
  button.dataset.tierKey = tierKey
  button.classList.toggle('is-dimmed', !isMatch)
  button.classList.toggle('is-active', String(state.activeHeroId) === String(hero.hero_id))
  button.setAttribute('aria-pressed', String(state.activeHeroId) === String(hero.hero_id) ? 'true' : 'false')
  button.addEventListener('click', () => openPanel(hero, tierKey))

  button.append(createHeroMedia(hero))

  const name = document.createElement('span')
  name.className = 'tier-card__name'
  name.textContent = hero.name

  const stats = document.createElement('span')
  stats.className = 'tier-card__stats'

  const wr = document.createElement('span')
  wr.className = 'stat-pill'
  wr.textContent = formatPercent(hero.wr)

  const change = document.createElement('span')
  change.className = `stat-pill stat-pill--${delta.tone}`
  change.textContent = delta.text

  stats.append(wr, change)
  button.append(name, stats)
  return button
}

function renderSummary() {
  qs('patch-date').textContent = formatUnixDate(state.tierlist?.patch_unix)
  qs('last-updated-date').textContent = formatUnixDateTime(state.tierlist?.last_updated)
  qs('min-matches').textContent = formatMatches(state.tierlist?.min_matches)

  const description = qs('tierlist-description')
  const text = String(state.tierlist?.description ?? '').trim()
  description.textContent = text || 'Automatisch gruppiert nach aktueller Winrate im gewählten Skill-Bucket.'
}

function renderTierlist() {
  const container = qs('tierlist-container')
  const tiers = Array.isArray(state.tierlist?.tiers) ? state.tierlist.tiers : []

  document.body.classList.toggle('is-list-mode', state.viewMode === 'list')
  document.body.classList.toggle('is-grid-mode', state.viewMode !== 'list')

  if (!tiers.length) {
    container.innerHTML = '<div class="empty-state">Keine Tierdaten vorhanden.</div>'
    return
  }

  container.innerHTML = ''
  const fragment = document.createDocumentFragment()

  tiers.forEach((tier) => {
    const section = document.createElement('section')
    section.className = 'tier-band'
    section.dataset.tierKey = tier.key
    section.style.setProperty('--tier-accent', `var(--tier-${String(tier.key).toLowerCase().replace('+', 'plus')})`)

    const header = document.createElement('div')
    header.className = 'tier-band__header'

    const headline = document.createElement('div')
    headline.className = 'tier-band__headline'

    const key = document.createElement('span')
    key.className = 'tier-band__key'
    key.textContent = tier.key

    const copy = document.createElement('div')
    copy.className = 'tier-band__copy'

    const title = document.createElement('strong')
    title.textContent = String(tier.title ?? tier.key).toUpperCase()

    const range = document.createElement('span')
    range.textContent = getTierRangeLabel(tier)

    copy.append(title, range)
    headline.append(key, copy)

    const count = document.createElement('span')
    count.className = 'tier-band__count'
    count.textContent = `${Array.isArray(tier.heroes) ? tier.heroes.length : 0} Heroes`

    header.append(headline, count)
    section.append(header)

    const body = document.createElement('div')
    body.className = 'tier-band__body'

    if (!Array.isArray(tier.heroes) || tier.heroes.length === 0) {
      body.innerHTML = '<p class="panel-empty">Keine Heroes in diesem Tier.</p>'
    } else {
      tier.heroes.forEach((hero) => {
        body.append(createHeroCard(hero, tier.key))
      })
    }

    section.append(body)

    if (String(state.activeTierKey) === String(tier.key) && state.activeHeroId != null) {
      const hero = (tier.heroes ?? []).find(
        (item) => String(item.hero_id) === String(state.activeHeroId),
      )

      if (hero) {
        section.append(createPanel(hero))
      }
    }

    fragment.append(section)
  })

  container.append(fragment)
}

function syncControls() {
  qs('bucket-select').value = normalizeBucket(state.bucket)

  const gridButton = qs('view-grid')
  const listButton = qs('view-list')
  const isList = state.viewMode === 'list'
  gridButton.classList.toggle('is-active', !isList)
  listButton.classList.toggle('is-active', isList)
}

async function loadTierlistForBucket(bucket) {
  state.bucket = normalizeBucket(bucket)
  persistBucket(state.bucket)
  syncBucketInUrl(state.bucket)
  state.activeHeroId = null
  state.activeTierKey = null

  const container = qs('tierlist-container')
  container.innerHTML = '<div class="loading-state">Lade Tierliste…</div>'

  try {
    const result = await fetchTierlist(state.bucket)
    state.tierlist = result.data
    renderSummary()
    renderTierlist()

    if (result.source !== 'live') {
      showToast(FALLBACK_TOAST, result.source === 'static')
    }
  } catch {
    container.innerHTML =
      '<div class="error-state">Tierliste konnte nicht geladen werden.</div>'
  }
}

function bindEvents() {
  qs('bucket-select').addEventListener('change', (event) => {
    void loadTierlistForBucket(event.target.value)
  })

  qs('hero-search').addEventListener('input', (event) => {
    state.search = event.target.value

    if (state.activeHeroId) {
      const hero = findHero(state.activeHeroId)
      if (hero && !matchesSearch(hero, state.search)) {
        state.activeHeroId = null
        state.activeTierKey = null
      }
    }

    renderTierlist()
  })

  document.querySelectorAll('[data-view-mode]').forEach((button) => {
    button.addEventListener('click', () => {
      const nextMode = button.getAttribute('data-view-mode') === 'list' ? 'list' : 'grid'
      if (state.viewMode === nextMode) {
        return
      }

      state.viewMode = nextMode
      persistViewMode(nextMode)
      syncControls()
      renderTierlist()
    })
  })

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closePanel()
    }
  })

  document.addEventListener('mousedown', (event) => {
    if (!state.activeHeroId) {
      return
    }

    const target = event.target
    if (!(target instanceof Element)) {
      return
    }

    if (target.closest('[data-hero-card="true"]') || target.closest('[data-hero-panel="true"]')) {
      return
    }

    closePanel()
  })
}

async function boot() {
  qs('year').textContent = String(new Date().getFullYear())
  syncControls()
  bindEvents()
  await loadTierlistForBucket(state.bucket)
}

void boot()
