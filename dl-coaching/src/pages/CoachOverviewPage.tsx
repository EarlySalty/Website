import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { coachingPlatform, type PlatformRecentSession } from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import { CoachTabs } from './CoachDashboardPage'
import SessionStatusBadge from '@/components/SessionStatusBadge'

const fmtDate = (s: string | null) =>
  s ? new Date(s).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

function SessionRow({ s }: { s: PlatformRecentSession }) {
  const coachee = s.coachee_display || s.discord_username || 'Spieler'
  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3 rounded-sm px-4 py-3 text-sm"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-dim)' }}
    >
      <div className="flex items-center gap-2">
        <span className="font-semibold text-white" style={{ fontFamily: "'Rajdhani', sans-serif" }}>
          {s.coach_display || 'Coach'}
        </span>
        <span style={{ color: 'var(--text-muted)' }}>→</span>
        {s.coachee_id ? (
          <Link to={`/coachees/${s.coachee_id}`} style={{ color: 'var(--amber)' }}>
            {coachee}
          </Link>
        ) : (
          <span style={{ color: 'var(--text-secondary)' }}>{coachee}</span>
        )}
      </div>
      <div className="flex items-center gap-3">
        <SessionStatusBadge status={s.status} />
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{fmtDate(s.started_at)}</span>
      </div>
    </div>
  )
}

function SectionHead({ label }: { label: string }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <span
        className="text-xs font-semibold uppercase tracking-[0.2em]"
        style={{ color: 'var(--amber)', fontFamily: "'Rajdhani', sans-serif" }}
      >
        // {label}
      </span>
      <div className="flex-1 divider" />
    </div>
  )
}

export default function CoachOverviewPage() {
  const { isCoach, isLoading: authLoading } = useAuth()
  const { data, isLoading } = useQuery({
    queryKey: ['coaching-overview'],
    queryFn: () => coachingPlatform.overview(),
    enabled: isCoach,
  })

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="spinner h-8 w-8" />
      </div>
    )
  }

  if (!isCoach) {
    return (
      <div className="content-grid py-12">
        <p style={{ color: 'var(--text-muted)' }}>Dieser Bereich ist Coaches vorbehalten.</p>
        <Link to="/" className="mt-4 inline-block text-sm" style={{ color: 'var(--amber)' }}>
          ← Zu den Coaches
        </Link>
      </div>
    )
  }

  const coaches = data?.coaches ?? []
  const recent = data?.recent_sessions ?? []

  return (
    <div className="content-grid py-12 md:py-16">
      <div className="mb-8">
        <div className="eyebrow mb-4">Coach Terminal</div>
        <h1 className="section-title">Übersicht</h1>
        <p className="section-copy mt-2">Auslastung aller Coaches und aktuelle Sessions.</p>
      </div>

      <CoachTabs active="overview" />

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="spinner h-8 w-8" />
        </div>
      ) : (
        <>
          {/* Coach-Tabelle */}
          <section className="mb-10">
            <SectionHead label="Coaches" />
            {coaches.length > 0 ? (
              <div
                className="overflow-hidden rounded-sm"
                style={{ border: '1px solid var(--border-dim)', background: 'var(--bg-card)' }}
              >
                <table className="w-full text-left text-sm">
                  <thead style={{ borderBottom: '1px solid var(--border-dim)' }}>
                    <tr>
                      {['Coach', 'Aktiv', 'Abgeschlossen', 'Gesamt'].map((h, i) => (
                        <th
                          key={h}
                          className={`px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] ${i > 0 ? 'text-right' : ''}`}
                          style={{ color: 'var(--text-muted)', fontFamily: "'Rajdhani', sans-serif" }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {coaches.map((c, i) => (
                      <tr
                        key={c.id}
                        style={{ borderTop: i > 0 ? '1px solid var(--border-dim)' : undefined }}
                      >
                        <td className="px-4 py-3 font-semibold text-white" style={{ fontFamily: "'Rajdhani', sans-serif" }}>
                          {c.display_name || c.discord_username || 'Coach'}
                        </td>
                        <td className="px-4 py-3 text-right font-bold" style={{ color: 'var(--sky)', fontFamily: "'Rajdhani', sans-serif" }}>
                          {c.active}
                        </td>
                        <td className="px-4 py-3 text-right font-bold" style={{ color: 'var(--green)', fontFamily: "'Rajdhani', sans-serif" }}>
                          {c.completed}
                        </td>
                        <td className="px-4 py-3 text-right font-bold" style={{ color: 'var(--amber)', fontFamily: "'Rajdhani', sans-serif" }}>
                          {c.total}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p
                className="rounded-sm p-8 text-center text-xs uppercase tracking-wider"
                style={{ border: '1px solid var(--border-dim)', background: 'var(--bg-card)', color: 'var(--text-muted)', fontFamily: "'Rajdhani', sans-serif" }}
              >
                Noch keine Coaches mit Sessions
              </p>
            )}
          </section>

          {/* Jüngste Sessions */}
          <section>
            <SectionHead label="Jüngste Sessions" />
            {recent.length > 0 ? (
              <div className="space-y-2">
                {recent.map((s) => (
                  <SessionRow key={s.id} s={s} />
                ))}
              </div>
            ) : (
              <p
                className="rounded-sm p-8 text-center text-xs uppercase tracking-wider"
                style={{ border: '1px solid var(--border-dim)', background: 'var(--bg-card)', color: 'var(--text-muted)', fontFamily: "'Rajdhani', sans-serif" }}
              >
                Noch keine Sessions
              </p>
            )}
          </section>
        </>
      )}
    </div>
  )
}
