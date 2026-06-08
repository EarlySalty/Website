import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { coachingPlatform, type PlatformQueueRequest, type CoacheeListItem } from '@/api/client'
import { useAuth } from '@/context/AuthContext'

const fmtDateTime = (ts: number) =>
  new Date(ts * 1000).toLocaleString('de-DE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

export function CoachTabs({ active }: { active: 'dashboard' | 'overview' }) {
  const tabs = [
    { to: '/dashboard', label: 'Queue', key: 'dashboard' },
    { to: '/overview', label: 'Übersicht', key: 'overview' },
  ] as const
  return (
    <div className="mb-8 flex gap-px">
      {tabs.map((t) => (
        <Link
          key={t.key}
          to={t.to}
          className="px-5 py-2 text-sm font-semibold uppercase tracking-[0.1em] transition"
          style={{
            fontFamily: "'Rajdhani', sans-serif",
            background: active === t.key ? 'var(--amber-glow)' : 'var(--bg-card)',
            color: active === t.key ? 'var(--amber)' : 'var(--text-muted)',
            borderBottom: active === t.key ? '2px solid var(--amber)' : '2px solid transparent',
          }}
        >
          {t.label}
        </Link>
      ))}
    </div>
  )
}

function SectionHead({ label, count }: { label: string; count?: number }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <span
        className="text-xs font-semibold uppercase tracking-[0.2em]"
        style={{ color: 'var(--amber)', fontFamily: "'Rajdhani', sans-serif" }}
      >
        // {label}
      </span>
      {count !== undefined && (
        <span
          className="rounded-sm px-2 py-0.5 text-xs font-bold"
          style={{ background: 'var(--amber-glow)', color: 'var(--amber)', fontFamily: "'Rajdhani', sans-serif" }}
        >
          {count}
        </span>
      )}
      <div className="flex-1 divider" />
    </div>
  )
}

function QueueCard({ req }: { req: PlatformQueueRequest }) {
  const reservedForMe = req.reserved_for_me && !req.is_open
  return (
    <div
      className="relative overflow-hidden rounded-sm p-5 transition"
      style={{
        background: 'var(--bg-card)',
        border: `1px solid ${reservedForMe ? 'rgba(56, 189, 248, 0.22)' : 'var(--border-dim)'}`,
      }}
    >
      {/* Status strip */}
      <div
        className="absolute left-0 top-0 bottom-0 w-[3px]"
        style={{ background: reservedForMe ? 'var(--sky)' : 'var(--green)' }}
      />

      <div className="flex items-start justify-between gap-3 pl-1">
        <div className="min-w-0">
          <h3
            className="font-bold text-white"
            style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '15px', letterSpacing: '0.04em' }}
          >
            {req.discord_username || 'Spieler'}
          </h3>
          <p className="mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
            {req.rank || '—'}
            {req.subrank ? ` ${req.subrank}` : ''}
            {req.hero ? ` · ${req.hero}` : ''}
          </p>
        </div>
        <span className={`badge flex-shrink-0 ${reservedForMe ? 'badge-reserved' : 'badge-open'}`}>
          {reservedForMe ? 'Reserviert' : 'Offen'}
        </span>
      </div>

      {req.current_problems && (
        <p className="mt-3 line-clamp-3 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          {req.current_problems}
        </p>
      )}

      {req.ai_summary && (
        <div
          className="mt-3 rounded-sm px-3 py-2 text-xs"
          style={{ background: 'var(--bg-surface)', color: 'var(--text-muted)', border: '1px solid var(--border-dim)' }}
        >
          <span className="mr-1 font-semibold uppercase tracking-wide" style={{ color: 'var(--violet)', fontFamily: "'Rajdhani', sans-serif" }}>
            AI
          </span>
          {req.ai_summary}
        </div>
      )}

      <p className="mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>
        {reservedForMe && req.reserved_until
          ? `Reserviert bis ${fmtDateTime(req.reserved_until)}`
          : 'Claim im Discord-Embed'}
      </p>
    </div>
  )
}

function CoacheeRow({ c }: { c: CoacheeListItem }) {
  return (
    <Link
      to={`/coachees/${c.id}`}
      className="flex items-center justify-between gap-4 rounded-sm px-4 py-3 transition"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-dim)',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = 'var(--amber-border)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'var(--border-dim)'
      }}
    >
      <div className="min-w-0 flex-1">
        <p
          className="truncate font-bold text-white"
          style={{ fontFamily: "'Rajdhani', sans-serif", letterSpacing: '0.04em' }}
        >
          {c.display_name || c.discord_username || 'Spieler'}
        </p>
        <p className="truncate text-xs" style={{ color: 'var(--text-muted)' }}>
          {c.rank || '—'}
          {c.current_focus ? ` · ${c.current_focus}` : ''}
        </p>
      </div>
      <div className="flex flex-shrink-0 items-center gap-5 text-xs" style={{ color: 'var(--text-muted)' }}>
        <span>
          <span style={{ color: c.open_goals > 0 ? 'var(--amber)' : 'var(--text-secondary)', fontFamily: "'Rajdhani', sans-serif", fontWeight: 700 }}>
            {c.open_goals}
          </span>{' '}
          Ziele
        </span>
        <span>
          <span style={{ color: 'var(--text-secondary)', fontFamily: "'Rajdhani', sans-serif", fontWeight: 700 }}>
            {c.sessions}
          </span>{' '}
          Sessions
        </span>
        <svg className="h-4 w-4 flex-shrink-0" viewBox="0 0 16 16" fill="none" style={{ color: 'var(--text-muted)' }}>
          <path d="M6 12l4-4-4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
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
    <div className="content-grid py-12 md:py-16">
      <div className="mb-8">
        <div className="eyebrow mb-4">Coach Terminal</div>
        <h1 className="section-title">Dashboard</h1>
        <p className="section-copy mt-2">Offene Anfragen und deine Spieler.</p>
      </div>

      <CoachTabs active="dashboard" />

      {/* Queue */}
      <section className="mb-12">
        <SectionHead label="Anfragen-Queue" count={queueLoading ? undefined : requests.length} />
        {queueLoading ? (
          <div className="flex justify-center py-12">
            <div className="spinner h-7 w-7" />
          </div>
        ) : requests.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {requests.map((r) => (
              <QueueCard key={r.id} req={r} />
            ))}
          </div>
        ) : (
          <p
            className="rounded-sm p-8 text-center text-xs uppercase tracking-wider"
            style={{
              border: '1px solid var(--border-dim)',
              background: 'var(--bg-card)',
              color: 'var(--text-muted)',
              fontFamily: "'Rajdhani', sans-serif",
            }}
          >
            Keine offenen Anfragen
          </p>
        )}
      </section>

      {/* Spieler */}
      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <SectionHead label="Spieler" count={coacheesLoading ? undefined : coachees.length} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Suchen…"
            className="input-field w-52"
          />
        </div>
        {coacheesLoading ? (
          <div className="flex justify-center py-12">
            <div className="spinner h-7 w-7" />
          </div>
        ) : coachees.length > 0 ? (
          <div className="space-y-2">
            {coachees.map((c) => (
              <CoacheeRow key={c.id} c={c} />
            ))}
          </div>
        ) : (
          <p
            className="rounded-sm p-8 text-center text-xs uppercase tracking-wider"
            style={{
              border: '1px solid var(--border-dim)',
              background: 'var(--bg-card)',
              color: 'var(--text-muted)',
              fontFamily: "'Rajdhani', sans-serif",
            }}
          >
            {search ? 'Keine Treffer' : 'Noch keine Spieler erfasst'}
          </p>
        )}
      </section>
    </div>
  )
}
