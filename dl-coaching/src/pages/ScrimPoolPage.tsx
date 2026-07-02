import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { scrims, type DiscordSyncStatus, type ScrimParticipantPatch, type ScrimPoolParticipant, type ScrimTeam } from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import AvailabilityGrid from '@/components/AvailabilityGrid'
import { CoachOnly, EmptyState, PageSpinner, SectionHead } from '@/components/ui'

const STATUS_OPTIONS = [
  { value: 'new', label: 'Neu' },
  { value: 'waitlist', label: 'Warteliste' },
  { value: 'assigned', label: 'Zugewiesen' },
  { value: 'inactive', label: 'Inaktiv' },
] as const

const FILTER_OPTIONS = [{ value: '', label: 'Alle' }, ...STATUS_OPTIONS] as const

function statusLabel(value: string): string {
  return STATUS_OPTIONS.find(o => o.value === value)?.label ?? value
}

export default function ScrimPoolPage() {
  const { isCoach } = useAuth()
  const [filter, setFilter] = useState('')

  const teamsQuery = useQuery({ queryKey: ['scrim-teams'], queryFn: () => scrims.teams(), enabled: isCoach })
  const poolQuery = useQuery({
    queryKey: ['scrim-pool', filter],
    queryFn: () => scrims.pool(filter || undefined),
    enabled: isCoach,
  })

  if (!isCoach) return <CoachOnly />

  const teams = teamsQuery.data ?? []
  const pool = poolQuery.data ?? []

  return (
    <div className="content-grid space-y-8 py-8">
      <div>
        <h1 className="section-title">Scrim-Verwaltung</h1>
        <p className="section-copy">
          Teams, Kader und Verfügbarkeit an einem Ort. Öffne ein Team-Board, um den besten gemeinsamen Scrim-Termin zu sehen.
        </p>
      </div>

      {/* Teams → Boards */}
      <div>
        <SectionHead label="Teams" count={teams.length} />
        {teams.length === 0 ? (
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

      {/* Pool */}
      <div>
        <SectionHead
          label="Spieler-Pool"
          count={pool.length}
          action={
            <select className="input-field !w-40 !py-1.5" value={filter} onChange={e => setFilter(e.target.value)}>
              {FILTER_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          }
        />
        {poolQuery.isLoading ? (
          <PageSpinner />
        ) : pool.length === 0 ? (
          <EmptyState title="Keine Spieler" copy="Für diesen Filter gibt es aktuell keine Einträge." />
        ) : (
          <div className="space-y-3">
            {pool.map(p => (
              <PoolRow key={p.id} participant={p} teams={teams} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function PoolRow({ participant, teams }: { participant: ScrimPoolParticipant; teams: ScrimTeam[] }) {
  const qc = useQueryClient()
  const [notesDraft, setNotesDraft] = useState(participant.notes ?? '')
  const [sync, setSync] = useState<DiscordSyncStatus | null>(null)

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
    <div className="card p-4">
      <div className="flex flex-col gap-4 lg:flex-row">
        {/* Info + Verfügbarkeit */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-display text-base font-bold" style={{ color: 'var(--text-primary)' }}>
              {participant.display_name}
            </span>
            <span className="badge">{statusLabel(participant.status)}</span>
            {participant.team && <span className="badge badge-amber">{participant.team.name}{participant.is_captain ? ' · C' : ''}{participant.is_bench ? ' · Bank' : ''}</span>}
            {!participant.availability_confirmed && <span className="badge" title="Verfügbarkeit nicht selbst bestätigt">unbestätigt</span>}
            {!participant.discord_linked && <span className="badge" title="Kein Discord verknüpft">kein Discord</span>}
            {(participant.rank || participant.roles) && (
              <span className="stat-label ml-auto">{[participant.rank, participant.roles].filter(Boolean).join(' · ')}</span>
            )}
          </div>
          <div className="mt-3">
            <AvailabilityGrid weekly={participant.availability_slots} />
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-col gap-2 lg:w-72">
          <div className="flex gap-2">
            <select
              className="input-field !py-1.5"
              value={participant.status}
              disabled={busy}
              onChange={e => patch({ status: e.target.value })}
            >
              {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <select
              className="input-field !py-1.5"
              value={participant.team?.id ?? ''}
              disabled={busy || teams.length === 0}
              onChange={e => {
                const v = e.target.value
                if (v === '') return
                if (v === 'none') patch({ team_id: null })
                else patch({ team_id: Number(v), status: 'assigned' })
              }}
            >
              <option value="">Team zuweisen…</option>
              {participant.team && <option value="none">— aus Team nehmen —</option>}
              {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
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
          <div className="flex gap-2">
            <input
              className="input-field !py-1.5 flex-1"
              placeholder="Coach-Notiz…"
              value={notesDraft}
              disabled={busy}
              onChange={e => setNotesDraft(e.target.value)}
            />
            <button
              type="button"
              disabled={busy || notesDraft === (participant.notes ?? '')}
              onClick={() => patch({ notes: notesDraft })}
              className="btn-ghost rounded-sm px-3 py-1.5 text-xs"
            >
              Notiz
            </button>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => resyncMutation.mutate()}
            className="btn-ghost rounded-sm px-3 py-1.5 text-xs"
            title="Discord-Rollen dieses Spielers anhand der aktuellen Team-Zuweisung neu setzen"
          >
            Discord-Rollen syncen
          </button>
          {sync && (
            <span className="text-xs" style={{ color: sync.ok ? 'var(--green)' : 'var(--amber)' }}>
              {sync.detail}
            </span>
          )}
          {(mutation.isError || resyncMutation.isError) && (
            <span className="text-xs" style={{ color: 'var(--red)' }}>
              {((mutation.error ?? resyncMutation.error) as Error)?.message}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
