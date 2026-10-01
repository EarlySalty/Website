export const RANKS = [
  'Initiate', 'Seeker', 'Alchemist', 'Arcanist', 'Ritualist', 'Emissary',
  'Archon', 'Oracle', 'Phantom', 'Ascendant', 'Eternus',
] as const

export const RANK_IMAGES = RANKS.map(name => `/images/ranks/${['Archon', 'Emissary', 'Eternus'].includes(name) ? name : name.toLowerCase()}.png`)
export const TIERS = ['1', '2', '3', '4', '5', '6'] as const
export const FOCUS_AREAS = ['Laning', 'Farming', 'Teamfights', 'Build-Entscheidungen', 'Replay anschauen'] as const

export interface TimeWindow {
  id: number
  date: string
  from: string
  to: string
}

export function validateWindow(slot: TimeWindow, today = new Date()): string | null {
  if (!slot.date && !slot.from && !slot.to) return null
  const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(slot.date.trim())
  if (!match) return 'Bitte ein Datum als TT.MM.JJJJ eingeben.'
  const [, day, month, year] = match.map(Number)
  const date = new Date(year, month - 1, day)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return 'Dieses Datum gibt es nicht.'
  const midnight = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  if (date < midnight) return 'Bitte einen heutigen oder späteren Tag wählen.'
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(slot.from) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(slot.to)) return 'Bitte beide Uhrzeiten als HH:MM eingeben.'
  if (slot.to <= slot.from) return 'Die Endzeit muss nach der Startzeit liegen.'
  if (date.getTime() === midnight.getTime() && slot.from <= `${String(today.getHours()).padStart(2, '0')}:${String(today.getMinutes()).padStart(2, '0')}`) return 'Die Startzeit liegt bereits in der Vergangenheit.'
  return null
}

export function presetWindow(label: string, now = new Date()): string {
  const format = (date: Date) => date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
  if (label === 'Heute Abend') return `${format(now)} (heute Abend, Uhrzeit nach Absprache)`
  const date = new Date(now)
  if (label === 'Morgen') {
    date.setDate(date.getDate() + 1)
    return `${format(date)} (Uhrzeit nach Absprache)`
  }
  const day = date.getDay()
  date.setDate(date.getDate() + (day === 0 || day === 6 ? 0 : 6 - day))
  const end = new Date(date)
  if (day !== 0) end.setDate(end.getDate() + 1)
  return `${format(date)} bis ${format(end)} (Wochenende, Uhrzeit nach Absprache)`
}

export function availabilityText(presets: string[], windows: TimeWindow[], now = new Date()): string {
  return [
    ...presets.map(label => presetWindow(label, now)),
    ...windows.filter(slot => slot.date && !validateWindow(slot, now)).map(slot => `${slot.date.trim()}, ${slot.from} bis ${slot.to} Uhr`),
  ].join('; ')
}
