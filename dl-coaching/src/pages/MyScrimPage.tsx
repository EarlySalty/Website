import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import type { WeeklyAvailability } from '@/api/client'
import { scrims } from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import AvailabilityEditor from '@/components/AvailabilityEditor'
import { EmptyState, PageSpinner, SectionHead } from '@/components/ui'
import { emptyWeekly } from '@/lib/availability'

export default function MyScrimPage() {
  const { user, login } = useAuth()
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['scrim-me'],
    queryFn: () => scrims.me(),
    enabled: !!user,
  })

  const [draft, setDraft] = useState<WeeklyAvailability>(emptyWeekly())
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (data?.participant) setDraft(data.participant.availability_slots)
  }, [data?.participant])

  const mutation = useMutation({
    mutationFn: (weekly: WeeklyAvailability) => scrims.setAvailability(weekly),
    onSuccess: () => {
      setSaved(true)
      qc.invalidateQueries({ queryKey: ['scrim-me'] })
      qc.invalidateQueries({ queryKey: ['scrim-pool'] })
    },
  })

  if (!user) {
    return (
      <div className="content-grid py-16">
        <EmptyState title="Melde dich an" copy="Logge dich mit Discord ein, um dein Scrim-Team und deine Verfügbarkeit zu sehen.">
          <button onClick={login} className="btn-amber rounded-sm px-5 py-2 text-sm">Mit Discord anmelden</button>
        </EmptyState>
      </div>
    )
  }

  if (isLoading) return <PageSpinner />

  const participant = data?.participant ?? null
  const team = data?.team ?? null
  const members = data?.members ?? []
  const nextMatch = data?.next_match ?? null

  if (!participant) {
    return (
      <div className="content-grid py-16">
        <EmptyState
          title="Noch nicht im Scrim-Pool"
          copy="Melde dich einmal für den Scrim-Pool an, dann kannst du hier deine Verfügbarkeit pflegen."
        >
          <Link to="/scrims/signup" className="btn-amber rounded-sm px-5 py-2 text-sm">Zum Scrim-Pool anmelden</Link>
        </EmptyState>
      </div>
    )
  }

  return (
    <div className="content-grid space-y-8 py-8">
      <div>
        <h1 className="section-title">Mein Scrim-Team</h1>
        <p className="section-copy">Halte deine Verfügbarkeit aktuell — daraus finden die Coaches den besten Scrim-Termin.</p>
      </div>

      {team ? (
        <div className="panel-strong p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="font-display text-xl font-extrabold" style={{ color: 'var(--amber)' }}>{team.name}</span>
            {team.coach && <span className="stat-label">Coach {team.coach}</span>}
          </div>
          {nextMatch && (
            <p className="mt-2 text-sm" style={{ color: 'var(--text-primary)' }}>
              Nächstes Match: {nextMatch.opponent_team_name ?? 'Gegner offen'}
              {nextMatch.when_text ? ` · ${nextMatch.when_text}` : ''}
            </p>
          )}
          {members.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {members.map(m => (
                <span key={m.participant_id} className={`badge${m.is_captain ? ' badge-amber' : ''}`}>
                  {m.display_name}{m.is_captain ? ' · C' : ''}{m.is_bench ? ' · Bank' : ''}
                </span>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="panel p-5">
          <p className="section-copy">
            Du bist im Pool, aber noch keinem Team zugeordnet. Halte deine Verfügbarkeit trotzdem aktuell — so kann dich ein Coach passend einplanen.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {participant.rank && <span className="badge">{participant.rank}</span>}
            {participant.roles && <span className="badge">{participant.roles}</span>}
            <span className="badge">Status: {participant.status}</span>
          </div>
        </div>
      )}

      <div>
        <SectionHead
          label="Meine Verfügbarkeit"
          action={
            <button
              onClick={() => mutation.mutate(draft)}
              disabled={mutation.isPending}
              className="btn-amber rounded-sm px-4 py-1.5 text-xs"
            >
              {mutation.isPending ? 'Speichert…' : 'Speichern'}
            </button>
          }
        />
        {!participant.availability_confirmed && (
          <p className="mb-3 text-xs" style={{ color: 'var(--amber)' }}>
            Deine Verfügbarkeit wurde aus der alten Scrim-Liste übernommen — bitte einmal prüfen und speichern.
          </p>
        )}
        <AvailabilityEditor value={draft} onChange={next => { setDraft(next); setSaved(false) }} disabled={mutation.isPending} />
        <div className="mt-3 min-h-[1.25rem] text-sm">
          {mutation.isError && <span style={{ color: 'rgba(229, 72, 77, 0.9)' }}>{(mutation.error as Error).message}</span>}
          {saved && !mutation.isPending && <span style={{ color: 'var(--amber)' }}>Verfügbarkeit gespeichert.</span>}
        </div>
      </div>
    </div>
  )
}
