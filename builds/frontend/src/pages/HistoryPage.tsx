import { useQuery } from '@tanstack/react-query'
import { history } from '@/api/client'

export default function HistoryPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['history'],
    queryFn: history.list,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin w-8 h-8 border-2 border-accent-violet border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Tier List History</h1>

      {data && data.length > 0 ? (
        <div className="space-y-4">
          {data.map(entry => (
            <div key={entry.id} className="bg-bg-card rounded-lg p-4 flex items-center gap-4 border border-white/5">
              <div className="text-2xl w-12 h-12 bg-bg-secondary rounded-lg flex items-center justify-center">
                {entry.heroName.charAt(0)}
              </div>
              <div className="flex-1">
                <p className="font-medium">{entry.heroName}</p>
                <p className="text-sm text-gray-500">
                  Changed by {entry.changedBy} on {new Date(entry.changedAt).toLocaleDateString('de-DE')}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 rounded text-sm font-medium ${
                  entry.oldTier === 'S+' ? 'bg-red-600/20 text-red-500' :
                  entry.oldTier === 'S' ? 'bg-orange-500/20 text-orange-500' :
                  entry.oldTier === 'A' ? 'bg-yellow-500/20 text-yellow-500' :
                  'bg-gray-600/20 text-gray-400'
                }`}>
                  {entry.oldTier}
                </span>
                <span className="text-gray-500">→</span>
                <span className={`px-2 py-1 rounded text-sm font-medium ${
                  entry.newTier === 'S+' ? 'bg-red-600/20 text-red-500' :
                  entry.newTier === 'S' ? 'bg-orange-500/20 text-orange-500' :
                  entry.newTier === 'A' ? 'bg-yellow-500/20 text-yellow-500' :
                  'bg-gray-600/20 text-gray-400'
                }`}>
                  {entry.newTier}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-gray-400">
          No history entries yet.
        </div>
      )}
    </div>
  )
}