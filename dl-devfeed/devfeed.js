(() => {
  'use strict'

  const endpoint = '/devfeed/api/public/v1/messages?limit=30'
  const list = document.getElementById('feed-list')
  const status = document.getElementById('feed-status')
  const count = document.getElementById('feed-count')
  const error = document.getElementById('feed-error')
  const refresh = document.getElementById('feed-refresh')

  if (!list || !status || !count || !error || !refresh) return

  refresh.addEventListener('click', () => loadFeed({ manual: true }))
  loadFeed()

  async function loadFeed({ manual = false } = {}) {
    setLoading(manual ? 'Wird neu geladen' : 'Verbindung wird aufgebaut')
    try {
      const response = await fetch(endpoint, {
        credentials: 'omit',
        headers: { Accept: 'application/json' },
        cache: 'no-cache',
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data = await response.json()
      const items = Array.isArray(data.items) ? data.items : []
      render(items)
      status.textContent = items.length ? 'Aktuell' : 'Noch keine Einträge'
      count.textContent = items.length === 1 ? '1 Nachricht' : `${items.length} Nachrichten`
      error.hidden = true
    } catch (_err) {
      list.replaceChildren()
      list.setAttribute('aria-busy', 'false')
      refresh.disabled = false
      status.textContent = 'Vorübergehend nicht erreichbar'
      count.textContent = 'Die Originalquellen bleiben unverändert.'
      error.textContent = 'Der DevFeed konnte gerade nicht geladen werden. Bitte versuche es in Kürze erneut.'
      error.hidden = false
    }
  }

  function setLoading(label) {
    status.textContent = label
    refresh.disabled = true
    error.hidden = true
    list.setAttribute('aria-busy', 'true')
  }

  function render(items) {
    const fragment = document.createDocumentFragment()

    if (!items.length) {
      const empty = document.createElement('p')
      empty.className = 'feed-error'
      empty.textContent = 'Noch keine freigegebenen Entwickler Nachrichten im Feed.'
      fragment.appendChild(empty)
    }

    for (const item of items) {
      fragment.appendChild(renderItem(item))
    }

    list.replaceChildren(fragment)
    list.setAttribute('aria-busy', 'false')
    refresh.disabled = false
  }

  function renderItem(item) {
    const article = document.createElement('article')
    article.className = 'feed-item'

    const visual = document.createElement('div')
    visual.className = 'feed-visual'

    const image = document.createElement('img')
    image.loading = 'lazy'
    image.decoding = 'async'
    image.src = `/devfeed/api/public/v1/messages/${encodeURIComponent(item.message_id)}/card.svg`
    image.alt = `DevFeed Karte von ${safeText(item.author_name, 'Entwickler')}`
    image.addEventListener('error', () => {
      visual.replaceChildren(renderTextFallback(item))
    })
    visual.appendChild(image)

    const meta = document.createElement('div')
    meta.className = 'feed-meta'

    const time = document.createElement('time')
    time.className = 'feed-meta-time'
    const date = parseDate(item.sent_at || item.caught_at)
    time.textContent = date.label
    if (date.iso) time.dateTime = date.iso

    const author = document.createElement('strong')
    author.className = 'feed-meta-author'
    author.textContent = safeText(item.author_name, 'Entwickler')

    const copy = document.createElement('div')
    copy.className = 'feed-meta-copy'
    copy.textContent = safeText(item.content, '(kein Text)')

    meta.append(time, author, copy)

    if (Array.isArray(item.context) && item.context.length) {
      const context = document.createElement('div')
      context.className = 'feed-context'
      const first = item.context[0]
      context.textContent = `Antwort auf ${safeText(first.author_name, 'Nutzer')}: ${safeText(first.content, '(kein Text)')}`
      meta.appendChild(context)
    }

    const source = document.createElement('a')
    source.className = 'feed-open'
    source.href = item.jump_url
    source.target = '_blank'
    source.rel = 'noopener noreferrer'
    source.textContent = 'Original auf Discord öffnen ↗'
    meta.appendChild(source)

    article.append(visual, meta)
    return article
  }

  function renderTextFallback(item) {
    const fallback = document.createElement('div')
    fallback.className = 'feed-text-fallback'
    const title = document.createElement('strong')
    title.textContent = safeText(item.author_name, 'Entwickler')
    const copy = document.createElement('p')
    copy.textContent = safeText(item.content, '(kein Text)')
    fallback.append(title, copy)
    return fallback
  }

  function safeText(value, fallback) {
    return typeof value === 'string' && value.trim() ? value.trim() : fallback
  }

  function parseDate(value) {
    if (typeof value !== 'string' || !value) return { label: 'Zeit unbekannt', iso: '' }
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return { label: value, iso: '' }
    return {
      label: new Intl.DateTimeFormat('de-DE', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(parsed),
      iso: parsed.toISOString(),
    }
  }
})()
