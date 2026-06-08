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
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 bg-[#0c1017] px-4 py-3 text-sm">
      <div className="flex items-center gap-2">
        <span className="font-medium text-white">{s.coach_display || 'Coach'}</span>
        <span className="text-slate-500">→</span>
        {s.coachee_id ? (
          <Link to={`/coachees/${s.coachee_id}`} className="text-accent-violet hover:underline">
            {coachee}
          </Link>
        ) : (
          <span className="text-slate-300">{coachee}</span>
        )}
      </div>
      <div className="flex items-center gap-3">
        <SessionStatusBadge status={s.status} />
        <span className="text-slate-500">{fmtDate(s.started_at)}</span>
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

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin h-8 w-8 rounded-full border-2 border-accent-violet border-t-transparent" />
      </div>
    )
  }

  if (!isCoach) {
    return (
      <div className="content-grid py-10">
        <p className="text-slate-400">Dieser Bereich ist Coaches vorbehalten.</p>
        <Link to="/" className="mt-4 inline-block text-accent-violet hover:underline">
          ← Zu den Coaches
        </Link>
      </div>
    )
  }

  const coaches = data?.coaches ?? []
  const recent = data?.recent_sessions ?? []

  return (
    <div className="content-grid py-10 md:py-14">
      <span className="eyebrow">Coaching</span>
      <h1 className="section-title mt-4">Übersicht</h1>
      <p className="section-copy mt-2 max-w-2xl">
        Auslastung aller Coaches und die jüngsten Sessions — wer hat wen gecoacht.
      </p>

      <div className="mt-8">
        <CoachTabs active="overview" />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin h-8 w-8 rounded-full border-2 border-accent-violet border-t-transparent" />
        </div>
      ) : (
        <>
          {/* Coach-Auslastung */}
          <section>
            <h2 className="mb-4 text-xl font-semibold text-white">Coaches</h2>
            {coaches.length > 0 ? (
              <div className="overflow-hidden rounded-xl border border-white/10 bg-[#0c1017]">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-white/10 text-xs uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-medium">Coach</th>
                      <th className="px-4 py-3 text-right font-medium">Aktiv</th>
                      <th className="px-4 py-3 text-right font-medium">Abgeschlossen</th>
                      <th className="px-4 py-3 text-right font-medium">Gesamt</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {coaches.map((c) => (
                      <tr key={c.id} className="transition hover:bg-white/5">
                        <td className="px-4 py-3">
                          <span className="font-medium text-white">{c.display_name || c.discord_username || 'Coach'}</span>
                        </td>
                        <td className="px-4 py-3 text-right text-sky-300">{c.active}</td>
                        <td className="px-4 py-3 text-right text-emerald-300">{c.completed}</td>
                        <td className="px-4 py-3 text-right text-slate-300">{c.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="rounded-xl border border-white/10 bg-[#0c1017] p-8 text-center text-sm text-slate-500">
                Noch keine Coaches mit Sessions.
              </p>
            )}
          </section>

          {/* Jüngste Sessions */}
          <section className="mt-12">
            <h2 className="mb-4 text-xl font-semibold text-white">Jüngste Sessions</h2>
            {recent.length > 0 ? (
              <div className="space-y-2">
                {recent.map((s) => (
                  <SessionRow key={s.id} s={s} />
                ))}
              </div>
            ) : (
              <p className="rounded-xl border border-white/10 bg-[#0c1017] p-8 text-center text-sm text-slate-500">
                Noch keine Sessions.
              </p>
            )}
          </section>
        </>
      )}
    </div>
  )
}
