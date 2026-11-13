import { afterEach, describe, expect, it, vi } from "vitest"
import {
  createSearchParams,
  isOfferAvailable,
  parseCatalogSearch,
  searchCatalog,
} from "./marketplace"

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe("catalog filters", () => {
  it("round-trips search, location, price, category, and multi-value attributes", () => {
    const query = {
      query: "camera",
      categoryId: "electronics",
      countryCode: "CR",
      region: "San Jose",
      locality: "Escazu",
      minPrice: "10",
      maxPrice: "100",
      attributes: {
        condition: "used",
        color: ["black", "silver"],
      },
    }

    expect(parseCatalogSearch(`?${createSearchParams(query)}`)).toEqual(query)
  })

  it("combines location and price filters while forwarding category attributes", async () => {
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

        if (url.pathname.endsWith("/store/marketplace-data")) {
          return Response.json({
            locations: [
              { product: { id: "in-range" } },
              { product: { id: "over-budget" } },
              { product: { id: "split-range" } },
              { product: { id: "no-price" } },
            ],
          })
        }
        if (url.pathname.endsWith("/store/regions")) {
          return Response.json({
            regions: [{ id: "region-1", currency_code: "usd" }],
          })
        }
        if (url.pathname.endsWith("/store/products")) {
          return Response.json({
            count: 5,
            products: [
              {
                id: "in-range",
                variants: [{ id: "variant-1", title: "Default", calculated_price: {
                  calculated_amount: 50,
                  currency_code: "usd",
                } }],
              },
              {
                id: "other-location",
                variants: [{ id: "variant-2", title: "Default", calculated_price: {
                  calculated_amount: 50,
                  currency_code: "usd",
                } }],
              },
              {
                id: "over-budget",
                variants: [{ id: "variant-3", title: "Default", calculated_price: {
                  calculated_amount: 150,
                  currency_code: "usd",
                } }],
              },
              {
                id: "split-range",
                variants: [
                  { id: "variant-4", title: "Low", calculated_price: {
                    calculated_amount: 5,
                    currency_code: "usd",
                  } },
                  { id: "variant-5", title: "High", calculated_price: {
                    calculated_amount: 150,
                    currency_code: "usd",
                  } },
                ],
              },
              {
                id: "no-price",
                variants: [{ id: "variant-6", title: "Default" }],
              },
            ],
          })
        }
        return Response.json({ message: "Not found" }, { status: 404 })
      }),
    )

    const result = await searchCatalog({
      categoryId: "electronics",
      countryCode: "CR",
      region: "San Jose",
      minPrice: "10",
      maxPrice: "100",
      attributes: { condition: "used" },
    })

    const productRequest = requests.find((url) =>
      url.pathname.endsWith("/store/products"),
    )
    expect(productRequest?.searchParams.get("category_id")).toBe("electronics")
    expect(productRequest?.searchParams.get("region_id")).toBe("region-1")
    expect(productRequest?.searchParams.get("attributes[condition]")).toBe("used")
    expect(result.products.map(({ id }) => id)).toEqual(["in-range"])
    expect(result.count).toBe(1)
  })

  it("rejects malformed or contradictory price ranges", async () => {
    await expect(searchCatalog({ minPrice: "invalid" })).rejects.toThrow(
      "El precio mínimo debe ser un número válido y no negativo.",
    )
    await expect(
      searchCatalog({ minPrice: "20", maxPrice: "10" }),
    ).rejects.toThrow(
      "El precio mínimo no puede superar el precio máximo.",
    )
  })

  it("only enables product actions for offers with available inventory", () => {
    expect(isOfferAvailable()).toBe(false)
    expect(isOfferAvailable({ in_stock: false, inventory_quantity: 5 })).toBe(false)
    expect(isOfferAvailable({ in_stock: true, inventory_quantity: 0 })).toBe(false)
    expect(isOfferAvailable({ in_stock: true, inventory_quantity: 1 })).toBe(true)
    expect(isOfferAvailable({ in_stock: true })).toBe(true)
  })
})
