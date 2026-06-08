import { Link, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'

export default function Layout() {
  const { user, login, logout, isCoach } = useAuth()
  const location = useLocation()

  const isActive = (path: string, exact = false) =>
    exact ? location.pathname === path : location.pathname === path || location.pathname.startsWith(path + '/')

  return (
    <div className="page-shell min-h-screen">
      <header className="sticky top-0 z-50 border-b border-white/5 bg-[#080a10]/85 backdrop-blur-xl">
        <div className="content-grid">
          <div className="flex min-h-[78px] items-center justify-between gap-4">
            <div className="flex items-center gap-8">
              <Link to="/" className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-[#84e4ff] via-[#7c6cff] to-[#ff9d66] text-sm font-black tracking-[0.24em] text-[#081019]">
                  DC
                </span>
                <div>
                  <p className="text-[0.68rem] uppercase tracking-[0.28em] text-slate-500">DDC</p>
                  <p className="text-lg font-semibold tracking-tight text-white">Coaching</p>
                </div>
              </Link>

              <nav className="hidden items-center gap-2 rounded-full border border-white/8 bg-white/5 p-1 md:flex">
                <Link
                  to="/"
                  className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                    isActive('/', true) ? 'bg-white text-slate-950' : 'text-slate-300 hover:bg-white/8 hover:text-white'
                  }`}
                >
                  Coaches
                </Link>
                {user && (
                  <Link
                    to="/me"
                    className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                      isActive('/me') ? 'bg-white text-slate-950' : 'text-slate-300 hover:bg-white/8 hover:text-white'
                    }`}
                  >
                    Mein Coaching
                  </Link>
                )}
                {isCoach && (
                  <Link
                    to="/dashboard"
                    className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                      isActive('/dashboard') || isActive('/overview') ? 'bg-white text-slate-950' : 'text-slate-300 hover:bg-white/8 hover:text-white'
                    }`}
                  >
                    Coach-Dashboard
                  </Link>
                )}
              </nav>
            </div>

            <div className="flex items-center gap-3">
              {user ? (
                <>
                  <div className="hidden rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300 sm:block">
                    {user.displayName}
                  </div>
                  <button
                    onClick={logout}
                    className="rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/6 hover:text-white"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <button
                  onClick={login}
                  className="rounded-full bg-[#5865F2] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#4752C4]"
                >
                  Login with Discord
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="mt-auto border-t border-white/5 py-10">
        <div className="content-grid">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-base font-semibold text-white">Deutsche Deadlock Community — Coaching</p>
              <p className="mt-2 max-w-2xl text-sm text-slate-400">
                Coaching-Plattform für die Deutsche Deadlock Community.
              </p>
            </div>
          </div>
          <div className="mt-6 text-center text-xs uppercase tracking-[0.24em] text-slate-600">
            © {new Date().getFullYear()} Deutsche Deadlock Community
          </div>
        </div>
      </footer>
    </div>
  )
}
