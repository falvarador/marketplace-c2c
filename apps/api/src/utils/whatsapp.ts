export function normalizeWhatsAppPhone(value: unknown): string | null {
  if (typeof value !== "string") return null
  const phone = value.replace(/[\s().-]/g, "")
  if (!/^\+?[1-9]\d{7,14}$/.test(phone)) return null
  return phone.startsWith("+") ? phone : `+${phone}`
}

export function toWhatsAppNumber(value: unknown): string | null {
  const phone = normalizeWhatsAppPhone(value)
  return phone?.replace(/^\+/, "") ?? null
}
