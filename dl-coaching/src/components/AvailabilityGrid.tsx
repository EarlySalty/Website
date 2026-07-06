import type { DaySlot, WeeklyAvailability } from '@/api/client'
import { formatMinutes, slotText, WEEKDAYS } from '@/lib/availability'

/** Kompakte, read-only Wochen-Ansicht: 7 farbcodierte Zellen (Mo→So). */
export default function AvailabilityGrid({ weekly, compact = false }: { weekly: WeeklyAvailability; compact?: boolean }) {
  return (
    <div className="flex flex-wrap gap-1">
      {WEEKDAYS.map(({ key, short, long }) => {
        const slot = weekly[key]
        const style = cellStyle(slot)
        return (
          <div
            key={key}
            title={`${long}: ${slotText(slot)}`}
            className={`flex flex-1 flex-col items-center rounded-sm px-1 py-1 text-center ${compact ? 'min-w-[2.35rem]' : 'min-w-[3rem]'}`}
            style={style}
          >
            <span className="font-mono-data text-[10px] font-bold uppercase tracking-wider">{short}</span>
            <span className="font-mono-data text-[10px] leading-tight">{cellLabel(slot, compact)}</span>
          </div>
        )
      })}
    </div>
  )
}

function cellLabel(slot: DaySlot, compact: boolean): string {
  if (slot.status === 'unavailable') return '—'
  if (slot.status === 'unknown') return '?'
  if (slot.from == null && slot.to == null) return 'ganz'
  if (slot.from != null && slot.to != null) return `${timeLabel(slot.from, compact)}\n${timeLabel(slot.to, compact)}`
  if (slot.from != null) return `ab ${timeLabel(slot.from, compact)}`
  if (slot.to != null) return `bis ${timeLabel(slot.to, compact)}`
  return 'ganz'
}

function timeLabel(minutes: number, compact: boolean): string {
  if (!compact) return formatMinutes(minutes)
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return mins === 0 ? String(hours) : `${hours}:${String(mins).padStart(2, '0')}`
}

function cellStyle(slot: DaySlot): React.CSSProperties {
  switch (slot.status) {
    case 'available':
      return {
        background: 'var(--amber-glow)',
        border: '1px solid var(--amber-border)',
        color: 'var(--amber)',
        whiteSpace: 'pre-line',
      }
    case 'unavailable':
      return {
        background: 'rgba(229, 72, 77, 0.10)',
        border: '1px solid rgba(229, 72, 77, 0.35)',
        color: 'rgba(229, 72, 77, 0.9)',
      }
    default:
      return {
        background: 'transparent',
        border: '1px dashed var(--border-dim)',
        color: 'var(--text-muted)',
      }
  }
}
