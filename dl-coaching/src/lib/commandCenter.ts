/**
 * Typen und Ableitungen fuer das Scrim-Orga-Dashboard.
 *
 * Quelle ist GET /api/scrim/command-center. Der BFF (scrim_proxy.rs, adapt_command_center)
 * liefert alles fuer einen Bildschirm in einem Aufruf. Achtung beim Vertrag:
 *   - `attention` enthaelt nur Referenzen {kind, source, id} — keine anzeigefertigen Objekte.
 *     Die Aufloesung passiert hier lokal gegen die mitgelieferten Vollobjekte.
 *   - Das Feld `matches` im Response ist ein Alias auf `match_request_batches`, also die
 *     *Abfragen*. Die echten Spiele stehen in `operational_matches`. Wir lesen nur die
 *     eindeutigen Felder, damit die Verwechslung nicht ins Frontend durchschlaegt.
 *   - IDs sind Strings: der Turnier-Service serialisiert i32 ueber wire_id als String.
 *
 * Diese Datei bleibt bewusst frei von React und import.meta, damit `node --test` sie
 * ohne Browser-Umgebung ausfuehren kann.
 */

export type AttentionKind = 'missing_responses' | 'replacement' | 'error'
export type AttentionSource = 'match_request_batch' | 'operational_match'

export interface AttentionRef {
  kind: AttentionKind
  source: AttentionSource
  id: string | null
}

export interface ScrimTeamRef {
  id: string
  name: string
}

export interface OperationalMatch {
  id: string
  status: string
  team_a: ScrimTeamRef | null
  team_b: ScrimTeamRef | null
  when_text?: string | null
  scheduled_at?: string | null
  join_code?: string | null
  lobby_state?: string | null
}

export interface MatchRequestBatch {
  id: string
  template: string
  deadline_at: string
  status: string
  created_by_display_name: string
  requests: unknown[]
  missing_response_count?: number
}

export interface LagebildRef {
  id: string
  team_id: string
  generated_at: string
  status: string
  model?: string | null
  error?: string | null
}

export interface CommandCenterParticipant {
  id: string
  display_name: string
  status?: string
}

export interface CommandCenterTeam {
  id: string
  name: string
  coach?: string | null
}

export interface ScrimCommandCenter {
  attention: AttentionRef[]
  participants: CommandCenterParticipant[]
  teams: CommandCenterTeam[]
  match_request_batches: MatchRequestBatch[]
  operational_matches: OperationalMatch[]
  timeline: unknown[]
  lagebild_refs: LagebildRef[]
}

export interface ResolvedAttention {
  kind: AttentionKind
  source: AttentionSource
  batch?: MatchRequestBatch
  match?: OperationalMatch
}

/** Matches in diesen Zustaenden sind erledigt und gehoeren nicht in die Vorschau. */
const CLOSED_MATCH_STATUS = new Set(['completed', 'cancelled', 'abandoned'])

/** Abfragen in diesen Zustaenden warten auf niemanden mehr. */
const CLOSED_BATCH_STATUS = new Set(['closed', 'cancelled', 'completed'])

/**
 * Loest die Referenzliste `attention` gegen die mitgelieferten Vollobjekte auf.
 *
 * Referenzen ohne auffindbares Ziel werden verworfen statt als leere Karte gerendert:
 * der BFF setzt id auf null, wenn das Upstream-Objekt keine id trug (scrim_proxy.rs item_id).
 * Mehrere Signale zum selben Objekt bleiben eigene Eintraege — ein Batch kann gleichzeitig
 * fehlende Antworten und einen Fehler haben, und beides soll sichtbar sein.
 */
export function resolveAttention(data: ScrimCommandCenter): ResolvedAttention[] {
  const batches = new Map(data.match_request_batches.map(batch => [String(batch.id), batch]))
  const matches = new Map(data.operational_matches.map(match => [String(match.id), match]))

  return data.attention.flatMap<ResolvedAttention>(ref => {
    if (ref.id == null) return []
    const id = String(ref.id)

    if (ref.source === 'match_request_batch') {
      const batch = batches.get(id)
      return batch ? [{ kind: ref.kind, source: ref.source, batch }] : []
    }

    const match = matches.get(id)
    return match ? [{ kind: ref.kind, source: ref.source, match }] : []
  })
}

/** Anstehende Spiele, frueheste zuerst. Terminlose landen hinten statt zu verschwinden. */
export function upcomingMatches(data: ScrimCommandCenter): OperationalMatch[] {
  return data.operational_matches
    .filter(match => !CLOSED_MATCH_STATUS.has(statusKey(match.status)))
    .slice()
    .sort((a, b) => compareOptionalDate(a.scheduled_at, b.scheduled_at))
}

/** Das Backend darf Teilantworten ohne Status liefern; ohne Status gilt ein Vorgang als offen. */
function statusKey(status: string | null | undefined): string {
  return typeof status === 'string' ? status.toLowerCase() : ''
}

/** Offene Abfragen, dringendste Deadline zuerst. */
export function openBatches(data: ScrimCommandCenter): MatchRequestBatch[] {
  return data.match_request_batches
    .filter(batch => !CLOSED_BATCH_STATUS.has(statusKey(batch.status)))
    .slice()
    .sort((a, b) => compareOptionalDate(a.deadline_at, b.deadline_at))
}

/** Fehlende Werte sortieren ans Ende, nicht an den Anfang. */
function compareOptionalDate(a: string | null | undefined, b: string | null | undefined): number {
  if (!a && !b) return 0
  if (!a) return 1
  if (!b) return -1
  return a.localeCompare(b)
}
