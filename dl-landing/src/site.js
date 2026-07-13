import './site.css'

const ACTIVE_PATHS = {
  home: '/',
  mitspieler: '/mitspieler/',
  coaching: '/coaching/',
  streamer: '/streamer/',
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
    const isOpen = drawer.classList.contains('is-open')
    setDrawerState(!isOpen)
  })

  drawer.querySelectorAll('[data-menu-close]').forEach((el) => {
    el.addEventListener('click', () => setDrawerState(false))
  })

  drawer.querySelectorAll('.nav-drawer-link, .nav-drawer-cta').forEach((link) => {
    link.addEventListener('click', () => setDrawerState(false))
  })

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && drawer.classList.contains('is-open')) {
      setDrawerState(false)
    }
  })
}

function setupReveal() {
  const reduceMotion = prefersReducedMotion()
  const items = document.querySelectorAll('[data-reveal]')

  if (reduceMotion || !('IntersectionObserver' in window)) {
    items.forEach((item) => {
      item.classList.add('is-visible')
      item.querySelectorAll('.card, .pillar, .usp-card, .proof-item, .timeline-step, .faq-item, .feature-pill, .step-card').forEach((child) => {
        child.style.opacity = '1'
        child.style.transform = 'translateY(0)'
      })
    })
    return
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const children = entry.target.querySelectorAll('.card, .pillar, .usp-card, .proof-item, .timeline-step, .faq-item, .feature-pill, .step-card')
          if (children.length > 0) {
            children.forEach((child, i) => {
              child.style.transitionDelay = `${i * 80}ms`
            })
          }
          entry.target.classList.add('is-visible')
          observer.unobserve(entry.target)
        }
      })
    },
    { rootMargin: '0px 0px -10% 0px', threshold: 0.15 },
  )

  items.forEach((item) => observer.observe(item))
}

function setupCardTilt() {
  const canHover = window.matchMedia('(hover: hover)').matches
  if (!canHover || prefersReducedMotion()) return

  document.querySelectorAll('.card, .pillar').forEach((card) => {
    let frameId = 0
    let nextTransform = ''

    const applyTransform = () => {
      frameId = 0
      card.style.transform = nextTransform
    }

    card.addEventListener('mousemove', (event) => {
      const rect = card.getBoundingClientRect()
      const x = (event.clientX - rect.left) / rect.width
      const y = (event.clientY - rect.top) / rect.height
      const rotateY = (x - 0.5) * 8
      const rotateX = -(y - 0.5) * 8

      const isFeatured = card.classList.contains('card--featured')
      const scaleStr = isFeatured ? ' scale(1.03)' : ''
      nextTransform = `perspective(800px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) translateY(-4px)${scaleStr}`

      if (!frameId) {
        frameId = requestAnimationFrame(applyTransform)
      }
    })

    card.addEventListener('mouseleave', () => {
      if (frameId) {
        cancelAnimationFrame(frameId)
        frameId = 0
      }

      nextTransform = ''
      card.style.transform = ''
    })
  })
}

function setupCountUp() {
  const proofGrid = document.querySelector('.hero-stats') || document.querySelector('.proof-grid')
  if (!proofGrid || prefersReducedMotion()) return

  const statNodes = Array.from(proofGrid.querySelectorAll('[data-stat]'))
  if (statNodes.length === 0) return

  const animateStats = () => {
    statNodes.forEach((node) => {
      const rawValue = node.textContent?.trim() ?? ''
      const target = Number.parseInt(rawValue.replace(/\./g, ''), 10)

      // Pure Zahlen (mit deutschen Tausendertrennern) animieren — alles andere skippen.
      if (!rawValue || rawValue === '—' || Number.isNaN(target)) return
      if (!/^\d{1,3}(\.\d{3})*$/.test(rawValue)) return

      const startTime = performance.now()
      const duration = 1500

      const tick = (now) => {
        const progress = Math.min((now - startTime) / duration, 1)
        const eased = 1 - Math.pow(1 - progress, 3)
        const value = Math.round(target * eased)

        node.textContent = value.toLocaleString('de-DE')

        if (progress < 1) {
          requestAnimationFrame(tick)
        }
      }

      node.textContent = '0'
      requestAnimationFrame(tick)
    })
  }

  if (!('IntersectionObserver' in window)) {
    animateStats()
    return
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return

        animateStats()
        observer.unobserve(entry.target)
      })
    },
    { threshold: 0.25 },
  )

  observer.observe(proofGrid)
}

function splitHeroHeadline() {
  const headline = document.querySelector('.hero-content h1')
  if (!headline) return

  // Bereits gesplittet? (Hot-Reload-Schutz)
  if (headline.dataset.split === '1') return
  headline.dataset.split = '1'

  // Walk: Text-Knoten in <span class="word">…</span> aufteilen, Inline-Elemente
  // (z.B. <span class="hero-highlight">) bleiben erhalten und werden als
  // ein Word behandelt. <br>-Tags bleiben unverändert.
  const words = []
  const fragment = document.createDocumentFragment()

  Array.from(headline.childNodes).forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const tokens = node.textContent.split(/(\s+)/)
      tokens.forEach((tok) => {
        if (!tok) return
        if (/^\s+$/.test(tok)) {
          fragment.appendChild(document.createTextNode(tok))
        } else {
          const span = document.createElement('span')
          span.className = 'word'
          span.textContent = tok
          words.push(span)
          fragment.appendChild(span)
        }
      })
    } else if (node.nodeName === 'BR') {
      fragment.appendChild(node.cloneNode())
    } else {
      // Inline-Element wie <span class="hero-highlight"> — als ein Word umhüllen
      const wrapper = document.createElement('span')
      wrapper.className = 'word'
      wrapper.appendChild(node.cloneNode(true))
      words.push(wrapper)
      fragment.appendChild(wrapper)
    }
  })

  headline.replaceChildren(fragment)

  if (prefersReducedMotion()) {
    words.forEach((w) => w.classList.add('is-in'))
    return
  }

  // Stagger-Reveal beim Page-Load
  requestAnimationFrame(() => {
    words.forEach((w, i) => {
      setTimeout(() => w.classList.add('is-in'), 80 + i * 90)
    })
  })
}

function setupMagneticCTA() {
  if (prefersReducedMotion()) return
  if (!window.matchMedia('(hover: hover)').matches) return

  const cta = document.querySelector('.hero-actions .button-primary')
  if (!cta) return

  const RANGE = 70 // px Aktivierungsradius um den Button
  const STRENGTH = 0.18
  let frameId = 0
  let nextX = 0
  let nextY = 0

  const apply = () => {
    frameId = 0
    cta.style.transform = `translate(${nextX.toFixed(2)}px, ${nextY.toFixed(2)}px)`
  }

  const onMove = (event) => {
    const rect = cta.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const dx = event.clientX - cx
    const dy = event.clientY - cy
    const dist = Math.hypot(dx, dy)
    const max = Math.max(rect.width, rect.height) / 2 + RANGE

    if (dist > max) {
      nextX = 0
      nextY = 0
    } else {
      nextX = dx * STRENGTH
      nextY = dy * STRENGTH
    }

    if (!frameId) frameId = requestAnimationFrame(apply)
  }

  const onLeave = () => {
    nextX = 0
    nextY = 0
    if (!frameId) frameId = requestAnimationFrame(apply)
  }

  cta.style.transition = 'transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)'
  document.addEventListener('mousemove', onMove, { passive: true })
  cta.addEventListener('mouseleave', onLeave)
}

function setupParallax() {
  const showcase = document.querySelector('.hero-bg')
  const canHover = window.matchMedia('(hover: hover)').matches

  if (!showcase || !canHover || prefersReducedMotion()) return

  let ticking = false

  const updateParallax = () => {
    ticking = false

    if (window.scrollY <= 0) {
      showcase.style.transform = ''
      return
    }

    if (window.scrollY < 800) {
      showcase.style.transform = `translateY(${window.scrollY * 0.15}px)`
    } else {
      showcase.style.transform = 'translateY(120px)'
    }
  }

  window.addEventListener(
    'scroll',
    () => {
      if (ticking) return

      ticking = true
      requestAnimationFrame(updateParallax)
    },
    { passive: true },
  )
}

function syncYear() {
  document.querySelectorAll('[data-current-year]').forEach((node) => {
    node.textContent = String(new Date().getFullYear())
  })
}

const DISCORD_INVITE_CODE = 'z5TfVHuQq2'
const DISCORD_GUILD_ID = '1289721245281292288'
const DISCORD_INVITE_API = `https://discord.com/api/v10/invites/${DISCORD_INVITE_CODE}?with_counts=true&with_expiration=false`
const DISCORD_WIDGET_API = `https://discord.com/api/guilds/${DISCORD_GUILD_ID}/widget.json`

// Discord-Channel-Names enthalten Emoji + Sortier-Präfixe.
// Diese Channels NICHT in der Live-Lane-Liste anzeigen (nur "echte" Mitspieler-Lanes).
const HIDDEN_LANE_PATTERNS = [/^afk$/i, /sammelpunkt/i, /coaching\s*lane/i]

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c])
}

async function fetchLiveStats() {
  const memberNodes = document.querySelectorAll('[data-stat="members"]')
  const onlineNodes = document.querySelectorAll('[data-stat="online"]')
  const voiceNodes = document.querySelectorAll('[data-stat="voice"]')

  if (memberNodes.length === 0 && onlineNodes.length === 0) return

  try {
    const res = await fetch(DISCORD_INVITE_API, { credentials: 'omit' })
    if (res.ok) {
      const data = await res.json()
      const members = Number(data?.approximate_member_count)
      const presence = Number(data?.approximate_presence_count)

      if (Number.isFinite(members)) {
        const txt = members.toLocaleString('de-DE')
        memberNodes.forEach((n) => (n.textContent = txt))
      }
      if (Number.isFinite(presence)) {
        const txt = presence.toLocaleString('de-DE')
        onlineNodes.forEach((n) => (n.textContent = txt))
      }
      // Voice-Lane-Count ist über public Discord API nicht verfügbar; Fallback "24/7"
      voiceNodes.forEach((n) => {
        if (n.textContent.trim() === '—') n.textContent = '24/7'
      })
    }
  } catch {
    // Stats bleiben auf "—" als Fallback
  }

  setupCountUp()
}

async function fetchDiscordWidget() {
  const root = document.querySelector('[data-live-root]')
  const tower = document.querySelector('[data-tower]')
  if (!root && !tower) return

  const lanesList = root?.querySelector('[data-lanes-list]')
  const lanesCount = root?.querySelector('[data-lanes-count]')
  const presenceGrid = root?.querySelector('[data-presence-grid]')

  let data
  try {
    const res = await fetch(DISCORD_WIDGET_API, { credentials: 'omit' })
    if (!res.ok) throw new Error(`status ${res.status}`)
    data = await res.json()
  } catch {
    if (lanesList) {
      lanesList.innerHTML = '<li class="lane-empty">Live-Daten gerade nicht erreichbar — schau direkt im Discord.</li>'
    }
    if (lanesCount) lanesCount.textContent = ''
    if (presenceGrid) presenceGrid.innerHTML = ''
    // Der Turm bleibt ohne Live-Daten einfach dunkel — kein Fehlerzustand nötig.
    return
  }

  // Die Widget-API liefert KEIN members_count am Channel; die Belegung steckt
  // in members[].channel_id (gesetzt, wenn jemand im Voice sitzt).
  const voiceCountByChannel = new Map()
  for (const m of data.members || []) {
    if (!m.channel_id) continue
    voiceCountByChannel.set(m.channel_id, (voiceCountByChannel.get(m.channel_id) || 0) + 1)
  }

  const allChannels = (data.channels || []).map((c) => ({
    id: c.id,
    rawName: c.name || '',
    name: (c.name || 'Voice').replace(/^[^\p{L}\d]+/u, '').trim() || c.name,
    count: voiceCountByChannel.get(c.id) || 0,
  }))

  if (tower) updateTowerLive(allChannels)

  // ── Voice-Lanes ─────────────────────────────────────────────────────────
  if (lanesList) {
    const channels = allChannels
      .filter((c) => !HIDDEN_LANE_PATTERNS.some((re) => re.test(c.rawName)))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'de'))

    if (channels.length === 0) {
      lanesList.innerHTML = '<li class="lane-empty">Aktuell keine Voice-Lane offen.</li>'
    } else {
      const top = channels.slice(0, 5)
      lanesList.innerHTML = top
        .map((c) => `
          <li class="lane">
            <span class="lane-name">${escapeHtml(c.name)}</span>
            <span class="lane-count${c.count > 0 ? ' is-active' : ''}">${c.count > 0 ? `${c.count} drin` : 'leer'}</span>
          </li>
        `)
        .join('')
    }
    if (lanesCount) {
      const active = channels.filter((c) => c.count > 0).length
      lanesCount.textContent = `${active} aktiv`
    }
  }

  // ── Online-Avatare ──────────────────────────────────────────────────────
  if (presenceGrid) {
    const members = (data.members || []).filter((m) => m.avatar_url)
    if (members.length === 0) {
      presenceGrid.innerHTML = ''
    } else {
      const SHOW = 16
      const visible = members.slice(0, SHOW)
      const overflow = Math.max(0, (Number(data.presence_count) || members.length) - visible.length)
      const avatars = visible
        .map(
          (m) => `<img src="${escapeHtml(m.avatar_url)}" alt="" loading="lazy" referrerpolicy="no-referrer" />`,
        )
        .join('')
      const overflowChip = overflow > 0
        ? `<span class="presence-overflow">+${overflow}</span>`
        : ''
      presenceGrid.innerHTML = avatars + overflowChip
      presenceGrid.removeAttribute('aria-hidden')
    }
  }
}

// ── Server-Gebäude (/mitspieler/) ──────────────────────────────────────────
// Voice-Channel → Etage; erster Treffer gewinnt, alles Unbekannte ist eine
// normale Voice-Lane (2F). floor:null = auf der Seite nicht gezeigt.
const TOWER_FLOOR_RULES = [
  { floor: null, re: /^afk$|mod\s*voice|vip/i },
  { floor: 'dach', re: /streamer/i },
  { floor: '3f', re: /coaching/i },
  { floor: '4f', re: /^team[\s-]?\d|caster|sammelpunkt|scrim|custom/i },
]

function floorForVoiceChannel(name) {
  for (const rule of TOWER_FLOOR_RULES) {
    if (rule.re.test(String(name || ''))) return rule.floor
  }
  return '2f'
}

// Je mehr Leute auf einer Etage, desto mehr Fenster leuchten (CSS wertet data-lit aus).
function towerLitBucket(count) {
  if (count >= 10) return '3'
  if (count >= 4) return '2'
  if (count >= 1) return '1'
  return '0'
}

function setupTower() {
  const tower = document.querySelector('[data-tower]')
  if (!tower) return

  const buttons = Array.from(tower.querySelectorAll('[data-floor-btn]'))
  const details = Array.from(tower.querySelectorAll('[data-floor-detail]'))
  const svgFloors = Array.from(tower.querySelectorAll('.tw-floor'))

  function select(floor) {
    buttons.forEach((b) => {
      const active = b.dataset.floorBtn === floor
      b.classList.toggle('is-active', active)
      b.setAttribute('aria-selected', String(active))
    })
    details.forEach((d) => {
      d.hidden = d.dataset.floorDetail !== floor
    })
    svgFloors.forEach((g) => g.classList.toggle('is-selected', g.dataset.floor === floor))
  }

  buttons.forEach((b) => b.addEventListener('click', () => select(b.dataset.floorBtn)))
  svgFloors.forEach((g) => g.addEventListener('click', () => select(g.dataset.floor)))
  select('2f')
}

function updateTowerLive(channels) {
  const tower = document.querySelector('[data-tower]')
  if (!tower) return

  const counts = { eg: 0, '1f': 0, '2f': 0, '3f': 0, '4f': 0, dach: 0 }
  channels.forEach((c) => {
    const floor = floorForVoiceChannel(c.rawName ?? c.name)
    if (floor && floor in counts) counts[floor] += c.count
  })

  // Funk-Wellen an der Antenne, wenn im Streamer-Studio gesendet wird
  tower.classList.toggle('dach-live', counts.dach > 0)

  Object.entries(counts).forEach(([floor, count]) => {
    const g = tower.querySelector(`.tw-floor[data-floor="${floor}"]`)
    if (g) {
      g.setAttribute('data-lit', towerLitBucket(count))
      g.classList.toggle('is-lit', count > 0)
    }

    const badge = tower.querySelector(`[data-floor-live="${floor}"]`)
    if (badge) {
      badge.hidden = count === 0
      badge.textContent = `${count} drin`
    }

    const detailLive = tower.querySelector(`[data-floor-count="${floor}"]`)
    if (detailLive) {
      detailLive.hidden = count === 0
      const text = detailLive.querySelector('[data-floor-count-text]')
      if (text) {
        text.textContent = count === 1
          ? 'Eine Person ist gerade hier im Voice'
          : `${count} Leute sind gerade hier im Voice`
      }
    }
  })
}

function boot() {
  document.documentElement.classList.add('js')
  setActiveNav()
  setupNavDrawer()
  splitHeroHeadline()
  setupMagneticCTA()
  setupReveal()
  setupCardTilt()
  setupParallax()
  syncYear()
  setupTower()
  fetchLiveStats()
  fetchDiscordWidget()
}

boot()

export { ACTIVE_PATHS }
