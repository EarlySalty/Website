import './site.css'

const ACTIVE_PATHS = {
  home: '/',
  community: '/community/',
  features: '/features/',
  coaching: '/coaching/',
  streamer: '/streamer/',
  guides: '/guides/',
  join: '/beitreten/',
}

function normalizePath(pathname) {
  if (!pathname) return '/'
  const clean = pathname.endsWith('/') ? pathname : `${pathname}/`
  return clean.replace(/\/+/g, '/')
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

function setupMobileMenu() {
  const toggle = document.querySelector('[data-menu-toggle]')
  const panel = document.querySelector('[data-mobile-menu]')
  if (!toggle || !panel) return

  const iconMenu = toggle.querySelector('.icon-menu')
  const iconClose = toggle.querySelector('.icon-close')

  function setMenuState(open) {
    toggle.setAttribute('aria-expanded', String(open))
    toggle.setAttribute('aria-label', open ? 'Menü schließen' : 'Menü öffnen')
    if (open) {
      panel.removeAttribute('hidden')
    } else {
      panel.setAttribute('hidden', '')
    }
    document.body.classList.toggle('menu-open', open)
    if (iconMenu && iconClose) {
      iconMenu.style.display = open ? 'none' : ''
      iconClose.style.display = open ? '' : 'none'
    }
  }

  toggle.addEventListener('click', () => {
    const expanded = toggle.getAttribute('aria-expanded') === 'true'
    setMenuState(!expanded)
  })

  panel.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => setMenuState(false))
  })
}

function setupReveal() {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const items = document.querySelectorAll('[data-reveal]')

  if (prefersReducedMotion || !('IntersectionObserver' in window)) {
    items.forEach((item) => {
      item.classList.add('is-visible')
      item.querySelectorAll('.card, .proof-item, .timeline-step, .faq-item, .feature-pill').forEach((child) => {
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
          const children = entry.target.querySelectorAll('.card, .proof-item, .timeline-step, .faq-item, .feature-pill')
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

function syncYear() {
  document.querySelectorAll('[data-current-year]').forEach((node) => {
    node.textContent = String(new Date().getFullYear())
  })
}

async function fetchLiveStats() {
  const statElements = {
    members: document.querySelector('[data-stat="members"]'),
    online: document.querySelector('[data-stat="online"]'),
    voice: document.querySelector('[data-stat="voice"]'),
  }

  if (!statElements.members) return

  try {
    const res = await fetch('/api/public/guild-stats')
    if (!res.ok) return
    const data = await res.json()

    if (data.member_count && statElements.members) {
      statElements.members.textContent = data.member_count.toLocaleString('de-DE')
    }
    if (data.online_count !== undefined && statElements.online) {
      statElements.online.textContent = data.online_count.toLocaleString('de-DE')
    }
    if (data.voice_count !== undefined && statElements.voice) {
      statElements.voice.textContent = data.voice_count.toLocaleString('de-DE')
    }
  } catch {
    // Silently fail — stats will show "—" as fallback
  }
}

function boot() {
  document.documentElement.classList.add('js')
  setActiveNav()
  setupMobileMenu()
  setupReveal()
  syncYear()
  fetchLiveStats()
}

boot()

export { ACTIVE_PATHS }
