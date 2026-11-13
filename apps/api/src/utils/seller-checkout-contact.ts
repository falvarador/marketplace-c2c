import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { resolveCategoryTransactionMode } from "./product-marketplace-policy"
import { normalizeWhatsAppPhone } from "./whatsapp"

export async function getCategoryTransactionMode(
  container: MedusaContainer,
  categoryIds: string[],
): Promise<"checkout" | "lead"> {
  return resolveCategoryTransactionMode(container, categoryIds)
}

export async function assertCheckoutSellerHasWhatsApp(
  container: MedusaContainer,
  sellerId: string,
  categoryIds: string[],
): Promise<void> {
  if (await getCategoryTransactionMode(container, categoryIds) !== "checkout") {
    return
  }

  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: sellers } = await query.graph({
    entity: "seller",
    fields: ["phone"],
    filters: { id: sellerId },
  })

  if (!normalizeWhatsAppPhone(sellers[0]?.phone)) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "A valid WhatsApp number is required to publish checkout offers.",
    )
  }
}
