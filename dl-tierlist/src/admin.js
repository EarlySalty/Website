import './admin.css'

const LOGIN_URL = '/auth/discord/login?next=/admin'
const STATIC_HEROES_URL = '/data/heroes.json'
const TIERLIST_BUCKET = 'all'
const SECTION_KEYS = ['description', 'streamers', 'builds']

const state = {
  apiBase: resolveApiBase(),
  activeTab: 'heroes',
  user: null,
  heroSearch: '',
  heroPreviewEnabled: false,
  heroes: [],
  heroDrafts: new Map(),
  selectedHeroId: null,
  adminHeroGetSupported: null,
  loadingHeroId: null,
  settingsDraft: null,
  isSavingHero: false,
  isSavingSettings: false,
  isRefreshing: false,
}

let toastTimeout = null

function resolveApiBase() {
  const meta = document.querySelector('meta[name="tierlist-api-base"]')?.content?.trim()
  const globalValue =
    typeof window !== 'undefined' && typeof window.TIERLIST_API_BASE === 'string'
      ? window.TIERLIST_API_BASE.trim()
      : ''
  const base = globalValue || meta || ''
  if (!base || base === '/') {
    return ''
  }

  return base.endsWith('/') ? base.slice(0, -1) : base
}

function apiUrl(path) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${state.apiBase}${normalizedPath}`
}

async function apiFetch(path, options = {}) {
  return fetch(apiUrl(path), {
    credentials: 'include',
    ...options,
  })
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
  toast.hidden = false

  requestAnimationFrame(() => {
    toast.classList.add('is-visible')
  })

  toastTimeout = window.setTimeout(() => {
    toast.classList.remove('is-visible')
    window.setTimeout(() => {
      toast.hidden = true
    }, 180)
  }, 3200)
}

function showLoginScreen() {
  document.getElementById('login-screen').hidden = false
  document.getElementById('app-shell').hidden = true
}

function showAppShell() {
  document.getElementById('login-screen').hidden = true
  document.getElementById('app-shell').hidden = false
}

function handleSessionExpired() {
  state.user = null
  showLoginScreen()
  showToast('Sitzung abgelaufen - neu einloggen', true)
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function renderInlineMarkdown(text) {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])_([^_]+)_/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
}

function renderMarkdown(text) {
  const source = String(text ?? '').trim()
  if (!source) {
    return '<p class="empty-preview">Noch keine Beschreibung.</p>'
  }

  const lines = source.split(/\r?\n/)
  const blocks = []
  let listItems = []
  let paragraph = []

  const flushParagraph = () => {
    if (!paragraph.length) {
      return
    }
    blocks.push(`<p>${renderInlineMarkdown(paragraph.join(' '))}</p>`)
    paragraph = []
  }

  const flushList = () => {
    if (!listItems.length) {
      return
    }
    blocks.push(`<ul>${listItems.map((item) => `<li>${renderInlineMarkdown(item)}</li>`).join('')}</ul>`)
    listItems = []
  }

  lines.forEach((line) => {
    const trimmed = line.trim()
    if (!trimmed) {
      flushParagraph()
      flushList()
      return
    }

    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      flushParagraph()
      listItems.push(trimmed.slice(2).trim())
      return
    }

    if (trimmed.startsWith('## ')) {
      flushParagraph()
      flushList()
      blocks.push(`<h3>${renderInlineMarkdown(trimmed.slice(3).trim())}</h3>`)
      return
    }

    if (trimmed.startsWith('# ')) {
      flushParagraph()
      flushList()
      blocks.push(`<h2>${renderInlineMarkdown(trimmed.slice(2).trim())}</h2>`)
      return
    }

    paragraph.push(trimmed)
  })

  flushParagraph()
  flushList()
  return blocks.join('')
}

function formatHeroImage(hero) {
  return hero.image_url || hero.image || ''
}

function createHeroDraft(hero) {
  return {
    hero_id: String(hero.hero_id),
    name: hero.name,
    slug: hero.slug || '',
    image_url: formatHeroImage(hero),
    description: '',
    streamers: [],
    builds_meta: [],
    loadedSections: {
      description: false,
      streamers: false,
      builds: false,
    },
    dirty: {
      description: false,
      streamers: false,
      builds: false,
    },
  }
}

function cloneStreamers(items) {
  return items.map((item, index) => ({
    id: item.id ?? null,
    twitch_login: String(item.twitch_login ?? '').trim().toLowerCase(),
    display_name: String(item.display_name ?? '').trim(),
    sort_order: Number(item.sort_order ?? (index + 1) * 100),
    is_active: Boolean(item.is_active ?? true),
  }))
}

function cloneBuildsMeta(items) {
  return items.map((item, index) => ({
    build_id: Number(item.build_id),
    build_name: String(item.build_name ?? ''),
    author_name: String(item.author_name ?? ''),
    sort_order: Number(item.sort_order ?? (index + 1) * 100),
    is_active: Boolean(item.is_active ?? true),
  }))
}

function markLoaded(draft, keys) {
  keys.forEach((key) => {
    draft.loadedSections[key] = true
    draft.dirty[key] = false
  })
}

function mergeHeroPayload(heroId, payload) {
  const existing = state.heroDrafts.get(heroId)
  if (!existing || !payload) {
    return
  }

  existing.name = payload.name ?? existing.name
  existing.description = String(payload.description ?? '')
  existing.streamers = cloneStreamers(payload.streamers ?? [])
  existing.builds_meta = cloneBuildsMeta(payload.builds_meta ?? payload.builds ?? [])
  markLoaded(existing, SECTION_KEYS)
}

function normalizeHeroesPayload(payload) {
  const items = Object.entries(payload ?? {}).map(([heroId, item]) => ({
    hero_id: String(heroId),
    name: item?.name ?? `Hero ${heroId}`,
    slug: item?.slug ?? '',
    image_url: item?.image_url ?? item?.image ?? '',
  }))

  items.sort((left, right) => left.name.localeCompare(right.name, 'de'))
  return items
}

function normalizeStaticHeroes(payload) {
  const items = Object.entries(payload ?? {}).map(([heroKey, item]) => ({
    hero_id: String(item?.hero_id ?? item?.id ?? heroKey),
    name: item?.name ?? heroKey,
    slug: item?.slug ?? heroKey,
    image_url: item?.image_url ?? item?.image ?? '',
  }))

  items.sort((left, right) => left.name.localeCompare(right.name, 'de'))
  return items
}

function flattenTierlistHeroes(payload) {
  const tiers = Array.isArray(payload?.tiers)
    ? payload.tiers
    : Array.isArray(payload?.data?.tiers)
      ? payload.data.tiers
      : []
  const heroes = []

  tiers.forEach((tier) => {
    const tierHeroes = Array.isArray(tier?.heroes) ? tier.heroes : []
    tierHeroes.forEach((hero) => {
      heroes.push({
        hero_id: String(hero.hero_id),
        name: hero.name ?? `Hero ${hero.hero_id}`,
        description: String(hero.description ?? ''),
        streamers: cloneStreamers(hero.streamers ?? []),
        builds_meta: cloneBuildsMeta(hero.builds ?? []),
      })
    })
  })

  return heroes
}

function ensureSequentialStreamerSort(streamers) {
  streamers.forEach((streamer, index) => {
    streamer.sort_order = (index + 1) * 100
  })
}

function isHeroDirty(draft) {
  return SECTION_KEYS.some((key) => draft.dirty[key])
}

function currentHero() {
  if (!state.selectedHeroId) {
    return null
  }

  return state.heroDrafts.get(state.selectedHeroId) ?? null
}

function filteredHeroes() {
  const term = state.heroSearch.trim().toLowerCase()
  if (!term) {
    return state.heroes
  }

  return state.heroes.filter((hero) => hero.name.toLowerCase().includes(term))
}

function updatePreview() {
  const textarea = document.getElementById('hero-description')
  const preview = document.getElementById('hero-description-preview')
  if (!textarea || !preview) {
    return
  }

  preview.innerHTML = renderMarkdown(textarea.value)
}

function renderHeroList() {
  const container = document.getElementById('hero-list')
  const count = document.getElementById('hero-count')
  const heroes = filteredHeroes()

  count.textContent = `${heroes.length} / ${state.heroes.length}`
  container.innerHTML = ''

  if (!heroes.length) {
    container.innerHTML = '<p class="empty-state">Keine Heroes gefunden.</p>'
    return
  }

  const fragment = document.createDocumentFragment()

  heroes.forEach((hero) => {
    const draft = state.heroDrafts.get(hero.hero_id)
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'hero-list-item'
    button.classList.toggle('is-active', hero.hero_id === state.selectedHeroId)
    button.dataset.heroId = hero.hero_id

    const image = document.createElement('img')
    image.className = 'hero-avatar'
    image.src = formatHeroImage(hero) || '/favicon.svg'
    image.alt = ''
    image.loading = 'lazy'
    image.decoding = 'async'
    image.onerror = () => {
      image.style.visibility = 'hidden'
    }

    const copy = document.createElement('div')
    copy.className = 'hero-list-copy'

    const name = document.createElement('span')
    name.className = 'hero-list-name'
    name.textContent = hero.name

    const meta = document.createElement('span')
    meta.className = 'hero-list-meta'
    if (draft && isHeroDirty(draft)) {
      meta.textContent = 'Ungespeicherte Änderungen'
    } else if (draft?.loadedSections.builds || draft?.loadedSections.streamers || draft?.loadedSections.description) {
      meta.textContent = 'Metadaten geladen'
    } else {
      meta.textContent = 'Nur Stammdaten geladen'
    }

    copy.append(name, meta)
    button.append(image, copy)

    if (draft && isHeroDirty(draft)) {
      const dirtyDot = document.createElement('span')
      dirtyDot.className = 'dirty-dot'
      dirtyDot.setAttribute('aria-hidden', 'true')
      button.append(dirtyDot)
    }

    button.addEventListener('click', () => {
      selectHero(hero.hero_id)
    })

    fragment.append(button)
  })

  container.append(fragment)
}

function renderBuildList(draft) {
  if (!draft.loadedSections.builds && !draft.builds_meta.length) {
    return `
      <div class="surface-note">
        Fuer diesen Hero wurden noch keine Build-Metadaten geladen. Ohne einen separaten
        Admin-Load-Endpoint zeigt das Frontend hier nur Daten aus dem aktuellen Snapshot.
      </div>
    `
  }

  if (!draft.builds_meta.length) {
    return '<div class="surface-note">Keine Builds vorhanden.</div>'
  }

  return draft.builds_meta
    .map(
      (build, index) => `
        <article class="build-row" data-build-index="${index}">
          <div class="build-copy">
            <div class="build-title-row">
              <strong>${escapeHtml(build.build_name || `Build ${build.build_id}`)}</strong>
              <span class="build-id">#${build.build_id}</span>
            </div>
            <p class="build-author">${escapeHtml(build.author_name || 'Unbekannter Autor')}</p>
          </div>
          <div class="build-controls">
            <label class="toggle-field">
              <span>Aktiv</span>
              <input type="checkbox" class="build-active-toggle" ${build.is_active ? 'checked' : ''} />
            </label>
            <label class="field compact-field">
              <span class="field-label">Sort</span>
              <input
                class="field-input build-sort-input"
                type="number"
                min="0"
                step="1"
                value="${build.sort_order}"
                inputmode="numeric"
              />
            </label>
          </div>
        </article>
      `,
    )
    .join('')
}

function renderStreamerList(draft) {
  if (!draft.loadedSections.streamers && !draft.streamers.length) {
    return `
      <div class="surface-note">
        Es wurden keine bestehenden Streamer-Daten geladen. Neue Eintraege koennen trotzdem
        angelegt werden.
      </div>
    `
  }

  if (!draft.streamers.length) {
    return '<div class="surface-note">Noch keine Players to Watch hinterlegt.</div>'
  }

  return draft.streamers
    .map(
      (streamer, index) => `
        <article class="streamer-row" data-streamer-index="${index}" draggable="true">
          <button class="drag-handle" type="button" aria-label="Reihenfolge verschieben">::</button>
          <div class="streamer-fields">
            <label class="field compact-field">
              <span class="field-label">Twitch-Login</span>
              <input
                class="field-input streamer-login-input"
                type="text"
                value="${escapeHtml(streamer.twitch_login)}"
                placeholder="kennkan"
                autocomplete="off"
              />
            </label>
            <label class="field compact-field">
              <span class="field-label">Display-Name</span>
              <input
                class="field-input streamer-display-input"
                type="text"
                value="${escapeHtml(streamer.display_name)}"
                placeholder="KennKan"
                autocomplete="off"
              />
            </label>
          </div>
          <div class="streamer-actions">
            <label class="toggle-field">
              <span>Aktiv</span>
              <input type="checkbox" class="streamer-active-toggle" ${streamer.is_active ? 'checked' : ''} />
            </label>
            <button class="button button-ghost streamer-delete-btn" type="button">Loeschen</button>
          </div>
        </article>
      `,
    )
    .join('')
}

function renderHeroEditor() {
  const container = document.getElementById('hero-editor')
  const draft = currentHero()

  if (!draft) {
    container.innerHTML = '<div class="empty-state">Kein Hero ausgewaehlt.</div>'
    return
  }

  const isDirty = isHeroDirty(draft)
  const partialData =
    !draft.loadedSections.description || !draft.loadedSections.streamers || !draft.loadedSections.builds

  container.innerHTML = `
    <div class="surface hero-summary">
      <div class="hero-summary-main">
        <img class="hero-summary-image" src="${escapeHtml(draft.image_url || '/favicon.svg')}" alt="" />
        <div>
          <p class="eyebrow">Hero Editor</p>
          <h2>${escapeHtml(draft.name)}</h2>
          <p class="hero-summary-meta">
            ${partialData ? 'Teildaten geladen' : 'Vollstaendige Metadaten geladen'}
            ${isDirty ? ' · ungespeicherte Aenderungen' : ''}
          </p>
        </div>
      </div>
      <button id="hero-save-btn" class="button button-primary" type="button" ${
        state.isSavingHero ? 'disabled' : ''
      }>
        ${state.isSavingHero ? 'Speichert...' : 'Speichern'}
      </button>
    </div>

    <section class="surface">
      <div class="panel-heading">
        <div>
          <p class="eyebrow">Beschreibung</p>
          <h3>Markdown</h3>
        </div>
        <button
          id="hero-preview-toggle"
          class="button button-ghost"
          type="button"
          aria-pressed="${state.heroPreviewEnabled ? 'true' : 'false'}"
        >
          ${state.heroPreviewEnabled ? 'Preview ausblenden' : 'Live-Preview'}
        </button>
      </div>
      <label class="field">
        <span class="field-label">Beschreibungstext</span>
        <textarea
          id="hero-description"
          class="field-input field-textarea"
          rows="8"
          placeholder="Markdown fuer den Hero"
        >${escapeHtml(draft.description)}</textarea>
      </label>
      <div id="hero-description-preview" class="markdown-preview" ${
        state.heroPreviewEnabled ? '' : 'hidden'
      }></div>
    </section>

    <section class="surface">
      <div class="panel-heading">
        <div>
          <p class="eyebrow">Recommended Builds</p>
          <h3>Builds</h3>
        </div>
      </div>
      <p class="section-copy">
        Builds werden im Build-Bot gepflegt - hier nur Sortierung und Aktiv-Status.
      </p>
      <div id="build-list" class="stack-list">${renderBuildList(draft)}</div>
    </section>

    <section class="surface">
      <div class="panel-heading">
        <div>
          <p class="eyebrow">Players to Watch</p>
          <h3>Streamer</h3>
        </div>
        <button id="add-streamer-btn" class="button button-secondary" type="button">
          + Hinzufuegen
        </button>
      </div>
      <p class="section-copy">Per Drag-and-Drop sortieren, dann Twitch-Login und Anzeige-Namen pflegen.</p>
      <div id="streamer-list" class="stack-list">${renderStreamerList(draft)}</div>
    </section>
  `

  const image = container.querySelector('.hero-summary-image')
  if (image instanceof HTMLImageElement) {
    image.onerror = () => {
      image.src = '/favicon.svg'
    }
  }

  bindHeroEditorEvents(draft)
  updatePreview()
}

function bindHeroEditorEvents(draft) {
  const description = document.getElementById('hero-description')
  const previewToggle = document.getElementById('hero-preview-toggle')
  const saveButton = document.getElementById('hero-save-btn')
  const addStreamerButton = document.getElementById('add-streamer-btn')
  const buildList = document.getElementById('build-list')
  const streamerList = document.getElementById('streamer-list')

  description?.addEventListener('input', (event) => {
    draft.description = event.currentTarget.value
    draft.dirty.description = true
    updatePreview()
    renderHeroList()
  })

  previewToggle?.addEventListener('click', () => {
    state.heroPreviewEnabled = !state.heroPreviewEnabled
    renderHeroEditor()
  })

  saveButton?.addEventListener('click', () => {
    saveCurrentHero()
  })

  addStreamerButton?.addEventListener('click', () => {
    draft.streamers.push({
      id: null,
      twitch_login: '',
      display_name: '',
      sort_order: (draft.streamers.length + 1) * 100,
      is_active: true,
    })
    draft.dirty.streamers = true
    renderHeroList()
    renderHeroEditor()
  })

  buildList?.querySelectorAll('.build-row').forEach((row) => {
    const index = Number(row.dataset.buildIndex)
    const build = draft.builds_meta[index]
    if (!build) {
      return
    }

    row.querySelector('.build-active-toggle')?.addEventListener('change', (event) => {
      build.is_active = event.currentTarget.checked
      draft.dirty.builds = true
      renderHeroList()
    })

    row.querySelector('.build-sort-input')?.addEventListener('input', (event) => {
      const nextValue = Number(event.currentTarget.value)
      build.sort_order = Number.isFinite(nextValue) ? nextValue : 0
      draft.dirty.builds = true
      renderHeroList()
    })
  })

  let draggedIndex = null

  streamerList?.querySelectorAll('.streamer-row').forEach((row) => {
    const index = Number(row.dataset.streamerIndex)
    const streamer = draft.streamers[index]
    if (!streamer) {
      return
    }

    row.querySelector('.streamer-login-input')?.addEventListener('input', (event) => {
      streamer.twitch_login = event.currentTarget.value.trim().toLowerCase()
      draft.dirty.streamers = true
      renderHeroList()
    })

    row.querySelector('.streamer-display-input')?.addEventListener('input', (event) => {
      streamer.display_name = event.currentTarget.value
      draft.dirty.streamers = true
      renderHeroList()
    })

    row.querySelector('.streamer-active-toggle')?.addEventListener('change', (event) => {
      streamer.is_active = event.currentTarget.checked
      draft.dirty.streamers = true
      renderHeroList()
    })

    row.querySelector('.streamer-delete-btn')?.addEventListener('click', () => {
      draft.streamers.splice(index, 1)
      ensureSequentialStreamerSort(draft.streamers)
      draft.dirty.streamers = true
      renderHeroList()
      renderHeroEditor()
    })

    row.addEventListener('dragstart', () => {
      draggedIndex = index
      row.classList.add('is-dragging')
    })

    row.addEventListener('dragend', () => {
      draggedIndex = null
      row.classList.remove('is-dragging')
      streamerList
        ?.querySelectorAll('.streamer-row')
        .forEach((item) => item.classList.remove('is-drop-target'))
    })

    row.addEventListener('dragover', (event) => {
      event.preventDefault()
      if (draggedIndex === null || draggedIndex === index) {
        return
      }
      row.classList.add('is-drop-target')
    })

    row.addEventListener('dragleave', () => {
      row.classList.remove('is-drop-target')
    })

    row.addEventListener('drop', (event) => {
      event.preventDefault()
      row.classList.remove('is-drop-target')
      if (draggedIndex === null || draggedIndex === index) {
        return
      }

      const [moved] = draft.streamers.splice(draggedIndex, 1)
      draft.streamers.splice(index, 0, moved)
      ensureSequentialStreamerSort(draft.streamers)
      draft.dirty.streamers = true
      renderHeroList()
      renderHeroEditor()
    })
  })
}

function renderTabs() {
  document.querySelectorAll('.tab-button').forEach((button) => {
    const isActive = button.dataset.tab === state.activeTab
    button.classList.toggle('is-active', isActive)
    button.setAttribute('aria-selected', isActive ? 'true' : 'false')
  })

  document.querySelectorAll('.tab-panel').forEach((panel) => {
    const isActive = panel.id === `tab-panel-${state.activeTab}`
    panel.classList.toggle('is-active', isActive)
    panel.hidden = !isActive
  })
}

function unixToDateInput(unixSeconds) {
  if (!unixSeconds) {
    return ''
  }
  const date = new Date(Number(unixSeconds) * 1000)
  if (Number.isNaN(date.getTime())) {
    return ''
  }

  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function dateInputToUnix(dateString) {
  if (!dateString) {
    return null
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateString)
  if (!match) {
    return null
  }

  const year = Number(match[1])
  const month = Number(match[2]) - 1
  const day = Number(match[3])
  return Math.floor(Date.UTC(year, month, day) / 1000)
}

function populateSettingsDraft(payload) {
  state.settingsDraft = {
    thresholds: {
      s_plus_min: Number(payload?.thresholds?.s_plus_min ?? 52),
      s_min: Number(payload?.thresholds?.s_min ?? 50),
      a_min: Number(payload?.thresholds?.a_min ?? 48),
      b_min: Number(payload?.thresholds?.b_min ?? 46),
    },
    min_matches: Number(payload?.min_matches ?? 500),
    refresh_interval_seconds: Number(payload?.refresh_interval_seconds ?? 28800),
    auto_patch: payload?.patch_override_unix == null,
    patch_date: unixToDateInput(payload?.patch_override_unix),
    description_text: String(payload?.description_text ?? ''),
  }
}

function bindStaticEvents() {
  document.getElementById('discord-login-btn').href = LOGIN_URL

  document.querySelectorAll('.tab-button').forEach((button) => {
    button.addEventListener('click', () => {
      state.activeTab = button.dataset.tab
      renderTabs()
    })
  })

  document.getElementById('hero-search').addEventListener('input', (event) => {
    state.heroSearch = event.currentTarget.value
    renderHeroList()
  })

  document.getElementById('settings-patch-auto').addEventListener('change', (event) => {
    const enabled = event.currentTarget.checked
    state.settingsDraft.auto_patch = enabled
    document.getElementById('settings-patch-date').disabled = enabled
    validateSettings()
  })

  document
    .getElementById('settings-form')
    .addEventListener('input', syncSettingsDraftFromForm)

  document.getElementById('settings-form').addEventListener('submit', async (event) => {
    event.preventDefault()
    await saveSettings()
  })

  document.getElementById('refresh-now-btn').addEventListener('click', async () => {
    await triggerRefresh()
  })
}

function syncSettingsDraftFromForm() {
  if (!state.settingsDraft) {
    return
  }

  state.settingsDraft.thresholds.s_plus_min = Number(
    document.getElementById('settings-s-plus').value,
  )
  state.settingsDraft.thresholds.s_min = Number(document.getElementById('settings-s').value)
  state.settingsDraft.thresholds.a_min = Number(document.getElementById('settings-a').value)
  state.settingsDraft.thresholds.b_min = Number(document.getElementById('settings-b').value)
  state.settingsDraft.min_matches = Number(document.getElementById('settings-min-matches').value)
  state.settingsDraft.refresh_interval_seconds = Number(
    document.getElementById('settings-refresh-interval').value,
  )
  state.settingsDraft.patch_date = document.getElementById('settings-patch-date').value
  state.settingsDraft.description_text = document.getElementById('settings-description').value

  validateSettings()
}

function renderSettings() {
  if (!state.settingsDraft) {
    return
  }

  document.getElementById('settings-s-plus').value = state.settingsDraft.thresholds.s_plus_min
  document.getElementById('settings-s').value = state.settingsDraft.thresholds.s_min
  document.getElementById('settings-a').value = state.settingsDraft.thresholds.a_min
  document.getElementById('settings-b').value = state.settingsDraft.thresholds.b_min
  document.getElementById('settings-min-matches').value = state.settingsDraft.min_matches
  document.getElementById('settings-refresh-interval').value =
    state.settingsDraft.refresh_interval_seconds
  document.getElementById('settings-patch-auto').checked = state.settingsDraft.auto_patch
  document.getElementById('settings-patch-date').disabled = state.settingsDraft.auto_patch
  document.getElementById('settings-patch-date').value = state.settingsDraft.patch_date
  document.getElementById('settings-description').value = state.settingsDraft.description_text

  validateSettings()
  updateSettingsButtons()
}

function validateSettings() {
  const thresholdError = document.getElementById('settings-threshold-error')
  const patchError = document.getElementById('settings-patch-error')

  let isValid = true

  const { s_plus_min, s_min, a_min, b_min } = state.settingsDraft.thresholds
  const thresholdsValid = s_plus_min > s_min && s_min > a_min && a_min > b_min
  thresholdError.hidden = thresholdsValid
  thresholdError.textContent = thresholdsValid
    ? ''
    : 'Die Schwellen muessen streng absteigend sein: S+ > S > A > B.'
  if (!thresholdsValid) {
    isValid = false
  }

  const patchRequired = !state.settingsDraft.auto_patch
  const patchValid = !patchRequired || Boolean(dateInputToUnix(state.settingsDraft.patch_date))
  patchError.hidden = patchValid
  patchError.textContent = patchValid ? '' : 'Bitte ein gueltiges Datum fuer den Patch-Override setzen.'
  if (!patchValid) {
    isValid = false
  }

  if (!Number.isFinite(state.settingsDraft.min_matches) || state.settingsDraft.min_matches < 0) {
    isValid = false
  }

  if (
    !Number.isFinite(state.settingsDraft.refresh_interval_seconds) ||
    state.settingsDraft.refresh_interval_seconds <= 0
  ) {
    isValid = false
  }

  updateSettingsButtons(isValid)
  return isValid
}

function updateSettingsButtons(isValid = validateSettings()) {
  const saveButton = document.getElementById('settings-save-btn')
  const refreshButton = document.getElementById('refresh-now-btn')
  const spinner = refreshButton.querySelector('.spinner')

  saveButton.disabled = state.isSavingSettings || !isValid
  saveButton.textContent = state.isSavingSettings ? 'Speichert...' : 'Speichern'

  refreshButton.disabled = state.isRefreshing
  spinner.classList.toggle('is-visible', state.isRefreshing)
}

async function fetchJsonOrThrow(url, options = {}) {
  const response = await fetch(url, {
    credentials: 'include',
    ...options,
  })

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`)
  }

  return response.json()
}

async function loadHeroesCatalog() {
  try {
    const payload = await fetchJsonOrThrow(apiUrl('/api/heroes'))
    return normalizeHeroesPayload(payload)
  } catch (error) {
    const fallbackPayload = await fetchJsonOrThrow(STATIC_HEROES_URL)
    return normalizeStaticHeroes(fallbackPayload)
  }
}

async function loadTierlistMeta() {
  const response = await apiFetch(`/api/tierlist?bucket=${encodeURIComponent(TIERLIST_BUCKET)}`)
  if (!response.ok) {
    throw new Error(`Tierlist request failed: ${response.status}`)
  }

  return response.json()
}

async function checkAuth() {
  const response = await apiFetch('/api/admin/me')
  if (response.status === 401) {
    return null
  }

  if (!response.ok) {
    throw new Error(`Auth request failed: ${response.status}`)
  }

  return response.json()
}

async function loadSettings() {
  const response = await apiFetch('/api/admin/settings')
  if (response.status === 401) {
    handleSessionExpired()
    return null
  }
  if (!response.ok) {
    throw new Error(`Settings request failed: ${response.status}`)
  }
  return response.json()
}

function primeHeroDrafts(heroes, tierlistPayload) {
  state.heroes = heroes
  state.heroDrafts = new Map(heroes.map((hero) => [hero.hero_id, createHeroDraft(hero)]))

  flattenTierlistHeroes(tierlistPayload).forEach((hero) => {
    const draft = state.heroDrafts.get(hero.hero_id)
    if (!draft) {
      return
    }
    mergeHeroPayload(hero.hero_id, hero)
  })

  if (!state.selectedHeroId && heroes.length) {
    state.selectedHeroId = heroes[0].hero_id
  }
}

async function ensureHeroAdminPayload(heroId) {
  const draft = state.heroDrafts.get(heroId)
  if (!draft) {
    return
  }

  const fullyLoaded = SECTION_KEYS.every((key) => draft.loadedSections[key])
  if (fullyLoaded || state.adminHeroGetSupported === false) {
    return
  }

  state.loadingHeroId = heroId
  try {
    const response = await apiFetch(`/api/admin/hero/${encodeURIComponent(heroId)}`)
    if (response.status === 401) {
      handleSessionExpired()
      return
    }

    if (response.status === 404 || response.status === 405) {
      state.adminHeroGetSupported = false
      return
    }

    if (!response.ok) {
      showToast('Hero-Daten konnten nicht vollstaendig geladen werden', true)
      return
    }

    const payload = await response.json()
    if (payload?.hero) {
      mergeHeroPayload(heroId, payload.hero)
      state.adminHeroGetSupported = true
      renderHeroList()
      renderHeroEditor()
    }
  } catch (error) {
    showToast('Hero-Daten konnten nicht geladen werden', true)
  } finally {
    state.loadingHeroId = null
  }
}

async function selectHero(heroId) {
  state.selectedHeroId = heroId
  renderHeroList()
  renderHeroEditor()
  await ensureHeroAdminPayload(heroId)
}

function buildHeroSavePayload(draft) {
  const payload = {}

  if (draft.loadedSections.description || draft.dirty.description) {
    payload.description = draft.description
  }

  if (draft.loadedSections.streamers || draft.dirty.streamers) {
    ensureSequentialStreamerSort(draft.streamers)
    payload.streamers = draft.streamers.map((item) => ({
      twitch_login: item.twitch_login,
      display_name: item.display_name || item.twitch_login,
      sort_order: Number(item.sort_order || 100),
      is_active: Boolean(item.is_active),
    }))
  }

  if (draft.loadedSections.builds || draft.dirty.builds) {
    payload.builds_meta = draft.builds_meta.map((item) => ({
      build_id: Number(item.build_id),
      sort_order: Number(item.sort_order || 0),
      is_active: Boolean(item.is_active),
    }))
  }

  return payload
}

function validateHeroBeforeSave(draft) {
  if (draft.dirty.streamers) {
    const invalidStreamer = draft.streamers.find((item) => !item.twitch_login.trim())
    if (invalidStreamer) {
      showToast('Jeder Streamer braucht einen Twitch-Login', true)
      return false
    }
  }

  return true
}

async function saveCurrentHero() {
  const draft = currentHero()
  if (!draft || state.isSavingHero) {
    return
  }

  if (!validateHeroBeforeSave(draft)) {
    return
  }

  const payload = buildHeroSavePayload(draft)
  if (!Object.keys(payload).length) {
    showToast('Keine aenderbaren Daten geladen', true)
    return
  }

  state.isSavingHero = true
  renderHeroEditor()

  try {
    const response = await apiFetch(`/api/admin/hero/${encodeURIComponent(draft.hero_id)}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (response.status === 401) {
      handleSessionExpired()
      return
    }

    if (!response.ok) {
      showToast('Speichern fehlgeschlagen', true)
      return
    }

    const result = await response.json()
    if (result?.hero) {
      mergeHeroPayload(draft.hero_id, result.hero)
    } else {
      SECTION_KEYS.forEach((key) => {
        draft.loadedSections[key] = draft.loadedSections[key] || draft.dirty[key]
        draft.dirty[key] = false
      })
    }
    showToast('Gespeichert')
    renderHeroList()
    renderHeroEditor()
  } catch (error) {
    showToast('Speichern fehlgeschlagen', true)
  } finally {
    state.isSavingHero = false
    renderHeroEditor()
  }
}

async function saveSettings() {
  if (state.isSavingSettings || !validateSettings()) {
    return
  }

  state.isSavingSettings = true
  updateSettingsButtons()

  const payload = {
    thresholds: {
      s_plus_min: state.settingsDraft.thresholds.s_plus_min,
      s_min: state.settingsDraft.thresholds.s_min,
      a_min: state.settingsDraft.thresholds.a_min,
      b_min: state.settingsDraft.thresholds.b_min,
    },
    min_matches: Number(state.settingsDraft.min_matches),
    refresh_interval_seconds: Number(state.settingsDraft.refresh_interval_seconds),
    patch_override_unix: state.settingsDraft.auto_patch
      ? null
      : dateInputToUnix(state.settingsDraft.patch_date),
    description_text: state.settingsDraft.description_text,
  }

  try {
    const response = await apiFetch('/api/admin/settings', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (response.status === 401) {
      handleSessionExpired()
      return
    }

    if (!response.ok) {
      showToast('Speichern fehlgeschlagen', true)
      return
    }

    const result = await response.json()
    populateSettingsDraft(result)
    renderSettings()
    showToast('Gespeichert')
  } catch (error) {
    showToast('Speichern fehlgeschlagen', true)
  } finally {
    state.isSavingSettings = false
    updateSettingsButtons()
  }
}

async function triggerRefresh() {
  if (state.isRefreshing) {
    return
  }

  state.isRefreshing = true
  updateSettingsButtons()

  try {
    const response = await apiFetch('/api/admin/refresh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (response.status === 401) {
      handleSessionExpired()
      return
    }

    if (!response.ok) {
      showToast('Refresh fehlgeschlagen', true)
      return
    }

    showToast('Refresh ausgeloest')
  } catch (error) {
    showToast('Refresh fehlgeschlagen', true)
  } finally {
    state.isRefreshing = false
    updateSettingsButtons()
  }
}

async function boot() {
  bindStaticEvents()
  showLoginScreen()

  try {
    state.user = await checkAuth()
  } catch (error) {
    showToast('Admin-Authentifizierung konnte nicht geprueft werden', true)
    return
  }

  if (!state.user) {
    return
  }

  showAppShell()
  document.getElementById('admin-user').textContent = state.user.username || String(state.user.id)

  try {
    const [heroes, tierlistPayload, settings] = await Promise.all([
      loadHeroesCatalog(),
      loadTierlistMeta().catch(() => {
        showToast('Tierlist-Metadaten konnten nicht geladen werden', true)
        return { tiers: [] }
      }),
      loadSettings(),
    ])

    if (!settings) {
      return
    }

    primeHeroDrafts(heroes, tierlistPayload)
    populateSettingsDraft(settings)
    renderTabs()
    renderHeroList()
    renderHeroEditor()
    renderSettings()

    if (state.selectedHeroId) {
      await ensureHeroAdminPayload(state.selectedHeroId)
    }
  } catch (error) {
    showToast('Admin-Daten konnten nicht geladen werden', true)
  }
}

boot()
