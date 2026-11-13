import { MedusaError } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import {
  WISHLIST_MODULE,
  WishlistModuleService,
} from "../../../modules/wishlist"
import { resolveProductMarketplacePolicy } from "../../../utils/product-marketplace-policy"

export type UpsertWishlistItemInput = {
  customer_id: string
  product_id: string
}

export const upsertWishlistItemStep = createStep<
  UpsertWishlistItemInput,
  { id: string; created: boolean },
  string | undefined
>(
  "upsert-wishlist-item",
  async (input, { container }) => {
    await resolveProductMarketplacePolicy(container, input.product_id)
    const service = container.resolve<WishlistModuleService>(WISHLIST_MODULE)
    const claimKey = `${input.customer_id}:${input.product_id}`
    const existing = await service.listWishlistItems({ claim_key: claimKey })
    if (existing[0]) {
      return new StepResponse({ id: existing[0].id, created: false })
    }

    try {
      const item = await service.createWishlistItems({
        ...input,
        claim_key: claimKey,
      })
      return new StepResponse({ id: item.id, created: true }, item.id)
    } catch (error) {
      const dbError = error as { code?: string; cause?: { code?: string } }
      if (dbError.code !== "23505" && dbError.cause?.code !== "23505") {
        throw error
      }

      const concurrentItem = await service.listWishlistItems({
        claim_key: claimKey,
      })
      if (!concurrentItem[0]) {
        throw error
      }
      return new StepResponse({ id: concurrentItem[0].id, created: false })
    }
  },
  async (itemId, { container }) => {
    if (!itemId) {
      return
    }
    const service = container.resolve<WishlistModuleService>(WISHLIST_MODULE)
    await service.deleteWishlistItems(itemId)
  },
)

export function parseWishlistProductId(body: unknown): string {
  const productId = (body as { product_id?: unknown } | undefined)?.product_id
  if (typeof productId !== "string" || productId.trim().length === 0) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "product_id is required.",
    )
  }
  return productId
}
