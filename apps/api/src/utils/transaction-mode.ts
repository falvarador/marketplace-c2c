export type TransactionMode = "checkout" | "lead"

export function getDefaultTransactionMode(): TransactionMode {
  const configured = process.env.MARKETPLACE_DEFAULT_TRANSACTION_MODE ?? "checkout"
  if (configured !== "checkout" && configured !== "lead") {
    throw new Error(
      "MARKETPLACE_DEFAULT_TRANSACTION_MODE must be checkout or lead.",
    )
  }
  return configured
}
