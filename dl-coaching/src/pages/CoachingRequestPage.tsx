import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { coaching, type CreateCoachingRequest } from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import { Avatar, EmptyState, PageSpinner } from '@/components/ui'

interface RequestForm {
  rank: string
  hero: string
  availability: string
  experience: string
  problems: string
}

const initialForm: RequestForm = {
  rank: '',
  hero: '',
  availability: '',
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
        availability: form.availability.trim(),
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
      <div className="discord-modal-page content-grid">
        <div className="discord-request-modal">
          <div className="discord-modal-head">
            <span className="discord-modal-mark">DDC</span>
            <div>
              <h1>Deadlock Coaching</h1>
              <p>Einloggen, Formular ausfüllen, fertig.</p>
            </div>
          </div>
          <div className="discord-warning">
            <span>!</span>
            <p>Die Anfrage läuft über deine Website-Anmeldung. Discord bleibt nur für Login, Rückfragen und Voice.</p>
          </div>
          <button onClick={login} className="discord-submit w-full">Mit Discord einloggen</button>
        </div>
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

  const canSubmit = form.rank.trim() && form.hero.trim() && form.availability.trim() && form.experience.trim() && form.problems.trim()

  return (
    <div className="discord-modal-page content-grid">
      <form
        className="discord-request-modal"
        onSubmit={(event) => {
          event.preventDefault()
          if (canSubmit) submit.mutate()
        }}
      >
        <div className="discord-modal-head">
          <span className="discord-modal-mark">DDC</span>
          <div>
            <h1>Deadlock Coaching</h1>
            <p>Angemeldet als {user.displayName}</p>
          </div>
        </div>

        <div className="discord-user-strip">
          <Avatar url={user.avatarUrl} name={user.displayName} size={34} />
          <div>
            <strong>{user.displayName}</strong>
            <span>Discord-Login aktiv</span>
          </div>
        </div>

        <div className="discord-warning">
          <span>!</span>
          <p>Dieses Formular wird an die DDC-Coaches geschickt. Teile hier keine Passwörter oder sensiblen Daten.</p>
        </div>

        <label className="discord-field">
          <span>Rang + Subrank <b>*</b></span>
          <input
            value={form.rank}
            onChange={(event) => update('rank', event.target.value)}
            placeholder="z. B. Archon 3, Ascendant VI, Emissary II"
            required
          />
        </label>

        <label className="discord-field">
          <span>Main-Hero <b>*</b></span>
          <input
            value={form.hero}
            onChange={(event) => update('hero', event.target.value)}
            placeholder="z. B. Haze, Seven, Vindicta"
            required
          />
        </label>

        <label className="discord-field">
          <span>Wann hast du Zeit? <b>*</b></span>
          <input
            value={form.availability}
            onChange={(event) => update('availability', event.target.value)}
            placeholder="z. B. Montag 18:00, heute Abend ab 20 Uhr"
            required
          />
        </label>

        <label className="discord-field">
          <span>Games / Stunden <b>*</b></span>
          <input
            value={form.experience}
            onChange={(event) => update('experience', event.target.value)}
            placeholder="z. B. 300 Games / 150 Stunden"
            required
          />
        </label>

        <label className="discord-field">
          <span>Probleme / Ziele <b>*</b></span>
          <textarea
            value={form.problems}
            onChange={(event) => update('problems', event.target.value)}
            placeholder="Wobei brauchst du Hilfe? Keine DMs an Coaches, Kommunikation nur im Chat."
            rows={4}
            required
          />
        </label>

        {submit.isError && (
          <p className="discord-error">Konnte nicht gespeichert werden. Bitte später erneut versuchen.</p>
        )}

        <div className="discord-actions">
          <Link to="/" className="discord-cancel">Abbrechen</Link>
          <button type="submit" className="discord-submit" disabled={!canSubmit || submit.isPending}>
            Absenden
          </button>
        </div>
      </form>
    </div>
  )
}
