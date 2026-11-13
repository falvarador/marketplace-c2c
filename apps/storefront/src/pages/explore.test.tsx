// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/preact"
import { LocationProvider } from "preact-iso"
import { afterEach, describe, expect, it, vi } from "vitest"
import { ExplorePage } from "./explore"

afterEach(() => {
  cleanup()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  window.history.replaceState({}, "", "/")
})

describe("catalog discovery", () => {
  it("renders category-defined filters and syncs them to the URL and Store API", async () => {
    vi.stubEnv("VITE_PUBLISHABLE_API_KEY", "pk_test_storefront")
    const requests: URL[] = []
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
        requests.push(url)

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
        if (url.pathname.endsWith("/cat-electronics/attributes")) {
          return Response.json({
            product_attributes: [{
              id: "attr-condition",
              name: "Condition",
              handle: "condition",
              type: "single_select",
              values: [{ id: "used", name: "Used" }],
            }],
          })
        }
        if (url.pathname.endsWith("/store/regions")) {
          return Response.json({
            regions: [{ id: "region-1", currency_code: "usd" }],
          })
        }
        if (url.pathname.endsWith("/store/products")) {
          const products = Array.from({ length: 13 }, (_, index) => ({
            id: `product-${index + 1}`,
            handle: `product-${index + 1}`,
            title: `Producto ${index + 1}`,
          }))
          return Response.json({ count: products.length, products })
        }
        return Response.json({ message: "Not found" }, { status: 404 })
      }),
    )
    window.history.replaceState({}, "", "/explorar")

    render(
      <LocationProvider>
        <ExplorePage />
      </LocationProvider>,
    )

    await screen.findByRole("navigation", {
      name: "Paginación del catálogo",
    })
    fireEvent.change(screen.getByLabelText("Categoría"), {
      target: { value: "cat-electronics" },
    })
    const attributeFilter = await screen.findByLabelText("Condition")
    fireEvent.change(attributeFilter, { target: { value: "used" } })
    fireEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }))

    await waitFor(() => {
      expect(window.location.search).toContain("category=cat-electronics")
      expect(window.location.search).toContain("attr.condition=used")
      expect(
        requests.some(
          (url) =>
            url.pathname.endsWith("/store/products") &&
            url.searchParams.get("attributes[condition]") === "used",
        ),
      ).toBe(true)
    })

    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }))
    await waitFor(() => {
      expect(window.location.search).toContain("page=2")
      expect(screen.getByText("Producto 13")).toBeTruthy()
    })
  })
})
