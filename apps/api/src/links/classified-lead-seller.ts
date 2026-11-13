import { defineLink } from "@medusajs/framework/utils"
import Seller from "@mercurjs/core/modules/seller"
import ClassifiedEngagement from "../modules/classified-engagement"

export default defineLink(
  Seller.linkable.seller,
  {
    linkable: ClassifiedEngagement.linkable.classifiedLead,
    isList: true,
  },
)
