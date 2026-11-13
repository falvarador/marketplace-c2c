import { defineLink } from "@medusajs/framework/utils"
import Product from "@medusajs/medusa/product"
import ClassifiedEngagement from "../modules/classified-engagement"

export default defineLink(
  Product.linkable.product,
  {
    linkable: ClassifiedEngagement.linkable.reservationRequest,
    isList: true,
  },
)
