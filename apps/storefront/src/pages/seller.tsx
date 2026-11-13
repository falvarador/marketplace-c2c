import { useEffect, useState } from "preact/hooks"
import { useLocation } from "preact-iso"
import type { ComponentChildren } from "preact"
import { authState } from "../store/auth"
import { requestMarketplaceApi } from "../lib/api"
import {
  flattenCategories,
  getCategoryAttributes,
  getCategoryTransactionMode,
  getProductCategories,
  normalizeWhatsAppPhone,
  type ProductAttributeDefinition,
  type ProductCategory,
} from "../lib/marketplace"

interface SellerOffer {
  id: string
  variant_id?: string
  sku?: string
  prices?: Array<{
    id?: string
    amount: number
    currency_code: string
    min_quantity?: number | null
    max_quantity?: number | null
    rules?: Record<string, string>
  }>
  inventory_quantity?: number
  inventory_item_link?: Array<{
    inventory_item_id?: string
    inventory_item?: {
      id: string
      location_levels?: Array<{
        id: string
        location_id: string
        stocked_quantity: number
      }>
    }
  }> | {
    inventory_item_id?: string
    inventory_item?: {
      id: string
      location_levels?: Array<{
        id: string
        location_id: string
        stocked_quantity: number
      }>
    }
  }
}

interface SellerProduct {
  id: string
  title: string
  handle?: string
  status: string
  description?: string | null
  thumbnail?: string | null
  images?: Array<{ id?: string; url: string }>
  categories?: ProductCategory[]
  scoped_attributes?: Array<{
    id: string
    type?: ProductAttributeDefinition["type"]
    values?: Array<{ id: string; name: string }>
  }>
  variants?: Array<{
    id: string
    title: string
    sku?: string | null
    options?: Record<string, string>
    offers?: SellerOffer[]
  }>
}

interface SellerLead {
  id: string
  product_id: string
  message?: string | null
  status: string
  created_at: string
}

interface SellerReservation {
  id: string
  product_id: string
  variant_id: string
  message?: string | null
  status: string
  created_at: string
}

interface SellerOrder {
  id: string
  display_id?: number
  status?: string
  fulfillment_status?: string
  created_at?: string
  metadata?: Record<string, unknown> | null
  payment_collections?: Array<{
    payment_sessions?: Array<{ provider_id?: string }>
  }>
  cart?: {
    payment_collection?: {
      payment_sessions?: Array<{ provider_id?: string }>
    } | null
  } | null
  items?: Array<{
    id: string
    title?: string
    quantity: number
    requires_shipping?: boolean
  }>
}

const externalSinpeProviderId = "pp_external_sinpe_external_sinpe"

function isExternalSinpeOrder(order: SellerOrder): boolean {
  const sessions = [
    ...(order.payment_collections ?? []).flatMap(
      (collection) => collection.payment_sessions ?? [],
    ),
    ...(order.cart?.payment_collection?.payment_sessions ?? []),
  ]
  return sessions.some(
    (session) => session.provider_id === externalSinpeProviderId,
  )
}

interface SellerResources {
  categories: ProductCategory[]
  regions: Array<{ id: string; name: string; currency_code: string }>
  stockLocations: Array<{ id: string; name: string }>
  shippingProfiles: Array<{ id: string; name: string }>
}

interface ProductFormState {
  title: string
  description: string
  categoryId: string
  variants: ProductVariantForm[]
  countryCode: string
  region: string
  locality: string
  attributeValues: Record<string, string | string[]>
  imageUrls: string[]
}

interface ExistingOffer {
  id: string
  prices: NonNullable<SellerOffer["prices"]>
  inventoryItemId: string | null
  locationLevels: Array<{
    id: string
    location_id: string
    stocked_quantity: number
  }>
}

interface ProductVariantForm {
  id?: string
  title: string
  price: string
  quantity: string
  sku: string
  options?: Record<string, string>
  offer?: ExistingOffer | null
}

function toExistingOffer(offer: SellerOffer): ExistingOffer {
  const links = offer.inventory_item_link
  const link = Array.isArray(links) ? links[0] : links
  return {
    id: offer.id,
    prices: offer.prices ?? [],
    inventoryItemId: link?.inventory_item?.id ?? link?.inventory_item_id ?? null,
    locationLevels: link?.inventory_item?.location_levels ?? [],
  }
}

const emptyForm: ProductFormState = {
  title: "",
  description: "",
  categoryId: "",
  variants: [{ title: "Único", price: "", quantity: "1", sku: "" }],
  countryCode: "",
  region: "",
  locality: "",
  attributeValues: {},
  imageUrls: [],
}

function PageRoute({ current }: { current: string }) {
  return (
    <nav class="page-route" aria-label="Ruta actual">
      <a href="/">Inicio</a>
      <span class="route-connector" aria-hidden="true" />
      <a href="/vendedor">Vendedor</a>
      <span class="route-connector" aria-hidden="true" />
      <span class="page-route-current" aria-current="page">{current}</span>
    </nav>
  )
}

function SellerGate({ children }: { children: ComponentChildren }) {
  const memberStatus = authState.memberSession.value.status
  const selectedSellerId = authState.selectedSellerId.value
  const membership = authState.sellerMemberships.value.find(
    (item) => item.sellerId === selectedSellerId,
  )

  if (memberStatus === "restoring") {
    return (
      <main class="content-page">
        <PageRoute current="Espacio de vendedor" />
        <p class="catalog-status" aria-live="polite">Cargando tu sesión de vendedor…</p>
      </main>
    )
  }
  if (memberStatus !== "authenticated") {
    return (
      <main class="content-page">
        <PageRoute current="Acceso" />
        <section class="access-gate">
          <h1>Accede a tu espacio de vendedor</h1>
          <a class="button button--primary" href="/vendedor/entrar">Iniciar sesión</a>
        </section>
      </main>
    )
  }
  if (!membership) {
    return (
      <main class="content-page">
        <PageRoute current="Seleccionar tienda" />
        <section class="access-gate">
          <h1>Selecciona una tienda para continuar</h1>
          <a class="button button--primary" href="/vendedor/seleccionar">
            Elegir tienda
          </a>
        </section>
      </main>
    )
  }
  return <>{children}</>
}

export function SellerPage() {
  const location = useLocation()
  return (
    <SellerGate>
      <SellerWorkspace pathname={location.path} />
    </SellerGate>
  )
}

function SellerWorkspace({ pathname }: { pathname: string }) {
  const location = useLocation()
  const sellerId = authState.selectedSellerId.value
  const membership = authState.sellerMemberships.value.find(
    (item) => item.sellerId === sellerId,
  )
  const [products, setProducts] = useState<SellerProduct[]>([])
  const [leads, setLeads] = useState<SellerLead[]>([])
  const [reservations, setReservations] = useState<SellerReservation[]>([])
  const [orders, setOrders] = useState<SellerOrder[]>([])
  const [stockLocationId, setStockLocationId] = useState<string | null>(null)
  const [fulfillmentPendingOrderId, setFulfillmentPendingOrderId] =
    useState<string | null>(null)
  const [fulfillmentCreatedOrderIds, setFulfillmentCreatedOrderIds] =
    useState<string[]>([])
  const [paymentConfirmationOrderId, setPaymentConfirmationOrderId] =
    useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const editMatch = pathname.match(/^\/vendedor\/productos\/([^/]+)$/)
  const editingId = editMatch?.[1] && editMatch[1] !== "nuevo"
    ? decodeURIComponent(editMatch[1])
    : undefined
  const isNewProduct = pathname === "/vendedor/productos/nuevo"

  useEffect(() => {
    if (membership?.status !== "active") return
    let active = true
    setLoading(true)
    setError(null)
    void Promise.all([
      requestMarketplaceApi<{ products: SellerProduct[] }>(
        "/vendor/products?fields=id,title,handle,status,thumbnail,variants.id,variants.title,variants.offers.id,variants.offers.sku,variants.offers.prices.amount,variants.offers.prices.currency_code,variants.offers.inventory_quantity&limit=100",
        { actor: "member" },
      ),
      requestMarketplaceApi<{ leads: SellerLead[] }>("/vendor/leads", {
        actor: "member",
      }),
      requestMarketplaceApi<{ reservation_requests: SellerReservation[] }>(
        "/vendor/reservation-requests",
        { actor: "member" },
      ),
      requestMarketplaceApi<{ orders: SellerOrder[] }>(
        "/vendor/orders?fields=id,display_id,status,fulfillment_status,created_at,metadata,cart.payment_collection.payment_sessions.provider_id,items.id,items.title,items.quantity,items.requires_shipping&limit=100",
        { actor: "member" },
      ),
      requestMarketplaceApi<{
        stock_locations: SellerResources["stockLocations"]
      }>("/vendor/stock-locations?fields=id,name&limit=1", { actor: "member" }),
    ])
      .then(([productResult, leadResult, reservationResult, orderResult, locations]) => {
        if (!active) return
        setProducts(productResult.products ?? [])
        setLeads(leadResult.leads ?? [])
        setReservations(reservationResult.reservation_requests ?? [])
        setOrders(orderResult.orders ?? [])
        setStockLocationId(locations.stock_locations?.[0]?.id ?? null)
      })
      .catch((requestError: unknown) => {
        if (active) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "No se pudo cargar el espacio de vendedor.",
          )
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [sellerId, membership?.status])

  async function decideReservation(id: string, status: "confirmed" | "declined") {
    setError(null)
    try {
      const { reservation_request: updated } =
        await requestMarketplaceApi<{ reservation_request: SellerReservation }>(
          `/vendor/reservation-requests/${encodeURIComponent(id)}/decision`,
          { actor: "member", method: "POST", body: { status } },
        )
      setReservations((current) =>
        current.map((request) => request.id === id ? updated : request),
      )
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No se pudo actualizar la solicitud.",
      )
    }
  }

  async function createOrderFulfillment(order: SellerOrder) {
    const items = (order.items ?? [])
      .filter((item) => item.requires_shipping !== false)
      .map(({ id, quantity }) => ({ id, quantity }))
    if (!stockLocationId || items.length === 0) return
    setFulfillmentPendingOrderId(order.id)
    setError(null)
    setNotice(null)
    try {
      await requestMarketplaceApi(
        `/vendor/orders/${encodeURIComponent(order.id)}/fulfillments`,
        {
          actor: "member",
          method: "POST",
          body: {
            items,
            requires_shipping: true,
            location_id: stockLocationId,
          },
        },
      )
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No se pudo crear el fulfillment.",
      )
      setFulfillmentPendingOrderId(null)
      return
    }

    setFulfillmentCreatedOrderIds((current) =>
      current.includes(order.id) ? current : [...current, order.id],
    )
    setNotice("El fulfillment se creó correctamente.")
    try {
      const { order: updatedOrder } = await requestMarketplaceApi<{
        order: SellerOrder
      }>(
        `/vendor/orders/${encodeURIComponent(order.id)}?fields=id,display_id,status,fulfillment_status,created_at,items.id,items.title,items.quantity,items.requires_shipping`,
        { actor: "member" },
      )
      setOrders((current) =>
        current.map((item) => item.id === order.id ? updatedOrder : item),
      )
    } catch (requestError) {
      setError(
        `El fulfillment se creó, pero no se pudo actualizar el pedido. Recarga para consultar el estado. ${
          requestError instanceof Error
            ? requestError.message
            : ""
        }`.trim(),
      )
    } finally {
      setFulfillmentPendingOrderId(null)
    }
  }

  async function confirmExternalPayment(order: SellerOrder) {
    setPaymentConfirmationOrderId(order.id)
    setError(null)
    setNotice(null)
    try {
      await requestMarketplaceApi(
        `/vendor/orders/${encodeURIComponent(order.id)}/external-payment-confirmation`,
        { actor: "member", method: "POST" },
      )
      setOrders((current) =>
        current.map((item) =>
          item.id === order.id
            ? {
                ...item,
                metadata: {
                  ...(item.metadata ?? {}),
                  external_payment_status: "confirmed",
                },
              }
            : item,
        ),
      )
      setNotice("El pago SINPE se confirmó para este pedido.")
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No se pudo confirmar el pago SINPE.",
      )
    } finally {
      setPaymentConfirmationOrderId(null)
    }
  }

  async function archiveProduct(productId: string) {
    if (!window.confirm("¿Archivar esta publicación?")) return
    setError(null)
    setNotice(null)
    try {
      await requestMarketplaceApi(
        `/vendor/products/${encodeURIComponent(productId)}`,
        { actor: "member", method: "DELETE" },
      )
      setNotice("La solicitud de archivo se envió para revisión.")
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No se pudo archivar el producto.",
      )
    }
  }

  async function togglePublication(product: SellerProduct) {
    const status = product.status === "published" ? "draft" : "published"
    setError(null)
    setNotice(null)
    try {
      await requestMarketplaceApi(
        `/vendor/products/${encodeURIComponent(product.id)}/publication`,
        { actor: "member", method: "POST", body: { status } },
      )
      setProducts((current) => current.map((item) =>
        item.id === product.id ? { ...item, status } : item,
      ))
      setNotice(status === "published"
        ? "La publicación está visible nuevamente."
        : "La publicación quedó pausada.")
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No se pudo actualizar el estado de la publicación.",
      )
    }
  }

  if (!membership) return null

  const statusLabel = {
    pending: "Pendiente de aprobación",
    active: "Tienda activa",
    suspended: "Tienda suspendida",
  }[membership.status] ?? membership.status

  if (isNewProduct || editingId) {
    return (
      <main class="content-page">
        <PageRoute current={editingId ? "Editar producto" : "Nueva publicación"} />
        <div class="seller-page-heading">
          <div>
            <div class="seller-overview-heading">
              <span class="route-node route-node--lime" aria-hidden="true" />
              <span>{statusLabel}</span>
            </div>
            <h1>{editingId ? "Editar publicación" : "Publica un producto"}</h1>
          </div>
          <a class="button button--quiet" href="/vendedor">Volver al espacio</a>
        </div>
        {membership.status !== "active" ? (
          <p class="notice-line">
            Solo las tiendas activas pueden publicar o modificar inventario.
          </p>
        ) : (
          <SellerProductForm
            productId={editingId}
            onSaved={() => location.route("/vendedor")}
          />
        )}
      </main>
    )
  }

  return (
    <main class="content-page">
      <PageRoute current="Espacio de vendedor" />
      <div class="seller-page-heading">
        <div>
          <div class="seller-overview-heading">
            <span class="route-node route-node--lime" aria-hidden="true" />
            <span>{statusLabel}</span>
          </div>
          <h1>{membership.name}</h1>
          <p class="page-lede">
            Gestiona publicaciones y solicitudes dentro del espacio seleccionado.
          </p>
        </div>
        <div class="seller-heading-actions">
          {membership.status === "active" && (
            <a class="button button--seller" href="/vendedor/productos/nuevo">
              Nueva publicación
            </a>
          )}
          <button
            class="button button--quiet"
            type="button"
            onClick={() => {
              authState.clearMember()
              location.route("/")
            }}
          >
            Salir
          </button>
        </div>
      </div>
      {membership.status !== "active" && (
        <div class="notice-line notice-line--lime">
          <span class="route-node route-node--lime" aria-hidden="true" />
          <p>
            {membership.status === "pending"
              ? "Tu tienda está pendiente de aprobación. Podrás gestionar publicaciones cuando sea activada."
              : "Tu tienda está suspendida y no puede aceptar nuevas transacciones."}
          </p>
        </div>
      )}
      {error && <p class="form-error" role="alert">{error}</p>}
      {notice && <p class="success-note" role="status">{notice}</p>}
      {loading && <p class="catalog-status">Cargando el espacio de vendedor…</p>}
      {membership.status === "active" && !loading && (
        <>
          <section class="seller-section">
            <div class="seller-section-heading">
              <h2>Publicaciones</h2>
              <span>{products.length}</span>
            </div>
            {products.length === 0 ? (
              <p class="empty-note">Todavía no tienes productos publicados.</p>
            ) : (
              <div class="seller-product-list">
                {products.map((product) => (
                  <article class="seller-product-row" key={product.id}>
                    {product.thumbnail
                      ? <img src={product.thumbnail} alt="" />
                      : <span class="seller-product-placeholder">Sin imagen</span>}
                    <div class="seller-product-info">
                      <strong>{product.title}</strong>
                      <span>
                        {product.status}
                        {product.variants?.[0]?.offers?.[0]?.inventory_quantity !== undefined
                          ? ` · ${product.variants[0].offers[0].inventory_quantity} en inventario`
                          : ""}
                      </span>
                    </div>
                    <div class="seller-row-actions">
                      <a class="text-link" href={`/vendedor/productos/${encodeURIComponent(product.id)}`}>
                        Editar
                      </a>
                      {(product.status === "published" || product.status === "draft") && (
                        <button
                          class="text-button"
                          type="button"
                          onClick={() => void togglePublication(product)}
                        >
                          {product.status === "published" ? "Pausar" : "Publicar"}
                        </button>
                      )}
                      <button
                        class="text-button text-button--danger"
                        type="button"
                        onClick={() => void archiveProduct(product.id)}
                      >
                        Archivar
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
          <section class="seller-section">
            <div class="seller-section-heading">
              <h2>Consultas</h2>
              <span>{leads.length}</span>
            </div>
            {!leads.length
              ? <p class="empty-note">No hay consultas nuevas.</p>
              : leads.map((lead) => (
                <article class="activity-row" key={lead.id}>
                  <span class="route-node route-node--blue" aria-hidden="true" />
                  <div>
                    <strong>Consulta de comprador</strong>
                    <span>Producto {lead.product_id} · {lead.status}</span>
                    {lead.message && <p>{lead.message}</p>}
                  </div>
                  <small>{new Date(lead.created_at).toLocaleDateString()}</small>
                </article>
              ))}
          </section>
          <section class="seller-section">
            <div class="seller-section-heading">
              <h2>Reservas</h2>
              <span>{reservations.length}</span>
            </div>
            {!reservations.length
              ? <p class="empty-note">No hay solicitudes de reserva.</p>
              : reservations.map((reservation) => (
                <article class="activity-row" key={reservation.id}>
                  <span class="route-node route-node--lime" aria-hidden="true" />
                  <div>
                    <strong>Solicitud de reserva · {reservation.status}</strong>
                    <span>Producto {reservation.product_id}</span>
                    {reservation.message && <p>{reservation.message}</p>}
                  </div>
                  {reservation.status === "pending" && (
                    <div class="seller-row-actions">
                      <button
                        class="text-button"
                        type="button"
                        onClick={() => void decideReservation(reservation.id, "confirmed")}
                      >
                        Confirmar
                      </button>
                      <button
                        class="text-button text-button--danger"
                        type="button"
                        onClick={() => void decideReservation(reservation.id, "declined")}
                      >
                        Declinar
                      </button>
                    </div>
                  )}
                </article>
              ))}
          </section>
          <section class="seller-section">
            <div class="seller-section-heading">
              <h2>Pedidos y fulfillment</h2>
              <span>{orders.length}</span>
            </div>
            {!orders.length
              ? <p class="empty-note">Aún no tienes pedidos.</p>
              : orders.map((order) => {
                  const sinpeOrder = isExternalSinpeOrder(order)
                  const paymentConfirmed =
                    order.metadata?.external_payment_status === "confirmed"
                  return (
                    <article class="activity-row" key={order.id}>
                      <span class="route-node route-node--blue" aria-hidden="true" />
                      <div>
                        <strong>
                          Pedido {order.display_id ? `#${order.display_id}` : order.id}
                        </strong>
                        <span>
                          {order.status ?? "En proceso"} · Fulfillment:{" "}
                          {order.fulfillment_status ?? "pendiente"}
                          {sinpeOrder
                            ? ` · SINPE ${paymentConfirmed ? "confirmado" : "pendiente"}`
                            : ""}
                        </span>
                      </div>
                      <small>
                        {order.created_at
                          ? new Date(order.created_at).toLocaleDateString()
                          : ""}
                      </small>
                      {sinpeOrder && !paymentConfirmed && (
                        <button
                          class="text-button"
                          type="button"
                          disabled={paymentConfirmationOrderId === order.id}
                          onClick={() => void confirmExternalPayment(order)}
                        >
                          {paymentConfirmationOrderId === order.id
                            ? "Confirmando SINPE…"
                            : "Confirmar pago SINPE"}
                        </button>
                      )}
                      {order.fulfillment_status === "not_fulfilled" &&
                        !fulfillmentCreatedOrderIds.includes(order.id) &&
                        (!sinpeOrder || paymentConfirmed) &&
                        order.items?.some((item) => item.requires_shipping !== false) && (
                          <button
                            class="text-button"
                            type="button"
                            disabled={!stockLocationId || fulfillmentPendingOrderId === order.id}
                            onClick={() => void createOrderFulfillment(order)}
                          >
                            {fulfillmentPendingOrderId === order.id
                              ? "Creando fulfillment…"
                              : "Preparar fulfillment"}
                          </button>
                        )}
                    </article>
                  )
                })}
          </section>
        </>
      )}
    </main>
  )
}

function SellerProductForm({
  productId,
  onSaved,
}: {
  productId?: string
  onSaved: () => void
}) {
  const [form, setForm] = useState<ProductFormState>(emptyForm)
  const [resources, setResources] = useState<SellerResources>({
    categories: [],
    regions: [],
    stockLocations: [],
    shippingProfiles: [],
  })
  const [attributes, setAttributes] = useState<ProductAttributeDefinition[]>([])
  const [sellerPhone, setSellerPhone] = useState("")
  const [categoryMode, setCategoryMode] = useState<"checkout" | "lead" | null>(
    null,
  )
  const [images, setImages] = useState<File[]>([])
  const [existingAttributeIds, setExistingAttributeIds] = useState<string[]>([])
  const [createdProductId, setCreatedProductId] = useState<string | null>(null)
  const [createdVariantIds, setCreatedVariantIds] = useState<string[]>([])
  const [createdProductSnapshot, setCreatedProductSnapshot] = useState<{
    product: string
    attributes: string
  } | null>(null)
  const [submit, setSubmit] = useState<{ pending: boolean; error: string | null }>({
    pending: false,
    error: null,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    void Promise.all([
      getProductCategories(),
      requestMarketplaceApi<{ regions: SellerResources["regions"] }>(
        "/vendor/regions?fields=id,name,currency_code&limit=100",
        { actor: "member" },
      ),
      requestMarketplaceApi<{ stock_locations: SellerResources["stockLocations"] }>(
        "/vendor/stock-locations?fields=id,name&limit=100",
        { actor: "member" },
      ),
      requestMarketplaceApi<{ shipping_profiles: SellerResources["shippingProfiles"] }>(
        "/vendor/shipping-profiles?fields=id,name&limit=100",
        { actor: "member" },
      ),
      requestMarketplaceApi<{ seller: { phone?: string | null } }>(
        "/vendor/sellers/me?fields=id,phone",
        { actor: "member" },
      ),
      productId
        ? requestMarketplaceApi<{ product: SellerProduct }>(
          `/vendor/products/${encodeURIComponent(productId)}?fields=id,title,description,thumbnail,images,categories.id,scoped_attributes.*,scoped_attributes.values.*,variants.id,variants.title,variants.sku,variants.options.*,variants.offers.*`,
          { actor: "member" },
        )
        : Promise.resolve(null),
      productId
        ? requestMarketplaceApi<{ marketplace_data: {
          country_code?: string
          region?: string
          locality?: string
        } | null }>(
          `/vendor/products/${encodeURIComponent(productId)}/marketplace-data`,
          { actor: "member" },
        )
        : Promise.resolve(null),
    ])
      .then(([categoryList, regionResult, locationResult, profileResult, sellerResult, productResult, marketResult]) => {
        if (!active) return
        setSellerPhone(sellerResult.seller.phone ?? "")
        setResources({
          categories: categoryList,
          regions: regionResult.regions ?? [],
          stockLocations: locationResult.stock_locations ?? [],
          shippingProfiles: profileResult.shipping_profiles ?? [],
        })
        if (productResult?.product) {
          const item = productResult.product
          const variants = (item.variants ?? []).map((variant) => {
            const offer = variant.offers?.[0]
            const offerState = offer ? toExistingOffer(offer) : null
            return {
              id: variant.id,
              title: variant.title,
              options: variant.options,
              sku: offer?.sku ?? variant.sku ?? "",
              price: String(
                offer?.prices?.find(
                  (price) =>
                    price.currency_code === regionResult.regions[0]?.currency_code,
                )?.amount ?? offer?.prices?.[0]?.amount ?? "",
              ),
              quantity: String(
                offerState?.locationLevels[0]?.stocked_quantity ??
                  offer?.inventory_quantity ??
                  1,
              ),
              offer: offerState,
            }
          })
          const attributeValues = Object.fromEntries(
            (item.scoped_attributes ?? [])
              .filter((attribute) => attribute.values?.length)
              .map((attribute) => {
                const values = attribute.values ?? []
                if (
                  attribute.type === "single_select" ||
                  attribute.type === "multi_select"
                ) {
                  return [
                    attribute.id,
                    attribute.type === "single_select"
                      ? values[0]?.id ?? ""
                      : values.map((value) => value.id),
                  ]
                }
                if (attribute.type === "toggle") {
                  return [
                    attribute.id,
                    values[0]?.name === "true" ? "true" : "false",
                  ]
                }
                return [attribute.id, values[0]?.name ?? ""]
              }),
          )
          setExistingAttributeIds(
            (item.scoped_attributes ?? []).map((attribute) => attribute.id),
          )
          setForm((current) => ({
            ...current,
            title: item.title,
            description: item.description ?? "",
            categoryId: item.categories?.[0]?.id ?? "",
            variants: variants.length
              ? variants
              : [{ title: "Único", price: "", quantity: "1", sku: "" }],
            countryCode: marketResult?.marketplace_data?.country_code ?? "",
            region: marketResult?.marketplace_data?.region ?? "",
            locality: marketResult?.marketplace_data?.locality ?? "",
            imageUrls: item.images?.map((image) => image.url) ?? [],
            attributeValues,
          }))
        }
      })
      .catch((requestError: unknown) => {
        if (active) {
          setSubmit({
            pending: false,
            error: requestError instanceof Error
              ? requestError.message
              : "No se pudieron cargar las opciones de publicación.",
          })
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [productId])

  useEffect(() => {
    if (!form.categoryId) {
      setCategoryMode(null)
      return
    }
    let active = true
    void getCategoryTransactionMode(form.categoryId)
      .then((mode) => {
        if (active) setCategoryMode(mode)
      })
      .catch((requestError: unknown) => {
        if (active) {
          setSubmit({
            pending: false,
            error: requestError instanceof Error
              ? requestError.message
              : "No se pudo validar el modo de compra de la categoría.",
          })
        }
      })
    return () => {
      active = false
    }
  }, [form.categoryId])

  useEffect(() => {
    if (!form.categoryId) {
      setAttributes([])
      return
    }
    let active = true
    void getCategoryAttributes(form.categoryId)
      .then((definitions) => {
        if (active) setAttributes(definitions)
      })
      .catch((requestError: unknown) => {
        if (active) setSubmit({
          pending: false,
          error: requestError instanceof Error
            ? requestError.message
            : "No se pudieron cargar los atributos de la categoría.",
        })
      })
    return () => {
      active = false
    }
  }, [form.categoryId])

  async function uploadSelectedImages(): Promise<string[]> {
    const uploaded = await Promise.all(images.map(async (image) => {
      const formData = new FormData()
      formData.append("files", image)
      const { files } = await requestMarketplaceApi<{
        files: Array<{ url: string }>
      }>("/vendor/uploads", { actor: "member", method: "POST", formData })
      const file = files[0]
      if (!file?.url) throw new Error("Mercur no devolvió la URL de la imagen.")
      return file.url
    }))
    return [...form.imageUrls, ...uploaded]
  }

  function attributePayload(): Array<{
    id: string
    value_ids?: string[]
    value?: string | number | boolean
  }> {
    const result: Array<{
      id: string
      value_ids?: string[]
      value?: string | number | boolean
    }> = []
    for (const attribute of attributes) {
      const rawValue = form.attributeValues[attribute.id]
      if (
        rawValue === undefined ||
        rawValue === "" ||
        (Array.isArray(rawValue) && rawValue.length === 0)
      ) continue
      if (attribute.type === "single_select" || attribute.type === "multi_select") {
        const ids = Array.isArray(rawValue) ? rawValue : [rawValue]
        result.push({ id: attribute.id, value_ids: ids })
        continue
      }
      const value = attribute.type === "toggle"
        ? rawValue === "true"
        : Array.isArray(rawValue)
          ? rawValue.join(",")
          : rawValue
      result.push({ id: attribute.id, value })
    }
    return result
  }

  function attributeChanges() {
    const values = attributePayload()
    const existing = new Set(existingAttributeIds)
    const selected = new Set(values.map(({ id }) => id))
    return {
      add: values.filter(({ id }) => !existing.has(id)),
      update: values.filter(({ id }) => existing.has(id)),
      remove: existingAttributeIds.filter((id) => !selected.has(id)),
    }
  }

  function updateVariant(index: number, patch: Partial<ProductVariantForm>) {
    setForm((current) => ({
      ...current,
      variants: current.variants.map((variant, variantIndex) =>
        variantIndex === index ? { ...variant, ...patch } : variant,
      ),
    }))
  }

  async function submitProduct(event: Event) {
    event.preventDefault()
    if (!form.categoryId || !form.title.trim()) {
      setSubmit({ pending: false, error: "Completa el nombre y la categoría." })
      return
    }
    if (
      form.variants.length === 0 ||
      form.variants.some((variant) =>
        !variant.title.trim() ||
        !Number.isFinite(Number(variant.price)) ||
        Number(variant.price) < 0 ||
        !Number.isInteger(Number(variant.quantity)) ||
        Number(variant.quantity) < 0
      )
    ) {
      setSubmit({
        pending: false,
        error: "Cada variante necesita nombre, precio e inventario válidos.",
      })
      return
    }
    const enteredSkus = form.variants
      .map((variant) => variant.sku.trim())
      .filter(Boolean)
    if (new Set(enteredSkus).size !== enteredSkus.length) {
      setSubmit({
        pending: false,
        error: "Cada variante debe tener un SKU distinto.",
      })
      return
    }
    const region = resources.regions[0]
    const location = resources.stockLocations[0]
    const shippingProfile = resources.shippingProfiles[0]
    if (!region || ((!productId && !createdProductId) && (!location || !shippingProfile))) {
      setSubmit({
        pending: false,
        error: "Tu tienda necesita una región, ubicación de inventario y perfil de envío configurados antes de publicar.",
      })
      return
    }
    setSubmit({ pending: true, error: null })
    try {
      const effectiveMode = await getCategoryTransactionMode(form.categoryId)
      const normalizedPhone = sellerPhone.trim()
        ? normalizeWhatsAppPhone(sellerPhone)
        : null
      if (effectiveMode === "checkout" && !normalizedPhone) {
        throw new Error(
          "Ingresa un número de WhatsApp válido para publicar en modo de compra.",
        )
      }
      if (sellerPhone.trim() && !normalizedPhone) {
        throw new Error("El número de WhatsApp debe incluir el código de país.")
      }
      if (normalizedPhone) {
        await requestMarketplaceApi("/vendor/sellers/me", {
          actor: "member",
          method: "POST",
          body: { phone: normalizedPhone },
        })
        setSellerPhone(normalizedPhone)
      }

      const imageUrls = await uploadSelectedImages()
      const variantInputs = form.variants.map((variant) => ({
        ...(variant.id ? { id: variant.id } : {}),
        title: variant.title.trim(),
        ...(variant.options ? { options: variant.options } : { options: {} }),
      }))
      const productBody = {
        title: form.title.trim(),
        description: form.description.trim(),
        images: imageUrls.map((url) => ({ url })),
        thumbnail: imageUrls[0],
        categories: [{ id: form.categoryId }],
        variants: variantInputs,
      }
      const currentAttributes = attributePayload()
      const productSnapshot = JSON.stringify(productBody)
      const attributesSnapshot = JSON.stringify(currentAttributes)
      let targetProductId = productId ?? createdProductId ?? undefined
      let targetVariantIds = productId
        ? form.variants.map((variant) => variant.id ?? "")
        : createdVariantIds
      let productCreatedThisAttempt = false

      if (!targetProductId) {
        const { product } = await requestMarketplaceApi<{ product: SellerProduct }>(
          "/vendor/products?fields=id,title,handle,status,variants.id,variants.title",
          {
            actor: "member",
            method: "POST",
            body: {
              ...productBody,
              attributes: currentAttributes,
              status: "published",
            },
          },
        )
        targetProductId = product.id
        targetVariantIds = product.variants?.map(({ id }) => id) ?? []
        productCreatedThisAttempt = true
        setCreatedProductId(product.id)
        setCreatedVariantIds(targetVariantIds)
        setExistingAttributeIds(currentAttributes.map(({ id }) => id))
        setCreatedProductSnapshot({
          product: productSnapshot,
          attributes: attributesSnapshot,
        })
      } else if (
        productId ||
        createdProductSnapshot?.product !== productSnapshot
      ) {
        await requestMarketplaceApi(
          `/vendor/products/${encodeURIComponent(targetProductId)}`,
          { actor: "member", method: "POST", body: productBody },
        )
        if (createdProductId) {
          setCreatedProductSnapshot((current) => ({
            product: productSnapshot,
            attributes: current?.attributes ?? "",
          }))
        }
      }

      if (targetProductId && (
        productId ||
        (!productCreatedThisAttempt &&
          createdProductSnapshot?.attributes !== attributesSnapshot)
      )) {
        const changes = attributeChanges()
        if (changes.add.length || changes.update.length || changes.remove.length) {
          await requestMarketplaceApi(
            `/vendor/products/${encodeURIComponent(targetProductId)}/attributes/batch`,
            { actor: "member", method: "POST", body: changes },
          )
        }
        if (createdProductId) {
          setCreatedProductSnapshot((current) => ({
            product: current?.product ?? productSnapshot,
            attributes: attributesSnapshot,
          }))
          setExistingAttributeIds(currentAttributes.map(({ id }) => id))
        }
      }

      if (!targetProductId) {
        throw new Error("Mercur no devolvió el identificador de la publicación.")
      }

      if (
        targetVariantIds.length !== form.variants.length ||
        targetVariantIds.some((id) => !id)
      ) {
        const { product } = await requestMarketplaceApi<{ product: SellerProduct }>(
          `/vendor/products/${encodeURIComponent(targetProductId)}?fields=id,variants.id,variants.title`,
          { actor: "member" },
        )
        targetVariantIds = form.variants.map(
          (variant, index) => variant.id ?? product.variants?.[index]?.id ?? "",
        )
        if (createdProductId) setCreatedVariantIds(targetVariantIds)
      }
      if (targetVariantIds.some((id) => !id)) {
        throw new Error(
          "La publicación se creó, pero Mercur no devolvió todas las variantes para las ofertas.",
        )
      }

      for (const [index, variant] of form.variants.entries()) {
        const variantId = targetVariantIds[index]
        const amount = Number(variant.price)
        const quantity = Number(variant.quantity)
        let offerToUpdate = variant.offer ?? null
        const params = new URLSearchParams({
          variant_id: variantId,
          limit: "100",
          fields: [
            "id",
            "variant_id",
            "sku",
            "prices.*",
            "inventory_item_link.id",
            "inventory_item_link.inventory_item_id",
            "inventory_item_link.inventory_item.id",
            "inventory_item_link.inventory_item.location_levels.id",
            "inventory_item_link.inventory_item.location_levels.location_id",
            "inventory_item_link.inventory_item.location_levels.stocked_quantity",
          ].join(","),
        })
        const { offers: matchingOffers } = await requestMarketplaceApi<{
          offers: SellerOffer[]
        }>(`/vendor/offers?${params}`, { actor: "member" })
        const sku = variant.sku.trim() || `sku-${targetProductId}-${index + 1}`
        if (!offerToUpdate) {
          const matchingOffer =
            matchingOffers.find((offer) => offer.sku === sku) ??
            (matchingOffers.length === 1 ? matchingOffers[0] : undefined)
          if (matchingOffer) offerToUpdate = toExistingOffer(matchingOffer)
        }

        if (offerToUpdate) {
          const currencyCode = region?.currency_code ??
            offerToUpdate.prices[0]?.currency_code
          if (!currencyCode) {
            throw new Error("No hay una moneda configurada para actualizar la oferta.")
          }
          const prices = offerToUpdate.prices.map((price) =>
            price.currency_code === currencyCode ? { ...price, amount } : price,
          )
          if (!prices.some((price) => price.currency_code === currencyCode)) {
            prices.push({ amount, currency_code: currencyCode })
          }
          await requestMarketplaceApi(
            `/vendor/offers/${encodeURIComponent(offerToUpdate.id)}`,
            {
              actor: "member",
              method: "POST",
              body: { sku, prices },
            },
          )

          if (!offerToUpdate.inventoryItemId) {
            throw new Error(
              "No se encontró el artículo de inventario asociado a una oferta.",
            )
          }
          const stockLocationId =
            offerToUpdate.locationLevels[0]?.location_id ?? location?.id
          if (!stockLocationId) {
            throw new Error(
              "Una oferta no tiene una ubicación de inventario disponible.",
            )
          }
          const levelExists = offerToUpdate.locationLevels.some(
            (level) => level.location_id === stockLocationId,
          )
          await requestMarketplaceApi(
            `/vendor/inventory-items/${encodeURIComponent(offerToUpdate.inventoryItemId)}/location-levels/batch`,
            {
              actor: "member",
              method: "POST",
              body: {
                [levelExists ? "update" : "create"]: [{
                  location_id: stockLocationId,
                  stocked_quantity: quantity,
                }],
              },
            },
          )
        } else {
          if (!region || !location || !shippingProfile) {
            throw new Error("Faltan recursos de tienda para crear una oferta.")
          }
          const offerParams = new URLSearchParams({
            fields: [
              "id",
              "variant_id",
              "sku",
              "prices.*",
              "inventory_item_link.id",
              "inventory_item_link.inventory_item_id",
              "inventory_item_link.inventory_item.id",
              "inventory_item_link.inventory_item.location_levels.id",
              "inventory_item_link.inventory_item.location_levels.location_id",
              "inventory_item_link.inventory_item.location_levels.stocked_quantity",
            ].join(","),
          })
          const { offer } = await requestMarketplaceApi<{ offer?: SellerOffer }>(
            `/vendor/offers?${offerParams}`,
            {
              actor: "member",
              method: "POST",
              body: {
                sku,
                variant_id: variantId,
                shipping_profile_id: shippingProfile.id,
                prices: [{ amount, currency_code: region.currency_code }],
                manage_inventory: true,
                inventory_items: [{
                  title: variant.title.trim(),
                  sku,
                  required_quantity: 1,
                  stock_levels: [{
                    location_id: location.id,
                    stocked_quantity: quantity,
                  }],
                }],
              },
            },
          )
          if (!offer?.id) {
            throw new Error(
              "Se creó una oferta, pero Mercur no devolvió su identificador.",
            )
          }
        }
      }

      await requestMarketplaceApi(
        `/vendor/products/${encodeURIComponent(targetProductId)}/marketplace-data`,
        {
          actor: "member",
          method: "POST",
          body: {
            country_code: form.countryCode.toUpperCase() || null,
            region: form.region || null,
            locality: form.locality || null,
          },
        },
      )
      onSaved()
    } catch (requestError) {
      setSubmit({
        pending: false,
        error: requestError instanceof Error
          ? requestError.message
          : "No se pudo guardar la publicación. Tus datos siguen en el formulario.",
      })
    } finally {
      setSubmit((current) => ({ ...current, pending: false }))
    }
  }

  const categories = flattenCategories(resources.categories)
  const canPublish = resources.regions.length > 0 &&
    resources.stockLocations.length > 0 &&
    resources.shippingProfiles.length > 0

  if (loading) return <p class="catalog-status">Preparando el formulario…</p>

  return (
    <form class="seller-product-form" onSubmit={(event) => void submitProduct(event)}>
      {submit.error && <p class="form-error" role="alert">{submit.error}</p>}
      {createdProductId && submit.error && (
        <p class="form-footnote">
          La publicación {createdProductId} ya se creó. Puedes corregir los datos y volver a intentar sin crear otra.
        </p>
      )}
      <div class="seller-form-grid">
        <label class="field">
          <span>Nombre del producto</span>
          <input
            required
            value={form.title}
            onInput={(event) => setForm({ ...form, title: event.currentTarget.value })}
          />
        </label>
        <label class="field">
          <span>Categoría</span>
          <select
            required
            value={form.categoryId}
            onChange={(event) => setForm({
              ...form,
              categoryId: event.currentTarget.value,
              attributeValues: {},
            })}
          >
            <option value="">Selecciona una categoría</option>
            {categories.map((category) => (
              <option value={category.id} key={category.id}>{category.name}</option>
            ))}
          </select>
        </label>
      </div>
      <label class="field">
        <span>Descripción</span>
        <textarea
          rows={5}
          value={form.description}
          onInput={(event) =>
            setForm({ ...form, description: event.currentTarget.value })
          }
        />
      </label>
      <label class="field">
        <span>WhatsApp para pagos{categoryMode === "checkout" ? " *" : ""}</span>
        <input
          type="tel"
          autoComplete="tel"
          required={categoryMode === "checkout"}
          value={sellerPhone}
          aria-describedby="seller-whatsapp-help"
          onInput={(event) => setSellerPhone(event.currentTarget.value)}
        />
        <small id="seller-whatsapp-help">
          Incluye el código de país (por ejemplo, +506…). Obligatorio para ofertas de compra.
        </small>
      </label>
      {attributes.length > 0 && (
        <fieldset class="seller-attributes">
          <legend>Especificaciones de la categoría</legend>
          <div class="seller-form-grid">
            {attributes.map((attribute) => (
              <label class="field" key={attribute.id}>
                <span>
                  {attribute.name}
                  {attribute.is_required ? " *" : ""}
                </span>
                {attribute.type === "single_select" ? (
                  <select
                    required={attribute.is_required}
                    value={String(form.attributeValues[attribute.id] ?? "")}
                    onChange={(event) => setForm({
                      ...form,
                      attributeValues: {
                        ...form.attributeValues,
                        [attribute.id]: event.currentTarget.value,
                      },
                    })}
                  >
                    <option value="">Selecciona</option>
                    {attribute.values?.map((option) => (
                      <option value={option.id} key={option.id}>{option.name}</option>
                    ))}
                  </select>
                ) : attribute.type === "multi_select" ? (
                  <span class="seller-checkbox-list">
                    {attribute.values?.map((option) => {
                      const selected = form.attributeValues[attribute.id]
                      const values = Array.isArray(selected) ? selected : []
                      return (
                        <label class="check-field" key={option.id}>
                          <input
                            type="checkbox"
                            checked={values.includes(option.id)}
                            onChange={(event) => {
                              const next = event.currentTarget.checked
                                ? [...values, option.id]
                                : values.filter((id) => id !== option.id)
                              setForm({
                                ...form,
                                attributeValues: {
                                  ...form.attributeValues,
                                  [attribute.id]: next,
                                },
                              })
                            }}
                          />
                          <span>{option.name}</span>
                        </label>
                      )
                    })}
                  </span>
                ) : attribute.type === "toggle" ? (
                  <select
                    required={attribute.is_required}
                    value={String(form.attributeValues[attribute.id] ?? "")}
                    onChange={(event) => setForm({
                      ...form,
                      attributeValues: {
                        ...form.attributeValues,
                        [attribute.id]: event.currentTarget.value,
                      },
                    })}
                  >
                    <option value="">Selecciona</option>
                    <option value="true">Sí</option>
                    <option value="false">No</option>
                  </select>
                ) : attribute.type === "unit" ? (
                  <input
                    required={attribute.is_required}
                    type="number"
                    step="any"
                    value={String(form.attributeValues[attribute.id] ?? "")}
                    onInput={(event) => setForm({
                      ...form,
                      attributeValues: {
                        ...form.attributeValues,
                        [attribute.id]: event.currentTarget.value,
                      },
                    })}
                  />
                ) : (
                  <input
                    required={attribute.is_required}
                    type="text"
                    value={String(form.attributeValues[attribute.id] ?? "")}
                    onInput={(event) => setForm({
                      ...form,
                      attributeValues: {
                        ...form.attributeValues,
                        [attribute.id]: event.currentTarget.value,
                      },
                    })}
                  />
                )}
                {attribute.description && <small>{attribute.description}</small>}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <fieldset class="seller-attributes">
        <legend>Variantes, precios e inventario</legend>
        {form.variants.map((variant, index) => (
          <div class="seller-variant-row" key={variant.id ?? index}>
            <div class="seller-form-grid">
              <label class="field">
                <span>Nombre de variante</span>
                <input
                  required
                  value={variant.title}
                  onInput={(event) =>
                    updateVariant(index, { title: event.currentTarget.value })
                  }
                />
              </label>
              <label class="field">
                <span>Precio ({resources.regions[0]?.currency_code?.toUpperCase() ?? "moneda"})</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={variant.price}
                  onInput={(event) =>
                    updateVariant(index, { price: event.currentTarget.value })
                  }
                />
              </label>
              <label class="field">
                <span>Unidades disponibles</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  required
                  value={variant.quantity}
                  onInput={(event) =>
                    updateVariant(index, { quantity: event.currentTarget.value })
                  }
                />
              </label>
              <label class="field">
                <span>SKU (opcional)</span>
                <input
                  value={variant.sku}
                  onInput={(event) =>
                    updateVariant(index, { sku: event.currentTarget.value })
                  }
                />
              </label>
            </div>
            {!productId && !createdProductId && form.variants.length > 1 && (
              <button
                class="text-button text-button--danger"
                type="button"
                onClick={() => setForm((current) => ({
                  ...current,
                  variants: current.variants.filter(
                    (_, variantIndex) => variantIndex !== index,
                  ),
                }))}
              >
                Quitar variante
              </button>
            )}
          </div>
        ))}
        {!productId && !createdProductId && (
          <button
            class="button button--quiet"
            type="button"
            onClick={() => setForm((current) => ({
              ...current,
              variants: [
                ...current.variants,
                {
                  title: `Variante ${current.variants.length + 1}`,
                  price: "",
                  quantity: "1",
                  sku: "",
                },
              ],
            }))}
          >
            Añadir variante
          </button>
        )}
      </fieldset>
      <fieldset class="seller-attributes">
        <legend>Ubicación de la publicación</legend>
        <div class="seller-form-grid">
          <label class="field">
            <span>País (código ISO alpha-2)</span>
            <input
              required
              minLength={2}
              maxLength={2}
              pattern="[A-Za-z]{2}"
              value={form.countryCode}
              onInput={(event) =>
                setForm({ ...form, countryCode: event.currentTarget.value.toUpperCase() })
              }
            />
          </label>
          <label class="field">
            <span>Provincia o región</span>
            <input
              value={form.region}
              onInput={(event) => setForm({ ...form, region: event.currentTarget.value })}
            />
          </label>
          <label class="field">
            <span>Localidad</span>
            <input
              value={form.locality}
              onInput={(event) => setForm({ ...form, locality: event.currentTarget.value })}
            />
          </label>
        </div>
      </fieldset>
      <label class="field">
        <span>Imágenes</span>
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={(event) => setImages(Array.from(event.currentTarget.files ?? []))}
        />
        <small>
          {form.imageUrls.length
            ? `${form.imageUrls.length} imagen(es) guardadas.`
            : "Puedes agregar una o más imágenes para la publicación."}
        </small>
      </label>
      {images.length > 0 && (
        <ul class="selected-files">
          {images.map((image) => <li key={`${image.name}-${image.size}`}>{image.name}</li>)}
        </ul>
      )}
      {!canPublish && !productId && !createdProductId && (
        <p class="form-footnote">
          Para crear una oferta, la tienda necesita región, ubicación de inventario y perfil de envío.
        </p>
      )}
      <div class="seller-form-actions">
        <button
          class="button button--seller"
          type="submit"
          disabled={
            submit.pending ||
            loading ||
            (!canPublish && !productId && !createdProductId)
          }
        >
          {submit.pending
            ? "Guardando…"
            : productId
              ? "Guardar cambios"
              : createdProductId
                ? "Completar publicación"
                : "Publicar producto"}
        </button>
        <a class="button button--quiet" href="/vendedor">Cancelar</a>
      </div>
      {(productId || createdProductId) && (
        <p class="form-footnote">
          Los cambios de catálogo se procesan con el flujo de revisión de Mercur.
        </p>
      )}
    </form>
  )
}
