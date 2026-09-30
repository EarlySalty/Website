(() => {
  if (document.querySelector('[data-brand-nav-root]')) return

  const links = [
    { label: 'Empfang', href: '/', floor: 'E' },
    { label: 'Mitspieler', href: '/mitspieler/', floor: 'M' },
    { label: 'Coaching', href: '/coaching/', floor: 'C' },
    { label: 'Aktivität & Ränge', href: '/aktivitaet/', floor: 'A' },
    { label: 'Patchnotes', href: '/patchnotes/', floor: 'P' },
    { label: 'DevFeed', href: '/devfeed/', floor: 'V' },
    { label: 'Tierlist', href: '/builds/', floor: 'T' },
    { label: 'Helden', href: '/helden/', floor: 'H' },
    { label: 'Streamer', href: '/streamer/', floor: 'S' },
    { label: 'Partner-Dashboard', href: '/twitch/dashboard', floor: 'D' },
    { label: 'Beitreten', href: '/beitreten/', floor: 'B' },
    { label: 'Blog', href: '/blog/', floor: 'L' },
    { label: 'Wohin', href: '/wohin/', floor: 'W' },
    { label: 'Transparenz', href: '/transparenz/', floor: '0' },
  ]

  const script = document.currentScript
  const footerEnabled = script ? script.dataset.footer !== 'false' && script.dataset.brandFooter !== 'false' : false
  const nav = document.createElement('nav')
  const panelId = 'brand-elevator-panel'
  const currentPath = normalizePath(window.location.pathname)
  const currentFloor = activeFloor(links, currentPath)
  let soundEnabled = script?.dataset.sound === 'true'
  let audioContext = null
  let selectionTimer = null

  nav.className = 'brand-elevator-nav'
  nav.dataset.brandNavRoot = ''
  nav.setAttribute('aria-label', 'Hauptnavigation')
  nav.innerHTML = `
    <button class="brand-elevator-call" type="button" aria-expanded="false" aria-controls="${panelId}" aria-label="Navigation öffnen">
      <span class="brand-call-arrow" aria-hidden="true">▲</span>
      <span class="brand-call-jewel" aria-hidden="true"></span>
      <span class="brand-call-label" aria-hidden="true">MENÜ</span>
      <span class="brand-call-arrow" aria-hidden="true">▼</span>
    </button>
    <div class="brand-elevator-panel" id="${panelId}">
      <span class="brand-panel-screw brand-screw-tl" aria-hidden="true"></span>
      <span class="brand-panel-screw brand-screw-tr" aria-hidden="true"></span>
      <span class="brand-panel-screw brand-screw-bl" aria-hidden="true"></span>
      <span class="brand-panel-screw brand-screw-br" aria-hidden="true"></span>

      <div class="brand-panel-header">
        <span class="brand-panel-emblem" aria-hidden="true"><i>✦</i></span>
        <div class="brand-floor-indicator" role="status" aria-live="polite" aria-label="Aktuelle Etage ${currentFloor}">
          <span class="brand-indicator-arrow" aria-hidden="true">▲</span>
          <b><span class="brand-floor-glyph">${currentFloor}</span></b>
          <span class="brand-indicator-arrow brand-indicator-arrow-down" aria-hidden="true">▼</span>
        </div>
        <span class="brand-panel-emblem" aria-hidden="true"><i>✦</i></span>
      </div>

      <div class="brand-panel-controls">
        <button class="brand-panel-toggle brand-sound-toggle" type="button" aria-pressed="${soundEnabled ? 'true' : 'false'}" aria-label="Fahrstuhlton ${soundEnabled ? 'ausschalten' : 'einschalten'}">
          <span aria-hidden="true">♪</span>
          <b>Ton ${soundEnabled ? 'an' : 'aus'}</b>
        </button>
        <button class="brand-panel-toggle brand-compact-toggle" type="button" aria-pressed="false" aria-label="Kompakte Navigation einschalten">
          <span aria-hidden="true">▥</span>
          <b>Kompakt</b>
        </button>
      </div>

      <div class="brand-floor-links">
        ${links.map((link) => floorLink(link, currentPath)).join('')}
      </div>
    </div>
  `

  const button = nav.querySelector('.brand-elevator-call')
  const panel = nav.querySelector('.brand-elevator-panel')
  const indicator = nav.querySelector('.brand-floor-indicator')
  const indicatorGlyph = nav.querySelector('.brand-floor-glyph')
  const soundToggle = nav.querySelector('.brand-sound-toggle')
  const compactToggle = nav.querySelector('.brand-compact-toggle')
  const panelLinks = [...nav.querySelectorAll('.brand-floor-link')]
  const supportsInert = 'inert' in panel

  setPanelAccessibility(false)

  button.addEventListener('click', () => {
    setOpen(!nav.classList.contains('is-open'), { focusPanel: true })
  })

  soundToggle.addEventListener('click', () => {
    soundEnabled = !soundEnabled
    soundToggle.setAttribute('aria-pressed', soundEnabled ? 'true' : 'false')
    soundToggle.setAttribute('aria-label', `Fahrstuhlton ${soundEnabled ? 'ausschalten' : 'einschalten'}`)
    soundToggle.querySelector('b').textContent = `Ton ${soundEnabled ? 'an' : 'aus'}`
    if (soundEnabled) {
      ensureAudioContext()
      playRelay()
    }
  })

  compactToggle.addEventListener('click', () => {
    const compact = !nav.classList.contains('is-compact')
    nav.classList.toggle('is-compact', compact)
    compactToggle.setAttribute('aria-pressed', compact ? 'true' : 'false')
    compactToggle.setAttribute('aria-label', `Kompakte Navigation ${compact ? 'ausschalten' : 'einschalten'}`)
  })

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !nav.classList.contains('is-open')) return
    setOpen(false)
    button.focus()
  })

  document.addEventListener('pointerdown', (event) => {
    if (!nav.classList.contains('is-open')) return
    if (!nav.contains(event.target)) setOpen(false)
  })

  nav.addEventListener('click', (event) => {
    const link = event.target.closest('.brand-floor-link')
    if (!link) return

    const target = link.getAttribute('target')
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || target === '_blank') return

    event.preventDefault()
    const exactCurrentPage = normalizePath(link.pathname) === currentPath
    selectFloor(link)

    if (exactCurrentPage) {
      window.setTimeout(() => setOpen(false), 320)
      return
    }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      window.setTimeout(() => {
        window.location.href = link.href
      }, soundEnabled ? 140 : 0)
      return
    }

    window.setTimeout(() => {
      setOpen(false)
      startRide(link)
    }, 330)
  })

  document.body.appendChild(nav)

  if (footerEnabled && !document.querySelector('footer') && !document.querySelector('.brand-footer')) {
    document.body.appendChild(createFooter(links, currentPath))
  }

  mountPreferredSource()

  function setOpen(open, { focusPanel = false } = {}) {
    window.clearTimeout(selectionTimer)
    nav.classList.toggle('is-open', open)
    button.setAttribute('aria-expanded', open ? 'true' : 'false')
    button.setAttribute('aria-label', open ? 'Navigation schließen' : 'Navigation öffnen')
    setPanelAccessibility(open)

    if (!open) {
      resetSelection()
      updateIndicator(currentFloor, false)
      return
    }

    if (focusPanel) {
      requestAnimationFrame(() => {
        const activeLink = panelLinks.find((link) => link.hasAttribute('aria-current')) || panelLinks[0]
        activeLink?.focus({ preventScroll: true })
      })
    }
  }

  function setPanelAccessibility(open) {
    if (open) {
      panel.removeAttribute('aria-hidden')
      panel.removeAttribute('inert')
      if (supportsInert) panel.inert = false
      if (!supportsInert) setPanelTabbable(true)
      return
    }

    panel.setAttribute('aria-hidden', 'true')
    panel.setAttribute('inert', '')
    if (supportsInert) panel.inert = true
    if (!supportsInert) setPanelTabbable(false)
  }

  function setPanelTabbable(tabbable) {
    ;[...panelLinks, soundToggle, compactToggle].forEach((control) => {
      if (tabbable) {
        control.removeAttribute('tabindex')
        return
      }
      control.setAttribute('tabindex', '-1')
    })
  }

  function selectFloor(link) {
    window.clearTimeout(selectionTimer)
    resetSelection()

    const floor = link.dataset.floor || link.querySelector('.brand-floor-code')?.textContent || ''
    link.classList.add('is-selected', 'is-pressed')
    playRelay()

    window.setTimeout(() => link.classList.remove('is-pressed'), 150)
    selectionTimer = window.setTimeout(() => {
      updateIndicator(floor, true)
      playGong()
    }, 150)
  }

  function resetSelection() {
    panelLinks.forEach((link) => link.classList.remove('is-selected', 'is-pressed'))
  }

  function updateIndicator(floor, animate) {
    if (!floor) return

    const apply = () => {
      indicatorGlyph.textContent = floor
      indicator.setAttribute('aria-label', `Gewählte Etage ${floor}`)
    }

    if (!animate || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      apply()
      indicator.classList.remove('is-changing')
      return
    }

    indicator.classList.add('is-changing')
    window.setTimeout(() => {
      apply()
      requestAnimationFrame(() => indicator.classList.remove('is-changing'))
    }, 90)
  }

  function startRide(link) {
    const floor = link.dataset.floor || link.querySelector('.brand-floor-code')?.textContent || ''
    const label = link.querySelector('.brand-floor-name')?.textContent || ''
    const ride = document.createElement('div')
    ride.className = 'brand-elevator-ride'
    ride.setAttribute('role', 'status')
    ride.setAttribute('aria-live', 'polite')
    ride.innerHTML = `
      <div class="brand-ride-indicator">
        <span aria-hidden="true">▲</span>
        <b>${floor}</b>
        <small>${label}</small>
      </div>
      <div class="brand-ride-door brand-ride-door-left" aria-hidden="true"></div>
      <div class="brand-ride-door brand-ride-door-right" aria-hidden="true"></div>
    `
    document.body.appendChild(ride)
    requestAnimationFrame(() => ride.classList.add('is-closing'))
    window.setTimeout(() => {
      window.location.href = link.href
    }, 680)
  }

  function ensureAudioContext() {
    if (!soundEnabled) return null
    const AudioCtor = window.AudioContext || window.webkitAudioContext
    if (!AudioCtor) return null
    if (!audioContext) audioContext = new AudioCtor()
    if (audioContext.state === 'suspended') audioContext.resume()
    return audioContext
  }

  function playRelay() {
    const context = ensureAudioContext()
    if (!context) return

    const now = context.currentTime
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.type = 'square'
    oscillator.frequency.setValueAtTime(105, now)
    oscillator.frequency.exponentialRampToValueAtTime(62, now + 0.045)
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.045, now + 0.004)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.065)
    oscillator.connect(gain).connect(context.destination)
    oscillator.start(now)
    oscillator.stop(now + 0.07)
  }

  function playGong() {
    const context = ensureAudioContext()
    if (!context) return

    const now = context.currentTime
    ;[
      [523.25, 0.032],
      [784.88, 0.018],
    ].forEach(([frequency, volume]) => {
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.type = 'sine'
      oscillator.frequency.setValueAtTime(frequency, now)
      gain.gain.setValueAtTime(0.0001, now)
      gain.gain.exponentialRampToValueAtTime(volume, now + 0.012)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.72)
      oscillator.connect(gain).connect(context.destination)
      oscillator.start(now)
      oscillator.stop(now + 0.75)
    })
  }

  function floorLink(link, path) {
    const active = isActive(link.href, path)
    return `
      <a
        class="brand-floor-link"
        href="${link.href}"
        data-floor="${link.floor}"
        aria-label="${link.label}, Etage ${link.floor}"
        title="${link.label}"
        ${active ? `aria-current="${currentState(link.href, path)}"` : ''}
      >
        <span class="brand-floor-code" aria-hidden="true">${link.floor}</span>
        <i class="brand-floor-button" aria-hidden="true"><span></span></i>
        <em class="brand-floor-name">${link.label}</em>
      </a>
    `
  }

  function createFooter(items, path) {
    const footer = document.createElement('footer')
    footer.className = 'brand-footer'
    footer.innerHTML = items
      .map((link) => `<a href="${link.href}"${isActive(link.href, path) ? ` aria-current="${currentState(link.href, path)}"` : ''}>${link.label}</a>`)
      .join('<span aria-hidden="true">·</span>')
    return footer
  }

  function currentState(href, path) {
    return normalizePath(href) === '/patchnotes/' && path.startsWith('/patch/')
      ? 'location'
      : 'page'
  }

  function activeFloor(items, path) {
    return items.find((link) => isActive(link.href, path))?.floor ?? 'E'
  }

  function isActive(href, path) {
    const target = normalizePath(href)
    if (target === '/') return path === '/'
    if (target === '/patchnotes/' && path.startsWith('/patch/')) return true
    return path === target || path.startsWith(target)
  }

  function normalizePath(path) {
    const clean = `/${String(path || '').replace(/^\/+/, '')}`.replace(/\/{2,}/g, '/')
    if (clean === '/') return clean
    return clean.endsWith('/') ? clean : `${clean}/`
  }

  const PREFERRED_SOURCE_DEEPLINK = 'https://www.google.com/preferences/source?q=deutsche-deadlock-community.de'
  const PREFERRED_SOURCE_SCRIPT = 'https://news.google.com/swg/js/v1/publisher.js'
  let preferredSourceLoading = null

  function mountPreferredSource() {
    if (document.querySelector('[data-preferred-source]')) return
    if (shouldSkipPreferredSource(currentPath)) return

    const wrap = document.createElement('div')
    wrap.className = 'brand-preferred-source'
    wrap.dataset.preferredSource = ''
    wrap.innerHTML = `
      <p class="brand-preferred-copy">Google zeigt dir unsere Seiten in Top Stories und KI-Antworten häufiger, wenn du uns als Quelle merkst.</p>
      <button class="brand-preferred-btn" type="button">Als bevorzugte Quelle merken</button>
    `
    wrap.querySelector('.brand-preferred-btn').addEventListener('click', onPreferredSourceClick)

    const footer = document.querySelector('footer, .brand-footer')
    if (footer) {
      footer.appendChild(wrap)
      return
    }
    document.body.appendChild(wrap)
  }

  function shouldSkipPreferredSource(path) {
    return (
      path.startsWith('/twitch/') ||
      path.startsWith('/uplink/') ||
      path.startsWith('/analyse/') ||
      path.startsWith('/social-media') ||
      path.startsWith('/admin')
    )
  }

  function onPreferredSourceClick() {
    loadPreferredSourceApi()
      .then((api) => {
        api.addPreferredSource()
      })
      .catch(() => {
        window.open(PREFERRED_SOURCE_DEEPLINK, '_blank', 'noopener,noreferrer')
      })
  }

  function loadPreferredSourceApi() {
    if (window.__ddcPreferredSource) {
      return Promise.resolve(window.__ddcPreferredSource)
    }
    if (preferredSourceLoading) return preferredSourceLoading

    preferredSourceLoading = new Promise((resolve, reject) => {
      let settled = false
      const finish = (fn, value) => {
        if (settled) return
        settled = true
        window.clearTimeout(timer)
        fn(value)
      }
      const queue = (self.PREFERRED_SOURCE = self.PREFERRED_SOURCE || [])
      queue.push((preferredSource) => {
        preferredSource.init({ theme: 'dark', lang: 'de' })
        window.__ddcPreferredSource = preferredSource
        finish(resolve, preferredSource)
      })

      const script = document.createElement('script')
      script.async = true
      script.src = PREFERRED_SOURCE_SCRIPT
      script.setAttribute('preferred-sources-control', 'manual')
      script.onerror = () => finish(reject, new Error('preferred-source-script'))
      document.head.appendChild(script)
      const timer = window.setTimeout(() => finish(reject, new Error('preferred-source-timeout')), 8000)
    }).catch((error) => {
      preferredSourceLoading = null
      throw error
    })

    return preferredSourceLoading
  }
})()
