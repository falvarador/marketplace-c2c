export const PROVINCES_CR = [
  'San José',
  'Alajuela',
  'Cartago',
  'Heredia',
  'Guanacaste',
  'Puntarenas',
  'Limón',
] as const

export type ProvinceCR = (typeof PROVINCES_CR)[number]

export const LISTING_CONDITIONS = [
  'Nuevo',
  'Como Nuevo',
  'Usado',
] as const

export type ListingCondition = (typeof LISTING_CONDITIONS)[number]

export const LISTING_SPACES = [
  'Sala',
  'Comedor',
  'Habitación',
  'Oficina - Estudio',
  'Cocina',
  'Baño',
  'Exteriores',
  'Jardín',
  'Área de Lavado',
  'Gimnasio',
  'Otros',
] as const

export type ListingSpace = (typeof LISTING_SPACES)[number]

export const LISTING_STATUSES = [
  'active',
  'sold',
  'paused',
  'pending',
] as const

export type ListingStatus = (typeof LISTING_STATUSES)[number]

export const STATUS_LABELS: Record<ListingStatus, string> = {
  active: 'Activo',
  sold: 'Vendido',
  paused: 'Pausado',
  pending: 'Pendiente',
}

export interface CategoryRecord {
  id: string
  name: string
  slug: string
  icon?: string
}

export interface UserRecord {
  id: string
  email?: string
  name?: string
  phone?: string
  province?: ProvinceCR | string
}

export interface ListingRecord {
  id: string
  collectionId: string
  collectionName: string
  title: string
  slug: string
  description: string
  price: number
  condition: ListingCondition
  space: ListingSpace
  province: ProvinceCR
  category: string
  seller: string
  images: string[]
  status: ListingStatus
  views: number
  created: string
  updated: string
  expand?: {
    category?: CategoryRecord
    seller?: UserRecord
  }
}

export interface FavoriteRecord {
  id: string
  user: string
  listing: string
  expand?: {
    listing?: ListingRecord
  }
}
