import type {
  Hero, Build, Item, TierList, PatchNote,
  User, TierHistoryEntry, Report, Announcement
} from '@/types'

const BASE = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/api`

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Request failed' }))
    throw new Error(err.detail || 'Request failed')
  }
  return res.json()
}

// Auth
export const auth = {
  me: () => request<{ user: User | null }>('/auth/me'),
  logout: () => request('/auth/logout', { method: 'POST' }),
}

// Heroes
export const heroes = {
  list: () => request<Hero[]>('/heroes'),
  get: (id: string) => request<Hero>(`/heroes/${id}`),
  create: (data: Partial<Hero>) => request<Hero>('/heroes', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<Hero>) => request<Hero>(`/heroes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => request(`/heroes/${id}`, { method: 'DELETE' }),
}

// Builds
export const builds = {
  list: (params?: { heroId?: string; status?: string }) => {
    const query = new URLSearchParams(params as Record<string, string>).toString()
    return request<Build[]>(`/builds${query ? `?${query}` : ''}`)
  },
  get: (id: string) => request<Build>(`/builds/${id}`),
  create: (data: Partial<Build>) => request<Build>('/builds', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<Build>) => request<Build>(`/builds/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => request(`/builds/${id}`, { method: 'DELETE' }),
  vote: (id: string, vote: 'up' | 'down') => request<Build>(`/builds/${id}/vote`, { method: 'POST', body: JSON.stringify({ vote }) }),
  report: (id: string, reason: string) => request(`/builds/${id}/report`, { method: 'POST', body: JSON.stringify({ reason }) }),
}

// Items
export const items = {
  list: () => request<Item[]>('/items'),
  get: (id: string) => request<Item>(`/items/${id}`),
}

// TierLists
export const tierLists = {
  list: () => request<TierList[]>('/tierlists'),
  my: () => request<TierList[]>('/tierlists/my'),
  get: (id: string, secretCode?: string) => {
    const query = secretCode ? `?secret=${secretCode}` : ''
    return request<TierList>(`/tierlists/${id}${query}`)
  },
  create: (data: Partial<TierList>) => request<TierList>('/tierlists', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<TierList>) => request<TierList>(`/tierlists/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => request(`/tierlists/${id}`, { method: 'DELETE' }),
  fork: (id: string) => request<TierList>(`/tierlists/${id}/fork`, { method: 'POST' }),
}

// PatchNotes
export const patchNotes = {
  list: () => request<PatchNote[]>('/patchnotes'),
  create: (data: Partial<PatchNote>) => request<PatchNote>('/patchnotes', { method: 'POST', body: JSON.stringify(data) }),
  delete: (id: string) => request(`/patchnotes/${id}`, { method: 'DELETE' }),
}

// History
export const history = {
  list: () => request<TierHistoryEntry[]>('/history'),
}

// Admin
export const admin = {
  reports: () => request<Report[]>('/admin/reports'),
  updateReport: (id: string, status: string) => request(`/admin/reports/${id}`, { method: 'PUT', body: JSON.stringify({ status }) }),
  votes: () => request<{ buildId: string; upvotes: number; downvotes: number }[]>('/admin/votes'),
  deleteVote: (id: string) => request(`/admin/votes/${id}`, { method: 'DELETE' }),
  setAnnouncement: (message: string) => request<Announcement>('/admin/announcement', { method: 'POST', body: JSON.stringify({ message }) }),
  deleteAnnouncement: (id: string) => request(`/admin/announcement/${id}`, { method: 'DELETE' }),
  users: () => request<User[]>('/admin/users'),
  updateUserRole: (id: string, role: string) => request(`/admin/users/${id}/role`, { method: 'PUT', body: JSON.stringify({ role }) }),
}

// Coaching
export interface CoachProfile {
  id: string
  display_name: string
  discord_username: string
  avatar_url: string | null
  bio: string | null
  specialties: string[]
  availability: Record<string, string>
  status: string
  avg_rating: number
  total_reviews: number
  total_sessions: number
}

export interface CoachReview {
  id: string
  coach_id: string
  user_display_name: string
  rating: number
  feedback_text: string | null
  improved_areas: string | null
  created_at: string
}

export interface CoachApplication {
  discord_user_id: number
  discord_username: string
  display_name: string
  application_text: string
  experience_text: string
  rank: string
  specialties: string[]
  availability: Record<string, string>
}

export interface CoachingRequest {
  id: string
  discord_username: string
  rank: string
  subrank: string
  hero: string | null
  games_played: string | null
  hours_played: string | null
  availability: string | null
  current_problems: string | null
  ai_summary: string | null
  status: string
  created_at: string
}

export const coaching = {
  // Coaches
  listCoaches: (params?: { specialty?: string; min_rating?: number }) => {
    const query = new URLSearchParams(params as Record<string, string>).toString()
    return request<CoachProfile[]>(`/coaching/coaches${query ? `?${query}` : ''}`)
  },
  getCoach: (id: string) => request<CoachProfile>(`/coaching/coaches/${id}`),
  getCoachReviews: (id: string) => request<CoachReview[]>(`/coaching/coaches/${id}/reviews`),

  // Profile
  createProfile: (data: Partial<CoachProfile>) =>
    request<CoachProfile>('/coaching/coaches/profile', { method: 'POST', body: JSON.stringify(data) }),

  // Application
  applyToBeCoach: (data: CoachApplication) =>
    request('/coaching/coaches/apply', { method: 'POST', body: JSON.stringify(data) }),

  // Dashboard
  getDashboard: () => request<{ profile: CoachProfile | null; sessions: any[]; reviews: CoachReview[] }>('/coaching/dashboard'),

  // Requests (internal)
  listRequests: (status?: string) => {
    const query = status ? `?status=${status}` : ''
    return request<CoachingRequest[]>(`/coaching/requests${query}`)
  },
}
