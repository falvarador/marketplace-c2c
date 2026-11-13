import {
  bearerAuth,
  ClientError,
  createClient,
  headerAuth,
  publishableKeyAuth,
  type InferClient,
} from "@mercurjs/client"
import type { MedusaResponse } from "@medusajs/framework"
import type { Routes } from "../../../api/.mercur/routes"
import { authState, type SellerMembership } from "../store/auth"
import { clearActiveCart } from "../store/cart"
import { clearWishlist, setWishlistProductIds } from "../store/wishlist"

interface Credentials {
  email: string
  password: string
}

type TypedAuthRoute = {
  POST: (
    req: { validatedBody: Credentials },
    res: MedusaResponse<{ token: string }>,
  ) => Promise<void>
}

interface WishlistItem {
  id: string
  product_id: string
  created_at: string
}

type WishlistRoute = {
  GET: (
    req: { validatedBody: Record<never, never> },
    res: MedusaResponse<{ wishlist_items: WishlistItem[]; count: number }>,
  ) => Promise<void>
  POST: (
    req: { validatedBody: { product_id: string } },
    res: MedusaResponse<{ wishlist_item: WishlistItem }>,
  ) => Promise<void>
  items: {
    $productId: {
      DELETE: (
        req: { validatedBody: Record<never, never> },
        res: MedusaResponse<{ wishlist_item: WishlistItem }>,
      ) => Promise<void>
    }
  }
}

type ClientRoutes = Omit<Routes, "auth" | "store"> & {
  auth: {
    $actorType: {
      $authProvider: TypedAuthRoute
    }
  },
  store: Omit<Routes["store"], "wishlist"> & { wishlist: WishlistRoute }
}

export type MarketplaceClient = InferClient<ClientRoutes>

const apiBaseUrl = import.meta.env.VITE_API_URL || "http://localhost:9000"
const publishableKey = () => {
  const key = import.meta.env.VITE_PUBLISHABLE_API_KEY?.trim()
  if (!key) {
    throw new Error(
      "Set VITE_PUBLISHABLE_API_KEY in apps/storefront/.env before using the marketplace API.",
    )
  }
  return key
}

export class MarketplaceApiError extends Error {
  readonly status: number

  constructor(
    message: string,
    status: number,
  ) {
    super(message)
    this.status = status
    this.name = "MarketplaceApiError"
  }
}

type RequestActor = "public" | "customer" | "member"

export async function requestMarketplaceApi<T>(
  path: string,
  options: {
    actor?: RequestActor
    method?: "GET" | "POST" | "DELETE"
    body?: unknown
    formData?: FormData
  } = {},
): Promise<T> {
  const actor = options.actor ?? "public"
  const headers = new Headers({
    "x-publishable-api-key": publishableKey(),
  })

  if (actor === "customer") {
    const token = authState.customerToken.get()
    if (!token) {
      throw new Error("Inicia sesión como comprador para continuar.")
    }
    headers.set("authorization", `Bearer ${token}`)
  } else if (actor === "member") {
    const token = authState.memberToken.get()
    const sellerId = authState.selectedSellerToken.get()
    if (!token || !sellerId) {
      throw new Error("Inicia sesión y selecciona una tienda para continuar.")
    }
    headers.set("authorization", `Bearer ${token}`)
    headers.set("x-seller-id", sellerId)
  }

  let body: BodyInit | undefined
  if (options.formData) {
    body = options.formData
  } else if (options.body !== undefined) {
    headers.set("content-type", "application/json")
    body = JSON.stringify(options.body)
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: options.method ?? "GET",
    headers,
    body,
    credentials: "include",
  })
  const payload: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "message" in payload &&
      typeof payload.message === "string"
        ? payload.message
        : `La solicitud falló (${response.status}).`
    throw new MarketplaceApiError(message, response.status)
  }
  return payload as T
}

function createMarketplaceClient(
  auth: Parameters<typeof createClient>[0]["auth"],
): MarketplaceClient {
  return createClient({
    baseUrl: apiBaseUrl,
    auth,
    fetchOptions: { credentials: "include" },
  }) as MarketplaceClient
}

export const storeClient = createMarketplaceClient(
  publishableKeyAuth(publishableKey),
)

export const customerClient = createMarketplaceClient([
  publishableKeyAuth(publishableKey),
  bearerAuth(authState.customerToken),
])

export const memberClient = createMarketplaceClient(
  bearerAuth(authState.memberToken),
)

export const vendorClient = createMarketplaceClient([
  bearerAuth(authState.memberToken),
  headerAuth("x-seller-id", authState.selectedSellerToken),
])

export async function loginCustomer(
  credentials: Credentials,
): Promise<{ id: string; email: string }> {
  const { token } = await customerClient.auth.$actorType.$authProvider.mutate({
    $actorType: "customer",
    $authProvider: "emailpass",
    ...credentials,
  })
  authState.customerToken.set(token)

  try {
    const { customer } = await customerClient.store.customers.me.query({})
    authState.setCustomerAuthenticated(customer.id, customer.email)
    return { id: customer.id, email: customer.email }
  } catch (error) {
    authState.clearCustomer()
    throw error
  }
}

export async function loginMember(
  credentials: Credentials,
): Promise<SellerMembership[]> {
  const { token } = await memberClient.auth.$actorType.$authProvider.mutate({
    $actorType: "member",
    $authProvider: "emailpass",
    ...credentials,
  })
  authState.memberToken.set(token)

  try {
    return await loadSellerMemberships()
  } catch (error) {
    authState.clearMember()
    throw error
  }
}

export async function loadSellerMemberships(): Promise<SellerMembership[]> {
  const { seller_members: members } =
    await memberClient.vendor.sellers.query({})
  const memberships = members.map(({ id, seller }) => ({
    id,
    sellerId: seller.id,
    name: seller.name,
    status: seller.status,
  }))
  authState.sellerMemberships.value = memberships
  authState.setMemberAuthenticated()
  return memberships
}

export async function selectSeller(sellerId: string): Promise<void> {
  await memberClient.vendor.sellers.select.mutate({ seller_id: sellerId })
  authState.selectSeller(sellerId)
  try {
    const { seller } = await vendorClient.vendor.sellers.me.query({})
    authState.setMemberAuthenticated(seller.id, seller.email ?? undefined)
  } catch (error) {
    authState.selectedSellerToken.clear()
    throw error
  }
}

export async function registerSeller(input: {
  name: string
  email: string
  handle?: string
  phone?: string
  currency_code: string
}): Promise<void> {
  const { seller } = await memberClient.vendor.sellers.mutate(input)
  await selectSeller(seller.id)
  await loadSellerMemberships()
}

export async function restoreSessions(): Promise<void> {
  const customerToken = authState.customerToken.get()
  const memberToken = authState.memberToken.get()
  const selectedSellerId = authState.selectedSellerId.value

  const pending: Promise<void>[] = []
  if (customerToken) {
    pending.push((async () => {
      try {
        const { customer } = await customerClient.store.customers.me.query({})
        authState.setCustomerAuthenticated(customer.id, customer.email)
      } catch (error) {
        if (isSessionAuthorizationError(error)) {
          logoutCustomer()
          return
        }
        throw error
      }
    })())
  }
  if (memberToken) {
    pending.push((async () => {
      try {
        const memberships = await loadSellerMemberships()
        if (selectedSellerId) {
          const membership = memberships.find(
            (item) => item.sellerId === selectedSellerId,
          )
          if (!membership) {
            authState.selectedSellerToken.clear()
            return
          }
          try {
            await selectSeller(selectedSellerId)
          } catch (error) {
            if (isSessionAuthorizationError(error)) {
              authState.selectedSellerToken.clear()
              return
            }
            throw error
          }
        }
      } catch (error) {
        if (isSessionAuthorizationError(error)) {
          logoutMember()
          return
        }
        throw error
      }
    })())
  }
  await Promise.all(pending)
}

function isSessionAuthorizationError(error: unknown): error is ClientError {
  return (
    error instanceof ClientError &&
    (error.status === 401 || error.status === 403)
  )
}

export async function refreshWishlist(): Promise<void> {
  const { wishlist_items: items } =
    await customerClient.store.wishlist.query({})
  setWishlistProductIds(items.map(({ product_id }) => product_id))
}

export function logoutCustomer(): void {
  authState.clearCustomer()
  clearActiveCart()
  clearWishlist()
}

export function logoutMember(): void {
  authState.clearMember()
}

export { ClientError }
