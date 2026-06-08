import { Link, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'

export default function Layout() {
  const { user, login, logout, isCoach } = useAuth()
  const location = useLocation()

  const isActive = (path: string, exact = false) =>
    exact ? location.pathname === path : location.pathname === path || location.pathname.startsWith(path + '/')

  return (
    <div className="page-shell min-h-screen">
      {/* ── Header ──────────────────────────────── */}
      <header
        className="sticky top-0 z-50"
        style={{
          background: 'rgba(6, 8, 16, 0.92)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(232, 149, 58, 0.12)',
        }}
      >
        <div className="content-grid">
          <div className="flex min-h-[70px] items-center justify-between gap-4">

            {/* Logo */}
            <div className="flex items-center gap-7">
              <Link to="/" className="flex items-center gap-3">
                <div
                  className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-sm"
                  style={{
                    background: 'linear-gradient(135deg, var(--amber) 0%, #c97420 100%)',
                    color: '#06080f',
                    fontFamily: "'Rajdhani', sans-serif",
                    fontSize: '11px',
                    fontWeight: 800,
                    letterSpacing: '0.18em',
                  }}
                >
                  DDC
                </div>
                <div className="hidden sm:block">
                  <p className="text-[10px] uppercase tracking-[0.28em]" style={{ color: 'var(--text-muted)' }}>
                    Coaching
                  </p>
                  <p
                    className="text-base leading-none text-white"
                    style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, letterSpacing: '0.06em' }}
                  >
                    Deadlock
                  </p>
                </div>
              </Link>

              {/* Nav */}
              <nav className="hidden items-center gap-1 md:flex">
                <NavLink to="/" active={isActive('/', true)}>Coaches</NavLink>
                {user && <NavLink to="/me" active={isActive('/me')}>Mein Coaching</NavLink>}
                {isCoach && (
                  <NavLink to="/dashboard" active={isActive('/dashboard') || isActive('/overview')}>
                    Dashboard
                  </NavLink>
                )}
              </nav>
            </div>

            {/* Auth */}
            <div className="flex items-center gap-3">
              {user ? (
                <>
                  <div className="hidden items-center gap-2 sm:flex">
                    <div
                      className="h-7 w-7 flex-shrink-0 overflow-hidden rounded-sm"
                      style={{ background: 'var(--bg-raised)' }}
                    >
                      <div
                        className="flex h-full w-full items-center justify-center text-xs font-bold"
                        style={{ color: 'var(--amber)', fontFamily: "'Rajdhani', sans-serif" }}
                      >
                        {(user.displayName || '?').charAt(0).toUpperCase()}
                      </div>
                    </div>
                    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {user.displayName}
                    </span>
                  </div>
                  <button
                    onClick={logout}
                    className="rounded-sm px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition"
                    style={{
                      border: '1px solid var(--border-soft)',
                      color: 'var(--text-secondary)',
                      fontFamily: "'Rajdhani', sans-serif",
                    }}
                    onMouseEnter={e => {
                      const t = e.currentTarget
                      t.style.borderColor = 'var(--border-medium)'
                      t.style.color = 'var(--text-primary)'
                    }}
                    onMouseLeave={e => {
                      const t = e.currentTarget
                      t.style.borderColor = 'var(--border-soft)'
                      t.style.color = 'var(--text-secondary)'
                    }}
                  >
                    Logout
                  </button>
                </>
              ) : (
                <button
                  onClick={login}
                  className="flex items-center gap-2 rounded-sm px-4 py-2 text-sm font-semibold text-white transition"
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

      {/* ── Main ────────────────────────────────── */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* ── Footer ──────────────────────────────── */}
      <footer className="mt-auto py-8" style={{ borderTop: '1px solid var(--border-dim)' }}>
        <div className="content-grid">
          <div className="flex flex-col items-center justify-between gap-2 sm:flex-row">
            <p
              className="text-xs uppercase tracking-[0.2em]"
              style={{ color: 'var(--text-muted)', fontFamily: "'Rajdhani', sans-serif" }}
            >
              Deutsche Deadlock Community — Coaching
            </p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              © {new Date().getFullYear()} DDC
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}

function NavLink({ to, children, active }: { to: string; children: React.ReactNode; active: boolean }) {
  return (
    <Link
      to={to}
      className="relative px-4 py-2 text-[13px] font-semibold uppercase tracking-[0.1em] transition"
      style={{
        fontFamily: "'Rajdhani', sans-serif",
        color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
      }}
    >
      {children}
      {active && (
        <span
          className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full"
          style={{ background: 'var(--amber)' }}
        />
      )}
    </Link>
  )
}
