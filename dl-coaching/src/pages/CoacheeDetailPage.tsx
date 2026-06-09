import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, Link } from 'react-router-dom'
import { coachingPlatform, type Appointment, type Goal, type Milestone, type SessionNote } from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import SessionStatusBadge from '@/components/SessionStatusBadge'
import { CoachOnly, EmptyState, PageSpinner, SectionHead } from '@/components/ui'
import { fmtDate, fmtDateTime, isUpcoming, localInputToIso } from '@/lib/format'

const GOAL_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  open:    { label: 'Offen',     color: 'var(--text-secondary)', bg: 'var(--bg-raised)' },
  active:  { label: 'Aktiv',     color: 'var(--sky)',            bg: 'rgba(69,196,245,0.10)' },
  done:    { label: 'Erreicht',  color: 'var(--green)',          bg: 'rgba(52,210,123,0.10)' },
  dropped: { label: 'Verworfen', color: 'var(--red)',            bg: 'rgba(242,92,92,0.10)' },
}

function MilestoneRow({ milestone, coacheeId }: { milestone: Milestone; coacheeId: string }) {
  const qc = useQueryClient()
  const invalidate = () => qc.invalidateQueries({ queryKey: ['coachee', coacheeId] })
  const toggle = useMutation({
    mutationFn: () => coachingPlatform.updateMilestone(milestone.id, { achieved: !milestone.achieved }),
    onSuccess: invalidate,
  })
  const remove = useMutation({
    mutationFn: () => coachingPlatform.deleteMilestone(milestone.id),
    onSuccess: invalidate,
  })
  const done = !!milestone.achieved
  return (
    <li className="flex items-center gap-3 py-1.5">
      <button
        onClick={() => toggle.mutate()}
        className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-sm text-xs transition"
        style={{
          border: done ? '1px solid rgba(52,210,123,0.5)' : '1px solid var(--border-medium)',
          background: done ? 'rgba(52,210,123,0.15)' : 'transparent',
          color: done ? 'var(--green)' : 'transparent',
        }}
        aria-label={done ? 'Als offen markieren' : 'Als erreicht markieren'}
      >
        ✓
      </button>
      <span
        className="flex-1 text-sm"
        style={{ color: done ? 'var(--text-muted)' : 'var(--text-secondary)', textDecoration: done ? 'line-through' : 'none' }}
      >
        {milestone.title}
      </span>
      {milestone.achieved_at && (
        <span className="font-mono-data text-[10px]" style={{ color: 'var(--text-muted)' }}>{fmtDate(milestone.achieved_at)}</span>
      )}
      <button
        onClick={() => remove.mutate()}
        className="text-xs transition hover:!text-[var(--red)]"
        style={{ color: 'var(--text-muted)' }}
        aria-label="Meilenstein löschen"
      >
        ✕
      </button>
    </li>
  )
}

function GoalCard({ goal, coacheeId }: { goal: Goal; coacheeId: string }) {
  const qc = useQueryClient()
  const invalidate = () => qc.invalidateQueries({ queryKey: ['coachee', coacheeId] })
  const [newMilestone, setNewMilestone] = useState('')

  const setStatus = useMutation({
    mutationFn: (status: string) => coachingPlatform.updateGoal(goal.id, { status }),
    onSuccess: invalidate,
  })
  const remove = useMutation({
    mutationFn: () => coachingPlatform.deleteGoal(goal.id),
    onSuccess: invalidate,
  })
  const addMilestone = useMutation({
    mutationFn: (title: string) => coachingPlatform.createMilestone(goal.id, { title }),
    onSuccess: () => { setNewMilestone(''); invalidate() },
  })

  const status = GOAL_STATUS[goal.status] ?? GOAL_STATUS.open
  const reached = goal.milestones.filter((m) => m.achieved).length
  const pct = goal.milestones.length > 0 ? Math.round((reached / goal.milestones.length) * 100) : 0

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h4 className="font-display text-[15px] font-bold uppercase tracking-[0.04em] text-white">
              {goal.title}
            </h4>
            <span
              className="font-display flex-shrink-0 rounded-sm px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
              style={{ color: status.color, background: status.bg }}
            >
              {status.label}
            </span>
          </div>
          {goal.description && (
            <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>{goal.description}</p>
          )}
          {goal.target_date && (
            <p className="font-mono-data mt-0.5 text-[10px]" style={{ color: 'var(--text-muted)' }}>
              Ziel bis {fmtDate(goal.target_date)}
            </p>
          )}
        </div>
        <button
          onClick={() => remove.mutate()}
          className="flex-shrink-0 text-xs transition hover:!text-[var(--red)]"
          style={{ color: 'var(--text-muted)' }}
        >
          Löschen
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {(['open', 'active', 'done', 'dropped'] as const).map((s) => {
          const active = goal.status === s
          return (
            <button
              key={s}
              onClick={() => setStatus.mutate(s)}
              disabled={active}
              className="font-display rounded-sm px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide transition"
              style={{
                color: active ? GOAL_STATUS[s].color : 'var(--text-muted)',
                background: active ? GOAL_STATUS[s].bg : 'transparent',
                border: active ? `1px solid ${GOAL_STATUS[s].color}44` : '1px solid var(--border-dim)',
                cursor: active ? 'default' : 'pointer',
              }}
            >
              {GOAL_STATUS[s].label}
            </button>
          )
        })}
      </div>

      <div className="mt-4 border-t pt-3" style={{ borderColor: 'var(--border-dim)' }}>
        <div className="mb-2 flex items-center justify-between">
          <span className="stat-label">Meilensteine</span>
          {goal.milestones.length > 0 && (
            <span className="font-mono-data text-xs font-bold" style={{ color: 'var(--amber)' }}>
              {reached}/{goal.milestones.length}
            </span>
          )}
        </div>
        {goal.milestones.length > 0 && (
          <>
            <div className="mb-2 h-1 overflow-hidden rounded-full" style={{ background: 'var(--border-medium)' }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: 'linear-gradient(90deg, var(--amber-deep), var(--amber-light))' }} />
            </div>
            <ul className="divide-y" style={{ borderColor: 'var(--border-dim)' }}>
              {goal.milestones.map((m) => (
                <MilestoneRow key={m.id} milestone={m} coacheeId={coacheeId} />
              ))}
            </ul>
          </>
        )}
        <form
          className="mt-2 flex gap-2"
          onSubmit={(e) => { e.preventDefault(); if (newMilestone.trim()) addMilestone.mutate(newMilestone.trim()) }}
        >
          <input
            value={newMilestone}
            onChange={(e) => setNewMilestone(e.target.value)}
            placeholder="Neuer Meilenstein…"
            className="input-field flex-1"
          />
          <button type="submit" disabled={!newMilestone.trim() || addMilestone.isPending} className="btn-ghost !px-3">
            +
          </button>
        </form>
      </div>
    </div>
  )
}

function NoteItem({ note, coacheeId }: { note: SessionNote; coacheeId: string }) {
  const qc = useQueryClient()
  const invalidate = () => qc.invalidateQueries({ queryKey: ['coachee', coacheeId] })
  const shared = note.visibility === 'shared_with_user'
  const toggle = useMutation({
    mutationFn: () =>
      coachingPlatform.updateNote(note.id, { visibility: shared ? 'coach_only' : 'shared_with_user' }),
    onSuccess: invalidate,
  })
  const remove = useMutation({
    mutationFn: () => coachingPlatform.deleteNote(note.id),
    onSuccess: invalidate,
  })
  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono-data text-[10px]" style={{ color: 'var(--text-muted)' }}>{fmtDate(note.created_at)}</span>
        <div className="flex items-center gap-2">
          <span
            className="font-display rounded-sm px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
            style={{
              color: shared ? 'var(--green)' : 'var(--text-muted)',
              background: shared ? 'rgba(52,210,123,0.10)' : 'var(--bg-raised)',
              border: `1px solid ${shared ? 'rgba(52,210,123,0.24)' : 'var(--border-dim)'}`,
            }}
          >
            {shared ? 'Für Spieler sichtbar' : 'Coach-intern'}
          </span>
          <button
            onClick={() => toggle.mutate()}
            className="text-xs transition hover:!text-[var(--text-primary)]"
            style={{ color: 'var(--text-muted)' }}
          >
            {shared ? 'Verbergen' : 'Teilen'}
          </button>
          <button
            onClick={() => remove.mutate()}
            className="text-xs transition hover:!text-[var(--red)]"
            style={{ color: 'var(--text-muted)' }}
          >
            ✕
          </button>
        </div>
      </div>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{note.content}</p>
    </div>
  )
}

/* ── Termine dieses Spielers ── */
function AppointmentsSection({ coacheeId, appointments }: { coacheeId: string; appointments: Appointment[] }) {
  const qc = useQueryClient()
  const [time, setTime] = useState('')
  const [title, setTitle] = useState('')

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['coachee', coacheeId] })
    qc.invalidateQueries({ queryKey: ['appointments'] })
  }
  const create = useMutation({
    mutationFn: () =>
      coachingPlatform.createAppointment({
        coachee_id: coacheeId,
        scheduled_at: localInputToIso(time),
        title: title.trim() || undefined,
      }),
    onSuccess: () => { setTime(''); setTitle(''); invalidate() },
  })
  const cancel = useMutation({
    mutationFn: (id: string) => coachingPlatform.updateAppointment(id, { status: 'cancelled' }),
    onSuccess: invalidate,
  })

  const upcoming = appointments.filter((a) => a.status === 'scheduled')
  const rest = appointments.filter((a) => a.status !== 'scheduled').slice(0, 5)

  return (
    <section>
      <SectionHead label="Termine" count={upcoming.length} />
      <form
        className="card mb-3 flex flex-wrap items-end gap-2 p-4"
        onSubmit={(e) => { e.preventDefault(); if (time) create.mutate() }}
      >
        <label className="flex flex-col gap-1">
          <span className="font-mono-data text-[10px] uppercase tracking-[0.14em]" style={{ color: 'var(--text-muted)' }}>Wann</span>
          <input type="datetime-local" value={time} onChange={(e) => setTime(e.target.value)} className="input-field" required />
        </label>
        <label className="flex min-w-[150px] flex-1 flex-col gap-1">
          <span className="font-mono-data text-[10px] uppercase tracking-[0.14em]" style={{ color: 'var(--text-muted)' }}>Thema (optional)</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="z. B. VOD-Review" className="input-field" />
        </label>
        <button type="submit" className="btn-amber !px-3 !py-2 !text-xs" disabled={!time || create.isPending}>
          Planen
        </button>
      </form>
      {create.isError && <p className="mb-2 text-xs" style={{ color: 'var(--red)' }}>Termin konnte nicht angelegt werden.</p>}

      <div className="space-y-2">
        {upcoming.length > 0 ? (
          upcoming.map((a) => (
            <div key={a.id} className="card flex flex-wrap items-center gap-3 p-3.5" style={isUpcoming(a.scheduled_at) ? { borderColor: 'var(--amber-border)' } : undefined}>
              <span className="font-mono-data text-sm font-bold" style={{ color: 'var(--amber)' }}>{fmtDateTime(a.scheduled_at)}</span>
              <span className="font-mono-data text-[10px]" style={{ color: 'var(--text-muted)' }}>{a.duration_minutes} Min.</span>
              {a.title && <span className="truncate text-xs" style={{ color: 'var(--text-secondary)' }}>{a.title}</span>}
              <span className="flex-1" />
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{a.coach_display || ''}</span>
              <button className="btn-danger-ghost !px-2.5 !py-1 !text-[10px]" onClick={() => cancel.mutate(a.id)} disabled={cancel.isPending}>
                Absagen
              </button>
            </div>
          ))
        ) : (
          <EmptyState title="Kein Termin geplant" copy="Plane oben den nächsten Termin — der Spieler bekommt automatisch eine Discord-DM." />
        )}
        {rest.map((a) => (
          <div key={a.id} className="card flex flex-wrap items-center gap-3 p-3.5 opacity-70">
            <span className="font-mono-data text-sm" style={{ color: 'var(--text-secondary)' }}>{fmtDateTime(a.scheduled_at)}</span>
            {a.title && <span className="truncate text-xs" style={{ color: 'var(--text-muted)' }}>{a.title}</span>}
            <span className="flex-1" />
            <SessionStatusBadge status={a.status} />
          </div>
        ))}
      </div>
    </section>
  )
}

export default function CoacheeDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { isCoach, isLoading: authLoading } = useAuth()
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['coachee', id],
    queryFn: () => coachingPlatform.getCoachee(id!),
    enabled: !!id && isCoach,
  })

  const [goalTitle, setGoalTitle] = useState('')
  const [goalDesc, setGoalDesc] = useState('')
  const [noteText, setNoteText] = useState('')
  const [noteShared, setNoteShared] = useState(false)
  const [editFocus, setEditFocus] = useState<string | null>(null)

  const invalidate = () => qc.invalidateQueries({ queryKey: ['coachee', id] })
  const addGoal = useMutation({
    mutationFn: () =>
      coachingPlatform.createGoal(id!, { title: goalTitle.trim(), description: goalDesc.trim() || undefined }),
    onSuccess: () => { setGoalTitle(''); setGoalDesc(''); invalidate() },
  })
  const addNote = useMutation({
    mutationFn: () =>
      coachingPlatform.createNote(id!, {
        content: noteText.trim(),
        visibility: noteShared ? 'shared_with_user' : 'coach_only',
      }),
    onSuccess: () => { setNoteText(''); setNoteShared(false); invalidate() },
  })
  const saveFocus = useMutation({
    mutationFn: (focus: string) => coachingPlatform.updateCoachee(id!, { current_focus: focus }),
    onSuccess: () => { setEditFocus(null); invalidate() },
  })

  if (authLoading) return <PageSpinner />
  if (!isCoach) return <CoachOnly />
  if (isLoading) return <PageSpinner />

  if (!data?.profile) {
    return (
      <div className="content-grid py-16">
        <EmptyState title="Spieler nicht gefunden" copy="Die Akte existiert nicht oder wurde noch nicht angelegt.">
          <Link to="/dashboard" className="btn-ghost">← Zum Cockpit</Link>
        </EmptyState>
      </div>
    )
  }

  const { profile, goals, notes, sessions } = data
  const appointments = data.appointments ?? []
  const name = profile.display_name || profile.discord_username || 'Spieler'

  return (
    <div className="content-grid pb-16 pt-10 md:pt-14">
      <Link
        to="/dashboard"
        className="font-mono-data mb-6 inline-block text-[11px] uppercase tracking-[0.16em] transition hover:opacity-80"
        style={{ color: 'var(--text-muted)' }}
      >
        ← Cockpit
      </Link>

      {/* ── Spieler-Akte-Kopf ── */}
      <div className="panel-strong animate-in relative mb-10 overflow-hidden p-6">
        <span
          className="font-mono-data absolute right-5 top-4 text-[10px] uppercase tracking-[0.3em]"
          style={{ color: 'var(--amber)', opacity: 0.5 }}
        >
          Spieler-Akte
        </span>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold uppercase tracking-[0.05em] text-white">{name}</h1>
            {profile.discord_username && (
              <p className="font-mono-data text-xs" style={{ color: 'var(--text-muted)' }}>@{profile.discord_username}</p>
            )}
            <div className="mt-4 flex flex-wrap gap-8">
              {profile.rank && (
                <div>
                  <p className="stat-label mb-0.5">Rang</p>
                  <p className="font-display text-sm font-bold text-white">{profile.rank}</p>
                </div>
              )}
              <div>
                <p className="stat-label mb-0.5">Sessions</p>
                <p className="stat-value">{sessions.length}</p>
              </div>
              <div>
                <p className="stat-label mb-0.5">Offene Ziele</p>
                <p className="stat-value">{goals.filter((g) => g.status === 'open' || g.status === 'active').length}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 border-t pt-4" style={{ borderColor: 'var(--border-dim)' }}>
          <div className="mb-1 flex items-center justify-between">
            <span className="stat-label">Aktueller Fokus</span>
            {editFocus === null && (
              <button
                onClick={() => setEditFocus(profile.current_focus || '')}
                className="text-xs transition hover:!text-[var(--amber)]"
                style={{ color: 'var(--text-muted)' }}
              >
                Bearbeiten
              </button>
            )}
          </div>
          {editFocus === null ? (
            <p className="text-sm" style={{ color: profile.current_focus ? 'var(--text-secondary)' : 'var(--text-muted)' }}>
              {profile.current_focus || 'Noch kein Fokus gesetzt.'}
            </p>
          ) : (
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); saveFocus.mutate(editFocus) }}>
              <input
                value={editFocus}
                onChange={(e) => setEditFocus(e.target.value)}
                autoFocus
                placeholder="z. B. Lane-Phase, Map-Awareness…"
                className="input-field flex-1"
              />
              <button type="submit" className="btn-amber !px-3 !py-2 !text-xs">Speichern</button>
              <button type="button" onClick={() => setEditFocus(null)} className="btn-ghost !px-3 !py-2 !text-xs">Abbrechen</button>
            </form>
          )}
        </div>
      </div>

      <div className="mb-10">
        <AppointmentsSection coacheeId={id!} appointments={appointments} />
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Ziele */}
        <section>
          <SectionHead label="Ziele & Meilensteine" count={goals.length} />
          <form
            className="card mb-4 space-y-2 p-4"
            onSubmit={(e) => { e.preventDefault(); if (goalTitle.trim()) addGoal.mutate() }}
          >
            <input value={goalTitle} onChange={(e) => setGoalTitle(e.target.value)} placeholder="Neues Ziel…" className="input-field w-full" />
            <input value={goalDesc} onChange={(e) => setGoalDesc(e.target.value)} placeholder="Beschreibung (optional)" className="input-field w-full" />
            <button type="submit" disabled={!goalTitle.trim() || addGoal.isPending} className="btn-amber !text-xs">
              Ziel hinzufügen
            </button>
          </form>

          <div className="space-y-3">
            {goals.length > 0 ? (
              goals.map((g) => <GoalCard key={g.id} goal={g} coacheeId={id!} />)
            ) : (
              <EmptyState
                title="Noch keine Ziele"
                copy="Lege oben das erste Trainingsziel an — mit Meilensteinen wird der Fortschritt für den Spieler sichtbar."
              />
            )}
          </div>
        </section>

        {/* Protokolle + Session-Log */}
        <div className="space-y-10">
          <section>
            <SectionHead label="Session-Protokolle" count={notes.length} />
            <form
              className="card mb-4 space-y-2 p-4"
              onSubmit={(e) => { e.preventDefault(); if (noteText.trim()) addNote.mutate() }}
            >
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                rows={3}
                placeholder="Was lief in der Session, was üben, was als Nächstes…"
                className="input-field w-full resize-y"
              />
              <div className="flex items-center justify-between">
                <label className="flex cursor-pointer items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <input
                    type="checkbox"
                    checked={noteShared}
                    onChange={(e) => setNoteShared(e.target.checked)}
                    className="h-4 w-4 rounded-sm"
                    style={{ accentColor: 'var(--amber)' }}
                  />
                  Für Spieler sichtbar
                </label>
                <button type="submit" disabled={!noteText.trim() || addNote.isPending} className="btn-amber !text-xs">
                  Protokoll speichern
                </button>
              </div>
            </form>

            <div className="space-y-2">
              {notes.length > 0 ? (
                notes.map((n) => <NoteItem key={n.id} note={n} coacheeId={id!} />)
              ) : (
                <EmptyState
                  title="Noch keine Protokolle"
                  copy="Halte nach jeder Session fest, was besprochen wurde — geteilte Protokolle sieht der Spieler in seiner Akte."
                />
              )}
            </div>
          </section>

          <section>
            <SectionHead label="Session-Log" count={sessions.length} />
            <div className="space-y-2">
              {sessions.length > 0 ? (
                sessions.map((s, i) => (
                  <div key={s.id ?? i} className="card flex items-center justify-between px-4 py-3 text-sm">
                    <span className="font-display font-bold uppercase tracking-[0.04em]" style={{ color: 'var(--text-secondary)' }}>
                      {s.coach_display || 'Coach'}
                    </span>
                    <span className="font-mono-data text-[10px]" style={{ color: 'var(--text-muted)' }}>{fmtDate(s.started_at)}</span>
                    <SessionStatusBadge status={s.status} />
                  </div>
                ))
              ) : (
                <EmptyState title="Noch keine Sessions" copy="Abgeschlossene Discord-Sessions tauchen hier automatisch auf." />
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
