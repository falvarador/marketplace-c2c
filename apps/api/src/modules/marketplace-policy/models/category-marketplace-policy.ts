import { model } from "@medusajs/framework/utils"

const CategoryMarketplacePolicy = model
  .define("category_marketplace_policy", {
    id: model.id({ prefix: "cmp" }).primaryKey(),
    transaction_mode: model.enum(["checkout", "lead"]).nullable(),
    metadata: model.json().nullable(),
  })

export default CategoryMarketplacePolicy
