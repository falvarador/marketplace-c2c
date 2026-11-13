import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import {
  WISHLIST_MODULE,
  WishlistModuleService,
} from "../../../modules/wishlist"
import type { UpsertWishlistItemInput } from "./upsert-wishlist-item"

type WishlistItemRecord = {
  id: string
  customer_id: string
  product_id: string
  claim_key: string
}

export const deleteWishlistItemStep = createStep<
  UpsertWishlistItemInput,
  { id: string | null },
  WishlistItemRecord | undefined
>(
  "delete-wishlist-item",
  async (input, { container }) => {
    const service = container.resolve<WishlistModuleService>(WISHLIST_MODULE)
    const items = await service.listWishlistItems(input)
    const item = items[0] as WishlistItemRecord | undefined
    if (!item) {
      return new StepResponse({ id: null })
    }
    await service.deleteWishlistItems(item.id)
    return new StepResponse({ id: item.id }, item)
  },
  async (item, { container }) => {
    if (!item) {
      return
    }
    const service = container.resolve<WishlistModuleService>(WISHLIST_MODULE)
    await service.createWishlistItems(item)
  },
)
