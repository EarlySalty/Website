import './main.css'

const DEFAULT_TIER_COLORS = {
  s: 'var(--tier-s)',
  a: 'var(--tier-a)',
  b: 'var(--tier-b)',
  c: 'var(--tier-c)',
}

async function loadHistory() {
  const res = await fetch('/data/history.json')
  if (!res.ok) {
    throw new Error('History request failed')
  }

  return res.json()
}

function formatDate(isoString) {
  const date = new Date(isoString)
  if (Number.isNaN(date.getTime())) {
    return 'Unbekanntes Datum'
  }

  return date.toLocaleDateString('de-DE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function normalizeGroups(source) {
  if (Array.isArray(source)) {
    return source
  }

  if (Array.isArray(source?.history)) {
    return source.history
  }

  if (Array.isArray(source?.entries)) {
    return source.entries
  }

  return []
}

function normalizeChanges(group) {
  if (Array.isArray(group?.changes)) {
    return group.changes
  }

  if (Array.isArray(group?.entries)) {
    return group.entries
  }

  return []
}

function getTierColor(name, color) {
  if (color) {
    return color
  }

  return DEFAULT_TIER_COLORS[String(name ?? '').trim().toLowerCase()] ?? 'var(--tier-c)'
}

function tierBadge(tier, color) {
  const badge = document.createElement('span')
  badge.className = 'tier-badge'
  badge.textContent = String(tier ?? '?')
  badge.style.background = getTierColor(tier, color)
  return badge
}

function getHeroInitial(name) {
  return String(name ?? '?')
    .trim()
    .slice(0, 1)
    .toUpperCase()
}

function createHeroVisual(change) {
  const hero = change.hero ?? {}
  const name = change.heroName ?? hero.name ?? change.name ?? 'Unbekannter Hero'
  const image = change.heroImage ?? hero.image ?? hero.icon ?? change.image ?? ''

  const wrap = document.createElement('div')
  wrap.className = 'change-hero'

  const fallback = () => {
    const placeholder = document.createElement('div')
    placeholder.className = 'hero-portrait-placeholder'
    placeholder.textContent = getHeroInitial(name)
    return placeholder
  }

  if (image) {
    const img = document.createElement('img')
    img.className = 'hero-portrait'
    img.src = image
    img.alt = `${name} Portrait`
    img.loading = 'lazy'
    img.decoding = 'async'
    img.onerror = () => {
      img.replaceWith(fallback())
    }
    wrap.append(img)
  } else {
    wrap.append(fallback())
  }

  const text = document.createElement('span')
  text.className = 'change-hero-name'
  text.textContent = name
  wrap.append(text)

  return wrap
}

function renderHistory(entries) {
  const container = document.getElementById('history-container')
  const groups = normalizeGroups(entries)
  container.innerHTML = ''

  if (!groups.length) {
    container.innerHTML = '<div class="empty-state">Noch keine Änderungen aufgezeichnet.</div>'
    return
  }

  const fragment = document.createDocumentFragment()

  groups.forEach((group, index) => {
    const section = document.createElement('section')
    section.className = 'patch-group'

    const header = document.createElement('div')
    header.className = 'patch-header'

    const title = document.createElement('h2')
    title.textContent = group.patch ?? group.title ?? group.name ?? `Patch ${index + 1}`

    const date = document.createElement('span')
    date.className = 'patch-date'
    date.textContent = formatDate(group.date ?? group.createdAt ?? group.timestamp)

    header.append(title, date)
    section.append(header)

    const changes = normalizeChanges(group)
    if (!changes.length) {
      const empty = document.createElement('div')
      empty.className = 'empty-state'
      empty.textContent = 'Keine Hero-Änderungen in diesem Eintrag.'
      section.append(empty)
    } else {
      changes.forEach((change) => {
        const item = document.createElement('article')
        item.className = 'change-item'

        item.append(createHeroVisual(change))

        const tierChanges = document.createElement('div')
        tierChanges.className = 'change-tiers'

        const oldTier = change.oldTier ?? change.from ?? change.previousTier ?? '?'
        const newTier = change.newTier ?? change.to ?? change.currentTier ?? '?'
        const oldColor = change.oldColor ?? change.fromColor
        const newColor = change.newColor ?? change.toColor

        const arrow = document.createElement('span')
        arrow.className = 'change-arrow'
        arrow.textContent = '→'

        tierChanges.append(tierBadge(oldTier, oldColor), arrow, tierBadge(newTier, newColor))
        item.append(tierChanges)
        section.append(item)
      })
    }

    fragment.append(section)
  })

  container.append(fragment)
}

async function boot() {
  document.getElementById('year').textContent = new Date().getFullYear()

  try {
    const history = await loadHistory()
    renderHistory(history)
  } catch (error) {
    document.getElementById('history-container').innerHTML =
      '<p class="error">Verlauf konnte nicht geladen werden.</p>'
  }
}

boot()
