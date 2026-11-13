import { defineLink } from "@medusajs/framework/utils"
import Product from "@medusajs/medusa/product"
import MarketplacePolicy from "../modules/marketplace-policy"

export default defineLink(
  {
    linkable: MarketplacePolicy.linkable.categoryMarketplacePolicy.id,
    isList: false,
  },
  {
    linkable: {
      ...Product.linkable.productCategory.id,
      alias: "product_category",
    },
    isList: false,
  },
  {
    database: {
      table: "product_category_marketplace_policy",
    },
  },
)
