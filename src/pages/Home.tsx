import { useEffect, useState } from 'preact/hooks'
import { useLocation } from 'preact-iso'
import { ListingCard } from '../components/ListingCard'
import {
  LISTING_CONDITIONS,
  LISTING_SPACES,
  PROVINCES_CR,
  type ListingRecord,
} from '../lib/constants'
import { categoriesList, loadCategories, pb } from '../lib/pb'

export function Home() {
  const location = useLocation()
  const categories = categoriesList.value

  // Quick search state
  const [keyword, setKeyword] = useState('')
  const [category, setCategory] = useState('')
  const [condition, setCondition] = useState('')
  const [space, setSpace] = useState('')
  const [province, setProvince] = useState('')

  // Listings & province counts
  const [recentListings, setRecentListings] = useState<ListingRecord[]>([])
  const [mostViewedListings, setMostViewedListings] = useState<ListingRecord[]>([])
  const [provinceCounts, setProvinceCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (categoriesList.value.length === 0) {
      void loadCategories()
    }
    void fetchHomeData()
  }, [])

  const fetchHomeData = async () => {
    setLoading(true)
    try {
      const [recentRes, viewedRes, allActiveProvRes] = await Promise.all([
        pb.collection('listings').getList<ListingRecord>(1, 8, {
          filter: 'status = "active"',
          sort: '-created',
          expand: 'category,seller',
        }),
        pb.collection('listings').getList<ListingRecord>(1, 4, {
          filter: 'status = "active"',
          sort: '-views,-created',
          expand: 'category,seller',
        }),
        pb.collection('listings').getFullList<Pick<ListingRecord, 'id' | 'province'>>({
          filter: 'status = "active"',
          fields: 'id,province',
        }),
      ])

      setRecentListings(recentRes.items)
      setMostViewedListings(viewedRes.items)

      const counts: Record<string, number> = {}
      for (const prov of PROVINCES_CR) {
        counts[prov] = 0
      }
      for (const item of allActiveProvRes) {
        if (item.province && counts[item.province] !== undefined) {
          counts[item.province] += 1
        }
      }
      setProvinceCounts(counts)
    } catch (err) {
      console.error('Error cargando datos de inicio:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleQuickSearch = (e: Event) => {
    e.preventDefault()
    const params = new URLSearchParams()
    if (keyword.trim()) params.set('q', keyword.trim())
    if (category) params.set('categoria', category)
    if (condition) params.set('condicion', condition)
    if (space) params.set('espacio', space)
    if (province) params.set('provincia', province)
    const qs = params.toString()
    location.route(qs ? `/explorar?${qs}` : '/explorar')
  }

  return (
    <div class="home-page">
      <section class="hero-section">
        <div class="container">
          <div class="hero-content">
            <span class="hero-kicker">🇨🇷 Clasificados de Muebles en Costa Rica</span>
            <h1>Dale una segunda vida a tus muebles o amueblá tu hogar al mejor precio</h1>
            <p>
              Encontrá camas, juegos de sala, comedores, escritorios y antigüedades
              en las 7 provincias. Trato directo con el vendedor por WhatsApp.
            </p>
          </div>

          <form
            class="hero-search-form"
            action="/explorar"
            method="get"
            onSubmit={handleQuickSearch}
          >
            <div class="search-grid">
              <div class="form-group">
                <label for="hero-q">Palabra clave</label>
                <input
                  id="hero-q"
                  name="q"
                  type="search"
                  autocorrect="off"
                  autocapitalize="off"
                  spellcheck={false}
                  enterkeyhint="search"
                  value={keyword}
                  onInput={(e) => setKeyword((e.target as HTMLInputElement).value)}
                  placeholder="Ej. Cama guanacaste, sofá..."
                />
              </div>

              <div class="form-group">
                <label for="hero-cat">Categoría</label>
                <select
                  id="hero-cat"
                  name="categoria"
                  value={category}
                  onChange={(e) => setCategory((e.target as HTMLSelectElement).value)}
                >
                  <option value="">Todas las categorías</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.icon ? `${cat.icon} ` : ''}
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div class="form-group">
                <label for="hero-cond">Estado</label>
                <select
                  id="hero-cond"
                  name="condicion"
                  value={condition}
                  onChange={(e) => setCondition((e.target as HTMLSelectElement).value)}
                >
                  <option value="">Cualquier estado</option>
                  {LISTING_CONDITIONS.map((cond) => (
                    <option key={cond} value={cond}>
                      {cond}
                    </option>
                  ))}
                </select>
              </div>

              <div class="form-group">
                <label for="hero-space">Espacio</label>
                <select
                  id="hero-space"
                  name="espacio"
                  value={space}
                  onChange={(e) => setSpace((e.target as HTMLSelectElement).value)}
                >
                  <option value="">Todos los espacios</option>
                  {LISTING_SPACES.map((sp) => (
                    <option key={sp} value={sp}>
                      {sp}
                    </option>
                  ))}
                </select>
              </div>

              <div class="form-group">
                <label for="hero-prov">Provincia</label>
                <select
                  id="hero-prov"
                  name="provincia"
                  value={province}
                  onChange={(e) => setProvince((e.target as HTMLSelectElement).value)}
                >
                  <option value="">Toda Costa Rica</option>
                  {PROVINCES_CR.map((prov) => (
                    <option key={prov} value={prov}>
                      {prov}
                    </option>
                  ))}
                </select>
              </div>

              <div class="form-group search-submit-col">
                <button type="submit" class="btn btn-primary btn-block">
                  🔍 Buscar Muebles
                </button>
              </div>
            </div>
          </form>

          {categories.length > 0 && (
            <div class="category-pills" aria-label="Categorías populares">
              {categories.map((cat) => (
                <a
                  key={cat.id}
                  href={`/explorar?categoria=${encodeURIComponent(cat.id)}`}
                  class="category-pill"
                >
                  <span>{cat.icon || '🪑'}</span>
                  <span>{cat.name}</span>
                </a>
              ))}
            </div>
          )}
        </div>
      </section>

      <section class="section container">
        <div class="section-header">
          <div>
            <h2>Anuncios Recientes</h2>
            <p>Los últimos muebles publicados en Costa Rica</p>
          </div>
          <a href="/explorar" class="btn btn-outline">
            Ver todos →
          </a>
        </div>

        {loading ? (
          <div class="loading-box">Cargando anuncios recientes...</div>
        ) : recentListings.length === 0 ? (
          <div class="empty-state">
            <p>Aún no hay muebles publicados. ¡Sé el primero en anunciar!</p>
            <a href="/anunciar" class="btn btn-primary">
              + Publicar mi primer mueble
            </a>
          </div>
        ) : (
          <div class="listings-grid">
            {recentListings.map((item) => (
              <ListingCard key={item.id} listing={item} />
            ))}
          </div>
        )}
      </section>

      <section class="section section-alt">
        <div class="container">
          <div class="section-header">
            <div>
              <h2>Muebles por Provincia</h2>
              <p>Explorá anuncios activos cerca de tu ubicación en las 7 provincias</p>
            </div>
          </div>

          <div class="provinces-grid">
            {PROVINCES_CR.map((prov) => {
              const count = provinceCounts[prov] ?? 0
              return (
                <a
                  key={prov}
                  href={`/explorar?provincia=${encodeURIComponent(prov)}`}
                  class="province-card"
                >
                  <div class="province-card-name">📍 {prov}</div>
                  <div class="province-card-count">
                    <strong>{count}</strong> {count === 1 ? 'anuncio activo' : 'anuncios activos'}
                  </div>
                </a>
              )
            })}
          </div>
        </div>
      </section>

      <section class="section container">
        <div class="section-header">
          <div>
            <h2>🔥 Lo Más Visto</h2>
            <p>Los muebles con mayor interés de compradores esta semana</p>
          </div>
          <a href="/explorar?orden=-views" class="btn btn-ghost">
            Ver ranking completo →
          </a>
        </div>

        {loading ? (
          <div class="loading-box">Cargando los más vistos...</div>
        ) : mostViewedListings.length === 0 ? (
          <div class="empty-state">
            <p>No hay anuncios destacados disponibles en este momento.</p>
          </div>
        ) : (
          <div class="listings-grid">
            {mostViewedListings.map((item) => (
              <ListingCard key={item.id} listing={item} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
