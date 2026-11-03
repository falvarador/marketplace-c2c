import { useEffect, useState } from 'preact/hooks'
import { ListingCard } from '../components/ListingCard'
import type { FavoriteRecord, ListingRecord } from '../lib/constants'
import {
  authModalOpen,
  currentUser,
  favoriteMap,
  isAuthenticated,
  pb,
} from '../lib/pb'

export function Favorites() {
  const loggedIn = isAuthenticated.value
  const user = currentUser.value
  const favMapVal = favoriteMap.value

  const [favoriteListings, setFavoriteListings] = useState<ListingRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!loggedIn || !user?.id) {
      setFavoriteListings([])
      setLoading(false)
      return
    }
    void fetchFavoriteListings(user.id)
  }, [loggedIn, user?.id, favMapVal])

  const fetchFavoriteListings = async (userId: string) => {
    setLoading(true)
    try {
      const records = await pb
        .collection('favorites')
        .getFullList<FavoriteRecord>({
          filter: pb.filter('user = {:userId}', { userId }),
          expand: 'listing,listing.category,listing.seller',
          sort: '-created',
        })

      const extracted: ListingRecord[] = []
      for (const rec of records) {
        if (rec.expand?.listing) {
          extracted.push(rec.expand.listing)
        }
      }
      setFavoriteListings(extracted)
    } catch (err) {
      console.error('Error cargando favoritos:', err)
    } finally {
      setLoading(false)
    }
  }

  if (!loggedIn) {
    return (
      <div class="container section">
        <div class="empty-state">
          <h2>Guardá tus muebles favoritos</h2>
          <p>Iniciá sesión para ver y administrar tus muebles guardados.</p>
          <button
            type="button"
            class="btn btn-primary"
            onClick={() => {
              authModalOpen.value = true
            }}
          >
            Iniciar Sesión
          </button>
        </div>
      </div>
    )
  }

  return (
    <div class="container section">
      <div class="section-header">
        <div>
          <h1>♥ Mis Muebles Favoritos</h1>
          <p>Anuncios que guardaste para comparar o contactar por WhatsApp</p>
        </div>
        <a href="/explorar" class="btn btn-outline">
          Seguir explorando →
        </a>
      </div>

      {loading ? (
        <div class="loading-box">Cargando tus favoritos...</div>
      ) : favoriteListings.length === 0 ? (
        <div class="empty-state">
          <h3>Aún no tenés muebles en favoritos</h3>
          <p>Tocá el corazón ♡ en cualquier anuncio para guardarlo aquí.</p>
          <a href="/explorar" class="btn btn-primary">
            Explorar Catálogo
          </a>
        </div>
      ) : (
        <div class="listings-grid">
          {favoriteListings.map((item) => (
            <ListingCard key={item.id} listing={item} />
          ))}
        </div>
      )}
    </div>
  )
}
