import { model } from "@medusajs/framework/utils"

const ReservationRequest = model
  .define("reservation_request", {
    id: model.id({ prefix: "resreq" }).primaryKey(),
    customer_id: model.text(),
    product_id: model.text(),
    variant_id: model.text(),
    seller_id: model.text(),
    claim_key: model.text(),
    message: model.text().nullable(),
    status: model.enum(["pending", "confirmed", "declined"]).default("pending"),
    metadata: model.json().nullable(),
  })
  .indexes([
    { on: ["customer_id"] },
    { on: ["seller_id"] },
    {
      name: "IDX_reservation_request_active_claim",
      on: ["claim_key"],
      unique: true,
      where:
        "deleted_at IS NULL AND status IN ('pending', 'confirmed')",
    },
  ])

export default ReservationRequest
