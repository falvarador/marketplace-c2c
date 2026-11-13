import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { deleteWishlistItemWorkflow } from "../../../../../workflows/wishlist/workflows/delete-wishlist-item"

type CustomerAuthenticatedRequest = MedusaRequest & {
  auth_context?: {
    actor_id?: string
  }
}

export const DELETE = async (
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> => {
  const customerId = (req as CustomerAuthenticatedRequest).auth_context?.actor_id
  if (!customerId) {
    throw new MedusaError(
      MedusaError.Types.UNAUTHORIZED,
      "Customer authentication is required.",
    )
  }
  const { result } = await deleteWishlistItemWorkflow(req.scope).run({
    input: {
      customer_id: customerId,
      product_id: req.params.product_id,
    },
  })
  res.json({ wishlist_item: result })
}
