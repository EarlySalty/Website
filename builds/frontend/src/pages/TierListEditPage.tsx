import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { tierLists } from '@/api/client'

export default function TierListEditPage() {
  const { id } = useParams()

  const { data: tierList, isLoading } = useQuery({
    queryKey: ['tierlist', id],
    queryFn: () => tierLists.get(id!),
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin w-8 h-8 border-2 border-accent-violet border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!tierList) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold mb-4">Tier List not found</h1>
        <Link to="/tierlists" className="text-accent-cyan hover:underline">← Back to Tier Lists</Link>
      </div>
    )
  }

  const tiers = ['S+', 'S', 'A', 'B', 'C', 'D', 'F']

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center gap-4 mb-8">
        <Link to="/tierlists" className="text-gray-400 hover:text-white">← Back</Link>
        <h1 className="text-2xl font-bold flex-1">{tierList.name}</h1>
        <button className="bg-accent-violet hover:bg-accent-violet/80 text-white px-4 py-2 rounded font-medium transition">
          Save Changes
        </button>
      </div>

      {/* Tier Columns */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {tiers.map(tier => (
          <div
            key={tier}
            className="flex-shrink-0 w-48 bg-bg-card rounded-lg p-3"
          >
            <div className={`text-center font-bold py-2 rounded mb-3 ${
              tier === 'S+' ? 'bg-red-600/20 text-red-500' :
              tier === 'S' ? 'bg-orange-500/20 text-orange-500' :
              tier === 'A' ? 'bg-yellow-500/20 text-yellow-500' :
              tier === 'B' ? 'bg-emerald-600/20 text-emerald-500' :
              tier === 'C' ? 'bg-indigo-500/20 text-indigo-400' :
              tier === 'D' ? 'bg-purple-600/20 text-purple-400' :
              'bg-red-800/20 text-red-600'
            }`}>
              {tier}
            </div>
            <div className="space-y-2 min-h-[200px]">
              {(tierList.tiers[tier] || []).map((heroId) => (
                <div
                  key={heroId}
                  className="bg-bg-secondary p-2 rounded text-sm cursor-move hover:bg-bg-primary transition"
                >
                  {heroId}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Share Section */}
      <div className="mt-8 bg-bg-card rounded-lg p-4">
        <h3 className="font-semibold mb-2">Share this Tier List</h3>
        <div className="flex gap-3">
          <input
            type="text"
            readOnly
            value={tierList.secretCode ? `${window.location.origin}/tierlists/${tierList.id}?code=${tierList.secretCode}` : ''}
            className="flex-1 bg-bg-secondary border border-white/10 rounded px-3 py-2 text-sm"
            placeholder="Generate a secret code to share"
          />
          <button className="bg-bg-secondary hover:bg-bg-primary px-4 py-2 rounded text-sm transition">
            Copy Link
          </button>
        </div>
      </div>
    </div>
  )
}