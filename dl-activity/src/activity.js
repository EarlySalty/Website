import './main.css'
import { Chart, LineController, LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip, Legend } from 'chart.js'

Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip, Legend)

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://127.0.0.1:8768'
const AUTH_BASE = import.meta.env.VITE_AUTH_BASE ?? API_BASE
const REDIRECT_AFTER_LOGIN = '/aktivitaet/'

const state = {
  tab: 'voice',
  me: null,
  voiceBoard: null,
  textBoard: null,
  voiceChart: null,
  textChart: null,
}

document.getElementById('year').textContent = new Date().getFullYear()

init()

async function init() {
  bindTabs()
  bindAuthButtons()
  loadLeaderboard('voice')
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
  document.querySelectorAll('.tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      const next = btn.dataset.tab
      if (next === state.tab) return
      state.tab = next
      document.querySelectorAll('.tab').forEach((b) => {
        const active = b.dataset.tab === next
        b.classList.toggle('is-active', active)
        b.setAttribute('aria-selected', active ? 'true' : 'false')
      })
      loadLeaderboard(next)
    })
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
  const url = new URL(`${AUTH_BASE}/auth/discord/login`)
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

function renderBoard(kind, entries) {
  const body = document.getElementById('leaderboard-body')
  if (!entries.length) {
    body.innerHTML = '<div class="state">Noch keine Einträge — sei der Erste auf der Liste.</div>'
    return
  }
  const meId = state.me?.user_id
  const meInList = meId && entries.some((e) => String(e.user_id) === String(meId))

  const headerHtml = kind === 'voice'
    ? `<thead><tr>
        <th>#</th><th>Spieler</th>
        <th class="num hide-mobile">Zeit</th>
        <th class="num">Punkte</th>
      </tr></thead>`
    : `<thead><tr>
        <th>#</th><th>Spieler</th>
        <th class="num hide-mobile">Messages</th>
        <th class="num">Punkte</th>
      </tr></thead>`

  const rowsHtml = entries.map((e) => rowHtml(e, kind, meId)).join('')

  body.innerHTML = `<table class="lb-table">${headerHtml}<tbody>${rowsHtml}</tbody></table>`

  if (meId && !meInList && state.me) {
    appendMeStickyRow(kind)
  }
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
    fetchJson(`${API_BASE}/api/public/me/voice-history?range=30&mode=day`),
    fetchJson(`${API_BASE}/api/public/me/text-history?range=30&mode=day`),
    fetchJson(`${API_BASE}/api/public/me/heatmap`),
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

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c])
}
