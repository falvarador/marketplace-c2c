import { LocationProvider, Router, Route } from 'preact-iso'
import { Navbar } from './components/Navbar'
import { Footer } from './components/Footer'
import { AuthModal } from './components/AuthModal'
import { Home } from './pages/Home'
import { Explore } from './pages/Explore'
import { ListingDetail } from './pages/ListingDetail'
import { ListingForm } from './pages/ListingForm'
import { Favorites } from './pages/Favorites'
import { MyListings } from './pages/MyListings'

function NotFound() {
  return (
    <div class="container section">
      <div class="empty-state">
        <h2>Página no encontrada</h2>
        <p>La ruta que buscás no existe en MueblesUsados.cr.</p>
        <a href="/" class="btn btn-primary">
          Ir al Inicio
        </a>
      </div>
    </div>
  )
}

export function App() {
  return (
    <LocationProvider>
      <div class="app-shell">
        <Navbar />
        <main class="main-content">
          <Router>
            <Route path="/" component={Home} />
            <Route path="/explorar" component={Explore} />
            <Route path="/anuncio/:id" component={ListingDetail} />
            <Route path="/mueble/:id" component={ListingDetail} />
            <Route path="/anunciar" component={ListingForm} />
            <Route path="/editar/:id" component={ListingForm} />
            <Route path="/favoritos" component={Favorites} />
            <Route path="/mis-anuncios" component={MyListings} />
            <Route default component={NotFound} />
          </Router>
        </main>
        <Footer />
        <AuthModal />
      </div>
    </LocationProvider>
  )
}
