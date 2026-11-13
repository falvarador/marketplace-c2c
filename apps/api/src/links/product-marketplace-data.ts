import { defineLink } from "@medusajs/framework/utils"
import Product from "@medusajs/medusa/product"
import MarketplacePolicy from "../modules/marketplace-policy"

export default defineLink(
  Product.linkable.product,
  MarketplacePolicy.linkable.productMarketplaceData,
)
