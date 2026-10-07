export const COACHING_URL = 'https://deutsche-deadlock-community.de/coaching/'
export const COACHING_TITLE = 'Deadlock Coaching auf Deutsch | Kostenlosen Coach finden'
export const COACHING_DESCRIPTION = 'Finde einen deutschsprachigen Deadlock Coach. Kostenloses Community-Coaching: Coaches ansehen, Lernziel nennen und einen Termin abstimmen.'

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
