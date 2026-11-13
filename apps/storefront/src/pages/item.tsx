import { useEffect, useState } from "preact/hooks"
import { useLocation } from "preact-iso"
import { authState } from "../store/auth"
import { wishlistProductIds, setWishlistProductIds } from "../store/wishlist"
import { requestMarketplaceApi } from "../lib/api"
import {
  addVariantToCart,
  formatLocation,
  formatPrice,
  getProductAttributes,
  getProductByHandle,
  getProductLocation,
  getProductOffers,
  getProductPolicy,
  isOfferAvailable,
  type MarketplaceProduct,
  type ProductLocation,
} from "../lib/marketplace"

interface ProductActivity {
  message: string
  mode: "lead" | "reservation"
}

function PageRoute({ current }: { current: string }) {
  return (
    <nav class="page-route" aria-label="Ruta actual">
      <a href="/">Inicio</a>
      <span class="route-connector" aria-hidden="true" />
      <a href="/explorar">Explorar</a>
      <span class="route-connector" aria-hidden="true" />
      <span class="page-route-current" aria-current="page">{current}</span>
    </nav>
  )
}

function getAttributeValue(value: { name?: string; value?: unknown }): string {
  if (typeof value.value === "boolean") return value.value ? "Sí" : "No"
  if (typeof value.value === "string" || typeof value.value === "number") {
    return String(value.value)
  }
  return value.name ?? ""
}

export function ItemPage({ handle }: { handle?: string }) {
  const location = useLocation()
  const [product, setProduct] = useState<MarketplaceProduct | null>(null)
  const [productLocation, setProductLocation] = useState<ProductLocation | null>(null)
  const [mode, setMode] = useState<"checkout" | "lead" | null>(null)
  const [selectedVariantId, setSelectedVariantId] = useState("")
  const [activity, setActivity] = useState<ProductActivity>({
    message: "",
    mode: "lead",
  })
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!handle) return
    let active = true
    setLoading(true)
    setError(null)
    void getProductByHandle(handle)
      .then(async (result) => {
        if (!result) {
          if (active) setError("Este producto no está disponible.")
          return
        }
        const [policy, productLocationResult] = await Promise.all([
          getProductPolicy(result.id),
          getProductLocation(result.id),
        ])
        if (active) {
          setProduct(result)
          setMode(policy.transaction_mode)
          setProductLocation(productLocationResult)
          setSelectedVariantId(result.variants?.[0]?.id ?? "")
        }
      })
      .catch((requestError: unknown) => {
        if (active) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "No se pudo cargar el producto.",
          )
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [handle])

  if (loading) {
    return (
      <main class="content-page">
        <PageRoute current="Producto" />
        <p class="catalog-status" aria-live="polite">Cargando producto…</p>
      </main>
    )
  }
  if (error || !product) {
    return (
      <main class="content-page">
        <PageRoute current="Producto" />
        <div class="catalog-empty catalog-empty--error">
          <h1>No pudimos abrir este producto</h1>
          <p role="alert">{error ?? "Este producto no está disponible."}</p>
          <a class="button button--primary" href="/explorar">Volver a explorar</a>
        </div>
      </main>
    )
  }

  const item = product
  const variants = item.variants ?? []
  const selectedVariant =
    variants.find((variant) => variant.id === selectedVariantId) ?? variants[0]
  const offers = selectedVariant ? getProductOffers({
    ...item,
    variants: [selectedVariant],
  }) : []
  const selectedOffer = offers[0]
  const price = selectedOffer?.calculated_price?.calculated_amount ??
    selectedOffer?.prices?.[0]?.amount ??
    selectedVariant?.calculated_price?.calculated_amount
  const currencyCode = selectedOffer?.calculated_price?.currency_code ??
    selectedOffer?.prices?.[0]?.currency_code ??
    selectedVariant?.calculated_price?.currency_code
  const favorite = wishlistProductIds.value.includes(item.id)
  const offerAvailable = isOfferAvailable(selectedOffer)
  const available = offerAvailable
  const attributes = getProductAttributes(item)
  const seller = selectedOffer?.seller

  async function toggleFavorite() {
    if (authState.customerSession.value.status !== "authenticated") {
      location.route(`/entrar?return=${encodeURIComponent(location.url)}`)
      return
    }
    setPending(true)
    setError(null)
    try {
      if (favorite) {
        await requestMarketplaceApi(
          `/store/wishlist/items/${encodeURIComponent(item.id)}`,
          { actor: "customer", method: "DELETE" },
        )
        setWishlistProductIds(
          wishlistProductIds.value.filter((id) => id !== item.id),
        )
      } else {
        await requestMarketplaceApi("/store/wishlist", {
          actor: "customer",
          method: "POST",
          body: { product_id: item.id },
        })
        setWishlistProductIds([...wishlistProductIds.value, item.id])
      }
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No se pudo actualizar tu lista de favoritos.",
      )
    } finally {
      setPending(false)
    }
  }

  async function submitProductActivity(event: Event) {
    event.preventDefault()
    if (authState.customerSession.value.status !== "authenticated") {
      location.route(`/entrar?return=${encodeURIComponent(location.url)}`)
      return
    }
    if (activity.mode === "reservation" && !selectedVariant) {
      setError("Selecciona una variante disponible para solicitar la reserva.")
      return
    }
    setPending(true)
    setError(null)
    setNotice(null)
    try {
      if (activity.mode === "lead") {
        await requestMarketplaceApi("/store/leads", {
          actor: "customer",
          method: "POST",
          body: {
            product_id: item.id,
            ...(activity.message.trim() ? { message: activity.message.trim() } : {}),
          },
        })
        setNotice("Tu consulta se envió al vendedor.")
      } else {
        await requestMarketplaceApi("/store/reservation-requests", {
          actor: "customer",
          method: "POST",
          body: {
            product_id: item.id,
            variant_id: selectedVariant.id,
            ...(activity.message.trim() ? { message: activity.message.trim() } : {}),
          },
        })
        setNotice("Tu solicitud quedó pendiente de confirmación del vendedor.")
      }
      setActivity((current) => ({ ...current, message: "" }))
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No se pudo enviar la solicitud.",
      )
    } finally {
      setPending(false)
    }
  }

  async function addToCart() {
    if (!selectedVariant || !available) return
    setPending(true)
    setError(null)
    setNotice(null)
    try {
      if (!selectedOffer) {
        throw new Error("No hay una oferta disponible para este producto.")
      }
      await addVariantToCart(selectedVariant.id, selectedOffer.id)
      setNotice("El producto se agregó al carrito.")
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No se pudo agregar el producto al carrito.",
      )
    } finally {
      setPending(false)
    }
  }

  return (
    <main class="content-page">
      <PageRoute current={item.title} />
      <div class="item-layout">
        <section class="item-gallery" aria-label="Imágenes del producto">
          {(product.images?.length ? product.images : product.thumbnail
            ? [{ url: product.thumbnail }]
            : []
          ).map((image) => (
          <img src={image.url} alt={item.title} key={image.url} />
          ))}
          {!product.images?.length && !product.thumbnail && (
            <div class="item-image-empty">Sin imágenes disponibles</div>
          )}
        </section>
        <section class="item-summary">
          <div class="route-label">
            <span class="route-node route-node--blue" aria-hidden="true" />
            <span>{item.categories?.[0]?.name ?? "Marketplace"}</span>
          </div>
          <h1>{item.title}</h1>
          {item.subtitle && <p class="item-subtitle">{item.subtitle}</p>}
          {typeof price === "number" && currencyCode && (
            <p class="item-price">{formatPrice(price, currencyCode)}</p>
          )}
          {variants.length > 1 && (
            <label class="field">
              <span>Variante</span>
              <select
                value={selectedVariantId}
                onChange={(event) => setSelectedVariantId(event.currentTarget.value)}
              >
                {variants.map((variant) => (
                  <option value={variant.id} key={variant.id}>{variant.title}</option>
                ))}
              </select>
            </label>
          )}
          <div class="item-seller">
            <span class="route-node route-node--lime" aria-hidden="true" />
            <div>
              <strong>{seller?.name ?? "Vendedor independiente"}</strong>
              <span>{formatLocation(productLocation)}</span>
            </div>
          </div>
          {selectedOffer?.inventory_quantity !== undefined && (
            <p class="availability-note">
              {offerAvailable
                ? `${selectedOffer.inventory_quantity} disponibles`
                : "No disponible por el momento"}
            </p>
          )}
          <button
            class={`button ${mode === "lead" ? "button--seller" : "button--primary"} button--full`}
            type="button"
            disabled={pending || !available}
            onClick={() => {
              if (mode === "checkout") void addToCart()
              else setActivity((current) => ({ ...current, mode: "lead" }))
            }}
          >
            {pending
              ? "Procesando…"
              : !available
                ? "No disponible"
                : mode === "checkout"
                  ? "Agregar al carrito"
                  : "Contactar al vendedor"}
          </button>
          {mode === "lead" && (
            <form class="item-request-form" onSubmit={submitProductActivity}>
              <label class="field">
                <span>Tu consulta (opcional)</span>
                <textarea
                  rows={4}
                  maxLength={2000}
                  value={activity.message}
                  onInput={(event) =>
                    setActivity({ mode: "lead", message: event.currentTarget.value })
                  }
                />
              </label>
              <button
                class="button button--quiet button--full"
                type="submit"
                disabled={pending || !available}
              >
                Enviar consulta
              </button>
              {selectedOffer?.inventory_quantity === 1 && (
                <button
                  class="text-button item-reserve-link"
                  type="button"
                  onClick={() => setActivity((current) => ({
                    ...current,
                    mode: "reservation",
                  }))}
                >
                  Solicitar reserva pendiente de confirmación
                </button>
              )}
            </form>
          )}
          {activity.mode === "reservation" && mode === "lead" && (
            <form class="item-request-form" onSubmit={submitProductActivity}>
              <label class="field">
                <span>Mensaje para el vendedor (opcional)</span>
                <textarea
                  rows={3}
                  maxLength={2000}
                  value={activity.message}
                  onInput={(event) =>
                    setActivity({
                      mode: "reservation",
                      message: event.currentTarget.value,
                    })
                  }
                />
              </label>
              <button
                class="button button--seller button--full"
                type="submit"
                disabled={pending || !available}
              >
                Solicitar reserva
              </button>
              <button
                class="text-button"
                type="button"
                onClick={() => setActivity({ mode: "lead", message: "" })}
              >
                Volver a contactar al vendedor
              </button>
            </form>
          )}
          <button
            class="favorite-toggle"
            type="button"
            aria-pressed={favorite}
            disabled={pending}
            onClick={() => void toggleFavorite()}
          >
            {favorite ? "♥ Guardado en favoritos" : "♡ Guardar en favoritos"}
          </button>
          {notice && <p class="success-note" role="status">{notice}</p>}
          {error && <p class="form-error" role="alert">{error}</p>}
          {mode === "lead" && authState.customerSession.value.status !== "authenticated" && (
            <p class="form-footnote">
              Para contactar o reservar, inicia sesión como comprador.
            </p>
          )}
        </section>
      </div>
      <section class="item-description">
        <h2>Descripción</h2>
        <p>{item.description || "El vendedor no ha agregado una descripción."}</p>
      </section>
      {attributes.length > 0 && (
        <section class="item-specifications">
          <h2>Especificaciones</h2>
          <dl>
            {attributes.map((attribute) => (
              <div key={`${attribute.attribute_id ?? ""}-${attribute.id ?? attribute.name}`}>
                <dt>{attribute.attribute?.name ?? attribute.name ?? "Detalle"}</dt>
                <dd>{getAttributeValue(attribute)}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
    </main>
  )
}
