import { Modules } from "@medusajs/framework/utils"
import type { LinkDefinition } from "@medusajs/framework/types"
import { createRemoteLinkStep } from "@medusajs/medusa/core-flows"
import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { WISHLIST_MODULE } from "../../../modules/wishlist"
import { upsertWishlistItemStep } from "../steps/upsert-wishlist-item"

export const upsertWishlistItemWorkflow = createWorkflow(
  "upsert-wishlist-item",
  (input: { customer_id: string; product_id: string }) => {
    const item = upsertWishlistItemStep(input)
    const links = transform({ input, item }, ({ input, item }): LinkDefinition[] =>
      item.created
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
    createRemoteLinkStep(links)
    return new WorkflowResponse(item)
  },
)
