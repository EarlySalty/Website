import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { isoWeek, weekRange, escapeHtml, validateEvents, validateDraft, validateProgress } from '../community-weekly.mjs'

test('ISO weeks and DST run Monday to Monday Berlin', () => {
  assert.equal(isoWeek(new Date('2026-11-16T12:00:00Z')), '2026-W47')
  assert.deepEqual(weekRange('2026-W47'), {
    from: '2026-11-15T23:00:00.000Z',
    to: '2026-11-22T23:00:00.000Z',
    fromDay: '2026-11-16',
    toDay: '2026-11-22',
  })
  assert.equal(weekRange('2026-W13').from, '2026-03-22T23:00:00.000Z')
  assert.equal(weekRange('2026-W13').to, '2026-03-29T22:00:00.000Z')
  assert.throws(() => weekRange('2026-W54'))
})

test('public output escapes untrusted content', () => {
  assert.equal(escapeHtml('<script>"hello" & \'world\''), '&lt;script&gt;&quot;hello&quot; &amp; &#39;world&#39;')
})

const event = () => ({
  id: 'foo', groupId: 'feature-1', status: 'production', editorialApproved: true, userFacing: true,
  title: 'Filter', before: 'No filter', after: 'A filter exists', why: 'Selection was hard',
  deployedAt: '2026-11-19T12:00:00Z', importance: 3, evidence: [{ kind: 'deploy', ref: 'service-healthcheck:2026-11-19' }],
  docsRequired: true, docsUrl: '/docs/example', docsStatus: 'reviewed',
})

test('production proof and docs are mandatory', () => {
  assert.equal(validateEvents([event()], '2026-W47').length, 1)
  assert.equal(validateEvents([{ ...event(), status: 'merged' }], '2026-W47').length, 0)
  assert.equal(validateEvents([{ ...event(), deployedAt: '2026-11-24T12:00:00Z' }], '2026-W47').length, 0)
  assert.throws(() => validateEvents([{ ...event(), evidence: [] }], '2026-W47'), /production proof/)
  assert.throws(() => validateEvents([{ ...event(), docsStatus: 'proposed' }], '2026-W47'), /Docs not reviewed/)
  assert.throws(() => validateEvents([event(), { ...event(), id: 'bar' }], '2026-W47'), /Duplicate groupId/)
})

test('no unverified extra stories or AI-sounding claims', () => {
  const draft = {
    week: '2026-W47', title: 'Filter direkt sichtbar', intro: 'Der Filter ist da.',
    stories: [{ id: 'foo', title: 'Ein Filter', text: 'Der Filter ist ab jetzt sichtbar.' }],
    smallChanges: [], behindScenes: '', support: 'Du kannst die Entwicklung freiwillig unterstützen.',
  }
  assert.equal(validateDraft(draft, [event()], '2026-W47'), true)
  assert.throws(() => validateDraft({ ...draft, intro: 'Ein revolutionärer Filter' }, [event()], '2026-W47'), /fluff/)
  assert.throws(() => validateDraft({ ...draft, stories: [{ id: 'unknown', title: 'Was', text: 'Wie' }] }, [event()], '2026-W47'), /Unknown/)
  assert.throws(() => validateDraft({ ...draft, stories: [] }, [event()], '2026-W47'), /Every approved event/)
})

test('in-progress handoffs need approval, evidence and never count as shipped', () => {
  const note = {
    id: 'agent-fix', status: 'in_progress', publicSafe: true, editorialApproved: true,
    reportedAt: '2026-11-19T14:00:00Z', summary: 'Connection fix investigated',
    evidence: [{ kind: 'test', ref: 'test-run-123' }],
  }
  assert.equal(validateProgress([note], '2026-W47').length, 1)
  assert.equal(validateProgress([{ ...note, editorialApproved: false }], '2026-W47').length, 0)
  assert.equal(validateEvents([note], '2026-W47').length, 0)
  assert.throws(() => validateProgress([{ ...note, evidence: [] }], '2026-W47'), /Incomplete/)
  assert.throws(() => validateProgress([{ ...note, verifiedEffort: { hours: 10 } }], '2026-W47'), /Effort/)
})

test('progress-only drafts need a genuine source for behind-the-scenes claims', () => {
  const draft = {
    week: '2026-W47', title: 'Einblick in die Arbeit', intro: 'Diese Woche wurde noch nichts Neues freigegeben.',
    stories: [], smallChanges: [], behindScenes: 'Ein Fehler ist noch in Untersuchung.',
    support: 'Wer möchte, kann die Entwicklung freiwillig unterstützen.',
  }
  assert.throws(() => validateDraft(draft, [], '2026-W47'), /Behind-the-scenes/)
  assert.equal(validateDraft(draft, [], '2026-W47', [{
    id: 'agent-fix', status: 'in_progress', publicSafe: true, editorialApproved: true,
    reportedAt: '2026-11-19T14:00:00Z', summary: 'A fix under investigation', evidence: ['reviewed task'],
  }]), true)
})
