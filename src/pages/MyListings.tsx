import { useEffect, useState } from 'preact/hooks'
import {
  STATUS_LABELS,
  type ListingRecord,
  type ListingStatus,
} from '../lib/constants'
import {
  authModalOpen,
  currentUser,
  formatCRC,
  getListingImageUrl,
  isAuthenticated,
  pb,
} from '../lib/pb'

export function MyListings() {
  const loggedIn = isAuthenticated.value
  const user = currentUser.value

  const [listings, setListings] = useState<ListingRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    if (!loggedIn || !user?.id) {
      setListings([])
      setLoading(false)
      return
    }
    void fetchMyListings(user.id)
  }, [loggedIn, user?.id])

  const fetchMyListings = async (sellerId: string) => {
    setLoading(true)
    try {
      const items = await pb.collection('listings').getFullList<ListingRecord>({
        filter: pb.filter('seller = {:sellerId}', { sellerId }),
        sort: '-created',
        expand: 'category',
      })
      setListings(items)
    } catch (err) {
      console.error('Error cargando mis anuncios:', err)
    } finally {
      setLoading(false)
    }
  }

  const updateListingStatus = async (
    listingId: string,
    nextStatus: ListingStatus,
  ) => {
    setBusyId(listingId)
    try {
      const updated = await pb
        .collection('listings')
        .update<ListingRecord>(listingId, { status: nextStatus })
      setListings((prev) =>
        prev.map((item) =>
          item.id === listingId ? { ...item, status: updated.status } : item,
        ),
      )
    } catch (err) {
      console.error('Error actualizando estado:', err)
    } finally {
      setBusyId(null)
    }
  }

  const deleteListing = async (listingId: string) => {
    setBusyId(listingId)
    try {
      await pb.collection('listings').delete(listingId)
      setListings((prev) => prev.filter((item) => item.id !== listingId))
    } catch (err) {
      console.error('Error eliminando anuncio:', err)
    } finally {
      setBusyId(null)
    }
  }

  if (!loggedIn) {
    return (
      <div class="container section">
        <div class="empty-state">
          <h2>Iniciá sesión para administrar tus anuncios</h2>
          <p>Desde aquí podés marcar muebles como vendidos, pausarlos o editarlos.</p>
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
          <h1>Mis Anuncios Publicados</h1>
          <p>Gestioná el estado de tus muebles en venta</p>
        </div>
        <a href="/anunciar" class="btn btn-primary">
          + Publicar Nuevo Mueble
        </a>
      </div>

      {loading ? (
        <div class="loading-box">Cargando tus anuncios...</div>
      ) : listings.length === 0 ? (
        <div class="empty-state">
          <h3>Todavía no has publicado ningún mueble</h3>
          <p>Publicá gratis tus muebles en menos de 2 minutos.</p>
          <a href="/anunciar" class="btn btn-primary">
            + Publicar mi primer mueble
          </a>
        </div>
      ) : (
        <div class="my-listings-list">
          {listings.map((item) => {
            const thumb = getListingImageUrl(item, 0, '300x300f')
            const isBusy = busyId === item.id
            return (
              <div key={item.id} class="my-listing-row">
                <div class="my-listing-media">
                  {thumb ? (
                    <img src={thumb} alt={item.title} width="100" height="100" />
                  ) : (
                    <div class="my-listing-placeholder">🪑</div>
                  )}
                </div>

                <div class="my-listing-info">
                  <div class="my-listing-badges">
                    <span class={`badge-status status-${item.status}`}>
                      {STATUS_LABELS[item.status]}
                    </span>
                    <span class="listing-ref">#{item.id.slice(0, 7).toUpperCase()}</span>
                    <span>👁️ {item.views || 0} vistas</span>
                  </div>
                  <h3>
                    <a href={`/anuncio/${item.slug || item.id}`}>{item.title}</a>
                  </h3>
                  <p class="my-listing-meta">
                    <strong>{formatCRC(item.price)}</strong> • {item.condition} • 📍{' '}
                    {item.province}
                  </p>
                </div>

                <div class="my-listing-actions">
                  {item.status !== 'sold' && (
                    <button
                      type="button"
                      class="btn btn-sm btn-success"
                      disabled={isBusy}
                      onClick={() => void updateListingStatus(item.id, 'sold')}
                    >
                      ✓ Marcar Vendido
                    </button>
                  )}

                  {item.status === 'active' ? (
                    <button
                      type="button"
                      class="btn btn-sm btn-outline"
                      disabled={isBusy}
                      onClick={() => void updateListingStatus(item.id, 'paused')}
                    >
                      ⏸ Pausar
                    </button>
                  ) : (
                    <button
                      type="button"
                      class="btn btn-sm btn-outline"
                      disabled={isBusy}
                      onClick={() => void updateListingStatus(item.id, 'active')}
                    >
                      ▶ Reactivar
                    </button>
                  )}

                  <a href={`/editar/${item.id}`} class="btn btn-sm btn-ghost">
                    ✏️ Editar
                  </a>

                  <button
                    type="button"
                    class="btn btn-sm btn-danger"
                    disabled={isBusy}
                    onClick={() => void deleteListing(item.id)}
                  >
                    🗑 Eliminar
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
