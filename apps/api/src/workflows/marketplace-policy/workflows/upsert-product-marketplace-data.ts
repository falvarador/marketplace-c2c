import { Modules } from "@medusajs/framework/utils"
import { createRemoteLinkStep } from "@medusajs/medusa/core-flows"
import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { MARKETPLACE_POLICY_MODULE } from "../../../modules/marketplace-policy"
import {
  upsertProductMarketplaceDataStep,
  type UpsertProductMarketplaceDataInput,
} from "../steps/upsert-product-marketplace-data"

export const upsertProductMarketplaceDataWorkflow = createWorkflow(
  "upsert-product-marketplace-data",
  (input: UpsertProductMarketplaceDataInput) => {
    const result = upsertProductMarketplaceDataStep(input)
    const links = transform({ input, result }, ({ input, result }) =>
      result.created
        ? [
            {
              [Modules.PRODUCT]: { product_id: input.product_id },
              [MARKETPLACE_POLICY_MODULE]: {
                product_marketplace_data_id: result.record.id,
              },
            },
          ]
        : [],
    )

    createRemoteLinkStep(links)
    return new WorkflowResponse(result.record)
  },
)
