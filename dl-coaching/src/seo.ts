// Public metadata only. Never include account, coach or session data here.
export const COACHING_URL = 'https://deutsche-deadlock-community.de/coaching/'
export const COACHING_TITLE = 'Deadlock Coaching auf Deutsch | Kostenlosen Coach finden'
export const COACHING_DESCRIPTION = 'Finde einen Deadlock Coach auf Deutsch. Kostenloses Community-Coaching für Einsteiger und erfahrene Spieler: Coaches ansehen, Lernziel nennen und Termin abstimmen.'

export const coachingStructuredData = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': `${COACHING_URL}#webpage`,
      name: COACHING_TITLE,
      description: COACHING_DESCRIPTION,
      url: COACHING_URL,
      inLanguage: 'de-DE',
      isPartOf: { '@id': 'https://deutsche-deadlock-community.de/#website' },
      breadcrumb: { '@id': `${COACHING_URL}#breadcrumb` },
    },
    {
      '@type': 'BreadcrumbList',
      '@id': `${COACHING_URL}#breadcrumb`,
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Start', item: 'https://deutsche-deadlock-community.de/' },
        { '@type': 'ListItem', position: 2, name: 'Deadlock Coaching', item: COACHING_URL },
      ],
    },
  ],
}

export function coachingPageMetadata(pathname: string) {
  const path = pathname.replace(/\/+$/, '') || '/'
  const isPublicOverview = path === '/'
  const isPublicProfile = /^\/coaches\/[^/]+$/.test(path)
  return {
    isPublicOverview,
    title: isPublicOverview ? COACHING_TITLE : isPublicProfile ? 'Deadlock Coach | Deutsche Deadlock Community' : 'Coaching-Bereich | Deutsche Deadlock Community',
    description: isPublicOverview ? COACHING_DESCRIPTION : isPublicProfile ? 'Profil und Schwerpunkte eines Deadlock Coaches aus der Deutschen Deadlock Community.' : 'Coaching-Anfragen und Termine der Deutschen Deadlock Community.',
    canonical: isPublicOverview ? COACHING_URL : `${COACHING_URL}${path.replace(/^\/+/, '')}`,
    robots: isPublicOverview || isPublicProfile ? 'index, follow, max-image-preview:large' : 'noindex, follow',
  }
}
