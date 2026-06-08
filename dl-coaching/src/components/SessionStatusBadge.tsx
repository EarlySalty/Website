const STATUS: Record<string, { label: string; cls: string }> = {
  active: { label: 'Aktiv', cls: 'bg-sky-400/15 text-sky-300' },
  completed: { label: 'Abgeschlossen', cls: 'bg-emerald-400/15 text-emerald-300' },
  cancelled: { label: 'Abgebrochen', cls: 'bg-rose-400/15 text-rose-300' },
}

export default function SessionStatusBadge({ status }: { status: string }) {
  const s = STATUS[status] ?? { label: status, cls: 'bg-slate-500/15 text-slate-300' }
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${s.cls}`}>{s.label}</span>
}
