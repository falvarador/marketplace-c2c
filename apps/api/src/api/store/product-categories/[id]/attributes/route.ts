import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  ContainerRegistrationKeys,
  MedusaError,
} from "@medusajs/framework/utils"

type AttributeDefinition = {
  id: string
  categories?: Array<{ id: string }> | { id: string } | null
  [key: string]: unknown
}

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
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "Product category not found.",
    )
  }

  const { data } = await query.graph({
    entity: "product_attribute",
    fields: [
      "id",
      "name",
      "handle",
      "description",
      "type",
      "is_required",
      "is_filterable",
      "is_variant_axis",
      "rank",
      "values.id",
      "values.name",
      "values.rank",
      "categories.id",
    ],
    filters: { is_active: true, product_id: null },
  })
  const attributes = (data as AttributeDefinition[]).filter((attribute) => {
    if (!attribute.is_filterable) {
      return false
    }

    const categories = Array.isArray(attribute.categories)
      ? attribute.categories
      : attribute.categories
        ? [attribute.categories]
        : []
    return (
      categories.length === 0 ||
      categories.some((category) => category.id === req.params.id)
    )
  })

  res.json({ product_attributes: attributes, count: attributes.length })
}
