import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import {
  CLASSIFIED_ENGAGEMENT_MODULE,
  ClassifiedEngagementModuleService,
} from "../../../modules/classified-engagement"

type SellerScopedRequest = MedusaRequest & {
  seller_context?: {
    seller_member?: {
      seller?: {
        id?: string
      }
    }
  }
}

export const GET = async (
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> => {
  const sellerId = (req as SellerScopedRequest).seller_context?.seller_member
    ?.seller?.id
  if (!sellerId) {
    throw new MedusaError(
      MedusaError.Types.UNAUTHORIZED,
      "Seller context is required.",
    )
  }
  const service = req.scope.resolve<ClassifiedEngagementModuleService>(
    CLASSIFIED_ENGAGEMENT_MODULE,
  )
  const reservationRequests = await service.listReservationRequests(
    { seller_id: sellerId },
    { order: { created_at: "DESC" } },
  )
  const sellerReservationRequests = reservationRequests.map(
    ({ id, product_id, variant_id, message, status, created_at }) => ({
      id,
      product_id,
      variant_id,
      message,
      status,
      created_at,
    }),
  )
  res.json({
    reservation_requests: sellerReservationRequests,
    count: sellerReservationRequests.length,
  })
}
