/** Gemeinsame Ausschlüsse für robots.txt und die öffentliche Sitemap. */
export const legalNames = ['impressum', 'datenschutz', 'agb', 'privacy', 'imprint', 'terms', 'legal']
export const privatePrefixes = [
  '/admin', '/api', '/auth', '/oauth', '/callback', '/login', '/logout',
  '/internal', '/dashboard', '/analyse', '/social-media', '/social-media-admin',
  '/ai-bridge', '/hermes', '/me', '/survey', '/demo',
  '/twitch/api', '/twitch/auth', '/twitch/dashboard', '/twitch/dashboard-v2',
  '/twitch/uplink', '/twitch/titel', '/twitch/analyse', '/twitch/verwaltung',
  '/twitch/hilfe', '/twitch/feedback', '/twitch/overlay', '/twitch/pause-loop',
  '/twitch/caster-overlay', '/twitch/kategorie', '/twitch/legal',
  '/twitch/raid/auth', '/twitch/raid/callback', '/twitch/discord_link',
  '/uplink/dock', '/uplink/v1', '/uplink/v2', '/uplink/auth',
  '/streamer/v1', '/streamer/v2',
]

export const disallowRules = [
  ...legalNames.flatMap((name) => [`/${name}`, `/*/${name}`]),
  ...privatePrefixes.flatMap((prefix) => [`${prefix}$`, `${prefix}/`, `${prefix}?`]),
  '/twitch$', '/twitch/$', '/twitch?',
  '/*/api$', '/*/api/', '/*/api?', '/*/admin$', '/*/admin/', '/*/admin?',
]

export function excludedFromSitemap(path) {
  const pathname = new URL(path, 'https://deutsche-deadlock-community.de').pathname
  return /\/(impressum|datenschutz|agb|privacy|imprint|terms|legal)(?:\.html)?(?:\/|$)/i.test(pathname)
    || privatePrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
    || /\/(api|admin)(?:\/|$)/i.test(pathname)
    || pathname === '/twitch' || pathname === '/twitch/'
}
