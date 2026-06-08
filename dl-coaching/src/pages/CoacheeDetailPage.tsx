import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, Link } from 'react-router-dom'
import { coachingPlatform, type Goal, type Milestone, type SessionNote } from '@/api/client'
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

function Spinner() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="animate-spin h-8 w-8 rounded-full border-2 border-accent-violet border-t-transparent" />
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
        className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border text-xs transition ${
          done ? 'border-emerald-400/50 bg-emerald-400/20 text-emerald-300' : 'border-white/20 text-transparent hover:border-white/40'
        }`}
        aria-label={done ? 'Als offen markieren' : 'Als erreicht markieren'}
      >
        ✓
      </button>
      <span className={`flex-1 text-sm ${done ? 'text-slate-500 line-through' : 'text-slate-200'}`}>
        {milestone.title}
      </span>
      {milestone.achieved_at && <span className="text-xs text-slate-500">{fmtDate(milestone.achieved_at)}</span>}
      <button
        onClick={() => remove.mutate()}
        className="text-xs text-slate-500 transition hover:text-rose-300"
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

  return (
    <div className="rounded-xl border border-white/10 bg-[#0c1017] p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-white">{goal.title}</h4>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${status.cls}`}>{status.label}</span>
          </div>
          {goal.description && <p className="mt-1 text-sm text-slate-400">{goal.description}</p>}
          {goal.target_date && (
            <p className="mt-1 text-xs text-slate-500">Ziel bis {fmtDate(goal.target_date)}</p>
          )}
        </div>
        <button
          onClick={() => remove.mutate()}
          className="flex-shrink-0 text-xs text-slate-500 transition hover:text-rose-300"
        >
          Löschen
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {(['open', 'active', 'done', 'dropped'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatus.mutate(s)}
            disabled={goal.status === s}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              goal.status === s
                ? `${GOAL_STATUS[s].cls} cursor-default`
                : 'border border-white/10 text-slate-400 hover:bg-white/5 hover:text-white'
            }`}
          >
            {GOAL_STATUS[s].label}
          </button>
        ))}
      </div>

      <div className="mt-4 border-t border-white/5 pt-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wider text-slate-500">Meilensteine</span>
          {goal.milestones.length > 0 && (
            <span className="text-xs text-slate-500">
              {reached}/{goal.milestones.length}
            </span>
          )}
        </div>
        {goal.milestones.length > 0 && (
          <ul className="mt-1 divide-y divide-white/5">
            {goal.milestones.map((m) => (
              <MilestoneRow key={m.id} milestone={m} coacheeId={coacheeId} />
            ))}
          </ul>
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
            className="flex-1 rounded-lg border border-white/10 bg-[#080a10] px-3 py-1.5 text-sm text-white placeholder:text-slate-600 focus:border-accent-violet/50 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!newMilestone.trim() || addMilestone.isPending}
            className="rounded-lg bg-white/5 px-3 py-1.5 text-sm font-medium text-slate-300 transition hover:bg-white/10 disabled:opacity-50"
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
    <div className="rounded-lg border border-white/10 bg-[#0c1017] p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-slate-500">{fmtDate(note.created_at)}</span>
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              shared ? 'bg-emerald-400/15 text-emerald-300' : 'bg-slate-500/15 text-slate-400'
            }`}
          >
            {shared ? 'Für Spieler sichtbar' : 'Nur Coaches'}
          </span>
          <button onClick={() => toggle.mutate()} className="text-xs text-slate-400 transition hover:text-white">
            {shared ? 'Verbergen' : 'Teilen'}
          </button>
          <button onClick={() => remove.mutate()} className="text-xs text-slate-500 transition hover:text-rose-300">
            ✕
          </button>
        </div>
      </div>
      <p className="mt-2 whitespace-pre-wrap text-sm text-slate-200">{note.content}</p>
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
    onSuccess: () => {
      setGoalTitle('')
      setGoalDesc('')
      invalidate()
    },
  })
  const addNote = useMutation({
    mutationFn: () =>
      coachingPlatform.createNote(id!, {
        content: noteText.trim(),
        visibility: noteShared ? 'shared_with_user' : 'coach_only',
      }),
    onSuccess: () => {
      setNoteText('')
      setNoteShared(false)
      invalidate()
    },
  })
  const saveFocus = useMutation({
    mutationFn: (focus: string) => coachingPlatform.updateCoachee(id!, { current_focus: focus }),
    onSuccess: () => {
      setEditFocus(null)
      invalidate()
    },
  })

  if (authLoading) return <Spinner />

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

  if (isLoading) return <Spinner />

  if (!data?.profile) {
    return (
      <div className="content-grid py-10">
        <p className="text-slate-400">Spieler nicht gefunden.</p>
        <Link to="/dashboard" className="mt-4 inline-block text-accent-violet hover:underline">
          ← Zum Dashboard
        </Link>
      </div>
    )
  }

  const { profile, goals, notes, sessions } = data
  const name = profile.display_name || profile.discord_username || 'Spieler'

  return (
    <div className="content-grid py-10 md:py-14">
      <Link to="/dashboard" className="mb-6 inline-block text-sm text-slate-400 hover:text-white">
        ← Zum Dashboard
      </Link>

      {/* Profil-Kopf */}
      <div className="rounded-xl border border-white/10 bg-[#0c1017] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">{name}</h1>
            {profile.discord_username && <p className="text-slate-400">@{profile.discord_username}</p>}
            <div className="mt-2 flex flex-wrap gap-4 text-sm text-slate-400">
              <span>Rang: {profile.rank || '—'}</span>
              <span>·</span>
              <span>{sessions.length} Sessions</span>
            </div>
          </div>
        </div>

        <div className="mt-5 border-t border-white/10 pt-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-500">Aktueller Fokus</span>
            {editFocus === null && (
              <button
                onClick={() => setEditFocus(profile.current_focus || '')}
                className="text-xs text-slate-400 transition hover:text-white"
              >
                Bearbeiten
              </button>
            )}
          </div>
          {editFocus === null ? (
            <p className="mt-1 text-sm text-slate-200">{profile.current_focus || 'Noch kein Fokus gesetzt.'}</p>
          ) : (
            <form
              className="mt-2 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                saveFocus.mutate(editFocus)
              }}
            >
              <input
                value={editFocus}
                onChange={(e) => setEditFocus(e.target.value)}
                autoFocus
                placeholder="z. B. Lane-Phase, Map-Awareness…"
                className="flex-1 rounded-lg border border-white/10 bg-[#080a10] px-3 py-1.5 text-sm text-white placeholder:text-slate-600 focus:border-accent-violet/50 focus:outline-none"
              />
              <button
                type="submit"
                className="rounded-lg bg-accent-violet px-3 py-1.5 text-sm font-medium text-white transition hover:bg-accent-violet/80"
              >
                Speichern
              </button>
              <button
                type="button"
                onClick={() => setEditFocus(null)}
                className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-slate-400 transition hover:text-white"
              >
                Abbrechen
              </button>
            </form>
          )}
        </div>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        {/* Ziele */}
        <section>
          <h2 className="mb-4 text-xl font-semibold text-white">Ziele & Meilensteine</h2>

          <form
            className="mb-4 space-y-2 rounded-xl border border-white/10 bg-[#0c1017] p-4"
            onSubmit={(e) => {
              e.preventDefault()
              if (goalTitle.trim()) addGoal.mutate()
            }}
          >
            <input
              value={goalTitle}
              onChange={(e) => setGoalTitle(e.target.value)}
              placeholder="Neues Ziel…"
              className="w-full rounded-lg border border-white/10 bg-[#080a10] px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-accent-violet/50 focus:outline-none"
            />
            <input
              value={goalDesc}
              onChange={(e) => setGoalDesc(e.target.value)}
              placeholder="Beschreibung (optional)"
              className="w-full rounded-lg border border-white/10 bg-[#080a10] px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-accent-violet/50 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!goalTitle.trim() || addGoal.isPending}
              className="rounded-lg bg-accent-violet px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-violet/80 disabled:opacity-50"
            >
              Ziel hinzufügen
            </button>
          </form>

          <div className="space-y-4">
            {goals.length > 0 ? (
              goals.map((g) => <GoalCard key={g.id} goal={g} coacheeId={id!} />)
            ) : (
              <p className="rounded-xl border border-white/10 bg-[#0c1017] p-6 text-center text-sm text-slate-500">
                Noch keine Ziele.
              </p>
            )}
          </div>
        </section>

        {/* Notizen */}
        <section>
          <h2 className="mb-4 text-xl font-semibold text-white">Session-Notizen</h2>

          <form
            className="mb-4 space-y-2 rounded-xl border border-white/10 bg-[#0c1017] p-4"
            onSubmit={(e) => {
              e.preventDefault()
              if (noteText.trim()) addNote.mutate()
            }}
          >
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              rows={3}
              placeholder="Was lief in der Session, was üben…"
              className="w-full resize-y rounded-lg border border-white/10 bg-[#080a10] px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-accent-violet/50 focus:outline-none"
            />
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-slate-400">
                <input
                  type="checkbox"
                  checked={noteShared}
                  onChange={(e) => setNoteShared(e.target.checked)}
                  className="h-4 w-4 rounded border-white/20 bg-[#080a10]"
                />
                Für Spieler sichtbar
              </label>
              <button
                type="submit"
                disabled={!noteText.trim() || addNote.isPending}
                className="rounded-lg bg-accent-violet px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-violet/80 disabled:opacity-50"
              >
                Notiz speichern
              </button>
            </div>
          </form>

          <div className="space-y-3">
            {notes.length > 0 ? (
              notes.map((n) => <NoteItem key={n.id} note={n} coacheeId={id!} />)
            ) : (
              <p className="rounded-xl border border-white/10 bg-[#0c1017] p-6 text-center text-sm text-slate-500">
                Noch keine Notizen.
              </p>
            )}
          </div>

          {/* Session-Historie */}
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
