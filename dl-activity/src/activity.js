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

const API_BASE = normalizeBase(import.meta.env.VITE_API_BASE)
const AUTH_BASE = normalizeBase(import.meta.env.VITE_AUTH_BASE ?? import.meta.env.VITE_API_BASE)
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

const state = {
  tab: 'voice',
  me: null,
  voiceBoard: null,
  textBoard: null,
  voiceChart: null,
  textChart: null,
  distributionChart: null,
  weeklyChart: null,
  timelineChart: null,
  overallChart: null,
  timelineMetric: 'players',
  timelineDays: 7,
  weeklyWeeks: 4,
  personalRange: 30,
  overallChartType: 'bar',
  timelineData: null,
  distributionData: null,
  distributionInitialized: false,
  peaksInitialized: false,
}

document.getElementById('year').textContent = new Date().getFullYear()

init()

async function init() {
  bindTabs()
  bindAuthButtons()
  bindTimelineToggle()
  bindWeeklyToggle()
  bindPersonalRangeToggle()
  loadLeaderboard('voice')
  loadTextLeaderboard()
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
    chip.innerHTML = `<strong style="color:var(--text)">${escapeHtml(me.name || 'User')}</strong>`
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
    : `<thead><tr><th>#</th><th>Spieler</th><th class="num hide-mobile">Messages</th><th class="num">Punkte</th></tr></thead>`
  const rowsHtml = entries.map((e) => rowHtml(e, kind, meId)).join('')
  body.innerHTML = `<table class="lb-table">${headerHtml}<tbody>${rowsHtml}</tbody></table>`
}

function rowHtml(e, kind, meId) {
  const rank = e.rank
  const isMe = meId && String(e.user_id) === String(meId)
  const rankClass = rank === 1 ? 'rank-top-1' : rank === 2 ? 'rank-top-2' : rank === 3 ? 'rank-top-3' : ''
  const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`
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
        borderColor: '#10243a',
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
          backgroundColor: 'rgba(5, 11, 22, 0.95)',
          borderColor: 'rgba(194, 221, 240, 0.28)',
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
          backgroundColor: 'rgba(5, 11, 22, 0.95)',
          borderColor: 'rgba(194, 221, 240, 0.28)',
          borderWidth: 1,
          padding: 10,
        },
      },
      scales: {
        x: {
          stacked: true,
          grid: { display: false },
          ticks: { color: '#9bb3c5', font: { size: 11 } },
        },
        y: {
          stacked: true,
          beginAtZero: true,
          grid: { color: 'rgba(194, 221, 240, 0.08)' },
          ticks: { color: '#9bb3c5', font: { size: 11 }, precision: 0 },
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
          backgroundColor: 'rgba(5, 11, 22, 0.95)',
          borderColor: 'rgba(194, 221, 240, 0.28)',
          borderWidth: 1,
          padding: 10,
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${formatTimelineValue(ctx.raw)} ${unit}`,
          },
        },
      },
      scales: {
        x: {
          grid: { color: 'rgba(194, 221, 240, 0.06)' },
          ticks: { color: '#9bb3c5', font: { size: 11 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 12 },
        },
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(194, 221, 240, 0.08)' },
          ticks: { color: '#9bb3c5', font: { size: 11 } },
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
          backgroundColor: isBar ? 'rgba(30, 204, 192, 0.5)' : 'rgba(30, 204, 192, 0.15)',
          borderColor: 'rgba(30, 204, 192, 0.9)',
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
          backgroundColor: 'rgba(5, 11, 22, 0.95)',
          borderColor: 'rgba(194, 221, 240, 0.28)',
          borderWidth: 1,
          padding: 10,
          callbacks: {
            label: (ctx) => `Gesamt: ${formatTimelineValue(ctx.raw)} ${unit}`,
          },
        },
      },
      scales: {
        x: {
          grid: { color: 'rgba(194, 221, 240, 0.06)' },
          ticks: { color: '#9bb3c5', font: { size: 11 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 12 },
        },
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(194, 221, 240, 0.08)' },
          ticks: { color: '#9bb3c5', font: { size: 11 } },
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

function renderStats(stats) {
  if (!stats) return
  const v = stats.voice || {}
  const t = stats.text || {}
  setStat('stat-voice-rank', v.rank ? `#${v.rank}` : '–', `${formatNum(v.lifetime_points || 0)} Pkt lifetime`)
  setStat('stat-text-rank', t.rank ? `#${t.rank}` : '–', `${formatNum(t.lifetime_points || 0)} Pkt lifetime`)
  setStat('stat-voice-30', formatHours(v.range_seconds ?? 0), `${formatNum(v.range_points || 0)} Punkte · ${v.range_sessions || 0} Sessions`)
  setStat('stat-text-30', formatNum(t.range_points || 0), `${formatNum(t.range_messages || 0)} Messages · ${t.range_sessions || 0} Sessions`)
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
  state.voiceChart = new Chart(ctx, lineChartConfig(labels, hours, 'Stunden', 'rgba(6,182,212,1)', 'rgba(6,182,212,0.15)'))
}

function renderTextChart(data) {
  const ctx = document.getElementById('chart-text')
  if (!ctx) return
  const daily = data?.daily || []
  const labels = daily.map((d) => formatDayShort(d.day))
  const values = daily.map((d) => d.total_points || 0)
  state.textChart?.destroy()
  state.textChart = new Chart(ctx, lineChartConfig(labels, values, 'Punkte', 'rgba(168,85,247,1)', 'rgba(168,85,247,0.15)'))
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
          backgroundColor: 'rgba(5, 11, 22, 0.95)',
          borderColor: 'rgba(194, 221, 240, 0.28)',
          borderWidth: 1,
          padding: 10,
          titleFont: { family: 'Sora' },
          bodyFont: { family: 'Manrope' },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: '#9bb3c5', font: { size: 11 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 },
        },
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(194, 221, 240, 0.08)' },
          ticks: { color: '#9bb3c5', font: { size: 11 }, precision: 0 },
        },
      },
    },
  }
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
  if (t <= 0) return 'rgba(6, 182, 212, 0.05)'
  // cyan → purple
  const r = Math.round(6 + (168 - 6) * t)
  const g = Math.round(182 + (85 - 182) * t)
  const b = Math.round(212 + (247 - 212) * t)
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

function rankColor(rank) {
  return RANK_COLORS[String(rank || '').toLowerCase()] || '#06b6d4'
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

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c])
}
