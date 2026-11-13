import { useEffect, useState } from "preact/hooks"
import { LocationProvider, Route, Router, useLocation } from "preact-iso"
import type { ComponentChildren } from "preact"
import {
  ClientError,
  loginCustomer,
  loginMember,
  logoutCustomer,
  registerSeller,
  restoreSessions,
  selectSeller,
} from "./lib/api"
import { authState, type SellerMembership } from "./store/auth"
import { AccountPage, WishlistPage } from "./pages/account"
import { CartPage } from "./pages/cart"
import { ExplorePage } from "./pages/explore"
import { ItemPage } from "./pages/item"
import { SellerPage } from "./pages/seller"

type SubmitState = {
  pending: boolean
  error: string | null
}

function getErrorMessage(error: unknown): string {
  if (error instanceof ClientError) {
    return error.message
  }
  if (error instanceof Error) {
    return error.message
  }
  return "Ocurrió un error inesperado. Inténtalo de nuevo."
}

export function App() {
  const [bootstrapError, setBootstrapError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [retrying, setRetrying] = useState(false)

  async function restore() {
    setRetrying(true)
    setBootstrapError(null)
    try {
      await restoreSessions()
      setReady(true)
    } catch (error) {
      setBootstrapError(getErrorMessage(error))
    } finally {
      setRetrying(false)
    }
  }

  useEffect(() => {
    void restore()
  }, [])

  return (
    <LocationProvider>
      <SiteFrame>
        {bootstrapError ? (
          <main class="status-page">
            <div class="status-route" aria-hidden="true">
              <span class="route-node route-node--error" />
              <span>No se pudo verificar la sesión</span>
            </div>
            <h1>Tu ruta sigue aquí.</h1>
            <p>
              No logramos conectar con Mercur para validar tus sesiones. Revisa
              la conexión e inténtalo otra vez.
            </p>
            <button
              class="button button--primary"
              type="button"
              disabled={retrying}
              onClick={() => void restore()}
            >
              {retrying ? "Verificando…" : "Reintentar"}
            </button>
            <p class="form-error" role="alert">
              {bootstrapError}
            </p>
          </main>
        ) : !ready ? (
          <main class="status-page" aria-live="polite">
            <div class="status-route" aria-hidden="true">
              <span class="route-node route-node--live" />
              <span>Conectando con Mercur</span>
            </div>
            <h1>Preparando tu espacio</h1>
            <p>Estamos restaurando tus sesiones guardadas.</p>
          </main>
        ) : (
          <Router>
            <Route path="/" component={HomePage} />
            <Route path="/explorar" component={ExplorePage} />
            <Route path="/item/:handle" component={ItemPage} />
            <Route path="/carrito" component={CartPage} />
            <Route path="/entrar" component={CustomerLoginPage} />
            <Route path="/vendedor/entrar" component={MemberLoginPage} />
            <Route path="/vendedor/registro" component={SellerOnboardingPage} />
            <Route path="/vendedor/seleccionar" component={SellerSelectionPage} />
            <Route path="/vendedor" component={SellerPage} />
            <Route path="/vendedor/*" component={SellerPage} />
            <Route path="/cuenta" component={AccountPage} />
            <Route path="/favoritos" component={WishlistPage} />
            <Route default component={NotFoundPage} />
          </Router>
        )}
      </SiteFrame>
    </LocationProvider>
  )
}

function SiteFrame({ children }: { children: ComponentChildren }) {
  return (
    <div class="app-shell">
      <SiteHeader />
      {children}
      <SiteFooter />
    </div>
  )
}

function SiteHeader() {
  const location = useLocation()
  const customer = authState.customerSession.value
  const member = authState.memberSession.value

  return (
    <header class="site-header">
      <a class="brand" href="/" aria-label="Mercur, inicio">
        <RouteMark />
        <span>mercur</span>
      </a>
      <nav class="main-nav" aria-label="Navegación principal">
        <a
          href="/explorar"
          class="nav-link"
          aria-current={location.path === "/explorar" ? "page" : undefined}
        >
          Explorar
        </a>
        <a
          href="/favoritos"
          class="nav-link"
          aria-current={location.path === "/favoritos" ? "page" : undefined}
        >
          Favoritos
        </a>
        <a
          href="/carrito"
          class="nav-link"
          aria-current={location.path === "/carrito" ? "page" : undefined}
        >
          Carrito
        </a>
        {member.status === "authenticated" ? (
          <a
            href="/vendedor"
            class="nav-link"
            aria-current={location.path.startsWith("/vendedor") ? "page" : undefined}
          >
            Mi espacio
          </a>
        ) : (
          <a class="nav-link" href="/vendedor/entrar">
            Vender
          </a>
        )}
      </nav>
      <div class="header-actions">
        {customer.status === "authenticated" ? (
          <>
            <a class="account-link" href="/cuenta">
              Mi cuenta
            </a>
            <button
              class="button button--quiet header-logout"
              type="button"
              onClick={logoutCustomer}
            >
              Salir
            </button>
          </>
        ) : (
          <a class="account-link" href="/entrar">
            Iniciar sesión
          </a>
        )}
      </div>
    </header>
  )
}

function SiteFooter() {
  return (
    <footer class="site-footer">
      <a class="footer-brand" href="/">
        <RouteMark />
        <span>mercur</span>
      </a>
      <span>Un marketplace. Distintos caminos.</span>
      <a href="/vendedor/entrar">Espacio de vendedores</a>
    </footer>
  )
}

function RouteMark() {
  return (
    <svg
      class="route-mark"
      viewBox="0 0 36 36"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M7 28V8h11v10h11" />
      <path d="M7 18h11" />
      <circle cx="7" cy="28" r="3" />
      <circle cx="7" cy="8" r="3" />
      <circle cx="29" cy="18" r="3" />
    </svg>
  )
}

function HomePage() {
  return (
    <main>
      <section class="home-intro">
        <div class="home-copy">
          <div class="route-label">
            <span class="route-node route-node--blue" />
            <span>Marketplace abierto</span>
          </div>
          <h1>Encuentra tu próximo hallazgo.</h1>
          <p>
            Explora productos de vendedores independientes o encuentra el
            camino para publicar los tuyos.
          </p>
          <div class="home-actions">
            <a class="button button--primary" href="/explorar">
              Explorar productos
              <span aria-hidden="true">→</span>
            </a>
            <a class="text-link" href="/vendedor/entrar">
              Quiero vender
            </a>
          </div>
          <p class="home-note">
            Compra en el marketplace o contacta directamente al vendedor.
          </p>
        </div>
        <RouteMap />
      </section>
      <section class="path-strip" aria-label="Rutas principales">
        <a class="path-stop path-stop--blue" href="/explorar">
          <span class="path-stop-marker" aria-hidden="true" />
          <span>
            <strong>Explorar productos</strong>
            <small>Abre el catálogo</small>
          </span>
          <span class="path-arrow" aria-hidden="true">↗</span>
        </a>
        <a class="path-stop path-stop--ink" href="/entrar">
          <span class="path-stop-marker" aria-hidden="true" />
          <span>
            <strong>Tu cuenta</strong>
            <small>Pedidos y favoritos</small>
          </span>
          <span class="path-arrow" aria-hidden="true">↗</span>
        </a>
        <a class="path-stop path-stop--lime" href="/vendedor/entrar">
          <span class="path-stop-marker" aria-hidden="true" />
          <span>
            <strong>Vender en Mercur</strong>
            <small>Empieza tu tienda</small>
          </span>
          <span class="path-arrow" aria-hidden="true">↗</span>
        </a>
      </section>
    </main>
  )
}

function RouteMap() {
  return (
    <div class="route-map" role="group" aria-label="Elige una ruta en Mercur">
      <svg class="route-map-lines" viewBox="0 0 680 440" aria-hidden="true">
        <path class="map-line map-line--blue" d="M25 354h165l75-75V96h240l58 58h97" />
        <path class="map-line map-line--ink" d="M190 354h160l76-76h178" />
        <path class="map-line map-line--lime" d="M265 279v95l76 42h227" />
        <path class="map-line map-line--thin" d="M265 96 190 22H89" />
        <circle class="map-dot map-dot--blue" cx="265" cy="96" r="9" />
        <circle class="map-dot map-dot--blue" cx="507" cy="154" r="9" />
        <circle class="map-dot map-dot--ink" cx="426" cy="278" r="9" />
        <circle class="map-dot map-dot--lime" cx="341" cy="374" r="9" />
        <circle class="map-dot map-dot--lime" cx="568" cy="416" r="9" />
        <circle class="map-transfer" cx="265" cy="279" r="13" />
      </svg>
      <div class="map-caption">Tu punto de partida</div>
      <a class="map-stop map-stop--explore" href="/explorar">
        <span class="map-stop-dot" aria-hidden="true" />
        <span>Explorar</span>
        <small>Catálogo</small>
      </a>
      <a class="map-stop map-stop--account" href="/entrar">
        <span class="map-stop-dot" aria-hidden="true" />
        <span>Mi cuenta</span>
        <small>Comprador</small>
      </a>
      <a class="map-stop map-stop--seller" href="/vendedor/entrar">
        <span class="map-stop-dot" aria-hidden="true" />
        <span>Vender</span>
        <small>Tu tienda</small>
      </a>
      <div class="map-interchange" aria-hidden="true">
        <span />
      </div>
    </div>
  )
}

function CustomerLoginPage() {
  const location = useLocation()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [submit, setSubmit] = useState<SubmitState>({
    pending: false,
    error: null,
  })

  async function handleSubmit(event: Event) {
    event.preventDefault()
    setSubmit({ pending: true, error: null })
    try {
      await loginCustomer({ email, password })
      const returnPath = new URLSearchParams(location.url.split("?")[1] ?? "")
        .get("return")
      location.route(
        returnPath?.startsWith("/") && !returnPath.startsWith("//")
          ? returnPath
          : "/cuenta",
      )
    } catch (error) {
      setSubmit({ pending: false, error: getErrorMessage(error) })
    }
  }

  return (
    <main class="content-page">
      <PageRoute current="Acceso comprador" />
      <div class="auth-layout">
        <section class="auth-copy">
          <h1>Vuelve a tu ruta.</h1>
          <p>
            Inicia sesión como comprador para consultar tu cuenta y guardar
            productos.
          </p>
          <a class="text-link" href="/vendedor/entrar">
            ¿Vendes en Mercur? Accede a tu espacio
          </a>
        </section>
        <form class="route-form" onSubmit={handleSubmit}>
          <div class="form-route-heading">
            <span class="route-node route-node--blue" aria-hidden="true" />
            <h2>Acceso de comprador</h2>
          </div>
          <label class="field" for="buyer-email">
            <span>Correo electrónico</span>
            <input
              id="buyer-email"
              type="email"
              name="email"
              autoComplete="email"
              required
              value={email}
              onInput={(event) => setEmail(event.currentTarget.value)}
            />
          </label>
          <label class="field" for="buyer-password">
            <span>Contraseña</span>
            <input
              id="buyer-password"
              type="password"
              name="password"
              autoComplete="current-password"
              required
              value={password}
              onInput={(event) => setPassword(event.currentTarget.value)}
            />
          </label>
          {submit.error && (
            <p class="form-error" role="alert">{submit.error}</p>
          )}
          <button
            class="button button--primary button--full"
            type="submit"
            disabled={submit.pending}
          >
            {submit.pending ? "Validando…" : "Iniciar sesión"}
          </button>
          <p class="form-footnote">
            Las sesiones de comprador y vendedor se mantienen separadas.
          </p>
        </form>
      </div>
    </main>
  )
}

function MemberLoginPage() {
  const location = useLocation()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [memberships, setMemberships] = useState<SellerMembership[] | null>(null)
  const [submit, setSubmit] = useState<SubmitState>({
    pending: false,
    error: null,
  })

  async function handleSubmit(event: Event) {
    event.preventDefault()
    setSubmit({ pending: true, error: null })
    try {
      const available = await loginMember({ email, password })
      if (available.length === 0) {
        location.route("/vendedor/registro")
        return
      }
      if (available.length === 1) {
        await selectSeller(available[0].sellerId)
        location.route("/vendedor")
        return
      }
      setMemberships(available)
    } catch (error) {
      setSubmit({ pending: false, error: getErrorMessage(error) })
    } finally {
      setSubmit((current) => ({ ...current, pending: false }))
    }
  }

  async function handleSelect(sellerId: string) {
    setSubmit({ pending: true, error: null })
    try {
      await selectSeller(sellerId)
      location.route("/vendedor")
    } catch (error) {
      setSubmit({ pending: false, error: getErrorMessage(error) })
    } finally {
      setSubmit((current) => ({ ...current, pending: false }))
    }
  }

  return (
    <main class="content-page">
      <PageRoute current="Acceso vendedor" />
      <div class="auth-layout">
        <section class="auth-copy">
          <h1>Tu tienda, tu camino.</h1>
          <p>
            Accede con tu cuenta de vendedor para gestionar tu perfil y tus
            publicaciones.
          </p>
          <a class="text-link" href="/entrar">
            ¿Compras en Mercur? Accede a tu cuenta
          </a>
        </section>
        {memberships ? (
          <section class="route-form" aria-labelledby="seller-choose-title">
            <div class="form-route-heading">
              <span class="route-node route-node--lime" aria-hidden="true" />
              <h2 id="seller-choose-title">Elige tu tienda</h2>
            </div>
            <p class="form-footnote">
              Tu cuenta tiene acceso a más de un espacio de vendedor.
            </p>
            <div class="membership-list">
              {memberships.map((membership) => (
                <button
                  class="membership-option"
                  type="button"
                  disabled={submit.pending}
                  onClick={() => void handleSelect(membership.sellerId)}
                  key={membership.sellerId}
                >
                  <span class="route-node route-node--lime" aria-hidden="true" />
                  <span>
                    <strong>{membership.name}</strong>
                    <small>{membership.status}</small>
                  </span>
                  <span aria-hidden="true">→</span>
                </button>
              ))}
            </div>
            {submit.error && (
              <p class="form-error" role="alert">{submit.error}</p>
            )}
          </section>
        ) : (
          <form class="route-form" onSubmit={handleSubmit}>
            <div class="form-route-heading">
              <span class="route-node route-node--lime" aria-hidden="true" />
              <h2>Acceso de vendedor</h2>
            </div>
            <label class="field" for="member-email">
              <span>Correo electrónico</span>
              <input
                id="member-email"
                type="email"
                name="email"
                autoComplete="username"
                required
                value={email}
                onInput={(event) => setEmail(event.currentTarget.value)}
              />
            </label>
            <label class="field" for="member-password">
              <span>Contraseña</span>
              <input
                id="member-password"
                type="password"
                name="password"
                autoComplete="current-password"
                required
                value={password}
                onInput={(event) => setPassword(event.currentTarget.value)}
              />
            </label>
            {submit.error && (
              <p class="form-error" role="alert">{submit.error}</p>
            )}
            <button
              class="button button--seller button--full"
              type="submit"
              disabled={submit.pending}
            >
              {submit.pending ? "Validando…" : "Iniciar sesión"}
            </button>
            <p class="form-footnote">
              ¿Aún no tienes una tienda? Inicia sesión con tu cuenta de
              vendedor y completa el registro.
            </p>
          </form>
        )}
      </div>
    </main>
  )
}

function SellerOnboardingPage() {
  const location = useLocation()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [handle, setHandle] = useState("")
  const [phone, setPhone] = useState("")
  const [currencyCode, setCurrencyCode] = useState("")
  const [submit, setSubmit] = useState<SubmitState>({
    pending: false,
    error: null,
  })

  if (authState.memberSession.value.status !== "authenticated") {
    return <AccessGate title="Accede para empezar" href="/vendedor/entrar" />
  }
  if (authState.sellerMemberships.value.length > 0) {
    return (
      <AccessGate
        title="Tu cuenta ya tiene una tienda asociada"
        href="/vendedor/seleccionar"
        action="Elegir tienda"
      />
    )
  }

  async function handleSubmit(event: Event) {
    event.preventDefault()
    setSubmit({ pending: true, error: null })
    try {
      await registerSeller({
        name,
        email,
        handle: handle || undefined,
        phone: phone || undefined,
        currency_code: currencyCode.trim().toLowerCase(),
      })
      location.route("/vendedor")
    } catch (error) {
      setSubmit({ pending: false, error: getErrorMessage(error) })
    } finally {
      setSubmit((current) => ({ ...current, pending: false }))
    }
  }

  return (
    <main class="content-page">
      <PageRoute current="Registro de tienda" />
      <div class="onboarding-layout">
        <section class="auth-copy">
          <h1>Abre tu espacio de vendedor.</h1>
          <p>
            Completa los datos de tu perfil. La plataforma revisará el estado
            de tu tienda antes de habilitar publicaciones.
          </p>
          <div class="notice-line notice-line--lime">
            <span class="route-node route-node--lime" aria-hidden="true" />
            <p>
              Tu tienda comienza en estado pendiente de aprobación.
            </p>
          </div>
        </section>
        <form class="route-form" onSubmit={handleSubmit}>
          <div class="form-route-heading">
            <span class="route-node route-node--lime" aria-hidden="true" />
            <h2>Perfil de tienda</h2>
          </div>
          <label class="field" for="seller-name">
            <span>Nombre de la tienda</span>
            <input
              id="seller-name"
              name="name"
              autoComplete="organization"
              required
              value={name}
              onInput={(event) => setName(event.currentTarget.value)}
            />
          </label>
          <label class="field" for="seller-email">
            <span>Correo de contacto</span>
            <input
              id="seller-email"
              type="email"
              name="email"
              autoComplete="email"
              required
              value={email}
              onInput={(event) => setEmail(event.currentTarget.value)}
            />
          </label>
          <div class="field-pair">
            <label class="field" for="seller-handle">
              <span>Identificador público</span>
              <input
                id="seller-handle"
                name="handle"
                autoComplete="off"
                value={handle}
                onInput={(event) => setHandle(event.currentTarget.value)}
              />
            </label>
            <label class="field" for="seller-phone">
                <span>WhatsApp (opcional)</span>
              <input
                id="seller-phone"
                type="tel"
                name="phone"
                autoComplete="tel"
                value={phone}
                onInput={(event) => setPhone(event.currentTarget.value)}
              />
            </label>
          </div>
          <label class="field" for="seller-currency">
            <span>Moneda de la tienda</span>
            <input
              id="seller-currency"
              name="currency_code"
              autoComplete="off"
              maxLength={3}
              minLength={3}
              pattern="[A-Za-z]{3}"
              required
              value={currencyCode}
              onInput={(event) => setCurrencyCode(event.currentTarget.value)}
            />
            <small>Usa el código de moneda configurado para la plataforma.</small>
          </label>
          {submit.error && (
            <p class="form-error" role="alert">{submit.error}</p>
          )}
          <button
            class="button button--seller button--full"
            type="submit"
            disabled={submit.pending}
          >
            {submit.pending ? "Enviando…" : "Enviar perfil"}
          </button>
        </form>
      </div>
    </main>
  )
}

function SellerSelectionPage() {
  const location = useLocation()
  const [submit, setSubmit] = useState<SubmitState>({
    pending: false,
    error: null,
  })
  const memberships = authState.sellerMemberships.value

  if (authState.memberSession.value.status !== "authenticated") {
    return <AccessGate title="Accede a tu espacio" href="/vendedor/entrar" />
  }
  if (memberships.length === 0) {
    return (
      <AccessGate
        title="Aún no tienes una tienda"
        href="/vendedor/registro"
        action="Completar registro"
      />
    )
  }

  async function handleSelect(sellerId: string) {
    setSubmit({ pending: true, error: null })
    try {
      await selectSeller(sellerId)
      location.route("/vendedor")
    } catch (error) {
      setSubmit({ pending: false, error: getErrorMessage(error) })
    } finally {
      setSubmit((current) => ({ ...current, pending: false }))
    }
  }

  return (
    <main class="content-page">
      <PageRoute current="Seleccionar tienda" />
      <section class="selection-page">
        <h1>Elige una tienda para continuar.</h1>
        <p class="page-lede">
          Las operaciones se realizarán en el espacio de vendedor seleccionado.
        </p>
        <div class="membership-list">
          {memberships.map((membership) => (
            <button
              class="membership-option"
              type="button"
              disabled={submit.pending}
              onClick={() => void handleSelect(membership.sellerId)}
              key={membership.sellerId}
            >
              <span class="route-node route-node--lime" aria-hidden="true" />
              <span>
                <strong>{membership.name}</strong>
                <small>{membership.status}</small>
              </span>
              <span aria-hidden="true">→</span>
            </button>
          ))}
        </div>
        {submit.error && <p class="form-error" role="alert">{submit.error}</p>}
      </section>
    </main>
  )
}

function AccessGate({
  title,
  href,
  action = "Continuar",
}: {
  title: string
  href: string
  action?: string
}) {
  return (
    <main class="content-page">
      <PageRoute current="Acceso" />
      <section class="access-gate">
        <span class="route-node route-node--blue" aria-hidden="true" />
        <h1>{title}</h1>
        <a class="button button--primary" href={href}>{action}</a>
      </section>
    </main>
  )
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

function NotFoundPage() {
  return (
    <main class="content-page">
      <div class="status-route">
        <span class="route-node route-node--error" aria-hidden="true" />
        <span>Ruta no encontrada</span>
      </div>
      <h1>Ese camino no existe.</h1>
      <p class="page-lede">Regresa al inicio o elige otra ruta del marketplace.</p>
      <a class="button button--primary" href="/">Volver al inicio</a>
    </main>
  )
}
