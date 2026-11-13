export const EXTERNAL_SINPE_PROVIDER_ID =
  "pp_external_sinpe_external_sinpe"

export type PaymentSessionReference = {
  provider_id?: string
}

export function isExternalSinpePayment(
  sessions: PaymentSessionReference[] | undefined,
): boolean {
  return sessions?.some(
    ({ provider_id }) => provider_id === EXTERNAL_SINPE_PROVIDER_ID,
  ) ?? false
}
