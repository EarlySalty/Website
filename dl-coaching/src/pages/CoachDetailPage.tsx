import { useQuery } from '@tanstack/react-query'
import { useParams, Link } from 'react-router-dom'
import { coaching, type CoachReview } from '@/api/client'

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => (
        <span key={i} className={i <= rating ? 'text-yellow-400' : 'text-gray-600'}>★</span>
      ))}
    </div>
  )
}

function ReviewCard({ review }: { review: CoachReview }) {
  const date = new Date(review.created_at).toLocaleDateString('de-DE', {
    year: 'numeric', month: 'short', day: 'numeric'
  })

  return (
    <div className="rounded-lg border border-white/10 bg-[#0c1017] p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-400">{review.user_display_name}</span>
        <div className="flex items-center gap-2">
          <StarRating rating={review.rating} />
          <span className="text-sm font-medium text-white">{review.rating}/10</span>
        </div>
      </div>

      {review.feedback_text && (
        <p className="mt-3 text-sm text-slate-300">{review.feedback_text}</p>
      )}

      {review.improved_areas && (
        <div className="mt-3">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Verbessert:</span>
          <p className="mt-1 text-sm text-slate-400">{review.improved_areas}</p>
        </div>
      )}

      <span className="mt-3 block text-xs text-slate-500">{date}</span>
    </div>
  )
}

export default function CoachDetailPage() {
  const { id } = useParams<{ id: string }>()

  const { data: coach, isLoading } = useQuery({
    queryKey: ['coach', id],
    queryFn: () => coaching.getCoach(id!),
    enabled: !!id,
  })

  const { data: reviews } = useQuery({
    queryKey: ['coach-reviews', id],
    queryFn: () => coaching.getCoachReviews(id!),
    enabled: !!id,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin w-8 h-8 border-2 border-accent-violet border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!coach) {
    return (
      <div className="content-grid py-10">
        <p className="text-slate-400">Coach nicht gefunden.</p>
        <Link to="/" className="mt-4 text-accent-violet hover:underline">
          ← Zurück zu Coaches
        </Link>
      </div>
    )
  }

  return (
    <div className="content-grid py-10 md:py-14">
      {/* Back */}
      <Link to="/" className="inline-block mb-6 text-sm text-slate-400 hover:text-white">
        ← Zurück zu Coaches
      </Link>

      {/* Header */}
      <div className="rounded-xl border border-white/10 bg-[#0c1017] p-6">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Avatar */}
          <div className="h-24 w-24 flex-shrink-0 overflow-hidden rounded-full bg-[#1a2030]">
            {coach.avatar_url ? (
              <img src={coach.avatar_url} alt={coach.display_name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-4xl font-bold text-slate-400">
                {coach.display_name?.charAt(0) || '?'}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-white">{coach.display_name}</h1>
            <p className="text-slate-400">@{coach.discord_username}</p>

            {/* Rating */}
            <div className="mt-4 flex items-center gap-4">
              <div className="flex items-center gap-2">
                <StarRating rating={coach.avg_rating} />
                <span className="text-xl font-bold text-white">{coach.avg_rating.toFixed(1)}</span>
              </div>
              <span className="text-slate-400">({coach.total_reviews} Bewertungen)</span>
            </div>

            {/* Stats */}
            <div className="mt-4 flex gap-6 text-sm text-slate-300">
              <span>{coach.total_sessions} Sessions</span>
              <span>·</span>
              <span>{coach.total_reviews} Reviews</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2">
            <button className="rounded-lg bg-accent-violet px-6 py-2.5 font-medium text-white transition hover:bg-accent-violet/80">
              Coaching anfragen
            </button>
          </div>
        </div>

        {/* Bio */}
        {coach.bio && (
          <div className="mt-6 pt-6 border-t border-white/10">
            <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-2">Über mich</h2>
            <p className="text-slate-300">{coach.bio}</p>
          </div>
        )}

        {/* Specialties */}
        {coach.specialties && coach.specialties.length > 0 && (
          <div className="mt-6">
            <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-2">Specialties</h2>
            <div className="flex flex-wrap gap-2">
              {coach.specialties.map((s: string) => (
                <span key={s} className="rounded-full bg-accent-violet/20 px-3 py-1.5 text-sm text-accent-violet">
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Reviews */}
      <div className="mt-8">
        <h2 className="text-xl font-semibold text-white mb-4">Bewertungen</h2>

        {reviews && reviews.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2">
            {reviews.map(review => (
              <ReviewCard key={review.id} review={review} />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-white/10 bg-[#0c1017] p-8 text-center">
            <p className="text-slate-400">Noch keine Bewertungen.</p>
          </div>
        )}
      </div>
    </div>
  )
}
