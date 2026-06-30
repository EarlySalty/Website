import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { coaching, type CreateCoachingRequest } from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import { Avatar, EmptyState, PageSpinner } from '@/components/ui'

interface RequestForm {
  rank: string
  hero: string
  time: string
  experience: string
  problems: string
}

const initialForm: RequestForm = {
  rank: '',
  hero: '',
  time: '',
  experience: '',
  problems: '',
}

export default function CoachingRequestPage() {
  const { user, login, isLoading: authLoading } = useAuth()
  const [searchParams] = useSearchParams()
  const preferredCoachId = searchParams.get('coach') ?? ''
  const [form, setForm] = useState<RequestForm>(initialForm)

  const submit = useMutation({
    mutationFn: () => {
      const payload: CreateCoachingRequest = {
        display_name: user?.displayName,
        rank: form.rank.trim(),
        hero: form.hero.trim(),
        availability: form.time.trim(),
        games_played: form.experience.trim(),
        hours_played: form.experience.trim(),
        current_problems: form.problems.trim(),
        preferred_coach_id: preferredCoachId || undefined,
      }
      return coaching.createRequest(payload)
    },
  })

  const update = (key: keyof RequestForm, value: string) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  if (authLoading) return <PageSpinner />

  if (!user) {
    return (
      <div className="request-page content-grid">
        <section className="request-intro">
          <p className="eyebrow mb-4">Coaching anfragen</p>
          <h1 className="section-title">Kurz einloggen, Anfrage stellen.</h1>
          <p className="section-copy mt-3 max-w-xl">
            Die Anfrage läuft über deinen Website-Login. Discord bleibt für Rückfragen, Voice und Erinnerungen.
          </p>
          <button onClick={login} className="btn-amber mt-6">Mit Discord einloggen</button>
        </section>
      </div>
    )
  }

  if (submit.isSuccess) {
    return (
      <div className="content-grid pb-16 pt-10 md:pt-14">
        <EmptyState
          title="Anfrage ist drin"
          copy="Die Coaches sehen deine Anfrage jetzt im Cockpit. Sobald jemand übernimmt, tauchen Termine und Notizen in deinem Coaching-Bereich auf."
        >
          <div className="flex flex-wrap justify-center gap-2">
            <Link to="/me" className="btn-amber">Mein Coaching</Link>
            <Link to="/" className="btn-ghost">Coaches ansehen</Link>
          </div>
        </EmptyState>
      </div>
    )
  }

  const canSubmit = form.rank.trim() && form.hero.trim() && form.time.trim() && form.experience.trim() && form.problems.trim()
  const submitError = submit.error instanceof Error && submit.error.message
    ? submit.error.message
    : 'Konnte nicht gespeichert werden. Bitte später erneut versuchen.'

  return (
    <div className="request-page content-grid">
      <section className="request-intro">
        <p className="eyebrow mb-4">Website-Anfrage</p>
        <h1 className="section-title">Deadlock Coaching</h1>
        <p className="section-copy mt-3 max-w-xl">
          Wenige Angaben reichen. Ein Coach sieht deine Anfrage, stimmt den Termin mit dir ab und hält danach die Notizen fest.
        </p>
      </section>

      <form
        className="request-form"
        onSubmit={(event) => {
          event.preventDefault()
          if (canSubmit) submit.mutate()
        }}
      >
        <div className="request-user">
          <Avatar url={user.avatarUrl} name={user.displayName} size={38} />
          <div>
            <strong>{user.displayName}</strong>
            <span>Discord-Login aktiv</span>
          </div>
        </div>

        <div className="request-fields">
          <label className="request-field">
            <span>Aktueller Rang <b>*</b></span>
            <input
              value={form.rank}
              onChange={(event) => update('rank', event.target.value)}
              placeholder="z. B. Archon 3"
              required
            />
          </label>

          <label className="request-field">
            <span>Main-Hero <b>*</b></span>
            <input
              value={form.hero}
              onChange={(event) => update('hero', event.target.value)}
              placeholder="z. B. Haze"
              required
            />
          </label>

          <label className="request-field">
            <span>Wunschzeit <b>*</b></span>
            <input
              type="datetime-local"
              value={form.time}
              onChange={(event) => update('time', event.target.value)}
              required
            />
          </label>

          <label className="request-field">
            <span>Games / Stunden <b>*</b></span>
            <input
              value={form.experience}
              onChange={(event) => update('experience', event.target.value)}
              placeholder="z. B. 300 Games / 150 Stunden"
              required
            />
          </label>

          <label className="request-field request-field-full">
            <span>Was willst du verbessern? <b>*</b></span>
            <textarea
              value={form.problems}
              onChange={(event) => update('problems', event.target.value)}
              placeholder="z. B. Laning, Farming, Teamfights, Build-Entscheidungen, Replay anschauen..."
              rows={4}
              required
            />
          </label>
        </div>

        {submit.isError && (
          <p className="request-error">{submitError}</p>
        )}

        <div className="request-actions">
          <Link to="/" className="btn-ghost">Abbrechen</Link>
          <button type="submit" className="btn-amber" disabled={!canSubmit || submit.isPending}>
            Anfrage senden
          </button>
        </div>
      </form>
    </div>
  )
}
