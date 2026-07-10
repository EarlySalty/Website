import { Link, Outlet, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '@/context/AuthContext'
import { Avatar } from '@/components/ui'

export default function Layout() {
  const { user, login, logout, isCoach } = useAuth()
  const location = useLocation()

  const isActive = (path: string, exact = false) =>
    exact ? location.pathname === path : location.pathname === path || location.pathname.startsWith(path + '/')

  return (
    <div className="page-shell flex min-h-screen flex-col">
      {/* ── Header ──────────────────────────────── */}
      <header className="coaching-header sticky top-0 z-50">
        <div className="coaching-header-rule" />
        <div className="content-grid">
          <div className="flex min-h-[64px] items-center justify-between gap-4">

            <div className="flex items-center gap-8">
              <Link to="/" className="brand-wordmark" aria-label="Deutsche Deadlock Community">
                <img src="/brand/logo/logo-192.png" className="brand-logo" alt="" />
                <span className="brand-copy">
                  <img src="/brand/logo/wordmark.svg" className="brand-wordmark-img" alt="" />
                  <strong>Coaching-Etage</strong>
                </span>
              </Link>

              <nav className="hidden items-center gap-1 md:flex">
                <NavLink to="/" active={isActive('/', true)}>Coaches</NavLink>
                <NavLink to="/anfrage" active={isActive('/anfrage')}>Anfrage</NavLink>
                {user && <NavLink to="/me" active={isActive('/me', true)}>Mein Coaching</NavLink>}
                {user && <NavLink to="/me/scrims" active={isActive('/me/scrims')}>Mein Team</NavLink>}
                {user && <NavLink to="/scrims/signup" active={isActive('/scrims/signup')}>Anmeldung</NavLink>}
                {isCoach && (
                  <NavLink to="/dashboard" active={isActive('/dashboard') || isActive('/overview') || isActive('/coachees')}>
                    Coach-Bereich
                  </NavLink>
                )}
                {isCoach && <NavLink to="/scrims" active={isActive('/scrims', true)}>Scrim-Pool</NavLink>}
              </nav>
            </div>

            {/* Auth */}
            <div className="flex items-center gap-3">
              {user ? (
                <>
                  <div className="user-chip hidden items-center gap-2.5 sm:flex">
                    <Avatar url={user.avatarUrl} name={user.displayName} size={30} />
                    <span>
                      {user.displayName}
                    </span>
                  </div>
                  <button onClick={logout} className="logout-button">
                    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <path d="M6.25 3.25H4.5A1.25 1.25 0 0 0 3.25 4.5v7A1.25 1.25 0 0 0 4.5 12.75h1.75" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
                      <path d="M8.5 5.25 11.25 8 8.5 10.75M11 8H5.75" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Logout
                  </button>
                </>
              ) : (
                <button
                  onClick={login}
                  className="discord-login-button flex items-center gap-2 rounded-sm px-4 py-2 text-sm font-semibold text-white transition"
                  style={{ background: '#5865F2' }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#4752C4' }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#5865F2' }}
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057.1 18.1.127 18.14.161 18.164a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
                  </svg>
                  Login
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="relative z-10 mt-auto py-8" style={{ borderTop: '1px solid var(--border-dim)' }}>
        <div className="content-grid">
          <div className="flex flex-col items-center justify-between gap-2 sm:flex-row">
            <p className="font-mono-data text-[10px] uppercase tracking-[0.22em]" style={{ color: 'var(--text-muted)' }}>
              Deutsche Deadlock Community — Coaching
            </p>
            <p className="font-mono-data text-[10px] tracking-[0.1em]" style={{ color: 'var(--text-muted)' }}>
              © {new Date().getFullYear()} DDC
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}

function NavLink({ to, children, active }: { to: string; children: ReactNode; active: boolean }) {
  return (
    <Link
      to={to}
      className={`nav-link${active ? ' is-active' : ''}`}
    >
      {children}
    </Link>
  )
}
