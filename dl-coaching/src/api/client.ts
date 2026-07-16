import type { User } from '@/types'

const BASE = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/api`

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
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
  twitch_url?: string | null
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
  status: string
  created_at: string
}

export interface CreateCoachingRequest {
  display_name?: string
  rank: string
  subrank?: string
  hero?: string
  games_played?: string
  hours_played?: string
  availability?: string
  current_problems: string
  preferred_coach_id?: string
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
  getDashboard: () => request<{ profile: CoachProfile | null; sessions: unknown[]; reviews: CoachReview[] }>('/coaching/dashboard'),

  // Requests (internal)
  listRequests: (status?: string) => {
    const query = status ? `?status=${status}` : ''
    return request<CoachingRequest[]>(`/coaching/requests${query}`)
  },
  createRequest: (data: CreateCoachingRequest) =>
    request<CoachingRequest>('/coaching/requests', { method: 'POST', body: JSON.stringify(data) }),
}

// Scrims

/** Struktur der Wochen-Verfügbarkeit — 1:1 zum Backend (serde). from/to = Minuten seit Mitternacht (0..1440). */
export type DayStatus = 'available' | 'unavailable' | 'unknown'

export interface DaySlot {
  status: DayStatus
  from: number | null
  to: number | null
}

export type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'

export interface ScrimWindow {
  day: Weekday
  from: number
  to: number
}

export interface WeeklyAvailability {
  mon: DaySlot
  tue: DaySlot
  wed: DaySlot
  thu: DaySlot
  fri: DaySlot
  sat: DaySlot
  sun: DaySlot
}

export interface DayOverlap {
  available: number
  unavailable: number
  unknown: number
  window_from: number | null
  window_to: number | null
  full_squad: boolean
  unavailable_ids: number[]
  unknown_ids: number[]
}

export interface WeeklyOverlap {
  mon: DayOverlap
  tue: DayOverlap
  wed: DayOverlap
  thu: DayOverlap
  fri: DayOverlap
  sat: DayOverlap
  sun: DayOverlap
}

export interface ScrimParticipant {
  id: number
  display_name: string
  rank: string | null
  roles: string | null
  availability: string | null
  availability_slots: WeeklyAvailability
  availability_confirmed: boolean
  status: string
  source: string
}

export interface ScrimTeam {
  id: number
  name: string
  coach: string | null
  discord_role_id: number | null
  discord_channel_id: number | null
}

export interface ScrimTeamMember {
  participant_id: number
  display_name: string
  role: string | null
  is_captain: boolean
  is_bench: boolean
}

export interface ScrimNextMatch {
  id: number
  opponent_team_name: string | null
  when_text: string | null
  scheduled_at: string | null
  status: string
}

export interface ScrimMeResponse {
  participant: ScrimParticipant | null
  team: ScrimTeam | null
  members: ScrimTeamMember[]
  next_match: ScrimNextMatch | null
}

export interface ScrimSignupRequest {
  rank?: string
  roles?: string
  availability?: string
  availability_slots?: WeeklyAvailability
}

export interface ScrimCreateTeamRequest {
  name: string
  coach?: string | null
}

/** Aus welchem Topf Kandidaten kommen: feste Teams aus dem Spieler-Pool, Einspringer von der Auswechselbank. */
export type ScrimPoolSource = 'players' | 'reserve'

export interface ScrimSuggestRosterRequest {
  window?: ScrimWindow | null
  size?: number
  pool?: ScrimPoolSource
}

export interface ScrimRosterSuggestionCandidate {
  participant_id: number
  display_name: string
  rank: string | null
  roles: string | null
  availability: string | null
  availability_slots: WeeklyAvailability
  availability_confirmed: boolean
  status: string
  source: string
  fit_minutes: number
  fit_ratio: number
}

export interface ScrimRosterSuggestResponse {
  team: ScrimTeam
  requested_size: number
  fit_count: number
  best_window: ScrimWindow | null
  candidates: ScrimRosterSuggestionCandidate[]
}

export interface ScrimPoolParticipant extends ScrimParticipant {
  discord_linked: boolean
  notes: string | null
  team: ScrimTeam | null
  role: string | null
  is_captain: boolean
  is_bench: boolean
}

export interface ScrimTeamBoardMember {
  participant_id: number
  display_name: string
  rank: string | null
  roles: string | null
  is_captain: boolean
  is_bench: boolean
  discord_linked: boolean
  availability_confirmed: boolean
  availability: WeeklyAvailability
  notes: string | null
}

export interface ScrimTeamBoardResponse {
  team: ScrimTeam
  members: ScrimTeamBoardMember[]
  overlap: WeeklyOverlap
}

export interface DiscordSyncStatus {
  ok: boolean
  detail: string
}

export interface ScrimParticipantPatchResponse extends ScrimPoolParticipant {
  discord_sync: DiscordSyncStatus
}

export interface ScrimDiscordResyncResponse {
  discord_sync: DiscordSyncStatus
}

export interface ScrimParticipantPatch {
  status?: string
  // number = Team zuweisen, null = aus Team entfernen, weggelassen = unverändert
  team_id?: number | null
  is_bench?: boolean
  is_captain?: boolean
  notes?: string
  rank?: string
  roles?: string
}

/** Aushilfe bestätigen: Team-Rolle für diese Session, Auswechselspieler-Status bleibt. */
export interface ScrimSubstituteRequest {
  participant_id: number
  window: ScrimWindow
}

export interface ScrimSubstituteResponse {
  participant: ScrimPoolParticipant
  discord_sync: DiscordSyncStatus
  dm: DiscordSyncStatus
}

export const scrims = {
  me: () => request<ScrimMeResponse>('/scrim/me'),
  signup: (data: ScrimSignupRequest) =>
    request<ScrimParticipant>('/scrim/signup', { method: 'POST', body: JSON.stringify(data) }),
  setAvailability: (data: WeeklyAvailability) =>
    request<ScrimParticipant>('/scrim/me/availability', { method: 'PUT', body: JSON.stringify(data) }),
  teams: () => request<ScrimTeam[]>('/scrim/teams'),
  createTeam: (data: ScrimCreateTeamRequest) =>
    request<ScrimTeam>('/scrim/teams', { method: 'POST', body: JSON.stringify(data) }),
  teamBoard: (id: number) => request<ScrimTeamBoardResponse>(`/scrim/teams/${id}/board`),
  suggestRoster: (id: number, data: ScrimSuggestRosterRequest) =>
    request<ScrimRosterSuggestResponse>(`/scrim/teams/${id}/suggest`, { method: 'POST', body: JSON.stringify(data) }),
  confirmSubstitute: (teamId: number, data: ScrimSubstituteRequest) =>
    request<ScrimSubstituteResponse>(`/scrim/teams/${teamId}/substitute`, { method: 'POST', body: JSON.stringify(data) }),
  pool: (status?: string) => {
    const query = status ? `?${new URLSearchParams({ status }).toString()}` : ''
    return request<ScrimPoolParticipant[]>(`/scrim/pool${query}`)
  },
  updateParticipant: (id: number, data: ScrimParticipantPatch) =>
    request<ScrimParticipantPatchResponse>(`/scrim/participants/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  resyncDiscord: (id: number) =>
    request<ScrimDiscordResyncResponse>(`/scrim/participants/${id}/resync-discord`, { method: 'POST' }),
}

// ===== Coaching-Plattform (Coach-/Spieler-Bereich, vom Bot gespiegelt) =====

export interface PlatformCoachStat {
  id: string
  display_name: string | null
  discord_username: string | null
  active: number
  completed: number
  total: number
}

export interface PlatformRecentSession {
  id: string
  status: string
  started_at: string | null
  completed_at: string | null
  discord_username: string | null
  coachee_id: string | null
  coachee_display: string | null
  coach_display: string | null
}

export interface PlatformQueueRequest {
  id: string
  discord_user_id: number
  discord_username: string | null
  rank: string | null
  subrank: string | null
  hero: string | null
  games_played: string | null
  hours_played: string | null
  availability: string | null
  current_problems: string | null
  status: string
  assigned_coach_id: string | null
  assigned_coach_username: string | null
  reserved_until: number | null
  created_at: string
  reserved_for_me: boolean
  is_open: boolean
}

export interface CoacheeListItem {
  id: string
  discord_username: string | null
  display_name: string | null
  rank: string | null
  current_focus: string | null
  open_goals: number
  sessions: number
}

export interface CoacheeProfile {
  id: string
  discord_user_id: number
  discord_username: string | null
  display_name: string | null
  rank: string | null
  main_heroes_json: string | null
  current_focus: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Milestone {
  id: string
  goal_id: string
  title: string
  description: string | null
  achieved: number
  achieved_at: string | null
  sort_order: number
  created_at: string
}

export interface Goal {
  id: string
  coachee_id: string
  coach_id: string | null
  session_id: string | null
  title: string
  description: string | null
  status: 'open' | 'active' | 'done' | 'dropped'
  sort_order: number
  target_date: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
  milestones: Milestone[]
}

export interface SessionNote {
  id: string
  session_id: string | null
  coachee_id: string
  coach_id: string | null
  content: string
  visibility: 'coach_only' | 'shared_with_user'
  created_at: string
  updated_at: string
}

export interface PlatformSession {
  id?: string
  request_id?: string
  coach_id?: string | null
  coachee_id?: string | null
  discord_user_id?: number
  discord_username?: string | null
  status: string
  started_at: string | null
  completed_at: string | null
  coach_display: string | null
}

export interface Appointment {
  id: string
  coach_id: string | null
  coachee_id: string | null
  scheduled_at: string
  duration_minutes: number
  title: string | null
  note: string | null
  status: 'scheduled' | 'done' | 'cancelled' | string
  coachee_display?: string | null
  coach_display?: string | null
  created_at?: string
  updated_at?: string
}

export interface CoachSelf {
  id: string
  display_name: string | null
  discord_username: string | null
  avatar_url: string | null
  bio: string | null
  specialties: string[]
  twitch_url: string | null
  status: string
  avg_rating: number
  total_reviews: number
  total_sessions: number
}

export interface CoacheeDetail {
  profile: CoacheeProfile
  goals: Goal[]
  notes: SessionNote[]
  sessions: PlatformSession[]
  appointments?: Appointment[]
}

export interface MyCoaching {
  profile: CoacheeProfile | null
  goals: Goal[]
  notes: SessionNote[]
  sessions: PlatformSession[]
  appointments?: Appointment[]
}

export const coachingPlatform = {
  overview: () =>
    request<{ coaches: PlatformCoachStat[]; recent_sessions: PlatformRecentSession[] }>(
      '/coaching/platform/overview'
    ),
  queue: () => request<{ requests: PlatformQueueRequest[] }>('/coaching/platform/queue'),
  listCoachees: () => request<{ coachees: CoacheeListItem[] }>('/coaching/platform/coachees'),
  getCoachee: (id: string) => request<CoacheeDetail>(`/coaching/platform/coachees/${id}`),
  updateCoachee: (
    id: string,
    data: Partial<Pick<CoacheeProfile, 'display_name' | 'rank' | 'main_heroes_json' | 'current_focus' | 'notes'>>
  ) => request(`/coaching/platform/coachees/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  createGoal: (coacheeId: string, data: { title: string; description?: string; target_date?: string; session_id?: string }) =>
    request<{ id: string }>(`/coaching/platform/coachees/${coacheeId}/goals`, { method: 'POST', body: JSON.stringify(data) }),
  updateGoal: (goalId: string, data: { title?: string; description?: string; status?: string; sort_order?: number; target_date?: string }) =>
    request(`/coaching/platform/goals/${goalId}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteGoal: (goalId: string) => request(`/coaching/platform/goals/${goalId}`, { method: 'DELETE' }),

  createMilestone: (goalId: string, data: { title: string; description?: string }) =>
    request<{ id: string }>(`/coaching/platform/goals/${goalId}/milestones`, { method: 'POST', body: JSON.stringify(data) }),
  updateMilestone: (milestoneId: string, data: { title?: string; achieved?: boolean; sort_order?: number }) =>
    request(`/coaching/platform/milestones/${milestoneId}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteMilestone: (milestoneId: string) => request(`/coaching/platform/milestones/${milestoneId}`, { method: 'DELETE' }),

  listAppointments: (scope: 'mine' | 'all' = 'mine') =>
    request<{ appointments: Appointment[] }>(`/coaching/platform/appointments?scope=${scope}`),
  createAppointment: (data: { coachee_id: string; scheduled_at: string; duration_minutes?: number; title?: string; note?: string }) =>
    request<{ id: string }>('/coaching/platform/appointments', { method: 'POST', body: JSON.stringify(data) }),
  updateAppointment: (id: string, data: { scheduled_at?: string; duration_minutes?: number; title?: string; note?: string; status?: string }) =>
    request(`/coaching/platform/appointments/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  coachMe: () => request<CoachSelf>('/coaching/platform/coaches/me'),
  updateCoachMe: (data: { bio?: string; specialties?: string[]; twitch_url?: string }) =>
    request('/coaching/platform/coaches/me', { method: 'PATCH', body: JSON.stringify(data) }),

  createNote: (coacheeId: string, data: { content: string; visibility?: string; session_id?: string }) =>
    request<{ id: string }>(`/coaching/platform/coachees/${coacheeId}/notes`, { method: 'POST', body: JSON.stringify(data) }),
  updateNote: (noteId: string, data: { content?: string; visibility?: string }) =>
    request(`/coaching/platform/notes/${noteId}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteNote: (noteId: string) => request(`/coaching/platform/notes/${noteId}`, { method: 'DELETE' }),

  me: () => request<MyCoaching>('/coaching/platform/me'),
}
