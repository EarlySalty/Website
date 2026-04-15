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

const ADMIN_CONFIG = {
  authUrl: '/auth/discord/login',
  apiBase: '/api',
}

let adminState = null
let toastTimeout = null

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
      image: hero.image ?? hero.icon ?? hero.portrait ?? '',
      type: hero.type ?? hero.role ?? '',
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

function getTierId(tier) {
  return String(tier.id ?? tier.slug ?? tier.key ?? getTierName(tier))
}

function getTierColor(tier) {
  const explicitColor = tier.color ?? tier.colour ?? tier.hex
  if (explicitColor) {
    return explicitColor
  }

  return DEFAULT_TIER_COLORS[getTierName(tier).trim().toLowerCase()] ?? 'var(--tier-c)'
}

function getTierListKey(tier) {
  if (Array.isArray(tier.heroIds)) {
    return 'heroIds'
  }

  if (Array.isArray(tier.heroes)) {
    return 'heroes'
  }

  if (Array.isArray(tier.items)) {
    return 'items'
  }

  if (Array.isArray(tier.ids)) {
    return 'ids'
  }

  return 'heroes'
}

function readTierHeroIds(tier) {
  return (tier[getTierListKey(tier)] ?? [])
    .map((item) => {
      if (typeof item === 'string') {
        return item
      }

      if (item && typeof item === 'object') {
        return String(item.id ?? item.heroId ?? item.name ?? '')
      }

      return ''
    })
    .filter(Boolean)
}

function writeTierHeroIds(tier, heroIds, heroMap) {
  const key = getTierListKey(tier)
  const originalItems = Array.isArray(tier[key]) ? tier[key] : []
  const shouldWriteObjects = originalItems.some((item) => item && typeof item === 'object')

  tier[key] = shouldWriteObjects
    ? heroIds
        .map((heroId) => heroMap.get(heroId))
        .filter(Boolean)
        .map((hero) => ({
          id: hero.id,
          name: hero.name,
          image: hero.image,
          type: hero.type,
        }))
    : heroIds.slice()
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
  return placeholder
}

function createHeroCard(hero, tierColor, isChanged) {
  const card = document.createElement('div')
  card.className = `hero-card${isChanged ? ' hero-card--changed' : ''}`
  card.style.setProperty('--tier-color', tierColor)
  card.dataset.heroId = hero.id
  card.draggable = true

  if (hero.image) {
    const img = document.createElement('img')
    img.className = 'hero-portrait'
    img.src = hero.image
    img.alt = `${hero.name} Portrait`
    img.loading = 'lazy'
    img.decoding = 'async'
    img.onerror = () => {
      img.replaceWith(createPlaceholder(hero))
    }
    card.append(img)
  } else {
    card.append(createPlaceholder(hero))
  }

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

function buildOriginalTierMap(tiersData) {
  const mapping = new Map()

  getTierEntries(tiersData).forEach((tier) => {
    const tierId = getTierId(tier)
    readTierHeroIds(tier).forEach((heroId) => {
      mapping.set(heroId, tierId)
    })
  })

  return mapping
}

function createState(tiersData, heroes) {
  const tierSnapshot = structuredClone(tiersData)
  const normalizedHeroes = normalizeHeroes(heroes)
  const heroMap = new Map(normalizedHeroes.map((hero) => [hero.id, hero]))

  return {
    tiersData: tierSnapshot,
    heroes: normalizedHeroes,
    heroMap,
    changedHeroIds: new Set(),
    originalTierByHeroId: buildOriginalTierMap(tierSnapshot),
  }
}

async function checkAuth() {
  try {
    const response = await fetch(`${ADMIN_CONFIG.apiBase}/tierlist/me`, {
      credentials: 'include',
    })

    if (!response.ok) {
      return null
    }

    return response.json()
  } catch (error) {
    return null
  }
}

function showToast(message, isError = false) {
  const toast = document.getElementById('toast')
  if (!toast) {
    return
  }

  if (toastTimeout) {
    clearTimeout(toastTimeout)
  }

  toast.textContent = message
  toast.classList.toggle('is-error', isError)
  toast.style.display = 'block'

  requestAnimationFrame(() => {
    toast.classList.add('is-visible')
  })

  toastTimeout = window.setTimeout(() => {
    toast.classList.remove('is-visible')
    window.setTimeout(() => {
      toast.style.display = 'none'
    }, 180)
  }, 3000)
}

async function loadAdminData() {
  const [tiersRes, heroesRes] = await Promise.all([
    fetch('/data/tierlist.json'),
    fetch('/data/heroes.json'),
  ])

  if (!tiersRes.ok || !heroesRes.ok) {
    throw new Error('Admin data request failed')
  }

  return { tiers: await tiersRes.json(), heroes: await heroesRes.json() }
}

function moveHeroToTier(state, heroId, targetTierId) {
  const tiers = getTierEntries(state.tiersData)
  const sourceTier = tiers.find((tier) => readTierHeroIds(tier).includes(heroId))
  const targetTier = tiers.find((tier) => getTierId(tier) === targetTierId)

  if (!sourceTier || !targetTier || sourceTier === targetTier) {
    return false
  }

  const sourceIds = readTierHeroIds(sourceTier).filter((id) => id !== heroId)
  const targetIds = readTierHeroIds(targetTier)

  if (!targetIds.includes(heroId)) {
    targetIds.push(heroId)
  }

  writeTierHeroIds(sourceTier, sourceIds, state.heroMap)
  writeTierHeroIds(targetTier, targetIds, state.heroMap)

  const originalTierId = state.originalTierByHeroId.get(heroId)
  if (originalTierId === targetTierId) {
    state.changedHeroIds.delete(heroId)
  } else {
    state.changedHeroIds.add(heroId)
  }

  return true
}

function setupDragAndDrop(container, state) {
  container.querySelectorAll('.hero-card[draggable="true"]').forEach((card) => {
    card.addEventListener('dragstart', (event) => {
      event.dataTransfer?.setData('text/plain', card.dataset.heroId ?? '')
      event.dataTransfer.effectAllowed = 'move'
      card.style.opacity = '0.4'
    })

    card.addEventListener('dragend', () => {
      card.style.opacity = '1'
      container.querySelectorAll('.drag-over').forEach((row) => row.classList.remove('drag-over'))
    })
  })

  container.querySelectorAll('.tier-row').forEach((row) => {
    row.addEventListener('dragover', (event) => {
      event.preventDefault()
      row.classList.add('drag-over')
    })

    row.addEventListener('dragleave', (event) => {
      if (!row.contains(event.relatedTarget)) {
        row.classList.remove('drag-over')
      }
    })

    row.addEventListener('drop', (event) => {
      event.preventDefault()
      row.classList.remove('drag-over')

      const heroId = event.dataTransfer?.getData('text/plain')
      const targetTierId = row.dataset.tierId
      if (!heroId || !targetTierId) {
        return
      }

      if (moveHeroToTier(state, heroId, targetTierId)) {
        drawAdminEditor(container, state)
      }
    })
  })
}

async function saveToApi(tiersData) {
  try {
    const response = await fetch(`${ADMIN_CONFIG.apiBase}/tierlist`, {
      method: 'PUT',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(tiersData),
    })

    if (response.status === 401) {
      showToast('Sitzung abgelaufen', true)
      return false
    }

    if (!response.ok) {
      showToast('Speichern fehlgeschlagen', true)
      return false
    }

    showToast('Tier-Liste gespeichert')
    return true
  } catch (error) {
    showToast('Backend nicht erreichbar – nutze JSON-Export', true)
    return false
  }
}

function exportJson(tiersData) {
  const blob = new Blob([JSON.stringify(tiersData, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  const timestamp = new Date().toISOString().slice(0, 10)

  link.href = url
  link.download = `tierlist-${timestamp}.json`
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function drawAdminEditor(container, state) {
  container.innerHTML = ''

  const fragment = document.createDocumentFragment()
  getTierEntries(state.tiersData).forEach((tier) => {
    const row = document.createElement('section')
    row.className = 'tier-row'
    row.dataset.tierId = getTierId(tier)

    const tierColor = getTierColor(tier)
    row.style.setProperty('--tier-color', tierColor)

    const label = document.createElement('div')
    label.className = 'tier-label'
    label.textContent = getTierName(tier)
    row.append(label)

    const heroesWrap = document.createElement('div')
    heroesWrap.className = 'tier-heroes'

    readTierHeroIds(tier)
      .map((heroId) => state.heroMap.get(heroId))
      .filter(Boolean)
      .forEach((hero) => {
        heroesWrap.append(
          createHeroCard(hero, tierColor, state.changedHeroIds.has(hero.id)),
        )
      })

    row.append(heroesWrap)
    fragment.append(row)
  })

  container.append(fragment)
  setupDragAndDrop(container, state)
}

function renderAdminEditor(tiersData, heroes) {
  if (!adminState) {
    adminState = createState(tiersData, heroes)
  }

  drawAdminEditor(document.getElementById('admin-tierlist-container'), adminState)
}

function createSavePayload(state) {
  const payload = structuredClone(state.tiersData)
  payload.lastUpdated = new Date().toISOString()
  return payload
}

function commitSavedState(state, payload) {
  state.tiersData = structuredClone(payload)
  state.changedHeroIds.clear()
  state.originalTierByHeroId = buildOriginalTierMap(state.tiersData)
}

async function boot() {
  const yearElement = document.getElementById('year')
  if (yearElement) {
    yearElement.textContent = new Date().getFullYear()
  }

  document.getElementById('discord-login-btn').href = ADMIN_CONFIG.authUrl

  const user = await checkAuth()
  if (!user) {
    return
  }

  document.getElementById('login-screen').style.display = 'none'
  document.getElementById('editor-screen').style.display = ''

  try {
    const { tiers, heroes } = await loadAdminData()
    renderAdminEditor(tiers, heroes)
  } catch (error) {
    showToast('Editor-Daten konnten nicht geladen werden', true)
    return
  }

  document.getElementById('save-btn').addEventListener('click', async () => {
    if (!adminState) {
      return
    }

    const payload = createSavePayload(adminState)
    const saved = await saveToApi(payload)
    if (saved) {
      commitSavedState(adminState, payload)
      drawAdminEditor(document.getElementById('admin-tierlist-container'), adminState)
    }
  })

  document.getElementById('export-btn').addEventListener('click', () => {
    if (!adminState) {
      return
    }

    exportJson(createSavePayload(adminState))
    showToast('JSON exportiert')
  })
}

boot()
