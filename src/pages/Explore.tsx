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

const PER_PAGE = 12

export function Explore() {
  const location = useLocation()
  const categories = categoriesList.value

  const getQueryParam = (primary: string, fallback?: string): string => {
    if (typeof window === 'undefined') return ''
    const params = new URLSearchParams(window.location.search)
    return params.get(primary) || (fallback ? params.get(fallback) || '' : '')
  }

  const [q, setQ] = useState(() => getQueryParam('q'))
  const [category, setCategory] = useState(() =>
    getQueryParam('categoria', 'category'),
  )
  const [condition, setCondition] = useState(() =>
    getQueryParam('condicion', 'condition'),
  )
  const [space, setSpace] = useState(() => getQueryParam('espacio', 'space'))
  const [province, setProvince] = useState(() =>
    getQueryParam('provincia', 'province'),
  )
  const [sort, setSort] = useState(
    () => getQueryParam('orden', 'sort') || '-created',
  )

  const [items, setItems] = useState<ListingRecord[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  useEffect(() => {
    if (categoriesList.value.length === 0) {
      void loadCategories()
    }
  }, [])

  // Sync URL query params when filters change
  useEffect(() => {
    const params = new URLSearchParams()
    if (q.trim()) params.set('q', q.trim())
    if (category) params.set('categoria', category)
    if (condition) params.set('condicion', condition)
    if (space) params.set('espacio', space)
    if (province) params.set('provincia', province)
    if (sort && sort !== '-created') params.set('orden', sort)

    const qs = params.toString()
    const targetUrl = qs ? `/explorar?${qs}` : '/explorar'
    if (typeof window !== 'undefined') {
      const currentFull = window.location.pathname + window.location.search
      if (currentFull !== targetUrl) {
        window.history.replaceState(null, '', targetUrl)
      }
    }

    void fetchListings(1, false)
  }, [q, category, condition, space, province, sort, location.url])

  const buildFilterExpr = (): string => {
    const clauses: string[] = ['status = "active"']

    if (q.trim()) {
      clauses.push(
        pb.filter('(title ~ {:q} || description ~ {:q})', { q: q.trim() }),
      )
    }

    if (category) {
      // Allow matching either category record ID or slug
      const matchedCat = categoriesList.value.find(
        (c) => c.id === category || c.slug === category,
      )
      const catId = matchedCat ? matchedCat.id : category
      clauses.push(pb.filter('category = {:catId}', { catId }))
    }

    if (condition) {
      clauses.push(pb.filter('condition = {:condition}', { condition }))
    }

    if (space) {
      clauses.push(pb.filter('space = {:space}', { space }))
    }

    if (province) {
      clauses.push(pb.filter('province = {:province}', { province }))
    }

    return clauses.join(' && ')
  }

  const fetchListings = async (targetPage: number, append: boolean) => {
    if (append) {
      setLoadingMore(true)
    } else {
      setLoading(true)
    }

    try {
      const filter = buildFilterExpr()
      const res = await pb
        .collection('listings')
        .getList<ListingRecord>(targetPage, PER_PAGE, {
          filter,
          sort: sort || '-created',
          expand: 'category,seller',
        })

      if (append) {
        setItems((prev) => [...prev, ...res.items])
      } else {
        setItems(res.items)
      }
      setPage(res.page)
      setTotalPages(res.totalPages)
      setTotalItems(res.totalItems)
    } catch (err) {
      console.error('Error filtrando catálogo:', err)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  const clearFilters = () => {
    setQ('')
    setCategory('')
    setCondition('')
    setSpace('')
    setProvince('')
    setSort('-created')
  }

  return (
    <div class="explore-page container section">
      <div class="explore-header">
        <div>
          <h1>Explorar Catálogo de Muebles</h1>
          <p>
            {loading
              ? 'Buscando muebles disponibles...'
              : `${totalItems} ${totalItems === 1 ? 'mueble encontrado' : 'muebles encontrados'} en Costa Rica`}
          </p>
        </div>
        <button type="button" class="btn btn-ghost btn-sm" onClick={clearFilters}>
          Limpiar filtros
        </button>
      </div>

      <form
        class="filters-panel"
        action="/explorar"
        method="get"
        onSubmit={(e) => e.preventDefault()}
      >
        <div class="filters-grid">
          <div class="form-group">
            <label for="filter-q">Buscar por texto</label>
            <input
              id="filter-q"
              name="q"
              type="search"
              autocorrect="off"
              autocapitalize="off"
              spellcheck={false}
              value={q}
              onInput={(e) => setQ((e.target as HTMLInputElement).value)}
              placeholder="Título o descripción..."
            />
          </div>

          <div class="form-group">
            <label for="filter-category">Categoría</label>
            <select
              id="filter-category"
              name="categoria"
              value={category}
              onChange={(e) => setCategory((e.target as HTMLSelectElement).value)}
            >
              <option value="">Todas</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.icon ? `${cat.icon} ` : ''}
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          <div class="form-group">
            <label for="filter-condition">Estado</label>
            <select
              id="filter-condition"
              name="condicion"
              value={condition}
              onChange={(e) => setCondition((e.target as HTMLSelectElement).value)}
            >
              <option value="">Todos</option>
              {LISTING_CONDITIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div class="form-group">
            <label for="filter-space">Espacio</label>
            <select
              id="filter-space"
              name="espacio"
              value={space}
              onChange={(e) => setSpace((e.target as HTMLSelectElement).value)}
            >
              <option value="">Todos</option>
              {LISTING_SPACES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div class="form-group">
            <label for="filter-province">Provincia</label>
            <select
              id="filter-province"
              name="provincia"
              value={province}
              onChange={(e) => setProvince((e.target as HTMLSelectElement).value)}
            >
              <option value="">Todas las provincias</option>
              {PROVINCES_CR.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          <div class="form-group">
            <label for="filter-sort">Ordenar por</label>
            <select
              id="filter-sort"
              name="orden"
              value={sort}
              onChange={(e) => setSort((e.target as HTMLSelectElement).value)}
            >
              <option value="-created">Más recientes primero</option>
              <option value="+price">Precio: menor a mayor (₡)</option>
              <option value="-price">Precio: mayor a menor (₡)</option>
              <option value="-views">Lo más visto</option>
            </select>
          </div>
        </div>
      </form>

      {loading ? (
        <div class="loading-box">Cargando catálogo...</div>
      ) : items.length === 0 ? (
        <div class="empty-state">
          <h3>No encontramos muebles con esos filtros</h3>
          <p>Probá cambiando la provincia, categoría o término de búsqueda.</p>
          <button type="button" class="btn btn-outline" onClick={clearFilters}>
            Ver todo el catálogo
          </button>
        </div>
      ) : (
        <>
          <div class="listings-grid">
            {items.map((item) => (
              <ListingCard key={item.id} listing={item} />
            ))}
          </div>

          {page < totalPages && (
            <div class="load-more-wrap">
              <button
                type="button"
                class="btn btn-outline"
                disabled={loadingMore}
                onClick={() => void fetchListings(page + 1, true)}
              >
                {loadingMore ? 'Cargando más muebles...' : 'Cargar más anuncios'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
