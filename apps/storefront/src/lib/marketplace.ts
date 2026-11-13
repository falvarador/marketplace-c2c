import { requestMarketplaceApi } from "./api"
import { activeCartId, setActiveCartId } from "../store/cart"

export interface ProductCategory {
  id: string
  name: string
  handle: string
  parent_category_id?: string | null
  category_children?: ProductCategory[]
}

export interface ProductAttributeDefinition {
  id: string
  name: string
  handle: string
  description?: string | null
  type: "single_select" | "multi_select" | "text" | "toggle" | "unit"
  is_required?: boolean
  is_filterable?: boolean
  values?: Array<{ id: string; name: string }>
}

export interface ProductAttributeValue {
  id?: string
  name?: string
  handle?: string
  attribute_id?: string
  attribute?: ProductAttributeDefinition
  value?: string | number | boolean
}

export interface MarketplaceOffer {
  id: string
  seller_id: string
  variant_id: string
  seller?: {
    id: string
    name: string
    handle?: string | null
    description?: string | null
  }
  prices?: Array<{ amount: number; currency_code: string }>
  calculated_price?: {
    calculated_amount?: number
    currency_code?: string
  }
  in_stock?: boolean
  inventory_quantity?: number
}

export interface ProductVariant {
  id: string
  title: string
  options?: Array<{ id: string; value: string; option_id?: string }>
  calculated_price?: {
    calculated_amount?: number
    currency_code?: string
  }
  offers?: MarketplaceOffer[]
}

export interface MarketplaceProduct {
  id: string
  title: string
  handle: string
  subtitle?: string | null
  description?: string | null
  status?: string
  thumbnail?: string | null
  images?: Array<{ id?: string; url: string }>
  categories?: ProductCategory[]
  variants?: ProductVariant[]
  product_attribute_values?: ProductAttributeValue[]
  scoped_attributes?: ProductAttributeValue[]
}

export interface ProductLocation {
  id: string
  country_code?: string | null
  region?: string | null
  locality?: string | null
  product?: { id: string }
}

export interface CatalogQuery {
  query?: string
  categoryId?: string
  attributes?: Record<string, string | string[]>
  countryCode?: string
  region?: string
  locality?: string
  minPrice?: string
  maxPrice?: string
  regionId?: string
}

export interface CatalogResponse {
  products: MarketplaceProduct[]
  count: number
}

export interface MarketplaceRegion {
  id: string
  currency_code: string
}

export function normalizeWhatsAppPhone(value: string): string | null {
  const phone = value.replace(/[\s().-]/g, "")
  if (!/^\+?[1-9]\d{7,14}$/.test(phone)) return null
  return phone.startsWith("+") ? phone : `+${phone}`
}

export function isOfferAvailable(
  offer?: Pick<MarketplaceOffer, "in_stock" | "inventory_quantity">,
): boolean {
  return Boolean(
    offer &&
      offer.in_stock !== false &&
      (offer.inventory_quantity === undefined || offer.inventory_quantity > 0),
  )
}

const productFields = [
  "id",
  "title",
  "subtitle",
  "description",
  "handle",
  "status",
  "thumbnail",
  "*images",
  "*categories",
  "*variants",
  "*variants.options",
  "variants.calculated_price",
  "variants.offers.*",
  "variants.offers.seller.*",
  "product_attribute_values.*",
  "product_attribute_values.attribute.*",
  "product_attribute_values.attribute.values.*",
  "scoped_attributes.*",
  "scoped_attributes.values.*",
].join(",")

function buildProductQuery(query: CatalogQuery, offset: number): URLSearchParams {
  const params = new URLSearchParams({
    fields: productFields,
    limit: "100",
    offset: String(offset),
  })
  if (query.query?.trim()) params.set("q", query.query.trim())
  if (query.categoryId) params.set("category_id", query.categoryId)
  if (query.regionId) params.set("region_id", query.regionId)
  for (const [handle, value] of Object.entries(query.attributes ?? {})) {
    if (Array.isArray(value)) {
      for (const selected of value) {
        params.append(`attributes[${handle}]`, selected)
      }
    } else {
      params.set(`attributes[${handle}]`, value)
    }
  }
  return params
}

export async function getProductCategories(): Promise<ProductCategory[]> {
  const params = new URLSearchParams({
    fields: "*category_children",
    limit: "100",
    is_active: "true",
  })
  const { product_categories } = await requestMarketplaceApi<{
    product_categories: ProductCategory[]
  }>(`/store/product-categories?${params}`)
  return product_categories
}

export async function getCategoryAttributes(
  categoryId: string,
): Promise<ProductAttributeDefinition[]> {
  const { product_attributes } = await requestMarketplaceApi<{
    product_attributes: ProductAttributeDefinition[]
  }>(`/store/product-categories/${encodeURIComponent(categoryId)}/attributes`)
  return product_attributes
}

export async function getCategoryTransactionMode(
  categoryId: string,
): Promise<"checkout" | "lead"> {
  const { transaction_mode } = await requestMarketplaceApi<{
    transaction_mode: "checkout" | "lead"
  }>(
    `/store/product-categories/${encodeURIComponent(categoryId)}/marketplace-policy`,
  )
  return transaction_mode
}

export async function searchCatalog(
  query: CatalogQuery,
): Promise<CatalogResponse> {
  const minPrice = parsePriceFilter(query.minPrice, "mínimo")
  const maxPrice = parsePriceFilter(query.maxPrice, "máximo")
  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
    throw new Error("El precio mínimo no puede superar el precio máximo.")
  }

  let allowedProductIds: Set<string> | undefined
  if (query.countryCode || query.region || query.locality) {
    const locationParams = new URLSearchParams()
    if (query.countryCode) {
      locationParams.set("country_code", query.countryCode)
    }
    if (query.region?.trim()) locationParams.set("region", query.region.trim())
    if (query.locality?.trim()) {
      locationParams.set("locality", query.locality.trim())
    }
    const { locations } = await requestMarketplaceApi<{
      locations: ProductLocation[]
    }>(`/store/marketplace-data?${locationParams}`)
    allowedProductIds = new Set(
      locations.map((location) => location.product?.id).filter(
        (id): id is string => Boolean(id),
      ),
    )
    if (allowedProductIds.size === 0) return { products: [], count: 0 }
  }

  const regionId = query.regionId ?? (await getStoreRegion())?.id
  const products: MarketplaceProduct[] = []
  let offset = 0
  let count = 0
  do {
    const params = buildProductQuery({ ...query, regionId }, offset)
    const response = await requestMarketplaceApi<CatalogResponse>(
      `/store/products?${params}`,
    )
    count = response.count
    products.push(...response.products)
    offset += response.products.length
    if (response.products.length === 0) break
  } while (offset < count)

  const filtered = products.filter((product) => {
    if (allowedProductIds && !allowedProductIds.has(product.id)) return false
    const prices = product.variants?.flatMap((variant) => {
      const amount = variant.calculated_price?.calculated_amount
      return typeof amount === "number" ? [amount] : []
    }) ?? []
    if (
      (minPrice !== undefined || maxPrice !== undefined) &&
      !prices.some((amount) =>
        (minPrice === undefined || amount >= minPrice) &&
        (maxPrice === undefined || amount <= maxPrice),
      )
    ) {
      return false
    }
    return true
  })
  return { products: filtered, count: filtered.length }
}

function parsePriceFilter(value: string | undefined, label: string): number | undefined {
  if (!value?.trim()) return undefined
  const amount = Number(value)
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error(`El precio ${label} debe ser un número válido y no negativo.`)
  }
  return amount
}

export async function getStoreRegion(): Promise<MarketplaceRegion | null> {
  const params = new URLSearchParams({
    fields: "id,currency_code",
    limit: "1",
  })
  const { regions } = await requestMarketplaceApi<{
    regions: MarketplaceRegion[]
  }>(`/store/regions?${params}`)
  return regions[0] ?? null
}

export async function getProductByHandle(
  handle: string,
): Promise<MarketplaceProduct | null> {
  const params = buildProductQuery({ query: "" }, 0)
  params.set("handle", handle)
  params.set("limit", "1")
  const { products } = await requestMarketplaceApi<CatalogResponse>(
    `/store/products?${params}`,
  )
  return products[0] ?? null
}

export async function getProductById(
  productId: string,
): Promise<MarketplaceProduct | null> {
  const params = new URLSearchParams({
    fields: productFields,
  })
  const { product } = await requestMarketplaceApi<{
    product?: MarketplaceProduct
  }>(`/store/products/${encodeURIComponent(productId)}?${params}`)
  return product ?? null
}

export async function getProductPolicy(
  productId: string,
): Promise<{ transaction_mode: "checkout" | "lead" }> {
  const { marketplace_policy } = await requestMarketplaceApi<{
    marketplace_policy: { transaction_mode: "checkout" | "lead" }
  }>(
    `/store/products/${encodeURIComponent(productId)}/marketplace-policy`,
  )
  return marketplace_policy
}

export async function getProductLocation(
  productId: string,
): Promise<ProductLocation | null> {
  const { locations } = await requestMarketplaceApi<{
    locations: ProductLocation[]
  }>("/store/marketplace-data")
  return locations.find((location) => location.product?.id === productId) ?? null
}

export function flattenCategories(
  categories: ProductCategory[],
): ProductCategory[] {
  return categories.flatMap((category) => [
    category,
    ...flattenCategories(category.category_children ?? []),
  ])
}

export function getProductAttributes(
  product: MarketplaceProduct,
): ProductAttributeValue[] {
  return product.product_attribute_values ?? product.scoped_attributes ?? []
}

export function getProductOffers(product: MarketplaceProduct): MarketplaceOffer[] {
  return product.variants?.flatMap((variant) => variant.offers ?? []) ?? []
}

export function getProductPrice(product: MarketplaceProduct): {
  amount: number
  currencyCode: string
} | null {
  const prices = product.variants?.flatMap((variant) => {
    const amount = variant.calculated_price?.calculated_amount
    return typeof amount === "number"
      ? [{ amount, currencyCode: variant.calculated_price?.currency_code ?? "" }]
      : []
  }) ?? []
  return prices.sort((left, right) => left.amount - right.amount)[0] ?? null
}

export function formatPrice(amount: number, currencyCode: string): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currencyCode.toUpperCase(),
  }).format(amount)
}

export function formatLocation(location: ProductLocation | null): string {
  if (!location) return "Ubicación no especificada"
  return [location.locality, location.region, location.country_code]
    .filter(Boolean)
    .join(", ")
}

export function createSearchParams(query: CatalogQuery): URLSearchParams {
  const params = new URLSearchParams()
  if (query.query) params.set("q", query.query)
  if (query.categoryId) params.set("category", query.categoryId)
  if (query.countryCode) params.set("country", query.countryCode)
  if (query.region) params.set("region", query.region)
  if (query.locality) params.set("locality", query.locality)
  if (query.minPrice) params.set("min", query.minPrice)
  if (query.maxPrice) params.set("max", query.maxPrice)
  for (const [handle, value] of Object.entries(query.attributes ?? {})) {
    for (const item of Array.isArray(value) ? value : [value]) {
      params.append(`attr.${handle}`, item)
    }
  }
  return params
}

export function parseCatalogSearch(search: string): CatalogQuery {
  const params = new URLSearchParams(search)
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

export async function addVariantToCart(
  variantId: string,
  offerId: string,
): Promise<void> {
  let cartId = activeCartId.value
  if (!cartId) {
    const region = await getStoreRegion()
    if (!region) {
      throw new Error("No hay una región de compra configurada.")
    }
    const { cart } = await requestMarketplaceApi<{ cart: { id: string } }>(
      "/store/carts",
      { method: "POST", body: { region_id: region.id } },
    )
    cartId = cart.id
    setActiveCartId(cartId)
  }
  await requestMarketplaceApi(
    `/store/carts/${encodeURIComponent(cartId)}/line-items`,
    {
      method: "POST",
      body: { variant_id: variantId, offer_id: offerId, quantity: 1 },
    },
  )
}
