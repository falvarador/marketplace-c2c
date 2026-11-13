// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from "@testing-library/preact"
import { LocationProvider } from "preact-iso"
import { afterEach, describe, expect, it, vi } from "vitest"
import { AccountPage, WishlistPage } from "./account"
import { authState } from "../store/auth"
import { clearWishlist } from "../store/wishlist"

afterEach(() => {
  cleanup()
  authState.clearCustomer()
  clearWishlist()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  window.history.replaceState({}, "", "/")
})

describe("buyer order payment details", () => {
  it("shows a pending SINPE order with a seller WhatsApp link", async () => {
    vi.stubEnv("VITE_PUBLISHABLE_API_KEY", "pk_test_storefront")
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url,
      )
      if (url.pathname === "/store/order-groups") {
        return Response.json({
          order_groups: [{
            id: "group_1",
            display_id: 3,
            orders: [{ id: "order_1", display_id: 7 }],
          }],
        })
      }
      if (url.pathname.endsWith("/external-payments")) {
        return Response.json({
          seller_orders: [{
            id: "order_1",
            display_id: 7,
            total: 2500,
            currency_code: "crc",
            seller_name: "Tienda",
            whatsapp_number: "50688888888",
            payment_status: "pending",
          }],
        })
      }
      if (url.pathname === "/store/leads") {
        return Response.json({
          leads: [{
            id: "lead_1",
            product_id: "prod_1",
            seller_id: "seller_1",
            message: "Interested",
            status: "received",
            created_at: "2026-01-01T00:00:00.000Z",
          }],
        })
      }
      if (url.pathname === "/store/reservation-requests") {
        return Response.json({
          reservation_requests: [{
            id: "reservation_1",
            product_id: "prod_2",
            variant_id: "variant_1",
            seller_id: "seller_1",
            status: "pending",
            created_at: "2026-01-01T00:00:00.000Z",
          }],
        })
      }
      return Response.json({ message: "Not found" }, { status: 404 })
    }))
    authState.customerToken.set("customer-token")
    authState.setCustomerAuthenticated("cus_1", "buyer@example.com")

    render(
      <LocationProvider>
        <AccountPage />
      </LocationProvider>,
    )

    await screen.findByText(/SINPE pendiente/)
    const link = screen.getByRole("link", {
      name: "Coordinar pago por WhatsApp",
    })
    expect(link.getAttribute("href")).toContain("https://wa.me/50688888888?")
    expect(link.getAttribute("target")).toBe("_blank")
    expect(screen.getByText("Producto prod_1 · received")).toBeTruthy()
    expect(screen.getByText("Producto prod_2 · pending")).toBeTruthy()
  })

  it("loads and removes the buyer's saved products", async () => {
    vi.stubEnv("VITE_PUBLISHABLE_API_KEY", "pk_test_storefront")
    const calls: Array<{ path: string; method: string }> = []
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url,
      )
      const method = init?.method ?? "GET"
      calls.push({ path: url.pathname, method })
      if (url.pathname === "/store/wishlist") {
        return Response.json({ wishlist_items: [{ product_id: "prod_1" }] })
      }
      if (url.pathname === "/store/products/prod_1") {
        return Response.json({
          product: {
            id: "prod_1",
            title: "Camera",
            handle: "camera",
            categories: [],
          },
        })
      }
      if (url.pathname === "/store/wishlist/items/prod_1" && method === "DELETE") {
        return Response.json({})
      }
      return Response.json({ message: "Not found" }, { status: 404 })
    }))
    authState.customerToken.set("customer-token")
    authState.setCustomerAuthenticated("cus_1", "buyer@example.com")

    render(
      <LocationProvider>
        <WishlistPage />
      </LocationProvider>,
    )

    expect(await screen.findByRole("heading", { name: "Camera" })).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Quitar de favoritos" }))

    await screen.findByRole("heading", { name: "Aún no guardaste productos" })
    expect(calls).toContainEqual({
      path: "/store/wishlist/items/prod_1",
      method: "DELETE",
    })
  })
})
