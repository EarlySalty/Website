const STATUS: Record<string, { label: string; color: string; bg: string; border: string }> = {
  active:    { label: 'Aktiv',         color: 'var(--sky)',   bg: 'rgba(69,196,245,0.10)',  border: 'rgba(69,196,245,0.24)' },
  completed: { label: 'Abgeschlossen', color: 'var(--green)', bg: 'rgba(52,210,123,0.10)',  border: 'rgba(52,210,123,0.24)' },
  cancelled: { label: 'Abgesagt',      color: 'var(--red)',   bg: 'rgba(242,92,92,0.10)',   border: 'rgba(242,92,92,0.24)' },
  scheduled: { label: 'Geplant',       color: 'var(--amber)', bg: 'rgba(232,149,58,0.10)',  border: 'rgba(232,149,58,0.30)' },
  done:      { label: 'Erledigt',      color: 'var(--green)', bg: 'rgba(52,210,123,0.10)',  border: 'rgba(52,210,123,0.24)' },
}

export default function SessionStatusBadge({ status }: { status: string }) {
  const s = STATUS[status] ?? { label: status, color: 'var(--text-muted)', bg: 'var(--bg-raised)', border: 'var(--border-dim)' }
  return (
    <span
      className="font-display inline-flex items-center rounded-sm px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
      style={{ color: s.color, background: s.bg, border: `1px solid ${s.border}` }}
    >
      {s.label}
    </span>
  )
}
