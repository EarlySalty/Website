import { useQuery } from '@tanstack/react-query'
import { Link, useLocation } from 'react-router-dom'
import { tierLists } from '@/api/client'
import { useAuth } from '@/context/AuthContext'

export default function TierListsPage() {
  const { user } = useAuth()
  const location = useLocation()
  const isMineView = location.pathname.endsWith('/my')

  const { data: publicLists, isLoading: publicLoading } = useQuery({
    queryKey: ['tierlists'],
    queryFn: tierLists.list,
  })

  const { data: myLists } = useQuery({
    queryKey: ['mytierlists'],
    queryFn: tierLists.my,
    enabled: !!user,
  })

  if (publicLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent-violet border-t-transparent" />
      </div>
    )
  }

  const activeLists = isMineView && user ? (myLists || []) : (publicLists || [])

  return (
    <div className="content-grid py-10 md:py-14">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <span className="eyebrow">Community Rankings</span>
          <h1 className="section-title mt-4">Tier Lists</h1>
          <p className="section-copy mt-2 max-w-2xl">
            Browse public rankings or switch to your own lists with a cleaner card grid and stronger hierarchy.
          </p>
        </div>
        <Link
          to="/tierlists/new"
          className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-200"
        >
          Create Tier List
        </Link>
      </div>

      <div className="mb-6 flex flex-wrap gap-2 rounded-full border border-white/8 bg-white/5 p-1">
        <Link
          to="/tierlists"
          className={`rounded-full px-4 py-2 text-sm font-medium transition ${
            !isMineView ? 'bg-white text-slate-950' : 'text-slate-300 hover:bg-white/8 hover:text-white'
          }`}
        >
          Public Lists
        </Link>
        {user && (
          <Link
            to="/tierlists/my"
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              isMineView ? 'bg-white text-slate-950' : 'text-slate-300 hover:bg-white/8 hover:text-white'
            }`}
          >
            My Lists
          </Link>
        )}
      </div>

      {activeLists.length > 0 ? (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {activeLists.map((list) => (
            <Link key={list.id} to={`/tierlists/${list.id}`} className="glass-panel rounded-[1.75rem] p-5 transition hover:-translate-y-1">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-white">{list.name}</h2>
                  <p className="mt-2 text-sm text-slate-400">by {list.ownerName}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${
                  list.isPublic ? 'bg-sky-400/14 text-sky-300' : 'bg-white/10 text-slate-300'
                }`}>
                  {list.isPublic ? 'Public' : 'Private'}
                </span>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3">
                <div className="rounded-[1rem] border border-white/8 bg-white/4 px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Tiers</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{Object.keys(list.tiers).length}</p>
                </div>
                <div className="rounded-[1rem] border border-white/8 bg-white/4 px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Status</p>
                  <p className="mt-2 text-base font-semibold text-white">{list.forkedFrom ? 'Forked' : 'Original'}</p>
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between border-t border-white/8 pt-4 text-sm text-slate-400">
                <span>{new Date(list.createdAt).toLocaleDateString('de-DE')}</span>
                <span className="font-semibold text-sky-300">Open List →</span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="glass-panel rounded-[1.75rem] px-6 py-12 text-center text-slate-400">
          {isMineView ? 'You have not created any tier lists yet.' : 'No public tier lists yet.'}
        </div>
      )}
    </div>
  )
}
