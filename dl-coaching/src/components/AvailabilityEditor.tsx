import type { DayStatus, Weekday, WeeklyAvailability } from '@/api/client'
import { TIME_OPTIONS, WEEKDAYS } from '@/lib/availability'

/**
 * Wochen-Verfügbarkeits-Editor (Self-Service). Kontrolliert: `value` rein, `onChange` mit der
 * kompletten neuen Woche raus. Pro Tag: Status (Verfügbar/Keine Zeit/Unbekannt) + optionale
 * Von/Bis-Zeit, wenn verfügbar.
 */
export default function AvailabilityEditor({
  value,
  onChange,
  disabled = false,
}: {
  value: WeeklyAvailability
  onChange: (next: WeeklyAvailability) => void
  disabled?: boolean
}) {
  const setStatus = (day: Weekday, status: DayStatus) => {
    const prev = value[day]
    const next =
      status === 'available'
        ? { status, from: prev.from, to: prev.to }
        : { status, from: null, to: null }
    onChange({ ...value, [day]: next })
  }

  const setTime = (day: Weekday, edge: 'from' | 'to', raw: string) => {
    const parsed = raw === '' ? null : Number(raw)
    onChange({ ...value, [day]: { ...value[day], [edge]: parsed } })
  }

  return (
    <div className="space-y-2">
      {WEEKDAYS.map(({ key, long, short }) => {
        const slot = value[key]
        const isAvailable = slot.status === 'available'
        return (
          <div
            key={key}
            className="card flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:gap-4"
          >
            <div className="flex items-center gap-2 sm:w-32">
              <span className="font-display text-base font-bold" style={{ color: 'var(--text-primary)' }}>
                {short}
              </span>
              <span className="hidden text-sm sm:inline" style={{ color: 'var(--text-muted)' }}>
                {long}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <StatusButton active={isAvailable} disabled={disabled} onClick={() => setStatus(key, 'available')}>
                Verfügbar
              </StatusButton>
              <StatusButton
                active={slot.status === 'unavailable'}
                disabled={disabled}
                onClick={() => setStatus(key, 'unavailable')}
              >
                Keine Zeit
              </StatusButton>
              <StatusButton
                active={slot.status === 'unknown'}
                disabled={disabled}
                onClick={() => setStatus(key, 'unknown')}
              >
                Unbekannt
              </StatusButton>
            </div>

            {isAvailable && (
              <div className="flex items-center gap-2 sm:ml-auto">
                <span className="stat-label">von</span>
                <TimeSelect value={slot.from} disabled={disabled} onChange={v => setTime(key, 'from', v)} />
                <span className="stat-label">bis</span>
                <TimeSelect value={slot.to} disabled={disabled} onChange={v => setTime(key, 'to', v)} />
              </div>
            )}
          </div>
        )
      })}
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
        Lass „von/bis" leer für „ganztägig". Die Zeiten helfen den Coaches, ein gemeinsames Scrim-Fenster zu finden.
      </p>
    </div>
  )
}

function StatusButton({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-sm px-3 py-1.5 text-xs font-semibold transition ${active ? 'btn-amber' : 'btn-ghost'}`}
    >
      {children}
    </button>
  )
}

function TimeSelect({
  value,
  disabled,
  onChange,
}: {
  value: number | null
  disabled?: boolean
  onChange: (raw: string) => void
}) {
  return (
    <select
      className="input-field !w-24 !py-1.5"
      disabled={disabled}
      value={value == null ? '' : String(value)}
      onChange={e => onChange(e.target.value)}
    >
      <option value="">—</option>
      {TIME_OPTIONS.map(opt => (
        <option key={opt.value} value={String(opt.value)}>
          {opt.label}
        </option>
      ))}
    </select>
  )
}
