import { createTokenStore } from "@mercurjs/client"
import { signal } from "@preact/signals"
import type { TokenStorage } from "@mercurjs/client"
import { sessionStorageAdapter } from "../lib/storage"

export function createWishlistState(
  storage: TokenStorage = sessionStorageAdapter,
) {
  const wishlistStore = createTokenStore(
    "marketplace_wishlist_product_ids",
    storage,
  )

  function readProductIds(): string[] {
    const value = wishlistStore.get()
    if (!value) {
      return []
    }
    try {
      const parsed: unknown = JSON.parse(value)
      return Array.isArray(parsed)
        ? parsed.filter((item): item is string => typeof item === "string")
        : []
    } catch {
      wishlistStore.clear()
      return []
    }
  }

  const wishlistProductIds = signal<string[]>(readProductIds())

  return {
    wishlistProductIds,
    setWishlistProductIds(productIds: string[]) {
      const uniqueIds = [...new Set(productIds)]
      wishlistProductIds.value = uniqueIds
      wishlistStore.set(JSON.stringify(uniqueIds))
    },
    clearWishlist() {
      wishlistProductIds.value = []
      wishlistStore.clear()
    },
  }
}

const wishlistState = createWishlistState()
export const wishlistProductIds = wishlistState.wishlistProductIds
export const setWishlistProductIds = wishlistState.setWishlistProductIds
export const clearWishlist = wishlistState.clearWishlist
