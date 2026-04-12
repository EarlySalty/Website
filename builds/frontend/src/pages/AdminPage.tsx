import { useQuery } from '@tanstack/react-query'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { admin } from '@/api/client'

export default function AdminPage() {
  const { isAdmin, isLoading: authLoading } = useAuth()
  const location = useLocation()

  const { data: reports } = useQuery({
    queryKey: ['admin-reports'],
    queryFn: admin.reports,
    enabled: !!isAdmin,
  })

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin w-8 h-8 border-2 border-accent-violet border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
        <p className="text-gray-400">You don't have permission to access the admin panel.</p>
      </div>
    )
  }

  const tabs = [
    { path: '/admin', label: 'Overview', exact: true },
    { path: '/admin/heroes', label: 'Heroes' },
    { path: '/admin/patches', label: 'Patches' },
    { path: '/admin/reports', label: `Reports (${reports?.length || 0})` },
    { path: '/admin/votes', label: 'Votes' },
    { path: '/admin/users', label: 'Users' },
  ]

  const isActive = (path: string, exact?: boolean) => {
    if (exact) return location.pathname === path
    return location.pathname.startsWith(path)
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Admin Panel</h1>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/10 mb-8 overflow-x-auto">
        {tabs.map(tab => (
          <Link
            key={tab.path}
            to={tab.path}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap transition ${
              isActive(tab.path, tab.exact)
                ? 'text-accent-cyan border-b-2 border-accent-cyan'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {/* Content */}
      <Outlet />

      {/* Quick Stats */}
      <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-bg-card rounded-lg p-4">
          <p className="text-gray-500 text-sm">Total Reports</p>
          <p className="text-2xl font-bold">{reports?.length || 0}</p>
        </div>
      </div>
    </div>
  )
}