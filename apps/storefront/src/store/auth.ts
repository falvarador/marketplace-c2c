import { createTokenStore, type TokenStorage } from "@mercurjs/client"
import { signal } from "@preact/signals"
import { sessionStorageAdapter } from "../lib/storage"

export type SessionStatus = "anonymous" | "restoring" | "authenticated"

export interface AuthSession {
  status: SessionStatus
  actorId?: string
  email?: string
}

export interface SellerMembership {
  id: string
  sellerId: string
  name: string
  status: string
}

export function createAuthState(storage: TokenStorage = sessionStorageAdapter) {
  const customerToken = createTokenStore("marketplace_customer_token", storage)
  const memberToken = createTokenStore("marketplace_member_token", storage)
  const selectedSellerToken = createTokenStore(
    "marketplace_selected_seller",
    storage,
  )

  const customerSession = signal<AuthSession>({
    status: customerToken.get() ? "restoring" : "anonymous",
  })
  const memberSession = signal<AuthSession>({
    status: memberToken.get() ? "restoring" : "anonymous",
  })
  const selectedSellerId = signal<string | null>(selectedSellerToken.get())
  const sellerMemberships = signal<SellerMembership[]>([])

  customerToken.subscribe((token) => {
    customerSession.value = token
      ? { status: "restoring" }
      : { status: "anonymous" }
  })
  memberToken.subscribe((token) => {
    memberSession.value = token
      ? { status: "restoring" }
      : { status: "anonymous" }
    if (!token) {
      selectedSellerToken.clear()
      sellerMemberships.value = []
    }
  })
  selectedSellerToken.subscribe((sellerId) => {
    selectedSellerId.value = sellerId
  })

  return {
    customerSession,
    customerToken,
    memberSession,
    memberToken,
    selectedSellerId,
    selectedSellerToken,
    sellerMemberships,
    setCustomerAuthenticated(actorId?: string, email?: string) {
      customerSession.value = { status: "authenticated", actorId, email }
    },
    setMemberAuthenticated(actorId?: string, email?: string) {
      memberSession.value = { status: "authenticated", actorId, email }
    },
    selectSeller(sellerId: string) {
      selectedSellerToken.set(sellerId)
    },
    clearCustomer() {
      customerToken.clear()
      customerSession.value = { status: "anonymous" }
    },
    clearMember() {
      memberToken.clear()
      selectedSellerToken.clear()
      sellerMemberships.value = []
      memberSession.value = { status: "anonymous" }
    },
  }
}

export const authState = createAuthState()
