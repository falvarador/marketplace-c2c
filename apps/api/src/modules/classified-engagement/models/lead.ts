import { model } from "@medusajs/framework/utils"

const Lead = model
  .define("classified_lead", {
    id: model.id({ prefix: "lead" }).primaryKey(),
    customer_id: model.text(),
    product_id: model.text(),
    seller_id: model.text(),
    message: model.text().nullable(),
    status: model.enum(["open", "closed"]).default("open"),
    metadata: model.json().nullable(),
  })
  .indexes([
    { on: ["customer_id"] },
    { on: ["seller_id"] },
  ])

export default Lead
