import { useEffect, useState } from "preact/hooks"
import { useLocation } from "preact-iso"
import { authState } from "../store/auth"
import { requestMarketplaceApi } from "../lib/api"
import { formatPrice } from "../lib/marketplace"
import { activeCartId, clearActiveCart } from "../store/cart"

const externalSinpeProviderId = "pp_external_sinpe_external_sinpe"

interface CartItem {
  id: string
  title: string
  quantity: number
  unit_price?: number
  total?: number
  requires_shipping?: boolean
}

interface Cart {
  id: string
  currency_code: string
  email?: string | null
  total?: number
  items: CartItem[]
  shipping_address?: {
    first_name?: string | null
    last_name?: string | null
    address_1?: string | null
    city?: string | null
    province?: string | null
    postal_code?: string | null
    country_code?: string | null
    phone?: string | null
  } | null
  payment_collection?: {
    id?: string
    payment_sessions?: Array<{ provider_id?: string }>
  } | null
}

interface ShippingOption {
  id: string
  name: string
  amount?: number | null
}

interface ShippingAddressForm {
  firstName: string
  lastName: string
  address: string
  city: string
  province: string
  postalCode: string
  countryCode: string
  phone: string
}

const emptyAddress: ShippingAddressForm = {
  firstName: "",
  lastName: "",
  address: "",
  city: "",
  province: "",
  postalCode: "",
  countryCode: "",
  phone: "",
}

function PageRoute() {
  return (
    <nav class="page-route" aria-label="Ruta actual">
      <a href="/">Inicio</a>
      <span class="route-connector" aria-hidden="true" />
      <a href="/explorar">Explorar</a>
      <span class="route-connector" aria-hidden="true" />
      <span class="page-route-current" aria-current="page">Carrito</span>
    </nav>
  )
}

export function CartPage() {
  const location = useLocation()
  const [cart, setCart] = useState<Cart | null>(null)
  const [address, setAddress] = useState(emptyAddress)
  const [shippingOptions, setShippingOptions] = useState<ShippingOption[]>([])
  const [shippingOptionId, setShippingOptionId] = useState("")
  const [stage, setStage] = useState<"address" | "shipping">("address")
  const [orderGroupId, setOrderGroupId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const cartId = activeCartId.value
    if (!cartId) {
      setLoading(false)
      return
    }

    let active = true
    const params = new URLSearchParams({
      fields: [
        "id",
        "currency_code",
        "email",
        "total",
        "items.id",
        "items.title",
        "items.quantity",
        "items.unit_price",
        "items.total",
        "items.requires_shipping",
        "shipping_address.*",
        "payment_collection.id",
        "payment_collection.payment_sessions.provider_id",
      ].join(","),
    })
    void requestMarketplaceApi<{ cart: Cart }>(
      `/store/carts/${encodeURIComponent(cartId)}?${params}`,
    )
      .then(({ cart: result }) => {
        if (!active) return
        setCart(result)
        const saved = result.shipping_address
        if (saved) {
          setAddress({
            firstName: saved.first_name ?? "",
            lastName: saved.last_name ?? "",
            address: saved.address_1 ?? "",
            city: saved.city ?? "",
            province: saved.province ?? "",
            postalCode: saved.postal_code ?? "",
            countryCode: saved.country_code?.toUpperCase() ?? "",
            phone: saved.phone ?? "",
          })
        }
      })
      .catch((requestError: unknown) => {
        if (active) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "No se pudo cargar el carrito.",
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

  const requiresShipping = Boolean(
    cart?.items.some((item) => item.requires_shipping !== false),
  )

  function requireBuyerSession(): boolean {
    if (authState.customerSession.value.status === "authenticated") {
      return true
    }
    location.route(`/entrar?return=${encodeURIComponent("/carrito")}`)
    return false
  }

  async function prepareShipping(event: Event) {
    event.preventDefault()
    if (!cart || !requireBuyerSession()) return
    setPending(true)
    setError(null)
    try {
      const shippingAddress = {
        first_name: address.firstName.trim(),
        last_name: address.lastName.trim(),
        address_1: address.address.trim(),
        city: address.city.trim(),
        province: address.province.trim(),
        postal_code: address.postalCode.trim(),
        country_code: address.countryCode.trim().toLowerCase(),
        phone: address.phone.trim(),
      }
      await requestMarketplaceApi(`/store/carts/${encodeURIComponent(cart.id)}/customer`, {
        actor: "customer",
        method: "POST",
        body: {},
      })
      await requestMarketplaceApi(`/store/carts/${encodeURIComponent(cart.id)}`, {
        actor: "customer",
        method: "POST",
        body: {
          email: authState.customerSession.value.email,
          shipping_address: shippingAddress,
          billing_address: shippingAddress,
        },
      })
      const params = new URLSearchParams({
        cart_id: cart.id,
        fields: "id,name,amount",
      })
      const { shipping_options } = await requestMarketplaceApi<{
        shipping_options: ShippingOption[]
      }>(`/store/shipping-options?${params}`)
      if (!shipping_options.length) {
        throw new Error("No hay métodos de envío disponibles para esta dirección.")
      }
      setShippingOptions(shipping_options)
      setShippingOptionId(
        shipping_options.length === 1 ? shipping_options[0].id : "",
      )
      setStage("shipping")
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No se pudo validar la dirección y el envío.",
      )
    } finally {
      setPending(false)
    }
  }

  async function completeOrder(event: Event) {
    event.preventDefault()
    if (!cart || !requireBuyerSession()) return
    if (requiresShipping && !shippingOptionId) {
      setError("Selecciona un método de envío para continuar.")
      return
    }

    setPending(true)
    setError(null)
    try {
      await requestMarketplaceApi(`/store/carts/${encodeURIComponent(cart.id)}/customer`, {
        actor: "customer",
        method: "POST",
        body: {},
      })
      await requestMarketplaceApi(`/store/carts/${encodeURIComponent(cart.id)}`, {
        actor: "customer",
        method: "POST",
        body: { email: authState.customerSession.value.email },
      })

      if (requiresShipping) {
        await requestMarketplaceApi(
          `/store/carts/${encodeURIComponent(cart.id)}/shipping-methods`,
          {
            actor: "customer",
            method: "POST",
            body: { option_id: shippingOptionId },
          },
        )
      }

      let paymentCollectionId = cart.payment_collection?.id
      if (!paymentCollectionId) {
        const { payment_collection } = await requestMarketplaceApi<{
          payment_collection: { id: string }
        }>("/store/payment-collections", {
          actor: "customer",
          method: "POST",
          body: { cart_id: cart.id },
        })
        paymentCollectionId = payment_collection.id
      }
      if (!paymentCollectionId) {
        throw new Error("No se pudo crear la colección de pago externa.")
      }

      const hasSinpeSession = cart.payment_collection?.payment_sessions?.some(
        ({ provider_id }) => provider_id === externalSinpeProviderId,
      )
      if (!hasSinpeSession) {
        await requestMarketplaceApi(
          `/store/payment-collections/${encodeURIComponent(paymentCollectionId)}/payment-sessions`,
          {
            actor: "customer",
            method: "POST",
            body: { provider_id: externalSinpeProviderId, data: {} },
          },
        )
      }

      const result = await requestMarketplaceApi<{
        order_group?: { id: string }
      }>(`/store/carts/${encodeURIComponent(cart.id)}/complete`, {
        actor: "customer",
        method: "POST",
      })
      if (!result.order_group?.id) {
        throw new Error("Mercur no devolvió el grupo de pedidos completado.")
      }
      clearActiveCart()
      setOrderGroupId(result.order_group.id)
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No se pudo completar el pedido.",
      )
    } finally {
      setPending(false)
    }
  }

  return (
    <main class="content-page">
      <PageRoute />
      <section class="cart-page">
        <div class="route-label">
          <span class="route-node route-node--blue" aria-hidden="true" />
          <span>Compra externa</span>
        </div>
        <h1>Tu carrito</h1>
        {loading && <p class="catalog-status">Cargando el carrito…</p>}
        {error && <p class="form-error" role="alert">{error}</p>}
        {orderGroupId ? (
          <div class="catalog-empty">
            <h2>Pedido creado · {orderGroupId}</h2>
            <p>
              Cada vendedor confirmará contigo el pago SINPE por WhatsApp. No se
              procesó ni capturó dinero en la plataforma.
            </p>
            <a class="button button--primary" href="/cuenta">Ver pedidos y enlaces de pago</a>
          </div>
        ) : !loading && (!cart || cart.items.length === 0) ? (
          <div class="catalog-empty">
            <h2>Tu carrito está vacío</h2>
            <p>Agrega productos de compra para iniciar un pedido.</p>
            <a class="button button--primary" href="/explorar">Explorar productos</a>
          </div>
        ) : cart ? (
          <>
            <section class="activity-section">
              <h2>Productos</h2>
              {cart.items.map((item) => (
                <article class="activity-row" key={item.id}>
                  <div>
                    <strong>{item.title}</strong>
                    <span>
                      {item.quantity} ×{" "}
                      {typeof item.unit_price === "number"
                        ? formatPrice(item.unit_price, cart.currency_code)
                        : "precio actualizado al completar"}
                    </span>
                  </div>
                  {typeof item.total === "number" && (
                    <small>{formatPrice(item.total, cart.currency_code)}</small>
                  )}
                </article>
              ))}
              {typeof cart.total === "number" && (
                <p class="cart-total">
                  Total de la compra{" "}
                  <strong>{formatPrice(cart.total, cart.currency_code)}</strong>
                </p>
              )}
            </section>
            {requiresShipping && stage === "address" ? (
              <form class="seller-form" onSubmit={prepareShipping}>
                <h2>Dirección de envío</h2>
                <div class="seller-form-grid">
                  <label class="field">
                    <span>Nombre</span>
                    <input
                      required
                      value={address.firstName}
                      onInput={(event) => setAddress({
                        ...address,
                        firstName: event.currentTarget.value,
                      })}
                    />
                  </label>
                  <label class="field">
                    <span>Apellidos</span>
                    <input
                      required
                      value={address.lastName}
                      onInput={(event) => setAddress({
                        ...address,
                        lastName: event.currentTarget.value,
                      })}
                    />
                  </label>
                  <label class="field">
                    <span>Dirección</span>
                    <input
                      required
                      value={address.address}
                      onInput={(event) => setAddress({
                        ...address,
                        address: event.currentTarget.value,
                      })}
                    />
                  </label>
                  <label class="field">
                    <span>Ciudad o localidad</span>
                    <input
                      required
                      value={address.city}
                      onInput={(event) => setAddress({
                        ...address,
                        city: event.currentTarget.value,
                      })}
                    />
                  </label>
                  <label class="field">
                    <span>Provincia o región</span>
                    <input
                      value={address.province}
                      onInput={(event) => setAddress({
                        ...address,
                        province: event.currentTarget.value,
                      })}
                    />
                  </label>
                  <label class="field">
                    <span>Código postal</span>
                    <input
                      value={address.postalCode}
                      onInput={(event) => setAddress({
                        ...address,
                        postalCode: event.currentTarget.value,
                      })}
                    />
                  </label>
                  <label class="field">
                    <span>País (ISO alpha-2)</span>
                    <input
                      required
                      minLength={2}
                      maxLength={2}
                      pattern="[A-Za-z]{2}"
                      value={address.countryCode}
                      onInput={(event) => setAddress({
                        ...address,
                        countryCode: event.currentTarget.value.toUpperCase(),
                      })}
                    />
                  </label>
                  <label class="field">
                    <span>Teléfono (opcional)</span>
                    <input
                      type="tel"
                      value={address.phone}
                      onInput={(event) => setAddress({
                        ...address,
                        phone: event.currentTarget.value,
                      })}
                    />
                  </label>
                </div>
                <button class="button button--primary" type="submit" disabled={pending}>
                  {pending ? "Buscando envío…" : "Continuar"}
                </button>
              </form>
            ) : (
              <>
                {requiresShipping && (
                  <section class="activity-section">
                    <h2>Elige el método de envío</h2>
                    {shippingOptions.map((option) => (
                      <label class="check-field" key={option.id}>
                        <input
                          type="radio"
                          name="shipping-option"
                          value={option.id}
                          checked={shippingOptionId === option.id}
                          onChange={() => setShippingOptionId(option.id)}
                        />
                        <span>
                          {option.name}
                          {typeof option.amount === "number"
                            ? ` · ${formatPrice(option.amount, cart.currency_code)}`
                            : ""}
                        </span>
                      </label>
                    ))}
                  </section>
                )}
                <p class="form-footnote">
                  El pedido quedará pendiente mientras coordinas SINPE
                  directamente con cada vendedor.
                </p>
                <button
                  class="button button--primary"
                  type="button"
                  disabled={pending || (requiresShipping && !shippingOptionId)}
                  onClick={(event) => void completeOrder(event)}
                >
                  {pending ? "Creando pedidos…" : "Completar pedido"}
                </button>
                {requiresShipping && (
                  <button
                    class="text-button"
                    type="button"
                    onClick={() => setStage("address")}
                  >
                    Cambiar dirección
                  </button>
                )}
              </>
            )}
          </>
        ) : null}
      </section>
    </main>
  )
}
