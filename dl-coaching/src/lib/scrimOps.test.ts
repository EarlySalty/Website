import test from 'node:test'
import assert from 'node:assert/strict'

import type { ScrimPoolParticipant, ScrimTeam, WeeklyAvailability } from '@/api/client'
import type { ScrimCommandCenter } from './commandCenter.ts'
import {
  buildScrimOpsTasks,
  groupScrimPool,
  parseLagebildText,
  summarizeTeams,
} from './scrimOps.ts'

const UNKNOWN_WEEK: WeeklyAvailability = {
  mon: { status: 'unknown', from: null, to: null },
  tue: { status: 'unknown', from: null, to: null },
  wed: { status: 'unknown', from: null, to: null },
  thu: { status: 'unknown', from: null, to: null },
  fri: { status: 'unknown', from: null, to: null },
  sat: { status: 'unknown', from: null, to: null },
  sun: { status: 'unknown', from: null, to: null },
}

function team(id: number, name = `Team ${id}`): ScrimTeam {
  return {
    id,
    name,
    coach: 'Coach',
    discord_role_id: null,
    discord_channel_id: null,
    default_from: 1140,
    default_to: 1320,
    coach_discord_id: '42',
  }
}

function participant(
  id: number,
  overrides: Partial<ScrimPoolParticipant> = {},
): ScrimPoolParticipant {
  return {
    id,
    display_name: `Spieler ${id}`,
    rank: null,
    roles: null,
    availability: null,
    availability_slots: UNKNOWN_WEEK,
    availability_confirmed: true,
    status: 'waitlist',
    source: 'web_form',
    discord_linked: true,
    notes: null,
    team: null,
    role: null,
    is_captain: false,
    is_bench: false,
    ...overrides,
  }
}

function commandCenter(overrides: Partial<ScrimCommandCenter> = {}): ScrimCommandCenter {
  return {
    attention: [],
    participants: [],
    teams: [],
    match_request_batches: [],
    operational_matches: [],
    timeline: [],
    lagebild_refs: [],
    ...overrides,
  }
}

test('Team-Zugehoerigkeit gewinnt gegen einen veralteten Pool-Status', () => {
  const alpha = team(1, 'Alpha')
  const groups = groupScrimPool([
    participant(1, { status: 'reserve', team: alpha, is_bench: true }),
    participant(2, { status: 'reserve' }),
  ])

  assert.deepEqual(groups.assigned.map(entry => entry.id), [1])
  assert.deepEqual(groups.reserve.map(entry => entry.id), [2])
})

test('Team-Zusammenfassung trennt sechs Stammspieler und Team-Bank', () => {
  const alpha = team(1, 'Alpha')
  const pool = [
    ...Array.from({ length: 6 }, (_, index) => participant(index + 1, { status: 'assigned', team: alpha })),
    participant(7, { status: 'assigned', team: alpha, is_bench: true }),
  ]

  const [summary] = summarizeTeams([alpha], pool)

  assert.equal(summary.starters.length, 6)
  assert.equal(summary.bench.length, 1)
  assert.equal(summary.missingStarters, 0)
  assert.equal(summary.excessStarters, 0)
  assert.equal(summary.health, 'ready')
})

test('Orga-Aufgaben priorisieren fehlende Stammplaetze und operative Fehler', () => {
  const alpha = team(1, 'Alpha')
  const pool = [
    ...Array.from({ length: 4 }, (_, index) => participant(index + 1, { status: 'assigned', team: alpha })),
    participant(9, { status: 'new' }),
  ]
  const groups = groupScrimPool(pool)
  const summaries = summarizeTeams([alpha], pool)
  const cc = commandCenter({
    attention: [{ kind: 'error', source: 'operational_match', id: '99' }],
    operational_matches: [{ id: '99', status: 'failed', team_a: null, team_b: null }],
  })

  const tasks = buildScrimOpsTasks(summaries, groups, cc)

  assert.equal(tasks[0].priority, 'high')
  assert.ok(tasks.some(task => task.title === 'Alpha: 2 Stammplätze offen'))
  assert.ok(tasks.some(task => task.title === '1 Scrim-Vorgang mit Fehler'))
  assert.ok(tasks.some(task => task.title === '1 neue Anmeldung einsortieren'))
})

test('Lagebild-Parser macht aus AI-Text einen konkreten naechsten Schritt', () => {
  const parsed = parseLagebildText([
    'Lage: Zwei Antworten fehlen noch.',
    'Risiken:',
    '- Termin kann noch nicht bestätigt werden.',
    'Nächster Schritt: Die zwei fehlenden Spieler erinnern.',
    'Priorität: hoch',
    'Evidenzen:',
    '- [Terminabfrage](https://example.invalid/evidence)',
  ].join('\n'))

  assert.equal(parsed.lage, 'Zwei Antworten fehlen noch.')
  assert.deepEqual(parsed.risks, ['Termin kann noch nicht bestätigt werden.'])
  assert.equal(parsed.nextStep, 'Die zwei fehlenden Spieler erinnern.')
  assert.equal(parsed.priority, 'hoch')
})
