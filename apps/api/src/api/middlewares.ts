import {
  defineMiddlewares,
  authenticate,
  type MedusaNextFunction,
  type MedusaRequest,
  type MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { ProductStatus, SellerStatus } from "@mercurjs/types"
import {
  canSellerAcceptTransactions,
  canSellerPublish,
} from "../utils/seller-policy"
import { assertCheckoutSellerHasWhatsApp } from "../utils/seller-checkout-contact"
import { normalizeWhatsAppPhone } from "../utils/whatsapp"
import { validateSellerOrder } from "@mercurjs/core/api/vendor/orders/helpers"
import { isExternalSinpePayment } from "../utils/external-sinpe"

type StoreProductRequest = MedusaRequest & {
  filterableFields?: Record<string, unknown>
}

type SellerScopedRequest = MedusaRequest & {
  seller_context?: {
    seller_id?: string
    seller_member?: {
      seller?: {
        id?: string
        status?: string
      }
    }
  }
}

type ProductCategoryInput = string | { id?: unknown }
type ProductPublicationBody = {
  status?: unknown
  categories?: ProductCategoryInput[]
}

type OfferBody = {
  offer_id?: unknown
}

type CartOfferItem = {
  offer?: {
    variant_id?: string
    seller?: {
      status?: string
    }
  }
}

type OrderForFulfillment = {
  id: string
  metadata?: Record<string, unknown> | null
  cart?: {
    payment_collection?: {
      payment_sessions?: Array<{ provider_id?: string }>
    } | null
  } | null
}

async function assertVariantsNotReserved(
  scope: MedusaRequest["scope"],
  variantIds: string[],
) {
  const uniqueVariantIds = [...new Set(variantIds)]
  if (!uniqueVariantIds.length) {
    return
  }
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: reservations } = await query.graph({
    entity: "reservation_request",
    fields: ["id"],
    filters: {
      variant_id: uniqueVariantIds,
      status: ["pending", "confirmed"],
    },
  })
  if (reservations.length) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "The cart contains an item with an active reservation request.",
    )
  }
}

async function restrictStoreProductsToActiveSellers(
  req: MedusaRequest,
  _res: MedusaResponse,
  next: MedusaNextFunction,
) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: sellers } = await query.graph({
    entity: "seller",
    fields: ["id"],
    filters: { status: SellerStatus.OPEN },
  })
  const sellerIds = sellers.map(({ id }) => id)
  const { data: offers } = sellerIds.length
    ? await query.graph({
        entity: "offer",
        fields: ["product_id"],
        filters: { seller_id: sellerIds },
      })
    : { data: [] }

  const eligibleProductIds = [
    ...new Set(offers.map(({ product_id }) => product_id)),
  ]
  const productRequest = req as StoreProductRequest
  const requestedIds = productRequest.filterableFields?.id
  const filteredIds =
    typeof requestedIds === "string"
      ? eligibleProductIds.filter((id) => id === requestedIds)
      : Array.isArray(requestedIds)
        ? eligibleProductIds.filter((id) => requestedIds.includes(id))
        : eligibleProductIds

  productRequest.filterableFields = {
    ...productRequest.filterableFields,
    id: filteredIds,
  }
  return next()
}

function assertActiveSeller(
  req: MedusaRequest,
  action: "publish products" | "manage offers or inventory",
) {
  const status = (req as SellerScopedRequest).seller_context?.seller_member?.seller
    ?.status
  const allowed =
    action === "publish products"
      ? canSellerPublish(status)
      : canSellerAcceptTransactions(status)

  if (!allowed) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      `Only active sellers can ${action}.`,
    )
  }
}

function getSellerId(req: MedusaRequest): string | undefined {
  const sellerRequest = req as SellerScopedRequest
  return sellerRequest.seller_context?.seller_member?.seller?.id ??
    sellerRequest.seller_context?.seller_id
}

function categoryIdsFromInput(value: ProductCategoryInput[] | undefined): string[] {
  return (value ?? [])
    .map((category) =>
      typeof category === "string"
        ? category
        : typeof category.id === "string"
          ? category.id
          : null,
    )
    .filter((id): id is string => id !== null)
}

async function getProductCategoryIds(req: MedusaRequest): Promise<string[]> {
  const body = req.body as ProductPublicationBody | undefined
  const providedCategoryIds = categoryIdsFromInput(body?.categories)
  if (providedCategoryIds.length || !req.params?.id) return providedCategoryIds

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: products } = await query.graph({
    entity: "product",
    fields: ["categories.id"],
    filters: { id: req.params.id },
  })
  return products[0]?.categories?.map(({ id }: { id: string }) => id) ?? []
}

export function restrictSellerProductPublication(
  req: MedusaRequest,
  _res: MedusaResponse,
  next: MedusaNextFunction,
) {
  const body = req.body as ProductPublicationBody | undefined
  if (body?.status === ProductStatus.PUBLISHED) {
    assertActiveSeller(req, "publish products")
    const sellerId = getSellerId(req)
    if (!sellerId) {
      throw new MedusaError(
        MedusaError.Types.UNAUTHORIZED,
        "Seller context is required.",
      )
    }
    return getProductCategoryIds(req)
      .then((categoryIds) =>
        assertCheckoutSellerHasWhatsApp(req.scope, sellerId, categoryIds),
      )
      .then(() => next())
  }
  return next()
}

export async function restrictCartLineItemToActiveSeller(
  req: MedusaRequest,
  _res: MedusaResponse,
  next: MedusaNextFunction,
) {
  const offerId = (req.body as OfferBody | undefined)?.offer_id
  if (typeof offerId !== "string") {
    return next()
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: offers } = await query.graph({
    entity: "offer",
    fields: ["id", "variant_id", "seller.status"],
    filters: { id: offerId },
  })

  if (offers[0]?.seller?.status !== SellerStatus.OPEN) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Offer not found.")
  }
  await assertVariantsNotReserved(
    req.scope,
    offers.map(({ variant_id }) => variant_id),
  )
  return next()
}

export async function restrictCartCompletionToActiveSellers(
  req: MedusaRequest,
  _res: MedusaResponse,
  next: MedusaNextFunction,
) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: carts } = await query.graph({
    entity: "cart",
    fields: ["items.offer.variant_id", "items.offer.seller.status"],
    filters: { id: req.params.id },
  })
  const items = (carts[0]?.items ?? []) as CartOfferItem[]
  const sellers = items.map((item) => item.offer?.seller)

  if (
    sellers?.some(
      (seller) => seller && !canSellerAcceptTransactions(seller.status),
    )
  ) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "The cart contains items from a seller that is not accepting transactions.",
    )
  }
  await assertVariantsNotReserved(
    req.scope,
    items
      .map((item) => item.offer?.variant_id)
      .filter((variantId): variantId is string => !!variantId),
  )
  return next()
}

export async function restrictUnconfirmedSinpeFulfillment(
  req: MedusaRequest,
  _res: MedusaResponse,
  next: MedusaNextFunction,
) {
  const sellerId = getSellerId(req)
  if (!sellerId) {
    throw new MedusaError(
      MedusaError.Types.UNAUTHORIZED,
      "Seller context is required.",
    )
  }
  await validateSellerOrder(req.scope, sellerId, req.params.id)

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "metadata",
      "cart.payment_collection.payment_sessions.provider_id",
    ],
    filters: { id: req.params.id },
  })
  const order = (data as OrderForFulfillment[])[0]
  if (
    order &&
    isExternalSinpePayment(
      order.cart?.payment_collection?.payment_sessions,
    ) &&
    order.metadata?.external_payment_status !== "confirmed"
  ) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Confirm receipt of the external SINPE payment before creating fulfillment.",
    )
  }
  return next()
}

export const requireActiveSellerForOfferOrInventoryWrites = (
  req: MedusaRequest,
  _res: MedusaResponse,
  next: MedusaNextFunction,
) => {
  assertActiveSeller(req, "manage offers or inventory")
  return next()
}

export default defineMiddlewares({
  routes: [
    {
      matcher: "/store/products",
      method: ["GET"],
      middlewares: [restrictStoreProductsToActiveSellers],
    },
    {
      matcher: "/store/products/:id",
      method: ["GET"],
      middlewares: [restrictStoreProductsToActiveSellers],
    },
    {
      matcher: "/store/carts/:id/line-items",
      method: ["POST"],
      middlewares: [restrictCartLineItemToActiveSeller],
    },
    {
      matcher: "/store/carts/:id/complete",
      method: ["POST"],
      middlewares: [restrictCartCompletionToActiveSellers],
    },
    {
      matcher: "/store/leads",
      method: ["GET", "POST"],
      middlewares: [authenticate("customer", ["session", "bearer"])],
    },
    {
      matcher: "/store/reservation-requests",
      method: ["GET", "POST"],
      middlewares: [authenticate("customer", ["session", "bearer"])],
    },
    {
      matcher: "/store/order-groups/:id/external-payments",
      method: ["GET"],
      middlewares: [authenticate("customer", ["session", "bearer"])],
    },
    {
      matcher: "/store/wishlist*",
      method: ["GET", "POST", "DELETE"],
      middlewares: [authenticate("customer", ["session", "bearer"])],
    },
    {
      matcher: "/vendor/products*",
      method: ["POST"],
      middlewares: [restrictSellerProductPublication],
    },
    {
      matcher: "/vendor/offers*",
      method: ["POST"],
      middlewares: [requireActiveSellerForOfferOrInventoryWrites],
    },
    {
      matcher: "/vendor/inventory-items*",
      method: ["POST"],
      middlewares: [requireActiveSellerForOfferOrInventoryWrites],
    },
    {
      matcher: "/vendor/orders/:id/fulfillments",
      method: ["POST"],
      middlewares: [restrictUnconfirmedSinpeFulfillment],
    },
  ],
})
