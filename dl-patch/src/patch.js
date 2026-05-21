// Gemeinsame Styles aus dl-landing importieren
import '@shared/site.css'
import './patch.css'

const API_URL = '/api/public/patch-notes'

let allPatches = []
let activeCategory = 'all'
let searchQuery = ''

// ─── Site-Setup (aus dl-landing/site.js übernommen) ─────────────────────────

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
    items.forEach((item) => item.classList.add('is-visible'))
    return
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible')
          observer.unobserve(entry.target)
        }
      })
    },
    { rootMargin: '0px 0px -10% 0px', threshold: 0.15 },
  )

  items.forEach((item) => observer.observe(item))
}

// ─── Initialisierung ──────────────────────────────────────────────────────────

document.documentElement.classList.add('js')
setActiveNav()
setupNavDrawer()
setupReveal()

document.addEventListener('DOMContentLoaded', () => {
  if (!document.getElementById('patch-list')) return
  setupFilters()
  loadPatches()
})

// ─── Daten laden ──────────────────────────────────────────────────────────────

async function loadPatches() {
  try {
    const res = await fetch(API_URL)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    allPatches = (data.patches || []).filter(p => {
      const year = new Date(p.posted_at).getFullYear()
      return year >= 2025
    })
    hideSkeleton()
    renderPatches(allPatches)
  } catch (err) {
    hideSkeleton()
    showError()
    console.error('[patch] Fehler beim Laden:', err)
  }
}

function hideSkeleton() {
  const el = document.getElementById('patch-skeleton')
  if (el) el.remove()
}

function showError() {
  const list = document.getElementById('patch-list')
  if (list) {
    list.innerHTML = '<p class="patch-load-error">Patchnotes konnten nicht geladen werden. Bitte später erneut versuchen.</p>'
  }
}

// ─── Filter & Suche ───────────────────────────────────────────────────────────

function setupFilters() {
  document.querySelectorAll('.patch-cat-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.patch-cat-btn').forEach(b => b.classList.remove('is-active'))
      btn.classList.add('is-active')
      activeCategory = btn.dataset.category
      applyFilters()
    })
  })

  const searchInput = document.getElementById('patch-search')
  if (searchInput) {
    let debounceTimer
    searchInput.addEventListener('input', () => {
      clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        searchQuery = searchInput.value.trim().toLowerCase()
        applyFilters()
      }, 200)
    })
  }
}

function applyFilters() {
  let filtered = allPatches

  if (activeCategory !== 'all') {
    filtered = filtered.filter(p => p.sections.includes(activeCategory))
  }

  if (searchQuery) {
    filtered = filtered.filter(p =>
      p.title.toLowerCase().includes(searchQuery) ||
      p.translated_content.toLowerCase().includes(searchQuery)
    )
  }

  renderPatches(filtered)
}

// ─── Render ───────────────────────────────────────────────────────────────────

function renderPatches(patches) {
  const list = document.getElementById('patch-list')
  const empty = document.getElementById('patch-empty')
  const counter = document.getElementById('patch-count')

  if (!list) return

  if (patches.length === 0) {
    list.innerHTML = ''
    if (empty) empty.hidden = false
    if (counter) counter.textContent = ''
    return
  }

  if (empty) empty.hidden = true
  if (counter) counter.textContent = `${patches.length} Patch${patches.length !== 1 ? 'es' : ''}`

  list.innerHTML = patches.map(patch => renderPatchCard(patch)).join('')

  list.querySelectorAll('.patch-card-header').forEach(header => {
    header.addEventListener('click', () => {
      const card = header.closest('.patch-card')
      const isOpen = card.classList.contains('is-open')
      card.classList.toggle('is-open', !isOpen)
      const toggle = header.querySelector('.patch-card-toggle')
      if (toggle) toggle.setAttribute('aria-expanded', String(!isOpen))
    })
  })
}

function renderPatchCard(patch) {
  const date = formatDate(patch.posted_at)
  const sectionBadges = patch.sections
    .map(s => `<span class="patch-badge patch-badge--${s}">${capitalize(s)}</span>`)
    .join('')
  const contentHtml = renderContent(patch.translated_content)

  return `
    <article class="patch-card" id="patch-${patch.id}">
      <div class="patch-card-header">
        <div class="patch-card-meta">
          <time class="patch-card-date" datetime="${patch.posted_at}">${date}</time>
          <div class="patch-card-badges">${sectionBadges}</div>
        </div>
        <h2 class="patch-card-title">${escapeHtml(patch.title || 'Patch Notes')}</h2>
        <button class="patch-card-toggle" aria-expanded="false" aria-label="Patch aufklappen">
          <svg class="patch-toggle-icon" width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
      <div class="patch-card-body">
        <div class="patch-card-content">${contentHtml}</div>
        ${patch.url ? `<a class="patch-card-source" href="${patch.url}" target="_blank" rel="noopener">Originalpatch ansehen ↗</a>` : ''}
      </div>
    </article>
  `
}

function renderContent(text) {
  if (!text) return '<p>Kein Inhalt verfügbar.</p>'

  const lines = text.split('\n')
  const result = []
  let inList = false

  for (const raw of lines) {
    const line = raw.trimEnd()

    if (!line) {
      if (inList) { result.push('</ul>'); inList = false }
      continue
    }

    if (line.startsWith('### ')) {
      if (inList) { result.push('</ul>'); inList = false }
      result.push(`<h3 class="patch-h3">${escapeHtml(line.slice(4))}</h3>`)
      continue
    }

    if (line.startsWith('## ')) {
      if (inList) { result.push('</ul>'); inList = false }
      const label = line.slice(3).trim()
      const slug = label.toLowerCase().replace(/\s+/g, '-')
      result.push(`<h2 class="patch-h2 patch-section--${slug}">${escapeHtml(label)}</h2>`)
      continue
    }

    if (/^\*\*[^*]+\*\*$/.test(line.trim())) {
      if (inList) { result.push('</ul>'); inList = false }
      result.push(`<p class="patch-subheading">${escapeHtml(line.trim().slice(2, -2))}</p>`)
      continue
    }

    if (line.startsWith('- ') || line.startsWith('  - ')) {
      const indent = line.startsWith('  - ')
      const content = processInline(line.replace(/^  - |^- /, ''))
      if (!inList) { result.push('<ul class="patch-list">'); inList = true }
      result.push(`<li class="${indent ? 'patch-li-indent' : ''}">${content}</li>`)
      continue
    }

    if (inList) { result.push('</ul>'); inList = false }
    result.push(`<p>${processInline(line)}</p>`)
  }

  if (inList) result.push('</ul>')
  return result.join('\n')
}

function processInline(text) {
  return escapeHtml(text)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
}

// ─── Hilfsfunktionen ──────────────────────────────────────────────────────────

function formatDate(raw) {
  if (!raw) return 'Datum unbekannt'
  let date
  if (/^\d+$/.test(String(raw).trim())) {
    date = new Date(parseInt(raw, 10) * 1000)
  } else {
    date = new Date(raw)
  }
  if (isNaN(date.getTime())) return String(raw)
  return date.toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1)
}
