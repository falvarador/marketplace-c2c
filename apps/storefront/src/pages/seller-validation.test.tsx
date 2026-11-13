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

describe("seller product validation", () => {
  it("shows a backend validation error and preserves the unsaved form", async () => {
    vi.stubEnv("VITE_PUBLISHABLE_API_KEY", "pk_test_storefront")
    const createProduct = vi.fn()
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.href
              : input.url,
        )
        const method = init?.method ?? "GET"

        if (url.pathname.endsWith("/store/product-categories")) {
          return Response.json({
            product_categories: [{
              id: "cat-electronics",
              name: "Electronics",
              handle: "electronics",
              category_children: [],
            }],
          })
        }
        if (url.pathname.endsWith("/marketplace-policy")) {
          return Response.json({ transaction_mode: "checkout" })
        }
        if (url.pathname.endsWith("/attributes")) {
          return Response.json({ product_attributes: [] })
        }
        if (url.pathname.endsWith("/vendor/regions")) {
          return Response.json({
            regions: [{ id: "region-1", name: "Default", currency_code: "usd" }],
          })
        }
        if (url.pathname.endsWith("/vendor/stock-locations")) {
          return Response.json({
            stock_locations: [{ id: "location-1", name: "Warehouse" }],
          })
        }
        if (url.pathname.endsWith("/vendor/shipping-profiles")) {
          return Response.json({
            shipping_profiles: [{ id: "shipping-1", name: "Default" }],
          })
        }
        if (url.pathname.endsWith("/vendor/sellers/me")) {
          return Response.json({ seller: { id: "seller-1", phone: "+50688888888" } })
        }
        if (url.pathname.endsWith("/vendor/leads")) {
          return Response.json({ leads: [] })
        }
        if (url.pathname.endsWith("/vendor/reservation-requests")) {
          return Response.json({ reservation_requests: [] })
        }
        if (url.pathname.endsWith("/vendor/orders")) {
          return Response.json({ orders: [] })
        }
        if (url.pathname.endsWith("/vendor/products") && method === "POST") {
          createProduct()
          return Response.json(
            { message: "El atributo de categoría no es válido." },
            { status: 400 },
          )
        }
        if (url.pathname.endsWith("/vendor/products")) {
          return Response.json({ products: [] })
        }
        if (url.pathname.endsWith("/marketplace-data")) {
          return Response.json({ marketplace_data: null })
        }
        return Response.json({ message: "Not found" }, { status: 404 })
      }),
    )
    window.history.replaceState({}, "", "/vendedor/productos/nuevo")
    authState.memberToken.set("test-member-token")
    authState.setMemberAuthenticated("member-1")
    authState.selectedSellerToken.set("seller-1")
    authState.sellerMemberships.value = [{
      id: "membership-1",
      sellerId: "seller-1",
      name: "Tienda",
      status: "active",
    }]

    render(
      <LocationProvider>
        <SellerPage />
      </LocationProvider>,
    )

    await screen.findByRole("option", { name: "Electronics" })
    await waitFor(() => {
      expect(
        (screen.getByRole("button", { name: "Publicar producto" }) as HTMLButtonElement)
          .disabled,
      ).toBe(false)
    })
    fireEvent.input(screen.getByLabelText("Nombre del producto"), {
      target: { value: "Camera" },
    })
    fireEvent.change(screen.getByLabelText("Categoría"), {
      target: { value: "cat-electronics" },
    })
    fireEvent.input(screen.getByLabelText(/Precio/), {
      target: { value: "100" },
    })
    fireEvent.submit(
      screen.getByRole("button", { name: "Publicar producto" }).closest("form")!,
    )

    expect((await screen.findByRole("alert")).textContent).toContain(
      "El atributo de categoría no es válido.",
    )
    expect(createProduct).toHaveBeenCalledOnce()
    expect((screen.getByLabelText("Nombre del producto") as HTMLInputElement).value)
      .toBe("Camera")
    expect((screen.getByLabelText("Categoría") as HTMLSelectElement).value)
      .toBe("cat-electronics")
    expect((screen.getByLabelText(/Precio/) as HTMLInputElement).value).toBe("100")
  })
})
