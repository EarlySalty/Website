import type { DayOverlap, DaySlot, ScrimWindow, Weekday, WeeklyAvailability } from '@/api/client'

/** Wochentage in Anzeige-Reihenfolge (Mo→So), mit Kurz-/Langform. */
export const WEEKDAYS: { key: Weekday; short: string; long: string }[] = [
  { key: 'mon', short: 'Mo', long: 'Montag' },
  { key: 'tue', short: 'Di', long: 'Dienstag' },
  { key: 'wed', short: 'Mi', long: 'Mittwoch' },
  { key: 'thu', short: 'Do', long: 'Donnerstag' },
  { key: 'fri', short: 'Fr', long: 'Freitag' },
  { key: 'sat', short: 'Sa', long: 'Samstag' },
  { key: 'sun', short: 'So', long: 'Sonntag' },
]

/** Minuten seit Mitternacht → "HH:MM". */
export function formatMinutes(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** Leere Woche (alle Tage unbekannt). */
export function emptyWeekly(): WeeklyAvailability {
  const slot = (): DaySlot => ({ status: 'unknown', from: null, to: null })
  return { mon: slot(), tue: slot(), wed: slot(), thu: slot(), fri: slot(), sat: slot(), sun: slot() }
}

/** Menschliche Kurzbeschreibung eines Tages-Slots. */
export function slotText(slot: DaySlot): string {
  if (slot.status === 'unavailable') return 'Keine Zeit'
  if (slot.status === 'unknown') return 'Unbekannt'
  if (slot.from == null && slot.to == null) return 'Ganztägig'
  if (slot.from != null && slot.to != null) return `${formatMinutes(slot.from)}–${formatMinutes(slot.to)}`
  if (slot.from != null) return `ab ${formatMinutes(slot.from)}`
  if (slot.to != null) return `bis ${formatMinutes(slot.to)}`
  return 'Ganztägig'
}

/** Gemeinsames Zeitfenster eines Overlap-Tages als Text, sonst "—". */
export function overlapWindowText(day: DayOverlap): string {
  if (day.window_from == null || day.window_to == null) return '—'
  return `${formatMinutes(day.window_from)}–${formatMinutes(day.window_to)}`
}

/** ScrimWindow als kurzer Anzeige-Text. */
export function scrimWindowText(window: ScrimWindow): string {
  const day = WEEKDAYS.find(d => d.key === window.day)
  return `${day?.short ?? window.day} ${formatMinutes(window.from)}–${formatMinutes(window.to)}`
}

/** Zeit-Optionen für die Editor-Dropdowns (30-Minuten-Schritte, 00:00 bis 24:00). */
export const TIME_OPTIONS: { value: number; label: string }[] = Array.from({ length: 49 }, (_, i) => {
  const value = i * 30
  return { value, label: formatMinutes(value) }
})
