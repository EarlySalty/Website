import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { coachingPlatform, type Appointment, type Goal, type PlatformSession, type SessionNote } from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import SessionStatusBadge from '@/components/SessionStatusBadge'
import { EmptyState, PageSpinner, SectionHead } from '@/components/ui'
import { fmtDate, fmtDateTime, parseUtc } from '@/lib/format'

const GOAL_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  open:    { label: 'Offen',     color: 'var(--text-secondary)', bg: 'var(--bg-raised)' },
  active:  { label: 'Aktiv',     color: 'var(--sky)',            bg: 'rgba(69,196,245,0.10)' },
  done:    { label: 'Erreicht',  color: 'var(--green)',          bg: 'rgba(52,210,123,0.10)' },
  dropped: { label: 'Verworfen', color: 'var(--red)',            bg: 'rgba(242,92,92,0.10)' },
}

function GoalCard({ goal }: { goal: Goal }) {
  const s = GOAL_STATUS[goal.status] ?? GOAL_STATUS.open
  const reached = goal.milestones.filter((m) => m.achieved).length
  const pct = goal.milestones.length > 0 ? Math.round((reached / goal.milestones.length) * 100) : 0

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-2">
        <h4 className="font-display text-[15px] font-bold uppercase tracking-[0.04em] text-white">{goal.title}</h4>
        <span
          className="font-display flex-shrink-0 rounded-sm px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
          style={{ color: s.color, background: s.bg }}
        >
          {s.label}
        </span>
      </div>

      {goal.description && (
        <p className="mt-1.5 text-sm" style={{ color: 'var(--text-secondary)' }}>{goal.description}</p>
      )}
      {goal.target_date && (
        <p className="font-mono-data mt-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>
          Ziel bis {fmtDate(goal.target_date)}
        </p>
      )}

      {goal.milestones.length > 0 && (
        <div className="mt-4 border-t pt-3" style={{ borderColor: 'var(--border-dim)' }}>
          <div className="mb-2 flex items-center justify-between">
            <span className="stat-label">Meilensteine</span>
            <span className="font-mono-data text-xs font-bold" style={{ color: 'var(--amber)' }}>
              {reached}/{goal.milestones.length}
            </span>
          </div>
          <div className="mb-3 h-1 overflow-hidden rounded-full" style={{ background: 'var(--border-medium)' }}>
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${pct}%`, background: 'linear-gradient(90deg, var(--amber-deep), var(--amber-light))' }}
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
                      border: done ? '1px solid rgba(52,210,123,0.4)' : '1px solid var(--border-medium)',
                      background: done ? 'rgba(52,210,123,0.15)' : 'transparent',
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

/* ── Akte: Termine, Sessions und geteilte Protokolle als eine Timeline ── */
type TimelineEntry =
  | { kind: 'appointment'; date: Date; appt: Appointment }
  | { kind: 'session'; date: Date; session: PlatformSession }
  | { kind: 'note'; date: Date; note: SessionNote }

function buildTimeline(appointments: Appointment[], sessions: PlatformSession[], notes: SessionNote[]): TimelineEntry[] {
  const entries: TimelineEntry[] = []
  for (const a of appointments) {
    const d = parseUtc(a.scheduled_at)
    if (d) entries.push({ kind: 'appointment', date: d, appt: a })
  }
  for (const s of sessions) {
    const d = parseUtc(s.started_at)
    if (d) entries.push({ kind: 'session', date: d, session: s })
  }
  for (const n of notes) {
    const d = parseUtc(n.created_at)
    if (d) entries.push({ kind: 'note', date: d, note: n })
  }
  // Neuestes zuerst — anstehende Termine stehen dadurch automatisch oben
  return entries.sort((a, b) => b.date.getTime() - a.date.getTime())
}

function TimelineNode({ entry, nowMs }: { entry: TimelineEntry; nowMs: number }) {
  if (entry.kind === 'appointment') {
    const a = entry.appt
    const upcoming = a.status === 'scheduled' && entry.date.getTime() > nowMs - 30 * 60 * 1000
    const nodeClass = a.status === 'cancelled' ? 'node-red' : upcoming ? 'node-amber' : 'node-green'
    return (
      <div className={`timeline-node ${nodeClass}`}>
        <div className="card p-4" style={upcoming ? { borderColor: 'var(--amber-border)', boxShadow: 'var(--shadow-glow-amber)' } : undefined}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono-data text-sm font-bold" style={{ color: upcoming ? 'var(--amber)' : 'var(--text-secondary)' }}>
              {fmtDateTime(a.scheduled_at)}
            </span>
            <span className="font-mono-data text-[10px]" style={{ color: 'var(--text-muted)' }}>{a.duration_minutes} Min.</span>
            <span className="flex-1" />
            <SessionStatusBadge status={a.status} />
          </div>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
            {upcoming ? 'Coaching-Termin' : a.status === 'cancelled' ? 'Abgesagter Termin' : 'Termin'}
            {a.coach_display ? <> mit <span className="font-semibold text-white">{a.coach_display}</span></> : null}
            {a.title ? <> — {a.title}</> : null}
          </p>
          {a.note && <p className="mt-1 whitespace-pre-wrap text-xs" style={{ color: 'var(--text-muted)' }}>{a.note}</p>}
        </div>
      </div>
    )
  }
  if (entry.kind === 'session') {
    const s = entry.session
    return (
      <div className="timeline-node node-green">
        <div className="card flex flex-wrap items-center gap-3 p-4">
          <span className="font-mono-data text-sm" style={{ color: 'var(--text-secondary)' }}>{fmtDate(s.started_at)}</span>
          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Session mit <span className="font-semibold text-white">{s.coach_display || 'Coach'}</span>
          </span>
          <span className="flex-1" />
          <SessionStatusBadge status={s.status} />
        </div>
      </div>
    )
  }
  const n = entry.note
  return (
    <div className="timeline-node">
      <div className="card p-4">
        <div className="flex items-center gap-2">
          <span className="font-mono-data text-[10px]" style={{ color: 'var(--text-muted)' }}>{fmtDate(n.created_at)}</span>
          <span className="badge badge-amber !text-[9px]">Protokoll</span>
        </div>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{n.content}</p>
      </div>
    </div>
  )
}

export default function MyCoachingPage() {
  const { user, login, isLoading: authLoading } = useAuth()
  const [nowMs] = useState(() => Date.now())

  const { data, isLoading } = useQuery({
    queryKey: ['my-coaching'],
    queryFn: () => coachingPlatform.me(),
    enabled: !!user,
  })

  if (authLoading) return <PageSpinner />

  if (!user) {
    return (
      <div className="content-grid pb-16 pt-10 md:pt-14">
        <div className="eyebrow mb-4">Spieler-Akte</div>
        <h1 className="section-title mb-8">Mein Coaching</h1>
        <EmptyState
          title="Anmeldung nötig"
          copy="Melde dich mit Discord an, um deine Termine, Ziele und Session-Protokolle zu sehen."
        >
          <button
            onClick={login}
            className="inline-flex items-center gap-2 rounded-sm px-5 py-2.5 text-sm font-semibold text-white transition"
            style={{ background: '#5865F2' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#4752C4' }}
            onMouseLeave={e => { e.currentTarget.style.background = '#5865F2' }}
          >
            Login mit Discord
          </button>
        </EmptyState>
      </div>
    )
  }

  if (isLoading) return <PageSpinner />

  if (!data?.profile) {
    return (
      <div className="content-grid pb-16 pt-10 md:pt-14">
        <div className="eyebrow mb-4">Spieler-Akte</div>
        <h1 className="section-title mb-8">Mein Coaching</h1>
        <EmptyState
          title="Noch keine Akte"
          copy="Du hast bisher kein Coaching erhalten. Stell eine Anfrage auf der Website — sobald ein Coach übernimmt, entsteht hier deine Akte mit Terminen, Zielen und Protokollen."
        >
          <Link to="/anfrage" className="btn-amber">Coaching anfragen</Link>
        </EmptyState>
      </div>
    )
  }

  const { profile, goals, notes, sessions } = data
  const appointments = data.appointments ?? []
  const nextAppt = appointments
    .filter((a) => a.status === 'scheduled')
    .map((a) => ({ a, d: parseUtc(a.scheduled_at) }))
    .filter((x): x is { a: Appointment; d: Date } => !!x.d && x.d.getTime() > nowMs - 30 * 60 * 1000)
    .sort((x, y) => x.d.getTime() - y.d.getTime())[0]?.a

  const timeline = buildTimeline(appointments, sessions, notes)

  return (
    <div className="content-grid pb-16 pt-10 md:pt-14">
      <div className="animate-in-left mb-8">
        <div className="eyebrow mb-4">Spieler-Akte</div>
        <h1 className="section-title">Mein Coaching</h1>
      </div>

      {/* ── Nächster Termin als Banner ── */}
      {nextAppt && (
        <div
          className="panel-strong animate-in relative mb-8 overflow-hidden p-6"
          style={{ borderColor: 'var(--amber-border)' }}
        >
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: 'radial-gradient(ellipse 50% 100% at 0% 50%, rgba(232,149,58,0.10), transparent 70%)' }}
          />
          <div className="relative flex flex-wrap items-center gap-x-8 gap-y-3">
            <div>
              <p className="stat-label mb-1">Nächstes Coaching</p>
              <p className="font-display text-2xl font-bold" style={{ color: 'var(--amber)' }}>
                {fmtDateTime(nextAppt.scheduled_at)}
              </p>
            </div>
            <div>
              <p className="stat-label mb-1">Coach</p>
              <p className="font-display text-lg font-bold uppercase text-white">{nextAppt.coach_display || '—'}</p>
            </div>
            <div>
              <p className="stat-label mb-1">Dauer</p>
              <p className="font-mono-data text-lg font-bold" style={{ color: 'var(--text-secondary)' }}>
                {nextAppt.duration_minutes} Min.
              </p>
            </div>
            {nextAppt.title && (
              <div className="min-w-[160px] flex-1">
                <p className="stat-label mb-1">Thema</p>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{nextAppt.title}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Profil-Strip ── */}
      <div className="panel animate-in mb-10 p-6" style={{ animationDelay: '80ms' }}>
        <div className="flex flex-wrap items-start gap-10">
          <div>
            <p className="stat-label mb-0.5">Spieler</p>
            <p className="font-display text-lg font-bold uppercase text-white">
              {profile.display_name || profile.discord_username || 'Spieler'}
            </p>
          </div>
          {profile.rank && (
            <div>
              <p className="stat-label mb-0.5">Rang</p>
              <p className="font-display text-lg font-bold text-white">{profile.rank}</p>
            </div>
          )}
          {profile.current_focus && (
            <div className="min-w-[200px] flex-1">
              <p className="stat-label mb-0.5">Aktueller Fokus</p>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{profile.current_focus}</p>
            </div>
          )}
          <div className="ml-auto text-right">
            <p className="stat-label mb-0.5">Sessions</p>
            <p className="stat-value text-2xl">{sessions.length}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-10 lg:grid-cols-2">
        {/* Ziele */}
        <section className="animate-in" style={{ animationDelay: '140ms' }}>
          <SectionHead label="Meine Ziele" count={goals.length} />
          <div className="space-y-3">
            {goals.length > 0 ? (
              goals.map((g) => <GoalCard key={g.id} goal={g} />)
            ) : (
              <EmptyState
                title="Noch keine Ziele"
                copy="Dein Coach legt mit dir Trainingsziele samt Meilensteinen fest — den Fortschritt siehst du dann hier."
              />
            )}
          </div>
        </section>

        {/* Akte / Timeline */}
        <section className="animate-in" style={{ animationDelay: '200ms' }}>
          <SectionHead label="Deine Akte" count={timeline.length} />
          {timeline.length > 0 ? (
            <div className="timeline">
              {timeline.map((entry, i) => (
                <TimelineNode key={i} entry={entry} nowMs={nowMs} />
              ))}
            </div>
          ) : (
            <EmptyState
              title="Akte ist leer"
              copy="Termine, Sessions und geteilte Protokolle deiner Coaches erscheinen hier als Verlauf."
            />
          )}
        </section>
      </div>
    </div>
  )
}
