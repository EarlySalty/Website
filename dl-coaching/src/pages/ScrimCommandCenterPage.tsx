import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'

import { ApiError, scrims } from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import { CoachOnly, EmptyState, PageSpinner, SectionHead } from '@/components/ui'
import {
  openBatches,
  resolveAttention,
  splitLagebildText,
  upcomingMatches,
  type AttentionKind,
  type LagebildRef,
  type MatchRequestBatch,
  type OperationalMatch,
  type ResolvedAttention,
} from '@/lib/commandCenter'

const COPY = {
  title: 'Scrim-Lage',
  intro:
    'Alles, was gerade auf eine Entscheidung wartet: offene Abfragen, anstehende Spiele und die zuletzt erzeugten Lagebilder. Ein Aufruf, ein Bildschirm.',
  attention: 'Braucht Aufmerksamkeit',
  attentionEmpty: 'Nichts liegt an',
  attentionEmptyCopy: 'Keine offenen Rückfragen, kein fehlender Ersatz, keine Fehler. Alles läuft.',
  batches: 'Offene Abfragen',
  batchesEmpty: 'Keine offene Abfrage',
  batchesEmptyCopy: 'Sobald eine Terminabfrage läuft, steht sie hier mit ihrer Deadline.',
  matches: 'Anstehende Spiele',
  matchesEmpty: 'Keine Spiele geplant',
  matchesEmptyCopy: 'Angesetzte Scrims erscheinen hier, sobald ein Termin steht.',
  lagebilder: 'Lagebilder',
  lagebilderEmpty: 'Noch keine Lagebilder',
  lagebilderEmptyCopy: 'Für die Teams wurde bisher kein Lagebild erzeugt.',
  evidences: 'Belege',
  unavailableTitle: 'Die Scrim-Lage ist noch nicht freigeschaltet',
  unavailableCopy:
    'Dieser Bildschirm liest aus dem Turnier-Dienst. Solange die Website noch auf dem alten Scrim-Backend läuft, gibt es diese Übersicht nicht. Der Scrim-Pool und die Team-Boards funktionieren normal weiter.',
  toPool: 'Zum Scrim-Pool',
  errorTitle: 'Die Lage lässt sich gerade nicht laden',
  deadline: 'Deadline',
  overdue: 'überfällig',
  createdBy: 'angelegt von',
  requests: 'Paarungen',
  noDate: 'Termin offen',
  lobbyOpen: 'Lobby offen',
}

const ATTENTION_LABEL: Record<AttentionKind, string> = {
  missing_responses: 'Antworten fehlen',
  replacement: 'Ersatz gesucht',
  error: 'Fehler',
}

const TEMPLATE_LABEL: Record<string, string> = {
  regular_scrim: 'Scrim',
  testmatch: 'Testmatch',
  training: 'Training',
}

export default function ScrimCommandCenterPage() {
  const { isCoach } = useAuth()

  const query = useQuery({
    queryKey: ['scrim-command-center'],
    queryFn: () => scrims.commandCenter(),
    enabled: isCoach,
    // Ein 404 heisst hier "Route im Legacy-Modus nicht gemountet", nicht "kaputt" — nicht nachschlagen.
    retry: (count, error) => !(error instanceof ApiError && error.status === 404) && count < 2,
  })

  if (!isCoach) return <CoachOnly />
  if (query.isLoading) return <PageSpinner />

  if (query.error) {
    const notMounted = query.error instanceof ApiError && query.error.status === 404
    return (
      <div className="content-grid py-16">
        <EmptyState
          title={notMounted ? COPY.unavailableTitle : COPY.errorTitle}
          copy={notMounted ? COPY.unavailableCopy : query.error.message}
        >
          <Link to="/scrims" className="btn-amber rounded-sm px-4 py-2 text-sm">
            {COPY.toPool}
          </Link>
        </EmptyState>
      </div>
    )
  }

  const data = query.data!
  const attention = resolveAttention(data)
  const batches = openBatches(data)
  const matches = upcomingMatches(data)
  const teamName = new Map(data.teams.map(team => [String(team.id), team.name]))

  return (
    <div className="content-grid space-y-10 py-8">
      <div>
        <h1 className="font-display text-3xl font-extrabold" style={{ color: 'var(--text-primary)' }}>
          {COPY.title}
        </h1>
        <p className="mt-2 max-w-2xl text-sm" style={{ color: 'var(--text-muted)' }}>
          {COPY.intro}
        </p>
      </div>

      <section>
        <SectionHead label={COPY.attention} count={attention.length} />
        {attention.length === 0 ? (
          <EmptyState title={COPY.attentionEmpty} copy={COPY.attentionEmptyCopy} />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {attention.map((entry, index) => (
              <AttentionCard key={`${entry.kind}-${entry.source}-${entryId(entry)}-${index}`} entry={entry} />
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionHead label={COPY.batches} count={batches.length} />
        {batches.length === 0 ? (
          <EmptyState title={COPY.batchesEmpty} copy={COPY.batchesEmptyCopy} />
        ) : (
          <div className="space-y-3">
            {batches.map(batch => (
              <BatchRow key={batch.id} batch={batch} />
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionHead label={COPY.matches} count={matches.length} />
        {matches.length === 0 ? (
          <EmptyState title={COPY.matchesEmpty} copy={COPY.matchesEmptyCopy} />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {matches.map(match => (
              <MatchCard key={match.id} match={match} />
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionHead label={COPY.lagebilder} count={data.lagebild_refs.length} />
        {data.lagebild_refs.length === 0 ? (
          <EmptyState title={COPY.lagebilderEmpty} copy={COPY.lagebilderEmptyCopy} />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {data.lagebild_refs.map(ref => (
              <LagebildCard key={ref.id} snapshot={ref} teamName={teamName.get(String(ref.team_id))} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function AttentionCard({ entry }: { entry: ResolvedAttention }) {
  const accent = entry.kind === 'error' ? 'var(--red)' : 'var(--amber)'
  const target = entry.batch
    ? `${templateLabel(entry.batch.template)} · ${COPY.deadline} ${formatDateTime(entry.batch.deadline_at)}`
    : matchTitle(entry.match!)

  const link = entry.match ? `/scrims/teams/${entry.match.team_a?.id ?? ''}` : null

  return (
    <div className="card space-y-1.5 border-l-2 p-4" style={{ borderLeftColor: accent }}>
      <span className="stat-label" style={{ color: accent }}>
        {ATTENTION_LABEL[entry.kind]}
      </span>
      <p className="font-display text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
        {target}
      </p>
      {entry.batch && (
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {entry.batch.requests?.length ?? 0} {COPY.requests} · {COPY.createdBy} {entry.batch.created_by_display_name}
        </p>
      )}
      {link && entry.match?.team_a && (
        <Link to={link} className="eyebrow mt-2 inline-block">
          Board öffnen →
        </Link>
      )}
    </div>
  )
}

function BatchRow({ batch }: { batch: MatchRequestBatch }) {
  const overdue = isPast(batch.deadline_at)
  return (
    <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
      <div className="min-w-0">
        <span className="font-display text-base font-bold" style={{ color: 'var(--text-primary)' }}>
          {templateLabel(batch.template)}
        </span>
        <p className="stat-label mt-1">
          {batch.requests?.length ?? 0} {COPY.requests} · {COPY.createdBy} {batch.created_by_display_name}
        </p>
      </div>
      <div className="text-right">
        <span className="stat-label">{COPY.deadline}</span>
        <p
          className="font-mono-data text-sm font-semibold"
          style={{ color: overdue ? 'var(--red)' : 'var(--text-primary)' }}
        >
          {formatDateTime(batch.deadline_at)}
          {overdue && ` · ${COPY.overdue}`}
        </p>
      </div>
    </div>
  )
}

function MatchCard({ match }: { match: OperationalMatch }) {
  return (
    <div className="card space-y-1.5 p-4">
      <span className="font-display text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
        {matchTitle(match)}
      </span>
      <p className="stat-label">
        {match.scheduled_at ? formatDateTime(match.scheduled_at) : match.when_text || COPY.noDate}
      </p>
      {match.join_code && (
        <p className="font-mono-data text-xs" style={{ color: 'var(--amber)' }}>
          {COPY.lobbyOpen} · {match.join_code}
        </p>
      )}
    </div>
  )
}

function LagebildCard({ snapshot, teamName }: { snapshot: LagebildRef; teamName?: string }) {
  const failed = Boolean(snapshot.error) || (snapshot.status ?? '').toLowerCase().includes('error')
  const { body, evidences } = splitLagebildText(snapshot.lagebild_text ?? '')
  return (
    <div className="card space-y-1.5 p-4">
      <span className="font-display text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
        {teamName ?? `Team ${snapshot.team_id}`}
      </span>
      <p className="stat-label">{formatDateTime(snapshot.generated_at)}</p>
      {failed ? (
        <p className="text-xs" style={{ color: 'var(--red)' }}>
          {snapshot.error || snapshot.status}
        </p>
      ) : (
        <>
          <p className="whitespace-pre-line text-xs" style={{ color: 'var(--text-secondary)' }}>
            {body || snapshot.status}
          </p>
          {evidences.length > 0 && (
            <div className="space-y-1 pt-1">
              <p className="stat-label">{COPY.evidences}</p>
              <div className="flex flex-wrap gap-1">
                {evidences.map((evidence, index) =>
                  evidence.url ? (
                    <a
                      key={`${evidence.label}-${index}`}
                      href={evidence.url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-sm px-1.5 py-0.5 text-xs underline decoration-dotted"
                      style={{ color: 'var(--amber)' }}
                      title={evidence.label}
                    >
                      {evidenceChip(evidence.label, index)}
                    </a>
                  ) : (
                    <span
                      key={`${evidence.label}-${index}`}
                      className="rounded-sm px-1.5 py-0.5 text-xs"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {evidence.label}
                    </span>
                  ),
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

/** Zehn volle Labels sprengen die Karte; der Zeitstempel reicht zum Wiederfinden. */
function evidenceChip(label: string, index: number): string {
  const timestamp = label.match(/\d{2}\.\d{2}\.\d{4} \d{2}:\d{2}/)
  return timestamp ? timestamp[0] : `Beleg ${index + 1}`
}

function entryId(entry: ResolvedAttention): string {
  return entry.batch?.id ?? entry.match?.id ?? 'unbekannt'
}

function matchTitle(match: OperationalMatch): string {
  const a = match.team_a?.name ?? 'Offen'
  const b = match.team_b?.name ?? 'Gegner offen'
  return `${a} vs ${b}`
}

function templateLabel(template: string | null | undefined): string {
  if (!template) return ''
  return TEMPLATE_LABEL[template] ?? template
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('de-DE', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function isPast(value: string | null | undefined): boolean {
  if (!value) return false
  const date = new Date(value)
  return !Number.isNaN(date.getTime()) && date.getTime() < Date.now()
}
