import type { DaySlot, WeeklyAvailability } from '@/api/client'
import { formatMinutes, slotText, WEEKDAYS } from '@/lib/availability'

/** Kompakte, read-only Wochen-Ansicht: 7 farbcodierte Zellen (Mo→So). */
export default function AvailabilityGrid({ weekly }: { weekly: WeeklyAvailability }) {
  return (
    <div className="flex flex-wrap gap-1">
      {WEEKDAYS.map(({ key, short, long }) => {
        const slot = weekly[key]
        const style = cellStyle(slot)
        return (
          <div
            key={key}
            title={`${long}: ${slotText(slot)}`}
            className="flex min-w-[3rem] flex-1 flex-col items-center rounded-sm px-1 py-1 text-center"
            style={style}
          >
            <span className="font-mono-data text-[10px] font-bold uppercase tracking-wider">{short}</span>
            <span className="font-mono-data text-[10px] leading-tight">{cellLabel(slot)}</span>
          </div>
        )
      })}
    </div>
  )
}

function cellLabel(slot: DaySlot): string {
  if (slot.status === 'unavailable') return '—'
  if (slot.status === 'unknown') return '?'
  if (slot.from == null && slot.to == null) return 'ganz'
  if (slot.from != null && slot.to != null) return `${formatMinutes(slot.from)}\n${formatMinutes(slot.to)}`
  if (slot.from != null) return `ab ${formatMinutes(slot.from)}`
  if (slot.to != null) return `bis ${formatMinutes(slot.to)}`
  return 'ganz'
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
