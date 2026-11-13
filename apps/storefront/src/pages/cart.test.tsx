// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from "@testing-library/preact"
import { LocationProvider } from "preact-iso"
import { afterEach, describe, expect, it, vi } from "vitest"
import { CartPage } from "./cart"
import { authState } from "../store/auth"
import { activeCartId, clearActiveCart, setActiveCartId } from "../store/cart"

afterEach(() => {
  cleanup()
  authState.clearCustomer()
  clearActiveCart()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  window.history.replaceState({}, "", "/")
})

describe("external SINPE checkout", () => {
  it("creates a pending external payment session before completing the order group", async () => {
    vi.stubEnv("VITE_PUBLISHABLE_API_KEY", "pk_test_storefront")
    const calls: Array<{ path: string; method: string; body?: unknown }> = []
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url,
      )
      const method = init?.method ?? "GET"
      const body = init?.body
        ? JSON.parse(String(init.body)) as unknown
        : undefined
      calls.push({ path: url.pathname, method, body })

      if (url.pathname === "/store/carts/cart_1") {
        return Response.json({
          cart: {
            id: "cart_1",
            currency_code: "crc",
            total: 2500,
            items: [{
              id: "item_1",
              title: "Camera",
              quantity: 1,
              unit_price: 2500,
              total: 2500,
              requires_shipping: false,
            }],
          },
        })
      }
      if (url.pathname === "/store/payment-collections") {
        return Response.json({
          payment_collection: { id: "paycol_1" },
        })
      }
      if (url.pathname.endsWith("/payment-sessions")) {
        return Response.json({ payment_collection: { id: "paycol_1" } })
      }
      if (url.pathname.endsWith("/complete")) {
        return Response.json({
          type: "order_group",
          order_group: { id: "group_1" },
        })
      }
      return Response.json({})
    }))
    authState.customerToken.set("customer-token")
    authState.setCustomerAuthenticated("cus_1", "buyer@example.com")
    setActiveCartId("cart_1")

    render(
      <LocationProvider>
        <CartPage />
      </LocationProvider>,
    )

    fireEvent.click(await screen.findByRole("button", { name: "Completar pedido" }))

    await screen.findByText(/Pedido creado/)
    expect(calls).toContainEqual({
      path: "/store/payment-collections/paycol_1/payment-sessions",
      method: "POST",
      body: {
        provider_id: "pp_external_sinpe_external_sinpe",
        data: {},
      },
    })
    expect(calls.some(({ path, method }) =>
      path === "/store/carts/cart_1/complete" && method === "POST",
    )).toBe(true)
    expect(activeCartId.value).toBeNull()
  })
})
