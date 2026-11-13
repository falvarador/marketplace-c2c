import { SellerStatus } from "@mercurjs/types"

export function canSellerPublish(status: string | null | undefined): boolean {
  return status === SellerStatus.OPEN
}

export function canSellerAcceptTransactions(
  status: string | null | undefined,
): boolean {
  return status === SellerStatus.OPEN
}
