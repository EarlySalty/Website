import { useQuery } from '@tanstack/react-query'
import { useParams, Link } from 'react-router-dom'
import { coaching, type CoachReview } from '@/api/client'

function RatingBar({ rating, max = 10 }: { rating: number; max?: number }) {
  const filled = Math.round(rating)
  return (
    <div className="flex items-center gap-2">
      <div className="rating-bar" style={{ maxWidth: 100 }}>
        {Array.from({ length: max }).map((_, i) => (
          <div key={i} className={`rating-segment${i < filled ? ' on' : ''}`} />
        ))}
      </div>
      <span
        className="text-sm font-bold"
        style={{ color: 'var(--amber)', fontFamily: "'Rajdhani', sans-serif" }}
      >
        {rating.toFixed(1)}/10
      </span>
    </div>
  )
}

function ReviewCard({ review }: { review: CoachReview }) {
  const date = new Date(review.created_at).toLocaleDateString('de-DE', {
    year: 'numeric', month: 'short', day: 'numeric',
  })
  return (
    <div
      className="rounded-sm p-4"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-dim)' }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
          {review.user_display_name}
        </span>
        <RatingBar rating={review.rating} />
      </div>

      {review.feedback_text && (
        <p className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>{review.feedback_text}</p>
      )}

      {review.improved_areas && (
        <div className="mt-3">
          <span className="stat-label">Verbessert</span>
          <p className="mt-0.5 text-sm" style={{ color: 'var(--text-muted)' }}>{review.improved_areas}</p>
        </div>
      )}

      <span className="mt-3 block text-xs" style={{ color: 'var(--text-muted)' }}>{date}</span>
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
        <div className="spinner h-8 w-8" />
      </div>
    )
  }

  if (!coach) {
    return (
      <div className="content-grid py-12">
        <p style={{ color: 'var(--text-muted)' }}>Coach nicht gefunden.</p>
        <Link to="/" className="mt-4 block text-sm" style={{ color: 'var(--amber)' }}>
          ← Zurück zu Coaches
        </Link>
      </div>
    )
  }

  const initial = (coach.display_name || '?').charAt(0).toUpperCase()

  return (
    <div className="content-grid py-12 md:py-16">
      <Link to="/" className="mb-6 inline-block text-sm transition" style={{ color: 'var(--text-muted)' }}>
        ← Coaches
      </Link>

      {/* Profile card */}
      <div
        className="rounded-sm p-6"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-soft)' }}
      >
        <div className="flex flex-col gap-6 md:flex-row">
          {/* Avatar */}
          <div
            className="h-24 w-24 flex-shrink-0 overflow-hidden rounded-sm"
            style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-soft)' }}
          >
            {coach.avatar_url ? (
              <img src={coach.avatar_url} alt={coach.display_name} className="h-full w-full object-cover" />
            ) : (
              <div
                className="flex h-full w-full items-center justify-center text-4xl font-bold"
                style={{ color: 'var(--amber)', fontFamily: "'Rajdhani', sans-serif" }}
              >
                {initial}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1">
            <h1
              className="text-2xl font-bold text-white"
              style={{ fontFamily: "'Rajdhani', sans-serif", letterSpacing: '0.06em' }}
            >
              {coach.display_name}
            </h1>
            <p className="mt-0.5 text-sm" style={{ color: 'var(--text-muted)' }}>@{coach.discord_username}</p>

            <div className="mt-4">
              {coach.total_reviews > 0 ? (
                <>
                  <RatingBar rating={coach.avg_rating} />
                  <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                    {coach.total_reviews} Bewertungen
                  </p>
                </>
              ) : (
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Noch keine Bewertungen</p>
              )}
            </div>

            <div className="mt-4 flex gap-6 text-sm" style={{ color: 'var(--text-secondary)' }}>
              <span>
                <span className="font-bold" style={{ color: 'var(--amber)', fontFamily: "'Rajdhani', sans-serif" }}>
                  {coach.total_sessions}
                </span>{' '}
                Sessions
              </span>
              <span>
                <span className="font-bold" style={{ color: 'var(--amber)', fontFamily: "'Rajdhani', sans-serif" }}>
                  {coach.total_reviews}
                </span>{' '}
                Bewertungen
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div
              className="rounded-sm px-4 py-2.5 text-center text-sm"
              style={{
                background: 'var(--amber-glow)',
                border: '1px solid var(--amber-border)',
                color: 'var(--amber)',
                fontFamily: "'Rajdhani', sans-serif",
                fontWeight: 600,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              Anfrage via Discord
            </div>
          </div>
        </div>

        {/* Bio */}
        {coach.bio && (
          <div className="mt-6 pt-5" style={{ borderTop: '1px solid var(--border-dim)' }}>
            <p className="stat-label mb-2">Über mich</p>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{coach.bio}</p>
          </div>
        )}

        {/* Specialties */}
        {coach.specialties && coach.specialties.length > 0 && (
          <div className="mt-5">
            <p className="stat-label mb-2">Schwerpunkte</p>
            <div className="flex flex-wrap gap-1.5">
              {coach.specialties.map((s: string) => (
                <span key={s} className="badge badge-amber text-[11px]">{s}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Reviews */}
      <div className="mt-10">
        <div className="mb-4 flex items-center gap-3">
          <span className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: 'var(--amber)', fontFamily: "'Rajdhani', sans-serif" }}>
            // Bewertungen
          </span>
          <div className="flex-1 divider" />
        </div>

        {reviews && reviews.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2">
            {reviews.map((review) => (
              <ReviewCard key={review.id} review={review} />
            ))}
          </div>
        ) : (
          <div
            className="rounded-sm p-8 text-center"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-dim)' }}
          >
            <p
              className="text-xs uppercase tracking-wider"
              style={{ color: 'var(--text-muted)', fontFamily: "'Rajdhani', sans-serif" }}
            >
              Noch keine Bewertungen
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
