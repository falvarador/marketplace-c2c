import { Modules } from "@medusajs/framework/utils"
import { createRemoteLinkStep } from "@medusajs/medusa/core-flows"
import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { MercurModules } from "@mercurjs/types"
import { CLASSIFIED_ENGAGEMENT_MODULE } from "../../../modules/classified-engagement"
import { createLeadStep, type CreateLeadInput } from "../steps/create-lead"

export const createLeadWorkflow = createWorkflow(
  "create-classified-lead",
  (input: CreateLeadInput) => {
    const lead = createLeadStep(input)
    createRemoteLinkStep([
      {
        [Modules.PRODUCT]: { product_id: input.product_id },
        [CLASSIFIED_ENGAGEMENT_MODULE]: {
          classified_lead_id: lead.id,
        },
      },
      {
        [Modules.CUSTOMER]: { customer_id: input.customer_id },
        [CLASSIFIED_ENGAGEMENT_MODULE]: {
          classified_lead_id: lead.id,
        },
      },
      {
        [MercurModules.SELLER]: { seller_id: input.seller_id },
        [CLASSIFIED_ENGAGEMENT_MODULE]: {
          classified_lead_id: lead.id,
        },
      },
    ])
    return new WorkflowResponse(lead)
  },
)
