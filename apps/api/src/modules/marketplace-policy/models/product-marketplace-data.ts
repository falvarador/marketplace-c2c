import { model } from "@medusajs/framework/utils"

const ProductMarketplaceData = model
  .define("product_marketplace_data", {
    id: model.id({ prefix: "pmd" }).primaryKey(),
    country_code: model.text().nullable(),
    region: model.text().nullable(),
    locality: model.text().nullable(),
    metadata: model.json().nullable(),
  })
  .indexes([
    {
      name: "IDX_product_marketplace_data_country",
      on: ["country_code"],
      where: "deleted_at IS NULL AND country_code IS NOT NULL",
    },
    {
      name: "IDX_product_marketplace_data_region",
      on: ["region"],
      where: "deleted_at IS NULL AND region IS NOT NULL",
    },
    {
      name: "IDX_product_marketplace_data_locality",
      on: ["locality"],
      where: "deleted_at IS NULL AND locality IS NOT NULL",
    },
  ])

export default ProductMarketplaceData
