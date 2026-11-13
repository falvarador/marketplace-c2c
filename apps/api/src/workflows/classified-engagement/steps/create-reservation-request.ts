import {
  ContainerRegistrationKeys,
  getTotalVariantAvailability,
  MedusaError,
} from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import {
  CLASSIFIED_ENGAGEMENT_MODULE,
  ClassifiedEngagementModuleService,
} from "../../../modules/classified-engagement"
import { resolveProductMarketplacePolicy } from "../../../utils/product-marketplace-policy"
import { isVariantReservable } from "../../../utils/reservation-policy"

export type CreateReservationRequestInput = {
  product_id: string
  variant_id: string
  seller_id: string
  customer_id: string
  message: string | null
}

export const createReservationRequestStep = createStep<
  CreateReservationRequestInput,
  { id: string },
  string
>(
  "create-classified-reservation-request",
  async (input, { container }) => {
    const policy = await resolveProductMarketplacePolicy(
      container,
      input.product_id,
      input.variant_id,
    )
    if (
      policy.transaction_mode !== "lead" ||
      policy.seller_id !== input.seller_id
    ) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        "Product is not available for reservation.",
      )
    }

    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const { data: products } = await query.graph({
      entity: "product",
      fields: ["variants.id", "variants.manage_inventory"],
      filters: { id: input.product_id },
    })
    const variant = products[0]?.variants?.find(
      ({ id }: { id: string }) => id === input.variant_id,
    )
    if (!variant) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        "Product variant is not available for reservation.",
      )
    }

    if (variant.manage_inventory) {
      const availability = await getTotalVariantAvailability(query, {
        variant_ids: [variant.id],
      })
      if (!isVariantReservable(variant, availability[variant.id]?.availability)) {
        throw new MedusaError(
          MedusaError.Types.NOT_ALLOWED,
          "This product variant is out of stock.",
        )
      }
    }

    const service = container.resolve<ClassifiedEngagementModuleService>(
      CLASSIFIED_ENGAGEMENT_MODULE,
    )
    try {
      const request = await service.createReservationRequests({
        customer_id: input.customer_id,
        product_id: input.product_id,
        variant_id: input.variant_id,
        seller_id: input.seller_id,
        claim_key: input.variant_id,
        message: input.message,
        status: "pending",
      })
      return new StepResponse({ id: request.id }, request.id)
    } catch (error) {
      const dbError = error as { code?: string; cause?: { code?: string } }
      if (dbError.code === "23505" || dbError.cause?.code === "23505") {
        throw new MedusaError(
          MedusaError.Types.CONFLICT,
          "This item already has an active reservation request.",
        )
      }
      throw error
    }
  },
  async (requestId, { container }) => {
    if (!requestId) {
      return
    }
    const service = container.resolve<ClassifiedEngagementModuleService>(
      CLASSIFIED_ENGAGEMENT_MODULE,
    )
    await service.deleteReservationRequests(requestId)
  },
)
