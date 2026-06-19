import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { coaching, type CoachProfile } from '@/api/client'
import { Avatar, EmptyState } from '@/components/ui'

function RatingBar({ rating, max = 10 }: { rating: number; max?: number }) {
  const filled = Math.round(rating)
  return (
    <div className="flex items-center gap-2">
      <div className="rating-bar flex-1" style={{ maxWidth: 90 }}>
        {Array.from({ length: max }).map((_, i) => (
          <div key={i} className={`rating-segment${i < filled ? ' on' : ''}`} />
        ))}
      </div>
      <span className="font-mono-data text-xs font-semibold" style={{ color: 'var(--amber)' }}>
        {rating.toFixed(1)}
      </span>
    </div>
  )
}

function CoachCard({ coach, index }: { coach: CoachProfile; index: number }) {
  const hasReviews = coach.total_reviews > 0
  return (
    <Link
      to={`/coaches/${coach.id}`}
      className="coach-row animate-in group"
      style={{ animationDelay: `${index * 70}ms` }}
    >
      <span className="coach-row-index">
        {String(index + 1).padStart(2, '0')}
      </span>

      <div className="coach-row-portrait">
        <Avatar url={coach.avatar_url} name={coach.display_name} size={82} />
      </div>

      <div className="coach-row-main">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h3 className="font-display text-2xl font-extrabold uppercase leading-none text-white">
            {coach.display_name}
          </h3>
          <p className="font-mono-data text-[11px]" style={{ color: 'var(--text-muted)' }}>
            @{coach.discord_username}
          </p>
        </div>

        {coach.bio ? (
          <p className="mt-3 max-w-3xl text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {coach.bio}
          </p>
        ) : (
          <p className="mt-3 max-w-3xl text-sm italic leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            Stellt sich demnächst vor. Eine Anfrage ist trotzdem jederzeit möglich.
          </p>
        )}

        {coach.specialties && coach.specialties.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {coach.specialties.slice(0, 6).map((s: string) => (
              <span key={s} className="chip">{s}</span>
            ))}
          </div>
        )}
      </div>

      <div className="coach-row-side">
        {hasReviews ? (
          <div className="w-full">
            <RatingBar rating={coach.avg_rating} />
            <p className="stat-label mt-1 text-right">{coach.total_reviews} Bewertungen</p>
          </div>
        ) : (
          <p className="stat-label text-right">Neu im Roster</p>
        )}
        <div className="coach-row-facts">
          <span><b>{coach.total_sessions}</b> Sessions</span>
          <span><b>{coach.total_reviews}</b> Bewertungen</span>
        </div>
        <span className="coach-row-link">Profil öffnen</span>
      </div>
    </Link>
  )
}

function ProcessStep({ nr, title, copy }: { nr: string; title: string; copy: string }) {
  return (
    <div className="process-step">
      <span>{nr}</span>
      <div>
        <h3>{title}</h3>
        <p>{copy}</p>
      </div>
    </div>
  )
}

export default function CoachesPage() {
  const { data: coaches, isLoading } = useQuery({
    queryKey: ['coaches'],
    queryFn: () => coaching.listCoaches(),
  })

  const totalSessions = (coaches ?? []).reduce((sum, c) => sum + (c.total_sessions || 0), 0)
  const totalReviews = (coaches ?? []).reduce((sum, c) => sum + (c.total_reviews || 0), 0)

  return (
    <div className="content-grid pb-16">
      <div className="salon-hero relative mb-12 md:mb-16">
        <div className="animate-in-left max-w-3xl">
          <div className="eyebrow mb-4">DDC Coaching-Programm</div>
          <h1 className="hero-display">
            Besser werden,<br />
            <span style={{ color: 'var(--amber-light)' }}>ohne Chat-Chaos.</span>
          </h1>
          <p className="section-copy mt-5 max-w-2xl text-[15px]">
            Coaches, Anfragen, Termine, Ziele und Session-Notizen laufen auf der Website. Discord bleibt für Login, Voice und kurze Abstimmung.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link to="/anfrage" className="btn-amber">Coaching anfragen</Link>
            <Link to="/me" className="btn-ghost">Meine Termine</Link>
          </div>
        </div>

        <div className="salon-metrics animate-in" style={{ animationDelay: '160ms' }}>
          {[
            { label: 'Coaches im Roster', value: isLoading ? '…' : String(coaches?.length ?? 0) },
            { label: 'Sessions gespielt', value: isLoading ? '…' : String(totalSessions) },
            { label: 'Bewertungen', value: isLoading ? '…' : String(totalReviews) },
            { label: 'Kosten', value: 'Gratis' },
          ].map((s) => (
            <div key={s.label}>
              <p>{s.value}</p>
              <span>{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="salon-process animate-in mb-12" style={{ animationDelay: '240ms' }}>
        <div className="salon-section-title">
          <span>So läuft’s</span>
          <i />
        </div>
        <div className="process-line">
          <ProcessStep nr="01" title="Anfrage auf der Website" copy="Rank, Helden, Zeitfenster und Thema landen strukturiert im Coach-Cockpit." />
          <ProcessStep nr="02" title="Termin abstimmen" copy="Ein Coach übernimmt, schlägt Zeiten vor und hält den vereinbarten Termin fest." />
          <ProcessStep nr="03" title="Fortschritt behalten" copy="Termine, Ziele, Meilensteine und Session-Protokolle bleiben unter „Mein Coaching“." />
        </div>
      </div>

      <div className="salon-section-title mb-5">
        <span>Coach-Salon</span>
        {!isLoading && (
          <b>
            {String(coaches?.length ?? 0).padStart(2, '0')}
          </b>
        )}
        <i />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <div className="spinner h-9 w-9" />
        </div>
      ) : coaches && coaches.length > 0 ? (
        <div className="coach-list">
          {coaches.map((coach, i) => (
            <CoachCard key={coach.id} coach={coach} index={i} />
          ))}
        </div>
      ) : (
        <EmptyState
          title="Roster wird geladen"
          copy="Die Coaches werden automatisch aus den Community-Rollen synchronisiert. Schau in ein paar Minuten wieder vorbei."
        />
      )}
    </div>
  )
}
