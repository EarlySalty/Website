import assert from 'node:assert/strict'
import test from 'node:test'
import { availabilityText, finishDateInput, finishTimeInput, formatDateInput, formatTimeInput, presetWindow, validateWindow } from './coachingRequest.ts'

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

const typeDigits = (digits: string, format: (raw: string) => string) => [...digits].reduce((value, digit) => format(value + digit), '')

test('digit-only keyboards produce German dates and times with automatic separators', () => {
  assert.equal(typeDigits('01102026', formatDateInput), '01.10.2026')
  assert.equal(typeDigits('41226', formatDateInput), '04.12.26')
  assert.equal(typeDigits('1830', formatTimeInput), '18:30')
  assert.equal(typeDigits('930', formatTimeInput), '09:30')
  assert.equal(typeDigits('0110202699', formatDateInput), '01.10.2026')
  assert.equal(typeDigits('183099', formatTimeInput), '18:30')
})

test('deleting, correcting and pasting keep the German format', () => {
  assert.equal(formatDateInput('01.1'.slice(0, -1)), '01.')
  assert.equal(formatDateInput('01.'.slice(0, -1)), '01')
  assert.equal(formatDateInput('01.0.2026'), '01.0.2026')
  assert.equal(formatDateInput('01.10.2026'), '01.10.2026')
  assert.equal(formatDateInput('1.10.2026'), '1.10.2026')
  assert.equal(formatDateInput('2026-10-01'), '01.10.2026')
  assert.equal(formatDateInput(' 01/10/2026 '), '01.10.2026')
  assert.equal(formatTimeInput('18:'), '18:')
  assert.equal(formatTimeInput('9:30'), '09:30')
  assert.equal(formatTimeInput('18:30 Uhr'), '18:30')
  assert.equal(finishDateInput('1.10.2026'), '01.10.2026')
  assert.equal(finishTimeInput('18'), '18:00')
  assert.equal(finishTimeInput('7:5'), '7:5')
  assert.equal(finishTimeInput(''), '')
})
