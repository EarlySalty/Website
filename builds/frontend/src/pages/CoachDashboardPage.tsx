import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { coachingPlatform, type PlatformQueueRequest, type CoacheeListItem } from '@/api/client'
import { useAuth } from '@/context/AuthContext'

const fmtDateTime = (ts: number) =>
  new Date(ts * 1000).toLocaleString('de-DE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

export function CoachTabs({ active }: { active: 'dashboard' | 'overview' }) {
  const tabs = [
    { to: '/coaching/dashboard', label: 'Dashboard', key: 'dashboard' },
    { to: '/coaching/overview', label: 'Übersicht', key: 'overview' },
  ]
  return (
    <nav className="mb-8 flex gap-2 rounded-full border border-white/8 bg-white/5 p-1 w-fit">
      {tabs.map((t) => (
        <Link
          key={t.key}
          to={t.to}
          className={`rounded-full px-4 py-2 text-sm font-medium transition ${
            active === t.key ? 'bg-white text-slate-950' : 'text-slate-300 hover:bg-white/8 hover:text-white'
          }`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  )
}

function QueueCard({ req }: { req: PlatformQueueRequest }) {
  const reservedForMe = req.reserved_for_me && !req.is_open
  return (
    <div className="rounded-xl border border-white/10 bg-[#0c1017] p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-white">{req.discord_username || 'Spieler'}</h3>
          <p className="text-sm text-slate-400">
            {req.rank || '—'}
            {req.subrank ? ` ${req.subrank}` : ''}
            {req.hero ? ` · ${req.hero}` : ''}
          </p>
        </div>
        {reservedForMe ? (
          <span className="flex-shrink-0 rounded-full bg-sky-400/15 px-2.5 py-1 text-xs font-medium text-sky-300">
            Für dich reserviert
          </span>
        ) : (
          <span className="flex-shrink-0 rounded-full bg-emerald-400/15 px-2.5 py-1 text-xs font-medium text-emerald-300">
            Offen
          </span>
        )}
      </div>

      {req.current_problems && (
        <p className="mt-3 text-sm text-slate-300 line-clamp-3">{req.current_problems}</p>
      )}
      {req.ai_summary && (
        <p className="mt-2 rounded-lg bg-white/5 px-3 py-2 text-xs text-slate-400">{req.ai_summary}</p>
      )}

      <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
        {reservedForMe ? (
          <span>
            {req.reserved_until ? `reserviert bis ${fmtDateTime(req.reserved_until)}` : 'für dich reserviert'}
          </span>
        ) : (
          <span>offen für alle Coaches</span>
        )}
        <span>Claim im Discord-Embed</span>
      </div>
    </div>
  )
}

function CoacheeRow({ c }: { c: CoacheeListItem }) {
  return (
    <Link
      to={`/coaching/coachees/${c.id}`}
      className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-[#0c1017] p-4 transition hover:border-accent-violet/50 hover:bg-[#0f1520]"
    >
      <div className="min-w-0">
        <p className="truncate font-medium text-white">{c.display_name || c.discord_username || 'Spieler'}</p>
        <p className="truncate text-sm text-slate-400">
          {c.rank || '—'}
          {c.current_focus ? ` · ${c.current_focus}` : ''}
        </p>
      </div>
      <div className="flex flex-shrink-0 gap-4 text-sm text-slate-400">
        <span>{c.open_goals} offene Ziele</span>
        <span>·</span>
        <span>{c.sessions} Sessions</span>
      </div>
    </Link>
  )
}

export default function CoachDashboardPage() {
  const { isCoach, isLoading: authLoading } = useAuth()
  const [search, setSearch] = useState('')

  const { data: queueData, isLoading: queueLoading } = useQuery({
    queryKey: ['coaching-queue'],
    queryFn: () => coachingPlatform.queue(),
    enabled: isCoach,
  })
  const { data: coacheeData, isLoading: coacheesLoading } = useQuery({
    queryKey: ['coaching-coachees'],
    queryFn: () => coachingPlatform.listCoachees(),
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
        <Link to="/coaching" className="mt-4 inline-block text-accent-violet hover:underline">
          ← Zu den Coaches
        </Link>
      </div>
    )
  }

  const requests = queueData?.requests ?? []
  const coachees = (coacheeData?.coachees ?? []).filter((c) => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return (
      (c.display_name || '').toLowerCase().includes(q) ||
      (c.discord_username || '').toLowerCase().includes(q)
    )
  })

  return (
    <div className="content-grid py-10 md:py-14">
      <span className="eyebrow">Coaching</span>
      <h1 className="section-title mt-4">Coach-Dashboard</h1>
      <p className="section-copy mt-2 max-w-2xl">
        Offene und für dich reservierte Anfragen sowie die Spieler, mit denen du arbeitest.
      </p>

      <div className="mt-8">
        <CoachTabs active="dashboard" />
      </div>

      {/* Queue */}
      <section>
        <h2 className="mb-4 text-xl font-semibold text-white">Anfragen-Queue</h2>
        {queueLoading ? (
          <div className="flex justify-center py-10">
            <div className="animate-spin h-7 w-7 rounded-full border-2 border-accent-violet border-t-transparent" />
          </div>
        ) : requests.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {requests.map((r) => (
              <QueueCard key={r.id} req={r} />
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-white/10 bg-[#0c1017] p-8 text-center text-sm text-slate-500">
            Aktuell keine offenen Anfragen.
          </p>
        )}
      </section>

      {/* Spieler */}
      <section className="mt-12">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-white">Spieler</h2>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Spieler suchen…"
            className="rounded-full border border-white/10 bg-[#080a10] px-4 py-2 text-sm text-white placeholder:text-slate-600 focus:border-accent-violet/50 focus:outline-none"
          />
        </div>
        {coacheesLoading ? (
          <div className="flex justify-center py-10">
            <div className="animate-spin h-7 w-7 rounded-full border-2 border-accent-violet border-t-transparent" />
          </div>
        ) : coachees.length > 0 ? (
          <div className="space-y-3">
            {coachees.map((c) => (
              <CoacheeRow key={c.id} c={c} />
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-white/10 bg-[#0c1017] p-8 text-center text-sm text-slate-500">
            {search ? 'Keine Treffer.' : 'Noch keine Spieler erfasst.'}
          </p>
        )}
      </section>
    </div>
  )
}
