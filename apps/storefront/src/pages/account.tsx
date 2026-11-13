import { useEffect, useState } from "preact/hooks"
import { authState } from "../store/auth"
import { wishlistProductIds, setWishlistProductIds } from "../store/wishlist"
import { requestMarketplaceApi } from "../lib/api"
import {
  formatPrice,
  getProductById,
  getProductOffers,
  getProductPrice,
  type MarketplaceProduct,
} from "../lib/marketplace"

interface BuyerLead {
  id: string
  product_id: string
  seller_id: string
  message?: string | null
  status: string
  created_at: string
}

interface BuyerReservation {
  id: string
  product_id: string
  variant_id: string
  seller_id: string
  message?: string | null
  status: string
  created_at: string
}

interface BuyerOrderGroup {
  id: string
  display_id?: number
  status?: string
  created_at?: string
  orders?: Array<{ id: string; display_id?: number; status?: string }>
}

interface BuyerSellerOrderPayment {
  id: string
  display_id?: number
  total?: number
  currency_code?: string
  seller_name: string
  whatsapp_number?: string | null
  payment_status: "pending" | "confirmed"
}

function PageRoute({ current }: { current: string }) {
  return (
    <nav class="page-route" aria-label="Ruta actual">
      <a href="/">Inicio</a>
      <span class="route-connector" aria-hidden="true" />
      <span class="page-route-current" aria-current="page">{current}</span>
    </nav>
  )
}

function BuyerGate({ children }: { children: preact.ComponentChildren }) {
  if (authState.customerSession.value.status === "restoring") {
    return (
      <main class="content-page">
        <PageRoute current="Mi cuenta" />
        <p class="catalog-status" aria-live="polite">Cargando tu sesión…</p>
      </main>
    )
  }
  if (authState.customerSession.value.status !== "authenticated") {
    return (
      <main class="content-page">
        <PageRoute current="Acceso" />
        <section class="access-gate">
          <h1>Inicia sesión para ver esta ruta</h1>
          <a class="button button--primary" href="/entrar">Acceder como comprador</a>
        </section>
      </main>
    )
  }
  return <>{children}</>
}

export function AccountPage() {
  const [orders, setOrders] = useState<BuyerOrderGroup[]>([])
  const [sellerPayments, setSellerPayments] = useState<
    Record<string, BuyerSellerOrderPayment[]>
  >({})
  const [leads, setLeads] = useState<BuyerLead[]>([])
  const [reservations, setReservations] = useState<BuyerReservation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void Promise.all([
      requestMarketplaceApi<{ order_groups: BuyerOrderGroup[] }>(
        "/store/order-groups?fields=id,display_id,status,created_at,orders.id,orders.display_id,orders.status",
        { actor: "customer" },
      ),
      requestMarketplaceApi<{ leads: BuyerLead[] }>("/store/leads", {
        actor: "customer",
      }),
      requestMarketplaceApi<{ reservation_requests: BuyerReservation[] }>(
        "/store/reservation-requests",
        { actor: "customer" },
      ),
    ])
      .then(async ([orderResult, leadResult, reservationResult]) => {
        if (!active) return
        const orderGroups = orderResult.order_groups ?? []
      setOrders(orderGroups)
      setLeads(leadResult.leads ?? [])
      setReservations(reservationResult.reservation_requests ?? [])
      const paymentResults = await Promise.allSettled(
          orderGroups.map(async (order) => {
            const { seller_orders } = await requestMarketplaceApi<{
              seller_orders: BuyerSellerOrderPayment[]
            }>(
              `/store/order-groups/${encodeURIComponent(order.id)}/external-payments`,
              { actor: "customer" },
            )
            return [order.id, seller_orders] as const
          }),
        )
        if (!active) return
        const successfulPayments = paymentResults.flatMap((result) =>
          result.status === "fulfilled" ? [result.value] : [],
        )
        setSellerPayments(Object.fromEntries(successfulPayments))
        const paymentFailure = paymentResults.find(
          (result) => result.status === "rejected",
        )
        if (paymentFailure?.status === "rejected") {
          setError(
            paymentFailure.reason instanceof Error
              ? `No se pudieron cargar los datos de pago de uno o más pedidos: ${paymentFailure.reason.message}`
              : "No se pudieron cargar los datos de pago de uno o más pedidos.",
          )
        }
      })
      .catch((requestError: unknown) => {
        if (active) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "No se pudo cargar tu actividad.",
          )
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  return (
    <BuyerGate>
      <main class="content-page">
        <PageRoute current="Mi cuenta" />
        <section class="account-overview">
          <div class="route-label">
            <span class="route-node route-node--blue" aria-hidden="true" />
            <span>Tu actividad</span>
          </div>
          <h1>Tu cuenta</h1>
          <p class="page-lede">
            Pedidos, consultas y reservas asociados a tu sesión de comprador.
          </p>
          <p class="account-identity">
            Sesión de comprador: {authState.customerSession.value.email}
          </p>
          {loading && <p class="catalog-status">Cargando tu actividad…</p>}
          {error && <p class="form-error" role="alert">{error}</p>}
          <section class="activity-section">
            <h2>Pedidos</h2>
            {!loading && orders.length === 0 && (
              <p class="empty-note">Todavía no tienes pedidos.</p>
            )}
            {orders.map((order) => (
              <article class="activity-row" key={order.id}>
                <span class="route-node route-node--blue" aria-hidden="true" />
                <div>
                  <strong>
                    Pedido {order.display_id ? `#${order.display_id}` : order.id}
                  </strong>
                  <span>{order.status ?? "En proceso"}</span>
                </div>
                <small>{order.orders?.length ?? 0} pedidos de vendedor</small>
                {sellerPayments[order.id]?.map((payment) => {
                  const reference = payment.display_id
                    ? `#${payment.display_id}`
                    : payment.id
                  const message = `Hola ${payment.seller_name}, te contacto por el pedido ${reference} para coordinar el pago SINPE de ${
                    typeof payment.total === "number" && payment.currency_code
                      ? formatPrice(payment.total, payment.currency_code)
                      : "mi compra"
                  }.`
                  const href = payment.whatsapp_number
                    ? `https://wa.me/${payment.whatsapp_number}?text=${encodeURIComponent(message)}`
                    : null
                  return (
                    <div class="activity-payment" key={payment.id}>
                      <span>
                        {payment.seller_name} · Pedido {reference} ·{" "}
                        {payment.payment_status === "confirmed"
                          ? "SINPE confirmado"
                          : "SINPE pendiente"}
                      </span>
                      {href && payment.payment_status === "pending" && (
                        <a
                          class="text-link"
                          href={href}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Coordinar pago por WhatsApp
                        </a>
                      )}
                    </div>
                  )
                })}
              </article>
            ))}
          </section>
          <section class="activity-section">
            <h2>Consultas</h2>
            {!loading && leads.length === 0 && (
              <p class="empty-note">Aún no has contactado a ningún vendedor.</p>
            )}
            {leads.map((lead) => (
              <article class="activity-row" key={lead.id}>
                <span class="route-node route-node--blue" aria-hidden="true" />
                <div>
                  <strong>Consulta a vendedor</strong>
                  <span>Producto {lead.product_id} · {lead.status}</span>
                </div>
                <small>{new Date(lead.created_at).toLocaleDateString()}</small>
              </article>
            ))}
          </section>
          <section class="activity-section">
            <h2>Reservas</h2>
            {!loading && reservations.length === 0 && (
              <p class="empty-note">No tienes solicitudes de reserva.</p>
            )}
            {reservations.map((reservation) => (
              <article class="activity-row" key={reservation.id}>
                <span class="route-node route-node--lime" aria-hidden="true" />
                <div>
                  <strong>Solicitud de reserva</strong>
                  <span>Producto {reservation.product_id} · {reservation.status}</span>
                </div>
                <span>{new Date(reservation.created_at).toLocaleDateString()}</span>
              </article>
            ))}
          </section>
          <div class="account-links">
            <a class="text-link" href="/favoritos">Ver favoritos →</a>
            <a class="text-link" href="/explorar">Volver a explorar →</a>
          </div>
        </section>
      </main>
    </BuyerGate>
  )
}

export function WishlistPage() {
  const [products, setProducts] = useState<MarketplaceProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void requestMarketplaceApi<{
      wishlist_items: Array<{ product_id: string }>
    }>("/store/wishlist", { actor: "customer" })
      .then(async ({ wishlist_items }) => {
        const ids = wishlist_items.map((item) => item.product_id)
        if (active) setWishlistProductIds(ids)
        const results = await Promise.all(ids.map(getProductById))
        if (active) setProducts(
          results.filter((product): product is MarketplaceProduct => product !== null),
        )
      })
      .catch((requestError: unknown) => {
        if (active) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "No se pudo cargar tu lista de favoritos.",
          )
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  async function remove(productId: string) {
    setError(null)
    try {
      await requestMarketplaceApi(
        `/store/wishlist/items/${encodeURIComponent(productId)}`,
        { actor: "customer", method: "DELETE" },
      )
      setProducts((current) => current.filter((product) => product.id !== productId))
      setWishlistProductIds(
        wishlistProductIds.value.filter((id) => id !== productId),
      )
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No se pudo quitar el producto de favoritos.",
      )
    }
  }

  return (
    <BuyerGate>
      <main class="content-page">
        <PageRoute current="Favoritos" />
        <div class="catalog-heading">
          <div>
            <div class="route-label">
              <span class="route-node route-node--blue" aria-hidden="true" />
              <span>Tu colección</span>
            </div>
            <h1>Tus favoritos</h1>
            <p class="page-lede">
              Productos guardados en tu lista privada de comprador.
            </p>
          </div>
          <span class="catalog-count">{products.length} guardados</span>
        </div>
        {error && <p class="form-error" role="alert">{error}</p>}
        {loading ? (
          <p class="catalog-status">Cargando favoritos…</p>
        ) : products.length ? (
          <div class="product-grid">
            {products.map((product) => {
              const offer = getProductOffers(product)[0]
              const price = getProductPrice(product)
              return (
                <article class="product-card" key={product.id}>
                  <a
                    class="product-card-link"
                    href={`/item/${encodeURIComponent(product.handle)}`}
                  >
                    <div class="product-card-image">
                      {product.thumbnail
                        ? <img src={product.thumbnail} alt="" loading="lazy" />
                        : <span>Sin imagen</span>}
                    </div>
                    <div class="product-card-body">
                      <div class="product-card-meta">
                        <span>{product.categories?.[0]?.name ?? "Marketplace"}</span>
                        <span>{offer?.seller?.name ?? "Vendedor independiente"}</span>
                      </div>
                      <h2>{product.title}</h2>
                      <strong class="product-card-price">
                        {price
                          ? formatPrice(price.amount, price.currencyCode)
                          : "Consultar precio"}
                      </strong>
                    </div>
                  </a>
                  <button
                    class="text-button wishlist-remove"
                    type="button"
                    onClick={() => void remove(product.id)}
                  >
                    Quitar de favoritos
                  </button>
                </article>
              )
            })}
          </div>
        ) : (
          <div class="catalog-empty">
            <h2>Aún no guardaste productos</h2>
            <p>Guarda artículos mientras exploras y los encontrarás aquí.</p>
            <a class="button button--primary" href="/explorar">Explorar productos</a>
          </div>
        )}
      </main>
    </BuyerGate>
  )
}
