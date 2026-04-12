import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { heroes, builds } from '@/api/client'
import type { Hero } from '@/types'

const tierOrder = ['S+', 'S', 'A', 'B', 'C', 'D', 'F']

const tierColors: Record<string, string> = {
  'S+': 'bg-red-600/20 border-red-600',
  'S': 'bg-orange-600/20 border-orange-600',
  'A': 'bg-yellow-500/20 border-yellow-500',
  'B': 'bg-emerald-700/20 border-emerald-700',
  'C': 'bg-indigo-600/20 border-indigo-600',
  'D': 'bg-purple-600/20 border-purple-600',
  'F': 'bg-red-900/20 border-red-900',
}

const tierBgColors: Record<string, string> = {
  'S+': 'bg-red-600',
  'S': 'bg-orange-500',
  'A': 'bg-yellow-500',
  'B': 'bg-emerald-600',
  'C': 'bg-indigo-500',
  'D': 'bg-purple-600',
  'F': 'bg-red-800',
}

export default function HomePage() {
  const { data: heroesData, isLoading: heroesLoading } = useQuery({
    queryKey: ['heroes'],
    queryFn: heroes.list,
  })

  const { data: buildsData } = useQuery({
    queryKey: ['builds'],
    queryFn: () => builds.list(),
  })

  if (heroesLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin w-8 h-8 border-2 border-accent-violet border-t-transparent rounded-full" />
      </div>
    )
  }

  const heroesByTier = tierOrder.reduce((acc, tier) => {
    acc[tier] = heroesData?.filter(h => h.tier === tier) || []
    return acc
  }, {} as Record<string, Hero[]>)

  const totalHeroes = heroesData?.length || 0
  const verifiedBuilds = buildsData?.filter((build) => build.status === 'verified').length || 0
  const topTier = heroesByTier['S+'].length + heroesByTier['S'].length
  const newestBuilds = [...(buildsData || [])]
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, 6)

  return (
    <div className="pb-16 pt-8 md:pb-24 md:pt-12">
      <div className="content-grid">
        <section className="glass-panel relative overflow-hidden rounded-[2rem] px-6 py-8 md:px-10 md:py-12">
          <div className="absolute inset-y-0 right-0 hidden w-2/5 bg-[radial-gradient(circle_at_top,rgba(124,108,255,0.24),transparent_58%),radial-gradient(circle_at_bottom,rgba(119,213,255,0.18),transparent_52%)] lg:block" />
          <div className="relative z-10 grid gap-10 lg:grid-cols-[1.35fr_0.85fr] lg:items-end">
            <div>
              <span className="eyebrow">Tier List & Best Builds</span>
              <h1 className="mt-5 max-w-4xl text-4xl font-semibold tracking-tight text-white md:text-6xl">
                Deadlock meta, hero priority and current pro builds in one place.
              </h1>
              <p className="mt-5 max-w-2xl text-base text-slate-300 md:text-lg">
                Weekly updated hero tiers, role snapshots and build recommendations based on competitive play.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link to="/heroes" className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-200">
                  Explore Heroes
                </Link>
                <Link to="/patchnotes" className="rounded-full border border-white/12 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/6">
                  Latest Patch Notes
                </Link>
              </div>

              <div className="mt-10 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/8 bg-white/4 px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Heroes Tracked</p>
                  <p className="mt-2 text-3xl font-semibold text-white">{totalHeroes}</p>
                </div>
                <div className="rounded-2xl border border-white/8 bg-white/4 px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Top Tier Picks</p>
                  <p className="mt-2 text-3xl font-semibold text-white">{topTier}</p>
                </div>
                <div className="rounded-2xl border border-white/8 bg-white/4 px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Verified Builds</p>
                  <p className="mt-2 text-3xl font-semibold text-white">{verifiedBuilds}</p>
                </div>
              </div>
            </div>

            <div className="grid gap-4">
              {tierOrder.slice(0, 4).map((tier) => (
                <div key={tier} className="rounded-[1.4rem] border border-white/10 bg-[#0c1017]/88 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`inline-flex min-w-12 justify-center rounded-full px-3 py-1 text-sm font-black text-white ${tierBgColors[tier]}`}>
                        {tier}
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-white">{heroesByTier[tier].length} heroes</p>
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Current bracket</p>
                      </div>
                    </div>
                    <p className="text-xs text-slate-400">
                      {heroesByTier[tier].slice(0, 3).map((hero) => hero.name).join(', ') || 'No entries'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-16">
          <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <span className="eyebrow">Live Meta Snapshot</span>
              <h2 className="section-title mt-4">Hero Tier List</h2>
              <p className="section-copy mt-2 max-w-2xl">
                Grouped by impact and current priority, with faster scanning and cleaner hero presentation.
              </p>
            </div>
            <Link to="/heroes" className="text-sm font-semibold text-sky-300 transition hover:text-sky-200">
              View all hero profiles →
            </Link>
          </div>

          <div className="space-y-6">
        {tierOrder.map(tier => (
              <div key={tier} className={`glass-panel rounded-[1.75rem] p-5 md:p-6 ${tierColors[tier]}`}>
                <div className="mb-5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className={`inline-flex min-w-14 justify-center rounded-full px-3 py-1.5 text-lg font-black text-white ${tierBgColors[tier]}`}>
                {tier}
              </span>
                    <div>
                      <p className="text-base font-semibold text-white">{heroesByTier[tier].length} heroes</p>
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Priority tier</p>
                    </div>
                  </div>
                  <p className="text-sm text-slate-400">
                    {tier === 'S+' ? 'Highest impact and most contested picks' :
                     tier === 'S' ? 'Very strong and broadly safe picks' :
                     tier === 'A' ? 'Reliable options in most drafts' :
                     'Situational and matchup dependent'}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                  {heroesByTier[tier].map(hero => (
                    <Link
                      key={hero.id}
                      to={`/heroes/${hero.name.toLowerCase().replace(/\s+/g, '-')}`}
                      className="hero-card group"
                    >
                      <div className="relative overflow-hidden rounded-[1rem] border border-white/8 bg-[#0c1017]">
                        <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-white/8 to-transparent" />
                        <div className="aspect-[0.94] overflow-hidden">
                          {hero.imageUrl ? (
                            <img src={hero.imageUrl} alt={hero.name} className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-4xl text-white/80">
                              {hero.name.charAt(0)}
                            </div>
                          )}
                        </div>
                        <span className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-xs font-bold text-white ${tierBgColors[tier]}`}>
                          {tier}
                        </span>
                      </div>
                      <div className="mt-3">
                        <p className="text-base font-semibold text-white transition group-hover:text-sky-300">{hero.name}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">{hero.role}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
        ))}
          </div>
        </section>
      </div>

      {newestBuilds.length > 0 && (
        <div className="content-grid mt-16">
          <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <span className="eyebrow">Fresh Build Activity</span>
              <h2 className="section-title mt-4">Recent Builds</h2>
              <p className="section-copy mt-2 max-w-2xl">
                Fast overview of recently added and verified recommendations.
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {newestBuilds.map(build => (
              <div key={build.id} className="glass-panel rounded-[1.5rem] p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-lg font-semibold text-white">{build.name}</p>
                    <p className="mt-1 text-sm text-slate-400">by {build.authorName}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${
                    build.status === 'verified' ? 'bg-emerald-400/14 text-emerald-300' :
                    build.status === 'reported' ? 'bg-red-500/16 text-red-300' :
                    'bg-yellow-400/14 text-yellow-300'
                  }`}>
                    {build.status}
                  </span>
                </div>

                <p className="mt-4 min-h-[72px] text-sm text-slate-300">
                  {build.description || 'Clean item path and ability progression for the current patch.'}
                </p>

                <div className="mt-5 flex items-center justify-between border-t border-white/8 pt-4">
                  <div className="flex gap-4 text-sm">
                    <span className="text-emerald-300">↑ {build.upvotes}</span>
                    <span className="text-rose-300">↓ {build.downvotes}</span>
                  </div>
                  <Link
                    to={`/heroes/${build.heroId}`}
                    className="text-sm font-semibold text-sky-300 transition hover:text-sky-200"
                  >
                    Open Hero →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
