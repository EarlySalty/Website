import { Link, Outlet, useLocation } from 'react-router-dom'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useAuth } from '@/context/AuthContext'
import { Avatar } from '@/components/ui'

export default function Layout() {
  const { user, login, logout, isCoach } = useAuth()
  const location = useLocation()
  const [open, setOpen] = useState<'account' | 'navigation' | null>(null)
  const header = useRef<HTMLElement>(null)
  const accountButton = useRef<HTMLButtonElement>(null)
  const menuButton = useRef<HTMLButtonElement>(null)
  const isActive = (path: string, exact = false) =>
    exact ? location.pathname === path : location.pathname === path || location.pathname.startsWith(path + '/')

  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!header.current?.contains(event.target as Node)) setOpen(null)
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (open === 'account') accountButton.current?.focus()
        if (open === 'navigation') menuButton.current?.focus()
        setOpen(null)
      }
    }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', escape)
    }
  }, [open])

  const personalLinks = (
    <>
      <NavLink to="/me" active={isActive('/me', true)}>Mein Coaching</NavLink>
      <NavLink to="/me/scrims" active={isActive('/me/scrims')}>Mein Team</NavLink>
      {isCoach && <>
        <NavLink to="/dashboard" active={isActive('/dashboard') || isActive('/overview') || isActive('/coachees')}>Coach-Bereich</NavLink>
        <NavLink to="/scrims" active={isActive('/scrims', true)}>Scrim-Pool</NavLink>
        <NavLink to="/scrims/lage" active={isActive('/scrims/lage')}>Scrim-Lage</NavLink>
      </>}
      <button className="account-logout" onClick={() => { setOpen(null); logout() }}>Abmelden</button>
    </>
  )

  return (
    <div className="page-shell flex min-h-screen flex-col">
      <header ref={header} className="coaching-header z-50" onClick={(event) => {
        if ((event.target as Element).closest('a')) setOpen(null)
      }} onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) setOpen(null)
      }}>
        <div className="content-grid header-row">
          <Link to="/" className="brand-wordmark" aria-label="Deutsche Deadlock Community">
            <img src="/brand/logo/logo-192.png" className="brand-logo" alt="" />
            <img src="/brand/logo/wordmark.svg" className="brand-wordmark-img" alt="" />
          </Link>
          <nav className="public-navigation" aria-label="Coaching">
            <NavLink to="/" active={isActive('/', true)}>Coaches</NavLink>
            <NavLink to="/anfrage" active={isActive('/anfrage')}>Anfrage</NavLink>
            <NavLink to="/scrims/signup" active={isActive('/scrims/signup')}>Scrims</NavLink>
          </nav>
          <div className="header-actions">
            <Link to="/anfrage" className="btn-amber header-cta">Coaching anfragen</Link>
            {user ? <div className="account-wrapper">
              <button ref={accountButton} className="account-toggle" aria-label={`Konto von ${user.displayName}`} aria-expanded={open === 'account'} aria-controls="account-navigation" onClick={() => setOpen(open === 'account' ? null : 'account')}>
                <Avatar url={user.avatarUrl} name={user.displayName} size={32} />
                <span className="account-name">{user.displayName}</span><span aria-hidden="true">⌄</span>
              </button>
              {open === 'account' && <nav id="account-navigation" className="account-panel" aria-label="Mein Bereich">
                <p className="account-heading">{user.displayName}</p>{personalLinks}
              </nav>}
            </div> : <button className="header-login" onClick={login}>Einloggen</button>}
            <button ref={menuButton} className="mobile-menu-toggle" aria-expanded={open === 'navigation'} aria-controls="mobile-navigation" onClick={() => setOpen(open === 'navigation' ? null : 'navigation')}>
              {open === 'navigation' ? 'Schließen' : 'Menü'}
            </button>
          </div>
        </div>
        {open === 'navigation' && <nav id="mobile-navigation" className="mobile-navigation content-grid" aria-label="Coaching mobil">
          <NavLink to="/" active={isActive('/', true)}>Coaches</NavLink>
          <NavLink to="/anfrage" active={isActive('/anfrage')}>Anfrage</NavLink>
          <NavLink to="/scrims/signup" active={isActive('/scrims/signup')}>Scrims</NavLink>
        </nav>}
      </header>
      <main className="flex-1"><Outlet /></main>
      <footer className="relative z-10 mt-auto py-8" style={{ borderTop: '1px solid var(--border-dim)' }}>
        <div className="content-grid flex flex-wrap justify-between gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
          <p>Deutsche Deadlock Community · Coaching</p><p>© {new Date().getFullYear()} DDC</p>
        </div>
      </footer>
    </div>
  )
}

function NavLink({ to, children, active }: { to: string; children: ReactNode; active: boolean }) {
  return <Link to={to} className={`nav-link${active ? ' is-active' : ''}`} aria-current={active ? 'page' : undefined}>{children}</Link>
}
