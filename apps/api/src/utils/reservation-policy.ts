type ReservableVariant = {
  manage_inventory: boolean
}

export function isVariantReservable(
  variant: ReservableVariant,
  availableQuantity: number | null | undefined,
): boolean {
  return !variant.manage_inventory || (availableQuantity ?? 0) > 0
}
