import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { updateProductsWorkflow } from "@medusajs/medusa/core-flows"
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
} from "@medusajs/framework/utils"
import { ProductStatus } from "@mercurjs/types"
import { ensureSellerOwnsProduct } from "@mercurjs/core/api/vendor/products/helpers"
import { ProductWorkflowEvents } from "@mercurjs/core/workflows/product/events"
import { canSellerPublish } from "../../../../../utils/seller-policy"
import { assertCheckoutSellerHasWhatsApp } from "../../../../../utils/seller-checkout-contact"

type SellerContextRequest = MedusaRequest & {
  seller_context?: {
    seller_member?: {
      seller?: {
        id: string
        status: string
      }
    }
  }
}

export const POST = async (
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> => {
  const seller = (req as SellerContextRequest).seller_context?.seller_member
    ?.seller
  if (!seller) {
    throw new MedusaError(
      MedusaError.Types.UNAUTHORIZED,
      "Seller context is required.",
    )
  }

  const body = req.body as { status?: unknown } | undefined
  if (body?.status !== ProductStatus.DRAFT && body?.status !== ProductStatus.PUBLISHED) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "status must be draft or published.",
    )
  }
  if (
    body.status === ProductStatus.PUBLISHED &&
    !canSellerPublish(seller.status)
  ) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Only active sellers can publish products.",
    )
  }

  await ensureSellerOwnsProduct(req.scope, seller.id, [req.params.id])

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: currentProducts } = await query.graph({
    entity: "product",
    fields: ["id", "status"],
    filters: { id: req.params.id },
  })
  const currentProduct = currentProducts[0]
  if (!currentProduct) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "Product not found.",
    )
  }

  if (body.status === ProductStatus.PUBLISHED) {
    const { data: products } = await query.graph({
      entity: "product",
      fields: ["categories.id"],
      filters: { id: req.params.id },
    })
    await assertCheckoutSellerHasWhatsApp(
      req.scope,
      seller.id,
      products[0]?.categories?.map(({ id }: { id: string }) => id) ?? [],
    )
  }

  await updateProductsWorkflow(req.scope).run({
    input: {
      selector: { id: req.params.id },
      update: { status: body.status },
    },
  })

  if (
    body.status === ProductStatus.PUBLISHED &&
    currentProduct.status !== ProductStatus.PUBLISHED
  ) {
    const eventBus = req.scope.resolve(Modules.EVENT_BUS)
    await eventBus.emit({
      name: ProductWorkflowEvents.PUBLISHED,
      data: [{ id: req.params.id }],
    })
  }

  res.json({ id: req.params.id, status: body.status })
}
