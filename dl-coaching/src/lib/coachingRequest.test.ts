import assert from 'node:assert/strict'
import test from 'node:test'
import { availabilityText, presetWindow, validateWindow } from './coachingRequest.ts'

const now = new Date(2026, 9, 1, 15, 0)
const window = { id: 0, date: '02.10.2026', from: '18:00', to: '20:00' }

test('German dates validate calendar boundaries and future windows', () => {
  assert.equal(validateWindow(window, now), null)
  assert.match(validateWindow({ ...window, date: '31.02.2027' }, now)!, /gibt es nicht/)
  assert.match(validateWindow({ ...window, date: '10/02/2026' }, now)!, /TT.MM.JJJJ/)
  assert.match(validateWindow({ ...window, date: '30.09.2026' }, now)!, /späteren/)
  assert.match(validateWindow({ ...window, date: '01.10.2026', from: '14:00' }, now)!, /Vergangenheit/)
})

test('partial windows and invalid or reversed times are rejected', () => {
  assert.match(validateWindow({ ...window, from: '24:00' }, now)!, /HH:MM/)
  assert.match(validateWindow({ ...window, to: '17:00' }, now)!, /Endzeit/)
  assert.match(validateWindow({ ...window, to: '' }, now)!, /HH:MM/)
  assert.match(validateWindow({ ...window, date: '' }, now)!, /TT.MM.JJJJ/)
  assert.equal(validateWindow({ id: 0, date: '', from: '', to: '' }, now), null)
})

test('multiple wishes preserve German dates and empty rows are omitted', () => {
  assert.equal(availabilityText(['Morgen'], [window, { id: 1, date: '', from: '', to: '' }], now), '02.10.2026 (Uhrzeit nach Absprache); 02.10.2026, 18:00 bis 20:00 Uhr')
  assert.equal(presetWindow('Wochenende', now), '03.10.2026 bis 04.10.2026 (Wochenende, Uhrzeit nach Absprache)')
  assert.equal(presetWindow('Wochenende', new Date(2026, 9, 4)), '04.10.2026 bis 04.10.2026 (Wochenende, Uhrzeit nach Absprache)')
})
