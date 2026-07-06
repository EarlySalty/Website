import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useLocation, useParams } from 'react-router-dom'
import type {
  DayOverlap,
  ScrimParticipantPatch,
  ScrimRosterSuggestResponse,
  ScrimRosterSuggestionCandidate,
  ScrimTeamBoardMember,
  ScrimWindow,
  Weekday,
  WeeklyOverlap,
} from '@/api/client'
import { scrims } from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import AvailabilityGrid from '@/components/AvailabilityGrid'
import { CoachOnly, EmptyState, PageSpinner, SectionHead } from '@/components/ui'
import { overlapWindowText, scrimWindowText, TIME_OPTIONS, WEEKDAYS } from '@/lib/availability'

const COPY = {
  fitSuffix: 'passen',
  rosterSuggest: 'Roster vorschlagen',
  useWindow: 'Wunsch-Fenster nutzen',
  day: 'Tag',
  from: 'von',
  to: 'bis',
  size: 'Größe',
  invalidWindow: 'Startzeit muss vor Endzeit liegen.',
  suggestion: 'Bestes Fenster',
  noSuggestion: 'Noch kein Vorschlag — auf „Roster vorschlagen" klicken.',
  noCandidates: 'Keine passenden Spieler im freien Pool gefunden.',
  fits: 'passt',
  minutes: 'min',
  assign: 'Zuweisen',
  remove: 'Aus Team nehmen',
} as const

interface WindowDraft {
  day: Weekday
  from: string
  to: string
}

interface BoardLocationState {
  suggestWindow?: ScrimWindow | null
}

interface ParticipantUpdate {
  participantId: number
  patch: ScrimParticipantPatch
}

function draftFromWindow(window: ScrimWindow | null | undefined): WindowDraft {
  return {
    day: window?.day ?? 'mon',
    from: String(window?.from ?? 1140),
    to: String(window?.to ?? 1320),
  }
}

function draftWindow(draft: WindowDraft): ScrimWindow | null {
  const from = Number(draft.from)
  const to = Number(draft.to)
  if (!Number.isFinite(from) || !Number.isFinite(to) || from >= to) return null
  return { day: draft.day, from, to }
}

export default function ScrimBoardPage() {
  const { isCoach } = useAuth()
  const qc = useQueryClient()
  const params = useParams()
  const location = useLocation()
  const routeState = location.state as BoardLocationState | null
  const initialWindow = routeState?.suggestWindow ?? null
  const teamId = Number(params.id)
  const [useWindow, setUseWindow] = useState(() => !!initialWindow)
  const [windowDraft, setWindowDraft] = useState(() => draftFromWindow(initialWindow))
  const [size, setSize] = useState('6')

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['scrim-board', teamId],
    queryFn: () => scrims.teamBoard(teamId),
    enabled: isCoach && Number.isFinite(teamId),
  })

  const selectedWindow = useWindow ? draftWindow(windowDraft) : null
  const invalidWindow = useWindow && !selectedWindow
  const requestedSize = Number(size) || 6

  const suggestMutation = useMutation({
    mutationFn: () => scrims.suggestRoster(teamId, { window: selectedWindow, size: requestedSize }),
  })

  const participantMutation = useMutation({
    mutationFn: ({ participantId, patch }: ParticipantUpdate) => scrims.updateParticipant(participantId, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['scrim-board'] })
      qc.invalidateQueries({ queryKey: ['scrim-pool'] })
      qc.invalidateQueries({ queryKey: ['scrim-me'] })
      suggestMutation.reset()
    },
  })

  if (!isCoach) return <CoachOnly />
  if (isLoading) return <PageSpinner />
  if (isError || !data) {
    return (
      <div className="content-grid py-12">
        <EmptyState title="Team-Board nicht verfügbar" copy={(error as Error)?.message ?? 'Bitte später erneut versuchen.'}>
          <Link to="/scrims" className="btn-ghost rounded-sm px-4 py-2 text-sm">Zurück zum Pool</Link>
        </EmptyState>
      </div>
    )
  }

  const { team, members, overlap } = data
  const nonBench = members.filter(m => !m.is_bench).length
  const nameOf = new Map(members.map(m => [m.participant_id, m.display_name]))
  const bestRoster = bestRosterWindow(overlap, nonBench)
  const updateBusy = participantMutation.isPending

  return (
    <div className="content-grid space-y-8 py-8">
      <div>
        <Link to="/scrims" className="eyebrow mb-2 inline-block hover:underline">← Scrim-Pool</Link>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="section-title">{team.name}</h1>
            <p className="section-copy">
              {team.coach ? `Coach ${team.coach} · ` : ''}{nonBench} Stamm-Spieler{members.length > nonBench ? ` · ${members.length - nonBench} Bank` : ''}
            </p>
          </div>
        </div>
      </div>

      <div className="panel-strong p-5">
        <SectionHead
          label="Bester Scrim-Zeitpunkt"
          action={
            <span className="badge badge-amber">
              {bestRoster ? bestRoster.day.available : 0}/{nonBench} {COPY.fitSuffix}
            </span>
          }
        />
        {bestRoster ? (
          <div className="flex flex-wrap gap-2">
            <span className="badge badge-amber">
              {bestRoster.long} · {overlapWindowText(bestRoster.day)}
            </span>
          </div>
        ) : (
          <p className="section-copy">
            Aktuell gibt es keinen Tag, an dem das ganze Stamm-Team ein gemeinsames Zeitfenster hat. Die Wochenübersicht unten
            zeigt, welche Tage am nächsten dran sind und wer noch fehlt.
          </p>
        )}
      </div>

      <div className="panel p-5">
        <SectionHead label={COPY.rosterSuggest} />
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_7rem_auto] lg:items-end">
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-primary)' }}>
              <input type="checkbox" checked={useWindow} onChange={e => setUseWindow(e.target.checked)} />
              <span>{COPY.useWindow}</span>
            </label>
            {useWindow && (
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="flex flex-col gap-1.5">
                  <span className="stat-label">{COPY.day}</span>
                  <select
                    className="input-field !py-1.5"
                    value={windowDraft.day}
                    onChange={e => setWindowDraft(current => ({ ...current, day: e.target.value as Weekday }))}
                  >
                    {WEEKDAYS.map(day => <option key={day.key} value={day.key}>{day.long}</option>)}
                  </select>
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="stat-label">{COPY.from}</span>
                  <select
                    className="input-field !py-1.5"
                    value={windowDraft.from}
                    onChange={e => setWindowDraft(current => ({ ...current, from: e.target.value }))}
                  >
                    {TIME_OPTIONS.map(opt => <option key={opt.value} value={String(opt.value)}>{opt.label}</option>)}
                  </select>
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="stat-label">{COPY.to}</span>
                  <select
                    className="input-field !py-1.5"
                    value={windowDraft.to}
                    onChange={e => setWindowDraft(current => ({ ...current, to: e.target.value }))}
                  >
                    {TIME_OPTIONS.map(opt => <option key={opt.value} value={String(opt.value)}>{opt.label}</option>)}
                  </select>
                </label>
              </div>
            )}
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="stat-label">{COPY.size}</span>
            <input
              type="number"
              min={1}
              max={12}
              className="input-field !py-1.5"
              value={size}
              onChange={e => setSize(e.target.value)}
            />
          </label>
          <button
            type="button"
            disabled={suggestMutation.isPending || invalidWindow}
            onClick={() => suggestMutation.mutate()}
            className="btn-amber rounded-sm px-4 py-2 text-sm"
          >
            {COPY.rosterSuggest}
          </button>
        </div>
        {invalidWindow && <p className="mt-2 text-xs" style={{ color: 'var(--red)' }}>{COPY.invalidWindow}</p>}
        {suggestMutation.isError && <p className="mt-2 text-xs" style={{ color: 'var(--red)' }}>{suggestMutation.error.message}</p>}
        <SuggestionResult
          result={suggestMutation.data}
          window={suggestMutation.data?.best_window ?? selectedWindow}
          busy={updateBusy}
          onAssign={(participantId) => participantMutation.mutate({ participantId, patch: { team_id: teamId, status: 'assigned' } })}
        />
      </div>

      <div>
        <SectionHead label="Verfügbarkeit der Woche" />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          {WEEKDAYS.map(({ key, long, short }) => (
            <OverlapDayCard key={key} short={short} long={long} day={overlap[key]} total={nonBench} nameOf={nameOf} />
          ))}
        </div>
      </div>

      <div>
        <SectionHead label="Kader" count={members.length} />
        <div className="space-y-3">
          {members.map(m => (
            <MemberRow
              key={m.participant_id}
              member={m}
              busy={updateBusy}
              onRemove={() => participantMutation.mutate({ participantId: m.participant_id, patch: { team_id: null } })}
            />
          ))}
        </div>
        {participantMutation.isError && <p className="mt-2 text-xs" style={{ color: 'var(--red)' }}>{participantMutation.error.message}</p>}
      </div>
    </div>
  )
}

function bestRosterWindow(overlap: WeeklyOverlap, total: number) {
  if (total === 0) return null
  const best = WEEKDAYS
    .map(({ key, long }) => ({ key, long, day: overlap[key] }))
    .sort((left, right) => {
      const leftMinutes = (left.day.window_to ?? 0) - (left.day.window_from ?? 0)
      const rightMinutes = (right.day.window_to ?? 0) - (right.day.window_from ?? 0)
      return right.day.available - left.day.available || rightMinutes - leftMinutes
    })[0]
  return best.day.window_from == null || best.day.window_to == null ? null : best
}

function SuggestionResult({
  result,
  window,
  busy,
  onAssign,
}: {
  result: ScrimRosterSuggestResponse | undefined
  window: ScrimWindow | null
  busy: boolean
  onAssign: (participantId: number) => void
}) {
  if (!result) {
    return <p className="mt-4 text-sm" style={{ color: 'var(--text-muted)' }}>{COPY.noSuggestion}</p>
  }

  return (
    <div className="mt-4 space-y-3">
      <div className="flex flex-wrap gap-2">
        <span className="badge badge-amber">
          {COPY.suggestion}: {result.best_window ? scrimWindowText(result.best_window) : '—'}
        </span>
        <span className="badge">
          {result.fit_count}/{result.requested_size} {COPY.fitSuffix}
        </span>
      </div>
      {result.candidates.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{COPY.noCandidates}</p>
      ) : (
        <div className="space-y-2">
          {result.candidates.map(candidate => (
            <CandidateRow
              key={candidate.participant_id}
              candidate={candidate}
              window={window}
              busy={busy}
              onAssign={() => onAssign(candidate.participant_id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function CandidateRow({
  candidate,
  window,
  busy,
  onAssign,
}: {
  candidate: ScrimRosterSuggestionCandidate
  window: ScrimWindow | null
  busy: boolean
  onAssign: () => void
}) {
  const pct = Math.round(candidate.fit_ratio * 100)
  const fitText = window && candidate.fit_minutes > 0
    ? `${COPY.fits} ${scrimWindowText(window)} · ${candidate.fit_minutes} ${COPY.minutes} · ${pct}%`
    : `${candidate.fit_minutes} ${COPY.minutes} · ${pct}%`

  return (
    <div className="card grid gap-3 p-3 lg:grid-cols-[minmax(11rem,0.8fr)_minmax(18rem,1.2fr)_auto] lg:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-display text-base font-bold" style={{ color: 'var(--text-primary)' }}>{candidate.display_name}</span>
          {!candidate.availability_confirmed && <span className="badge" title="Verfügbarkeit stammt aus der alten Liste, nicht selbst bestätigt">unbestätigt</span>}
        </div>
        <p className="mt-1 truncate text-sm" style={{ color: 'var(--text-muted)' }}>
          {[candidate.rank || '—', candidate.roles || '—'].join(' · ')}
        </p>
        <span className="badge mt-2 inline-flex">{fitText}</span>
      </div>
      <AvailabilityGrid weekly={candidate.availability_slots} compact />
      <button type="button" disabled={busy} onClick={onAssign} className="btn-amber rounded-sm px-4 py-2 text-sm">
        {COPY.assign}
      </button>
    </div>
  )
}

function OverlapDayCard({
  short,
  long,
  day,
  total,
  nameOf,
}: {
  short: string
  long: string
  day: DayOverlap
  total: number
  nameOf: Map<number, string>
}) {
  const blockers = [...day.unavailable_ids, ...day.unknown_ids]
    .map(id => nameOf.get(id))
    .filter((n): n is string => !!n)
  return (
    <div
      className="flex flex-col gap-1 rounded-sm p-3"
      style={
        day.full_squad
          ? { background: 'var(--amber-glow)', border: '1px solid var(--amber-border)' }
          : { background: 'var(--bg-surface)', border: '1px solid var(--border-dim)' }
      }
    >
      <div className="flex items-baseline justify-between">
        <span className="font-mono-data text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          {short}
        </span>
        {day.full_squad && <span className="font-mono-data text-[10px] font-bold" style={{ color: 'var(--amber)' }}>komplett</span>}
      </div>
      <div className="font-display text-2xl font-extrabold" style={{ color: day.full_squad ? 'var(--amber)' : 'var(--text-primary)' }}>
        {day.available}<span className="text-sm" style={{ color: 'var(--text-muted)' }}>/{total}</span>
      </div>
      <div className="font-mono-data text-xs" style={{ color: 'var(--text-primary)' }}>
        {overlapWindowText(day)}
      </div>
      {blockers.length > 0 && (
        <div className="text-[10px] leading-tight" style={{ color: 'var(--text-muted)' }} title={`${long}: ${blockers.join(', ')}`}>
          fehlt: {blockers.join(', ')}
        </div>
      )}
    </div>
  )
}

function MemberRow({
  member,
  busy,
  onRemove,
}: {
  member: ScrimTeamBoardMember
  busy: boolean
  onRemove: () => void
}) {
  return (
    <div className="card p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="font-display text-base font-bold" style={{ color: 'var(--text-primary)' }}>
          {member.display_name}
        </span>
        {member.is_captain && <span className="badge badge-amber">Captain</span>}
        {member.is_bench && <span className="badge">Bank</span>}
        {!member.availability_confirmed && <span className="badge" title="Verfügbarkeit stammt aus der alten Liste, nicht selbst bestätigt">unbestätigt</span>}
        {!member.discord_linked && <span className="badge" title="Kein Discord-Account verknüpft">kein Discord</span>}
        {member.rank && <span className="stat-label ml-auto">{member.rank}</span>}
        <button type="button" disabled={busy} onClick={onRemove} className="btn-ghost rounded-sm px-3 py-1.5 text-xs">
          {COPY.remove}
        </button>
      </div>
      {member.roles && <p className="mb-2 text-xs" style={{ color: 'var(--text-muted)' }}>{member.roles}</p>}
      <AvailabilityGrid weekly={member.availability} />
      {member.notes && (
        <p className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
          <span className="stat-label">Notiz</span> {member.notes}
        </p>
      )}
    </div>
  )
}
