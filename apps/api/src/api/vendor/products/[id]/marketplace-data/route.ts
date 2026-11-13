import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  ContainerRegistrationKeys,
  MedusaError,
} from "@medusajs/framework/utils"
import { ensureSellerOwnsProduct } from "@mercurjs/core/api/vendor/products/helpers"
import { parseProductLocationInput } from "../../../../../utils/location"
import { upsertProductMarketplaceDataWorkflow } from "../../../../../workflows/marketplace-policy/workflows/upsert-product-marketplace-data"

type SellerContextRequest = MedusaRequest & {
  seller_context?: {
    seller_member?: {
      seller?: {
        id: string
      }
    }
  }
}

export const POST = async (
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> => {
  const sellerId = (req as SellerContextRequest).seller_context?.seller_member
    ?.seller?.id
  if (!sellerId) {
    throw new MedusaError(
      MedusaError.Types.UNAUTHORIZED,
      "Seller context is required.",
    )
  }

  const location = parseProductLocationInput(req.body)
  const { result } = await upsertProductMarketplaceDataWorkflow(req.scope).run({
    input: {
      seller_id: sellerId,
      product_id: req.params.id,
      ...location,
    },
  })

  res.json({ marketplace_data: result })
}

export const GET = async (
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> => {
  const sellerId = (req as SellerContextRequest).seller_context?.seller_member
    ?.seller?.id
  if (!sellerId) {
    throw new MedusaError(
      MedusaError.Types.UNAUTHORIZED,
      "Seller context is required.",
    )
  }

  await ensureSellerOwnsProduct(req.scope, sellerId, [req.params.id])
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "product_marketplace_data",
    fields: ["id", "country_code", "region", "locality", "metadata"],
    filters: { product: { id: req.params.id } },
  })

  res.json({ marketplace_data: data[0] ?? null })
}
