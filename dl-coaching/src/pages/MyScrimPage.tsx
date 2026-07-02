import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { scrims, type ScrimTeamMember } from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import { EmptyState, PageSpinner, SectionHead } from '@/components/ui'
import { fmtDateTime } from '@/lib/format'

const EMPTY_VALUE = 'Keine Angabe'

const STATUS_LABELS: Record<string, string> = {
  new: 'Neu',
  assigned: 'Zugewiesen',
  planned: 'Geplant',
}

function valueOrEmpty(value: string | null | undefined): string {
  return value?.trim() || EMPTY_VALUE
}

function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status
}

function MemberRow({ member }: { member: ScrimTeamMember }) {
  return (
    <div className="card flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
      <div className="min-w-0 flex-1">
        <p className="font-display truncate font-bold uppercase tracking-[0.04em] text-white">
          {member.display_name}
        </p>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {valueOrEmpty(member.role)}
        </p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {member.is_captain && <span className="badge badge-amber">Captain</span>}
        {member.is_bench && <span className="badge badge-completed">Bench</span>}
      </div>
    </div>
  )
}

export default function MyScrimPage() {
  const { user, login, isLoading: authLoading } = useAuth()
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['scrim-me'],
    queryFn: () => scrims.me(),
    enabled: !!user,
  })

  if (authLoading) return <PageSpinner />

  if (!user) {
    return (
      <div className="content-grid pb-16 pt-10 md:pt-14">
        <div className="eyebrow mb-4">Scrims</div>
        <h1 className="section-title mb-8">Mein Team</h1>
        <EmptyState
          title="Anmeldung nötig"
          copy="Melde dich mit Discord an, um dein Scrim-Team zu sehen."
        >
          <button onClick={login} className="btn-amber">Login mit Discord</button>
        </EmptyState>
      </div>
    )
  }

  if (isLoading) return <PageSpinner />

  if (isError) {
    const message = error instanceof Error ? error.message : 'Daten konnten nicht geladen werden.'
    return (
      <div className="content-grid pb-16 pt-10 md:pt-14">
        <div className="eyebrow mb-4">Scrims</div>
        <h1 className="section-title mb-8">Mein Team</h1>
        <EmptyState title="Fehler beim Laden" copy={message} />
      </div>
    )
  }

  if (!data?.participant) {
    return (
      <div className="content-grid pb-16 pt-10 md:pt-14">
        <div className="eyebrow mb-4">Scrims</div>
        <h1 className="section-title mb-8">Mein Team</h1>
        <EmptyState
          title="Noch nicht angemeldet"
          copy="Trage dich in die Web-Anmeldung ein, damit Coaches dich im Pool sehen."
        >
          <Link to="/scrims/signup" className="btn-amber">Zur Anmeldung</Link>
        </EmptyState>
      </div>
    )
  }

  const { participant, team, members, next_match } = data
  const nextMatchTime = next_match?.when_text || fmtDateTime(next_match?.scheduled_at)

  return (
    <div className="content-grid pb-16 pt-10 md:pt-14">
      <div className="animate-in-left mb-8">
        <div className="eyebrow mb-4">Scrims</div>
        <h1 className="section-title">Mein Team</h1>
        <p className="section-copy mt-2">Dein Status, dein Team und das nächste Match auf einen Blick.</p>
      </div>

      <div className="panel animate-in mb-10 p-6">
        <div className="flex flex-wrap items-start gap-8">
          <div>
            <p className="stat-label mb-0.5">Spieler</p>
            <p className="font-display text-lg font-bold uppercase text-white">{participant.display_name}</p>
          </div>
          <div>
            <p className="stat-label mb-0.5">Status</p>
            <p className="font-display text-lg font-bold text-white">{statusLabel(participant.status)}</p>
          </div>
          <div>
            <p className="stat-label mb-0.5">Rang</p>
            <p className="font-display text-lg font-bold text-white">{valueOrEmpty(participant.rank)}</p>
          </div>
          <div className="min-w-[180px] flex-1">
            <p className="stat-label mb-0.5">Rollen</p>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{valueOrEmpty(participant.roles)}</p>
          </div>
          <div className="min-w-[180px] flex-1">
            <p className="stat-label mb-0.5">Verfügbarkeit</p>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{valueOrEmpty(participant.availability)}</p>
          </div>
        </div>
      </div>

      {team ? (
        <>
          <div
            className="panel-strong animate-in relative mb-8 overflow-hidden p-6"
            style={{ borderColor: 'var(--amber-border)' }}
          >
            <div className="flex flex-wrap items-start gap-x-10 gap-y-4">
              <div>
                <p className="stat-label mb-1">Team</p>
                <p className="font-display text-2xl font-bold uppercase text-white">{team.name}</p>
              </div>
              <div>
                <p className="stat-label mb-1">Coach</p>
                <p className="font-display text-lg font-bold text-white">{valueOrEmpty(team.coach)}</p>
              </div>
              <div className="min-w-[220px] flex-1">
                <p className="stat-label mb-1">Nächstes Match</p>
                {next_match ? (
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    <span className="font-semibold text-white">
                      {valueOrEmpty(next_match.opponent_team_name)}
                    </span>{' '}
                    · {nextMatchTime} · {statusLabel(next_match.status)}
                  </p>
                ) : (
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Noch kein Match geplant.</p>
                )}
              </div>
            </div>
          </div>

          <section>
            <SectionHead label="Mitglieder" count={members.length} />
            {members.length > 0 ? (
              <div className="space-y-2">
                {members.map((member) => <MemberRow key={member.participant_id} member={member} />)}
              </div>
            ) : (
              <EmptyState title="Keine Mitglieder" copy="Das Team hat aktuell keine sichtbaren Einträge." />
            )}
          </section>
        </>
      ) : (
        <EmptyState
          title="Noch kein Team"
          copy="Du bist im Scrim-Pool sichtbar, aber noch keinem Team zugewiesen."
        >
          <Link to="/scrims/signup" className="btn-ghost">Anmeldung bearbeiten</Link>
        </EmptyState>
      )}
    </div>
  )
}
