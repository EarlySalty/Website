import { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { coaching, type CreateCoachingRequest } from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import { EmptyState, PageSpinner, SectionHead } from '@/components/ui'

const RANKS = ['Initiate', 'Seeker', 'Alchemist', 'Arcanist', 'Ritualist', 'Emissary', 'Archon', 'Oracle', 'Phantom', 'Ascendant', 'Eternus']
const TIMES = ['Werktags abends', 'Wochenende', 'Spontan nach Absprache', 'Schichtplan / wechselnd']

export default function CoachingRequestPage() {
  const { user, login, isLoading: authLoading } = useAuth()
  const [searchParams] = useSearchParams()
  const preferredCoachId = searchParams.get('coach') ?? ''
  const [form, setForm] = useState<CreateCoachingRequest>({
    display_name: user?.displayName ?? '',
    rank: '',
    subrank: '',
    hero: '',
    games_played: '',
    hours_played: '',
    availability: '',
    current_problems: '',
    goals: '',
    preferred_coach_id: preferredCoachId,
  })

  const { data: coaches } = useQuery({
    queryKey: ['coaches'],
    queryFn: () => coaching.listCoaches(),
  })

  const sortedCoaches = useMemo(
    () => [...(coaches ?? [])].sort((a, b) => a.display_name.localeCompare(b.display_name)),
    [coaches]
  )

  const submit = useMutation({
    mutationFn: () => {
      const payload: CreateCoachingRequest = {
        ...form,
        display_name: form.display_name?.trim() || user?.displayName,
        current_problems: form.current_problems.trim(),
        preferred_coach_id: form.preferred_coach_id || undefined,
      }
      return coaching.createRequest(payload)
    },
  })

  const update = (key: keyof CreateCoachingRequest, value: string) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  if (authLoading) return <PageSpinner />

  if (!user) {
    return (
      <div className="content-grid pb-16 pt-10 md:pt-14">
        <div className="salon-hero animate-in-left">
          <div className="eyebrow mb-4">Coaching anfragen</div>
          <h1 className="hero-display max-w-3xl">
            Erst Website.<br />
            <span style={{ color: 'var(--amber-light)' }}>Dann Discord.</span>
          </h1>
          <p className="section-copy mt-5 max-w-2xl text-[15px]">
            Deine Anfrage, Ziele und Termine laufen hier. Discord bleibt für Login, Abstimmung im Chat und Erinnerungen.
          </p>
          <button onClick={login} className="btn-amber mt-6">Mit Discord einloggen</button>
        </div>
      </div>
    )
  }

  if (submit.isSuccess) {
    return (
      <div className="content-grid pb-16 pt-10 md:pt-14">
        <EmptyState
          title="Anfrage ist drin"
          copy="Die Coaches sehen deine Anfrage jetzt im Cockpit. Sobald jemand übernimmt, landen Termin, Ziele und Notizen in deinem Coaching-Bereich."
        >
          <div className="flex flex-wrap justify-center gap-2">
            <Link to="/me" className="btn-amber">Mein Coaching</Link>
            <Link to="/" className="btn-ghost">Coaches ansehen</Link>
          </div>
        </EmptyState>
      </div>
    )
  }

  return (
    <div className="content-grid pb-16 pt-10 md:pt-14">
      <div className="salon-hero animate-in-left mb-10">
        <div className="eyebrow mb-4">Website-Anfrage</div>
        <h1 className="hero-display max-w-4xl">
          Coaching buchen,<br />
          <span style={{ color: 'var(--amber-light)' }}>ohne im Chat zu suchen.</span>
        </h1>
        <p className="section-copy mt-5 max-w-2xl text-[15px]">
          Beschreibe kurz deinen Stand und dein Ziel. Coaches sehen die Anfrage hier, klären den Termin mit dir und halten danach Notizen fest.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <form
          className="panel-strong animate-in space-y-6 p-5 md:p-6"
          onSubmit={(event) => {
            event.preventDefault()
            if (form.current_problems.trim()) submit.mutate()
          }}
        >
          <SectionHead label="Deine Anfrage" />

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="stat-label mb-1 block">Anzeigename</span>
              <input
                value={form.display_name ?? ''}
                onChange={(event) => update('display_name', event.target.value)}
                placeholder={user.displayName}
                className="input-field w-full"
              />
            </label>
            <label className="block">
              <span className="stat-label mb-1 block">Bevorzugter Coach</span>
              <select
                value={form.preferred_coach_id ?? ''}
                onChange={(event) => update('preferred_coach_id', event.target.value)}
                className="input-field w-full"
              >
                <option value="">Egal, wer passt</option>
                {sortedCoaches.map((coach) => (
                  <option key={coach.id} value={coach.id}>{coach.display_name}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="stat-label mb-1 block">Rank</span>
              <select value={form.rank ?? ''} onChange={(event) => update('rank', event.target.value)} className="input-field w-full">
                <option value="">Noch nicht sicher</option>
                {RANKS.map((rank) => <option key={rank} value={rank}>{rank}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="stat-label mb-1 block">Subrank / Division</span>
              <input value={form.subrank ?? ''} onChange={(event) => update('subrank', event.target.value)} placeholder="z. B. IV" className="input-field w-full" />
            </label>
            <label className="block">
              <span className="stat-label mb-1 block">Main-Held oder Rolle</span>
              <input value={form.hero ?? ''} onChange={(event) => update('hero', event.target.value)} placeholder="z. B. Haze, Support, Flex" className="input-field w-full" />
            </label>
            <label className="block">
              <span className="stat-label mb-1 block">Verfügbarkeit</span>
              <select value={form.availability ?? ''} onChange={(event) => update('availability', event.target.value)} className="input-field w-full">
                <option value="">Nach Absprache</option>
                {TIMES.map((time) => <option key={time} value={time}>{time}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="stat-label mb-1 block">Matches</span>
              <input value={form.games_played ?? ''} onChange={(event) => update('games_played', event.target.value)} placeholder="z. B. 80" className="input-field w-full" />
            </label>
            <label className="block">
              <span className="stat-label mb-1 block">Stunden</span>
              <input value={form.hours_played ?? ''} onChange={(event) => update('hours_played', event.target.value)} placeholder="z. B. 120" className="input-field w-full" />
            </label>
          </div>

          <label className="block">
            <span className="stat-label mb-1 block">Woran willst du arbeiten?</span>
            <textarea
              value={form.current_problems}
              onChange={(event) => update('current_problems', event.target.value)}
              rows={5}
              placeholder="Beschreibe 2-3 konkrete Probleme: Laning, Farming, Teamfights, Hero-Verständnis, Replay-Fragen..."
              className="input-field w-full resize-y"
              required
            />
          </label>

          <label className="block">
            <span className="stat-label mb-1 block">Ziel der ersten Session</span>
            <textarea
              value={form.goals ?? ''}
              onChange={(event) => update('goals', event.target.value)}
              rows={3}
              placeholder="z. B. klare Laning-Routine, bessere Build-Entscheidungen, Replay zusammen durchgehen"
              className="input-field w-full resize-y"
            />
          </label>

          <div className="flex flex-wrap items-center gap-3 border-t pt-4" style={{ borderColor: 'var(--border-dim)' }}>
            <button type="submit" className="btn-amber" disabled={!form.current_problems.trim() || submit.isPending}>
              Anfrage senden
            </button>
            {submit.isError && (
              <span className="text-sm" style={{ color: 'var(--red)' }}>
                Konnte nicht gespeichert werden. Bitte später erneut versuchen.
              </span>
            )}
          </div>
        </form>

        <aside className="request-ledger">
          <div>
            <p className="stat-label mb-2">Ablauf</p>
            <ol className="space-y-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
              <li><span style={{ color: 'var(--amber-light)' }}>01</span> Anfrage hier ausfüllen</li>
              <li><span style={{ color: 'var(--amber-light)' }}>02</span> Coach übernimmt im Cockpit</li>
              <li><span style={{ color: 'var(--amber-light)' }}>03</span> Termin wird mit dir abgestimmt</li>
              <li><span style={{ color: 'var(--amber-light)' }}>04</span> Notizen und Ziele bleiben in deiner Akte</li>
            </ol>
          </div>
          <div>
            <p className="stat-label mb-2">Discord bleibt für</p>
            <div className="flex flex-wrap gap-1.5">
              {['Login', 'Rückfragen', 'Voice', 'Erinnerungen'].map((item) => (
                <span key={item} className="chip">{item}</span>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
