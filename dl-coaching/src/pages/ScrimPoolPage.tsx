import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { scrims, type ScrimParticipantPatch, type ScrimPoolParticipant, type ScrimTeam } from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import { CoachOnly, EmptyState, PageSpinner, SectionHead } from '@/components/ui'

const STATUS_OPTIONS = [
  { value: 'new', label: 'Neu' },
  { value: 'assigned', label: 'Zugewiesen' },
] as const

const FILTER_OPTIONS = [
  { value: '', label: 'Alle' },
  ...STATUS_OPTIONS,
] as const

const EMPTY_VALUE = 'Keine Angabe'

function valueOrEmpty(value: string | null | undefined): string {
  return value?.trim() || EMPTY_VALUE
}

function statusLabel(status: string): string {
  return STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status
}

function PoolParticipantRow({ participant, teams }: { participant: ScrimPoolParticipant; teams: ScrimTeam[] }) {
  const qc = useQueryClient()
  const [status, setStatus] = useState(participant.status)
  const [teamId, setTeamId] = useState(participant.team ? String(participant.team.id) : '')
  const [isBench, setIsBench] = useState(participant.is_bench)
  const [isCaptain, setIsCaptain] = useState(participant.is_captain)

  const save = useMutation({
    mutationFn: (payload: ScrimParticipantPatch) => scrims.updateParticipant(participant.id, payload),
    onSuccess: (updated) => {
      setStatus(updated.status)
      setTeamId(updated.team ? String(updated.team.id) : '')
      setIsBench(updated.is_bench)
      setIsCaptain(updated.is_captain)
      qc.invalidateQueries({ queryKey: ['scrim-pool'] })
      qc.invalidateQueries({ queryKey: ['scrim-me'] })
    },
  })

  const selectedTeamId = teamId ? Number(teamId) : undefined
  const hasTeamSelection = selectedTeamId !== undefined
  const selectedTeamMissing = !!participant.team
    && String(participant.team.id) === teamId
    && !teams.some((team) => String(team.id) === teamId)
  const hasStatusOption = STATUS_OPTIONS.some((option) => option.value === status)

  return (
    <div className="card p-4">
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr_1.4fr] lg:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-[15px] font-bold uppercase tracking-[0.04em] text-white">
              {participant.display_name}
            </h3>
            <span className="badge badge-amber">{statusLabel(participant.status)}</span>
          </div>
          <div className="mt-2 grid gap-x-4 gap-y-1 text-xs sm:grid-cols-2" style={{ color: 'var(--text-secondary)' }}>
            <p><span className="stat-label">Rang</span> {valueOrEmpty(participant.rank)}</p>
            <p><span className="stat-label">Rollen</span> {valueOrEmpty(participant.roles)}</p>
            <p className="sm:col-span-2">
              <span className="stat-label">Verfügbarkeit</span> {valueOrEmpty(participant.availability)}
            </p>
          </div>
        </div>

        <div className="text-sm">
          <p className="stat-label mb-1">Team</p>
          {participant.team ? (
            <div style={{ color: 'var(--text-secondary)' }}>
              <p className="font-display font-bold text-white">{participant.team.name}</p>
              <p className="text-xs">
                ID {participant.team.id}
                {participant.team.coach ? ` · ${participant.team.coach}` : ''}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {participant.is_captain && <span className="badge badge-amber">Captain</span>}
                {participant.is_bench && <span className="badge badge-completed">Bench</span>}
              </div>
            </div>
          ) : (
            <p style={{ color: 'var(--text-muted)' }}>Kein Team</p>
          )}
        </div>

        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault()
            const payload: ScrimParticipantPatch = {
              status,
            }
            if (selectedTeamId !== undefined) {
              payload.team_id = selectedTeamId
              payload.is_bench = isBench
              payload.is_captain = isCaptain
            }
            save.mutate(payload)
          }}
        >
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="stat-label">Status</span>
              <select value={status} onChange={(event) => setStatus(event.target.value)} className="input-field">
                {!hasStatusOption && <option value={status}>{status}</option>}
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="stat-label">Team</span>
              <select
                value={teamId}
                onChange={(event) => setTeamId(event.target.value)}
                className="input-field"
              >
                <option value="">Kein Team</option>
                {selectedTeamMissing && (
                  <option value={teamId}>{participant.team?.name ?? teamId}</option>
                )}
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>{team.name}</option>
                ))}
              </select>
            </label>
          </div>

          {hasTeamSelection && (
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                <input type="checkbox" checked={isBench} onChange={(event) => setIsBench(event.target.checked)} />
                Bench
              </label>
              <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                <input type="checkbox" checked={isCaptain} onChange={(event) => setIsCaptain(event.target.checked)} />
                Captain
              </label>
            </div>
          )}

          {save.isError && (
            <p className="text-xs" style={{ color: 'var(--red)' }}>Änderung konnte nicht gespeichert werden.</p>
          )}
          {save.isSuccess && (
            <p className="text-xs" style={{ color: 'var(--green)' }}>Änderung gespeichert.</p>
          )}

          <button type="submit" className="btn-amber !px-3 !py-1.5 !text-xs" disabled={save.isPending}>
            Speichern
          </button>
        </form>
      </div>
    </div>
  )
}

export default function ScrimPoolPage() {
  const { isCoach, isLoading: authLoading } = useAuth()
  const [statusFilter, setStatusFilter] = useState('')

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['scrim-pool', statusFilter],
    queryFn: () => scrims.pool(statusFilter || undefined),
    enabled: isCoach,
  })
  const {
    data: teamsData,
    isLoading: teamsLoading,
    isError: teamsIsError,
    error: teamsError,
  } = useQuery({
    queryKey: ['scrim-teams'],
    queryFn: () => scrims.teams(),
    enabled: isCoach,
  })

  if (authLoading) return <PageSpinner />
  if (!isCoach) return <CoachOnly />

  const participants = data ?? []
  const teams = teamsData ?? []
  const combinedError = error ?? teamsError
  const errorMessage = combinedError instanceof Error ? combinedError.message : 'Pool konnte nicht geladen werden.'
  const loading = isLoading || teamsLoading
  const hasError = isError || teamsIsError

  return (
    <div className="content-grid pb-16 pt-10 md:pt-14">
      <div className="animate-in-left mb-8">
        <div className="eyebrow mb-4">Coach-Bereich</div>
        <h1 className="section-title">Scrim-Pool</h1>
        <p className="section-copy mt-2">Teilnehmer filtern, Status setzen und Team-Zuweisungen speichern.</p>
      </div>

      <SectionHead
        label="Teilnehmer"
        count={loading ? undefined : participants.length}
        action={
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="input-field w-44 !py-1.5"
          >
            {FILTER_OPTIONS.map((option) => (
              <option key={option.value || 'all'} value={option.value}>{option.label}</option>
            ))}
          </select>
        }
      />

      {loading ? (
        <div className="flex justify-center py-10"><div className="spinner h-7 w-7" /></div>
      ) : hasError ? (
        <EmptyState title="Fehler beim Laden" copy={errorMessage} />
      ) : participants.length > 0 ? (
        <div className="space-y-3">
          {participants.map((participant) => (
            <PoolParticipantRow key={participant.id} participant={participant} teams={teams} />
          ))}
        </div>
      ) : (
        <EmptyState title="Pool ist leer" copy="Für diesen Status gibt es aktuell keine Teilnehmer." />
      )}
    </div>
  )
}
