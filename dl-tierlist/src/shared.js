export const BUCKET_OPTIONS = [
  { value: 'all', label: 'All Skill' },
  { value: 'phantom_plus', label: 'Phantom+' },
  { value: 'eternus', label: 'Eternus' },
]

export const DEFAULT_BUCKET = 'all'
export const DEFAULT_VIEW_MODE = 'grid'
export const BUCKET_STORAGE_KEY = 'tierlist_bucket'
export const VIEW_MODE_STORAGE_KEY = 'tierlist_view_mode'
const CACHE_PREFIX = 'tierlist_cache_'

const DATE_FORMAT = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

const DATE_TIME_FORMAT = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

function readMetaContent(name) {
  return document.querySelector(`meta[name="${name}"]`)?.content?.trim() ?? ''
}

function safeStorageGet(key) {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function safeStorageSet(key, value) {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Ignore storage failures.
  }
}

function safeStorageRemove(key) {
  try {
    window.localStorage.removeItem(key)
  } catch {
    // Ignore storage failures.
  }
}

function withTimeout(timeoutMs) {
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs)
  return { controller, timeoutId }
}

async function readJson(response) {
  const text = await response.text()
  if (!text) {
    return null
  }

  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

async function requestJson(url, options = {}) {
  const {
    timeoutMs = 10000,
    headers,
    body,
    method = 'GET',
  } = options
  const { controller, timeoutId } = withTimeout(timeoutMs)

  try {
    const response = await fetch(url, {
      method,
      headers,
      body,
      credentials: 'include',
      signal: controller.signal,
    })
    const payload = await readJson(response)

    if (!response.ok) {
      const error = new Error(`Request failed: ${response.status}`)
      error.status = response.status
      error.payload = payload
      throw error
    }

    return payload
  } catch (error) {
    if (error?.name === 'AbortError') {
      const timeoutError = new Error('Request timed out')
      timeoutError.code = 'timeout'
      throw timeoutError
    }

    throw error
  } finally {
    window.clearTimeout(timeoutId)
  }
}

async function fetchStaticJson(path) {
  const response = await fetch(path, {
    credentials: 'include',
  })

  if (!response.ok) {
    throw new Error(`Static request failed: ${response.status}`)
  }

  return response.json()
}

function shouldFallback(error) {
  if (!error) {
    return false
  }

  if (error.code === 'timeout') {
    return true
  }

  if (typeof error.status === 'number') {
    return error.status >= 500 || error.status === 404
  }

  return true
}

export function getApiBase() {
  const runtimeValue =
    typeof window.TIERLIST_API_BASE === 'string' ? window.TIERLIST_API_BASE.trim() : ''
  return runtimeValue || readMetaContent('tierlist-api-base') || ''
}

export function buildApiUrl(path) {
  return `${getApiBase()}${path}`
}

export function resolveAssetUrl(url) {
  if (!url) return ''
  const value = String(url).trim()
  if (!value) return ''
  if (/^https?:\/\//i.test(value) || value.startsWith('data:')) {
    return value
  }
  const base = (import.meta.env?.BASE_URL ?? '/').replace(/\/$/, '')
  if (value.startsWith('/')) {
    return `${base}${value}`
  }
  return `${base}/${value}`
}

export function normalizeBucket(value) {
  return BUCKET_OPTIONS.some((item) => item.value === value) ? value : DEFAULT_BUCKET
}

export function getInitialBucket() {
  const url = new URL(window.location.href)
  const fromUrl = normalizeBucket(url.searchParams.get('bucket'))
  if (fromUrl !== DEFAULT_BUCKET || url.searchParams.get('bucket') === DEFAULT_BUCKET) {
    return fromUrl
  }

  return normalizeBucket(safeStorageGet(BUCKET_STORAGE_KEY))
}

export function persistBucket(bucket) {
  safeStorageSet(BUCKET_STORAGE_KEY, normalizeBucket(bucket))
}

export function syncBucketInUrl(bucket) {
  const nextBucket = normalizeBucket(bucket)
  const url = new URL(window.location.href)
  if (nextBucket === DEFAULT_BUCKET) {
    url.searchParams.delete('bucket')
  } else {
    url.searchParams.set('bucket', nextBucket)
  }
  window.history.replaceState({}, '', url)
}

export function getInitialViewMode() {
  return safeStorageGet(VIEW_MODE_STORAGE_KEY) === 'list' ? 'list' : DEFAULT_VIEW_MODE
}

export function persistViewMode(mode) {
  safeStorageSet(VIEW_MODE_STORAGE_KEY, mode === 'list' ? 'list' : DEFAULT_VIEW_MODE)
}

export function formatUnixDate(unixSeconds) {
  if (!Number.isFinite(unixSeconds)) {
    return '—'
  }

  return DATE_FORMAT.format(new Date(unixSeconds * 1000))
}

export function formatUnixDateTime(unixSeconds) {
  if (!Number.isFinite(unixSeconds)) {
    return '—'
  }

  return DATE_TIME_FORMAT.format(new Date(unixSeconds * 1000))
}

export function formatPercent(value) {
  return Number.isFinite(value) ? `${Number(value).toFixed(1)}%` : '—'
}

export function formatWinrateDelta(value) {
  if (!Number.isFinite(value)) {
    return { text: '—', tone: 'muted' }
  }

  const rounded = Number(value).toFixed(1)
  if (Number(value) > 0) {
    return { text: `+${rounded}`, tone: 'positive' }
  }
  if (Number(value) < 0) {
    return { text: rounded, tone: 'negative' }
  }
  return { text: '±0.0', tone: 'neutral' }
}

export function formatMatches(value) {
  return Number.isFinite(value) ? new Intl.NumberFormat('de-DE').format(value) : '—'
}

export function resolveHeroCatalog(source) {
  const entries =
    source && typeof source === 'object' && !Array.isArray(source)
      ? Object.entries(source)
      : []

  const map = new Map()
  entries.forEach(([key, item]) => {
    if (!item || typeof item !== 'object') {
      return
    }

    const heroId = Number.parseInt(key, 10)
    const slug = String(item.slug ?? item.id ?? key).trim()
    const imageUrl = resolveAssetUrl(String(item.image_url ?? item.image ?? '').trim())
    const hero = {
      hero_id: Number.isFinite(heroId) ? heroId : key,
      name: String(item.name ?? 'Unknown Hero'),
      slug,
      image_url: imageUrl,
    }

    map.set(String(hero.hero_id), hero)
    if (slug) {
      map.set(slug, hero)
    }
  })

  return map
}

export function cacheTierlist(bucket, payload) {
  safeStorageSet(`${CACHE_PREFIX}${normalizeBucket(bucket)}`, JSON.stringify(payload))
}

export function readCachedTierlist(bucket) {
  const raw = safeStorageGet(`${CACHE_PREFIX}${normalizeBucket(bucket)}`)
  if (!raw) {
    return null
  }

  try {
    return JSON.parse(raw)
  } catch {
    safeStorageRemove(`${CACHE_PREFIX}${normalizeBucket(bucket)}`)
    return null
  }
}

export async function fetchTierlist(bucket) {
  const normalizedBucket = normalizeBucket(bucket)

  try {
    const data = await requestJson(
      buildApiUrl(`/api/tierlist?bucket=${encodeURIComponent(normalizedBucket)}`),
      { timeoutMs: 10000 },
    )
    cacheTierlist(normalizedBucket, data)
    return { data, source: 'live' }
  } catch (error) {
    if (!shouldFallback(error)) {
      throw error
    }

    const cached = readCachedTierlist(normalizedBucket)
    if (cached) {
      return { data: cached, source: 'cache', error }
    }

    const data = await fetchStaticJson('/data/tierlist.json')
    return { data, source: 'static', error }
  }
}

export async function fetchHeroCatalog() {
  try {
    const data = await requestJson(buildApiUrl('/api/heroes'), { timeoutMs: 10000 })
    return { data, source: 'live' }
  } catch (error) {
    if (!shouldFallback(error)) {
      throw error
    }

    const data = await fetchStaticJson('/data/heroes.json')
    return { data, source: 'static', error }
  }
}

export async function fetchTierlistHistory(bucket) {
  const normalizedBucket = normalizeBucket(bucket)

  try {
    const data = await requestJson(
      buildApiUrl(`/api/tierlist/history?bucket=${encodeURIComponent(normalizedBucket)}`),
      { timeoutMs: 10000 },
    )
    return { data, source: 'live' }
  } catch (error) {
    if (!shouldFallback(error)) {
      throw error
    }

    const data = await fetchStaticJson('/data/history.json')
    return { data, source: 'static', error }
  }
}

export async function postBuildVote(buildId, vote) {
  return requestJson(buildApiUrl(`/api/builds/${encodeURIComponent(buildId)}/vote`), {
    method: 'POST',
    timeoutMs: 10000,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ vote }),
  })
}
