import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { coachingPlatform, type PlatformRecentSession } from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import { CoachTabs } from './CoachDashboardPage'
import SessionStatusBadge from '@/components/SessionStatusBadge'
import { CoachOnly, EmptyState, PageSpinner, SectionHead } from '@/components/ui'
import { fmtDate } from '@/lib/format'

function SessionRow({ s }: { s: PlatformRecentSession }) {
  const coachee = s.coachee_display || s.discord_username || 'Spieler'
  return (
    <div className="card flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
      <div className="flex items-center gap-2">
        <span className="font-display font-bold uppercase tracking-[0.04em] text-white">
          {s.coach_display || 'Coach'}
        </span>
        <span style={{ color: 'var(--text-muted)' }}>→</span>
        {s.coachee_id ? (
          <Link to={`/coachees/${s.coachee_id}`} className="transition hover:opacity-80" style={{ color: 'var(--amber)' }}>
            {coachee}
          </Link>
        ) : (
          <span style={{ color: 'var(--text-secondary)' }}>{coachee}</span>
        )}
      </div>
      <div className="flex items-center gap-3">
        <SessionStatusBadge status={s.status} />
        <span className="font-mono-data text-[10px]" style={{ color: 'var(--text-muted)' }}>{fmtDate(s.started_at)}</span>
      </div>
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

  if (authLoading) return <PageSpinner />
  if (!isCoach) return <CoachOnly />

  const coaches = data?.coaches ?? []
  const recent = data?.recent_sessions ?? []
  const maxTotal = Math.max(1, ...coaches.map((c) => c.total))

  return (
    <div className="content-grid pb-16 pt-10 md:pt-14">
      <div className="animate-in-left mb-8">
        <div className="eyebrow mb-4">Coach-Bereich</div>
        <h1 className="section-title">Übersicht</h1>
        <p className="section-copy mt-2">Auslastung aller Coaches und die jüngsten Sessions.</p>
      </div>

      <CoachTabs active="overview" />

      {isLoading ? (
        <PageSpinner />
      ) : (
        <>
          {/* ── Coach-Auslastung ── */}
          <section className="mb-12">
            <SectionHead label="Coaches" count={coaches.length} />
            {coaches.length > 0 ? (
              <div className="card overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead style={{ borderBottom: '1px solid var(--border-soft)', background: 'var(--bg-surface)' }}>
                    <tr>
                      {['Coach', 'Auslastung', 'Aktiv', 'Abgeschlossen', 'Gesamt'].map((h, i) => (
                        <th
                          key={h}
                          className={`font-mono-data px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.18em] ${i > 1 ? 'text-right' : ''} ${i === 1 ? 'w-[30%]' : ''}`}
                          style={{ color: 'var(--text-muted)' }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {coaches.map((c, i) => (
                      <tr key={c.id} style={{ borderTop: i > 0 ? '1px solid var(--border-dim)' : undefined }}>
                        <td className="font-display px-4 py-3 font-bold uppercase tracking-[0.04em] text-white">
                          {c.display_name || c.discord_username || 'Coach'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="h-1.5 overflow-hidden rounded-full" style={{ background: 'var(--border-dim)' }}>
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${Math.round((c.total / maxTotal) * 100)}%`,
                                background: 'linear-gradient(90deg, var(--amber-deep), var(--amber-light))',
                              }}
                            />
                          </div>
                        </td>
                        <td className="font-mono-data px-4 py-3 text-right font-bold" style={{ color: 'var(--sky)' }}>{c.active}</td>
                        <td className="font-mono-data px-4 py-3 text-right font-bold" style={{ color: 'var(--green)' }}>{c.completed}</td>
                        <td className="font-mono-data px-4 py-3 text-right font-bold" style={{ color: 'var(--amber)' }}>{c.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState title="Noch keine Daten" copy="Sobald Coaches Sessions übernehmen, erscheint hier die Auslastung." />
            )}
          </section>

          {/* ── Jüngste Sessions ── */}
          <section>
            <SectionHead label="Jüngste Sessions" count={recent.length} />
            {recent.length > 0 ? (
              <div className="space-y-2">
                {recent.map((s) => <SessionRow key={s.id} s={s} />)}
              </div>
            ) : (
              <EmptyState title="Noch keine Sessions" copy="Abgeschlossene und laufende Sessions aller Coaches laufen hier zusammen." />
            )}
          </section>
        </>
      )}
    </div>
  )
}
