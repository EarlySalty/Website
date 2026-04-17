import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { coaching, type CoachProfile } from '@/api/client'

function StarRating({ rating }: { rating: number }) {
  const stars = Math.round(rating)
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => (
        <span key={i} className={i <= stars ? 'text-yellow-400' : 'text-gray-600'}>★</span>
      ))}
    </div>
  )
}

function CoachCard({ coach }: { coach: CoachProfile }) {
  return (
    <Link
      to={`/coaching/coaches/${coach.id}`}
      className="block rounded-xl border border-white/10 bg-[#0c1017] p-5 transition hover:border-accent-violet/50 hover:bg-[#0f1520]"
    >
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-full bg-[#1a2030]">
          {coach.avatar_url ? (
            <img src={coach.avatar_url} alt={coach.display_name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-2xl font-bold text-slate-400">
              {coach.display_name?.charAt(0) || '?'}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-white truncate">{coach.display_name}</h3>
          <p className="text-sm text-slate-400">@{coach.discord_username}</p>

          {/* Rating */}
          <div className="mt-2 flex items-center gap-2">
            <StarRating rating={coach.avg_rating} />
            <span className="text-sm text-slate-300">{coach.avg_rating.toFixed(1)}</span>
            <span className="text-sm text-slate-500">({coach.total_reviews} Bewertungen)</span>
          </div>
        </div>
      </div>

      {/* Bio */}
      {coach.bio && (
        <p className="mt-4 text-sm text-slate-300 line-clamp-2">{coach.bio}</p>
      )}

      {/* Specialties */}
      {coach.specialties && coach.specialties.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {coach.specialties.map((s: string) => (
            <span key={s} className="rounded-full bg-accent-violet/20 px-2.5 py-1 text-xs text-accent-violet">
              {s}
            </span>
          ))}
        </div>
      )}

      {/* Stats */}
      <div className="mt-4 flex gap-4 text-sm text-slate-400">
        <span>{coach.total_sessions} Sessions</span>
        <span>·</span>
        <span>{coach.total_reviews} Reviews</span>
      </div>
    </Link>
  )
}

export default function CoachesPage() {
  const { data: coaches, isLoading } = useQuery({
    queryKey: ['coaches'],
    queryFn: () => coaching.listCoaches(),
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin w-8 h-8 border-2 border-accent-violet border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="content-grid py-10 md:py-14">
      <div className="mb-8">
        <span className="eyebrow">Coaching</span>
        <h1 className="section-title mt-4">Unsere Coaches</h1>
        <p className="section-copy mt-2 max-w-2xl">
          Unsere erfahrenen Coaches helfen dir besser zu werden. Wähle einen Coach und vereinbare eine Session.
        </p>
      </div>

      {/* CTA */}
      <div className="mb-8 flex gap-4">
        <Link
          to="/coaching/apply"
          className="rounded-lg bg-accent-violet/20 px-4 py-2 text-sm font-medium text-accent-violet transition hover:bg-accent-violet/30"
        >
          Coach werden
        </Link>
        <Link
          to="/coaching/dashboard"
          className="rounded-lg bg-white/5 px-4 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/10"
        >
          Mein Dashboard
        </Link>
      </div>

      {/* Coaches Grid */}
      {coaches && coaches.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {coaches.map(coach => (
            <CoachCard key={coach.id} coach={coach} />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-white/10 bg-[#0c1017] p-12 text-center">
          <p className="text-slate-400">Noch keine Coaches vorhanden.</p>
          <Link
            to="/coaching/apply"
            className="mt-4 inline-block rounded-lg bg-accent-violet px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-violet/80"
          >
            Bewirb dich als Coach!
          </Link>
        </div>
      )}
    </div>
  )
}
