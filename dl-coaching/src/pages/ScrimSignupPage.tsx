import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { scrims, type ScrimParticipant, type ScrimSignupRequest, type WeeklyAvailability } from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import AvailabilityEditor from '@/components/AvailabilityEditor'
import { Avatar, EmptyState, PageSpinner } from '@/components/ui'
import { emptyWeekly, WEEKDAYS } from '@/lib/availability'
import type { User } from '@/types'

interface SignupForm {
  rankName: string
  rankTier: string
  roles: string
  availability_slots: WeeklyAvailability
}

// Rangfolge wie im Spiel; identisch zur Rang-Auswahl im Discord-Onboarding.
const RANKS = [
  'Initiate', 'Seeker', 'Alchemist', 'Arcanist', 'Ritualist', 'Emissary',
  'Archon', 'Oracle', 'Phantom', 'Ascendant', 'Eternus',
] as const

// Jede Stufe hat 6 Unterstufen. Ohne sie ist der Rang fuer Team-Balance wertlos —
// im Scrim-Kanal nennen die Leute durchweg "Phantom 6" / "Oracle 4", nie nur "Phantom".
const TIERS = ['1', '2', '3', '4', '5', '6'] as const

/** "Phantom" + "3" -> "Phantom 3". Ohne Stufe nur der Name, ohne Namen leer. */
function composeRank(name: string, tier: string): string {
  if (!name) return ''
  return tier ? `${name} ${tier}` : name
}

/** Zerlegt "Phantom 3" zurueck in Name + Stufe; toleriert Altbestand ohne Stufe. */
function splitRank(rank: string | null | undefined): { rankName: string; rankTier: string } {
  const match = /^\s*(.+?)\s*([1-6])?\s*$/.exec(rank ?? '')
  const name = match?.[1] ?? ''
  return {
    rankName: RANKS.find(r => r.toLowerCase() === name.toLowerCase()) ?? (name ? 'Unbekannt' : ''),
    rankTier: match?.[2] ?? '',
  }
}

const COPY = {
  availabilityLink: 'Meine Verfügbarkeit',
  rolesLabel: 'Rolle / Lane',
  weeklyLabel: 'Wann kannst du?',
  rankPlaceholder: 'Rang wählen …',
  rankUnknown: 'Weiß ich nicht',
  tierPlaceholder: 'Stufe',
} as const

function optionalValue(value: string): string | undefined {
  const trimmed = value.trim()
  return trimmed || undefined
}

/** Ohne mindestens einen freien Tag kann kein Team geplant werden — das ist die einzige Angabe, die wir nicht nachschlagen können. */
function hasAnyAvailability(weekly: WeeklyAvailability): boolean {
  return WEEKDAYS.some(day => weekly[day.key].status === 'available')
}

function formFromParticipant(participant: ScrimParticipant | null | undefined): SignupForm {
  return {
    ...splitRank(participant?.rank),
    roles: participant?.roles ?? '',
    availability_slots: participant?.availability_slots ?? emptyWeekly(),
  }
}

function ScrimSignupForm({ user, initialForm }: { user: User; initialForm: SignupForm }) {
  const qc = useQueryClient()
  const [form, setForm] = useState<SignupForm>(initialForm)
  const availabilityOk = hasAnyAvailability(form.availability_slots)

  const submit = useMutation({
    mutationFn: () => {
      const payload: ScrimSignupRequest = {
        rank: optionalValue(composeRank(form.rankName, form.rankTier)),
        roles: optionalValue(form.roles),
        availability_slots: form.availability_slots,
      }
      return scrims.signup(payload)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['scrim-me'] })
      qc.invalidateQueries({ queryKey: ['scrim-pool'] })
    },
  })

  const update = (key: 'rankName' | 'rankTier' | 'roles', value: string) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  if (submit.isSuccess) {
    return (
      <div className="content-grid pb-16 pt-10 md:pt-14">
        <EmptyState
          title="Anmeldung gespeichert"
          copy="Dein Scrim-Profil wurde gespeichert und ist für Coaches sichtbar."
        >
          <div className="flex flex-wrap justify-center gap-2">
            <Link to="/me/scrims" className="btn-amber">{COPY.availabilityLink}</Link>
            <button type="button" onClick={() => submit.reset()} className="btn-ghost">
              Erneut bearbeiten
            </button>
          </div>
        </EmptyState>
      </div>
    )
  }

  const submitError = submit.error instanceof Error && submit.error.message
    ? submit.error.message
    : 'Anmeldung konnte nicht gespeichert werden.'

  return (
    <div className="content-grid pb-16 pt-10 md:pt-14">
      <section className="animate-in-left mb-8">
        <p className="eyebrow mb-4">Scrims</p>
        <h1 className="section-title">Anmeldung Inhouse-Coachscrims</h1>
        <p className="section-copy mt-3 max-w-xl">
          Feste Teams mit festem Coach: Ihr trainiert zwei bis drei Mal die Woche zusammen und
          spielt alle ein bis zwei Wochen ein Inhouse gegen die anderen Teams. Dazwischen schauen
          wir uns eure Spiele an und arbeiten an euren Punkten.
        </p>
        <p className="section-copy mt-3 max-w-xl" style={{ color: 'var(--text-muted)' }}>
          Wenn das für dich passt, brauchen wir zwei Minuten von dir. Deinen Namen haben wir schon
          aus deinem Discord-Login.
        </p>
      </section>

      <form
        className="panel-strong max-w-3xl space-y-5 p-6"
        onSubmit={(event) => {
          event.preventDefault()
          submit.mutate()
        }}
      >
        <div className="flex items-center gap-3 border-b pb-4" style={{ borderColor: 'var(--border-dim)' }}>
          <Avatar url={user.avatarUrl} name={user.displayName} size={38} />
          <div>
            <strong className="font-display text-sm uppercase tracking-[0.06em] text-white">{user.displayName}</strong>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Discord-Login aktiv
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <span className="stat-label">Rang</span>
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <select
                value={form.rankName}
                onChange={(event) => update('rankName', event.target.value)}
                className="input-field"
                aria-label="Rang"
              >
                <option value="">{COPY.rankPlaceholder}</option>
                {RANKS.map(rank => (
                  <option key={rank} value={rank}>{rank}</option>
                ))}
                <option value="Unbekannt">{COPY.rankUnknown}</option>
              </select>
              <select
                value={form.rankTier}
                onChange={(event) => update('rankTier', event.target.value)}
                className="input-field"
                aria-label="Unterstufe"
                disabled={!form.rankName || form.rankName === 'Unbekannt'}
              >
                <option value="">{COPY.tierPlaceholder}</option>
                {TIERS.map(tier => (
                  <option key={tier} value={tier}>{tier}</option>
                ))}
              </select>
            </div>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="stat-label">{COPY.rolesLabel}</span>
            <input
              value={form.roles}
              onChange={(event) => update('roles', event.target.value)}
              placeholder="z. B. Flex, Support"
              className="input-field"
            />
          </label>

          <div className="space-y-2 md:col-span-2">
            <span className="stat-label">{COPY.weeklyLabel}</span>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Das Wichtigste: Daran rechnen wir aus, wann dein Team gemeinsam kann. Trag mindestens
              einen Tag ein — lieber grob und ehrlich als zu genau.
            </p>
            <AvailabilityEditor
              value={form.availability_slots}
              onChange={(next) => setForm((current) => ({ ...current, availability_slots: next }))}
              disabled={submit.isPending}
            />
          </div>
        </div>

        {!availabilityOk && (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Trag noch mindestens einen Tag ein, an dem du kannst.
          </p>
        )}

        {submit.isError && (
          <p className="text-sm" style={{ color: 'var(--red)' }}>{submitError}</p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Link to="/me/scrims" className="btn-ghost">Abbrechen</Link>
          <button type="submit" className="btn-amber" disabled={submit.isPending || !availabilityOk}>
            Anmeldung speichern
          </button>
        </div>
      </form>
    </div>
  )
}

export default function ScrimSignupPage() {
  const { user, login, isLoading: authLoading } = useAuth()
  const meQuery = useQuery({
    queryKey: ['scrim-me'],
    queryFn: () => scrims.me(),
    enabled: !!user,
  })

  if (authLoading) return <PageSpinner />

  if (!user) {
    return (
      <div className="content-grid pb-16 pt-10 md:pt-14">
        <div className="eyebrow mb-4">Scrims</div>
        <h1 className="section-title mb-8">Web-Anmeldung</h1>
        <EmptyState
          title="Anmeldung nötig"
          copy="Melde dich mit Discord an, damit dein Name serverseitig übernommen wird."
        >
          <button onClick={login} className="btn-amber">Login mit Discord</button>
        </EmptyState>
      </div>
    )
  }

  if (meQuery.isLoading) return <PageSpinner />

  if (meQuery.isError) {
    const message = meQuery.error instanceof Error
      ? meQuery.error.message
      : 'Anmeldung konnte nicht geladen werden.'
    return (
      <div className="content-grid pb-16 pt-10 md:pt-14">
        <EmptyState title="Fehler beim Laden" copy={message} />
      </div>
    )
  }

  return <ScrimSignupForm user={user} initialForm={formFromParticipant(meQuery.data?.participant)} />
}
