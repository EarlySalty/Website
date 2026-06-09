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
  return (
    <Link
      to={`/coaches/${coach.id}`}
      className="card card-hover bracket-card animate-in group relative flex flex-col overflow-hidden p-5"
      style={{ animationDelay: `${index * 70}ms` }}
    >
      {/* Laufende Nummer als Wasserzeichen */}
      <span
        className="font-display pointer-events-none absolute -right-1 -top-3 text-[64px] font-bold leading-none"
        style={{ color: 'rgba(232, 149, 58, 0.06)' }}
      >
        {String(index + 1).padStart(2, '0')}
      </span>

      <div className="flex items-start gap-4">
        <Avatar url={coach.avatar_url} name={coach.display_name} size={64} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="pulse-dot" style={{ background: 'var(--green)' }} />
            <h3 className="font-display truncate text-lg font-bold uppercase leading-tight tracking-[0.04em] text-white">
              {coach.display_name}
            </h3>
          </div>
          <p className="font-mono-data mb-2 text-[11px]" style={{ color: 'var(--text-muted)' }}>
            @{coach.discord_username}
          </p>
          {coach.total_reviews > 0 ? (
            <RatingBar rating={coach.avg_rating} />
          ) : (
            <p className="font-mono-data text-[10px] uppercase tracking-[0.14em]" style={{ color: 'var(--text-muted)' }}>
              Neu im Roster
            </p>
          )}
        </div>
      </div>

      {coach.bio ? (
        <p className="mt-4 line-clamp-2 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          {coach.bio}
        </p>
      ) : (
        <p className="mt-4 line-clamp-2 text-sm italic leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          Stellt sich demnächst vor — Anfrage trotzdem jederzeit möglich.
        </p>
      )}

      {coach.specialties && coach.specialties.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {coach.specialties.slice(0, 4).map((s: string) => (
            <span key={s} className="chip">{s}</span>
          ))}
        </div>
      )}

      <div className="flex-1" />
      <div
        className="mt-4 flex items-center gap-5 border-t pt-3 text-xs"
        style={{ borderColor: 'var(--border-dim)', color: 'var(--text-muted)' }}
      >
        <span className="flex items-center gap-1.5">
          <span className="font-mono-data font-bold" style={{ color: 'var(--text-secondary)' }}>
            {coach.total_sessions}
          </span>
          Sessions
        </span>
        <span className="flex items-center gap-1.5">
          <span className="font-mono-data font-bold" style={{ color: 'var(--text-secondary)' }}>
            {coach.total_reviews}
          </span>
          Bewertungen
        </span>
        <span
          className="font-display ml-auto text-[11px] font-bold uppercase tracking-[0.1em] opacity-0 transition-opacity duration-200 group-hover:opacity-100"
          style={{ color: 'var(--amber)' }}
        >
          Profil →
        </span>
      </div>
    </Link>
  )
}

function Step({ nr, title, copy }: { nr: string; title: string; copy: string }) {
  return (
    <div className="panel relative flex-1 p-5">
      <span className="font-mono-data absolute right-4 top-3 text-[11px]" style={{ color: 'var(--amber)', opacity: 0.7 }}>
        {nr}
      </span>
      <h3 className="font-display text-sm font-bold uppercase tracking-[0.1em] text-white">{title}</h3>
      <p className="mt-1.5 text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{copy}</p>
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
    <div className="content-grid pb-16 pt-10 md:pt-14">
      {/* ── Hero ── */}
      <div className="relative mb-12 md:mb-16">
        <span className="hero-ghost absolute -top-8 left-0 -z-10 hidden md:block" aria-hidden>
          Roster
        </span>
        <div className="animate-in-left">
          <div className="eyebrow mb-4">DDC // Coaching-Programm</div>
          <h1 className="hero-display max-w-3xl">
            Werde besser.<br />
            <span style={{ color: 'var(--amber)' }}>Mit System.</span>
          </h1>
          <p className="section-copy mt-5 max-w-xl text-[15px]">
            Erfahrene Spieler der Deutschen Deadlock Community nehmen dich unter die Fittiche —
            mit echten Sessions, klaren Zielen und Protokollen, die deinen Fortschritt festhalten.
          </p>
        </div>

        {/* Stats-Strip */}
        <div className="animate-in mt-8 flex flex-wrap gap-px overflow-hidden rounded-md" style={{ animationDelay: '160ms', border: '1px solid var(--border-dim)' }}>
          {[
            { label: 'Coaches im Roster', value: isLoading ? '…' : String(coaches?.length ?? 0) },
            { label: 'Sessions gespielt', value: isLoading ? '…' : String(totalSessions) },
            { label: 'Bewertungen', value: isLoading ? '…' : String(totalReviews) },
            { label: 'Kosten', value: 'Gratis' },
          ].map((s) => (
            <div key={s.label} className="min-w-[140px] flex-1 px-5 py-4" style={{ background: 'var(--bg-card)' }}>
              <p className="font-display text-2xl font-bold" style={{ color: 'var(--amber)' }}>{s.value}</p>
              <p className="stat-label mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Ablauf ── */}
      <div className="animate-in mb-12" style={{ animationDelay: '240ms' }}>
        <div className="mb-4 flex items-center gap-3">
          <span className="font-mono-data text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: 'var(--amber)' }}>
            {'// '}So läuft’s
          </span>
          <div className="divider flex-1" />
        </div>
        <div className="flex flex-col gap-3 md:flex-row">
          <Step nr="01" title="Anfrage im Discord" copy="Stell deine Coaching-Anfrage im DDC-Discord — Rang, Helden, woran du arbeiten willst." />
          <Step nr="02" title="Coach übernimmt" copy="Ein Coach aus dem Roster claimt deine Anfrage und plant mit dir den ersten Termin." />
          <Step nr="03" title="Fortschritt hier" copy="Termine, Ziele, Meilensteine und Session-Protokolle findest du danach unter „Mein Coaching“." />
        </div>
      </div>

      {/* ── Roster ── */}
      <div className="mb-5 flex items-center gap-3">
        <span className="font-mono-data text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: 'var(--amber)' }}>
          {'// '}Das Roster
        </span>
        {!isLoading && (
          <span
            className="font-mono-data rounded-sm px-1.5 py-0.5 text-[10px] font-bold"
            style={{ background: 'var(--amber-glow)', color: 'var(--amber)', border: '1px solid var(--amber-border)' }}
          >
            {String(coaches?.length ?? 0).padStart(2, '0')}
          </span>
        )}
        <div className="divider flex-1" />
      </div>

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
        <EmptyState
          title="Roster wird geladen"
          copy="Die Coaches werden automatisch aus dem Discord-Server synchronisiert. Schau in ein paar Minuten wieder vorbei."
        />
      )}
    </div>
  )
}
