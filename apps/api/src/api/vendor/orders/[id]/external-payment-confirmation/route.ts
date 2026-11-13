import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { validateSellerOrder } from "@mercurjs/core/api/vendor/orders/helpers"
import { EXTERNAL_SINPE_PROVIDER_ID } from "../../../../../utils/external-sinpe"
import { confirmExternalPaymentWorkflow } from "../../../../../workflows/external-payment/workflows/confirm-external-payment"

type SellerContextRequest = MedusaRequest & {
  seller_context?: {
    seller_member?: {
      seller?: {
        id: string
      }
    }
  }
}

type SellerOrder = {
  id: string
  metadata?: Record<string, unknown> | null
  cart?: {
    payment_collection?: {
      payment_sessions?: Array<{ provider_id?: string }>
    } | null
  } | null
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

  await validateSellerOrder(req.scope, sellerId, req.params.id)

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "metadata",
      "cart.payment_collection.payment_sessions.provider_id",
    ],
    filters: { id: req.params.id },
  })
  const order = (data as SellerOrder[])[0]
  if (
    !order?.cart?.payment_collection?.payment_sessions?.some(
      ({ provider_id }) => provider_id === EXTERNAL_SINPE_PROVIDER_ID,
    )
  ) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "External SINPE payment not found for this order.",
    )
  }
  if (
    order.metadata?.external_payment_status !== undefined &&
    order.metadata.external_payment_status !== "pending"
  ) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "This external payment is no longer awaiting confirmation.",
    )
  }

  const metadata = {
    ...(order.metadata ?? {}),
    external_payment_status: "confirmed",
    external_payment_confirmed_at: new Date().toISOString(),
    external_payment_confirmed_by: sellerId,
  }
  await confirmExternalPaymentWorkflow(req.scope).run({
    input: {
      order_id: order.id,
      metadata,
    },
  })

  res.json({ order_id: order.id, external_payment_status: "confirmed" })
}
