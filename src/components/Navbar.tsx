import {
  authModalOpen,
  currentUser,
  favoriteCount,
  isAuthenticated,
  logout,
} from '../lib/pb'

export function Navbar() {
  const user = currentUser.value
  const loggedIn = isAuthenticated.value
  const favs = favoriteCount.value

  return (
    <header class="navbar">
      <div class="container navbar-inner">
        <a href="/" class="brand" aria-label="Muebles Usados Costa Rica - Inicio">
          <span class="brand-badge" aria-hidden="true">🪑</span>
          <div class="brand-text">
            <span class="brand-title">MueblesUsados</span>
            <span class="brand-domain">.cr</span>
          </div>
        </a>

        <nav class="nav-links" aria-label="Navegación principal">
          <a href="/" class="nav-link">Inicio</a>
          <a href="/explorar" class="nav-link">Explorar Catálogo</a>
          <a href="/favoritos" class="nav-link nav-fav-link">
            <span>Favoritos</span>
            {favs > 0 && <span class="badge-pill">{favs}</span>}
          </a>
          {loggedIn && (
            <a href="/mis-anuncios" class="nav-link">Mis Anuncios</a>
          )}
        </nav>

        <div class="nav-actions">
          <a
            href="/anunciar"
            class="btn btn-primary"
            onClick={(e) => {
              if (!loggedIn) {
                e.preventDefault()
                authModalOpen.value = true
              }
            }}
          >
            + Vender Mueble
          </a>

          {loggedIn ? (
            <div class="user-menu">
              <span class="user-chip" title={user?.email || ''}>
                👤 {user?.name || user?.email?.split('@')[0] || 'Mi Cuenta'}
              </span>
              <button
                type="button"
                class="btn btn-ghost btn-sm"
                onClick={() => logout()}
              >
                Salir
              </button>
            </div>
          ) : (
            <button
              type="button"
              class="btn btn-outline"
              onClick={() => {
                authModalOpen.value = true
              }}
            >
              Ingresar
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
