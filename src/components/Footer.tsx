import { PROVINCES_CR } from '../lib/constants'

export function Footer() {
  return (
    <footer class="site-footer">
      <div class="container footer-grid">
        <div class="footer-col">
          <div class="brand footer-brand">
            <span class="brand-badge" aria-hidden="true">🪑</span>
            <div class="brand-text">
              <span class="brand-title">MueblesUsados</span>
              <span class="brand-domain">.cr</span>
            </div>
          </div>
          <p class="footer-desc">
            El portal clasificado C2C de muebles en Costa Rica. Comprá y vendé
            muebles nuevos, como nuevos y usados sin comisiones y con trato
            directo por WhatsApp.
          </p>
        </div>

        <div class="footer-col">
          <h3>Navegación</h3>
          <ul class="footer-links">
            <li><a href="/">Inicio</a></li>
            <li><a href="/explorar">Catálogo Completo</a></li>
            <li><a href="/anunciar">Publicar un Mueble</a></li>
            <li><a href="/favoritos">Mis Favoritos</a></li>
            <li><a href="/mis-anuncios">Mis Anuncios</a></li>
          </ul>
        </div>

        <div class="footer-col">
          <h3>Muebles por Provincia</h3>
          <ul class="footer-links">
            {PROVINCES_CR.map((prov) => (
              <li key={prov}>
                <a href={`/explorar?provincia=${encodeURIComponent(prov)}`}>
                  Muebles en {prov}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div class="container footer-bottom">
        <p>© {new Date().getFullYear()} MueblesUsados.cr — Hecho para Costa Rica 🇨🇷</p>
      </div>
    </footer>
  )
}
