import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { resolveProductMarketplacePolicy } from "../../../../../utils/product-marketplace-policy"

export const GET = async (
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> => {
  const policy = await resolveProductMarketplacePolicy(
    req.scope,
    req.params.id,
  )
  res.json({ marketplace_policy: policy })
}
