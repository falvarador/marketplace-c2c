import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import {
  WISHLIST_MODULE,
  WishlistModuleService,
} from "../../../modules/wishlist"
import { parseWishlistProductId } from "../../../workflows/wishlist/steps/upsert-wishlist-item"
import { upsertWishlistItemWorkflow } from "../../../workflows/wishlist/workflows/upsert-wishlist-item"

type CustomerAuthenticatedRequest = MedusaRequest & {
  auth_context?: {
    actor_id?: string
  }
}

function getCustomerId(req: MedusaRequest): string {
  const customerId = (req as CustomerAuthenticatedRequest).auth_context?.actor_id
  if (!customerId) {
    throw new MedusaError(
      MedusaError.Types.UNAUTHORIZED,
      "Customer authentication is required.",
    )
  }
  return customerId
}

export const GET = async (
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> => {
  const customerId = getCustomerId(req)
  const service = req.scope.resolve<WishlistModuleService>(WISHLIST_MODULE)
  const items = await service.listWishlistItems(
    { customer_id: customerId },
    { order: { created_at: "DESC" } },
  )
  const wishlistItems = items.map(({ id, product_id, created_at }) => ({
    id,
    product_id,
    created_at,
  }))
  res.json({ wishlist_items: wishlistItems, count: wishlistItems.length })
}

export const POST = async (
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> => {
  const customerId = getCustomerId(req)
  const productId = parseWishlistProductId(req.body)
  const { result } = await upsertWishlistItemWorkflow(req.scope).run({
    input: { customer_id: customerId, product_id: productId },
  })
  res.status(201).json({ wishlist_item: result })
}
