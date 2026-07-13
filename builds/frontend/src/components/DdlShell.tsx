import { useEffect } from 'react'
import { Link, Outlet } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import '@/styles/ddl.css'

// Lädt das zentrale Marken-Paket (Fonts, Tokens, Fahrstuhl-Nav) der DDL-Domain.
function useBrandAssets() {
  useEffect(() => {
    document.title = 'Video-Bibliothek | Deutsche Deadlock Community'
    const head = document.head
    const added: HTMLElement[] = []
    for (const href of ['/brand/tokens.css', '/brand/nav.css']) {
      if (!head.querySelector(`link[href="${href}"]`)) {
        const link = document.createElement('link')
        link.rel = 'stylesheet'
        link.href = href
        head.appendChild(link)
        added.push(link)
      }
    }
    const favicon = head.querySelector<HTMLLinkElement>('link[rel~="icon"]')
    if (favicon) favicon.href = '/brand/logo/favicon-64.png'
    if (!document.querySelector('script[src="/brand/nav.js"]')) {
      const script = document.createElement('script')
      script.src = '/brand/nav.js'
      script.defer = true
      document.body.appendChild(script)
      added.push(script)
    }
    return () => added.forEach(el => el.remove())
  }, [])
}

export default function DdlShell() {
  useBrandAssets()
  const { user, login, logout } = useAuth()
  return (
    <div className="ddl-shell">
      <header className="ddl-header">
        <a className="ddl-brand" href="/" aria-label="Deutsche Deadlock Community">
          <img className="logo" src="/brand/logo/logo-192.png" alt="" />
          <img className="wordmark" src="/brand/logo/wordmark.svg" alt="" />
        </a>
        <nav className="ddl-header-nav" aria-label="Bereichsnavigation">
          <a href="/">Empfang</a>
          <Link to="/videos" className="active">Videos</Link>
          {user ? (
            <a href="#" onClick={event => { event.preventDefault(); logout() }}>Abmelden</a>
          ) : (
            <a href="#" onClick={event => { event.preventDefault(); login() }}>Anmelden</a>
          )}
        </nav>
      </header>
      <main className="ddl-main">
        <Outlet />
      </main>
      <footer className="ddl-footer">
        <img src="/brand/logo/wordmark.svg" alt="Deutsche Deadlock Community" />
        <p>Von der Community, für die Community</p>
      </footer>
    </div>
  )
}
