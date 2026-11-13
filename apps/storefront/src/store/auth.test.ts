import { describe, expect, it, vi } from "vitest"
import type { TokenStorage } from "@mercurjs/client"
import { authState } from "./auth"
import { createAuthState } from "./auth"
import { activeCartId, clearActiveCart, createCartState, setActiveCartId } from "./cart"
import { clearWishlist, createWishlistState, setWishlistProductIds, wishlistProductIds } from "./wishlist"
import { logoutCustomer, logoutMember, restoreSessions } from "../lib/api"

function createMemoryStorage(): TokenStorage {
  const entries = new Map<string, string>()
  return {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, value),
    removeItem: (key) => void entries.delete(key),
  }
}

describe("actor session state", () => {
  it("restores buyer and member identities from their separate API sessions", async () => {
    authState.clearCustomer()
    authState.clearMember()
    authState.customerToken.set("customer-token")
    authState.memberToken.set("member-token")
    vi.stubEnv("VITE_PUBLISHABLE_API_KEY", "pk_test_storefront")
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = new URL(
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.href
              : input.url,
        )
        if (url.pathname.endsWith("/store/customers/me")) {
          return Response.json({
            customer: { id: "customer-1", email: "buyer@example.test" },
          })
        }
        if (url.pathname.endsWith("/vendor/sellers")) {
          return Response.json({
            seller_members: [
              {
                id: "member-1",
                seller: { id: "seller-1", name: "Seller One", status: "active" },
              },
            ],
          })
        }
        return Response.json({}, { status: 404 })
      }),
    )

    try {
      await restoreSessions()

      expect(authState.customerSession.value).toEqual({
        status: "authenticated",
        actorId: "customer-1",
        email: "buyer@example.test",
      })
      expect(authState.memberSession.value.status).toBe("authenticated")
      expect(authState.sellerMemberships.value[0]?.sellerId).toBe("seller-1")
    } finally {
      vi.unstubAllGlobals()
      vi.unstubAllEnvs()
      authState.clearCustomer()
      authState.clearMember()
    }
  })

  it("clears an expired member session without blocking buyer restoration", async () => {
    authState.clearCustomer()
    authState.clearMember()
    authState.customerToken.set("customer-token")
    authState.memberToken.set("expired-member-token")
    vi.stubEnv("VITE_PUBLISHABLE_API_KEY", "pk_test_storefront")
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = new URL(
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.href
              : input.url,
        )
        if (url.pathname.endsWith("/store/customers/me")) {
          return Response.json({
            customer: { id: "customer-1", email: "buyer@example.test" },
          })
        }
        return Response.json({ message: "Unauthorized" }, { status: 401 })
      }),
    )

    try {
      await expect(restoreSessions()).resolves.toBeUndefined()
      expect(authState.customerSession.value.status).toBe("authenticated")
      expect(authState.memberToken.get()).toBeNull()
      expect(authState.memberSession.value.status).toBe("anonymous")
    } finally {
      vi.unstubAllGlobals()
      vi.unstubAllEnvs()
      authState.clearCustomer()
      authState.clearMember()
    }
  })

  it("restores buyer and seller sessions independently", () => {
    const storage = createMemoryStorage()
    const first = createAuthState(storage)
    first.customerToken.set("customer-token")
    first.memberToken.set("member-token")
    first.selectSeller("seller-1")

    const restored = createAuthState(storage)

    expect(restored.customerSession.value.status).toBe("restoring")
    expect(restored.memberSession.value.status).toBe("restoring")
    expect(restored.selectedSellerId.value).toBe("seller-1")

    restored.clearMember()
    expect(restored.memberSession.value.status).toBe("anonymous")
    expect(restored.selectedSellerId.value).toBeNull()
    expect(restored.customerToken.get()).toBe("customer-token")
    expect(restored.customerSession.value.status).toBe("restoring")
  })

  it("clearing buyer state does not clear seller credentials", () => {
    const state = createAuthState(createMemoryStorage())
    state.customerToken.set("customer-token")
    state.memberToken.set("member-token")
    state.selectSeller("seller-1")

    state.clearCustomer()

    expect(state.customerSession.value.status).toBe("anonymous")
    expect(state.memberToken.get()).toBe("member-token")
    expect(state.selectedSellerId.value).toBe("seller-1")
  })

  it("logs out each actor without retaining or clearing the other actor's state", () => {
    authState.clearCustomer()
    authState.clearMember()
    authState.customerToken.set("customer-token")
    authState.memberToken.set("member-token")
    authState.selectSeller("seller-1")
    setActiveCartId("cart-1")
    setWishlistProductIds(["product-1"])

    logoutCustomer()

    expect(authState.customerToken.get()).toBeNull()
    expect(authState.memberToken.get()).toBe("member-token")
    expect(activeCartId.value).toBeNull()
    expect(wishlistProductIds.value).toEqual([])
    expect(authState.selectedSellerId.value).toBe("seller-1")

    authState.customerToken.set("customer-token")
    logoutMember()

    expect(authState.customerToken.get()).toBe("customer-token")
    expect(authState.memberToken.get()).toBeNull()
    expect(authState.selectedSellerId.value).toBeNull()
    authState.clearCustomer()
    clearActiveCart()
    clearWishlist()
  })
})

describe("restored marketplace state", () => {
  it("restores the cart and deduplicated wishlist from session storage", () => {
    const storage = createMemoryStorage()
    const firstCart = createCartState(storage)
    const firstWishlist = createWishlistState(storage)
    firstCart.setActiveCartId("cart-1")
    firstWishlist.setWishlistProductIds(["product-1", "product-1", "product-2"])

    const restoredCart = createCartState(storage)
    const restoredWishlist = createWishlistState(storage)

    expect(restoredCart.activeCartId.value).toBe("cart-1")
    expect(restoredWishlist.wishlistProductIds.value).toEqual([
      "product-1",
      "product-2",
    ])
  })
})
