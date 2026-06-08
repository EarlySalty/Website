import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { coachingPlatform, type Goal } from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import SessionStatusBadge from '@/components/SessionStatusBadge'

const fmtDate = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

const GOAL_STATUS: Record<string, { label: string; cls: string }> = {
  open: { label: 'Offen', cls: 'bg-slate-500/15 text-slate-300' },
  active: { label: 'Aktiv', cls: 'bg-sky-400/15 text-sky-300' },
  done: { label: 'Erreicht', cls: 'bg-emerald-400/15 text-emerald-300' },
  dropped: { label: 'Verworfen', cls: 'bg-rose-400/15 text-rose-300' },
}

function GoalCard({ goal }: { goal: Goal }) {
  const status = GOAL_STATUS[goal.status] ?? GOAL_STATUS.open
  const reached = goal.milestones.filter((m) => m.achieved).length
  return (
    <div className="rounded-xl border border-white/10 bg-[#0c1017] p-5">
      <div className="flex items-center gap-2">
        <h4 className="font-semibold text-white">{goal.title}</h4>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${status.cls}`}>{status.label}</span>
      </div>
      {goal.description && <p className="mt-1 text-sm text-slate-400">{goal.description}</p>}
      {goal.target_date && <p className="mt-1 text-xs text-slate-500">Ziel bis {fmtDate(goal.target_date)}</p>}

      {goal.milestones.length > 0 && (
        <div className="mt-4 border-t border-white/5 pt-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-500">Meilensteine</span>
            <span className="text-xs text-slate-500">
              {reached}/{goal.milestones.length}
            </span>
          </div>
          <ul className="mt-1 space-y-1.5">
            {goal.milestones.map((m) => {
              const done = !!m.achieved
              return (
                <li key={m.id} className="flex items-center gap-3 text-sm">
                  <span
                    className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border text-xs ${
                      done ? 'border-emerald-400/50 bg-emerald-400/20 text-emerald-300' : 'border-white/20 text-transparent'
                    }`}
                  >
                    ✓
                  </span>
                  <span className={done ? 'text-slate-500 line-through' : 'text-slate-200'}>{m.title}</span>
                </li>
              )
            })}
          </ul>
        </div>
      )}
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
        <div className="animate-spin h-8 w-8 rounded-full border-2 border-accent-violet border-t-transparent" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="content-grid py-10 md:py-14">
        <span className="eyebrow">Coaching</span>
        <h1 className="section-title mt-4">Mein Coaching</h1>
        <div className="mt-8 rounded-xl border border-white/10 bg-[#0c1017] p-10 text-center">
          <p className="text-slate-400">Melde dich an, um dein Coaching-Profil zu sehen.</p>
          <button
            onClick={login}
            className="mt-4 rounded-full bg-[#5865F2] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#4752C4]"
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
        <div className="animate-spin h-8 w-8 rounded-full border-2 border-accent-violet border-t-transparent" />
      </div>
    )
  }

  if (!data?.profile) {
    return (
      <div className="content-grid py-10 md:py-14">
        <span className="eyebrow">Coaching</span>
        <h1 className="section-title mt-4">Mein Coaching</h1>
        <div className="mt-8 rounded-xl border border-white/10 bg-[#0c1017] p-10 text-center">
          <p className="text-slate-400">Du hast noch kein Coaching erhalten.</p>
          <Link
            to="/coaching"
            className="mt-4 inline-block rounded-lg bg-accent-violet px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-violet/80"
          >
            Coaches ansehen
          </Link>
        </div>
      </div>
    )
  }

  const { profile, goals, notes, sessions } = data

  return (
    <div className="content-grid py-10 md:py-14">
      <span className="eyebrow">Coaching</span>
      <h1 className="section-title mt-4">Mein Coaching</h1>

      {/* Profil */}
      <div className="mt-8 rounded-xl border border-white/10 bg-[#0c1017] p-6">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <p className="text-lg font-semibold text-white">{profile.display_name || profile.discord_username || 'Spieler'}</p>
            <p className="text-sm text-slate-400">Rang: {profile.rank || '—'}</p>
          </div>
        </div>
        {profile.current_focus && (
          <div className="mt-4 border-t border-white/10 pt-4">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-500">Aktueller Fokus</span>
            <p className="mt-1 text-sm text-slate-200">{profile.current_focus}</p>
          </div>
        )}
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        {/* Ziele */}
        <section>
          <h2 className="mb-4 text-xl font-semibold text-white">Deine Ziele</h2>
          <div className="space-y-4">
            {goals.length > 0 ? (
              goals.map((g) => <GoalCard key={g.id} goal={g} />)
            ) : (
              <p className="rounded-xl border border-white/10 bg-[#0c1017] p-6 text-center text-sm text-slate-500">
                Noch keine Ziele festgelegt.
              </p>
            )}
          </div>
        </section>

        {/* Notizen + Sessions */}
        <section>
          <h2 className="mb-4 text-xl font-semibold text-white">Notizen deiner Coaches</h2>
          <div className="space-y-3">
            {notes.length > 0 ? (
              notes.map((n) => (
                <div key={n.id} className="rounded-lg border border-white/10 bg-[#0c1017] p-4">
                  <span className="text-xs text-slate-500">{fmtDate(n.created_at)}</span>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-slate-200">{n.content}</p>
                </div>
              ))
            ) : (
              <p className="rounded-xl border border-white/10 bg-[#0c1017] p-6 text-center text-sm text-slate-500">
                Noch keine geteilten Notizen.
              </p>
            )}
          </div>

          <h2 className="mb-4 mt-8 text-xl font-semibold text-white">Sessions</h2>
          <div className="space-y-2">
            {sessions.length > 0 ? (
              sessions.map((s, i) => (
                <div
                  key={s.id ?? i}
                  className="flex items-center justify-between rounded-lg border border-white/10 bg-[#0c1017] px-4 py-3 text-sm"
                >
                  <span className="text-slate-300">{s.coach_display || 'Coach'}</span>
                  <span className="text-slate-500">{fmtDate(s.started_at)}</span>
                  <SessionStatusBadge status={s.status} />
                </div>
              ))
            ) : (
              <p className="rounded-xl border border-white/10 bg-[#0c1017] p-6 text-center text-sm text-slate-500">
                Noch keine Sessions.
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
