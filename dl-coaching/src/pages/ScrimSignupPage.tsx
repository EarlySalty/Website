import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { scrims, type ScrimParticipant, type ScrimSignupRequest, type WeeklyAvailability } from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import AvailabilityEditor from '@/components/AvailabilityEditor'
import { Avatar, EmptyState, PageSpinner } from '@/components/ui'
import { emptyWeekly } from '@/lib/availability'
import type { User } from '@/types'

interface SignupForm {
  rank: string
  roles: string
  availability_slots: WeeklyAvailability
}

const COPY = {
  availabilityLink: 'Meine Verfügbarkeit',
  rolesLabel: 'Rolle / Lane',
  weeklyLabel: 'Wochen-Verfügbarkeit',
} as const

function optionalValue(value: string): string | undefined {
  const trimmed = value.trim()
  return trimmed || undefined
}

function formFromParticipant(participant: ScrimParticipant | null | undefined): SignupForm {
  return {
    rank: participant?.rank ?? '',
    roles: participant?.roles ?? '',
    availability_slots: participant?.availability_slots ?? emptyWeekly(),
  }
}

function ScrimSignupForm({ user, initialForm }: { user: User; initialForm: SignupForm }) {
  const qc = useQueryClient()
  const [form, setForm] = useState<SignupForm>(initialForm)

  const submit = useMutation({
    mutationFn: () => {
      const payload: ScrimSignupRequest = {
        rank: optionalValue(form.rank),
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

  const update = (key: 'rank' | 'roles', value: string) => {
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
        <h1 className="section-title">Web-Anmeldung</h1>
        <p className="section-copy mt-3 max-w-xl">
          Rang, Rollen und Verfügbarkeit sind optional. Dein Discord-Name kommt automatisch aus deinem Login.
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
          <label className="flex flex-col gap-1.5">
            <span className="stat-label">Rang</span>
            <input
              value={form.rank}
              onChange={(event) => update('rank', event.target.value)}
              placeholder="z. B. Oracle"
              className="input-field"
            />
          </label>

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
            <AvailabilityEditor
              value={form.availability_slots}
              onChange={(next) => setForm((current) => ({ ...current, availability_slots: next }))}
              disabled={submit.isPending}
            />
          </div>
        </div>

        {submit.isError && (
          <p className="text-sm" style={{ color: 'var(--red)' }}>{submitError}</p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Link to="/me/scrims" className="btn-ghost">Abbrechen</Link>
          <button type="submit" className="btn-amber" disabled={submit.isPending}>
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
