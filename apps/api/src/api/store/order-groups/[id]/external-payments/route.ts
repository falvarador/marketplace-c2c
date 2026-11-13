import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { isExternalSinpePayment } from "../../../../../utils/external-sinpe"
import { toWhatsAppNumber } from "../../../../../utils/whatsapp"

type CustomerAuthenticatedRequest = MedusaRequest & {
  auth_context?: {
    actor_id?: string
  }
}

type SellerOrder = {
  id: string
  display_id?: number
  total?: number
  currency_code?: string
  metadata?: Record<string, unknown> | null
  seller?: {
    name?: string | null
    phone?: string | null
  } | null
  cart?: {
    payment_collection?: {
      payment_sessions?: Array<{ provider_id?: string }>
    } | null
  } | null
}

type OrderGroup = {
  id: string
  customer_id: string
  orders?: SellerOrder[]
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

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "order_group",
    fields: [
      "id",
      "customer_id",
      "orders.id",
      "orders.display_id",
      "orders.total",
      "orders.currency_code",
      "orders.metadata",
      "orders.seller.name",
      "orders.seller.phone",
      "orders.cart.payment_collection.payment_sessions.provider_id",
    ],
    filters: { id: req.params.id, customer_id: customerId },
  })
  const group = (data as OrderGroup[])[0]
  if (!group) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Order group not found.")
  }

  const externalOrders = (group.orders ?? [])
    .filter((order) =>
      isExternalSinpePayment(
        order.cart?.payment_collection?.payment_sessions,
      ),
    )
    .map((order) => ({
      id: order.id,
      display_id: order.display_id,
      total: order.total,
      currency_code: order.currency_code,
      seller_name: order.seller?.name ?? "Vendedor",
      whatsapp_number: toWhatsAppNumber(order.seller?.phone),
      payment_status:
        order.metadata?.external_payment_status === "confirmed"
          ? "confirmed"
          : "pending",
    }))

  res.json({ seller_orders: externalOrders })
}
