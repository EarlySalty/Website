import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import type { DayOverlap, ScrimTeamBoardMember } from '@/api/client'
import { scrims } from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import AvailabilityGrid from '@/components/AvailabilityGrid'
import { CoachOnly, EmptyState, PageSpinner, SectionHead } from '@/components/ui'
import { overlapWindowText, WEEKDAYS } from '@/lib/availability'

export default function ScrimBoardPage() {
  const { isCoach } = useAuth()
  const params = useParams()
  const teamId = Number(params.id)

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['scrim-board', teamId],
    queryFn: () => scrims.teamBoard(teamId),
    enabled: isCoach && Number.isFinite(teamId),
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
  const bestDays = WEEKDAYS.filter(d => overlap[d.key].full_squad)

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

      {/* Empfohlene Termine */}
      <div className="panel-strong p-5">
        <SectionHead label="Bester Scrim-Zeitpunkt" />
        {bestDays.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {bestDays.map(d => (
              <span key={d.key} className="badge badge-amber">
                {d.long} · {overlapWindowText(overlap[d.key])} · komplett
              </span>
            ))}
          </div>
        ) : (
          <p className="section-copy">
            Aktuell gibt es keinen Tag, an dem das ganze Stamm-Team ein gemeinsames Zeitfenster hat. Die Wochenübersicht unten
            zeigt, welche Tage am nächsten dran sind und wer noch fehlt.
          </p>
        )}
      </div>

      {/* Wochen-Overlap */}
      <div>
        <SectionHead label="Verfügbarkeit der Woche" />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          {WEEKDAYS.map(({ key, long, short }) => (
            <OverlapDayCard key={key} short={short} long={long} day={overlap[key]} total={nonBench} nameOf={nameOf} />
          ))}
        </div>
      </div>

      {/* Kader */}
      <div>
        <SectionHead label="Kader" count={members.length} />
        <div className="space-y-3">
          {members.map(m => (
            <MemberRow key={m.participant_id} member={m} />
          ))}
        </div>
      </div>
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

function MemberRow({ member }: { member: ScrimTeamBoardMember }) {
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
