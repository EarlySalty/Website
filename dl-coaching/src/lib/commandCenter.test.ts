import test from 'node:test'
import assert from 'node:assert/strict'

import {
  openBatches,
  resolveAttention,
  splitLagebildText,
  upcomingMatches,
  type ScrimCommandCenter,
} from './commandCenter.ts'

/** Minimales, aber vertragstreues Fixture: IDs sind Strings (wire_id serialisiert i32 als String). */
function fixture(overrides: Partial<ScrimCommandCenter> = {}): ScrimCommandCenter {
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

test('resolveAttention verknüpft eine Abfrage-Referenz mit dem vollen Batch', () => {
  const data = fixture({
    attention: [{ kind: 'missing_responses', source: 'match_request_batch', id: '401' }],
    match_request_batches: [
      {
        id: '401',
        template: 'regular_scrim',
        deadline_at: '2026-08-01T18:00:00Z',
        status: 'open',
        created_by_display_name: 'Orga',
        requests: [],
      },
    ],
  })

  const resolved = resolveAttention(data)

  assert.equal(resolved.length, 1)
  assert.equal(resolved[0].kind, 'missing_responses')
  assert.equal(resolved[0].batch?.id, '401')
  assert.equal(resolved[0].match, undefined)
})

test('resolveAttention verknüpft eine Match-Referenz mit dem vollen Match', () => {
  const data = fixture({
    attention: [{ kind: 'error', source: 'operational_match', id: '301' }],
    operational_matches: [
      { id: '301', status: 'failed', team_a: { id: '1', name: 'Alpha' }, team_b: null },
    ],
  })

  const resolved = resolveAttention(data)

  assert.equal(resolved.length, 1)
  assert.equal(resolved[0].match?.id, '301')
  assert.equal(resolved[0].batch, undefined)
})

test('resolveAttention verwirft Referenzen ohne auflösbares Ziel', () => {
  // Der BFF liefert id: null, wenn das Upstream-Objekt keine id hatte (scrim_proxy.rs item_id).
  const data = fixture({
    attention: [
      { kind: 'error', source: 'operational_match', id: null },
      { kind: 'replacement', source: 'match_request_batch', id: '999' },
    ],
  })

  assert.deepEqual(resolveAttention(data), [])
})

test('resolveAttention behält mehrere Signale zum selben Objekt als eigene Einträge', () => {
  const data = fixture({
    attention: [
      { kind: 'missing_responses', source: 'match_request_batch', id: '401' },
      { kind: 'replacement', source: 'match_request_batch', id: '401' },
    ],
    match_request_batches: [
      {
        id: '401',
        template: 'regular_scrim',
        deadline_at: '2026-08-01T18:00:00Z',
        status: 'open',
        created_by_display_name: 'Orga',
        requests: [],
      },
    ],
  })

  const resolved = resolveAttention(data)

  assert.equal(resolved.length, 2)
  assert.deepEqual(
    resolved.map(entry => entry.kind),
    ['missing_responses', 'replacement'],
  )
})

test('upcomingMatches sortiert aufsteigend und lässt terminlose Matches hinten', () => {
  const data = fixture({
    operational_matches: [
      { id: '3', status: 'scheduled', scheduled_at: null, team_a: null, team_b: null },
      { id: '2', status: 'scheduled', scheduled_at: '2026-08-02T18:00:00Z', team_a: null, team_b: null },
      { id: '1', status: 'scheduled', scheduled_at: '2026-08-01T18:00:00Z', team_a: null, team_b: null },
    ],
  })

  assert.deepEqual(
    upcomingMatches(data).map(match => match.id),
    ['1', '2', '3'],
  )
})

test('upcomingMatches blendet abgeschlossene und abgesagte Matches aus', () => {
  const data = fixture({
    operational_matches: [
      { id: '1', status: 'scheduled', scheduled_at: '2026-08-01T18:00:00Z', team_a: null, team_b: null },
      { id: '2', status: 'completed', scheduled_at: '2026-08-02T18:00:00Z', team_a: null, team_b: null },
      { id: '3', status: 'cancelled', scheduled_at: '2026-08-03T18:00:00Z', team_a: null, team_b: null },
    ],
  })

  assert.deepEqual(
    upcomingMatches(data).map(match => match.id),
    ['1'],
  )
})

test('openBatches sortiert nach Deadline und blendet geschlossene Abfragen aus', () => {
  const data = fixture({
    match_request_batches: [
      { id: '2', template: 'regular_scrim', deadline_at: '2026-08-05T18:00:00Z', status: 'open', created_by_display_name: 'Orga', requests: [] },
      { id: '3', template: 'testmatch', deadline_at: '2026-08-01T18:00:00Z', status: 'closed', created_by_display_name: 'Orga', requests: [] },
      { id: '1', template: 'training', deadline_at: '2026-08-02T18:00:00Z', status: 'open', created_by_display_name: 'Orga', requests: [] },
    ],
  })

  assert.deepEqual(
    openBatches(data).map(batch => batch.id),
    ['1', '2'],
  )
})

test('Teilantworten ohne Status stuerzen nicht ab und gelten als offen', () => {
  // Der Backend-Vertrag erlaubt Batches nur mit id und missing_response_count.
  // Vorher rief der Filter status.toLowerCase() auf und warf einen TypeError.
  const data = fixture({
    match_request_batches: [
      { id: '9', missing_response_count: 2 } as never,
    ],
    operational_matches: [
      { id: '8' } as never,
    ],
  })

  assert.deepEqual(openBatches(data).map(batch => batch.id), ['9'])
  assert.deepEqual(upcomingMatches(data).map(match => match.id), ['8'])
})

test('Lagebild ohne Evidenzblock bleibt unveraendert', () => {
  const parts = splitLagebildText('Lage: Das Team stimmt ab.\nPrioritaet: mittel')
  assert.equal(parts.body, 'Lage: Das Team stimmt ab.\nPrioritaet: mittel')
  assert.deepEqual(parts.evidences, [])
})

/** Roh ausgegeben fraßen die Discord-URLs die halbe Karte (live am 2026-07-29). */
test('Evidenzen werden vom Fliesstext getrennt und als Label plus Link gelesen', () => {
  const parts = splitLagebildText(
    [
      'Lage: Das Team stimmt ab.',
      '',
      'Evidenzen:',
      '- Teamkanal Team 1',
      '- [Abstimmung im Teamkanal vom 28.07.2026 18:23](https://discord.com/channels/1/2/3)',
    ].join('\n'),
  )
  assert.equal(parts.body, 'Lage: Das Team stimmt ab.')
  assert.deepEqual(parts.evidences, [
    { label: 'Teamkanal Team 1' },
    { label: 'Abstimmung im Teamkanal vom 28.07.2026 18:23', url: 'https://discord.com/channels/1/2/3' },
  ])
})

test('Kein Beleg behaelt Markdown-Klammern', () => {
  const parts = splitLagebildText('Lage: X\n\nEvidenzen:\n- [Beleg](https://example.test/a)')
  assert.equal(parts.evidences[0]?.label.includes('['), false)
  assert.equal(parts.evidences[0]?.label.includes(']('), false)
})

/** Nur http/https werden verlinkt, sonst waere javascript: ein Klickziel. */
test('Belege mit fremdem Schema behalten nur ihr Label', () => {
  const parts = splitLagebildText('Lage: X\n\nEvidenzen:\n- [Klick](javascript:alert(1))')
  assert.deepEqual(parts.evidences, [{ label: 'Klick' }])
})
