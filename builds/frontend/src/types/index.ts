export interface Hero {
  id: string
  name: string
  tier: 'S+' | 'S' | 'A' | 'B' | 'C' | 'D' | 'F'
  role: string
  imageUrl: string
  abilities: Ability[]
  stats: HeroStats
}

export interface Ability {
  id: string
  name: string
  icon: string
  description: string
}

export interface HeroStats {
  health: number
  armor: number
  speed: number
  damage: number
}

export interface Build {
  id: string
  heroId: string
  name: string
  authorId: string
  authorName: string
  description: string
  abilityOrder: number[]
  items: BuildItem[]
  upvotes: number
  downvotes: number
  status: 'pending' | 'verified' | 'reported'
  createdAt: string
}

export interface BuildItem {
  slot: number
  itemId: string
  itemName: string
}

export interface Item {
  id: string
  name: string
  type: 'weapon' | 'armor' | 'utility' | 'special'
  stats: Record<string, number>
  imageUrl: string
}

export interface TierList {
  id: string
  name: string
  ownerId: string
  ownerName: string
  isPublic: boolean
  secretCode?: string
  tiers: Record<string, string[]>
  forkedFrom?: string
  createdAt: string
}

export interface PatchNote {
  id: string
  title: string
  content: string
  version: string
  createdAt: string
}

export interface User {
  id: string
  username: string
  displayName: string
  avatarUrl: string
  role: 'user' | 'admin' | 'builder'
  is_coach?: boolean
}

export interface TierHistoryEntry {
  id: string
  heroId: string
  heroName: string
  oldTier: string
  newTier: string
  changedBy: string
  changedAt: string
}

export interface Report {
  id: string
  buildId: string
  buildName: string
  reporterId: string
  reporterName: string
  reason: string
  status: 'open' | 'resolved' | 'dismissed'
  createdAt: string
}

export interface Announcement {
  id: string
  message: string
  isActive: boolean
  createdAt: string
}