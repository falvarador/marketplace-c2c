import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { createLeadWorkflow } from "../../../workflows/classified-engagement/workflows/create-lead"
import { resolveProductMarketplacePolicy } from "../../../utils/product-marketplace-policy"
import { parseLeadRequestBody } from "../../../utils/classified-input"
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
  const leads = await service.listLeads(
    { customer_id: customerId },
    { order: { created_at: "DESC" } },
  )
  const buyerLeads = leads.map(
    ({ id, product_id, seller_id, message, status, created_at }) => ({
      id,
      product_id,
      seller_id,
      message,
      status,
      created_at,
    }),
  )
  res.json({ leads: buyerLeads, count: buyerLeads.length })
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
  const body = parseLeadRequestBody(req.body)
  const policy = await resolveProductMarketplacePolicy(req.scope, body.product_id)
  const { result } = await createLeadWorkflow(req.scope).run({
    input: {
      ...body,
      seller_id: policy.seller_id,
      customer_id: customerId,
    },
  })
  res.status(201).json({ lead: result })
}
