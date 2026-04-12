import { useQuery } from '@tanstack/react-query'
import { useParams, Link } from 'react-router-dom'
import { useState } from 'react'
import { heroes, builds } from '@/api/client'

const tierStyles: Record<string, string> = {
  'S+': 'bg-red-600 text-white',
  'S': 'bg-orange-500 text-white',
  'A': 'bg-yellow-500 text-black',
  'B': 'bg-emerald-600 text-white',
  'C': 'bg-indigo-500 text-white',
  'D': 'bg-purple-600 text-white',
  'F': 'bg-rose-800 text-white',
}

const statItems = [
  { key: 'health', label: 'Health' },
  { key: 'armor', label: 'Armor' },
  { key: 'speed', label: 'Speed' },
  { key: 'damage', label: 'Damage' },
] as const

export default function HeroDetailPage() {
  const { name } = useParams()
  const [activeTab, setActiveTab] = useState<'builds' | 'abilities' | 'stats'>('builds')

  const { data: allHeroes, isLoading: heroesLoading } = useQuery({
    queryKey: ['heroes'],
    queryFn: heroes.list,
  })

  const hero = allHeroes?.find((entry) => entry.name.toLowerCase().replace(/\s+/g, '-') === name)

  const { data: heroBuilds } = useQuery({
    queryKey: ['builds', hero?.id],
    queryFn: () => (hero ? builds.list({ heroId: hero.id }) : Promise.resolve([])),
    enabled: !!hero,
  })

  if (heroesLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent-violet border-t-transparent" />
      </div>
    )
  }

  if (!hero) {
    return (
      <div className="content-grid py-20 text-center">
        <h1 className="text-3xl font-semibold text-white">Hero not found</h1>
        <Link to="/heroes" className="mt-4 inline-block text-sm font-semibold text-sky-300 transition hover:text-sky-200">
          ← Back to Heroes
        </Link>
      </div>
    )
  }

  return (
    <div className="content-grid py-10 md:py-14">
      <div className="glass-panel overflow-hidden rounded-[2rem]">
        <div className="grid gap-8 px-6 py-6 md:px-8 md:py-8 lg:grid-cols-[320px_1fr]">
          <div className="overflow-hidden rounded-[1.6rem] border border-white/10 bg-[#0c1017]">
            <div className="absolute hidden" />
            {hero.imageUrl ? (
              <img src={hero.imageUrl} alt={hero.name} className="aspect-[0.92] h-full w-full object-cover" />
            ) : (
              <div className="flex aspect-[0.92] w-full items-center justify-center text-7xl text-white/80">
                {hero.name.charAt(0)}
              </div>
            )}
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="eyebrow">Hero Profile</span>
              <span className={`rounded-full px-3 py-1 text-sm font-black ${tierStyles[hero.tier]}`}>{hero.tier}</span>
            </div>

            <h1 className="mt-5 text-4xl font-semibold tracking-tight text-white md:text-5xl">{hero.name}</h1>
            <p className="mt-3 text-sm uppercase tracking-[0.2em] text-slate-500">{hero.role}</p>
            <p className="mt-5 max-w-3xl text-base text-slate-300">
              Snapshot of current performance, core stat profile and the latest tracked builds for this hero.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-4">
              {statItems.map((item) => (
                <div key={item.key} className="rounded-[1.25rem] border border-white/8 bg-white/4 px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{hero.stats[item.key]}</p>
                </div>
              ))}
            </div>

            <div className="mt-8 flex flex-wrap gap-2 rounded-full border border-white/8 bg-white/5 p-1">
              {[
                { id: 'builds', label: `Builds (${heroBuilds?.length || 0})` },
                { id: 'abilities', label: 'Abilities' },
                { id: 'stats', label: 'Stats' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as 'builds' | 'abilities' | 'stats')}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                    activeTab === tab.id ? 'bg-white text-slate-950' : 'text-slate-300 hover:bg-white/8 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {activeTab === 'builds' && (
        <section className="mt-8">
          <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <span className="eyebrow">Build Overview</span>
              <h2 className="section-title mt-4">Tracked Builds</h2>
            </div>
            <Link
              to={`/builds/new?heroId=${hero.id}`}
              className="rounded-full border border-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/6"
            >
              Add Build
            </Link>
          </div>

          {heroBuilds && heroBuilds.length > 0 ? (
            <div className="grid gap-5 lg:grid-cols-2">
              {heroBuilds.map((build) => (
                <article key={build.id} className="glass-panel rounded-[1.75rem] p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-xl font-semibold text-white">{build.name}</h3>
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
                    {build.description || 'Current item route and power spikes for this hero in the active patch.'}
                  </p>

                  <div className="mt-5">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Ability Order</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {build.abilityOrder.map((level, index) => (
                        <span
                          key={`${build.id}-ability-${index}`}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/8 bg-[#0d1118] text-sm font-semibold text-white"
                        >
                          {level}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="mt-5">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Core Items</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {build.items.map((item, index) => (
                        <span
                          key={`${build.id}-item-${index}`}
                          className="rounded-full border border-white/8 bg-white/4 px-3 py-1.5 text-sm text-slate-200"
                        >
                          {item.itemName}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="mt-6 flex items-center justify-between border-t border-white/8 pt-4 text-sm">
                    <span className="text-slate-400">{new Date(build.createdAt).toLocaleDateString('de-DE')}</span>
                    <div className="flex gap-4">
                      <span className="text-emerald-300">↑ {build.upvotes}</span>
                      <span className="text-rose-300">↓ {build.downvotes}</span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="glass-panel rounded-[1.75rem] px-6 py-12 text-center text-slate-400">
              No builds yet. Be the first to add one.
            </div>
          )}
        </section>
      )}

      {activeTab === 'abilities' && (
        <section className="mt-8">
          <div className="mb-5">
            <span className="eyebrow">Hero Toolkit</span>
            <h2 className="section-title mt-4">Abilities</h2>
          </div>
          <div className="grid gap-4">
            {hero.abilities.map((ability) => (
              <article key={ability.id} className="glass-panel flex gap-4 rounded-[1.5rem] p-5">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[1rem] border border-white/8 bg-[#0d1118] text-2xl text-white">
                  {ability.icon || 'A'}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">{ability.name}</h3>
                  <p className="mt-2 text-sm text-slate-300">{ability.description}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {activeTab === 'stats' && (
        <section className="mt-8">
          <div className="mb-5">
            <span className="eyebrow">Stat Profile</span>
            <h2 className="section-title mt-4">Core Numbers</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {statItems.map((item) => (
              <div key={item.key} className="glass-panel rounded-[1.5rem] p-5">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
                <p className="mt-3 text-4xl font-semibold text-white">{hero.stats[item.key]}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
