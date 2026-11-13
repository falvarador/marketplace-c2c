import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { createReservationRequestWorkflow } from "../../../workflows/classified-engagement/workflows/create-reservation-request"
import { resolveProductMarketplacePolicy } from "../../../utils/product-marketplace-policy"
import { parseReservationRequestBody } from "../../../utils/classified-input"
import {
  CLASSIFIED_ENGAGEMENT_MODULE,
  ClassifiedEngagementModuleService,
} from "../../../modules/classified-engagement"

type CustomerAuthenticatedRequest = MedusaRequest & {
  auth_context?: {
    actor_id?: string
  }
}

export const GET = async (
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> => {
  const customerId = (req as CustomerAuthenticatedRequest).auth_context?.actor_id
  if (!customerId) {
    throw new MedusaError(
      MedusaError.Types.UNAUTHORIZED,
      "Customer authentication is required.",
    )
  }
  const service = req.scope.resolve<ClassifiedEngagementModuleService>(
    CLASSIFIED_ENGAGEMENT_MODULE,
  )
  const reservationRequests = await service.listReservationRequests(
    { customer_id: customerId },
    { order: { created_at: "DESC" } },
  )
  const buyerReservationRequests = reservationRequests.map(
    ({ id, product_id, variant_id, seller_id, message, status, created_at }) => ({
      id,
      product_id,
      variant_id,
      seller_id,
      message,
      status,
      created_at,
    }),
  )
  res.json({
    reservation_requests: buyerReservationRequests,
    count: buyerReservationRequests.length,
  })
}

export const POST = async (
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> => {
  const customerId = (req as CustomerAuthenticatedRequest).auth_context?.actor_id
  if (!customerId) {
    throw new MedusaError(
      MedusaError.Types.UNAUTHORIZED,
      "Customer authentication is required.",
    )
  }
  const body = parseReservationRequestBody(req.body)
  const policy = await resolveProductMarketplacePolicy(
    req.scope,
    body.product_id,
    body.variant_id,
  )
  const { result } = await createReservationRequestWorkflow(req.scope).run({
    input: {
      ...body,
      seller_id: policy.seller_id,
      customer_id: customerId,
    },
  })
  res.status(201).json({ reservation_request: result })
}
