import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  coachingPlatform,
  type Appointment,
  type CoacheeListItem,
  type PlatformQueueRequest,
} from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import { CoachOnly, EmptyState, PageSpinner, SectionHead } from '@/components/ui'
import SessionStatusBadge from '@/components/SessionStatusBadge'
import { fmtDateTime, fmtUnix, isUpcoming, localInputToIso, parseUtc, toLocalInputValue } from '@/lib/format'

export function CoachTabs({ active }: { active: 'dashboard' | 'overview' }) {
  const tabs = [
    { to: '/dashboard', label: 'Cockpit', key: 'dashboard' },
    { to: '/overview', label: 'Übersicht', key: 'overview' },
  ] as const
  return (
    <div className="mb-8 flex gap-px overflow-hidden rounded-sm" style={{ border: '1px solid var(--border-dim)' }}>
      {tabs.map((t) => (
        <Link
          key={t.key}
          to={t.to}
          className="font-display px-6 py-2.5 text-sm font-semibold uppercase tracking-[0.1em] transition"
          style={{
            background: active === t.key ? 'var(--amber-glow)' : 'var(--bg-card)',
            color: active === t.key ? 'var(--amber)' : 'var(--text-muted)',
            boxShadow: active === t.key ? 'inset 0 -2px 0 var(--amber)' : 'none',
          }}
        >
          {t.label}
        </Link>
      ))}
    </div>
  )
}

const DURATIONS = [30, 45, 60, 90, 120]

/* ── Termin-Zeile mit Verschieben/Erledigt/Absagen ── */
function AppointmentRow({ appt }: { appt: Appointment }) {
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [newTime, setNewTime] = useState('')

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['appointments'] })
    if (appt.coachee_id) qc.invalidateQueries({ queryKey: ['coachee', appt.coachee_id] })
  }
  const update = useMutation({
    mutationFn: (data: Parameters<typeof coachingPlatform.updateAppointment>[1]) =>
      coachingPlatform.updateAppointment(appt.id, data),
    onSuccess: () => { setEditing(false); invalidate() },
  })

  const scheduled = appt.status === 'scheduled'
  const upcoming = scheduled && isUpcoming(appt.scheduled_at)

  return (
    <div
      className="card relative overflow-hidden p-4"
      style={upcoming ? { borderColor: 'var(--amber-border)' } : undefined}
    >
      {upcoming && (
        <div className="absolute bottom-0 left-0 top-0 w-[3px]" style={{ background: 'linear-gradient(180deg, var(--amber), transparent)' }} />
      )}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pl-1">
        <div className="min-w-[170px]">
          <p className="font-mono-data text-sm font-bold" style={{ color: upcoming ? 'var(--amber)' : 'var(--text-secondary)' }}>
            {fmtDateTime(appt.scheduled_at)}
          </p>
          <p className="font-mono-data text-[10px]" style={{ color: 'var(--text-muted)' }}>
            {appt.duration_minutes} Min.
          </p>
        </div>
        <div className="min-w-0 flex-1">
          {appt.coachee_id ? (
            <Link to={`/coachees/${appt.coachee_id}`} className="font-display text-sm font-bold uppercase tracking-[0.04em] transition hover:opacity-80" style={{ color: 'var(--text-primary)' }}>
              {appt.coachee_display || 'Spieler'}
            </Link>
          ) : (
            <span className="font-display text-sm font-bold uppercase" style={{ color: 'var(--text-primary)' }}>
              {appt.coachee_display || 'Spieler'}
            </span>
          )}
          {appt.title && <p className="truncate text-xs" style={{ color: 'var(--text-secondary)' }}>{appt.title}</p>}
        </div>
        <SessionStatusBadge status={appt.status} />
        {scheduled && (
          <div className="flex items-center gap-1.5">
            <button
              className="btn-ghost !px-2.5 !py-1 !text-[11px]"
              onClick={() => {
                const d = parseUtc(appt.scheduled_at)
                setNewTime(d ? toLocalInputValue(d) : '')
                setEditing(!editing)
              }}
            >
              Verschieben
            </button>
            <button
              className="btn-ghost !px-2.5 !py-1 !text-[11px]"
              onClick={() => update.mutate({ status: 'done' })}
              disabled={update.isPending}
            >
              Erledigt
            </button>
            <button
              className="btn-danger-ghost !px-2.5 !py-1 !text-[11px]"
              onClick={() => update.mutate({ status: 'cancelled' })}
              disabled={update.isPending}
            >
              Absagen
            </button>
          </div>
        )}
      </div>

      {editing && (
        <form
          className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3 pl-1"
          style={{ borderColor: 'var(--border-dim)' }}
          onSubmit={(e) => {
            e.preventDefault()
            if (newTime) update.mutate({ scheduled_at: localInputToIso(newTime) })
          }}
        >
          <input
            type="datetime-local"
            value={newTime}
            onChange={(e) => setNewTime(e.target.value)}
            className="input-field"
            required
          />
          <button type="submit" className="btn-amber !px-3 !py-1.5 !text-xs" disabled={update.isPending}>
            Neuer Termin
          </button>
          <button type="button" className="btn-ghost !px-3 !py-1.5 !text-xs" onClick={() => setEditing(false)}>
            Abbrechen
          </button>
          <span className="font-mono-data text-[10px]" style={{ color: 'var(--text-muted)' }}>
            Der Spieler bekommt automatisch eine Discord-Benachrichtigung.
          </span>
        </form>
      )}
      {update.isError && (
        <p className="mt-2 pl-1 text-xs" style={{ color: 'var(--red)' }}>Speichern fehlgeschlagen — nochmal versuchen.</p>
      )}
    </div>
  )
}

/* ── Neuen Termin planen ── */
function AppointmentPlanner({ coachees }: { coachees: CoacheeListItem[] }) {
  const qc = useQueryClient()
  const [coacheeId, setCoacheeId] = useState('')
  const [time, setTime] = useState('')
  const [duration, setDuration] = useState(60)
  const [title, setTitle] = useState('')

  const create = useMutation({
    mutationFn: () =>
      coachingPlatform.createAppointment({
        coachee_id: coacheeId,
        scheduled_at: localInputToIso(time),
        duration_minutes: duration,
        title: title.trim() || undefined,
      }),
    onSuccess: () => {
      setCoacheeId(''); setTime(''); setTitle('')
      qc.invalidateQueries({ queryKey: ['appointments'] })
    },
  })

  const sorted = useMemo(
    () => [...coachees].sort((a, b) => (a.display_name || a.discord_username || '').localeCompare(b.display_name || b.discord_username || '')),
    [coachees]
  )

  return (
    <form
      className="panel-strong mb-4 p-4"
      onSubmit={(e) => { e.preventDefault(); if (coacheeId && time) create.mutate() }}
    >
      <p className="stat-label mb-3">Neues Coaching planen</p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-[180px] flex-1 flex-col gap-1">
          <span className="font-mono-data text-[10px] uppercase tracking-[0.14em]" style={{ color: 'var(--text-muted)' }}>Spieler</span>
          <select value={coacheeId} onChange={(e) => setCoacheeId(e.target.value)} className="input-field" required>
            <option value="" disabled>Spieler wählen…</option>
            {sorted.map((c) => (
              <option key={c.id} value={c.id}>{c.display_name || c.discord_username || c.id}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-mono-data text-[10px] uppercase tracking-[0.14em]" style={{ color: 'var(--text-muted)' }}>Wann</span>
          <input type="datetime-local" value={time} onChange={(e) => setTime(e.target.value)} className="input-field" required />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-mono-data text-[10px] uppercase tracking-[0.14em]" style={{ color: 'var(--text-muted)' }}>Dauer</span>
          <select value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="input-field">
            {DURATIONS.map((d) => <option key={d} value={d}>{d} Min.</option>)}
          </select>
        </label>
        <label className="flex min-w-[180px] flex-[2] flex-col gap-1">
          <span className="font-mono-data text-[10px] uppercase tracking-[0.14em]" style={{ color: 'var(--text-muted)' }}>Thema (optional)</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="z. B. Laning-Review Haze" className="input-field" />
        </label>
        <button type="submit" className="btn-amber" disabled={!coacheeId || !time || create.isPending}>
          Planen
        </button>
      </div>
      {create.isError && (
        <p className="mt-2 text-xs" style={{ color: 'var(--red)' }}>Termin konnte nicht angelegt werden.</p>
      )}
      {create.isSuccess && (
        <p className="mt-2 text-xs" style={{ color: 'var(--green)' }}>Termin angelegt — der Spieler bekommt eine Discord-Benachrichtigung.</p>
      )}
    </form>
  )
}

/* ── Eigenes Coach-Profil pflegen ── */
function ProfileEditor() {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [bio, setBio] = useState<string | null>(null)
  const [specialties, setSpecialties] = useState<string | null>(null)
  const [twitch, setTwitch] = useState<string | null>(null)

  const { data: me, isError } = useQuery({
    queryKey: ['coach-me'],
    queryFn: () => coachingPlatform.coachMe(),
    retry: false,
  })

  const save = useMutation({
    mutationFn: () =>
      coachingPlatform.updateCoachMe({
        bio: bio ?? me?.bio ?? '',
        specialties: (specialties ?? (me?.specialties ?? []).join(', '))
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        twitch_url: (twitch ?? me?.twitch_url ?? '').trim(),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['coach-me'] })
      qc.invalidateQueries({ queryKey: ['coaches'] })
    },
  })

  if (isError || !me) return null

  return (
    <div className="card mb-10 overflow-hidden">
      <button
        className="font-display flex w-full items-center justify-between px-5 py-3.5 text-sm font-bold uppercase tracking-[0.1em] transition hover:opacity-90"
        style={{ color: 'var(--text-secondary)' }}
        onClick={() => setOpen(!open)}
      >
        <span className="flex items-center gap-2">
          <span style={{ color: 'var(--amber)' }}>⌬</span> Mein Coach-Profil
          {!me.bio && (
            <span className="badge badge-amber !text-[9px]">Bio fehlt noch</span>
          )}
        </span>
        <span className="font-mono-data text-xs">{open ? '▴' : '▾'}</span>
      </button>

      {open && (
        <form
          className="space-y-3 border-t px-5 py-4"
          style={{ borderColor: 'var(--border-dim)' }}
          onSubmit={(e) => { e.preventDefault(); save.mutate() }}
        >
          <label className="block">
            <span className="stat-label mb-1 block">Bio — so sehen dich Spieler im Roster</span>
            <textarea
              value={bio ?? me.bio ?? ''}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              placeholder="Wer bist du, was coachst du, was bringst du mit…"
              className="input-field w-full resize-y"
            />
          </label>
          <div className="flex flex-wrap gap-3">
            <label className="min-w-[220px] flex-1">
              <span className="stat-label mb-1 block">Schwerpunkte (Komma-getrennt)</span>
              <input
                value={specialties ?? (me.specialties ?? []).join(', ')}
                onChange={(e) => setSpecialties(e.target.value)}
                placeholder="Laning, Macro, Farming…"
                className="input-field w-full"
              />
            </label>
            <label className="min-w-[220px] flex-1">
              <span className="stat-label mb-1 block">Twitch-Link (optional)</span>
              <input
                value={twitch ?? me.twitch_url ?? ''}
                onChange={(e) => setTwitch(e.target.value)}
                placeholder="https://twitch.tv/…"
                className="input-field w-full"
              />
            </label>
          </div>
          <div className="flex items-center gap-3">
            <button type="submit" className="btn-amber" disabled={save.isPending}>Speichern</button>
            {save.isSuccess && <span className="text-xs" style={{ color: 'var(--green)' }}>Gespeichert.</span>}
            {save.isError && <span className="text-xs" style={{ color: 'var(--red)' }}>Fehler beim Speichern.</span>}
          </div>
        </form>
      )}
    </div>
  )
}

/* ── Anfragen-Queue-Karte ── */
function QueueCard({ req }: { req: PlatformQueueRequest }) {
  const reservedForMe = req.reserved_for_me && !req.is_open
  return (
    <div
      className="card relative overflow-hidden p-5"
      style={{ borderColor: reservedForMe ? 'rgba(69, 196, 245, 0.24)' : undefined }}
    >
      <div
        className="absolute bottom-0 left-0 top-0 w-[3px]"
        style={{ background: reservedForMe ? 'var(--sky)' : 'var(--green)' }}
      />
      <div className="flex items-start justify-between gap-3 pl-1">
        <div className="min-w-0">
          <h3 className="font-display text-[15px] font-bold uppercase tracking-[0.04em] text-white">
            {req.discord_username || 'Spieler'}
          </h3>
          <p className="font-mono-data mt-0.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>
            {req.rank || '—'}{req.subrank ? ` ${req.subrank}` : ''}{req.hero ? ` · ${req.hero}` : ''}
          </p>
        </div>
        <span className={`badge flex-shrink-0 ${reservedForMe ? 'badge-reserved' : 'badge-open'}`}>
          {reservedForMe ? 'Reserviert' : 'Offen'}
        </span>
      </div>

      {req.current_problems && (
        <p className="mt-3 line-clamp-3 pl-1 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          {req.current_problems}
        </p>
      )}

      <p className="font-mono-data mt-3 pl-1 text-[10px] uppercase tracking-[0.1em]" style={{ color: 'var(--text-muted)' }}>
        {reservedForMe && req.reserved_until ? `Reserviert bis ${fmtUnix(req.reserved_until)}` : 'Offene Website-Anfrage'}
      </p>
    </div>
  )
}

function CoacheeRow({ c }: { c: CoacheeListItem }) {
  return (
    <Link to={`/coachees/${c.id}`} className="card card-hover bracket-card flex items-center justify-between gap-4 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="font-display truncate font-bold uppercase tracking-[0.04em] text-white">
          {c.display_name || c.discord_username || 'Spieler'}
        </p>
        <p className="truncate text-xs" style={{ color: 'var(--text-muted)' }}>
          {c.rank || '—'}{c.current_focus ? ` · ${c.current_focus}` : ''}
        </p>
      </div>
      <div className="flex flex-shrink-0 items-center gap-5 text-xs" style={{ color: 'var(--text-muted)' }}>
        <span>
          <span className="font-mono-data font-bold" style={{ color: c.open_goals > 0 ? 'var(--amber)' : 'var(--text-secondary)' }}>
            {c.open_goals}
          </span>{' '}
          Ziele
        </span>
        <span>
          <span className="font-mono-data font-bold" style={{ color: 'var(--text-secondary)' }}>{c.sessions}</span>{' '}
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

  const { data: apptData, isLoading: apptsLoading } = useQuery({
    queryKey: ['appointments'],
    queryFn: () => coachingPlatform.listAppointments('mine'),
    enabled: isCoach,
  })
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

  if (authLoading) return <PageSpinner />
  if (!isCoach) return <CoachOnly />

  const appointments = apptData?.appointments ?? []
  const upcoming = appointments
    .filter((a) => a.status === 'scheduled')
    .sort((a, b) => (a.scheduled_at > b.scheduled_at ? 1 : -1))
  const past = appointments
    .filter((a) => a.status !== 'scheduled')
    .sort((a, b) => (a.scheduled_at < b.scheduled_at ? 1 : -1))
    .slice(0, 6)

  const requests = queueData?.requests ?? []
  const allCoachees = coacheeData?.coachees ?? []
  const coachees = allCoachees.filter((c) => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return (c.display_name || '').toLowerCase().includes(q) || (c.discord_username || '').toLowerCase().includes(q)
  })

  return (
    <div className="content-grid pb-16 pt-10 md:pt-14">
      <div className="animate-in-left mb-8">
        <div className="eyebrow mb-4">Coach-Bereich</div>
        <h1 className="section-title">Cockpit</h1>
        <p className="section-copy mt-2">Deine Termine, Website-Anfragen und deine Spieler — alles auf einen Blick.</p>
      </div>

      <CoachTabs active="dashboard" />

      <ProfileEditor />

      {/* ── Anstehende Coachings ── */}
      <section className="mb-12">
        <SectionHead label="Anstehende Coachings" count={apptsLoading ? undefined : upcoming.length} />
        <AppointmentPlanner coachees={allCoachees} />
        {apptsLoading ? (
          <div className="flex justify-center py-10"><div className="spinner h-7 w-7" /></div>
        ) : upcoming.length > 0 ? (
          <div className="space-y-2">
            {upcoming.map((a) => <AppointmentRow key={a.id} appt={a} />)}
          </div>
        ) : (
          <EmptyState
            title="Nichts geplant"
            copy="Plane oben ein Coaching mit einem deiner Spieler — der Termin erscheint bei euch beiden, dazu gehen Abstimmung und Erinnerung über Discord."
          />
        )}
        {past.length > 0 && (
          <details className="mt-3">
            <summary className="font-mono-data cursor-pointer text-[11px] uppercase tracking-[0.16em]" style={{ color: 'var(--text-muted)' }}>
              Vergangene Termine ({past.length})
            </summary>
            <div className="mt-2 space-y-2">
              {past.map((a) => <AppointmentRow key={a.id} appt={a} />)}
            </div>
          </details>
        )}
      </section>

      {/* ── Queue ── */}
      <section className="mb-12">
        <SectionHead label="Anfragen-Queue" count={queueLoading ? undefined : requests.length} />
        {queueLoading ? (
          <div className="flex justify-center py-10"><div className="spinner h-7 w-7" /></div>
        ) : requests.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {requests.map((r) => <QueueCard key={r.id} req={r} />)}
          </div>
        ) : (
          <EmptyState
            title="Queue ist leer"
            copy="Neue Coaching-Anfragen von der Website landen automatisch hier, sobald ein Spieler das Formular abschickt."
          />
        )}
      </section>

      {/* ── Spieler ── */}
      <section>
        <SectionHead
          label="Deine Spieler"
          count={coacheesLoading ? undefined : coachees.length}
          action={
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Suchen…"
              className="input-field w-44 !py-1.5"
            />
          }
        />
        {coacheesLoading ? (
          <div className="flex justify-center py-10"><div className="spinner h-7 w-7" /></div>
        ) : coachees.length > 0 ? (
          <div className="space-y-2">
            {coachees.map((c) => <CoacheeRow key={c.id} c={c} />)}
          </div>
        ) : (
          <EmptyState
            title={search ? 'Keine Treffer' : 'Noch keine Spieler'}
            copy={search ? 'Anderen Suchbegriff probieren.' : 'Sobald ein Spieler eine Coaching-Anfrage stellt, taucht er hier mit seiner Akte auf.'}
          />
        )}
      </section>
    </div>
  )
}
