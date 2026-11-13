import { MedusaError } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import {
  CLASSIFIED_ENGAGEMENT_MODULE,
  ClassifiedEngagementModuleService,
} from "../../../modules/classified-engagement"

export type DecideReservationRequestInput = {
  request_id: string
  seller_id: string
  status: "confirmed" | "declined"
}

export const decideReservationRequestStep = createStep<
  DecideReservationRequestInput,
  { id: string; status: "confirmed" | "declined" },
  { id: string; status: "pending" }
>(
  "decide-classified-reservation-request",
  async (input, { container }) => {
    const service = container.resolve<ClassifiedEngagementModuleService>(
      CLASSIFIED_ENGAGEMENT_MODULE,
    )
    const requests = await service.listReservationRequests({
      id: input.request_id,
      seller_id: input.seller_id,
    })
    const request = requests[0]
    if (!request) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        "Reservation request not found.",
      )
    }
    if (request.status !== "pending") {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "Only pending reservation requests can be decided.",
      )
    }

    await service.updateReservationRequests({
      id: input.request_id,
      status: input.status,
    })
    return new StepResponse(
      { id: input.request_id, status: input.status },
      { id: input.request_id, status: "pending" },
    )
  },
  async (previous, { container }) => {
    if (!previous) {
      return
    }
    const service = container.resolve<ClassifiedEngagementModuleService>(
      CLASSIFIED_ENGAGEMENT_MODULE,
    )
    await service.updateReservationRequests(previous)
  },
)
