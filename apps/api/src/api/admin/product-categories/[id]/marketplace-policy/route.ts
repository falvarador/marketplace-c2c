import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { upsertCategoryMarketplacePolicyWorkflow } from "../../../../../workflows/marketplace-policy/workflows/upsert-category-marketplace-policy"

export const POST = async (
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> => {
  const body = req.body as { transaction_mode?: unknown } | undefined
  const mode = body?.transaction_mode
  if (mode !== null && mode !== "checkout" && mode !== "lead") {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "transaction_mode must be checkout, lead, or null.",
    )
  }

  const { result } = await upsertCategoryMarketplacePolicyWorkflow(
    req.scope,
  ).run({
    input: {
      category_id: req.params.id,
      transaction_mode: mode,
    },
  })

  res.json({ marketplace_policy: result })
}
