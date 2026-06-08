import { Link, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'

export default function Layout() {
  const { user, login, logout, isAdmin, isCoach } = useAuth()
  const location = useLocation()

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/')
  const navigation = [
    { to: '/', label: 'Tier List', exact: true },
    { to: '/heroes', label: 'Heroes' },
    { to: '/tierlists', label: 'Tier Lists' },
    { to: '/patchnotes', label: 'Patch Notes' },
    { to: '/coaching', label: 'Coaching' },
  ]

  return (
    <div className="page-shell min-h-screen">
      <header className="sticky top-0 z-50 border-b border-white/5 bg-[#080a10]/85 backdrop-blur-xl">
        <div className="content-grid">
          <div className="flex min-h-[78px] items-center justify-between gap-4">
            <div className="flex items-center gap-8">
              <Link to="/" className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-[#84e4ff] via-[#7c6cff] to-[#ff9d66] text-sm font-black tracking-[0.24em] text-[#081019]">
                  DM
                </span>
                <div>
                  <p className="text-[0.68rem] uppercase tracking-[0.28em] text-slate-500">Deathy's</p>
                  <p className="text-lg font-semibold tracking-tight text-white">Deadlock Meta</p>
                </div>
              </Link>

              <nav className="hidden items-center gap-2 rounded-full border border-white/8 bg-white/5 p-1 md:flex">
                {navigation.map((item) => {
                  const active = item.exact ? location.pathname === item.to : isActive(item.to)
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                        active ? 'bg-white text-slate-950' : 'text-slate-300 hover:bg-white/8 hover:text-white'
                      }`}
                    >
                      {item.label}
                    </Link>
                  )
                })}
              </nav>
            </div>

            <div className="flex items-center gap-3">
              {user ? (
                <>
                  <div className="hidden rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300 sm:block">
                    {user.displayName}
                  </div>
                  <Link
                    to="/coaching/me"
                    className="hidden rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/6 hover:text-white sm:block"
                  >
                    Mein Coaching
                  </Link>
                  {isCoach && (
                    <Link
                      to="/coaching/dashboard"
                      className="rounded-full border border-sky-400/25 bg-sky-400/10 px-4 py-2 text-sm font-semibold text-sky-200 transition hover:bg-sky-400/16"
                    >
                      Coach
                    </Link>
                  )}
                  {isAdmin && (
                    <Link
                      to="/admin"
                      className="rounded-full border border-violet-400/25 bg-violet-400/10 px-4 py-2 text-sm font-semibold text-violet-200 transition hover:bg-violet-400/16"
                    >
                      Admin
                    </Link>
                  )}
                  <button onClick={logout} className="rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/6 hover:text-white">
                    Logout
                  </button>
                </>
              ) : (
                <button
                  onClick={login}
                  className="rounded-full bg-[#5865F2] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#4752C4]"
                >
                  Login with Discord
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="relative z-10 flex-1">
        <Outlet />
      </main>

      <footer className="relative z-10 mt-20 border-t border-white/6 bg-[#07090f]/80">
        <div className="content-grid py-10">
          <div className="glass-panel rounded-[1.75rem] px-6 py-8">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">Weekly Updated Meta</p>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-white">Deathy&apos;s Deadlock Meta</p>
                <p className="mt-2 max-w-2xl text-sm text-slate-400">
                  Tier lists, pro builds and patch snapshots focused on competitive Deadlock play.
                </p>
              </div>
              <div className="flex flex-wrap gap-3 text-sm text-slate-300">
                <Link to="/history" className="rounded-full border border-white/10 px-4 py-2 transition hover:bg-white/6 hover:text-white">History</Link>
                <Link to="/feedback" className="rounded-full border border-white/10 px-4 py-2 transition hover:bg-white/6 hover:text-white">Feedback</Link>
                <Link to="/heroes" className="rounded-full border border-white/10 px-4 py-2 transition hover:bg-white/6 hover:text-white">Heroes</Link>
              </div>
            </div>
          </div>
          <div className="mt-6 text-center text-xs uppercase tracking-[0.24em] text-slate-600">
            © {new Date().getFullYear()} Deadlock Meta
          </div>
        </div>
      </footer>
    </div>
  )
}
