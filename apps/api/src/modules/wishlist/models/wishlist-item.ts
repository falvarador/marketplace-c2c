import { model } from "@medusajs/framework/utils"

const WishlistItem = model
  .define("wishlist_item", {
    id: model.id({ prefix: "wish" }).primaryKey(),
    customer_id: model.text(),
    product_id: model.text(),
    claim_key: model.text().unique(),
  })
  .indexes([
    { on: ["customer_id"] },
  ])

export default WishlistItem
