import { createTokenStore } from "@mercurjs/client"
import { signal } from "@preact/signals"
import type { TokenStorage } from "@mercurjs/client"
import { sessionStorageAdapter } from "../lib/storage"

export function createCartState(storage: TokenStorage = sessionStorageAdapter) {
  const activeCartStore = createTokenStore("marketplace_active_cart", storage)
  const activeCartId = signal<string | null>(activeCartStore.get())
  activeCartStore.subscribe((cartId) => {
    activeCartId.value = cartId
  })

  return {
    activeCartId,
    setActiveCartId(cartId: string) {
      activeCartStore.set(cartId)
    },
    clearActiveCart() {
      activeCartStore.clear()
    },
  }
}

const cartState = createCartState()
export const activeCartId = cartState.activeCartId
export const setActiveCartId = cartState.setActiveCartId
export const clearActiveCart = cartState.clearActiveCart
