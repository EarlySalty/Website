import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { coachingPlatform, type Goal } from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import SessionStatusBadge from '@/components/SessionStatusBadge'

const fmtDate = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

const GOAL_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  open:    { label: 'Offen',     color: 'var(--text-secondary)', bg: 'var(--bg-raised)' },
  active:  { label: 'Aktiv',     color: 'var(--sky)',            bg: 'rgba(56,189,248,0.10)' },
  done:    { label: 'Erreicht',  color: 'var(--green)',          bg: 'rgba(34,197,94,0.10)' },
  dropped: { label: 'Verworfen', color: 'var(--red)',            bg: 'rgba(239,68,68,0.10)' },
}

function GoalCard({ goal }: { goal: Goal }) {
  const s = GOAL_STATUS[goal.status] ?? GOAL_STATUS.open
  const reached = goal.milestones.filter((m) => m.achieved).length
  const pct = goal.milestones.length > 0 ? Math.round((reached / goal.milestones.length) * 100) : 0

  return (
    <div
      className="rounded-sm p-5"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-dim)' }}
    >
      <div className="flex items-start justify-between gap-2">
        <h4
          className="font-bold text-white"
          style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '15px', letterSpacing: '0.04em' }}
        >
          {goal.title}
        </h4>
        <span
          className="flex-shrink-0 rounded-sm px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
          style={{ color: s.color, background: s.bg, fontFamily: "'Rajdhani', sans-serif" }}
        >
          {s.label}
        </span>
      </div>

      {goal.description && (
        <p className="mt-1.5 text-sm" style={{ color: 'var(--text-secondary)' }}>{goal.description}</p>
      )}
      {goal.target_date && (
        <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
          Ziel bis {fmtDate(goal.target_date)}
        </p>
      )}

      {goal.milestones.length > 0 && (
        <div className="mt-4" style={{ borderTop: '1px solid var(--border-dim)', paddingTop: '12px' }}>
          {/* Progress bar */}
          <div className="mb-2 flex items-center justify-between">
            <span className="stat-label">Meilensteine</span>
            <span className="text-xs font-bold" style={{ color: 'var(--amber)', fontFamily: "'Rajdhani', sans-serif" }}>
              {reached}/{goal.milestones.length}
            </span>
          </div>
          <div className="mb-3 h-1 overflow-hidden rounded-full" style={{ background: 'var(--border-medium)' }}>
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${pct}%`, background: 'var(--amber)' }}
            />
          </div>
          <ul className="space-y-1.5">
            {goal.milestones.map((m) => {
              const done = !!m.achieved
              return (
                <li key={m.id} className="flex items-center gap-2.5 text-sm">
                  <span
                    className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-sm text-[10px]"
                    style={{
                      border: done ? '1px solid rgba(34,197,94,0.4)' : '1px solid var(--border-medium)',
                      background: done ? 'rgba(34,197,94,0.15)' : 'transparent',
                      color: done ? 'var(--green)' : 'transparent',
                    }}
                  >
                    ✓
                  </span>
                  <span style={{ color: done ? 'var(--text-muted)' : 'var(--text-secondary)', textDecoration: done ? 'line-through' : 'none' }}>
                    {m.title}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="stat-label mb-0.5">{label}</p>
      <p className="text-sm text-white">{value}</p>
    </div>
  )
}

export default function MyCoachingPage() {
  const { user, login, isLoading: authLoading } = useAuth()

  const { data, isLoading } = useQuery({
    queryKey: ['my-coaching'],
    queryFn: () => coachingPlatform.me(),
    enabled: !!user,
  })

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="spinner h-8 w-8" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="content-grid py-12 md:py-16">
        <div className="eyebrow mb-4">Spieler-Akte</div>
        <h1 className="section-title mb-8">Mein Coaching</h1>
        <div
          className="rounded-sm p-12 text-center"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-dim)' }}
        >
          <p className="mb-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
            Melde dich an, um dein Coaching-Profil zu sehen.
          </p>
          <button
            onClick={login}
            className="inline-flex items-center gap-2 rounded-sm px-5 py-2.5 text-sm font-semibold text-white transition"
            style={{ background: '#5865F2' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#4752C4' }}
            onMouseLeave={e => { e.currentTarget.style.background = '#5865F2' }}
          >
            Login with Discord
          </button>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="spinner h-8 w-8" />
      </div>
    )
  }

  if (!data?.profile) {
    return (
      <div className="content-grid py-12 md:py-16">
        <div className="eyebrow mb-4">Spieler-Akte</div>
        <h1 className="section-title mb-8">Mein Coaching</h1>
        <div
          className="rounded-sm p-12 text-center"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-dim)' }}
        >
          <p className="mb-5 text-sm" style={{ color: 'var(--text-secondary)' }}>
            Du hast noch kein Coaching erhalten.
          </p>
          <Link
            to="/"
            className="inline-block rounded-sm px-5 py-2.5 text-sm font-semibold text-white transition"
            style={{ background: 'var(--amber)', color: '#060810' }}
          >
            Coaches ansehen
          </Link>
        </div>
      </div>
    )
  }

  const { profile, goals, notes, sessions } = data

  return (
    <div className="content-grid py-12 md:py-16">
      <div className="mb-8">
        <div className="eyebrow mb-4">Spieler-Akte</div>
        <h1 className="section-title">Mein Coaching</h1>
      </div>

      {/* Profil */}
      <div
        className="mb-10 rounded-sm p-6"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-soft)' }}
      >
        <div className="flex flex-wrap items-start gap-8">
          <InfoBlock
            label="Spieler"
            value={profile.display_name || profile.discord_username || 'Spieler'}
          />
          {profile.rank && <InfoBlock label="Rang" value={profile.rank} />}
          {profile.current_focus && (
            <div className="flex-1 min-w-[200px]">
              <p className="stat-label mb-0.5">Aktueller Fokus</p>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{profile.current_focus}</p>
            </div>
          )}
          <div className="ml-auto text-right">
            <p className="stat-label mb-1">Sessions</p>
            <p className="stat-value text-2xl">{sessions.length}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Ziele */}
        <section>
          <div className="mb-4 flex items-center gap-3">
            <span className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: 'var(--amber)', fontFamily: "'Rajdhani', sans-serif" }}>
              // Ziele
            </span>
            <div className="flex-1 divider" />
          </div>
          <div className="space-y-3">
            {goals.length > 0 ? (
              goals.map((g) => <GoalCard key={g.id} goal={g} />)
            ) : (
              <p
                className="rounded-sm p-6 text-center text-xs uppercase tracking-wider"
                style={{ border: '1px solid var(--border-dim)', background: 'var(--bg-card)', color: 'var(--text-muted)', fontFamily: "'Rajdhani', sans-serif" }}
              >
                Noch keine Ziele
              </p>
            )}
          </div>
        </section>

        {/* Notizen + Sessions */}
        <div className="space-y-8">
          <section>
            <div className="mb-4 flex items-center gap-3">
              <span className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: 'var(--amber)', fontFamily: "'Rajdhani', sans-serif" }}>
                // Notizen der Coaches
              </span>
              <div className="flex-1 divider" />
            </div>
            <div className="space-y-2">
              {notes.length > 0 ? (
                notes.map((n) => (
                  <div
                    key={n.id}
                    className="rounded-sm p-4"
                    style={{ background: 'var(--bg-card)', border: '1px solid var(--border-dim)' }}
                  >
                    <p className="mb-2 text-xs" style={{ color: 'var(--text-muted)' }}>{fmtDate(n.created_at)}</p>
                    <p className="whitespace-pre-wrap text-sm" style={{ color: 'var(--text-secondary)' }}>{n.content}</p>
                  </div>
                ))
              ) : (
                <p
                  className="rounded-sm p-5 text-center text-xs uppercase tracking-wider"
                  style={{ border: '1px solid var(--border-dim)', background: 'var(--bg-card)', color: 'var(--text-muted)', fontFamily: "'Rajdhani', sans-serif" }}
                >
                  Noch keine Notizen
                </p>
              )}
            </div>
          </section>

          <section>
            <div className="mb-4 flex items-center gap-3">
              <span className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: 'var(--amber)', fontFamily: "'Rajdhani', sans-serif" }}>
                // Session-Log
              </span>
              <div className="flex-1 divider" />
            </div>
            <div className="space-y-2">
              {sessions.length > 0 ? (
                sessions.map((s, i) => (
                  <div
                    key={s.id ?? i}
                    className="flex items-center justify-between rounded-sm px-4 py-3 text-sm"
                    style={{ background: 'var(--bg-card)', border: '1px solid var(--border-dim)' }}
                  >
                    <span style={{ color: 'var(--text-secondary)' }}>{s.coach_display || 'Coach'}</span>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{fmtDate(s.started_at)}</span>
                    <SessionStatusBadge status={s.status} />
                  </div>
                ))
              ) : (
                <p
                  className="rounded-sm p-5 text-center text-xs uppercase tracking-wider"
                  style={{ border: '1px solid var(--border-dim)', background: 'var(--bg-card)', color: 'var(--text-muted)', fontFamily: "'Rajdhani', sans-serif" }}
                >
                  Noch keine Sessions
                </p>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
