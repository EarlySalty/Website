(() => {
  if (document.querySelector('[data-brand-nav-root]')) return

  const links = [
    { label: 'Empfang', href: '/', floor: 'E' },
    { label: 'Mitspieler', href: '/mitspieler/', floor: 'M' },
    { label: 'Coaching', href: '/coaching/', floor: 'C' },
    { label: 'Aktivität & Ränge', href: '/aktivitaet/', floor: 'A' },
    { label: 'Patchnotes', href: '/patch/', floor: 'P' },
    { label: 'Helden', href: '/helden/', floor: 'H' },
    { label: 'Streamer', href: '/streamer/', floor: 'S' },
    { label: 'Beitreten', href: '/beitreten/', floor: 'B' },
  ]

  const script = document.currentScript
  const footerEnabled = script ? script.dataset.footer !== 'false' && script.dataset.brandFooter !== 'false' : false
  const nav = document.createElement('nav')
  const panelId = 'brand-elevator-panel'
  const currentPath = normalizePath(window.location.pathname)

  nav.className = 'brand-elevator-nav'
  nav.dataset.brandNavRoot = ''
  nav.innerHTML = `
    <button class="brand-elevator-call" type="button" aria-expanded="false" aria-controls="${panelId}" aria-label="Navigation öffnen">
      <span class="brand-call-arrow" aria-hidden="true">▲</span>
      <span class="brand-call-jewel" aria-hidden="true"></span>
      <span class="brand-call-arrow" aria-hidden="true">▼</span>
    </button>
    <div class="brand-elevator-panel" id="${panelId}">
      <span class="brand-panel-screw brand-screw-tl" aria-hidden="true"></span>
      <span class="brand-panel-screw brand-screw-tr" aria-hidden="true"></span>
      <span class="brand-panel-screw brand-screw-bl" aria-hidden="true"></span>
      <span class="brand-panel-screw brand-screw-br" aria-hidden="true"></span>
      <div class="brand-floor-indicator" aria-hidden="true">
        <span class="brand-indicator-arrow">▲</span>
        <b>${activeFloor(links, currentPath)}</b>
      </div>
      <div class="brand-floor-links">
        ${links.map((link) => floorLink(link, currentPath)).join('')}
      </div>
    </div>
  `

  const button = nav.querySelector('.brand-elevator-call')
  const panel = nav.querySelector('.brand-elevator-panel')
  const panelLinks = [...nav.querySelectorAll('.brand-floor-link')]
  const supportsInert = 'inert' in panel

  setPanelAccessibility(false)

  button.addEventListener('click', () => {
    setOpen(!nav.classList.contains('is-open'))
  })

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setOpen(false)
  })

  document.addEventListener('pointerdown', (event) => {
    if (!nav.classList.contains('is-open')) return
    if (!nav.contains(event.target)) setOpen(false)
  })

  nav.addEventListener('click', (event) => {
    const link = event.target.closest('.brand-floor-link')
    if (!link) return

    if (link.getAttribute('aria-current') === 'page') {
      event.preventDefault()
      setOpen(false)
      return
    }

    const target = link.getAttribute('target')
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || target === '_blank') return

    event.preventDefault()
    setOpen(false)
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      window.location.href = link.href
      return
    }

    startRide(link)
  })

  document.body.appendChild(nav)

  if (footerEnabled && !document.querySelector('footer') && !document.querySelector('.brand-footer')) {
    document.body.appendChild(createFooter(links, currentPath))
  }

  function setOpen(open) {
    nav.classList.toggle('is-open', open)
    button.setAttribute('aria-expanded', open ? 'true' : 'false')
    button.setAttribute('aria-label', open ? 'Navigation schließen' : 'Navigation öffnen')
    setPanelAccessibility(open)
  }

  function setPanelAccessibility(open) {
    if (open) {
      panel.removeAttribute('aria-hidden')
      panel.removeAttribute('inert')
      if (supportsInert) panel.inert = false
      if (!supportsInert) setPanelLinksTabbable(true)
      return
    }

    panel.setAttribute('aria-hidden', 'true')
    panel.setAttribute('inert', '')
    if (supportsInert) panel.inert = true
    if (!supportsInert) setPanelLinksTabbable(false)
  }

  function setPanelLinksTabbable(tabbable) {
    panelLinks.forEach((link) => {
      if (tabbable) {
        link.removeAttribute('tabindex')
        return
      }

      link.setAttribute('tabindex', '-1')
    })
  }

  function startRide(link) {
    const ride = document.createElement('div')
    ride.className = 'brand-elevator-ride'
    ride.setAttribute('role', 'status')
    ride.innerHTML = `
      <div class="brand-ride-indicator">
        <span aria-hidden="true">▲</span>
        <b>${link.querySelector('span').textContent}</b>
        <small>${link.querySelector('em').textContent}</small>
      </div>
      <div class="brand-ride-door brand-ride-door-left" aria-hidden="true"></div>
      <div class="brand-ride-door brand-ride-door-right" aria-hidden="true"></div>
    `
    document.body.appendChild(ride)
    requestAnimationFrame(() => ride.classList.add('is-closing'))
    window.setTimeout(() => { window.location.href = link.href }, 650)
  }

function floorLink(link, currentPath) {
  const active = isActive(link.href, currentPath)
  return `
    <a class="brand-floor-link" href="${link.href}"${active ? ' aria-current="page"' : ''}>
      <span>${link.floor}</span>
      <i aria-hidden="true"></i>
      <em>${link.label}</em>
    </a>
  `
}

function createFooter(links, currentPath) {
  const footer = document.createElement('footer')
  footer.className = 'brand-footer'
  footer.innerHTML = links
    .map((link) => `<a href="${link.href}"${isActive(link.href, currentPath) ? ' aria-current="page"' : ''}>${link.label}</a>`)
    .join('<span aria-hidden="true">·</span>')
  return footer
}

function activeFloor(links, currentPath) {
  return links.find((link) => isActive(link.href, currentPath))?.floor ?? 'E'
}

function isActive(href, currentPath) {
  const target = normalizePath(href)
  if (target === '/') return currentPath === '/'
  return currentPath === target || currentPath.startsWith(target)
}

function normalizePath(path) {
  const clean = `/${String(path || '').replace(/^\/+/, '')}`.replace(/\/{2,}/g, '/')
  if (clean === '/') return clean
  return clean.endsWith('/') ? clean : `${clean}/`
}
})()
