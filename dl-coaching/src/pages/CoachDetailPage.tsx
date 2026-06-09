import { useQuery } from '@tanstack/react-query'
import { useParams, Link } from 'react-router-dom'
import { coaching, type CoachReview } from '@/api/client'
import { Avatar, EmptyState, PageSpinner, SectionHead } from '@/components/ui'
import { fmtDate } from '@/lib/format'

function RatingBar({ rating, max = 10 }: { rating: number; max?: number }) {
  const filled = Math.round(rating)
  return (
    <div className="flex items-center gap-2">
      <div className="rating-bar" style={{ width: 110 }}>
        {Array.from({ length: max }).map((_, i) => (
          <div key={i} className={`rating-segment${i < filled ? ' on' : ''}`} />
        ))}
      </div>
      <span className="font-mono-data text-sm font-bold" style={{ color: 'var(--amber)' }}>
        {rating.toFixed(1)}<span style={{ color: 'var(--text-muted)' }}>/10</span>
      </span>
    </div>
  )
}

function ReviewCard({ review, index }: { review: CoachReview; index: number }) {
  return (
    <div className="card animate-in p-4" style={{ animationDelay: `${index * 60}ms` }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-display text-sm font-bold uppercase tracking-[0.04em]" style={{ color: 'var(--text-secondary)' }}>
          {review.user_display_name}
        </span>
        <RatingBar rating={review.rating} />
      </div>
      {review.feedback_text && (
        <p className="mt-3 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{review.feedback_text}</p>
      )}
      {review.improved_areas && (
        <div className="mt-3">
          <span className="stat-label">Verbessert</span>
          <p className="mt-0.5 text-sm" style={{ color: 'var(--text-muted)' }}>{review.improved_areas}</p>
        </div>
      )}
      <span className="font-mono-data mt-3 block text-[10px]" style={{ color: 'var(--text-muted)' }}>
        {fmtDate(review.created_at)}
      </span>
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

  if (isLoading) return <PageSpinner />

  if (!coach) {
    return (
      <div className="content-grid py-16">
        <EmptyState title="Coach nicht gefunden" copy="Vielleicht wurde das Profil deaktiviert oder der Link ist veraltet.">
          <Link to="/" className="btn-ghost">← Zurück zum Roster</Link>
        </EmptyState>
      </div>
    )
  }

  return (
    <div className="content-grid pb-16 pt-10 md:pt-14">
      <Link
        to="/"
        className="font-mono-data mb-6 inline-block text-[11px] uppercase tracking-[0.16em] transition hover:opacity-80"
        style={{ color: 'var(--text-muted)' }}
      >
        ← Roster
      </Link>

      {/* ── Profil-Kopf ── */}
      <div className="panel-strong animate-in relative overflow-hidden p-6 md:p-8">
        {/* Ghost-Initial im Hintergrund */}
        <span
          className="font-display pointer-events-none absolute -right-4 -top-10 text-[180px] font-bold leading-none"
          style={{ color: 'rgba(232, 149, 58, 0.05)' }}
          aria-hidden
        >
          {(coach.display_name || '?').charAt(0).toUpperCase()}
        </span>

        <div className="relative flex flex-col gap-6 md:flex-row md:items-start">
          <Avatar url={coach.avatar_url} name={coach.display_name} size={112} />

          <div className="flex-1">
            <div className="flex items-center gap-2.5">
              <span className="pulse-dot" style={{ background: 'var(--green)' }} />
              <h1 className="font-display text-3xl font-bold uppercase tracking-[0.04em] text-white">
                {coach.display_name}
              </h1>
            </div>
            <p className="font-mono-data mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
              @{coach.discord_username}
            </p>

            <div className="mt-4">
              {coach.total_reviews > 0 ? (
                <>
                  <RatingBar rating={coach.avg_rating} />
                  <p className="font-mono-data mt-1 text-[10px] uppercase tracking-[0.14em]" style={{ color: 'var(--text-muted)' }}>
                    {coach.total_reviews} Bewertungen
                  </p>
                </>
              ) : (
                <p className="font-mono-data text-[10px] uppercase tracking-[0.14em]" style={{ color: 'var(--text-muted)' }}>
                  Neu im Roster — noch keine Bewertungen
                </p>
              )}
            </div>

            <div className="mt-5 flex gap-8 text-sm" style={{ color: 'var(--text-secondary)' }}>
              <div>
                <p className="font-display text-2xl font-bold" style={{ color: 'var(--amber)' }}>{coach.total_sessions}</p>
                <p className="stat-label">Sessions</p>
              </div>
              <div>
                <p className="font-display text-2xl font-bold" style={{ color: 'var(--amber)' }}>{coach.total_reviews}</p>
                <p className="stat-label">Bewertungen</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 md:items-end">
            <div className="badge badge-amber !px-4 !py-2.5 !text-sm">Anfrage via Discord</div>
            {coach.twitch_url && (
              <a
                href={coach.twitch_url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-ghost !text-xs"
                style={{ borderColor: 'rgba(145, 70, 255, 0.4)', color: '#a970ff' }}
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z" />
                </svg>
                Twitch
              </a>
            )}
          </div>
        </div>

        {coach.bio && (
          <div className="relative mt-6 border-t pt-5" style={{ borderColor: 'var(--border-dim)' }}>
            <p className="stat-label mb-2">Über mich</p>
            <p className="max-w-2xl text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{coach.bio}</p>
          </div>
        )}

        {coach.specialties && coach.specialties.length > 0 && (
          <div className="relative mt-5">
            <p className="stat-label mb-2">Schwerpunkte</p>
            <div className="flex flex-wrap gap-1.5">
              {coach.specialties.map((s: string) => (
                <span key={s} className="chip !text-[11px]">{s}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Bewertungen ── */}
      <div className="mt-12">
        <SectionHead label="Bewertungen" count={reviews?.length ?? 0} />
        {reviews && reviews.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2">
            {reviews.map((review, i) => (
              <ReviewCard key={review.id} review={review} index={i} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="Noch keine Bewertungen"
            copy="Nach jeder abgeschlossenen Session können Spieler ihren Coach bewerten — die Ergebnisse landen hier."
          />
        )}
      </div>
    </div>
  )
}
