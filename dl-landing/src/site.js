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

      if (!rawValue || rawValue === '—' || Number.isNaN(target)) return

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

async function fetchLiveStats() {
  const statElements = {
    members: document.querySelector('[data-stat="members"]'),
    online: document.querySelector('[data-stat="online"]'),
    voice: document.querySelector('[data-stat="voice"]'),
  }

  if (!statElements.members) return

  try {
    const res = await fetch('/api/public/guild-stats')
    if (res.ok) {
      const data = await res.json()

      if (typeof data.member_count === 'number' && statElements.members) {
        statElements.members.textContent = data.member_count.toLocaleString('de-DE')
      }
      if (typeof data.online_count === 'number' && statElements.online) {
        statElements.online.textContent = data.online_count.toLocaleString('de-DE')
      }
      if (typeof data.voice_count === 'number' && statElements.voice) {
        statElements.voice.textContent = data.voice_count.toLocaleString('de-DE')
      }
    }
  } catch {
    // Silently fail — stats will show "—" as fallback
  }

  setupCountUp()
}

function boot() {
  document.documentElement.classList.add('js')
  setActiveNav()
  setupMobileMenu()
  setupReveal()
  setupCardTilt()
  setupParallax()
  syncYear()
  fetchLiveStats()
}

boot()

export { ACTIVE_PATHS }
