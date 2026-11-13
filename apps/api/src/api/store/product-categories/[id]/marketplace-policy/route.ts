import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { getCategoryTransactionMode } from "../../../../../utils/seller-checkout-contact"

export const GET = async (
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: categories } = await query.graph({
    entity: "product_category",
    fields: ["id"],
    filters: { id: req.params.id },
  })
  if (!categories[0]) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Category not found.")
  }

  const transactionMode = await getCategoryTransactionMode(req.scope, [req.params.id])
  res.json({ transaction_mode: transactionMode })
}
