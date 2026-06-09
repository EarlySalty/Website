/**
 * Zeit-Helfer. Das Backend speichert Zeitstempel in UTC, aber ohne
 * Zonen-Suffix (datetime.utcnow().isoformat() bzw. SQLite CURRENT_TIMESTAMP).
 * Nackte Strings müssen deshalb explizit als UTC interpretiert werden,
 * sonst verschiebt der Browser sie um die lokale Zeitzone.
 */
export function parseUtc(s: string | null | undefined): Date | null {
  if (!s) return null
  let v = s.trim()
  if (v.includes(' ') && !v.includes('T')) v = v.replace(' ', 'T')
  if (!/([zZ]|[+-]\d{2}:?\d{2})$/.test(v)) v += 'Z'
  const d = new Date(v)
  return isNaN(d.getTime()) ? null : d
}

export const fmtDate = (s: string | null | undefined): string => {
  const d = parseUtc(s)
  return d ? d.toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
}

export const fmtDateTime = (s: string | null | undefined): string => {
  const d = parseUtc(s)
  return d
    ? `${d.toLocaleString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} Uhr`
    : '—'
}

export const fmtUnix = (ts: number): string =>
  new Date(ts * 1000).toLocaleString('de-DE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

/** Date → Wert für <input type="datetime-local"> in lokaler Zeit. */
export function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Wert aus <input type="datetime-local"> → ISO-UTC fürs Backend. */
export function localInputToIso(value: string): string {
  return new Date(value).toISOString()
}

export function isUpcoming(s: string | null | undefined): boolean {
  const d = parseUtc(s)
  return !!d && d.getTime() >= Date.now() - 30 * 60 * 1000
}
