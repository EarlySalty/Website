import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { coaching, type CoachProfile } from '@/api/client'

function RatingBar({ rating, max = 10 }: { rating: number; max?: number }) {
  const filled = Math.round(rating)
  return (
    <div className="flex items-center gap-2">
      <div className="rating-bar flex-1" style={{ maxWidth: 80 }}>
        {Array.from({ length: max }).map((_, i) => (
          <div key={i} className={`rating-segment${i < filled ? ' on' : ''}`} />
        ))}
      </div>
      <span className="text-xs font-semibold" style={{ color: 'var(--amber)', fontFamily: "'Rajdhani', sans-serif" }}>
        {rating.toFixed(1)}
      </span>
    </div>
  )
}

function CoachCard({ coach, index }: { coach: CoachProfile; index: number }) {
  const initial = (coach.display_name || '?').charAt(0).toUpperCase()

  return (
    <Link
      to={`/coaches/${coach.id}`}
      className="coach-card animate-in"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      {/* Top row */}
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div
          className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-sm"
          style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-dim)' }}
        >
          {coach.avatar_url ? (
            <img src={coach.avatar_url} alt={coach.display_name} className="h-full w-full object-cover" />
          ) : (
            <div
              className="flex h-full w-full items-center justify-center text-2xl font-bold"
              style={{ color: 'var(--amber)', fontFamily: "'Rajdhani', sans-serif" }}
            >
              {initial}
            </div>
          )}
        </div>

        {/* Name + rating */}
        <div className="min-w-0 flex-1">
          <h3
            className="truncate text-base font-bold leading-tight text-white"
            style={{ fontFamily: "'Rajdhani', sans-serif", letterSpacing: '0.04em' }}
          >
            {coach.display_name}
          </h3>
          <p className="mb-2 text-xs" style={{ color: 'var(--text-muted)' }}>
            @{coach.discord_username}
          </p>
          {coach.total_reviews > 0 ? (
            <RatingBar rating={coach.avg_rating} />
          ) : (
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Noch keine Bewertungen</p>
          )}
        </div>
      </div>

      {/* Bio */}
      {coach.bio && (
        <p
          className="mt-4 line-clamp-2 text-sm leading-relaxed"
          style={{ color: 'var(--text-secondary)' }}
        >
          {coach.bio}
        </p>
      )}

      {/* Specialties */}
      {coach.specialties && coach.specialties.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {coach.specialties.map((s: string) => (
            <span key={s} className="badge badge-amber text-[10px]">{s}</span>
          ))}
        </div>
      )}

      {/* Stats footer */}
      <div
        className="mt-4 flex items-center gap-5 border-t pt-3 text-xs"
        style={{ borderColor: 'var(--border-dim)', color: 'var(--text-muted)' }}
      >
        <span>
          <span
            className="font-bold"
            style={{ color: 'var(--text-secondary)', fontFamily: "'Rajdhani', sans-serif" }}
          >
            {coach.total_sessions}
          </span>{' '}
          Sessions
        </span>
        <span>
          <span
            className="font-bold"
            style={{ color: 'var(--text-secondary)', fontFamily: "'Rajdhani', sans-serif" }}
          >
            {coach.total_reviews}
          </span>{' '}
          Bewertungen
        </span>
      </div>
    </Link>
  )
}

export default function CoachesPage() {
  const { data: coaches, isLoading } = useQuery({
    queryKey: ['coaches'],
    queryFn: () => coaching.listCoaches(),
  })

  return (
    <div className="content-grid py-12 md:py-16">
      {/* Page header */}
      <div className="mb-10">
        <div className="eyebrow mb-4">Operator Roster</div>
        <h1 className="section-title">Unsere Coaches</h1>
        <p className="section-copy mt-3 max-w-xl">
          Erfahrene Coaches der Deutschen Deadlock Community — beantragest eine Session über Discord.
        </p>
      </div>

      {/* Coach grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <div className="spinner h-9 w-9" />
        </div>
      ) : coaches && coaches.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {coaches.map((coach, i) => (
            <CoachCard key={coach.id} coach={coach} index={i} />
          ))}
        </div>
      ) : (
        <div
          className="rounded-sm p-14 text-center"
          style={{ border: '1px solid var(--border-dim)', background: 'var(--bg-card)' }}
        >
          <p
            className="text-sm uppercase tracking-wider"
            style={{ color: 'var(--text-muted)', fontFamily: "'Rajdhani', sans-serif" }}
          >
            Noch keine Coaches registriert
          </p>
        </div>
      )}
    </div>
  )
}
