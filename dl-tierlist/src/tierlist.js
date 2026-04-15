import './main.css'

const TYPE_COLORS = {
  Tank: '#ef4444',
  Carry: '#f59e0b',
  Flex: '#8b5cf6',
  Support: '#22c55e',
  Assassin: '#ec4899',
}

const DEFAULT_TIER_COLORS = {
  s: 'var(--tier-s)',
  a: 'var(--tier-a)',
  b: 'var(--tier-b)',
  c: 'var(--tier-c)',
}

async function loadData() {
  const [tiersRes, heroesRes] = await Promise.all([
    fetch('/data/tierlist.json'),
    fetch('/data/heroes.json'),
  ])

  if (!tiersRes.ok || !heroesRes.ok) {
    throw new Error('Tierlist data request failed')
  }

  return { tiers: await tiersRes.json(), heroes: await heroesRes.json() }
}

function formatDate(isoString) {
  const date = new Date(isoString)
  if (Number.isNaN(date.getTime())) {
    return '–'
  }

  return date.toLocaleDateString('de-DE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function normalizeHeroes(source) {
  const rawHeroes = Array.isArray(source)
    ? source
    : Array.isArray(source?.heroes)
      ? source.heroes
      : Object.values(source ?? {})

  return rawHeroes
    .filter(Boolean)
    .map((hero) => ({
      ...hero,
      id: String(hero.id ?? hero.slug ?? hero.name ?? ''),
      name: hero.name ?? hero.id ?? 'Unbekannter Hero',
      type: hero.type ?? hero.role ?? '',
      image: hero.image ?? hero.icon ?? hero.portrait ?? '',
    }))
    .filter((hero) => hero.id)
}

function getTierEntries(tiersData) {
  if (Array.isArray(tiersData)) {
    return tiersData
  }

  if (Array.isArray(tiersData?.tiers)) {
    return tiersData.tiers
  }

  if (tiersData?.tiers && typeof tiersData.tiers === 'object') {
    return Object.entries(tiersData.tiers).map(([tierId, tier]) => {
      if (!tier.id) {
        tier.id = tierId
      }

      return tier
    })
  }

  if (Array.isArray(tiersData?.entries)) {
    return tiersData.entries
  }

  return []
}

function getTierName(tier) {
  return String(tier.id ?? tier.key ?? tier.label ?? tier.name ?? '?')
}

function getTierColor(tier) {
  const explicitColor = tier.color ?? tier.colour ?? tier.hex
  if (explicitColor) {
    return explicitColor
  }

  const normalizedTier = getTierName(tier).trim().toLowerCase()
  return DEFAULT_TIER_COLORS[normalizedTier] ?? 'var(--tier-c)'
}

function getTierHeroItems(tier) {
  const items = tier.heroIds ?? tier.heroes ?? tier.items ?? tier.ids ?? []
  return Array.isArray(items) ? items : []
}

function getHeroInitial(name) {
  return String(name ?? '?')
    .trim()
    .slice(0, 1)
    .toUpperCase()
}

function createPlaceholder(hero) {
  const placeholder = document.createElement('div')
  placeholder.className = 'hero-portrait-placeholder'
  placeholder.textContent = getHeroInitial(hero.name)
  placeholder.setAttribute('aria-label', `${hero.name} Platzhalter`)
  return placeholder
}

function createHeroCard(hero, tierColor) {
  const card = document.createElement('div')
  card.className = 'hero-card'
  card.style.setProperty('--tier-color', tierColor)
  card.dataset.heroId = hero.id

  const portrait = hero.image ? document.createElement('img') : createPlaceholder(hero)
  if (portrait instanceof HTMLImageElement) {
    portrait.className = 'hero-portrait'
    portrait.src = hero.image
    portrait.alt = `${hero.name} Portrait`
    portrait.loading = 'lazy'
    portrait.decoding = 'async'
    portrait.onerror = () => {
      portrait.replaceWith(createPlaceholder(hero))
    }
  }

  card.append(portrait)

  if (hero.type && TYPE_COLORS[hero.type]) {
    const dot = document.createElement('span')
    dot.className = 'hero-type-dot'
    dot.style.backgroundColor = TYPE_COLORS[hero.type]
    dot.title = hero.type
    card.append(dot)
  }

  const name = document.createElement('div')
  name.className = 'hero-name'
  name.textContent = hero.name
  card.append(name)

  return card
}

function resolveTierHeroes(tier, heroMap) {
  return getTierHeroItems(tier)
    .map((item) => {
      if (typeof item === 'string') {
        return heroMap.get(item)
      }

      if (item && typeof item === 'object') {
        const mappedHero = heroMap.get(String(item.id ?? item.heroId ?? ''))
        return mappedHero ?? {
          ...item,
          id: String(item.id ?? item.heroId ?? item.name ?? ''),
          name: item.name ?? item.id ?? 'Unbekannter Hero',
          image: item.image ?? item.icon ?? item.portrait ?? '',
          type: item.type ?? item.role ?? '',
        }
      }

      return null
    })
    .filter(Boolean)
}

function renderTierlist(data) {
  const container = document.getElementById('tierlist-container')
  const heroes = normalizeHeroes(data.heroes)
  const heroMap = new Map(heroes.map((hero) => [hero.id, hero]))
  const tiers = getTierEntries(data.tiers)

  container.innerHTML = ''

  if (!tiers.length) {
    container.innerHTML = '<div class="empty-state">Keine Tier-Daten vorhanden.</div>'
    return
  }

  const fragment = document.createDocumentFragment()

  tiers.forEach((tier) => {
    const row = document.createElement('section')
    row.className = 'tier-row'

    const tierColor = getTierColor(tier)
    row.style.setProperty('--tier-color', tierColor)

    const label = document.createElement('div')
    label.className = 'tier-label'
    label.textContent = getTierName(tier)
    row.append(label)

    const heroesWrap = document.createElement('div')
    heroesWrap.className = 'tier-heroes'

    const tierHeroes = resolveTierHeroes(tier, heroMap)
    if (!tierHeroes.length) {
      const empty = document.createElement('div')
      empty.className = 'tier-empty'
      empty.textContent = 'Keine Heroes'
      heroesWrap.append(empty)
    } else {
      tierHeroes.forEach((hero) => {
        heroesWrap.append(createHeroCard(hero, tierColor))
      })
    }

    row.append(heroesWrap)
    fragment.append(row)
  })

  container.append(fragment)
}

async function boot() {
  document.getElementById('year').textContent = new Date().getFullYear()

  try {
    const { tiers, heroes } = await loadData()
    document.getElementById('last-updated-date').textContent = formatDate(tiers.lastUpdated)
    document.getElementById('tierlist-description').textContent = tiers.description ?? ''
    renderTierlist({ tiers, heroes })
  } catch (error) {
    document.getElementById('tierlist-container').innerHTML =
      '<p class="error">Tier-Liste konnte nicht geladen werden.</p>'
  }
}

boot()
