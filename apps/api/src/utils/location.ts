import { MedusaError } from "@medusajs/framework/utils"

export type ProductLocationInput = {
  country_code?: string | null
  region?: string | null
  locality?: string | null
}

export function parseProductLocationInput(
  value: unknown,
): ProductLocationInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Location must be a JSON object.",
    )
  }

  const input = value as Record<string, unknown>
  const result: ProductLocationInput = {}

  if ("country_code" in input) {
    if (
      input.country_code !== null &&
      (typeof input.country_code !== "string" ||
        !/^[a-z]{2}$/i.test(input.country_code))
    ) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "country_code must be a two-letter ISO 3166-1 alpha-2 code.",
      )
    }
    result.country_code =
      typeof input.country_code === "string"
        ? input.country_code.toUpperCase()
        : null
  }

  for (const field of ["region", "locality"] as const) {
    if (!(field in input)) {
      continue
    }
    const fieldValue = input[field]
    if (
      fieldValue !== null &&
      (typeof fieldValue !== "string" || fieldValue.length > 120)
    ) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `${field} must be a string of at most 120 characters or null.`,
      )
    }
    result[field] = fieldValue as string | null
  }

  return result
}
