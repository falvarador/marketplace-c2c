// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/preact"
import { LocationProvider } from "preact-iso"
import { afterEach, describe, expect, it, vi } from "vitest"
import { SellerPage } from "./seller"
import { authState } from "../store/auth"

afterEach(() => {
  cleanup()
  authState.clearMember()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  window.history.replaceState({}, "", "/")
})

describe("seller SINPE order confirmation", () => {
  it("unlocks the fulfillment action only after the seller confirms payment", async () => {
    vi.stubEnv("VITE_PUBLISHABLE_API_KEY", "pk_test_storefront")
    const requests: Array<{ path: string; method: string }> = []
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url,
      )
      const method = init?.method ?? "GET"
      requests.push({ path: url.pathname, method })

      if (url.pathname.endsWith("/vendor/products")) {
        return Response.json({ products: [] })
      }
      if (url.pathname.endsWith("/vendor/leads")) {
        return Response.json({ leads: [] })
      }
      if (url.pathname.endsWith("/vendor/reservation-requests")) {
        return Response.json({ reservation_requests: [] })
      }
      if (url.pathname.endsWith("/vendor/stock-locations")) {
        return Response.json({
          stock_locations: [{ id: "stock_1", name: "Warehouse" }],
        })
      }
      if (url.pathname.endsWith("/external-payment-confirmation")) {
        return Response.json({
          order_id: "order_1",
          external_payment_status: "confirmed",
        })
      }
      if (url.pathname.endsWith("/vendor/orders")) {
        return Response.json({
          orders: [{
            id: "order_1",
            display_id: 7,
            status: "pending",
            fulfillment_status: "not_fulfilled",
            metadata: {},
            payment_collections: [{
              payment_sessions: [{
                provider_id: "pp_external_sinpe_external_sinpe",
              }],
            }],
            items: [{ id: "item_1", title: "Camera", quantity: 1 }],
          }],
        })
      }
      return Response.json({ message: "Not found" }, { status: 404 })
    }))

    window.history.replaceState({}, "", "/vendedor")
    authState.memberToken.set("member-token")
    authState.setMemberAuthenticated("member_1")
    authState.selectedSellerToken.set("seller_1")
    authState.sellerMemberships.value = [{
      id: "membership_1",
      sellerId: "seller_1",
      name: "Tienda",
      status: "active",
    }]

    render(
      <LocationProvider>
        <SellerPage />
      </LocationProvider>,
    )

    await screen.findByText(/SINPE pendiente/)
    expect(screen.queryByRole("button", { name: "Preparar fulfillment" })).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Confirmar pago SINPE" }))

    await screen.findByText(/SINPE confirmado/)
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Preparar fulfillment" })).toBeTruthy()
    })
    expect(requests).toContainEqual({
      path: "/vendor/orders/order_1/external-payment-confirmation",
      method: "POST",
    })
  })
})
