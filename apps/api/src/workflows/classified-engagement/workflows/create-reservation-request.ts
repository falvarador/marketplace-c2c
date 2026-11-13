import { Modules } from "@medusajs/framework/utils"
import { createRemoteLinkStep } from "@medusajs/medusa/core-flows"
import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { MercurModules } from "@mercurjs/types"
import { CLASSIFIED_ENGAGEMENT_MODULE } from "../../../modules/classified-engagement"
import {
  createReservationRequestStep,
  type CreateReservationRequestInput,
} from "../steps/create-reservation-request"

export const createReservationRequestWorkflow = createWorkflow(
  "create-classified-reservation-request",
  (input: CreateReservationRequestInput) => {
    const request = createReservationRequestStep(input)
    createRemoteLinkStep([
      {
        [Modules.PRODUCT]: { product_id: input.product_id },
        [CLASSIFIED_ENGAGEMENT_MODULE]: { reservation_request_id: request.id },
      },
      {
        [Modules.CUSTOMER]: { customer_id: input.customer_id },
        [CLASSIFIED_ENGAGEMENT_MODULE]: { reservation_request_id: request.id },
      },
      {
        [MercurModules.SELLER]: { seller_id: input.seller_id },
        [CLASSIFIED_ENGAGEMENT_MODULE]: { reservation_request_id: request.id },
      },
    ])
    return new WorkflowResponse(request)
  },
)
