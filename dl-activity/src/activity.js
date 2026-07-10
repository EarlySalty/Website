import './main.css'
import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Filler,
  Tooltip,
  Legend,
  DoughnutController,
  ArcElement,
  BarController,
  BarElement,
} from 'chart.js'

Chart.register(
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Filler,
  Tooltip,
  Legend,
  DoughnutController,
  ArcElement,
  BarController,
  BarElement,
)

// API/Auth teilen sich die Deploy-Base (Vite `base`, via import.meta.env.BASE_URL =
// '/aktivitaet/'), damit die aufgerufenen Pfade nie von der Auslieferungs-Base wegdriften.
// Explizite VITE_API_BASE/VITE_AUTH_BASE übersteuern weiterhin (z. B. für getrennte Hosts).
const API_BASE = normalizeBase(import.meta.env.VITE_API_BASE ?? import.meta.env.BASE_URL)
const AUTH_BASE = normalizeBase(
  import.meta.env.VITE_AUTH_BASE ?? import.meta.env.VITE_API_BASE ?? import.meta.env.BASE_URL,
)
const REDIRECT_AFTER_LOGIN = '/aktivitaet/'
const FALLBACK_RANK_ORDER = [
  'initiate',
  'seeker',
  'alchemist',
  'arcanist',
  'ritualist',
  'emissary',
  'archon',
  'oracle',
  'phantom',
  'ascendant',
  'eternus',
]
const TABS = ['voice', 'text', 'peaks', 'ich']
const RANK_COLORS = {
  initiate:  '#8fa4b4',
  seeker:    '#72aa5a',
  alchemist: '#3dbb44',
  arcanist:  '#18bba8',
  ritualist: '#2288ee',
  emissary:  '#5055ee',
  archon:    '#8833dd',
  oracle:    '#cc33bb',
  phantom:   '#dd3344',
  ascendant: '#ee9922',
  eternus:   '#f5cc11',
}
const BRAND_CHART = {
  tooltipBg: 'rgba(11, 9, 7, 0.95)',
  border: 'rgba(201, 168, 106, 0.24)',
  grid: 'rgba(201, 168, 106, 0.08)',
  gridSoft: 'rgba(201, 168, 106, 0.06)',
  tick: '#b7aa91',
  donutBorder: '#130f0b',
  gold: 'rgba(201, 168, 106, 1)',
  goldFill: 'rgba(201, 168, 106, 0.16)',
  rust: 'rgba(221, 106, 77, 1)',
  rustFill: 'rgba(221, 106, 77, 0.14)',
}

const state = {
  tab: 'voice',
  me: null,
  voiceBoard: null,
  textBoard: null,
  rankLeaderboardSort: 'climb',
  rankLeaderboardEntries: null,
  rankLeaderboardExpanded: null,
  rankLeaderboardNotFound: new Set(),
  rankLeaderboardCharts: new Map(),
  rankChartSeq: 0,
  voiceChart: null,
  textChart: null,
  rankHistoryChart: null,
  distributionChart: null,
  weeklyChart: null,
  timelineChart: null,
  overallChart: null,
  timelineMetric: 'players',
  timelineDays: 7,
  weeklyWeeks: 4,
  personalRange: 30,
  rankHistoryDays: 30,
  rankThirtyDayDelta: null,
  rankVisibility: 'private',
  rankVisibilitySaving: false,
  overallChartType: 'bar',
  timelineData: null,
  distributionData: null,
  distributionInitialized: false,
  peaksInitialized: false,
}

init()

async function init() {
  bindTabs()
  bindAuthButtons()
  bindTimelineToggle()
  bindWeeklyToggle()
  bindPersonalRangeToggle()
  bindRankLeaderboardSortToggle()
  bindRankHistoryRangeToggle()
  bindRankVisibilityToggle()
  await loadRankColors()
  loadLeaderboard('voice')
  loadTextLeaderboard()
  loadRankLeaderboard()
  loadDistribution()
  state.distributionInitialized = true
  const me = await fetchMe()
  state.me = me
  renderAuthSlot(me)
  if (me) {
    showPersonalPanel()
    loadPersonal()
  } else {
    showPersonalGate()
  }
}

/* ── Tabs ── */
function bindTabs() {
  document.querySelectorAll('.page-tab').forEach((btn) => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab))
  })
  const hash = location.hash.replace('#', '')
  if (TABS.includes(hash)) switchTab(hash, false)
}

function switchTab(tabId, pushHash = true) {
  if (!TABS.includes(tabId)) tabId = 'voice'
  TABS.forEach((id) => {
    document.getElementById(`panel-${id}`).hidden = id !== tabId
  })
  document.querySelectorAll('.page-tab').forEach((btn) => {
    const active = btn.dataset.tab === tabId
    btn.classList.toggle('is-active', active)
    btn.setAttribute('aria-selected', active ? 'true' : 'false')
  })
  if (pushHash) history.replaceState(null, '', `#${tabId}`)
  if (tabId === 'voice' && !state.distributionInitialized) {
    state.distributionInitialized = true
    loadDistribution()
  }
  if (tabId === 'peaks' && !state.peaksInitialized) {
    state.peaksInitialized = true
    loadTimeline(state.timelineMetric)
    loadWeeklyTrend()
  }
  ;[
    state.distributionChart,
    state.weeklyChart,
    state.timelineChart,
    state.overallChart,
    state.voiceChart,
    state.textChart,
    state.rankHistoryChart,
    ...state.rankLeaderboardCharts.values(),
  ].forEach((chart) => {
    if (chart) chart.resize()
  })
}

/* ── Auth ── */
function bindAuthButtons() {
  document.getElementById('gate-login').addEventListener('click', (e) => {
    e.preventDefault()
    loginRedirect()
  })
  document.getElementById('logout-btn').addEventListener('click', async () => {
    await fetch(`${AUTH_BASE}/auth/discord/logout`, { method: 'POST', credentials: 'include' }).catch(() => {})
    state.me = null
    renderAuthSlot(null)
    showPersonalGate()
  })
}

function loginRedirect() {
  const url = new URL(`${AUTH_BASE}/auth/discord/login`, window.location.origin)
  url.searchParams.set('redirect', REDIRECT_AFTER_LOGIN)
  window.location.href = url.toString()
}

async function fetchMe() {
  try {
    const r = await fetch(`${API_BASE}/api/public/me`, { credentials: 'include' })
    if (!r.ok) return null
    return await r.json()
  } catch {
    return null
  }
}

function renderAuthSlot(me) {
  const slot = document.getElementById('auth-slot')
  slot.innerHTML = ''
  if (me) {
    const chip = document.createElement('span')
    chip.className = 'auth-placeholder'
    chip.innerHTML = `<strong style="color:var(--text)">${escapeHtml(me.name || 'Spieler')}</strong>`
    slot.appendChild(chip)
  } else {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'button button-discord'
    btn.textContent = 'Discord-Login'
    btn.addEventListener('click', loginRedirect)
    slot.appendChild(btn)
  }
}

function bindTimelineToggle() {
  document.querySelectorAll('#timeline-toggle .metric-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const metric = btn.dataset.metric
      if (!metric || metric === state.timelineMetric) return
      state.timelineMetric = metric
      document.querySelectorAll('#timeline-toggle .metric-btn').forEach((node) => {
        node.classList.toggle('is-active', node.dataset.metric === metric)
      })
      loadTimeline(metric)
    })
  })

  document.querySelectorAll('#timeline-days-toggle .metric-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const days = Number(btn.dataset.days)
      if (!days || days === state.timelineDays) return
      state.timelineDays = days
      document.querySelectorAll('#timeline-days-toggle .metric-btn').forEach((node) => {
        node.classList.toggle('is-active', Number(node.dataset.days) === days)
      })
      loadTimeline(state.timelineMetric)
    })
  })

  document.querySelectorAll('#overall-type-toggle .metric-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.type
      if (!type || type === state.overallChartType) return
      state.overallChartType = type
      document.querySelectorAll('#overall-type-toggle .metric-btn').forEach((node) => {
        node.classList.toggle('is-active', node.dataset.type === type)
      })
      if (state.timelineData) renderOverallTimeline(state.timelineData)
    })
  })
}

function bindWeeklyToggle() {
  document.querySelectorAll('#weekly-weeks-toggle .metric-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const weeks = Number(btn.dataset.weeks)
      if (!weeks || weeks === state.weeklyWeeks) return
      state.weeklyWeeks = weeks
      document.querySelectorAll('#weekly-weeks-toggle .metric-btn').forEach((node) => {
        node.classList.toggle('is-active', Number(node.dataset.weeks) === weeks)
      })
      loadWeeklyTrend()
    })
  })
}

function bindPersonalRangeToggle() {
  document.querySelectorAll('#personal-range-toggle .metric-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const range = Number(btn.dataset.range)
      if (!range || range === state.personalRange) return
      state.personalRange = range
      document.querySelectorAll('#personal-range-toggle .metric-btn').forEach((node) => {
        node.classList.toggle('is-active', Number(node.dataset.range) === range)
      })
      if (state.me) reloadPersonalCharts()
    })
  })
}

function bindRankLeaderboardSortToggle() {
  document.querySelectorAll('#rank-leaderboard-sort-toggle .metric-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const sort = btn.dataset.rankSort
      if (!sort || sort === state.rankLeaderboardSort) return
      state.rankLeaderboardSort = sort
      document.querySelectorAll('#rank-leaderboard-sort-toggle .metric-btn').forEach((node) => {
        node.classList.toggle('is-active', node.dataset.rankSort === sort)
      })
      loadRankLeaderboard()
    })
  })
}

function bindRankHistoryRangeToggle() {
  document.querySelectorAll('#rank-history-range-toggle .metric-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const days = Number(btn.dataset.rankDays)
      if (!Number.isFinite(days) || days === state.rankHistoryDays) return
      state.rankHistoryDays = days
      document.querySelectorAll('#rank-history-range-toggle .metric-btn').forEach((node) => {
        node.classList.toggle('is-active', Number(node.dataset.rankDays) === days)
      })
      if (state.me) loadPersonalRankHistory()
    })
  })
}

function bindRankVisibilityToggle() {
  document.querySelectorAll('#rank-visibility-toggle .metric-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const visibility = btn.dataset.rankVisibility
      if (!visibility || visibility === state.rankVisibility || state.rankVisibilitySaving) return
      saveRankVisibility(visibility)
    })
  })
}

/* ── Leaderboard ── */
async function loadLeaderboard(kind) {
  const title = document.getElementById('leaderboard-title')
  const sub = document.getElementById('leaderboard-sub')
  const updated = document.getElementById('leaderboard-updated')
  const body = document.getElementById('leaderboard-body')
  title.textContent = kind === 'voice' ? 'Voice-Leaderboard' : 'Text-Leaderboard'
  sub.firstChild.textContent = kind === 'voice'
    ? 'Nach Voice-Punkten, Top 50 · Stand: '
    : 'Nach Konversations-Punkten, Top 50 · Stand: '
  body.innerHTML = '<div class="state state-loading">Lade Leaderboard…</div>'

  try {
    const r = await fetch(`${API_BASE}/api/public/leaderboard/${kind}?limit=50`, { credentials: 'include' })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    const data = await r.json()
    if (kind === 'voice') state.voiceBoard = data
    else state.textBoard = data
    updated.textContent = data.updated_at ? formatRelative(data.updated_at) : '–'
    renderBoard(kind, data.entries || [])
  } catch (err) {
    body.innerHTML = `<div class="state state-error">Leaderboard konnte nicht geladen werden (${escapeHtml(err.message || 'Fehler')}).</div>`
  }
}

async function loadTextLeaderboard() {
  const body = document.getElementById('text-leaderboard-body')
  const updated = document.getElementById('text-leaderboard-updated')
  body.innerHTML = '<div class="state state-loading">Lade Leaderboard…</div>'
  try {
    const r = await fetch(`${API_BASE}/api/public/leaderboard/text?limit=50`, { credentials: 'include' })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    const data = await r.json()
    state.textBoard = data
    if (updated) updated.textContent = data.updated_at ? formatRelative(data.updated_at) : '–'
    renderBoardInto(body, 'text', data.entries || [])
  } catch (err) {
    body.innerHTML = `<div class="state state-error">Leaderboard konnte nicht geladen werden (${escapeHtml(err.message || 'Fehler')}).</div>`
  }
}

function renderBoard(kind, entries) {
  const body = document.getElementById('leaderboard-body')
  renderBoardInto(body, kind, entries)
  const meId = state.me?.user_id
  if (meId && entries.length && !entries.some((e) => String(e.user_id) === String(meId)) && state.me) {
    appendMeStickyRow(kind)
  }
}

function renderBoardInto(body, kind, entries) {
  if (!entries.length) {
    body.innerHTML = '<div class="state">Noch keine Einträge.</div>'
    return
  }
  const meId = state.me?.user_id
  const headerHtml = kind === 'voice'
    ? `<thead><tr><th>#</th><th>Spieler</th><th class="num hide-mobile">Zeit</th><th class="num">Punkte</th></tr></thead>`
    : `<thead><tr><th>#</th><th>Spieler</th><th class="num hide-mobile">Nachrichten</th><th class="num">Punkte</th></tr></thead>`
  const rowsHtml = entries.map((e) => rowHtml(e, kind, meId)).join('')
  body.innerHTML = `<table class="lb-table">${headerHtml}<tbody>${rowsHtml}</tbody></table>`
}

function rowHtml(e, kind, meId) {
  const rank = e.rank
  const isMe = meId && String(e.user_id) === String(meId)
  const rankClass = rank === 1 ? 'rank-top-1' : rank === 2 ? 'rank-top-2' : rank === 3 ? 'rank-top-3' : ''
  const medal = placeBadgeHtml(rank)
  const avatar = avatarHtml(e)
  const name = escapeHtml(e.name || 'Unbekannt')
  if (kind === 'voice') {
    const hours = formatHours(e.total_seconds || 0)
    return `<tr class="${rankClass} ${isMe ? 'is-me' : ''}">
      <td class="rank-cell"><span class="medal">${medal}</span></td>
      <td><div class="player-cell">${avatar}<span class="player-name">${name}</span></div></td>
      <td class="num hide-mobile"><span class="metric-sub">${hours}</span></td>
      <td class="num"><span class="metric-main">${formatNum(e.total_points || 0)}</span></td>
    </tr>`
  }
  return `<tr class="${rankClass} ${isMe ? 'is-me' : ''}">
    <td class="rank-cell"><span class="medal">${medal}</span></td>
    <td><div class="player-cell">${avatar}<span class="player-name">${name}</span></div></td>
    <td class="num hide-mobile"><span class="metric-sub">${formatNum(e.total_messages || 0)}</span></td>
    <td class="num"><span class="metric-main">${formatNum(e.total_points || 0)}</span></td>
  </tr>`
}

function appendMeStickyRow(kind) {
  // Fetch own stats to render a sticky row if not in top 50
  fetch(`${API_BASE}/api/public/me/stats`, { credentials: 'include' })
    .then((r) => (r.ok ? r.json() : null))
    .then((stats) => {
      if (!stats) return
      const block = kind === 'voice' ? stats.voice : stats.text
      if (!block || block.rank == null) return
      const table = document.querySelector('.lb-table tbody')
      if (!table) return
      const entry = {
        rank: block.rank,
        user_id: state.me.user_id,
        name: state.me.name,
        avatar_url: state.me.avatar_url,
        total_seconds: block.lifetime_seconds,
        total_points: block.lifetime_points,
        total_messages: block.lifetime_messages,
      }
      const tr = document.createElement('tr')
      tr.innerHTML = rowHtml(entry, kind, state.me.user_id)
      const innerTr = tr.querySelector('tr') || tr
      innerTr.classList.add('me-sticky')
      table.appendChild(innerTr)
    })
    .catch(() => {})
}

async function loadRankLeaderboard() {
  const body = document.getElementById('rank-leaderboard-body')
  if (!body) return
  collapseRankLeaderboardDetail()
  body.innerHTML = '<div class="state state-loading">Lade Rang-Leaderboard…</div>'
  try {
    const sort = state.rankLeaderboardSort
    const r = await fetch(`${API_BASE}/api/public/leaderboard/rank?sort=${encodeURIComponent(sort)}&days=30&limit=50`, {
      credentials: 'include',
    })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    const data = await r.json()
    const entries = Array.isArray(data) ? data : data?.entries || []
    state.rankLeaderboardEntries = entries
    renderRankLeaderboard(entries)
  } catch {
    body.innerHTML = '<div class="state state-error">Rang-Leaderboard konnte nicht geladen werden.</div>'
  }
}

function renderRankLeaderboard(entries) {
  const body = document.getElementById('rank-leaderboard-body')
  if (!body) return
  if (!entries.length) {
    body.innerHTML = '<div class="state">Noch niemand sichtbar — schalte deinen Verlauf auf Öffentlich, um hier aufzutauchen.</div>'
    return
  }

  const showDelta = state.rankLeaderboardSort === 'climb'
  const headerHtml = showDelta
    ? '<thead><tr><th>Platz</th><th>Spieler</th><th>Rang</th><th class="num">Veränderung</th></tr></thead>'
    : '<thead><tr><th>Platz</th><th>Spieler</th><th>Rang</th></tr></thead>'
  const rowsHtml = entries.map((entry, idx) => rankLeaderboardRowHtml(entry, idx, showDelta)).join('')
  body.innerHTML = `<table class="lb-table rank-lb-table">${headerHtml}<tbody>${rowsHtml}</tbody></table>`
  body.onclick = handleRankLeaderboardClick
}

function rankLeaderboardRowHtml(entry, idx, showDelta) {
  const userId = String(entry.user_id ?? '')
  const place = idx + 1
  const rankClass = place === 1 ? 'rank-top-1' : place === 2 ? 'rank-top-2' : place === 3 ? 'rank-top-3' : ''
  const medal = placeBadgeHtml(place)
  const name = escapeHtml(entry.display_name || 'Unbekannt')
  const disabled = !userId || state.rankLeaderboardNotFound.has(userId)
  const deltaCell = showDelta ? `<td class="num">${rankDeltaHtml(entry.delta)}</td>` : ''
  return `<tr class="rank-board-row ${rankClass} ${disabled ? 'is-not-expandable' : ''}" data-user-id="${escapeHtml(userId)}" data-rank-index="${idx}" aria-expanded="false">
    <td class="rank-cell"><span class="medal">${medal}</span></td>
    <td><div class="player-cell"><span class="avatar">${escapeHtml(initialsOf(entry.display_name || 'Unbekannt'))}</span><span class="player-name">${name}</span></div></td>
    <td>${rankBadgeHtml(entry.rank_name, entry.badge_level)}</td>
    ${deltaCell}
  </tr>`
}

function placeBadgeHtml(place) {
  if (![1, 2, 3].includes(place)) return `#${place}`
  return `<span class="place-badge place-badge-${place}" aria-label="Platz ${place}"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><text x="12" y="12">${place}</text></svg></span>`
}

function rankDeltaHtml(delta) {
  const value = Number(delta || 0)
  const className = value > 0 ? 'is-positive' : value < 0 ? 'is-negative' : 'is-zero'
  const label = value > 0 ? `+${value}` : value < 0 ? `−${Math.abs(value)}` : '0'
  const coaching = value < 0
    ? '<a class="rank-coaching-link" href="/coaching/">Coaching-Etage →</a>'
    : ''
  return `<span class="rank-delta ${className}">${label}</span>${coaching}`
}

function handleRankLeaderboardClick(event) {
  if (event.target.closest('a')) return
  const row = event.target.closest('.rank-board-row')
  if (!row || row.classList.contains('is-not-expandable')) return
  const userId = row.dataset.userId
  if (!userId || state.rankLeaderboardNotFound.has(userId)) return
  toggleRankLeaderboardDetail(row, userId)
}

async function toggleRankLeaderboardDetail(row, userId) {
  if (state.rankLeaderboardExpanded === userId) {
    collapseRankLeaderboardDetail()
    return
  }

  collapseRankLeaderboardDetail()
  state.rankLeaderboardExpanded = userId
  row.setAttribute('aria-expanded', 'true')

  const colSpan = state.rankLeaderboardSort === 'climb' ? 4 : 3
  const detailRow = document.createElement('tr')
  detailRow.className = 'rank-board-detail'
  detailRow.innerHTML = `<td colspan="${colSpan}"><div class="state state-loading">Lade Rangverlauf…</div></td>`
  row.after(detailRow)

  try {
    const r = await fetch(`${API_BASE}/api/public/rank-history/${encodeURIComponent(userId)}?days=30`, {
      credentials: 'include',
    })
    if (r.status === 404) {
      state.rankLeaderboardNotFound.add(userId)
      markRankLeaderboardRowNotFound(userId)
      if (state.rankLeaderboardExpanded === userId) collapseRankLeaderboardDetail()
      return
    }
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    const data = await r.json()
    if (state.rankLeaderboardExpanded !== userId || !detailRow.isConnected) return
    renderRankLeaderboardDetail(detailRow, data, userId)
  } catch {
    if (state.rankLeaderboardExpanded === userId) collapseRankLeaderboardDetail()
  }
}

function renderRankLeaderboardDetail(detailRow, data, userId) {
  const colSpan = state.rankLeaderboardSort === 'climb' ? 4 : 3
  const chartId = `rank-leaderboard-chart-${++state.rankChartSeq}`
  detailRow.innerHTML = `<td colspan="${colSpan}">
    <div class="rank-history-expand">
      <div class="chart-wrapper chart-wrapper-md"><canvas id="${chartId}"></canvas></div>
    </div>
  </td>`
  const chart = createRankHistoryChart(document.getElementById(chartId), data)
  if (chart) state.rankLeaderboardCharts.set(userId, chart)
}

function collapseRankLeaderboardDetail() {
  document.querySelectorAll('.rank-board-row[aria-expanded="true"]').forEach((row) => {
    row.setAttribute('aria-expanded', 'false')
  })
  document.querySelectorAll('.rank-board-detail').forEach((row) => row.remove())
  state.rankLeaderboardCharts.forEach((chart) => chart.destroy())
  state.rankLeaderboardCharts.clear()
  state.rankLeaderboardExpanded = null
}

function markRankLeaderboardRowNotFound(userId) {
  document.querySelectorAll('.rank-board-row').forEach((row) => {
    if (row.dataset.userId === userId) {
      row.classList.add('is-not-expandable')
      row.setAttribute('aria-expanded', 'false')
    }
  })
}

async function loadDistribution() {
  const chipGrid = document.getElementById('rank-chip-grid')
  chipGrid.innerHTML = '<div class="state state-loading">Lade Verteilung…</div>'
  try {
    const data = await fetchJson(`${API_BASE}/api/rank-distribution`)
    if (!data) throw new Error('Keine Daten')
    state.distributionData = data
    renderDistribution(data)
  } catch {
    document.getElementById('distribution-total').textContent = '–'
    document.getElementById('distribution-updated').textContent = 'Stand: derzeit nicht verfügbar'
    chipGrid.innerHTML = '<div class="state">Rangverteilung ist aktuell nicht erreichbar.</div>'
  }
}

async function loadWeeklyTrend() {
  try {
    const data = await fetchJson(`${API_BASE}/api/rank-distribution?weeks=${state.weeklyWeeks}`)
    if (!data) throw new Error('Keine Daten')
    renderWeeklyChart(data)
  } catch {
    // Weekly-Chart bleibt leer
  }
}

async function loadTimeline(metric) {
  const rankSection = document.getElementById('rank-chart-section')
  const overallSection = document.getElementById('overall-chart-section')
  const isOverall = metric === 'overall'
  rankSection.hidden = isOverall
  overallSection.hidden = !isOverall

  const apiMetric = isOverall ? 'players' : metric
  const legend = document.getElementById('timeline-rank-legend')
  legend.innerHTML = '<div class="state state-loading">Lade Aktivität…</div>'
  try {
    const data = await fetchJson(`${API_BASE}/api/timeline?metric=${encodeURIComponent(apiMetric)}&days=${state.timelineDays}`)
    if (!data) throw new Error('Keine Daten')
    state.timelineData = data
    if (isOverall) {
      renderOverallTimeline(data)
    } else {
      renderTimeline(data)
    }
  } catch {
    legend.innerHTML = '<div class="state">Aktivität nach Uhrzeit ist aktuell nicht erreichbar.</div>'
  }
}

function renderDistribution(data) {
  const rankOrder = data?.rank_order?.length ? data.rank_order : FALLBACK_RANK_ORDER
  const distribution = data?.distribution || {}
  const total = rankOrder.reduce((sum, rank) => sum + (distribution[rank] || 0), 0)
  document.getElementById('distribution-total').textContent = formatNum(total)
  document.getElementById('distribution-updated').textContent =
    `Stand: ${data?.generated_at ? formatRelative(data.generated_at) : '–'}`

  const chipGrid = document.getElementById('rank-chip-grid')
  chipGrid.innerHTML = rankOrder.map((rank) => {
    const value = distribution[rank] || 0
    const pct = total > 0 ? Math.round((value / total) * 100) : 0
    return `
      <div class="rank-chip">
        <span class="rank-chip-dot" style="background:${rankColor(rank)}"></span>
        <span class="rank-chip-name">${escapeHtml(prettyRank(rank))}</span>
        <span class="rank-chip-value">${formatNum(value)} · ${pct}%</span>
      </div>
    `
  }).join('')

  const donutCanvas = document.getElementById('chart-distribution')
  state.distributionChart?.destroy()
  state.distributionChart = new Chart(donutCanvas, {
    type: 'doughnut',
    data: {
      labels: rankOrder.map(prettyRank),
      datasets: [{
        data: rankOrder.map((rank) => distribution[rank] || 0),
        backgroundColor: rankOrder.map(rankColor),
        borderColor: BRAND_CHART.donutBorder,
        borderWidth: 2,
        hoverOffset: 6,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '68%',
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: BRAND_CHART.tooltipBg,
          borderColor: BRAND_CHART.border,
          borderWidth: 1,
          padding: 10,
          callbacks: {
            label: (ctx) => {
              const value = ctx.raw || 0
              const pct = total > 0 ? Math.round((value / total) * 100) : 0
              return `${ctx.label}: ${formatNum(value)} (${pct}%)`
            },
          },
        },
      },
    },
  })
}

function renderWeeklyChart(data) {
  const rankOrder = data?.rank_order?.length ? data.rank_order : FALLBACK_RANK_ORDER
  const weeklyCanvas = document.getElementById('chart-weekly-ranks')
  if (!weeklyCanvas) return
  const weekly = data?.weekly_trend || []
  state.weeklyChart?.destroy()
  state.weeklyChart = new Chart(weeklyCanvas, {
    type: 'bar',
    data: {
      labels: weekly.map((_, idx) => `Woche ${idx + 1}`),
      datasets: rankOrder.map((rank) => ({
        label: prettyRank(rank),
        data: weekly.map((entry) => entry?.data?.[rank] || 0),
        backgroundColor: rankColor(rank),
        borderRadius: 5,
        borderSkipped: false,
      })),
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: BRAND_CHART.tooltipBg,
          borderColor: BRAND_CHART.border,
          borderWidth: 1,
          padding: 10,
        },
      },
      scales: {
        x: {
          stacked: true,
          grid: { display: false },
          ticks: { color: BRAND_CHART.tick, font: { size: 11 } },
        },
        y: {
          stacked: true,
          beginAtZero: true,
          grid: { color: BRAND_CHART.grid },
          ticks: { color: BRAND_CHART.tick, font: { size: 11 }, precision: 0 },
        },
      },
    },
  })
}

function renderTimeline(data) {
  const rankOrder = data?.rank_order?.length ? data.rank_order : FALLBACK_RANK_ORDER
  const timeline = Array.isArray(data?.timeline) ? data.timeline : []
  const unit = state.timelineMetric === 'hours' ? 'Stunden' : 'Spieler'
  const labels = timeline.map((entry) => `${String(entry.hour || 0).padStart(2, '0')}:00`)

  const canvas = document.getElementById('chart-rank-timeline')
  state.timelineChart?.destroy()
  state.timelineChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: rankOrder.map((rank) => ({
        label: prettyRank(rank),
        data: timeline.map((entry) => entry?.ranks?.[rank] || 0),
        borderColor: rankColor(rank),
        backgroundColor: `${rankColor(rank)}22`,
        borderWidth: 2,
        tension: 0.32,
        pointRadius: 2,
        pointHoverRadius: 4,
        fill: false,
      })),
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: BRAND_CHART.tooltipBg,
          borderColor: BRAND_CHART.border,
          borderWidth: 1,
          padding: 10,
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${formatTimelineValue(ctx.raw)} ${unit}`,
          },
        },
      },
      scales: {
        x: {
          grid: { color: BRAND_CHART.gridSoft },
          ticks: { color: BRAND_CHART.tick, font: { size: 11 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 12 },
        },
        y: {
          beginAtZero: true,
          grid: { color: BRAND_CHART.grid },
          ticks: { color: BRAND_CHART.tick, font: { size: 11 } },
        },
      },
    },
  })

  const legend = document.getElementById('timeline-rank-legend')
  legend.innerHTML = rankOrder.map((rank, idx) => `
    <button class="rank-chip rank-chip-button" type="button" data-rank-index="${idx}">
      <span class="rank-chip-dot" style="background:${rankColor(rank)}"></span>
      <span class="rank-chip-name">${escapeHtml(prettyRank(rank))}</span>
    </button>
  `).join('')

  legend.querySelectorAll('.rank-chip-button').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.rankIndex)
      const meta = state.timelineChart?.getDatasetMeta(idx)
      if (!meta) return
      meta.hidden = meta.hidden === null ? !state.timelineChart.isDatasetVisible(idx) : null
      state.timelineChart.update()
      btn.classList.toggle('is-muted', !state.timelineChart.isDatasetVisible(idx))
    })
  })

}

function renderOverallTimeline(data) {
  const timeline = Array.isArray(data?.timeline) ? data.timeline : []
  const rankOrder = data?.rank_order?.length ? data.rank_order : FALLBACK_RANK_ORDER
  const unit = 'Spieler'
  const labels = timeline.map((entry) => `${String(entry.hour || 0).padStart(2, '0')}:00`)
  const totals = timeline.map((entry) =>
    rankOrder.reduce((sum, rank) => sum + (entry?.ranks?.[rank] || 0), 0),
  )

  const chartType = state.overallChartType
  const isBar = chartType === 'bar'

  const canvas = document.getElementById('chart-overall-timeline')
  state.overallChart?.destroy()
  state.overallChart = new Chart(canvas, {
    type: chartType,
    data: {
      labels,
      datasets: [
        {
          label: `Gesamt ${unit}`,
          data: totals,
          backgroundColor: BRAND_CHART.goldFill,
          borderColor: BRAND_CHART.gold,
          borderWidth: isBar ? 1 : 2,
          borderRadius: isBar ? 4 : 0,
          borderSkipped: false,
          tension: 0.32,
          pointRadius: isBar ? 0 : 2,
          pointHoverRadius: isBar ? 0 : 4,
          fill: !isBar,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: BRAND_CHART.tooltipBg,
          borderColor: BRAND_CHART.border,
          borderWidth: 1,
          padding: 10,
          callbacks: {
            label: (ctx) => `Gesamt: ${formatTimelineValue(ctx.raw)} ${unit}`,
          },
        },
      },
      scales: {
        x: {
          grid: { color: BRAND_CHART.gridSoft },
          ticks: { color: BRAND_CHART.tick, font: { size: 11 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 12 },
        },
        y: {
          beginAtZero: true,
          grid: { color: BRAND_CHART.grid },
          ticks: { color: BRAND_CHART.tick, font: { size: 11 } },
        },
      },
    },
  })
}

/* ── Personal Panel ── */
function showPersonalGate() {
  document.getElementById('personal-gate').hidden = false
  document.getElementById('personal-panel').hidden = true
}
function showPersonalPanel() {
  document.getElementById('personal-gate').hidden = true
  document.getElementById('personal-panel').hidden = false
}

async function loadPersonal() {
  const me = state.me
  document.getElementById('me-name').textContent = me.name || 'Du'
  const avatar = document.getElementById('me-avatar')
  avatar.className = 'avatar avatar-lg'
  if (me.avatar_url) {
    avatar.style.backgroundImage = `url(${me.avatar_url})`
    avatar.textContent = ''
  } else {
    avatar.textContent = initialsOf(me.name)
  }

  const [stats, voiceHist, textHist, heatmap, coplayers] = await Promise.all([
    fetchJson(`${API_BASE}/api/public/me/stats`),
    fetchJson(`${API_BASE}/api/public/me/voice-history?range=${state.personalRange}&mode=day`),
    fetchJson(`${API_BASE}/api/public/me/text-history?range=${state.personalRange}&mode=day`),
    fetchJson(`${API_BASE}/api/public/me/heatmap?days=${state.personalRange}`),
    fetchJson(`${API_BASE}/api/public/me/co-players?limit=15`),
  ])

  renderStats(stats)
  renderVoiceChart(voiceHist)
  renderTextChart(textHist)
  renderHeatmap(heatmap)
  renderCoPlayers(coplayers)
  loadPersonalRankHistory()

  const meta = document.getElementById('me-meta')
  if (stats?.voice?.rank && stats?.text?.rank) {
    meta.textContent = `Voice #${stats.voice.rank} · Text #${stats.text.rank}`
  } else if (stats?.voice?.rank) {
    meta.textContent = `Voice #${stats.voice.rank}`
  } else if (stats?.text?.rank) {
    meta.textContent = `Text #${stats.text.rank}`
  } else {
    meta.textContent = 'Noch keine Punkte — fang an zu grinden.'
  }
}

async function reloadPersonalCharts() {
  if (!state.me) return
  const range = state.personalRange
  const [voiceHist, textHist, heatmap] = await Promise.all([
    fetchJson(`${API_BASE}/api/public/me/voice-history?range=${range}&mode=day`),
    fetchJson(`${API_BASE}/api/public/me/text-history?range=${range}&mode=day`),
    fetchJson(`${API_BASE}/api/public/me/heatmap?days=${range}`),
  ])
  renderVoiceChart(voiceHist)
  renderTextChart(textHist)
  renderHeatmap(heatmap)
}

async function loadPersonalRankHistory() {
  const body = document.getElementById('personal-rank-history-body')
  if (!body) return
  body.innerHTML = '<div class="state state-loading">Lade Rangverlauf…</div>'
  state.rankHistoryChart?.destroy()
  state.rankHistoryChart = null

  try {
    const r = await fetch(`${API_BASE}/api/public/me/rank-history?days=${state.rankHistoryDays}`, {
      credentials: 'include',
    })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    const data = await r.json()
    setRankVisibilitySelection(data?.visibility || 'private')
    renderPersonalRankHistory(data)
  } catch {
    setRankVisibilitySelection('private')
    renderPersonalRankHistory(null)
  }
}

function renderPersonalRankHistory(data) {
  const body = document.getElementById('personal-rank-history-body')
  if (!body) return
  const points = rankHistoryPoints(data)
  if (!points.length) {
    body.innerHTML = '<div class="state">Noch keine Rang-Daten vorhanden.</div>'
    return
  }

  const current = normalizeRankEntry(data?.current) || points[points.length - 1]
  if (state.rankHistoryDays === 30) {
    state.rankThirtyDayDelta = rankDeltaFromPoints(points)
  }
  const showCoaching = state.rankThirtyDayDelta < 0
  const chartId = 'chart-personal-rank-history'
  body.innerHTML = `
    <div class="rank-history-layout">
      <div class="rank-current-card">
        ${rankBadgeHtml(current.rank_name, current.badge_level, 'rank-badge-lg')}
        <span class="rank-current-level">${formatNum(current.badge_level)}</span>
        <span class="rank-current-date">${escapeHtml(formatDateTime(current.captured_at))}</span>
      </div>
      <div class="rank-chart-card">
        <div class="chart-wrapper"><canvas id="${chartId}"></canvas></div>
      </div>
    </div>
    ${showCoaching ? '<a class="rank-coaching-box" href="/coaching/">Rang im Sinkflug? Auf der Coaching-Etage helfen wir dir zurück nach oben →</a>' : ''}
  `
  state.rankHistoryChart = createRankHistoryChart(document.getElementById(chartId), data)
}

async function saveRankVisibility(visibility) {
  const previous = state.rankVisibility
  const feedback = document.getElementById('rank-visibility-feedback')
  if (feedback) feedback.textContent = ''
  syncRankVisibilityButtons(visibility)
  setRankVisibilityDisabled(true)
  state.rankVisibilitySaving = true
  try {
    const r = await fetch(`${API_BASE}/api/public/me/rank-visibility`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visibility }),
    })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    const data = await r.json().catch(() => null)
    setRankVisibilitySelection(data?.visibility || visibility)
    if (feedback) feedback.textContent = 'Gespeichert.'
    loadRankLeaderboard()
  } catch {
    syncRankVisibilityButtons(previous)
    if (feedback) feedback.textContent = 'Speichern fehlgeschlagen.'
  } finally {
    state.rankVisibilitySaving = false
    setRankVisibilityDisabled(false)
  }
}

function setRankVisibilitySelection(visibility) {
  state.rankVisibility = visibility
  syncRankVisibilityButtons(visibility)
}

function syncRankVisibilityButtons(visibility) {
  document.querySelectorAll('#rank-visibility-toggle .metric-btn').forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.rankVisibility === visibility)
  })
}

function setRankVisibilityDisabled(disabled) {
  document.querySelectorAll('#rank-visibility-toggle .metric-btn').forEach((btn) => {
    btn.disabled = disabled
  })
}

function renderStats(stats) {
  if (!stats) return
  const v = stats.voice || {}
  const t = stats.text || {}
  setStat('stat-voice-rank', v.rank ? `#${v.rank}` : '–', `${formatNum(v.lifetime_points || 0)} Pkt gesamt`)
  setStat('stat-text-rank', t.rank ? `#${t.rank}` : '–', `${formatNum(t.lifetime_points || 0)} Pkt gesamt`)
  setStat('stat-voice-30', formatHours(v.range_seconds ?? 0), `${formatNum(v.range_points || 0)} Punkte · ${v.range_sessions || 0} Sessions`)
  setStat('stat-text-30', formatNum(t.range_points || 0), `${formatNum(t.range_messages || 0)} Nachrichten · ${t.range_sessions || 0} Sessions`)
}

function setStat(id, value, meta) {
  document.getElementById(id).textContent = value
  const metaEl = document.getElementById(`${id}-meta`)
  if (metaEl) metaEl.textContent = meta || ''
}

function renderVoiceChart(data) {
  const ctx = document.getElementById('chart-voice')
  if (!ctx) return
  const daily = data?.daily || []
  const labels = daily.map((d) => formatDayShort(d.day))
  const hours = daily.map((d) => +((d.total_seconds || 0) / 3600).toFixed(2))
  state.voiceChart?.destroy()
  state.voiceChart = new Chart(ctx, lineChartConfig(labels, hours, 'Stunden', BRAND_CHART.gold, BRAND_CHART.goldFill))
}

function renderTextChart(data) {
  const ctx = document.getElementById('chart-text')
  if (!ctx) return
  const daily = data?.daily || []
  const labels = daily.map((d) => formatDayShort(d.day))
  const values = daily.map((d) => d.total_points || 0)
  state.textChart?.destroy()
  state.textChart = new Chart(ctx, lineChartConfig(labels, values, 'Punkte', BRAND_CHART.rust, BRAND_CHART.rustFill))
}

function lineChartConfig(labels, data, label, stroke, fill) {
  return {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label,
        data,
        borderColor: stroke,
        backgroundColor: fill,
        borderWidth: 2,
        tension: 0.32,
        fill: true,
        pointRadius: 2,
        pointHoverRadius: 5,
        pointBackgroundColor: stroke,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: BRAND_CHART.tooltipBg,
          borderColor: BRAND_CHART.border,
          borderWidth: 1,
          padding: 10,
          titleFont: { family: 'Sora' },
          bodyFont: { family: 'Manrope' },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: BRAND_CHART.tick, font: { size: 11 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 },
        },
        y: {
          beginAtZero: true,
          grid: { color: BRAND_CHART.grid },
          ticks: { color: BRAND_CHART.tick, font: { size: 11 }, precision: 0 },
        },
      },
    },
  }
}

function createRankHistoryChart(canvas, data) {
  if (!canvas) return null
  const points = rankHistoryPoints(data)
  if (!points.length) return null
  const labels = points.map((point) => formatDayShort(point.captured_at))
  const values = points.map((point) => point.badge_level)
  const colors = points.map((point) => rankColor(point.rank_name))
  const stroke = colors[colors.length - 1] || BRAND_CHART.gold
  const min = Math.min(...values)
  const max = Math.max(...values)

  return new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'badge_level',
        data: values,
        borderColor: stroke,
        segment: {
          borderColor: (ctx) => colors[ctx.p1DataIndex] || stroke,
        },
        backgroundColor: colorWithAlpha(stroke, '22'),
        borderWidth: 2,
        tension: 0.32,
        fill: false,
        pointRadius: 3,
        pointHoverRadius: 5,
        pointBackgroundColor: colors,
        pointBorderColor: colors,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: BRAND_CHART.tooltipBg,
          borderColor: BRAND_CHART.border,
          borderWidth: 1,
          padding: 10,
          titleFont: { family: 'Sora' },
          bodyFont: { family: 'Manrope' },
          callbacks: {
            title: (items) => formatDateTime(points[items?.[0]?.dataIndex]?.captured_at),
            label: (ctx) => `${rankBadgeLabel(points[ctx.dataIndex]?.rank_name, points[ctx.dataIndex]?.badge_level)} · ${formatNum(ctx.raw)}`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: BRAND_CHART.tick, font: { size: 11 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 },
        },
        y: {
          suggestedMin: Math.max(0, min - 1),
          suggestedMax: max + 1,
          grid: { color: BRAND_CHART.grid },
          ticks: { color: BRAND_CHART.tick, font: { size: 11 }, precision: 0 },
        },
      },
    },
  })
}

function renderHeatmap(data) {
  const container = document.getElementById('heatmap')
  container.innerHTML = ''
  const matrix = data?.matrix
  if (!Array.isArray(matrix) || matrix.length !== 7) {
    container.innerHTML = '<div class="state">Noch nicht genug Voice-Aktivität für die Heatmap.</div>'
    return
  }

  // compute max
  let max = 0
  for (const row of matrix) for (const v of row) if (v > max) max = v
  const days = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

  // header row
  const empty = document.createElement('span')
  empty.className = 'hm-head'
  container.appendChild(empty)
  for (let h = 0; h < 24; h++) {
    const cell = document.createElement('span')
    cell.className = 'hm-head'
    cell.textContent = h % 3 === 0 ? String(h).padStart(2, '0') : ''
    container.appendChild(cell)
  }

  for (let d = 0; d < 7; d++) {
    const label = document.createElement('span')
    label.className = 'hm-row-label'
    label.textContent = days[d]
    container.appendChild(label)
    for (let h = 0; h < 24; h++) {
      const v = matrix[d][h] || 0
      const cell = document.createElement('span')
      cell.className = 'hm-cell'
      const intensity = max > 0 ? v / max : 0
      cell.style.background = heatmapColor(intensity)
      const mins = Math.round(v / 60)
      cell.title = `${days[d]} ${String(h).padStart(2, '0')}:00 — ${mins} min`
      container.appendChild(cell)
    }
  }
}

function heatmapColor(t) {
  if (t <= 0) return 'rgba(201, 168, 106, 0.05)'
  const r = Math.round(201 + (221 - 201) * t)
  const g = Math.round(168 + (106 - 168) * t)
  const b = Math.round(106 + (77 - 106) * t)
  const a = 0.25 + t * 0.75
  return `rgba(${r}, ${g}, ${b}, ${a.toFixed(2)})`
}

function renderCoPlayers(data) {
  const list = document.getElementById('coplayer-list')
  list.innerHTML = ''
  const entries = data?.entries || []
  if (!entries.length) {
    list.innerHTML = '<li class="state">Noch keine gemeinsamen Voice-Sessions.</li>'
    return
  }
  entries.forEach((e, idx) => {
    const li = document.createElement('li')
    const mins = e.total_minutes_together || 0
    const timeStr = mins >= 60 ? `${(mins / 60).toFixed(1)}h` : `${mins}m`
    li.innerHTML = `
      <span class="cp-rank">${idx + 1}</span>
      <span class="avatar">${escapeHtml(initialsOf(e.name))}</span>
      <span class="cp-name">${escapeHtml(e.name || 'Unbekannt')}</span>
      <span class="cp-meta">${e.sessions_together || 0} × · ${timeStr}</span>
    `
    list.appendChild(li)
  })
}

/* ── Helpers ── */
async function loadRankColors() {
  const data = await fetchJson(`${API_BASE}/api/rank-colors`)
  const colors = data?.colors
  if (!colors || typeof colors !== 'object') return
  Object.entries(colors).forEach(([rank, color]) => {
    const safeColor = normalizeCssColor(color)
    if (rank && safeColor) RANK_COLORS[String(rank).toLowerCase()] = safeColor
  })
}

async function fetchJson(url) {
  try {
    const r = await fetch(url, { credentials: 'include' })
    if (!r.ok) return null
    return await r.json()
  } catch {
    return null
  }
}

function avatarHtml(entry) {
  if (entry.avatar_url) {
    return `<span class="avatar" style="background-image:url(${encodeURI(entry.avatar_url)})"></span>`
  }
  return `<span class="avatar">${escapeHtml(initialsOf(entry.name))}</span>`
}

function initialsOf(name) {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/).slice(0, 2)
  return parts.map((p) => p[0] || '').join('').toUpperCase() || name[0].toUpperCase()
}

function formatHours(seconds) {
  const s = Math.max(0, +seconds || 0)
  if (s < 60) return `${Math.round(s)}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  const rem = m % 60
  if (h < 48) return rem ? `${h}h ${rem}m` : `${h}h`
  return `${h}h`
}

function formatNum(n) {
  try { return new Intl.NumberFormat('de-DE').format(Math.round(n)) }
  catch { return String(Math.round(n)) }
}

function formatDayShort(iso) {
  if (!iso) return ''
  try {
    const d = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso)
    return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })
  } catch {
    return iso
  }
}

function formatRelative(iso) {
  try {
    const d = new Date(iso)
    const diffMs = Date.now() - d.getTime()
    const mins = Math.round(diffMs / 60000)
    if (mins < 1) return 'gerade eben'
    if (mins < 60) return `vor ${mins} min`
    const hrs = Math.round(mins / 60)
    if (hrs < 24) return `vor ${hrs} h`
    return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch {
    return iso
  }
}

function prettyRank(rank) {
  const s = String(rank || '').trim()
  if (!s) return 'Unbekannt'
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function rankBadgeHtml(rankName, badgeLevel, extraClass = '') {
  const color = rankColor(rankName)
  return `<span class="rank-badge ${extraClass}" style="--rank-color:${color}">
    <span class="rank-badge-dot" aria-hidden="true"></span>
    <span class="rank-badge-name">${escapeHtml(rankBadgeLabel(rankName, badgeLevel))}</span>
  </span>`
}

function rankBadgeLabel(rankName, badgeLevel) {
  const subrank = subrankFromBadgeLevel(badgeLevel)
  const rank = prettyRank(rankName)
  return subrank ? `${rank} ${subrank}` : rank
}

function subrankFromBadgeLevel(badgeLevel) {
  const level = Number(badgeLevel)
  if (!Number.isFinite(level)) return ''
  const subrank = Math.abs(Math.trunc(level)) % 10
  return subrank > 0 ? String(subrank) : ''
}

function rankColor(rank) {
  return RANK_COLORS[String(rank || '').toLowerCase()] || '#c8a86b'
}

function normalizeRankEntry(entry) {
  if (!entry) return null
  const badgeLevel = Number(entry.badge_level)
  const capturedAt = String(entry.captured_at || '')
  if (!Number.isFinite(badgeLevel) || !capturedAt) return null
  return {
    badge_level: badgeLevel,
    rank_name: String(entry.rank_name || ''),
    captured_at: capturedAt,
  }
}

function rankHistoryPoints(data) {
  const raw = Array.isArray(data?.history) ? [...data.history] : []
  if (data?.current) raw.push(data.current)
  const seen = new Set()
  return raw
    .map(normalizeRankEntry)
    .filter(Boolean)
    .filter((entry) => {
      const key = `${entry.captured_at}|${entry.badge_level}|${entry.rank_name}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .sort((a, b) => timestampOf(a.captured_at) - timestampOf(b.captured_at))
}

function rankDeltaFromPoints(points) {
  if (!points.length) return 0
  return Math.trunc(points[points.length - 1].badge_level) - Math.trunc(points[0].badge_level)
}

function timestampOf(iso) {
  const ts = Date.parse(iso)
  return Number.isFinite(ts) ? ts : 0
}

function formatTimelineValue(value) {
  if (state.timelineMetric === 'hours') {
    const num = Number(value || 0)
    return new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 }).format(num)
  }
  return formatNum(value || 0)
}

function normalizeBase(value) {
  const raw = String(value ?? '').trim()
  if (!raw || raw === '/' || raw === '.') return ''
  return raw.replace(/\/+$/, '')
}

function formatDateTime(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch {
    return iso
  }
}

function colorWithAlpha(color, alphaHex) {
  const s = String(color || '').trim()
  if (/^#[0-9a-f]{6}$/i.test(s)) return `${s}${alphaHex}`
  return 'rgba(201, 168, 106, 0.14)'
}

function normalizeCssColor(color) {
  const s = String(color || '').trim()
  if (/^#[0-9a-f]{6}$/i.test(s)) return s
  return null
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c])
}
