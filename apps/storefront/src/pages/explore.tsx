import { useEffect, useMemo, useState } from "preact/hooks"
import { useLocation } from "preact-iso"
import { authState } from "../store/auth"
import { wishlistProductIds, setWishlistProductIds } from "../store/wishlist"
import {
  createSearchParams,
  flattenCategories,
  formatPrice,
  getCategoryAttributes,
  getProductOffers,
  getProductPrice,
  getProductCategories,
  searchCatalog,
  type CatalogQuery,
  type MarketplaceProduct,
  type ProductAttributeDefinition,
  type ProductCategory,
} from "../lib/marketplace"
import { requestMarketplaceApi } from "../lib/api"

const pageSize = 12

function PageRoute({ current }: { current: string }) {
  return (
    <nav class="page-route" aria-label="Ruta actual">
      <a href="/">Inicio</a>
      <span class="route-connector" aria-hidden="true" />
      <span class="page-route-current" aria-current="page">{current}</span>
    </nav>
  )
}

function readFilters(): CatalogQuery {
  const params = new URLSearchParams(window.location.search)
  const attributes: Record<string, string | string[]> = {}
  for (const [key, value] of params) {
    if (!key.startsWith("attr.")) continue
    const handle = key.slice(5)
    const current = attributes[handle]
    attributes[handle] = current
      ? [...(Array.isArray(current) ? current : [current]), value]
      : value
  }
  return {
    query: params.get("q") ?? "",
    categoryId: params.get("category") ?? "",
    countryCode: params.get("country") ?? "",
    region: params.get("region") ?? "",
    locality: params.get("locality") ?? "",
    minPrice: params.get("min") ?? "",
    maxPrice: params.get("max") ?? "",
    attributes,
  }
}

function ProductCard({ product }: { product: MarketplaceProduct }) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const favorite = wishlistProductIds.value.includes(product.id)
  const offer = getProductOffers(product)[0]
  const price = getProductPrice(product)

  async function toggleFavorite(event: Event) {
    event.preventDefault()
    event.stopPropagation()
    if (authState.customerSession.value.status !== "authenticated") {
      window.location.assign(`/entrar?return=${encodeURIComponent(window.location.pathname + window.location.search)}`)
      return
    }
    setPending(true)
    setError(null)
    try {
      if (favorite) {
        await requestMarketplaceApi(
          `/store/wishlist/items/${encodeURIComponent(product.id)}`,
          { actor: "customer", method: "DELETE" },
        )
        setWishlistProductIds(
          wishlistProductIds.value.filter((id) => id !== product.id),
        )
      } else {
        await requestMarketplaceApi("/store/wishlist", {
          actor: "customer",
          method: "POST",
          body: { product_id: product.id },
        })
        setWishlistProductIds([...wishlistProductIds.value, product.id])
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

  return (
    <article class="product-card">
      <a class="product-card-link" href={`/item/${encodeURIComponent(product.handle)}`}>
        <div class="product-card-image">
          {product.thumbnail ? (
            <img src={product.thumbnail} alt="" loading="lazy" />
          ) : (
            <span aria-hidden="true">Sin imagen</span>
          )}
          {offer?.in_stock === false && (
            <span class="product-badge">Agotado</span>
          )}
        </div>
        <div class="product-card-body">
          <div class="product-card-meta">
            <span>{product.categories?.[0]?.name ?? "Marketplace"}</span>
            <span>{offer?.seller?.name ?? "Vendedor independiente"}</span>
          </div>
          <h2>{product.title}</h2>
          {product.subtitle && <p>{product.subtitle}</p>}
          <strong class="product-card-price">
            {price
              ? formatPrice(price.amount, price.currencyCode)
              : "Consultar precio"}
          </strong>
        </div>
      </a>
      <button
        class={`favorite-button${favorite ? " is-active" : ""}`}
        type="button"
        aria-label={favorite ? "Quitar de favoritos" : "Guardar en favoritos"}
        aria-pressed={favorite}
        disabled={pending}
        onClick={(event) => void toggleFavorite(event)}
      >
        {favorite ? "♥" : "♡"}
      </button>
      {error && <p class="product-card-error" role="alert">{error}</p>}
    </article>
  )
}

function AttributeFilter({
  attribute,
  value,
  onChange,
}: {
  attribute: ProductAttributeDefinition
  value: string | string[] | undefined
  onChange: (value: string | string[] | undefined) => void
}) {
  if (attribute.type === "single_select" && attribute.values?.length) {
    return (
      <label class="field">
        <span>{attribute.name}</span>
        <select
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.currentTarget.value || undefined)}
        >
          <option value="">Cualquier valor</option>
          {attribute.values.map((option) => (
            <option value={option.id} key={option.id}>{option.name}</option>
          ))}
        </select>
      </label>
    )
  }
  if (attribute.type === "multi_select" && attribute.values?.length) {
    const selected = Array.isArray(value) ? value : []
    return (
      <fieldset class="filter-fieldset">
        <legend>{attribute.name}</legend>
        {attribute.values.map((option) => (
          <label class="check-field" key={option.id}>
            <input
              type="checkbox"
              checked={selected.includes(option.id)}
              onChange={(event) => {
                const next = event.currentTarget.checked
                  ? [...selected, option.id]
                  : selected.filter((item) => item !== option.id)
                onChange(next.length ? next : undefined)
              }}
            />
            <span>{option.name}</span>
          </label>
        ))}
      </fieldset>
    )
  }
  if (attribute.type === "toggle") {
    return (
      <label class="field">
        <span>{attribute.name}</span>
        <select
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.currentTarget.value || undefined)}
        >
          <option value="">Cualquier valor</option>
          <option value="true">Sí</option>
          <option value="false">No</option>
        </select>
      </label>
    )
  }
  return (
    <label class="field">
      <span>{attribute.name}</span>
      <input
        type="text"
        value={typeof value === "string" ? value : ""}
        onInput={(event) => onChange(event.currentTarget.value || undefined)}
      />
    </label>
  )
}

export function ExplorePage() {
  const location = useLocation()
  const [filters, setFilters] = useState<CatalogQuery>(readFilters)
  const [categories, setCategories] = useState<ProductCategory[]>([])
  const [attributes, setAttributes] = useState<ProductAttributeDefinition[]>([])
  const [products, setProducts] = useState<MarketplaceProduct[]>([])
  const [page, setPage] = useState(
    Number(new URLSearchParams(window.location.search).get("page")) || 1,
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const flatCategories = useMemo(() => flattenCategories(categories), [categories])
  const pageCount = Math.max(1, Math.ceil(products.length / pageSize))
  const pageProducts = products.slice((page - 1) * pageSize, page * pageSize)

  useEffect(() => {
    void getProductCategories()
      .then(setCategories)
      .catch((requestError: unknown) => {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "No se pudieron cargar las categorías.",
        )
      })
  }, [])

  useEffect(() => {
    if (!filters.categoryId) {
      setAttributes([])
      return
    }
    void getCategoryAttributes(filters.categoryId)
      .then(setAttributes)
      .catch((requestError: unknown) => {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "No se pudieron cargar los filtros de la categoría.",
        )
      })
  }, [filters.categoryId])

  useEffect(() => {
    const nextFilters = readFilters()
    setFilters(nextFilters)
    setPage(Number(new URLSearchParams(window.location.search).get("page")) || 1)
  }, [location.url])

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    void searchCatalog(filters)
      .then((result) => {
        if (active) {
          setProducts(result.products)
          setPage((current) => Math.min(current, Math.max(1, Math.ceil(result.count / pageSize))))
        }
      })
      .catch((requestError: unknown) => {
        if (active) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "No se pudo cargar el catálogo.",
          )
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [JSON.stringify(filters)])

  function updateAttribute(handle: string, value: string | string[] | undefined) {
    setFilters((current) => {
      const next = { ...current, attributes: { ...current.attributes } }
      if (value === undefined) delete next.attributes?.[handle]
      else next.attributes = { ...next.attributes, [handle]: value }
      return next
    })
  }

  function submitFilters(event: Event) {
    event.preventDefault()
    const params = createSearchParams(filters)
    params.set("page", "1")
    setPage(1)
    location.route(`/explorar?${params.toString()}`)
  }

  function changePage(nextPage: number) {
    const params = createSearchParams(filters)
    params.set("page", String(nextPage))
    setPage(nextPage)
    location.route(`/explorar?${params.toString()}`)
  }

  return (
    <main class="content-page">
      <PageRoute current="Explorar" />
      <div class="catalog-heading">
        <div>
          <div class="route-label">
            <span class="route-node route-node--blue" aria-hidden="true" />
            <span>Catálogo abierto</span>
          </div>
          <h1>Explorar productos</h1>
          <p class="page-lede">
            Encuentra artículos de distintas categorías y elige cómo quieres
            conectar con cada vendedor.
          </p>
        </div>
        <span class="catalog-count">
          {loading ? "Buscando…" : `${products.length} resultados`}
        </span>
      </div>
      <div class="catalog-layout">
        <form class="catalog-filters" onSubmit={submitFilters}>
          <div class="filter-heading">
            <h2>Filtros</h2>
            <button
              class="text-button"
              type="button"
              onClick={() => {
                setFilters({})
                setPage(1)
                location.route("/explorar")
              }}
            >
              Limpiar
            </button>
          </div>
          <label class="field">
            <span>Buscar</span>
            <input
              type="search"
              value={filters.query ?? ""}
              onInput={(event) =>
                setFilters({ ...filters, query: event.currentTarget.value })
              }
            />
          </label>
          <label class="field">
            <span>Categoría</span>
            <select
              value={filters.categoryId ?? ""}
              onChange={(event) =>
                setFilters({
                  ...filters,
                  categoryId: event.currentTarget.value || undefined,
                  attributes: {},
                })
              }
            >
              <option value="">Todas las categorías</option>
              {flatCategories.map((category) => (
                <option value={category.id} key={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <fieldset class="filter-fieldset">
            <legend>Precio</legend>
            <div class="field-pair">
              <label class="field">
                <span>Mínimo</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={filters.minPrice ?? ""}
                  onInput={(event) =>
                    setFilters({ ...filters, minPrice: event.currentTarget.value })
                  }
                />
              </label>
              <label class="field">
                <span>Máximo</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={filters.maxPrice ?? ""}
                  onInput={(event) =>
                    setFilters({ ...filters, maxPrice: event.currentTarget.value })
                  }
                />
              </label>
            </div>
          </fieldset>
          <fieldset class="filter-fieldset">
            <legend>Ubicación</legend>
            <label class="field">
              <span>País (ISO alpha-2)</span>
              <input
                type="text"
                maxLength={2}
                value={filters.countryCode ?? ""}
                onInput={(event) =>
                  setFilters({
                    ...filters,
                    countryCode: event.currentTarget.value.toUpperCase(),
                  })
                }
              />
            </label>
            <label class="field">
              <span>Provincia o región</span>
              <input
                type="text"
                value={filters.region ?? ""}
                onInput={(event) =>
                  setFilters({ ...filters, region: event.currentTarget.value })
                }
              />
            </label>
            <label class="field">
              <span>Localidad</span>
              <input
                type="text"
                value={filters.locality ?? ""}
                onInput={(event) =>
                  setFilters({ ...filters, locality: event.currentTarget.value })
                }
              />
            </label>
          </fieldset>
          {attributes.map((attribute) => (
            <AttributeFilter
              attribute={attribute}
              value={filters.attributes?.[attribute.handle]}
              onChange={(value) => updateAttribute(attribute.handle, value)}
              key={attribute.id}
            />
          ))}
          {error && <p class="form-error" role="alert">{error}</p>}
          <button class="button button--primary button--full" type="submit">
            Aplicar filtros
          </button>
        </form>
        <section class="catalog-results" aria-live="polite">
          {loading ? (
            <p class="catalog-status">Buscando en el marketplace…</p>
          ) : error ? (
            <div class="catalog-status catalog-status--error">
              <p>{error}</p>
              <button
                class="button button--quiet"
                type="button"
                onClick={() => setFilters({ ...filters })}
              >
                Reintentar
              </button>
            </div>
          ) : pageProducts.length ? (
            <>
              <div class="product-grid">
                {pageProducts.map((product) => (
                  <ProductCard product={product} key={product.id} />
                ))}
              </div>
              {pageCount > 1 && (
                <nav class="pagination" aria-label="Paginación del catálogo">
                  <button
                    class="button button--quiet"
                    type="button"
                    disabled={page <= 1}
                    onClick={() => changePage(page - 1)}
                  >
                    Anterior
                  </button>
                  <span>Página {page} de {pageCount}</span>
                  <button
                    class="button button--quiet"
                    type="button"
                    disabled={page >= pageCount}
                    onClick={() => changePage(page + 1)}
                  >
                    Siguiente
                  </button>
                </nav>
              )}
            </>
          ) : (
            <div class="catalog-empty">
              <span class="route-node route-node--blue" aria-hidden="true" />
              <h2>No encontramos productos</h2>
              <p>Prueba con otros términos o elimina algunos filtros.</p>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
