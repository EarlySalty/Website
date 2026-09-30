import { Fragment, type ReactNode } from 'react'

// Shared by the interactive page and Vite's static public HTML.
// No router, browser globals, API calls, authentication or personal data.
type StepIcon = 'request' | 'calendar' | 'growth'

function ProcessIcon({ name }: { name: StepIcon }) {
  if (name === 'request') {
    return (
      <svg className="process-icon-svg" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M8 4.75h8M7 8.75h10M7 12.75h6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        <path d="M6.5 3.75h11A1.75 1.75 0 0 1 19.25 5.5v13A1.75 1.75 0 0 1 17.5 20.25h-11a1.75 1.75 0 0 1-1.75-1.75v-13A1.75 1.75 0 0 1 6.5 3.75Z" stroke="currentColor" strokeWidth="1.7" />
        <path d="m14.75 16.25 1.45 1.45 3.05-3.45" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }

  if (name === 'calendar') {
    return (
      <svg className="process-icon-svg" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M7.75 3.75v3M16.25 3.75v3M5 9.25h14" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        <path d="M6.5 5.25h11A1.75 1.75 0 0 1 19.25 7v10.5a1.75 1.75 0 0 1-1.75 1.75h-11a1.75 1.75 0 0 1-1.75-1.75V7A1.75 1.75 0 0 1 6.5 5.25Z" stroke="currentColor" strokeWidth="1.7" />
        <path d="M8.25 13.25h.01M12 13.25h.01M15.75 13.25h.01M8.25 16.25h.01M12 16.25h.01" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    )
  }

  return (
    <svg className="process-icon-svg" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 18.5h14" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M7 15.75 10.75 12l2.5 2.5L18 8.75" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14.5 8.75H18v3.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7.25 8.5a2.25 2.25 0 1 0 4.5 0 2.25 2.25 0 0 0-4.5 0Z" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  )
}

function ProcessStep({ nr, title, copy, icon }: { nr: string; title: string; copy: string; icon: StepIcon }) {
  return (
    <div className="process-step">
      <span className="process-icon">
        <ProcessIcon name={icon} />
      </span>
      <div>
        <span className="process-number">{nr}</span>
        <h3>{title}</h3>
        <p>{copy}</p>
      </div>
    </div>
  )
}


export function CoachingHero({ children }: { children?: ReactNode }) {
  return (
    <div className="salon-hero relative mb-12 md:mb-16">
      <div className="animate-in-left max-w-3xl">
        <div className="eyebrow mb-4">Kostenloses Community-Coaching</div>
        <h1 className="hero-display">
          Deadlock Coaching<br />
          <span style={{ color: 'var(--amber-light)' }}>auf Deutsch.</span>
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          Finde einen Deadlock Coach für deine Fragen zu Lane, Helden und Entscheidungen im Match.
          Beschreibe dein Ziel; Termin und Schwerpunkt stimmt ihr gemeinsam ab.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <a href="/coaching/anfrage" className="btn-amber">Coaching anfragen</a>
          <a href="#coaches" className="btn-ghost">Coaches ansehen</a>
          <a href="/coaching/me" className="btn-ghost">Meine Termine</a>
        </div>
      </div>
      {children}
    </div>
  )
}

export function CoachingProcess() {
  return (
    <div className="salon-process animate-in mb-12" style={{ animationDelay: '240ms' }}>
        <div className="salon-section-title">
          <span>So läuft’s</span>
          <i />
        </div>
        <div className="process-line">
          <ProcessStep nr="01" icon="request" title="Anfrage auf der Website" copy="Rank, Helden, Zeitfenster und Thema landen strukturiert im Coach-Cockpit." />
          <ProcessStep nr="02" icon="calendar" title="Termin abstimmen" copy="Ein Coach übernimmt, schlägt Zeiten vor und hält den vereinbarten Termin fest." />
          <ProcessStep nr="03" icon="growth" title="Fortschritt behalten" copy="Termine, Ziele, Meilensteine und Session-Protokolle bleiben unter „Mein Coaching“." />
        </div>
      </div>
  )
}

export function CoachingQuestions() {
  return (
    <section className="mt-12" aria-labelledby="coaching-fragen">
      <h2 id="coaching-fragen" className="font-display text-2xl font-bold">Fragen zum Deadlock Coaching</h2>
      <div className="mt-5 space-y-4 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
        <details className="border-b pb-4" style={{ borderColor: 'var(--border-dim)' }}>
          <summary className="cursor-pointer font-semibold">Ist das Coaching kostenlos und auch für Anfänger?</summary>
          <p className="mt-3">Ja. Das Community-Coaching ist kostenlos und richtet sich an Einsteiger und erfahrene Spieler. Beschreibe, wobei du Hilfe brauchst; die Coaches prüfen, wer dich dabei unterstützen kann. Ein bestimmter Rang oder Termin wird nicht versprochen.</p>
        </details>
        <details className="border-b pb-4" style={{ borderColor: 'var(--border-dim)' }}>
          <summary className="cursor-pointer font-semibold">Wie finde ich einen Deadlock Coach?</summary>
          <p className="mt-3">Sieh dir die Profile und Schwerpunkte in der Coach-Liste an. Für eine Anfrage meldest du dich mit Discord an und nennst dein Ziel und passende Zeiten. Ein Coach übernimmt die Anfrage und stimmt den Termin mit dir ab.</p>
        </details>
        <details className="border-b pb-4" style={{ borderColor: 'var(--border-dim)' }}>
          <summary className="cursor-pointer font-semibold">Was sollte ich für die Session vorbereiten?</summary>
          <p className="mt-3">Nenne deinen Rang, deine Helden und eine konkrete Frage, zum Beispiel zu Laning, Item-Entscheidungen oder Teamkämpfen. Für ein Replay-Review könnt ihr vorher absprechen, welches Match ihr gemeinsam ansehen wollt.</p>
        </details>
        <p>Noch Fragen zum Einstieg? Besuche unseren <a className="underline" href="/beitreten/">deutschen Deadlock Discord</a> oder den <a className="underline" href="/guides/anfaenger/">Anfänger-Guide</a>. Für gemeinsame Übungsrunden gibt es die <a className="underline" href="/mitspieler/">Mitspielersuche</a>.</p>
      </div>
    </section>
  )
}

export function PublicCoachingPage() {
  return (
    <Fragment>
      <header className="content-grid pt-6">
        <a href="/" className="text-sm underline">Deutsche Deadlock Community</a>
      </header>
      <main className="content-grid pb-16">
        <CoachingHero />
        <CoachingProcess />
        <section id="coaches" aria-labelledby="coaches-title">
          <h2 id="coaches-title" className="font-display text-2xl font-bold">Deadlock Coaches und Schwerpunkte</h2>
          <p className="mt-3">Die Coach-Liste zeigt Profile und Schwerpunkte aus der Community. Ihre Verfügbarkeit klärt ihr mit der Anfrage.</p>
          <noscript><p>Für die aktuelle Coach-Liste, Anmeldung und Terminverwaltung wird JavaScript benötigt. Du erreichst die Community auch über die <a href="/beitreten/">Discord-Einladung</a>.</p></noscript>
        </section>
        <CoachingQuestions />
      </main>
    </Fragment>
  )
}
