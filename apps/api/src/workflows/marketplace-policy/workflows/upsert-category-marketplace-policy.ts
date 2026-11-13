import { Modules } from "@medusajs/framework/utils"
import { createRemoteLinkStep } from "@medusajs/medusa/core-flows"
import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { MARKETPLACE_POLICY_MODULE } from "../../../modules/marketplace-policy"
import { upsertCategoryMarketplacePolicyStep } from "../steps/upsert-category-marketplace-policy"

export const upsertCategoryMarketplacePolicyWorkflow = createWorkflow(
  "upsert-category-marketplace-policy",
  (input: {
    category_id: string
    transaction_mode: "checkout" | "lead" | null
  }) => {
    const result = upsertCategoryMarketplacePolicyStep(input)
    const links = transform({ input, result }, ({ input, result }) =>
      result.created
        ? [
            {
              [MARKETPLACE_POLICY_MODULE]: {
                category_marketplace_policy_id: result.record.id,
              },
              [Modules.PRODUCT]: {
                product_category_id: input.category_id,
              },
            },
          ]
        : [],
    )
    createRemoteLinkStep(links)
    return new WorkflowResponse(result.record)
  },
)
