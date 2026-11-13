// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/preact"
import { LocationProvider } from "preact-iso"
import { afterEach, describe, expect, it, vi } from "vitest"
import { ItemPage } from "./item"
import { authState } from "../store/auth"

afterEach(() => {
  cleanup()
  authState.clearCustomer()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  window.history.replaceState({}, "", "/")
})

async function renderItem(
  mode: "checkout" | "lead",
  inventoryQuantity: number,
) {
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
      if (url.pathname.endsWith("/store/products")) {
        return Response.json({
          products: [{
            id: "product-1",
            handle: "camera",
            title: "Camera",
            variants: [{
              id: "variant-1",
              title: "Default",
              offers: [{
                id: "offer-1",
                seller_id: "seller-1",
                variant_id: "variant-1",
                seller: { id: "seller-1", name: "Camera Shop" },
                in_stock: inventoryQuantity > 0,
                inventory_quantity: inventoryQuantity,
                calculated_price: {
                  calculated_amount: 100,
                  currency_code: "usd",
                },
              }],
            }],
          }],
          count: 1,
        })
      }
      if (url.pathname.endsWith("/marketplace-policy")) {
        return Response.json({
          marketplace_policy: { transaction_mode: mode },
        })
      }
      if (url.pathname.endsWith("/store/marketplace-data")) {
        return Response.json({
          locations: [{
            id: "location-1",
            product: { id: "product-1" },
            country_code: "US",
          }],
        })
      }
      return Response.json({ message: "Not found" }, { status: 404 })
    }),
  )

  render(
    <LocationProvider>
      <ItemPage handle="camera" />
    </LocationProvider>,
  )
}

describe("product detail actions", () => {
  it("uses the effective transaction mode for the primary action", async () => {
    await renderItem("checkout", 2)
    expect(
      await screen.findByRole("button", { name: "Agregar al carrito" }),
    ).toBeTruthy()
  })

  it("uses direct contact and reservation actions for a unique lead item", async () => {
    await renderItem("lead", 1)

    expect(
      await screen.findByRole("button", { name: "Contactar al vendedor" }),
    ).toBeTruthy()
    expect(
      screen.getByRole("button", { name: "Solicitar reserva pendiente de confirmación" }),
    ).toBeTruthy()
  })

  it("shows a disabled unavailable state for an out-of-stock lead item", async () => {
    await renderItem("lead", 0)
    const action = await screen.findByRole("button", { name: "No disponible" })

    expect((action as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText("No disponible por el momento")).toBeTruthy()
  })
})
