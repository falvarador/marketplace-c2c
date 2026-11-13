import { MedusaError } from "@medusajs/framework/utils"

export type LeadRequestBody = {
  product_id: string
  message: string | null
}

export type ReservationRequestBody = LeadRequestBody & {
  variant_id: string
}

function readObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Request body must be a JSON object.",
    )
  }
  return value as Record<string, unknown>
}

function readMessage(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null
  }
  if (typeof value !== "string" || value.length > 2000) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "message must be a string of at most 2000 characters or null.",
    )
  }
  return value
}

export function parseLeadRequestBody(value: unknown): LeadRequestBody {
  const body = readObject(value)
  if (typeof body.product_id !== "string" || !body.product_id.trim()) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "product_id is required.",
    )
  }
  return {
    product_id: body.product_id,
    message: readMessage(body.message),
  }
}

export function parseReservationRequestBody(
  value: unknown,
): ReservationRequestBody {
  const body = readObject(value)
  if (typeof body.variant_id !== "string" || !body.variant_id.trim()) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "variant_id is required for a reservation request.",
    )
  }
  return {
    ...parseLeadRequestBody(body),
    variant_id: body.variant_id,
  }
}
