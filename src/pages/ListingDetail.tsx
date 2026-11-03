import { useEffect, useState } from 'preact/hooks'
import { ListingCard } from '../components/ListingCard'
import { STATUS_LABELS, type ListingRecord } from '../lib/constants'
import {
  buildWhatsAppUrl,
  currentUser,
  formatCRC,
  getListingImageUrl,
  incrementListingView,
  isListingFavorite,
  pb,
  toggleFavorite,
} from '../lib/pb'

interface ListingDetailProps {
  id?: string
}

export function ListingDetail({ id }: ListingDetailProps) {
  const [listing, setListing] = useState<ListingRecord | null>(null)
  const [related, setRelated] = useState<ListingRecord[]>([])
  const [activeImageIdx, setActiveImageIdx] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return
    setActiveImageIdx(0)
    void loadListing(id)
  }, [id])

  const loadListing = async (idOrSlug: string) => {
    setLoading(true)
    setError('')
    try {
      let rec: ListingRecord
      try {
        rec = await pb.collection('listings').getOne<ListingRecord>(idOrSlug, {
          expand: 'category,seller',
        })
      } catch {
        rec = await pb
          .collection('listings')
          .getFirstListItem<ListingRecord>(
            pb.filter('slug = {:slug}', { slug: idOrSlug }),
            { expand: 'category,seller' },
          )
      }

      setListing(rec)

      // Increment view count atomically on backend
      const updatedViews = await incrementListingView(rec.id)
      if (updatedViews !== null) {
        setListing((prev) => (prev ? { ...prev, views: updatedViews } : prev))
      }

      // Fetch related active listings in the same category
      if (rec.category) {
        const relRes = await pb
          .collection('listings')
          .getList<ListingRecord>(1, 4, {
            filter: pb.filter(
              'status = "active" && category = {:cat} && id != {:id}',
              { cat: rec.category, id: rec.id },
            ),
            sort: '-created',
            expand: 'category,seller',
          })
        setRelated(relRes.items)
      }
    } catch (err) {
      console.error('Error cargando detalle del anuncio:', err)
      setError('No encontramos este mueble o ya no se encuentra disponible.')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div class="container section">
        <div class="loading-box">Cargando información del mueble...</div>
      </div>
    )
  }

  if (error || !listing) {
    return (
      <div class="container section">
        <div class="empty-state">
          <h2>Anuncio no disponible</h2>
          <p>{error}</p>
          <a href="/explorar" class="btn btn-primary">
            Volver al catálogo
          </a>
        </div>
      </div>
    )
  }

  const fav = isListingFavorite(listing.id)
  const isOwner = currentUser.value?.id === listing.seller
  const seller = listing.expand?.seller
  const category = listing.expand?.category
  const images = listing.images || []
  const mainImageUrl =
    images.length > 0
      ? getListingImageUrl(listing, activeImageIdx, '800x600f')
      : ''
  const whatsappHref = buildWhatsAppUrl(seller?.phone, listing)

  return (
    <div class="detail-page container section">
      <nav class="breadcrumb" aria-label="Ruta de navegación">
        <a href="/">Inicio</a>
        <span>/</span>
        <a href="/explorar">Catálogo</a>
        {category && (
          <>
            <span>/</span>
            <a href={`/explorar?categoria=${encodeURIComponent(category.id)}`}>
              {category.name}
            </a>
          </>
        )}
        <span>/</span>
        <span aria-current="page">{listing.title}</span>
      </nav>

      <div class="detail-grid">
        <div class="detail-gallery">
          <div class="detail-main-image-wrap">
            {mainImageUrl ? (
              <img
                src={mainImageUrl}
                alt={`${listing.title} - Foto ${activeImageIdx + 1}`}
                width="800"
                height="600"
                class="detail-main-image"
              />
            ) : (
              <div class="detail-no-image">
                <span>🪑</span>
                <p>Este anuncio no tiene fotografías adjuntas</p>
              </div>
            )}
            <span class="badge-condition badge-detail">{listing.condition}</span>
          </div>

          {images.length > 1 && (
            <div class="detail-thumbs" role="list" aria-label="Miniaturas del mueble">
              {images.map((_img, idx) => {
                const thumbUrl = getListingImageUrl(listing, idx, '300x300f')
                return (
                  <button
                    key={idx}
                    type="button"
                    class={`detail-thumb-btn ${idx === activeImageIdx ? 'active' : ''}`}
                    aria-label={`Ver imagen ${idx + 1}`}
                    onClick={() => setActiveImageIdx(idx)}
                  >
                    <img
                      src={thumbUrl}
                      alt={`Miniatura ${idx + 1}`}
                      width="90"
                      height="90"
                    />
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <aside class="detail-sidebar">
          <div class="detail-card">
            <div class="detail-badges-row">
              <span class="badge-pill">{category?.name || 'Mueble'}</span>
              {listing.status !== 'active' && (
                <span class={`badge-status status-${listing.status}`}>
                  {STATUS_LABELS[listing.status]}
                </span>
              )}
              <span class="detail-ref">Ref #{listing.id.slice(0, 8).toUpperCase()}</span>
            </div>

            <h1 class="detail-title">{listing.title}</h1>

            <div class="detail-price">{formatCRC(listing.price)}</div>

            <dl class="detail-specs">
              <div>
                <dt>Estado</dt>
                <dd>{listing.condition}</dd>
              </div>
              <div>
                <dt>Ubicación</dt>
                <dd>📍 {listing.province}</dd>
              </div>
              <div>
                <dt>Espacio</dt>
                <dd>🏠 {listing.space}</dd>
              </div>
              <div>
                <dt>Vistas</dt>
                <dd>👁️ {listing.views || 0} visitas</dd>
              </div>
            </dl>

            <div class="detail-actions">
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                class="btn btn-whatsapp btn-block"
              >
                💬 Contactar por WhatsApp
              </a>

              <button
                type="button"
                class={`btn btn-outline btn-block ${fav ? 'is-fav-btn' : ''}`}
                aria-pressed={fav}
                onClick={() => void toggleFavorite(listing.id)}
              >
                {fav ? '♥ Guardado en Favoritos' : '♡ Guardar en Favoritos'}
              </button>

              {isOwner && (
                <a
                  href={`/editar/${listing.id}`}
                  class="btn btn-ghost btn-block"
                >
                  ✏️ Editar mi anuncio
                </a>
              )}
            </div>

            <div class="seller-card">
              <div class="seller-avatar" aria-hidden="true">
                {(seller?.name || 'V')[0].toUpperCase()}
              </div>
              <div>
                <strong>{seller?.name || 'Vendedor verificado'}</strong>
                <p>
                  {seller?.province || listing.province} • Costa Rica
                </p>
              </div>
            </div>
          </div>
        </aside>
      </div>

      <section class="detail-description-box">
        <h2>Descripción del Mueble</h2>
        <div class="detail-description-content">
          {listing.description.split('\n').map((line, i) => (
            <p key={i}>{line.replace(/<[^>]*>/g, '')}</p>
          ))}
        </div>
      </section>

      {related.length > 0 && (
        <section class="section">
          <div class="section-header">
            <div>
              <h2>Anuncios Relacionados</h2>
              <p>Otros muebles en la misma categoría</p>
            </div>
          </div>
          <div class="listings-grid">
            {related.map((item) => (
              <ListingCard key={item.id} listing={item} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
