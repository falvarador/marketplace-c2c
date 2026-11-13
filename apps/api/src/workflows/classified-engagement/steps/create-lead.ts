import { MedusaError } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import {
  CLASSIFIED_ENGAGEMENT_MODULE,
  ClassifiedEngagementModuleService,
} from "../../../modules/classified-engagement"
import { resolveProductMarketplacePolicy } from "../../../utils/product-marketplace-policy"

export type CreateLeadInput = {
  product_id: string
  seller_id: string
  customer_id: string
  message: string | null
}

export const createLeadStep = createStep<
  CreateLeadInput,
  { id: string },
  string
>(
  "create-classified-lead",
  async (input, { container }) => {
    const policy = await resolveProductMarketplacePolicy(
      container,
      input.product_id,
    )
    if (
      policy.transaction_mode !== "lead" ||
      policy.seller_id !== input.seller_id
    ) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        "Product is not available for classified leads.",
      )
    }

    const service = container.resolve<ClassifiedEngagementModuleService>(
      CLASSIFIED_ENGAGEMENT_MODULE,
    )
    const lead = await service.createLeads({
      customer_id: input.customer_id,
      product_id: input.product_id,
      seller_id: input.seller_id,
      message: input.message,
      status: "open",
    })
    return new StepResponse(
      { id: lead.id },
      lead.id,
    )
  },
  async (leadId, { container }) => {
    if (!leadId) {
      return
    }
    const service = container.resolve<ClassifiedEngagementModuleService>(
      CLASSIFIED_ENGAGEMENT_MODULE,
    )
    await service.deleteLeads(leadId)
  },
)
