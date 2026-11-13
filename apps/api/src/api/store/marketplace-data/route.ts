import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { SellerStatus } from "@mercurjs/types"

const readFilter = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() ? value.trim() : undefined

export const GET = async (
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const filters = {
    ...(readFilter(req.query.country_code)
      ? { country_code: readFilter(req.query.country_code) }
      : {}),
    ...(readFilter(req.query.region)
      ? { region: readFilter(req.query.region) }
      : {}),
    ...(readFilter(req.query.locality)
      ? { locality: readFilter(req.query.locality) }
      : {}),
  }
  const { data: locations } = await query.graph({
    entity: "product_marketplace_data",
    fields: ["id", "country_code", "region", "locality", "product.id"],
    filters,
  })
  const productIds = [
    ...new Set(locations.map((location) => location.product?.id).filter(Boolean)),
  ]

  if (productIds.length === 0) {
    res.json({ locations: [], count: 0 })
    return
  }

  const { data: offers } = await query.graph({
    entity: "offer",
    fields: ["product_id"],
    filters: {
      product_id: productIds,
      product: { status: "published" },
      seller: { status: SellerStatus.OPEN },
    },
  })
  const eligibleProductIds = new Set(offers.map(({ product_id }) => product_id))
  const visibleLocations = locations.filter((location) =>
    eligibleProductIds.has(location.product?.id),
  )

  res.json({ locations: visibleLocations, count: visibleLocations.length })
}
