import { defineLink } from "@medusajs/framework/utils"
import Customer from "@medusajs/medusa/customer"
import Wishlist from "../modules/wishlist"

export default defineLink(
  Customer.linkable.customer,
  Wishlist.linkable.wishlistItem,
)
