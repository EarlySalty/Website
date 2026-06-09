import type { ReactNode } from 'react'

/** Abschnittskopf im Briefing-Stil: // LABEL ── mit optionalem Zähler. */
export function SectionHead({ label, count, action }: { label: string; count?: number; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <span className="font-mono-data text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: 'var(--amber)' }}>
        {'// '}{label}
      </span>
      {count !== undefined && (
        <span
          className="font-mono-data rounded-sm px-1.5 py-0.5 text-[10px] font-bold"
          style={{ background: 'var(--amber-glow)', color: 'var(--amber)', border: '1px solid var(--amber-border)' }}
        >
          {String(count).padStart(2, '0')}
        </span>
      )}
      <div className="divider flex-1" />
      {action}
    </div>
  )
}

/** Leerer Zustand mit Erklärung statt nackter „Noch keine …“-Zeile. */
export function EmptyState({ title, copy, children }: { title: string; copy?: string; children?: ReactNode }) {
  return (
    <div className="empty-state">
      <span className="empty-state-mark">◇ ◇ ◇</span>
      <p className="empty-state-title">{title}</p>
      {copy && <p className="empty-state-copy">{copy}</p>}
      {children && <div className="mt-4 flex justify-center">{children}</div>}
    </div>
  )
}

/** Avatar mit abgeschnittener Ecke; fällt auf den Anfangsbuchstaben zurück. */
export function Avatar({ url, name, size = 48, className = '' }: { url?: string | null; name?: string | null; size?: number; className?: string }) {
  const initial = (name || '?').charAt(0).toUpperCase()
  return (
    <div className={`avatar-frame flex-shrink-0 overflow-hidden ${className}`} style={{ width: size, height: size }}>
      {url ? (
        <img src={url} alt={name || ''} className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <div
          className="font-display flex h-full w-full items-center justify-center font-bold"
          style={{ color: 'var(--amber)', fontSize: size * 0.42 }}
        >
          {initial}
        </div>
      )}
    </div>
  )
}

export function PageSpinner() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="spinner h-8 w-8" />
    </div>
  )
}

/** Zentrale Sperr-Ansicht für Coach-Bereiche. */
export function CoachOnly() {
  return (
    <div className="content-grid py-16">
      <EmptyState
        title="Nur für Coaches"
        copy="Dieser Bereich ist Mitgliedern mit der Coach-Rolle vorbehalten. Wenn du Coach bist, melde dich mit deinem Discord-Account an."
      />
    </div>
  )
}
