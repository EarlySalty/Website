import { useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { coaching, type CreateCoachingRequest } from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import { Avatar, PageSpinner } from '@/components/ui'
import heroData from '../../../scripts/data/heroes.json'
import { RANKS, RANK_IMAGES, TIERS, FOCUS_AREAS, availabilityText, finishDateInput, finishTimeInput, formatDateInput, formatTimeInput, validateWindow, type TimeWindow } from '@/lib/coachingRequest'

export default function CoachingRequestPage() {
  const { user, login, isLoading: authLoading } = useAuth()
  const [searchParams] = useSearchParams()
  const [rank, setRank] = useState('')
  const [tier, setTier] = useState('')
  const [hero, setHero] = useState('')
  const [heroSearch, setHeroSearch] = useState('')
  const [experience, setExperience] = useState('')
  const [focus, setFocus] = useState<string[]>([])
  const [notes, setNotes] = useState('')
  const [presets, setPresets] = useState<string[]>([])
  const [windows, setWindows] = useState<TimeWindow[]>([{ id: 0, date: '', from: '', to: '' }])
  const nextWindowId = useRef(1)
  const formRef = useRef<HTMLFormElement>(null)
  const [attempted, setAttempted] = useState(false)
  const [, setCheckedAt] = useState(0)
  const preferredCoachId = searchParams.get('coach') ?? ''
  const toggle = (values: string[], value: string) => values.includes(value) ? values.filter(item => item !== value) : [...values, value]
  const problems = [...focus, notes.trim()].filter(Boolean).join('; ')
  const check = (now: Date) => {
    const time = availabilityText(presets, windows, now)
    const errors: Record<string, string> = {}
    if (!rank || (rank !== 'Unbekannt' && !tier)) errors.rank = 'Bitte Rang und Stufe wählen.'
    if (!hero) errors.hero = 'Bitte deinen Main-Hero wählen.'
    for (const slot of windows) {
      const error = validateWindow(slot, now)
      if (error) errors[`window-${slot.id}`] = error
    }
    if (!time && !windows.some(slot => errors[`window-${slot.id}`])) errors.time = 'Bitte mindestens einen Zeitwunsch angeben.'
    if (!experience.trim()) errors.experience = 'Bitte deine Games oder Spielstunden angeben.'
    if (!problems) errors.problems = 'Bitte ein Thema wählen oder kurz beschreiben.'
    return { time, errors }
  }
  const { errors } = check(new Date())

  const submit = useMutation({ mutationFn: (payload: CreateCoachingRequest) => coaching.createRequest(payload) })

  const errorMessage = (key: string) => attempted && errors[key] ? <p id={`${key}-error`} className="request-error" role="alert">{errors[key]}</p> : null
  const invalid = (key: string) => attempted && !!errors[key]
  const updateWindow = (id: number, key: 'date' | 'from' | 'to', value: string) => setWindows(current => current.map(slot => slot.id === id ? { ...slot, [key]: value } : slot))
  const timeInput = (slot: TimeWindow, key: 'from' | 'to', label: string, placeholder: string) => <label className="request-field"><span>{label}</span><input inputMode="numeric" autoComplete="off" placeholder={placeholder} value={slot[key]} aria-invalid={invalid(`window-${slot.id}`)} onChange={event => updateWindow(slot.id, key, formatTimeInput(event.target.value))} onBlur={event => updateWindow(slot.id, key, finishTimeInput(event.target.value))} /></label>

  if (authLoading) return <PageSpinner />
  if (submit.isSuccess) return (
    <div className="content-grid request-success" role="status">
      <span className="success-check" aria-hidden="true">✓</span>
      <p className="eyebrow">Gespeichert</p><h1 className="section-title">Deine Anfrage ist drin.</h1>
      <p className="section-copy">Die Coaches können sie jetzt sehen. Dein Coaching-Bereich zeigt dir Termine und Notizen, sobald es weitergeht.</p>
      <div className="flex flex-wrap justify-center gap-3"><Link to="/me" className="btn-amber">Mein Coaching</Link><Link to="/" className="btn-ghost">Coaches ansehen</Link></div>
    </div>
  )

  return (
    <div className="request-page content-grid">
      <section className="request-intro">
        <p className="eyebrow mb-4">Dein nächster Schritt</p>
        <h1 className="section-title">Besser spielen.<br /><span className="request-title-accent">Zusammen.</span></h1>
        <p className="section-copy mt-4">Woran willst du arbeiten? Sag uns, wo du stehst und wann du Zeit hast.</p>
        <div className="request-intro-detail"><span aria-hidden="true">01</span><p>Du stellst die Anfrage.</p><span aria-hidden="true">02</span><p>Ein Coach übernimmt und stimmt den Termin mit dir ab.</p></div>
        <Link to="/" className="request-coaches-link">Coaches kennenlernen →</Link>
      </section>
      {!user ? <section className="request-form request-login">
        <h2>Coaching anfragen</h2><p>Melde dich mit Discord an, damit die Coaches deine Anfrage zuordnen können.</p>
        <button onClick={login} className="btn-amber">Mit Discord einloggen</button>
      </section> : <form ref={formRef} className="request-form" noValidate onSubmit={event => {
        event.preventDefault()
        if (submit.isPending) return
        const now = new Date()
        const current = check(now)
        setAttempted(true)
        setCheckedAt(now.getTime())
        if (Object.keys(current.errors).length) {
          requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus())
          return
        }
        submit.mutate({
          display_name: user.displayName,
          rank,
          subrank: rank === 'Unbekannt' ? undefined : tier,
          hero,
          availability: current.time,
          games_played: experience.trim(),
          hours_played: experience.trim(),
          current_problems: problems,
          preferred_coach_id: preferredCoachId || undefined,
        })
      }}>
        <div className="request-user"><Avatar url={user.avatarUrl} name={user.displayName} size={38} /><div><strong>{user.displayName}</strong><span>Deine Coaching-Anfrage</span></div></div>
        {preferredCoachId && <p className="request-hint mb-4">Deine Coach-Auswahl wird mitgeschickt.</p>}
        <fieldset className="request-section"><legend>Dein Rang</legend>
          <p className="request-hint">Wähle deinen aktuellen Rang und die Stufe.</p>
          <div className="rank-grid" role="group" aria-label="Aktueller Rang" aria-describedby={invalid('rank') ? 'rank-error' : undefined}>
            {RANKS.map((name, index) => <button key={name} type="button" className={`rank-option${rank === name ? ' is-selected' : ''}`} aria-pressed={rank === name} aria-invalid={invalid('rank')} onClick={() => setRank(name)}>
              <img src={RANK_IMAGES[index]} alt="" loading="lazy" /><span>{name}</span>
            </button>)}
            <button type="button" className={`rank-option${rank === 'Unbekannt' ? ' is-selected' : ''}`} aria-pressed={rank === 'Unbekannt'} onClick={() => { setRank('Unbekannt'); setTier('') }}><span className="unknown-rank" aria-hidden="true">?</span><span>Noch kein Rang</span></button>
          </div>
          {rank && rank !== 'Unbekannt' && <div className="tier-row" role="group" aria-label="Rangstufe"><span>Stufe</span>{TIERS.map(value => <button key={value} type="button" className={`choice-chip${tier === value ? ' is-selected' : ''}`} aria-pressed={tier === value} onClick={() => setTier(value)}>{value}</button>)}</div>}
          {errorMessage('rank')}
        </fieldset>
        <fieldset className="request-section"><legend>Dein Main-Hero</legend>
          <label className="request-field hero-search"><span className="sr-only">Helden suchen</span><input type="search" value={heroSearch} onChange={event => setHeroSearch(event.target.value)} placeholder="Helden suchen …" /></label>
          <div className="hero-grid" role="group" aria-label="Main-Hero" aria-describedby={invalid('hero') ? 'hero-error' : undefined}>
            {heroData.heroes.filter(item => item.name.toLocaleLowerCase('de').includes(heroSearch.trim().toLocaleLowerCase('de'))).map(item => <button type="button" key={item.slug} className={`hero-option${hero === item.name ? ' is-selected' : ''}`} aria-pressed={hero === item.name} aria-invalid={invalid('hero')} onClick={() => setHero(item.name)}>
              <img src={`/heroes/${item.slug}.png`} alt="" loading="lazy" /><span>{item.name}</span>{hero === item.name && <b aria-hidden="true">✓</b>}
            </button>)}
          </div>
          {!heroData.heroes.some(item => item.name.toLowerCase().includes(heroSearch.trim().toLowerCase())) && <p className="request-hint">Kein Held gefunden. Versuch einen anderen Namen.</p>}
          {hero && <p className="request-hint mt-2">Ausgewählt: <strong>{hero}</strong></p>}{errorMessage('hero')}
        </fieldset>
        <fieldset className="request-section"><legend>Wann passt es dir?</legend>
          <p className="request-hint">Mehrere Zeitwünsche sind möglich. Den Termin stimmt ihr gemeinsam ab.</p>
          <div className="choice-row">{['Heute Abend', 'Morgen', 'Wochenende'].map(value => <button type="button" key={value} className={`choice-chip${presets.includes(value) ? ' is-selected' : ''}`} aria-pressed={presets.includes(value)} aria-invalid={invalid('time')} aria-describedby={invalid('time') ? 'time-error' : undefined} onClick={() => setPresets(toggle(presets, value))}>{value}</button>)}</div>
          {windows.map((slot, index) => <div key={slot.id} className="time-window">
            <div className="time-window-fields">
              <label className="request-field"><span>Datum{windows.length > 1 ? ` ${index + 1}` : ''}</span><input inputMode="numeric" autoComplete="off" placeholder="TT.MM.JJJJ" value={slot.date} aria-invalid={invalid(`window-${slot.id}`)} aria-describedby={invalid(`window-${slot.id}`) ? `window-${slot.id}-error` : undefined} onChange={event => updateWindow(slot.id, 'date', formatDateInput(event.target.value))} onBlur={event => updateWindow(slot.id, 'date', finishDateInput(event.target.value))} /></label>
              {timeInput(slot, 'from', 'Von', '18:00')}
              {timeInput(slot, 'to', 'Bis', '20:00')}
              <button type="button" className="remove-window" aria-label={`Zeitfenster ${index + 1} entfernen`} onClick={() => setWindows(current => current.filter(item => item.id !== slot.id))}>×</button>
            </div>{errorMessage(`window-${slot.id}`)}
          </div>)}
          <button type="button" className="add-window" onClick={() => setWindows(current => [...current, { id: nextWindowId.current++, date: '', from: '', to: '' }])}>+ Zeitfenster hinzufügen</button>
          {errorMessage('time')}
        </fieldset>
        <div className="request-section"><label className="request-field"><span>Games / Stunden</span><input value={experience} onChange={event => setExperience(event.target.value)} placeholder="z. B. 300 Games / 150 Stunden" required aria-invalid={invalid('experience')} aria-describedby={invalid('experience') ? 'experience-error' : undefined} /></label>{errorMessage('experience')}</div>
        <fieldset className="request-section"><legend>Was willst du verbessern?</legend>
          <div className="choice-row">{FOCUS_AREAS.map(value => <button type="button" key={value} className={`choice-chip${focus.includes(value) ? ' is-selected' : ''}`} aria-pressed={focus.includes(value)} aria-invalid={invalid('problems')} aria-describedby={invalid('problems') ? 'problems-error' : undefined} onClick={() => setFocus(toggle(focus, value))}>{value}</button>)}</div>
          <label className="request-field mt-4"><span>Noch etwas dazu? <small>Optional</small></span><textarea rows={3} value={notes} onChange={event => setNotes(event.target.value)} placeholder="Zum Beispiel eine Situation, in der du oft hängen bleibst …" /></label>{errorMessage('problems')}
        </fieldset>
        {submit.isError && <p className="request-error" role="alert">{submit.error instanceof Error ? submit.error.message : 'Deine Anfrage konnte nicht gespeichert werden. Versuch es bitte erneut.'}</p>}
        <div className="request-actions"><Link to="/" className="btn-ghost">Abbrechen</Link><button type="submit" className="btn-amber" aria-disabled={submit.isPending} aria-busy={submit.isPending}>{submit.isPending ? 'Wird gesendet …' : 'Anfrage senden'}<span aria-hidden="true">→</span></button></div>
      </form>}
    </div>
  )
}
