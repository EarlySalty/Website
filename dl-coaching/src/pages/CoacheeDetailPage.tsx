import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, Link } from 'react-router-dom'
import { coachingPlatform, type Goal, type Milestone, type SessionNote } from '@/api/client'
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

function Spinner() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="spinner h-8 w-8" />
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
          border: done ? '1px solid rgba(34,197,94,0.5)' : '1px solid var(--border-medium)',
          background: done ? 'rgba(34,197,94,0.15)' : 'transparent',
          color: done ? 'var(--green)' : 'transparent',
        }}
        aria-label={done ? 'Als offen markieren' : 'Als erreicht markieren'}
      >
        ✓
      </button>
      <span
        className="flex-1 text-sm"
        style={{
          color: done ? 'var(--text-muted)' : 'var(--text-secondary)',
          textDecoration: done ? 'line-through' : 'none',
        }}
      >
        {milestone.title}
      </span>
      {milestone.achieved_at && (
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{fmtDate(milestone.achieved_at)}</span>
      )}
      <button
        onClick={() => remove.mutate()}
        className="text-xs transition"
        style={{ color: 'var(--text-muted)' }}
        onMouseEnter={e => { e.currentTarget.style.color = 'var(--red)' }}
        onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)' }}
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
    onSuccess: () => {
      setNewMilestone('')
      invalidate()
    },
  })

  const status = GOAL_STATUS[goal.status] ?? GOAL_STATUS.open
  const reached = goal.milestones.filter((m) => m.achieved).length
  const pct = goal.milestones.length > 0 ? Math.round((reached / goal.milestones.length) * 100) : 0

  return (
    <div className="rounded-sm p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-dim)' }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h4
              className="font-bold text-white"
              style={{ fontFamily: "'Rajdhani', sans-serif', fontSize: '15px', letterSpacing: '0.04em'" }}
            >
              {goal.title}
            </h4>
            <span
              className="flex-shrink-0 rounded-sm px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
              style={{ color: status.color, background: status.bg, fontFamily: "'Rajdhani', sans-serif" }}
            >
              {status.label}
            </span>
          </div>
          {goal.description && (
            <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>{goal.description}</p>
          )}
          {goal.target_date && (
            <p className="mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
              Ziel bis {fmtDate(goal.target_date)}
            </p>
          )}
        </div>
        <button
          onClick={() => remove.mutate()}
          className="flex-shrink-0 text-xs transition"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--red)' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)' }}
        >
          Löschen
        </button>
      </div>

      {/* Status buttons */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {(['open', 'active', 'done', 'dropped'] as const).map((s) => {
          const active = goal.status === s
          return (
            <button
              key={s}
              onClick={() => setStatus.mutate(s)}
              disabled={active}
              className="rounded-sm px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide transition"
              style={{
                fontFamily: "'Rajdhani', sans-serif",
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

      {/* Milestones */}
      <div className="mt-4 pt-3" style={{ borderTop: '1px solid var(--border-dim)' }}>
        <div className="mb-2 flex items-center justify-between">
          <span className="stat-label">Meilensteine</span>
          {goal.milestones.length > 0 && (
            <span className="text-xs font-bold" style={{ color: 'var(--amber)', fontFamily: "'Rajdhani', sans-serif" }}>
              {reached}/{goal.milestones.length}
            </span>
          )}
        </div>
        {goal.milestones.length > 0 && (
          <>
            <div className="mb-2 h-1 overflow-hidden rounded-full" style={{ background: 'var(--border-medium)' }}>
              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'var(--amber)' }} />
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
          onSubmit={(e) => {
            e.preventDefault()
            if (newMilestone.trim()) addMilestone.mutate(newMilestone.trim())
          }}
        >
          <input
            value={newMilestone}
            onChange={(e) => setNewMilestone(e.target.value)}
            placeholder="Neuer Meilenstein…"
            className="input-field flex-1"
          />
          <button
            type="submit"
            disabled={!newMilestone.trim() || addMilestone.isPending}
            className="rounded-sm px-3 py-2 text-sm font-semibold transition disabled:opacity-50"
            style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-soft)', color: 'var(--text-secondary)' }}
          >
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
    <div className="rounded-sm p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-dim)' }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{fmtDate(note.created_at)}</span>
        <div className="flex items-center gap-2">
          <span
            className="rounded-sm px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
            style={{
              fontFamily: "'Rajdhani', sans-serif",
              color: shared ? 'var(--green)' : 'var(--text-muted)',
              background: shared ? 'rgba(34,197,94,0.10)' : 'var(--bg-raised)',
              border: `1px solid ${shared ? 'rgba(34,197,94,0.24)' : 'var(--border-dim)'}`,
            }}
          >
            {shared ? 'Sichtbar' : 'Privat'}
          </span>
          <button
            onClick={() => toggle.mutate()}
            className="text-xs transition"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)' }}
          >
            {shared ? 'Verbergen' : 'Teilen'}
          </button>
          <button
            onClick={() => remove.mutate()}
            className="text-xs transition"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--red)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)' }}
          >
            ✕
          </button>
        </div>
      </div>
      <p className="mt-2 whitespace-pre-wrap text-sm" style={{ color: 'var(--text-secondary)' }}>{note.content}</p>
    </div>
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

  if (authLoading) return <Spinner />

  if (!isCoach) {
    return (
      <div className="content-grid py-12">
        <p style={{ color: 'var(--text-muted)' }}>Dieser Bereich ist Coaches vorbehalten.</p>
        <Link to="/" className="mt-4 inline-block text-sm" style={{ color: 'var(--amber)' }}>← Zu den Coaches</Link>
      </div>
    )
  }

  if (isLoading) return <Spinner />

  if (!data?.profile) {
    return (
      <div className="content-grid py-12">
        <p style={{ color: 'var(--text-muted)' }}>Spieler nicht gefunden.</p>
        <Link to="/dashboard" className="mt-4 inline-block text-sm" style={{ color: 'var(--amber)' }}>← Dashboard</Link>
      </div>
    )
  }

  const { profile, goals, notes, sessions } = data
  const name = profile.display_name || profile.discord_username || 'Spieler'

  return (
    <div className="content-grid py-12 md:py-16">
      <Link to="/dashboard" className="mb-6 inline-block text-sm transition" style={{ color: 'var(--text-muted)' }}>
        ← Dashboard
      </Link>

      {/* Profil */}
      <div className="mb-10 rounded-sm p-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-soft)' }}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1
              className="text-2xl font-bold text-white"
              style={{ fontFamily: "'Rajdhani', sans-serif", letterSpacing: '0.06em' }}
            >
              {name}
            </h1>
            {profile.discord_username && (
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>@{profile.discord_username}</p>
            )}
            <div className="mt-3 flex flex-wrap gap-6">
              {profile.rank && (
                <div>
                  <p className="stat-label mb-0.5">Rang</p>
                  <p className="text-sm text-white">{profile.rank}</p>
                </div>
              )}
              <div>
                <p className="stat-label mb-0.5">Sessions</p>
                <p className="stat-value">{sessions.length}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 pt-4" style={{ borderTop: '1px solid var(--border-dim)' }}>
          <div className="mb-1 flex items-center justify-between">
            <span className="stat-label">Aktueller Fokus</span>
            {editFocus === null && (
              <button
                onClick={() => setEditFocus(profile.current_focus || '')}
                className="text-xs transition"
                style={{ color: 'var(--text-muted)' }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--amber)' }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)' }}
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
            <form
              className="flex gap-2"
              onSubmit={(e) => { e.preventDefault(); saveFocus.mutate(editFocus) }}
            >
              <input
                value={editFocus}
                onChange={(e) => setEditFocus(e.target.value)}
                autoFocus
                placeholder="z. B. Lane-Phase, Map-Awareness…"
                className="input-field flex-1"
              />
              <button
                type="submit"
                className="rounded-sm px-3 py-2 text-sm font-semibold text-white transition"
                style={{ background: 'var(--amber)', color: '#060810' }}
              >
                Speichern
              </button>
              <button
                type="button"
                onClick={() => setEditFocus(null)}
                className="rounded-sm px-3 py-2 text-sm transition"
                style={{ border: '1px solid var(--border-soft)', color: 'var(--text-secondary)' }}
              >
                Abbrechen
              </button>
            </form>
          )}
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Ziele */}
        <section>
          <SectionHead label="Ziele & Meilensteine" />

          <form
            className="mb-4 space-y-2 rounded-sm p-4"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-dim)' }}
            onSubmit={(e) => { e.preventDefault(); if (goalTitle.trim()) addGoal.mutate() }}
          >
            <input
              value={goalTitle}
              onChange={(e) => setGoalTitle(e.target.value)}
              placeholder="Neues Ziel…"
              className="input-field w-full"
            />
            <input
              value={goalDesc}
              onChange={(e) => setGoalDesc(e.target.value)}
              placeholder="Beschreibung (optional)"
              className="input-field w-full"
            />
            <button
              type="submit"
              disabled={!goalTitle.trim() || addGoal.isPending}
              className="rounded-sm px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-50"
              style={{ background: 'var(--amber)', color: '#060810' }}
            >
              Ziel hinzufügen
            </button>
          </form>

          <div className="space-y-3">
            {goals.length > 0 ? (
              goals.map((g) => <GoalCard key={g.id} goal={g} coacheeId={id!} />)
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

        {/* Notizen */}
        <div className="space-y-8">
          <section>
            <SectionHead label="Session-Notizen" />

            <form
              className="mb-4 space-y-2 rounded-sm p-4"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-dim)' }}
              onSubmit={(e) => { e.preventDefault(); if (noteText.trim()) addNote.mutate() }}
            >
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                rows={3}
                placeholder="Was lief in der Session, was üben…"
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
                <button
                  type="submit"
                  disabled={!noteText.trim() || addNote.isPending}
                  className="rounded-sm px-4 py-2 text-sm font-semibold transition disabled:opacity-50"
                  style={{ background: 'var(--amber)', color: '#060810' }}
                >
                  Speichern
                </button>
              </div>
            </form>

            <div className="space-y-2">
              {notes.length > 0 ? (
                notes.map((n) => <NoteItem key={n.id} note={n} coacheeId={id!} />)
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
            <SectionHead label="Session-Log" />
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
