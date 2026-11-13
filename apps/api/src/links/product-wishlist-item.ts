import { defineLink } from "@medusajs/framework/utils"
import Product from "@medusajs/medusa/product"
import Wishlist from "../modules/wishlist"

export default defineLink(
  Product.linkable.product,
  Wishlist.linkable.wishlistItem,
)
