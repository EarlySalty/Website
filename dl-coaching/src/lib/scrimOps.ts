import type { ScrimPoolParticipant, ScrimTeam } from '../api/client'
import {
  resolveAttention,
  splitLagebildText,
  type LagebildRef,
  type ScrimCommandCenter,
} from './commandCenter.ts'

export type ScrimPoolGroupKey = 'new' | 'waitlist' | 'reserve' | 'assigned' | 'inactive'

export interface ScrimPoolGroups {
  new: ScrimPoolParticipant[]
  waitlist: ScrimPoolParticipant[]
  reserve: ScrimPoolParticipant[]
  assigned: ScrimPoolParticipant[]
  inactive: ScrimPoolParticipant[]
}

/**
 * Ein Spieler darf in der Orga immer nur an genau einer Stelle auftauchen.
 * Team-Zugehoerigkeit gewinnt deshalb gegen den Participant-Status.
 */
export function groupScrimPool(pool: ScrimPoolParticipant[]): ScrimPoolGroups {
  const groups: ScrimPoolGroups = {
    new: [],
    waitlist: [],
    reserve: [],
    assigned: [],
    inactive: [],
  }

  for (const participant of pool) {
    const status = participant.status?.trim().toLowerCase()
    if (status === 'inactive') groups.inactive.push(participant)
    else if (participant.team) groups.assigned.push(participant)
    else if (status === 'reserve') groups.reserve.push(participant)
    else if (status === 'waitlist') groups.waitlist.push(participant)
    else if (status === 'assigned') groups.waitlist.push(participant)
    else groups.new.push(participant)
  }

  return groups
}

export interface TeamRosterSummary {
  team: ScrimTeam
  members: ScrimPoolParticipant[]
  starters: ScrimPoolParticipant[]
  bench: ScrimPoolParticipant[]
  missingStarters: number
  excessStarters: number
  unconfirmedAvailability: number
  health: 'ready' | 'warning' | 'blocked'
}

export function summarizeTeams(teams: ScrimTeam[], pool: ScrimPoolParticipant[]): TeamRosterSummary[] {
  return teams.map(team => {
    const members = pool.filter(participant => participant.team?.id === team.id)
    const starters = members.filter(participant => !participant.is_bench)
    const bench = members.filter(participant => participant.is_bench)
    const missingStarters = Math.max(0, 6 - starters.length)
    const excessStarters = Math.max(0, starters.length - 6)
    const unconfirmedAvailability = starters.filter(participant => !participant.availability_confirmed).length
    const health: TeamRosterSummary['health'] = missingStarters > 0 || excessStarters > 0
      ? 'blocked'
      : (!team.coach || team.default_from == null || team.default_to == null || unconfirmedAvailability > 0 ? 'warning' : 'ready')

    return {
      team,
      members,
      starters,
      bench,
      missingStarters,
      excessStarters,
      unconfirmedAvailability,
      health,
    }
  })
}

export function totalOpenStarterSlots(summaries: TeamRosterSummary[]): number {
  return summaries.reduce((sum, team) => sum + team.missingStarters, 0)
}

export type ScrimOpsPriority = 'high' | 'medium' | 'low'

export interface ScrimOpsTask {
  id: string
  priority: ScrimOpsPriority
  title: string
  detail: string
  teamId?: number
  poolGroup?: ScrimPoolGroupKey
  commandCenter?: boolean
}

const PRIORITY_ORDER: Record<ScrimOpsPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
}

/** Harte Orga-Fakten zuerst. Die KI wird separat als Lagebild angezeigt und entscheidet diese Punkte nicht. */
export function buildScrimOpsTasks(
  teams: TeamRosterSummary[],
  groups: ScrimPoolGroups,
  commandCenter?: ScrimCommandCenter,
): ScrimOpsTask[] {
  const tasks: ScrimOpsTask[] = []

  if (groups.new.length > 0) {
    tasks.push({
      id: 'new-signups',
      priority: groups.new.length >= 10 ? 'high' : 'medium',
      title: `${groups.new.length} neue Anmeldung${groups.new.length === 1 ? '' : 'en'} einsortieren`,
      detail: 'Neu eingegangene Spieler sind noch keinem freien Pool oder Team zugeordnet.',
      poolGroup: 'new',
    })
  }

  for (const summary of teams) {
    if (summary.missingStarters > 0) {
      tasks.push({
        id: `team-${summary.team.id}-missing`,
        priority: 'high',
        title: `${summary.team.name}: ${summary.missingStarters === 1 ? '1 Stammplatz offen' : `${summary.missingStarters} Stammplätze offen`}`, 
        detail: `${summary.starters.length}/6 Stammspieler sind gesetzt. Der freie Pool kann direkt im Team-Board nach Verfügbarkeit sortiert werden.`,
        teamId: summary.team.id,
      })
    }
    if (summary.excessStarters > 0) {
      tasks.push({
        id: `team-${summary.team.id}-excess`,
        priority: 'high',
        title: `${summary.team.name}: ${summary.starters.length} Spieler als Stamm markiert`,
        detail: `${summary.excessStarters} Spieler müssen auf die Team-Bank oder aus dem Team genommen werden.`,
        teamId: summary.team.id,
      })
    }
    if (!summary.team.coach) {
      tasks.push({
        id: `team-${summary.team.id}-coach`,
        priority: 'medium',
        title: `${summary.team.name}: kein Coach gesetzt`,
        detail: 'Ohne Coach ist die Zuständigkeit für Kader und Termin nicht eindeutig.',
        teamId: summary.team.id,
      })
    }
    if (summary.team.default_from == null || summary.team.default_to == null) {
      tasks.push({
        id: `team-${summary.team.id}-time`,
        priority: 'medium',
        title: `${summary.team.name}: keine Stammzeit hinterlegt`,
        detail: 'Eine Stammzeit macht Aufrufe und die Einspringer-Suche deutlich schneller.',
        teamId: summary.team.id,
      })
    }
    if (summary.unconfirmedAvailability > 0) {
      tasks.push({
        id: `team-${summary.team.id}-availability`,
        priority: 'low',
        title: `${summary.team.name}: ${summary.unconfirmedAvailability} Verfügbarkeit${summary.unconfirmedAvailability === 1 ? '' : 'en'} unbestätigt`,
        detail: 'Diese Zeiten stammen noch aus Alt-Daten und sollten von den Spielern bestätigt werden.',
        teamId: summary.team.id,
      })
    }
  }

  if (commandCenter) {
    const attention = resolveAttention(commandCenter)
    const errors = attention.filter(entry => entry.kind === 'error').length
    const replacements = attention.filter(entry => entry.kind === 'replacement').length
    const missingResponses = attention.filter(entry => entry.kind === 'missing_responses').length

    if (errors > 0) {
      tasks.push({
        id: 'command-errors',
        priority: 'high',
        title: `${errors} Scrim-Vorgang${errors === 1 ? '' : 'e'} mit Fehler`,
        detail: 'Die Orga-Lage enthält technische oder operative Fehler, die geprüft werden müssen.',
        commandCenter: true,
      })
    }
    if (replacements > 0) {
      tasks.push({
        id: 'command-replacements',
        priority: 'high',
        title: `${replacements} offener Ersatzbedarf`,
        detail: 'Für mindestens ein anstehendes Match wird noch Ersatz gesucht.',
        commandCenter: true,
      })
    }
    if (missingResponses > 0) {
      tasks.push({
        id: 'command-missing-responses',
        priority: 'medium',
        title: `${missingResponses} Terminabfrage${missingResponses === 1 ? '' : 'n'} mit fehlenden Antworten`,
        detail: 'Die offenen Rückmeldungen blockieren die Terminentscheidung.',
        commandCenter: true,
      })
    }
  }

  return tasks.sort((left, right) => PRIORITY_ORDER[left.priority] - PRIORITY_ORDER[right.priority])
}

export interface ParsedLagebild {
  lage: string
  risks: string[]
  nextStep: string
  priority: 'hoch' | 'mittel' | 'keine' | ''
}

export function parseLagebildText(text: string | null | undefined): ParsedLagebild {
  const { body } = splitLagebildText(text ?? '')
  const lines = body.split('\n').map(line => line.trim()).filter(Boolean)
  const risks: string[] = []
  let lage = ''
  let nextStep = ''
  let priority: ParsedLagebild['priority'] = ''
  let inRisks = false

  for (const line of lines) {
    if (line.startsWith('Lage:')) {
      lage = line.slice('Lage:'.length).trim()
      inRisks = false
      continue
    }
    if (line === 'Risiken:') {
      inRisks = true
      continue
    }
    if (line.startsWith('Nächster Schritt:')) {
      nextStep = line.slice('Nächster Schritt:'.length).trim()
      inRisks = false
      continue
    }
    if (line.startsWith('Priorität:')) {
      const raw = line.slice('Priorität:'.length).trim().toLowerCase()
      priority = raw === 'hoch' || raw === 'mittel' || raw === 'keine' ? raw : ''
      inRisks = false
      continue
    }
    if (inRisks && line.startsWith('- ')) risks.push(line.slice(2).trim())
  }

  return { lage, risks, nextStep, priority }
}

export function latestLagebildForTeam(data: ScrimCommandCenter | undefined, teamId: number): LagebildRef | undefined {
  if (!data) return undefined
  return data.lagebild_refs
    .filter(snapshot => String(snapshot.team_id) === String(teamId))
    .slice()
    .sort((left, right) => (right.generated_at ?? '').localeCompare(left.generated_at ?? ''))[0]
}
