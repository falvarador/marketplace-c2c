import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { ProductStatus, SellerStatus } from "@mercurjs/types"
import { getDefaultTransactionMode, type TransactionMode } from "./transaction-mode"

export type ProductMarketplacePolicy = {
  product_id: string
  seller_id: string
  transaction_mode: TransactionMode
}

type ProductRow = {
  id: string
  status: string
  categories?: Array<{ id: string }>
}

type OfferRow = {
  seller_id: string
  variant_id: string
  seller?: { status: string }
}

type CategoryPolicyRow = {
  category_marketplace_policy?: {
    transaction_mode: string | null
  } | null
}

export async function resolveCategoryTransactionMode(
  container: MedusaContainer,
  categoryIds: string[],
): Promise<TransactionMode> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: categories } = categoryIds.length
    ? await query.graph({
        entity: "product_category",
        fields: ["category_marketplace_policy.transaction_mode"],
        filters: { id: categoryIds },
      })
    : { data: [] }
  const overrides = (categories as CategoryPolicyRow[])
    .map(({ category_marketplace_policy }) =>
      category_marketplace_policy?.transaction_mode,
    )
    .filter(
      (mode): mode is TransactionMode =>
        mode === "checkout" || mode === "lead",
    )

  return overrides.includes("lead")
    ? "lead"
    : overrides.includes("checkout")
      ? "checkout"
      : getDefaultTransactionMode()
}

export async function resolveProductMarketplacePolicy(
  container: MedusaContainer,
  productId: string,
  variantId?: string,
): Promise<ProductMarketplacePolicy> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: products } = await query.graph({
    entity: "product",
    fields: ["id", "status", "categories.id"],
    filters: { id: productId },
  })
  const product = (products as ProductRow[])[0]
  if (!product || product.status !== ProductStatus.PUBLISHED) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Product not found.")
  }

  const { data: offers } = await query.graph({
    entity: "offer",
    fields: ["id", "seller_id", "variant_id", "seller.status"],
    filters: { product_id: productId },
  })
  const offer = (offers as OfferRow[]).find(
    (candidate) =>
      candidate.seller?.status === SellerStatus.OPEN &&
      (!variantId || candidate.variant_id === variantId),
  )
  if (!offer) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "Product is not available.",
    )
  }

  const categoryIds = (product.categories ?? []).map(
    (category: { id: string }) => category.id,
  )
  return {
    product_id: productId,
    seller_id: offer.seller_id,
    transaction_mode: await resolveCategoryTransactionMode(
      container,
      categoryIds,
    ),
  }
}
