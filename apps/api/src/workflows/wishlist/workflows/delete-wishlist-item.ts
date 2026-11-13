import { Modules } from "@medusajs/framework/utils"
import type { LinkDefinition } from "@medusajs/framework/types"
import { dismissRemoteLinkStep } from "@medusajs/medusa/core-flows"
import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { WISHLIST_MODULE } from "../../../modules/wishlist"
import { deleteWishlistItemStep } from "../steps/delete-wishlist-item"

export const deleteWishlistItemWorkflow = createWorkflow(
  "delete-wishlist-item",
  (input: { customer_id: string; product_id: string }) => {
    const item = deleteWishlistItemStep(input)
    const links = transform({ input, item }, ({ input, item }): LinkDefinition[] =>
      item.id
        ? [
            {
              [Modules.CUSTOMER]: { customer_id: input.customer_id },
              [WISHLIST_MODULE]: { wishlist_item_id: item.id },
            },
            {
              [Modules.PRODUCT]: { product_id: input.product_id },
              [WISHLIST_MODULE]: { wishlist_item_id: item.id },
            },
          ]
        : [],
    )
    dismissRemoteLinkStep(links)
    return new WorkflowResponse(item)
  },
)
