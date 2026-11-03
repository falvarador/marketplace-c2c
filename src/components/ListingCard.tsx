import type { ListingRecord } from '../lib/constants'
import {
  formatCRC,
  getListingImageUrl,
  isListingFavorite,
  toggleFavorite,
} from '../lib/pb'

interface ListingCardProps {
  listing: ListingRecord
}

function getConditionBadgeClass(condition: string): string {
  switch (condition) {
    case 'Nuevo':
      return 'badge-condition badge-nuevo'
    case 'Como Nuevo':
      return 'badge-condition badge-como-nuevo'
    default:
      return 'badge-condition badge-usado'
  }
}

export function ListingCard({ listing }: ListingCardProps) {
  const thumbUrl = getListingImageUrl(listing, 0, '300x300f')
  const fav = isListingFavorite(listing.id)
  const categoryName = listing.expand?.category?.name || 'Mueble'
  const detailHref = `/anuncio/${listing.slug || listing.id}`
  const shortId = listing.id.slice(0, 7).toUpperCase()

  return (
    <article class="listing-card">
      <div class="listing-card-media">
        <a href={detailHref} class="listing-card-img-link" aria-label={listing.title}>
          {thumbUrl ? (
            <img
              src={thumbUrl}
              alt={listing.title}
              loading="lazy"
              width="300"
              height="300"
              class="listing-card-img"
            />
          ) : (
            <div class="listing-card-placeholder" aria-hidden="true">
              <span>🪑</span>
              <small>Sin foto</small>
            </div>
          )}
        </a>

        <span class={getConditionBadgeClass(listing.condition)}>
          {listing.condition}
        </span>

        <button
          type="button"
          class={`fav-toggle-btn ${fav ? 'is-fav' : ''}`}
          aria-label={fav ? 'Quitar de favoritos' : 'Guardar en favoritos'}
          aria-pressed={fav}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            void toggleFavorite(listing.id)
          }}
        >
          {fav ? '♥' : '♡'}
        </button>
      </div>

      <div class="listing-card-body">
        <div class="listing-card-meta">
          <span class="listing-category">{categoryName}</span>
          <span class="listing-ref" title={`ID: ${listing.id}`}>
            #{shortId}
          </span>
        </div>

        <h3 class="listing-card-title">
          <a href={detailHref}>{listing.title}</a>
        </h3>

        <div class="listing-card-location">
          <span>📍 {listing.province}</span>
          <span>• {listing.space}</span>
        </div>

        <div class="listing-card-footer">
          <span class="listing-price">{formatCRC(listing.price)}</span>
          <a href={detailHref} class="listing-link-btn">
            Ver detalle →
          </a>
        </div>
      </div>
    </article>
  )
}
