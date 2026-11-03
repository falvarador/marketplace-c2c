import PocketBase from 'pocketbase'
import { signal, computed } from '@preact/signals'
import type {
  CategoryRecord,
  FavoriteRecord,
  ListingRecord,
  UserRecord,
} from './constants'

const pbUrl =
  typeof window !== 'undefined' ? window.location.origin : 'http://127.0.0.1:8090'

export const pb = new PocketBase(pbUrl)
pb.autoCancellation(false)

// Reactive signals for Auth & Favorites & Categories
export const currentUser = signal<UserRecord | null>(
  (pb.authStore.record as unknown as UserRecord) || null,
)
export const isAuthenticated = computed(() => Boolean(currentUser.value?.id))

// Map of listingId -> favoriteRecordId for O(1) lookup and deletion
export const favoriteMap = signal<Record<string, string>>({})
export const favoriteCount = computed(
  () => Object.keys(favoriteMap.value).length,
)

export const categoriesList = signal<CategoryRecord[]>([])
export const authModalOpen = signal<boolean>(false)

// Listen to authStore changes
pb.authStore.onChange((_token, record) => {
  currentUser.value = (record as unknown as UserRecord) || null
  if (currentUser.value?.id) {
    void syncFavorites()
  } else {
    favoriteMap.value = {}
  }
})

export async function loadCategories(): Promise<CategoryRecord[]> {
  try {
    const items = await pb.collection('categories').getFullList<CategoryRecord>({
      sort: 'name',
    })
    categoriesList.value = items
    return items
  } catch (err) {
    console.error('Error cargando categorías:', err)
    return []
  }
}

export async function syncFavorites(): Promise<void> {
  const userId = currentUser.value?.id
  if (!userId) {
    favoriteMap.value = {}
    return
  }
  try {
    const records = await pb
      .collection('favorites')
      .getFullList<FavoriteRecord>({
        filter: pb.filter('user = {:userId}', { userId }),
      })
    const nextMap: Record<string, string> = {}
    for (const rec of records) {
      nextMap[rec.listing] = rec.id
    }
    favoriteMap.value = nextMap
  } catch (err) {
    console.error('Error sincronizando favoritos:', err)
  }
}

export function isListingFavorite(listingId: string): boolean {
  return Boolean(favoriteMap.value[listingId])
}

export async function toggleFavorite(listingId: string): Promise<boolean> {
  const userId = currentUser.value?.id
  if (!userId) {
    authModalOpen.value = true
    return false
  }

  const existingFavId = favoriteMap.value[listingId]
  if (existingFavId) {
    await pb.collection('favorites').delete(existingFavId)
    const copy = { ...favoriteMap.value }
    delete copy[listingId]
    favoriteMap.value = copy
    return false
  } else {
    const created = await pb.collection('favorites').create<FavoriteRecord>({
      user: userId,
      listing: listingId,
    })
    favoriteMap.value = {
      ...favoriteMap.value,
      [listingId]: created.id,
    }
    return true
  }
}

export function logout(): void {
  pb.authStore.clear()
  currentUser.value = null
  favoriteMap.value = {}
}

export function formatCRC(price: number): string {
  const rounded = Math.round(Number(price) || 0)
  return '₡' + rounded.toLocaleString('en-US')
}

export function getListingImageUrl(
  listing: Pick<ListingRecord, 'id' | 'collectionId' | 'collectionName' | 'images'>,
  index = 0,
  thumb?: '300x300f' | '800x600f',
): string {
  const fileName = listing.images?.[index]
  if (!fileName) {
    return ''
  }
  const col = listing.collectionId || listing.collectionName || 'listings'
  const base = `/api/files/${encodeURIComponent(col)}/${encodeURIComponent(listing.id)}/${encodeURIComponent(fileName)}`
  return thumb ? `${base}?thumb=${thumb}` : base
}

export function buildWhatsAppUrl(
  phone: string | undefined,
  listing: Pick<ListingRecord, 'id' | 'title' | 'slug' | 'price'>,
): string {
  const digits = (phone || '').replace(/\D+/g, '')
  const crPhone = digits.startsWith('506') && digits.length > 8 ? digits : `506${digits}`
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://mueblesusados.cr'
  const listingUrl = `${origin}/anuncio/${listing.slug || listing.id}`
  const message = `¡Hola! Me interesa este mueble publicado en Muebles Usados CR:\n*${listing.title}* (${formatCRC(listing.price)})\nRef ID: ${listing.id}\nEnlace: ${listingUrl}`
  return `https://wa.me/${crPhone}?text=${encodeURIComponent(message)}`
}

export async function incrementListingView(listingId: string): Promise<number | null> {
  try {
    const res = await fetch(`/api/listings/${encodeURIComponent(listingId)}/view`, {
      method: 'POST',
    })
    if (!res.ok) return null
    const data = (await res.json()) as { id: string; views: number }
    return data.views
  } catch {
    return null
  }
}

// Initialize favorites if session is already valid on startup
if (typeof window !== 'undefined' && pb.authStore.isValid && currentUser.value?.id) {
  void syncFavorites()
}
