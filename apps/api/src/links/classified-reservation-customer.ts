import { defineLink } from "@medusajs/framework/utils"
import Customer from "@medusajs/medusa/customer"
import ClassifiedEngagement from "../modules/classified-engagement"

export default defineLink(
  Customer.linkable.customer,
  {
    linkable: ClassifiedEngagement.linkable.reservationRequest,
    isList: true,
  },
)
