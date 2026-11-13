import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { decideReservationRequestWorkflow } from "../../../../../workflows/classified-engagement/workflows/decide-reservation-request"

type SellerContextRequest = MedusaRequest & {
  seller_context?: {
    seller_member?: {
      seller?: {
        id: string
      }
    }
  }
}

export const POST = async (
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> => {
  const sellerId = (req as SellerContextRequest).seller_context?.seller_member
    ?.seller?.id
  if (!sellerId) {
    throw new MedusaError(
      MedusaError.Types.UNAUTHORIZED,
      "Seller context is required.",
    )
  }
  const body = req.body as { status?: unknown } | undefined
  if (body?.status !== "confirmed" && body?.status !== "declined") {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "status must be confirmed or declined.",
    )
  }

  const { result } = await decideReservationRequestWorkflow(req.scope).run({
    input: {
      request_id: req.params.id,
      seller_id: sellerId,
      status: body.status,
    },
  })
  res.json({ reservation_request: result })
}
