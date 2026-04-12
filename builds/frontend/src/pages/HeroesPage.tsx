import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { heroes } from '@/api/client'

export default function HeroesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['heroes'],
    queryFn: heroes.list,
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
        <span className="eyebrow">Hero Directory</span>
        <h1 className="section-title mt-4">All Heroes</h1>
        <p className="section-copy mt-2 max-w-2xl">
          Browse every tracked hero with a cleaner card layout and faster access to tier data.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {data?.map(hero => (
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
                  <div className="flex h-full w-full items-center justify-center text-4xl">
                  {hero.name.charAt(0)}
                </div>
              )}
              </div>
              <span className={`absolute right-3 top-3 rounded-full px-2.5 py-1 text-xs font-bold ${
                hero.tier === 'S+' ? 'bg-red-600 text-white' :
                hero.tier === 'S' ? 'bg-orange-500 text-white' :
                hero.tier === 'A' ? 'bg-yellow-500 text-black' :
                'bg-gray-600 text-white'
              }`}>
                {hero.tier}
              </span>
            </div>
            <div className="mt-3">
              <h3 className="text-base font-semibold text-white transition group-hover:text-sky-300">
                {hero.name}
              </h3>
              <span className="mt-1 block text-xs uppercase tracking-[0.18em] text-slate-500">{hero.role}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
