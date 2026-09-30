import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { coachingPageMetadata, coachingStructuredData } from '@/seo'

function setMeta(attribute: 'name' | 'property', key: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`)
  if (!element) {
    element = document.createElement('meta')
    element.setAttribute(attribute, key)
    document.head.appendChild(element)
  }
  element.content = content
}

export default function CoachingMetadata() {
  const { pathname } = useLocation()

  useEffect(() => {
    const metadata = coachingPageMetadata(pathname)
    document.title = metadata.title
    setMeta('name', 'description', metadata.description)
    setMeta('name', 'robots', metadata.robots)
    setMeta('property', 'og:title', metadata.title)
    setMeta('property', 'og:description', metadata.description)
    setMeta('property', 'og:url', metadata.canonical)
    setMeta('name', 'twitter:title', metadata.title)
    setMeta('name', 'twitter:description', metadata.description)

    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    if (!canonical) {
      canonical = document.createElement('link')
      canonical.rel = 'canonical'
      document.head.appendChild(canonical)
    }
    canonical.href = metadata.canonical

    // The overview schema must not describe a personal dashboard or profile.
    document.getElementById('coaching-structured-data')?.remove()
    if (metadata.isPublicOverview) {
      const structuredData = document.createElement('script')
      structuredData.id = 'coaching-structured-data'
      structuredData.type = 'application/ld+json'
      structuredData.textContent = JSON.stringify(coachingStructuredData)
      document.head.appendChild(structuredData)
    }
  }, [pathname])

  return null
}
