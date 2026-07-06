import { useEffect, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient, type UseMutationResult } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import {
  scrims,
  type DiscordSyncStatus,
  type ScrimParticipantPatch,
  type ScrimPoolParticipant,
  type ScrimTeam,
  type ScrimWindow,
  type Weekday,
} from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import AvailabilityGrid from '@/components/AvailabilityGrid'
import { CoachOnly, EmptyState, PageSpinner, SectionHead } from '@/components/ui'
import { scrimWindowText, TIME_OPTIONS, WEEKDAYS } from '@/lib/availability'

const STATUS_OPTIONS = [
  { value: 'new', label: 'Neu' },
  { value: 'waitlist', label: 'Warteliste' },
  { value: 'assigned', label: 'Zugewiesen' },
  { value: 'inactive', label: 'Inaktiv' },
] as const

const COPY = {
  createTeam: '＋ Team erstellen',
  freeOnly: 'nur frei',
  allPlayers: 'alle',
  dialogTitle: 'Neues Team',
  teamName: 'Name',
  coach: 'Coach',
  targetWindow: 'Wunsch-Zeitfenster (optional)',
  windowHint: 'Wird im Board für den ersten Roster-Vorschlag vorausgewählt:',
  day: 'Tag',
  from: 'von',
  to: 'bis',
  invalidWindow: 'Startzeit muss vor Endzeit liegen.',
  create: 'Team anlegen',
  cancel: 'Abbrechen',
  assign: '→ Team zuweisen',
  details: 'Details',
  status: 'Status',
  note: 'Coach-Notiz',
} as const

interface TeamForm {
  name: string
  coach: string
  useWindow: boolean
  day: Weekday
  from: string
  to: string
}

const DEFAULT_TEAM_FORM: TeamForm = {
  name: '',
  coach: '',
  useWindow: false,
  day: 'mon',
  from: '1140',
  to: '1320',
}

function statusLabel(value: string): string {
  return STATUS_OPTIONS.find(o => o.value === value)?.label ?? value
}

function optionalValue(value: string): string | undefined {
  const trimmed = value.trim()
  return trimmed || undefined
}

function teamWindow(form: TeamForm): ScrimWindow | null {
  if (!form.useWindow) return null
  const from = Number(form.from)
  const to = Number(form.to)
  if (!Number.isFinite(from) || !Number.isFinite(to) || from >= to) return null
  return { day: form.day, from, to }
}

export default function ScrimPoolPage() {
  const { isCoach } = useAuth()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [freeOnly, setFreeOnly] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [teamForm, setTeamForm] = useState<TeamForm>(DEFAULT_TEAM_FORM)
  const [poolOpen, setPoolOpen] = useState(false)

  const teamsQuery = useQuery({ queryKey: ['scrim-teams'], queryFn: () => scrims.teams(), enabled: isCoach })
  const poolQuery = useQuery({
    queryKey: ['scrim-pool'],
    queryFn: () => scrims.pool(),
    enabled: isCoach,
  })
  const createTeamMutation = useMutation({
    mutationFn: () => scrims.createTeam({ name: teamForm.name, coach: optionalValue(teamForm.coach) ?? null }),
    onSuccess: team => {
      qc.invalidateQueries({ queryKey: ['scrim-teams'] })
      setShowCreate(false)
      setTeamForm(DEFAULT_TEAM_FORM)
      const window = teamWindow(teamForm)
      navigate(`/scrims/teams/${team.id}`, window ? { state: { suggestWindow: window } } : undefined)
    },
  })

  if (!isCoach) return <CoachOnly />

  const teams = teamsQuery.data ?? []
  const pool = poolQuery.data ?? []
  const visiblePool = freeOnly ? pool.filter(p => !p.team) : pool

  return (
    <div className="content-grid space-y-8 py-8">
      <div>
        <h1 className="section-title">Scrim-Verwaltung</h1>
        <p className="section-copy">
          Teams, Kader und Verfügbarkeit an einem Ort. Öffne ein Team-Board, um den besten gemeinsamen Scrim-Termin zu sehen.
        </p>
      </div>

      <div>
        <SectionHead
          label="Teams"
          count={teams.length}
          action={
            <button
              type="button"
              onClick={() => {
                createTeamMutation.reset()
                setShowCreate(true)
              }}
              className="btn-amber rounded-sm px-3 py-1.5 text-xs"
            >
              {COPY.createTeam}
            </button>
          }
        />
        {teamsQuery.isLoading ? (
          <PageSpinner />
        ) : teams.length === 0 ? (
          <EmptyState title="Noch keine Teams" copy="Sobald Teams angelegt sind, erscheinen hier die Boards." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {teams.map(team => (
              <Link key={team.id} to={`/scrims/teams/${team.id}`} className="card card-hover p-4">
                <span className="font-display text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{team.name}</span>
                {team.coach && <p className="stat-label mt-1">Coach {team.coach}</p>}
                <span className="eyebrow mt-3 inline-block">Board öffnen →</span>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div>
        <button
          type="button"
          onClick={() => setPoolOpen(o => !o)}
          aria-expanded={poolOpen}
          className="card card-hover flex w-full items-center justify-between gap-3 p-4 text-left"
        >
          <span className="flex items-center gap-2">
            <span className="font-display text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Spieler-Pool</span>
            <span className="badge badge-amber">{visiblePool.length}</span>
          </span>
          <span className="eyebrow">{poolOpen ? 'schließen ▾' : 'öffnen ▸'}</span>
        </button>

        {poolOpen && (
          <div className="mt-4 space-y-3">
            <div className="flex justify-end">
              <div className="flex rounded-sm border p-0.5" style={{ borderColor: 'var(--border-dim)' }}>
                <button
                  type="button"
                  aria-pressed={freeOnly}
                  onClick={() => setFreeOnly(true)}
                  className={`rounded-sm px-3 py-1 text-xs font-semibold ${freeOnly ? 'btn-amber' : 'btn-ghost'}`}
                >
                  {COPY.freeOnly}
                </button>
                <button
                  type="button"
                  aria-pressed={!freeOnly}
                  onClick={() => setFreeOnly(false)}
                  className={`rounded-sm px-3 py-1 text-xs font-semibold ${freeOnly ? 'btn-ghost' : 'btn-amber'}`}
                >
                  {COPY.allPlayers}
                </button>
              </div>
            </div>
            {poolQuery.isLoading ? (
              <PageSpinner />
            ) : visiblePool.length === 0 ? (
              <EmptyState title="Keine Spieler" copy="Für diesen Filter gibt es aktuell keine Einträge." />
            ) : (
              <div className="space-y-2">
                {visiblePool.map(p => (
                  <PoolRow key={p.id} participant={p} teams={teams} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {showCreate && (
        <CreateTeamModal
          form={teamForm}
          setForm={setTeamForm}
          mutation={createTeamMutation}
          onClose={() => setShowCreate(false)}
        />
      )}
    </div>
  )
}

function CreateTeamModal({
  form,
  setForm,
  mutation,
  onClose,
}: {
  form: TeamForm
  setForm: React.Dispatch<React.SetStateAction<TeamForm>>
  mutation: UseMutationResult<ScrimTeam, Error, void, unknown>
  onClose: () => void
}) {
  const window = teamWindow(form)
  const invalidWindow = form.useWindow && !window

  const update = (patch: Partial<TeamForm>) => setForm(current => ({ ...current, ...patch }))

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (invalidWindow) return
    mutation.mutate()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6">
      <form className="panel-strong w-full max-w-lg space-y-4 p-5" onSubmit={submit}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-xl font-extrabold" style={{ color: 'var(--text-primary)' }}>{COPY.dialogTitle}</h2>
          <button type="button" onClick={onClose} className="btn-ghost rounded-sm px-3 py-1.5 text-xs">
            {COPY.cancel}
          </button>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="stat-label">{COPY.teamName}</span>
          <input
            className="input-field"
            value={form.name}
            onChange={e => update({ name: e.target.value })}
            autoFocus
            required
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="stat-label">{COPY.coach}</span>
          <input className="input-field" value={form.coach} onChange={e => update({ coach: e.target.value })} />
        </label>

        <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-primary)' }}>
          <input
            type="checkbox"
            checked={form.useWindow}
            onChange={e => update({ useWindow: e.target.checked })}
          />
          <span>{COPY.targetWindow}</span>
        </label>

        {form.useWindow && (
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="flex flex-col gap-1.5">
              <span className="stat-label">{COPY.day}</span>
              <select className="input-field" value={form.day} onChange={e => update({ day: e.target.value as Weekday })}>
                {WEEKDAYS.map(day => <option key={day.key} value={day.key}>{day.long}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="stat-label">{COPY.from}</span>
              <select className="input-field" value={form.from} onChange={e => update({ from: e.target.value })}>
                {TIME_OPTIONS.map(opt => <option key={opt.value} value={String(opt.value)}>{opt.label}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="stat-label">{COPY.to}</span>
              <select className="input-field" value={form.to} onChange={e => update({ to: e.target.value })}>
                {TIME_OPTIONS.map(opt => <option key={opt.value} value={String(opt.value)}>{opt.label}</option>)}
              </select>
            </label>
          </div>
        )}

        {window && (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {COPY.windowHint} {scrimWindowText(window)}
          </p>
        )}
        {invalidWindow && <p className="text-xs" style={{ color: 'var(--red)' }}>{COPY.invalidWindow}</p>}
        {mutation.isError && <p className="text-xs" style={{ color: 'var(--red)' }}>{mutation.error.message}</p>}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-ghost rounded-sm px-4 py-2 text-sm">
            {COPY.cancel}
          </button>
          <button type="submit" disabled={mutation.isPending || invalidWindow} className="btn-amber rounded-sm px-4 py-2 text-sm">
            {COPY.create}
          </button>
        </div>
      </form>
    </div>
  )
}

function PoolRow({ participant, teams }: { participant: ScrimPoolParticipant; teams: ScrimTeam[] }) {
  const qc = useQueryClient()
  const [notesDraft, setNotesDraft] = useState(participant.notes ?? '')
  const [sync, setSync] = useState<DiscordSyncStatus | null>(null)

  useEffect(() => {
    setNotesDraft(participant.notes ?? '')
  }, [participant.notes])

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['scrim-pool'] })
    qc.invalidateQueries({ queryKey: ['scrim-me'] })
    qc.invalidateQueries({ queryKey: ['scrim-board'] })
  }

  const mutation = useMutation({
    mutationFn: (patch: ScrimParticipantPatch) => scrims.updateParticipant(participant.id, patch),
    onSuccess: data => {
      setSync(data.discord_sync)
      invalidate()
    },
  })

  const resyncMutation = useMutation({
    mutationFn: () => scrims.resyncDiscord(participant.id),
    onSuccess: data => setSync(data.discord_sync),
  })

  const patch = (data: ScrimParticipantPatch) => mutation.mutate(data)
  const busy = mutation.isPending || resyncMutation.isPending

  return (
    <div className="card p-3">
      <div className="grid gap-3 xl:grid-cols-[minmax(12rem,1fr)_minmax(18rem,1.2fr)_minmax(13rem,0.75fr)] xl:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-display text-base font-bold" style={{ color: 'var(--text-primary)' }}>
              {participant.display_name}
            </span>
            <span className="badge">{statusLabel(participant.status)}</span>
            {participant.team && <span className="badge badge-amber">{participant.team.name}{participant.is_captain ? ' · C' : ''}{participant.is_bench ? ' · Bank' : ''}</span>}
            {!participant.availability_confirmed && <span className="badge" title="Verfügbarkeit nicht selbst bestätigt">unbestätigt</span>}
            {!participant.discord_linked && <span className="badge" title="Kein Discord verknüpft">kein Discord</span>}
          </div>
          <p className="mt-1 truncate text-sm" style={{ color: 'var(--text-muted)' }}>
            {[participant.rank || '—', participant.roles || '—'].join(' · ')}
          </p>
        </div>

        <AvailabilityGrid weekly={participant.availability_slots} compact />

        <label className="flex min-w-0 flex-col gap-1.5">
          <span className="sr-only">{COPY.assign}</span>
          <select
            className="input-field !py-1.5"
            value={participant.team?.id ?? ''}
            disabled={busy || teams.length === 0}
            onChange={e => {
              const v = e.target.value
              if (v === '' || v === String(participant.team?.id)) return
              if (v === 'none') patch({ team_id: null })
              else patch({ team_id: Number(v), status: 'assigned' })
            }}
          >
            <option value="">{COPY.assign}</option>
            {participant.team && <option value="none">— aus Team nehmen —</option>}
            {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </label>

        <details className="xl:col-span-3">
          <summary className="cursor-pointer select-none text-xs font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--amber)' }}>
            {COPY.details}
          </summary>
          <div className="mt-3 grid gap-3 lg:grid-cols-[12rem_12rem_minmax(14rem,1fr)_12rem] lg:items-end">
            <label className="flex flex-col gap-1.5">
              <span className="stat-label">{COPY.status}</span>
              <select
                className="input-field !py-1.5"
                value={participant.status}
                disabled={busy}
                onChange={e => patch({ status: e.target.value })}
              >
                {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>

            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy || !participant.team}
                onClick={() => patch({ is_captain: !participant.is_captain })}
                className={`flex-1 rounded-sm px-3 py-1.5 text-xs font-semibold transition ${participant.is_captain ? 'btn-amber' : 'btn-ghost'}`}
              >
                Captain
              </button>
              <button
                type="button"
                disabled={busy || !participant.team}
                onClick={() => patch({ is_bench: !participant.is_bench })}
                className={`flex-1 rounded-sm px-3 py-1.5 text-xs font-semibold transition ${participant.is_bench ? 'btn-amber' : 'btn-ghost'}`}
              >
                Bank
              </button>
            </div>

            <label className="flex min-w-0 flex-col gap-1.5">
              <span className="stat-label">{COPY.note}</span>
              <input
                className="input-field !py-1.5"
                placeholder="Coach-Notiz…"
                value={notesDraft}
                disabled={busy}
                onChange={e => setNotesDraft(e.target.value)}
              />
            </label>

            <button
              type="button"
              disabled={busy || notesDraft === (participant.notes ?? '')}
              onClick={() => patch({ notes: notesDraft })}
              className="btn-ghost rounded-sm px-3 py-1.5 text-xs"
            >
              Notiz
            </button>

            <button
              type="button"
              disabled={busy}
              onClick={() => resyncMutation.mutate()}
              className="btn-ghost rounded-sm px-3 py-1.5 text-xs lg:col-start-4"
              title="Discord-Rollen dieses Spielers anhand der aktuellen Team-Zuweisung neu setzen"
            >
              Discord-Rollen syncen
            </button>
          </div>

          <div className="mt-2 min-h-[1rem] text-xs">
            {sync && (
              <span style={{ color: sync.ok ? 'var(--green)' : 'var(--amber)' }}>
                {sync.detail}
              </span>
            )}
            {(mutation.isError || resyncMutation.isError) && (
              <span style={{ color: 'var(--red)' }}>
                {((mutation.error ?? resyncMutation.error) as Error)?.message}
              </span>
            )}
          </div>
        </details>
      </div>
    </div>
  )
}
