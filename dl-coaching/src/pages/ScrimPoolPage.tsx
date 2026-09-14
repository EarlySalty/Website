import { useEffect, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient, type UseMutationResult } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import {
  scrims,
  type DiscordSyncStatus,
  type ScrimCoach,
  type ScrimParticipantPatch,
  type ScrimPoolParticipant,
  type ScrimTeam,
  type ScrimSlotSuggestions,
  type ScrimWindow,
  type Weekday,
} from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import AvailabilityGrid from '@/components/AvailabilityGrid'
import { CoachOnly, EmptyState, PageSpinner, SectionHead } from '@/components/ui'
import { formatMinutes, scrimWindowText, TIME_OPTIONS, WEEKDAYS } from '@/lib/availability'
import {
  buildScrimOpsTasks,
  groupScrimPool,
  summarizeTeams,
  totalOpenStarterSlots,
  type ScrimPoolGroupKey,
  type TeamRosterSummary,
} from '@/lib/scrimOps'

const STATUS_OPTIONS = [
  { value: 'new', label: 'Neu' },
  { value: 'waitlist', label: 'Freier Pool' },
  { value: 'reserve', label: 'Einspringer-Pool' },
  { value: 'assigned', label: 'Im Team' },
  { value: 'inactive', label: 'Inaktiv' },
] as const

const POOL_TABS: Array<{ key: ScrimPoolGroupKey; label: string; hint: string }> = [
  {
    key: 'new',
    label: 'Neu',
    hint: 'Noch nicht einsortiert. Hier sollte niemand lange liegen bleiben.',
  },
  {
    key: 'waitlist',
    label: 'Freier Pool',
    hint: 'Spieler ohne festes Team. Daraus sucht das Team-Board passende Stammspieler.',
  },
  {
    key: 'reserve',
    label: 'Einspringer-Pool',
    hint: 'Teamübergreifende Aushilfen. Das ist nicht dasselbe wie die Team-Bank eines festen Teams.',
  },
  {
    key: 'assigned',
    label: 'In Teams',
    hint: 'Alle fest zugeordneten Spieler, inklusive klar markierter Team-Bank.',
  },
  {
    key: 'inactive',
    label: 'Inaktiv',
    hint: 'Nicht mehr im aktiven Scrim-Programm.',
  },
]

const COPY = {
  createTeam: '＋ Team erstellen',
  announce: 'Aufruf posten',
  editTeam: 'Bearbeiten',
  noWindow: 'Keine Stammzeit',
  noCoach: '— kein Coach —',
  coachHint: 'Bekommt automatisch die Team-Rolle und sieht damit den Team-Kanal.',
  windowLabel: 'Übliche Spielzeit',
  defaultWindowHint: 'Wann spielt das Team normalerweise? Steht im Aufruf und füllt die Einspringer-Suche vor. Der Wochentag bleibt offen.',
  openEnd: 'offenes Ende',
  announceTitle: 'Aufruf posten',
  announceHint: 'Der Bot postet das im Scrim-Kanal und pingt die Teilnehmer. Du entscheidest, wann — geschrieben wird es fertig.',
  announceNote: 'Noch was dazusagen? (optional)',
  announceSend: 'Im Scrim-Kanal posten',
  announceSending: 'Poste …',
  preview: 'Vorschau',
  findSub: 'Einspringer finden',
  findSubHint: 'Wähle Team und Termin — wir zeigen nur Leute aus dem teamübergreifenden Einspringer-Pool, die zu diesem Fenster passen.',
  forTeam: 'Für welches Team',
  search: 'Passende suchen',
  searching: 'Suche …',
  canPlay: 'kann zu der Zeit',
  cannotPlay: 'kann eher nicht',
  minutes: 'min',
  confirmSub: 'Einspringen lassen',
  confirmed: 'Bescheid gegeben ✓',
  confirmedHint: 'Hat die Rolle von {team} und eine DM mit Team und Uhrzeit bekommen. Im Einspringer-Pool bleibt die Person weiterhin verfügbar.',
  noSubsTitle: 'Niemand frei',
  noSubs: 'Im Einspringer-Pool passt gerade niemand zu diesem Zeitfenster. Versuch ein anderes Fenster.',
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
  coachId: string
  useWindow: boolean
  day: Weekday
  from: string
  to: string
}

const DEFAULT_TEAM_FORM: TeamForm = {
  name: '',
  coachId: '',
  useWindow: false,
  day: 'mon',
  from: '1140',
  to: '1320',
}

function statusLabel(value: string): string {
  return STATUS_OPTIONS.find(o => o.value === value)?.label ?? value
}


function teamWindow(form: TeamForm): ScrimWindow | null {
  if (!form.useWindow) return null
  const from = Number(form.from)
  const to = Number(form.to)
  if (!Number.isFinite(from) || !Number.isFinite(to) || from >= to) return null
  return { day: form.day, from, to }
}

/**
 * Fuellt Tag/Von/Bis aus der Team-Stammzeit vor. Offenes Ende (1440) taugt nicht als Suchfenster —
 * daraus wird ein zweistuendiges ab der Startzeit, das kann der Coach anpassen.
 */
function windowDraftForTeam(team: ScrimTeam | undefined): { day: Weekday; from: string; to: string } {
  const from = team?.default_from ?? 1140
  const rawTo = team?.default_to ?? 1320
  const to = rawTo >= 1440 ? Math.min(from + 120, 1439) : rawTo
  return { day: 'thu', from: String(from), to: String(to) }
}

/** Stammzeit als Text. 1440 = offenes Ende ("ab 16:00"), sonst Fenster. Gleiche Sprache wie im Discord-Aufruf. */
function teamWindowText(team: ScrimTeam): string {
  if (team.default_from == null || team.default_to == null) return COPY.noWindow
  if (team.default_to >= 1440) return `ab ${formatMinutes(team.default_from)} Uhr`
  return `${formatMinutes(team.default_from)}–${formatMinutes(team.default_to)} Uhr`
}

export default function ScrimPoolPage() {
  const { isCoach } = useAuth()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [showCreate, setShowCreate] = useState(false)
  const [showFindSub, setShowFindSub] = useState(false)
  const [showScheduleRound, setShowScheduleRound] = useState(false)
  const [announceTeam, setAnnounceTeam] = useState<ScrimTeam | null>(null)
  const [editTeam, setEditTeam] = useState<ScrimTeam | null>(null)
  const [teamForm, setTeamForm] = useState<TeamForm>(DEFAULT_TEAM_FORM)
  const [activePoolGroup, setActivePoolGroup] = useState<ScrimPoolGroupKey>('new')
  const [poolSearch, setPoolSearch] = useState('')

  const teamsQuery = useQuery({ queryKey: ['scrim-teams'], queryFn: () => scrims.teams(), enabled: isCoach })
  const coachesQuery = useQuery({ queryKey: ['scrim-coaches'], queryFn: () => scrims.coaches(), enabled: isCoach })
  const poolQuery = useQuery({
    queryKey: ['scrim-pool'],
    queryFn: () => scrims.pool(),
    enabled: isCoach,
  })
  const commandCenterQuery = useQuery({
    queryKey: ['scrim-command-center'],
    queryFn: () => scrims.commandCenter(),
    enabled: isCoach,
    retry: false,
    staleTime: 30_000,
  })
  const createTeamMutation = useMutation({
    mutationFn: () =>
      scrims.createTeam({
        name: teamForm.name,
        coach_discord_id: teamForm.coachId || null,
        default_from: teamForm.useWindow ? Number(teamForm.from) : null,
        default_to: teamForm.useWindow ? Number(teamForm.to) : null,
      }),
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
  const grouped = groupScrimPool(pool)
  const summaries = summarizeTeams(teams, pool)
  const tasks = buildScrimOpsTasks(summaries, grouped, commandCenterQuery.data)
  const activeTab = POOL_TABS.find(tab => tab.key === activePoolGroup) ?? POOL_TABS[0]
  const normalizedSearch = poolSearch.trim().toLowerCase()
  const visibleParticipants = grouped[activePoolGroup].filter(participant => {
    if (!normalizedSearch) return true
    return [participant.display_name, participant.rank, participant.roles, participant.team?.name]
      .filter(Boolean)
      .some(value => String(value).toLowerCase().includes(normalizedSearch))
  })

  const selectPoolGroup = (group: ScrimPoolGroupKey) => {
    setActivePoolGroup(group)
    requestAnimationFrame(() => document.getElementById('scrim-pool-explorer')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  return (
    <div className="content-grid space-y-8 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="section-title">Scrim-Orga</h1>
          <p className="section-copy max-w-3xl">
            Erst sehen, was wirklich blockiert, dann handeln. Stammaufstellung, Team-Bank, freier Pool und Einspringer sind hier bewusst getrennt.
          </p>
        </div>
        {commandCenterQuery.isSuccess && (
          <Link to="/scrims/lage" className="btn-ghost rounded-sm px-4 py-2 text-sm">
            Verlauf & Belege
          </Link>
        )}
      </div>

      {poolQuery.isLoading || teamsQuery.isLoading ? (
        <PageSpinner />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <OverviewMetric label="Neu zu klären" value={grouped.new.length} note="noch nicht einsortiert" attention={grouped.new.length > 0} />
            <OverviewMetric label="Freier Pool" value={grouped.waitlist.length} note="für feste Teams verfügbar" />
            <OverviewMetric label="Einspringer-Pool" value={grouped.reserve.length} note="teamübergreifende Aushilfen" />
            <OverviewMetric label="Offene Stammplätze" value={totalOpenStarterSlots(summaries)} note="über alle Teams" attention={totalOpenStarterSlots(summaries) > 0} />
          </div>

          <section>
            <SectionHead
              label="Was jetzt zu tun ist"
              count={tasks.length}
              action={commandCenterQuery.isSuccess ? <span className="badge badge-amber">Orga-Regeln aktiv</span> : undefined}
            />
            <p className="mb-3 max-w-3xl text-xs" style={{ color: 'var(--text-muted)' }}>
              Termine, fehlende Antworten, Stammplätze und Ersatzbedarf werden aus Kader- und Abstimmungsdaten abgeleitet. Keine KI entscheidet über Termin, Lineup oder Ersatz.
            </p>
            {tasks.length === 0 ? (
              <EmptyState title="Nichts blockiert" copy="Kadergrößen, Zuständigkeiten und offene Vorgänge sehen aktuell sauber aus." />
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {tasks.slice(0, 9).map(task => (
                  <div
                    key={task.id}
                    className="card border-l-2 p-4"
                    style={{ borderLeftColor: task.priority === 'high' ? 'var(--red)' : 'var(--amber)' }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <span className="stat-label">{task.priority === 'high' ? 'Jetzt' : task.priority === 'medium' ? 'Danach' : 'Prüfen'}</span>
                        <p className="mt-1 font-display text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{task.title}</p>
                        <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>{task.detail}</p>
                      </div>
                    </div>
                    <div className="mt-3">
                      {task.teamId ? (
                        <Link to={`/scrims/teams/${task.teamId}`} className="eyebrow">Team-Board öffnen →</Link>
                      ) : task.poolGroup ? (
                        <button type="button" className="eyebrow" onClick={() => selectPoolGroup(task.poolGroup!)}>Spieler anzeigen →</button>
                      ) : task.commandCenter ? (
                        <Link to="/scrims/lage" className="eyebrow">Vorgang prüfen →</Link>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <SectionHead
              label="Teams"
              count={teams.length}
              action={
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setShowScheduleRound(true)}
                    disabled={teams.length < 2}
                    className="btn-amber rounded-sm px-3 py-1.5 text-xs"
                  >
                    Terminrunde starten
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowFindSub(true)}
                    disabled={teams.length === 0}
                    className="btn-ghost rounded-sm px-3 py-1.5 text-xs"
                  >
                    Einspringer suchen
                  </button>
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
                </div>
              }
            />
            {teams.length === 0 ? (
              <EmptyState title="Noch keine Teams" copy="Sobald Teams angelegt sind, erscheinen hier Kader und Zuständigkeiten." />
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {summaries.map(summary => (
                  <TeamOverviewCard
                    key={summary.team.id}
                    summary={summary}
                    onAnnounce={() => setAnnounceTeam(summary.team)}
                    onEdit={() => setEditTeam(summary.team)}
                  />
                ))}
              </div>
            )}
          </section>

          <section id="scrim-pool-explorer" className="scroll-mt-24">
            <SectionHead label="Spieler verwalten" count={pool.length - grouped.inactive.length} />
            <div className="panel p-4 sm:p-5">
              <div className="flex flex-wrap gap-2">
                {POOL_TABS.map(tab => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActivePoolGroup(tab.key)}
                    className={`rounded-sm px-3 py-2 text-xs font-semibold transition ${activePoolGroup === tab.key ? 'btn-amber' : 'btn-ghost'}`}
                  >
                    {tab.label} · {grouped[tab.key].length}
                  </button>
                ))}
              </div>

              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="font-display text-base font-bold" style={{ color: 'var(--text-primary)' }}>{activeTab.label}</p>
                  <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>{activeTab.hint}</p>
                </div>
                <label className="w-full sm:max-w-xs">
                  <span className="sr-only">Spieler suchen</span>
                  <input
                    className="input-field !py-2"
                    value={poolSearch}
                    onChange={event => setPoolSearch(event.target.value)}
                    placeholder="Name, Rang, Rolle oder Team suchen"
                  />
                </label>
              </div>

              <div className="mt-4 space-y-2">
                {visibleParticipants.length === 0 ? (
                  <EmptyState
                    title={normalizedSearch ? 'Keine Treffer' : 'Niemand in diesem Bereich'}
                    copy={normalizedSearch ? 'Passe die Suche an oder wähle einen anderen Bereich.' : 'Hier ist gerade nichts zu erledigen.'}
                  />
                ) : (
                  visibleParticipants.map(participant => (
                    <PoolRow key={participant.id} participant={participant} teams={teams} />
                  ))
                )}
              </div>
            </div>
          </section>
        </>
      )}

      {showScheduleRound && <ScheduleRoundModal teams={teams} onClose={() => setShowScheduleRound(false)} />}
      {showFindSub && <FindSubstituteModal teams={teams} onClose={() => setShowFindSub(false)} />}
      {announceTeam && <AnnounceModal team={announceTeam} onClose={() => setAnnounceTeam(null)} />}
      {editTeam && <EditTeamModal team={editTeam} onClose={() => setEditTeam(null)} />}

      {showCreate && (
        <CreateTeamModal
          form={teamForm}
          setForm={setTeamForm}
          mutation={createTeamMutation}
          coaches={coachesQuery.data ?? []}
          onClose={() => setShowCreate(false)}
        />
      )}
    </div>
  )
}

function OverviewMetric({
  label,
  value,
  note,
  attention = false,
}: {
  label: string
  value: number
  note: string
  attention?: boolean
}) {
  return (
    <div className="card p-4">
      <p className="stat-label">{label}</p>
      <p className="mt-1 font-display text-3xl font-extrabold" style={{ color: attention ? 'var(--amber)' : 'var(--text-primary)' }}>{value}</p>
      <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>{note}</p>
    </div>
  )
}

function TeamOverviewCard({
  summary,
  onAnnounce,
  onEdit,
}: {
  summary: TeamRosterSummary
  onAnnounce: () => void
  onEdit: () => void
}) {
  const { team, starters, bench, missingStarters, excessStarters, unconfirmedAvailability } = summary
  const statusText = missingStarters > 0
    ? (missingStarters === 1 ? '1 Stammplatz offen' : `${missingStarters} Stammplätze offen`)
    : excessStarters > 0
      ? `${starters.length}/6 als Stamm markiert`
      : 'Stamm 6/6'

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to={`/scrims/teams/${team.id}`} className="font-display text-xl font-bold hover:underline" style={{ color: 'var(--text-primary)' }}>
            {team.name}
          </Link>
          <p className="stat-label mt-1">{team.coach ? `Coach ${team.coach}` : 'Kein Coach'} · {teamWindowText(team)}</p>
        </div>
        <span className={`badge ${summary.health === 'ready' ? 'badge-amber' : ''}`}>{statusText}</span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-sm p-3" style={{ border: '1px solid var(--border-dim)', background: 'var(--bg-surface)' }}>
          <div className="flex items-center justify-between gap-2">
            <span className="stat-label">Stammaufstellung</span>
            <strong className="font-mono-data text-sm" style={{ color: starters.length === 6 ? 'var(--amber)' : 'var(--text-primary)' }}>{starters.length}/6</strong>
          </div>
          <p className="mt-2 text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {starters.length > 0 ? starters.map(player => player.display_name).join(', ') : 'Noch niemand gesetzt.'}
          </p>
        </div>
        <div className="rounded-sm p-3" style={{ border: '1px solid var(--border-dim)', background: 'var(--bg-surface)' }}>
          <div className="flex items-center justify-between gap-2">
            <span className="stat-label">Team-Bank</span>
            <strong className="font-mono-data text-sm" style={{ color: 'var(--text-primary)' }}>{bench.length}</strong>
          </div>
          <p className="mt-2 text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {bench.length > 0 ? bench.map(player => player.display_name).join(', ') : 'Keine festen Bankspieler.'}
          </p>
        </div>
      </div>

      {unconfirmedAvailability > 0 && (
        <p className="mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>
          {unconfirmedAvailability} Stammspieler mit noch unbestätigter Verfügbarkeit.
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2 border-t pt-4" style={{ borderColor: 'var(--border-dim)' }}>
        <Link to={`/scrims/teams/${team.id}`} className="btn-amber rounded-sm px-3 py-1.5 text-xs">Team-Board</Link>
        <button type="button" onClick={onAnnounce} className="btn-ghost rounded-sm px-3 py-1.5 text-xs">{COPY.announce}</button>
        <button type="button" onClick={onEdit} className="btn-ghost rounded-sm px-3 py-1.5 text-xs">{COPY.editTeam}</button>
      </div>
    </div>
  )
}

type SuggestedPairing = {
  teamA: ScrimTeam
  teamB: ScrimTeam
  suggestion: ScrimSlotSuggestions
}

function defaultRoundPairs(teams: ScrimTeam[]): Array<[ScrimTeam, ScrimTeam]> {
  const sorted = teams.slice().sort((left, right) => {
    const leftTime = left.default_from ?? Number.MAX_SAFE_INTEGER
    const rightTime = right.default_from ?? Number.MAX_SAFE_INTEGER
    return leftTime - rightTime || left.id - right.id
  })
  const pairs: Array<[ScrimTeam, ScrimTeam]> = []
  for (let index = 0; index + 1 < sorted.length; index += 2) {
    pairs.push([sorted[index], sorted[index + 1]])
  }
  return pairs
}

function slotLabel(slot: ScrimWindow): string {
  const day = WEEKDAYS.find(entry => entry.key === slot.day)?.long ?? slot.day
  const date = slot.date ? new Date(`${slot.date}T12:00:00`).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }) : ''
  return `${day}${date ? ` ${date}` : ''} ${formatMinutes(slot.from)}–${formatMinutes(slot.to)}`
}

function ScheduleRoundModal({ teams, onClose }: { teams: ScrimTeam[]; onClose: () => void }) {
  const qc = useQueryClient()
  const pairs = defaultRoundPairs(teams)
  const suggestions = useQuery({
    queryKey: ['scrim-round-suggestions', pairs.map(([a, b]) => `${a.id}:${b.id}`).join('|')],
    queryFn: async () => Promise.all(
      pairs.map(async ([teamA, teamB]): Promise<SuggestedPairing> => ({
        teamA,
        teamB,
        suggestion: await scrims.suggestMatchSlots(teamA.id, teamB.id),
      })),
    ),
    enabled: pairs.length > 0,
    staleTime: 30_000,
  })
  const create = useMutation({
    mutationFn: async () => {
      const rows = suggestions.data ?? []
      if (rows.length === 0 || rows.some(row => row.suggestion.suggestions.length < 2)) {
        throw new Error('Für mindestens eine Paarung fehlen zwei belastbare Terminoptionen.')
      }
      const deadline = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString()
      const firstSlots = rows[0].suggestion.suggestions.slice(0, 3).map(item => ({
        day: item.slot.day,
        date: item.slot.date ?? null,
        from_minute: item.slot.from,
        to_minute: item.slot.to,
      }))
      return scrims.createMatchRequestBatch({
        technical_template_key: 'regular_scrim',
        deadline_at: deadline,
        slots: firstSlots,
        pairings: rows.map(row => ({
          team_a_id: String(row.teamA.id),
          team_b_id: String(row.teamB.id),
          slots: row.suggestion.suggestions.slice(0, 3).map(item => ({
            day: item.slot.day,
            date: item.slot.date ?? null,
            from_minute: item.slot.from,
            to_minute: item.slot.to,
          })),
        })),
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['scrim-command-center'] })
    },
  })
  const rows = suggestions.data ?? []
  const unmatched = teams.length % 2 === 1
    ? defaultRoundPairs(teams).flat().length < teams.length
    : false
  const canCreate = rows.length > 0 && rows.every(row =>
    row.suggestion.suggestions.length >= 2 && row.suggestion.suggestions[0]?.match_ready_roster
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6">
      <div className="panel-strong max-h-[90vh] w-full max-w-3xl space-y-4 overflow-y-auto p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-extrabold" style={{ color: 'var(--text-primary)' }}>
              Terminrunde starten
            </h2>
            <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
              Teams werden nach ihrer Stammzeit gepaart. Der Bot nimmt Wochenend-Slots aus den gepflegten Verfügbarkeiten und fragt alle passenden Optionen ab. Frist: 72 Stunden. Fehlende Antworten werden nachgefasst; ein eindeutiger Termin wird automatisch gesetzt. Danach folgen finale Teilnahmebestätigung und Ersatzsuche automatisch.
            </p>
          </div>
          <button type="button" onClick={onClose} className="btn-ghost rounded-sm px-3 py-1.5 text-xs">Schließen</button>
        </div>

        {unmatched && (
          <p className="text-xs" style={{ color: 'var(--amber)' }}>
            Eine ungerade Teamzahl bleibt in dieser Runde ohne Paarung.
          </p>
        )}

        {suggestions.isLoading ? (
          <PageSpinner />
        ) : suggestions.isError ? (
          <p className="text-sm" style={{ color: 'var(--red)' }}>{suggestions.error.message}</p>
        ) : (
          <div className="space-y-3">
            {rows.map(row => (
              <div key={`${row.teamA.id}-${row.teamB.id}`} className="card p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <strong className="font-display text-sm" style={{ color: 'var(--text-primary)' }}>
                    {row.teamA.name} vs {row.teamB.name}
                  </strong>
                  <span className="stat-label">
                    {!row.suggestion.suggestions[0]?.match_ready_roster
                      ? 'Kader nicht 6/6'
                      : row.suggestion.suggestions.length >= 2
                        ? 'bereit'
                        : 'Zeiten fehlen'}
                  </span>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  {row.suggestion.suggestions.slice(0, 3).map(item => (
                    <div key={`${item.slot.day}-${item.slot.from}`} className="rounded-sm p-2" style={{ border: '1px solid var(--border-dim)' }}>
                      <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{slotLabel(item.slot)}</p>
                      <p className="mt-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                        Stamm {item.team_a_available_starters}/6 + {item.team_b_available_starters}/6
                        {item.unknown_starters > 0 ? ` · ${item.unknown_starters} unklar` : ''}
                      </p>
                    </div>
                  ))}
                </div>
                {(!row.suggestion.suggestions[0]?.match_ready_roster || row.suggestion.suggestions.length < 2) && (
                  <p className="mt-2 text-xs" style={{ color: 'var(--red)' }}>
                    {!row.suggestion.suggestions[0]?.match_ready_roster
                      ? 'Nicht senden: beide Teams brauchen zuerst genau sechs Stammspieler.'
                      : 'Nicht senden: erst Verfügbarkeiten aktualisieren oder die Stammzeit korrigieren.'}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {create.data && <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{create.data.message}</p>}
        {create.isError && <p className="text-sm" style={{ color: 'var(--red)' }}>{create.error.message}</p>}
        {!create.data && (
          <button
            type="button"
            className="btn-amber rounded-sm px-4 py-2 text-sm"
            disabled={!canCreate || create.isPending}
            onClick={() => create.mutate()}
          >
            {create.isPending ? 'Lege Terminabfragen an …' : 'Terminabfragen senden'}
          </button>
        )}
      </div>
    </div>
  )
}

/**
 * Zwei Schritte in einem Dialog: erst suchen (Team + Zeit → Vorschlag aus der Auswechselbank),
 * dann bestätigen. Bestätigen gibt die Team-Rolle für die Aushilfe; Auswechselspieler bleibt er.
 */
/** Coach loest aus, Bot formatiert: Vorschau zeigen, damit klar ist was rausgeht — posten tut es erst der Klick. */
function AnnounceModal({ team, onClose }: { team: ScrimTeam; onClose: () => void }) {
  const [note, setNote] = useState('')
  const post = useMutation({
    mutationFn: () => scrims.announceTeam(team.id, { note: note.trim() || null }),
  })

  const windowText = teamWindowText(team)
  const hasWindow = team.default_from != null && team.default_to != null
  const previewText = hasWindow
    ? `Das Team spielt üblicherweise ${windowText}. Wenn du zu der Zeit kannst und Lust hast, reagier hier mit ✅ — wir melden uns bei dir.`
    : 'Wenn du Lust hast, in diesem Team zu spielen, reagier hier mit ✅ — wir melden uns bei dir.'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6">
      <div className="panel-strong max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-xl font-extrabold" style={{ color: 'var(--text-primary)' }}>
            {COPY.announceTitle}
          </h2>
          <button type="button" onClick={onClose} className="btn-ghost rounded-sm px-3 py-1.5 text-xs">
            {COPY.cancel}
          </button>
        </div>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{COPY.announceHint}</p>

        <div className="card space-y-1.5 border-l-2 p-3" style={{ borderLeftColor: '#C8A86B' }}>
          <span className="stat-label">{COPY.preview}</span>
          <p className="font-display text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
            {team.name} sucht Verstärkung
          </p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{previewText}</p>
          {note.trim() && (
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              <strong>Dazu noch:</strong> {note.trim()}
            </p>
          )}
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="stat-label">{COPY.announceNote}</span>
          <textarea
            className="input-field min-h-[70px]"
            maxLength={500}
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="z. B. Wir suchen vor allem jemanden für die Solo-Lane."
          />
        </label>

        {post.data && (
          <p className="text-sm" style={{ color: post.data.ok ? 'var(--text-primary)' : 'var(--red)' }}>
            {post.data.detail}
          </p>
        )}
        {post.isError && <p className="text-sm" style={{ color: 'var(--red)' }}>{post.error.message}</p>}

        {!post.data?.ok && (
          <button
            type="button"
            className="btn-amber rounded-sm px-4 py-2 text-sm"
            disabled={post.isPending}
            onClick={() => post.mutate()}
          >
            {post.isPending ? COPY.announceSending : COPY.announceSend}
          </button>
        )}
      </div>
    </div>
  )
}

/** Team bearbeiten — vor allem die Stammzeit, die es fuer die 4 Bestandsteams noch nicht gibt. */
function EditTeamModal({ team, onClose }: { team: ScrimTeam; onClose: () => void }) {
  const qc = useQueryClient()
  const [name, setName] = useState(team.name)
  const [coachId, setCoachId] = useState(team.coach_discord_id ?? '')
  const [useWindow, setUseWindow] = useState(team.default_from != null)
  const [from, setFrom] = useState(String(team.default_from ?? 1200))
  const [to, setTo] = useState(String(team.default_to ?? 1320))

  const coachesQuery = useQuery({ queryKey: ['scrim-coaches'], queryFn: () => scrims.coaches() })

  const save = useMutation({
    mutationFn: () =>
      scrims.patchTeam(team.id, {
        name: name.trim(),
        coach_discord_id: coachId || null,
        default_from: useWindow ? Number(from) : null,
        default_to: useWindow ? Number(to) : null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['scrim-teams'] })
      onClose()
    },
  })

  const invalid = useWindow && Number(from) >= Number(to)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6">
      <form
        className="panel-strong w-full max-w-lg space-y-4 p-5"
        onSubmit={e => { e.preventDefault(); if (!invalid) save.mutate() }}
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-xl font-extrabold" style={{ color: 'var(--text-primary)' }}>{team.name}</h2>
          <button type="button" onClick={onClose} className="btn-ghost rounded-sm px-3 py-1.5 text-xs">{COPY.cancel}</button>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="stat-label">{COPY.teamName}</span>
          <input className="input-field" value={name} onChange={e => setName(e.target.value)} required />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="stat-label">{COPY.coach}</span>
          <select className="input-field" value={coachId} onChange={e => setCoachId(e.target.value)}>
            <option value="">{COPY.noCoach}</option>
            {(coachesQuery.data ?? []).map(c => (
              <option key={c.discord_user_id} value={c.discord_user_id}>{c.display_name}</option>
            ))}
          </select>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{COPY.coachHint}</span>
        </label>

        <div className="space-y-2">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={useWindow} onChange={e => setUseWindow(e.target.checked)} />
            <span className="stat-label">{COPY.windowLabel}</span>
          </label>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{COPY.defaultWindowHint}</p>
          {useWindow && (
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1.5">
                <span className="stat-label">{COPY.from}</span>
                <select className="input-field" value={from} onChange={e => setFrom(e.target.value)}>
                  {TIME_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="stat-label">{COPY.to}</span>
                <select className="input-field" value={to} onChange={e => setTo(e.target.value)}>
                  {TIME_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  <option value="1440">{COPY.openEnd}</option>
                </select>
              </label>
            </div>
          )}
          {invalid && <p className="text-xs" style={{ color: 'var(--red)' }}>{COPY.invalidWindow}</p>}
        </div>

        {save.isError && <p className="text-sm" style={{ color: 'var(--red)' }}>{save.error.message}</p>}
        <button type="submit" className="btn-amber rounded-sm px-4 py-2 text-sm" disabled={save.isPending || invalid}>
          Speichern
        </button>
      </form>
    </div>
  )
}

function FindSubstituteModal({ teams, onClose }: { teams: ScrimTeam[]; onClose: () => void }) {
  const qc = useQueryClient()
  const [teamId, setTeamId] = useState<number | ''>(teams[0]?.id ?? '')
  const [draft, setDraft] = useState(() => windowDraftForTeam(teams[0]))
  const [confirmedId, setConfirmedId] = useState<number | null>(null)

  // Genau dafuer ist die Stammzeit da: Team waehlen -> die uebliche Zeit steht schon drin,
  // der Coach setzt nur noch den Tag. Ein offenes Ende (1440) waere als Suchfenster sinnlos.
  const selectTeam = (id: number) => {
    setTeamId(id)
    setDraft(current => ({ ...current, ...windowDraftForTeam(teams.find(t => t.id === id)) }))
    setConfirmedId(null)
  }

  const window: ScrimWindow | null = (() => {
    const from = Number(draft.from)
    const to = Number(draft.to)
    if (!Number.isFinite(from) || !Number.isFinite(to) || from >= to) return null
    return { day: draft.day, from, to }
  })()

  const search = useMutation({
    mutationFn: () => scrims.suggestRoster(Number(teamId), { window, size: 1, pool: 'reserve' }),
  })

  const confirm = useMutation({
    mutationFn: (participantId: number) =>
      scrims.confirmSubstitute(Number(teamId), { participant_id: participantId, window: window! }),
    onSuccess: (data, participantId) => {
      setConfirmedId(data.dm.ok ? participantId : null)
      qc.invalidateQueries({ queryKey: ['scrim-pool'] })
      qc.invalidateQueries({ queryKey: ['scrim-board'] })
    },
  })

  const teamName = teams.find(t => t.id === Number(teamId))?.name ?? ''

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6">
      <div className="panel-strong max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-xl font-extrabold" style={{ color: 'var(--text-primary)' }}>
            {COPY.findSub}
          </h2>
          <button type="button" onClick={onClose} className="btn-ghost rounded-sm px-3 py-1.5 text-xs">
            {COPY.cancel}
          </button>
        </div>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{COPY.findSubHint}</p>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className="stat-label">{COPY.forTeam}</span>
            <select className="input-field" value={teamId} onChange={e => selectTeam(Number(e.target.value))}>
              {teams.map(team => (
                <option key={team.id} value={team.id}>{team.name}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="stat-label">{COPY.day}</span>
            <select className="input-field" value={draft.day} onChange={e => setDraft(d => ({ ...d, day: e.target.value as Weekday }))}>
              {WEEKDAYS.map(day => (
                <option key={day.key} value={day.key}>{day.long}</option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1.5">
              <span className="stat-label">{COPY.from}</span>
              <select className="input-field" value={draft.from} onChange={e => setDraft(d => ({ ...d, from: e.target.value }))}>
                {TIME_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="stat-label">{COPY.to}</span>
              <select className="input-field" value={draft.to} onChange={e => setDraft(d => ({ ...d, to: e.target.value }))}>
                {TIME_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            </label>
          </div>
        </div>

        {!window && <p className="text-xs" style={{ color: 'var(--red)' }}>{COPY.invalidWindow}</p>}

        <button
          type="button"
          className="btn-amber rounded-sm px-4 py-2 text-sm"
          disabled={!window || !teamId || search.isPending}
          onClick={() => { setConfirmedId(null); search.mutate() }}
        >
          {search.isPending ? COPY.searching : COPY.search}
        </button>

        {search.isError && <p className="text-xs" style={{ color: 'var(--red)' }}>{search.error.message}</p>}

        {search.data && (
          search.data.candidates.length === 0 ? (
            <EmptyState title={COPY.noSubsTitle} copy={COPY.noSubs} />
          ) : (
            <div className="space-y-2">
              {search.data.candidates.map(candidate => (
                <div key={candidate.participant_id} className="card flex items-center justify-between gap-3 p-3">
                  <div>
                    <span className="font-display text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                      {candidate.display_name}
                    </span>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {[candidate.rank, candidate.roles].filter(Boolean).join(' · ') || '—'}
                      {candidate.fit_minutes > 0
                        ? ` · ${COPY.canPlay} (${candidate.fit_minutes} ${COPY.minutes})`
                        : ` · ${COPY.cannotPlay}`}
                    </p>
                  </div>
                  {confirmedId === candidate.participant_id ? (
                    <span className="badge badge-amber">{COPY.confirmed}</span>
                  ) : (
                    <button
                      type="button"
                      className="btn-amber rounded-sm px-3 py-1.5 text-xs"
                      disabled={confirm.isPending}
                      onClick={() => confirm.mutate(candidate.participant_id)}
                    >
                      {COPY.confirmSub}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )
        )}

        {confirm.isError && <p className="text-xs" style={{ color: 'var(--red)' }}>{confirm.error.message}</p>}
        {confirm.data?.dm.ok === false && (
          <p className="text-xs" style={{ color: 'var(--red)' }}>{confirm.data.dm.detail}</p>
        )}
        {confirmedId !== null && (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {COPY.confirmedHint.replace('{team}', teamName)}
          </p>
        )}
      </div>
    </div>
  )
}

function CreateTeamModal({
  form,
  setForm,
  mutation,
  coaches,
  onClose,
}: {
  form: TeamForm
  setForm: React.Dispatch<React.SetStateAction<TeamForm>>
  mutation: UseMutationResult<ScrimTeam, Error, void, unknown>
  coaches: ScrimCoach[]
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
          <select className="input-field" value={form.coachId} onChange={e => update({ coachId: e.target.value })}>
            <option value="">{COPY.noCoach}</option>
            {coaches.map(c => (
              <option key={c.discord_user_id} value={c.discord_user_id}>{c.display_name}</option>
            ))}
          </select>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{COPY.coachHint}</span>
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
            {participant.team && <span className="badge badge-amber">{participant.team.name}{participant.is_captain ? ' · C' : ''}{participant.is_bench ? ' · Team-Bank' : ' · Stamm'}</span>}
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
            value={participant.team ? `${participant.is_bench ? 'bench' : 'starter'}:${participant.team.id}` : ''}
            disabled={busy || teams.length === 0}
            onChange={e => {
              const value = e.target.value
              const current = participant.team ? `${participant.is_bench ? 'bench' : 'starter'}:${participant.team.id}` : ''
              if (value === '' || value === current) return
              if (value === 'none') {
                patch({ team_id: null, status: 'waitlist', is_bench: false, is_captain: false })
                return
              }
              const [kind, rawTeamId] = value.split(':')
              const teamId = Number(rawTeamId)
              if (!Number.isFinite(teamId)) return
              patch({ team_id: teamId, status: 'assigned', is_bench: kind === 'bench' })
            }}
          >
            <option value="">{COPY.assign}</option>
            {participant.team && <option value="none">— aus Team nehmen → Freier Pool —</option>}
            {teams.flatMap(team => [
              <option key={`starter-${team.id}`} value={`starter:${team.id}`}>{team.name} · Stamm</option>,
              <option key={`bench-${team.id}`} value={`bench:${team.id}`}>{team.name} · Team-Bank</option>,
            ])}
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
                disabled={busy || Boolean(participant.team)}
                title={participant.team ? 'Pool-Status erst ändern, nachdem die Person aus dem Team genommen wurde.' : undefined}
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
                Team-Bank
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
