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

describe("seller product publishing", () => {
  it("creates an offer and inventory record for each product variant", async () => {
    vi.stubEnv("VITE_PUBLISHABLE_API_KEY", "pk_test_storefront")
    const offerBodies: Array<Record<string, unknown>> = []
    let productBody: Record<string, unknown> | undefined
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
        if (url.pathname.endsWith("/vendor/sellers/me") && method === "POST") {
          return Response.json({ seller: { id: "seller-1", phone: "+50688888888" } })
        }
        if (url.pathname.endsWith("/vendor/sellers/me")) {
          return Response.json({ seller: { id: "seller-1", phone: null } })
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
          productBody = JSON.parse(String(init?.body)) as Record<string, unknown>
          return Response.json({
            product: {
              id: "product-1",
              variants: [{ id: "variant-1" }, { id: "variant-2" }],
            },
          })
        }
        if (url.pathname.endsWith("/vendor/products")) {
          return Response.json({ products: [] })
        }
        if (url.pathname.endsWith("/vendor/offers") && method === "POST") {
          offerBodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>)
          return Response.json({ offer: { id: `offer-${offerBodies.length}` } })
        }
        if (url.pathname.endsWith("/vendor/offers")) {
          return Response.json({ offers: [] })
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
    fireEvent.input(screen.getByLabelText(/WhatsApp para pagos/), {
      target: { value: "+506 8888 8888" },
    })
    fireEvent.input(screen.getByLabelText("País (código ISO alpha-2)"), {
      target: { value: "CR" },
    })
    fireEvent.input(screen.getAllByLabelText("Nombre de variante")[0], {
      target: { value: "Camera body" },
    })
    fireEvent.input(screen.getAllByLabelText(/Precio/)[0], {
      target: { value: "100" },
    })
    fireEvent.input(screen.getAllByLabelText(/Unidades disponibles/)[0], {
      target: { value: "2" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Añadir variante" }))
    fireEvent.input(screen.getAllByLabelText("Nombre de variante")[1], {
      target: { value: "Camera kit" },
    })
    fireEvent.input(screen.getAllByLabelText(/Precio/)[1], {
      target: { value: "150" },
    })
    fireEvent.input(screen.getAllByLabelText(/Unidades disponibles/)[1], {
      target: { value: "1" },
    })

    fireEvent.submit(
      screen.getByRole("button", { name: "Publicar producto" }).closest("form")!,
    )

    await waitFor(() => expect(offerBodies).toHaveLength(2))
    expect(productBody?.variants).toEqual([
      { title: "Camera body", options: {} },
      { title: "Camera kit", options: {} },
    ])
    expect(offerBodies.map((offer) => offer.variant_id)).toEqual([
      "variant-1",
      "variant-2",
    ])
    expect(offerBodies.map((offer) => offer.prices)).toEqual([
      [{ amount: 100, currency_code: "usd" }],
      [{ amount: 150, currency_code: "usd" }],
    ])
    expect(
      offerBodies.map((offer) =>
        (offer.inventory_items as Array<{ stock_levels: Array<{ stocked_quantity: number }> }>)[0]
          .stock_levels[0].stocked_quantity,
      ),
    ).toEqual([2, 1])
  })
})
