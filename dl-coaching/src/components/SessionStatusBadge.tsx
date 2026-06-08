const STATUS: Record<string, { label: string; color: string; bg: string; border: string }> = {
  active:    { label: 'Aktiv',         color: 'var(--sky)',   bg: 'rgba(56,189,248,0.10)',  border: 'rgba(56,189,248,0.24)' },
  completed: { label: 'Abgeschlossen', color: 'var(--green)', bg: 'rgba(34,197,94,0.10)',   border: 'rgba(34,197,94,0.24)' },
  cancelled: { label: 'Abgebrochen',   color: 'var(--red)',   bg: 'rgba(239,68,68,0.10)',   border: 'rgba(239,68,68,0.24)' },
}

export default function SessionStatusBadge({ status }: { status: string }) {
  const s = STATUS[status] ?? { label: status, color: 'var(--text-muted)', bg: 'var(--bg-raised)', border: 'var(--border-dim)' }
  return (
    <span
      className="inline-flex items-center rounded-sm px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
      style={{
        color: s.color,
        background: s.bg,
        border: `1px solid ${s.border}`,
        fontFamily: "'Rajdhani', sans-serif",
      }}
    >
      {s.label}
    </span>
  )
}
