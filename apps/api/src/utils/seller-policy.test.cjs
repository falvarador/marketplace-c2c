const assert = require("node:assert/strict")
const test = require("node:test")
const { SellerStatus } = require("@mercurjs/types")
const {
  canSellerAcceptTransactions,
  canSellerPublish,
} = require("./seller-policy.ts")
const {
  requireActiveSellerForOfferOrInventoryWrites,
  restrictCartCompletionToActiveSellers,
  restrictCartLineItemToActiveSeller,
  restrictSellerProductPublication,
  restrictUnconfirmedSinpeFulfillment,
} = require("../api/middlewares.ts")
const { parseProductLocationInput } = require("./location.ts")
const { resolveProductMarketplacePolicy } = require("./product-marketplace-policy.ts")
const { isVariantReservable } = require("./reservation-policy.ts")
const { assertCheckoutSellerHasWhatsApp } = require("./seller-checkout-contact.ts")
const { normalizeWhatsAppPhone } = require("./whatsapp.ts")
const { EXTERNAL_SINPE_PROVIDER_ID } = require("./external-sinpe.ts")
const { ExternalSinpePaymentProvider } =
  require("../modules/external-sinpe/index.ts")
const { GET: getCategoryAttributes } = require("../api/store/product-categories/[id]/attributes/route.ts")

const next = () => undefined
const response = {}
const sellerRequest = (status, body = {}) => ({
  body,
  seller_context: { seller_member: { seller: { status } } },
})

test("only open sellers can publish products", () => {
  assert.equal(canSellerPublish(SellerStatus.OPEN), true)
  assert.equal(canSellerPublish(SellerStatus.PENDING_APPROVAL), false)
  assert.equal(canSellerPublish(SellerStatus.SUSPENDED), false)
})

test("only open sellers can accept transactions", () => {
  assert.equal(canSellerAcceptTransactions(SellerStatus.OPEN), true)
  assert.equal(canSellerAcceptTransactions(SellerStatus.PENDING_APPROVAL), false)
  assert.equal(canSellerAcceptTransactions(SellerStatus.SUSPENDED), false)
})

test("reservations require available stock for inventory-managed variants", () => {
  assert.equal(isVariantReservable({ manage_inventory: true }, 1), true)
  assert.equal(isVariantReservable({ manage_inventory: true }, 0), false)
  assert.equal(isVariantReservable({ manage_inventory: true }, undefined), false)
  assert.equal(isVariantReservable({ manage_inventory: false }, undefined), true)
})

test("checkout publication requires a valid seller WhatsApp contact", async () => {
  let mode = "checkout"
  let phone = null
  const container = {
    resolve: () => ({
      graph: async ({ entity }) => entity === "product_category"
        ? { data: [{ category_marketplace_policy: { transaction_mode: mode } }] }
        : { data: [{ phone }] },
    }),
  }

  await assert.rejects(
    assertCheckoutSellerHasWhatsApp(container, "seller_1", ["category_1"]),
    /valid WhatsApp number is required/,
  )

  phone = "+506 8888-8888"
  await assert.doesNotReject(
    assertCheckoutSellerHasWhatsApp(container, "seller_1", ["category_1"]),
  )
  mode = "lead"
  phone = null
  await assert.doesNotReject(
    assertCheckoutSellerHasWhatsApp(container, "seller_1", ["category_1"]),
  )
  assert.equal(normalizeWhatsAppPhone("506 8888-8888"), "+50688888888")
  assert.equal(normalizeWhatsAppPhone("invalid"), null)
})

test("external SINPE provider stays pending and cannot capture or refund", async () => {
  const provider = new ExternalSinpePaymentProvider({}, {})
  const authorization = await provider.authorizePayment({ data: {} })
  assert.equal(authorization.status, "pending_authorization")
  assert.deepEqual(authorization.data, {})
  await assert.rejects(
    provider.capturePayment({ data: {} }),
    /cannot be captured/,
  )
  await assert.rejects(
    provider.refundPayment({ data: {} }),
    /handled directly by the seller/,
  )
})

test("product locations use ISO country codes and optional text fields", () => {
  assert.deepEqual(parseProductLocationInput({
    country_code: "cr",
    region: "San José",
    locality: "Escazú",
  }), {
    country_code: "CR",
    region: "San José",
    locality: "Escazú",
  })

  test("category facets include global and matching filterable attributes only", async () => {
    const calls = []
    const req = {
      params: { id: "cat_tools" },
      scope: {
        resolve: () => ({
          graph: async (query) => {
            calls.push(query)
            return query.entity === "product_category"
              ? { data: [{ id: "cat_tools" }] }
              : {
                  data: [
                    { id: "attr_global", is_filterable: true, categories: [] },
                    {
                      id: "attr_tools",
                      is_filterable: true,
                      categories: [{ id: "cat_tools" }],
                    },
                    {
                      id: "attr_other",
                      is_filterable: true,
                      categories: [{ id: "cat_books" }],
                    },
                    { id: "attr_not_filterable", is_filterable: false, categories: [] },
                  ],
                }
          },
        }),
      },
    }
    let responseBody
    const res = { json: (body) => (responseBody = body) }

    await getCategoryAttributes(req, res)

    assert.deepEqual(
      responseBody.product_attributes.map(({ id }) => id),
      ["attr_global", "attr_tools"],
    )
    assert.equal(responseBody.count, 2)
    assert.equal(calls.length, 2)
  })

  test("lead transaction mode wins across category overrides", async () => {
    const query = {
      graph: async ({ entity }) => {
        if (entity === "product") {
          return {
            data: [
              {
                id: "product_1",
                status: "published",
                categories: [{ id: "cat_checkout" }, { id: "cat_lead" }],
              },
            ],
          }
        }
        if (entity === "offer") {
          return {
            data: [
              {
                seller_id: "seller_1",
                seller: { status: SellerStatus.OPEN },
              },
            ],
          }
        }
        return {
          data: [
            { category_marketplace_policy: { transaction_mode: "checkout" } },
            { category_marketplace_policy: { transaction_mode: "lead" } },
          ],
        }
      },
    }
    const policy = await resolveProductMarketplacePolicy(
      { resolve: () => query },
      "product_1",
    )

    assert.equal(policy.transaction_mode, "lead")
    assert.equal(policy.seller_id, "seller_1")
  })
  assert.throws(
    () => parseProductLocationInput({ country_code: "CRI" }),
    /two-letter ISO 3166-1 alpha-2/,
  )
})

test("seller product publication is blocked until approval and while suspended", async () => {
  for (const status of [
    SellerStatus.PENDING_APPROVAL,
    SellerStatus.SUSPENDED,
  ]) {
    assert.throws(
      () =>
        restrictSellerProductPublication(
          sellerRequest(status, { status: "published" }),
          response,
          next,
        ),
      /Only active sellers can publish products/,
    )
  }

  const activeRequest = sellerRequest(SellerStatus.OPEN, { status: "published" })
  activeRequest.seller_context.seller_member.seller.id = "seller_1"
  activeRequest.scope = {
    resolve: () => ({
      graph: async () => ({ data: [{ phone: "+50688888888" }] }),
    }),
  }
  await assert.doesNotReject(() =>
    restrictSellerProductPublication(activeRequest, response, next),
  )
})

test("seller offer and inventory writes require an active seller", () => {
  for (const status of [
    SellerStatus.PENDING_APPROVAL,
    SellerStatus.SUSPENDED,
  ]) {
    assert.throws(
      () =>
        requireActiveSellerForOfferOrInventoryWrites(
          sellerRequest(status),
          response,
          next,
        ),
      /Only active sellers can manage offers or inventory/,
    )
  }
  assert.doesNotThrow(() =>
    requireActiveSellerForOfferOrInventoryWrites(
      sellerRequest(SellerStatus.OPEN),
      response,
      next,
    ),
  )
})

test("cart line items reject offers from non-active sellers", async () => {
  for (const status of [
    SellerStatus.PENDING_APPROVAL,
    SellerStatus.SUSPENDED,
  ]) {
    const req = {
      body: { offer_id: "offer_1" },
      scope: {
        resolve: () => ({
          graph: async (query) =>
            query.entity === "offer"
              ? { data: [{ seller: { status }, variant_id: "variant_1" }] }
              : { data: [] },
        }),
      },
    }

    await assert.rejects(
      () => restrictCartLineItemToActiveSeller(req, response, next),
      /Offer not found/,
    )
  }

  const req = {
    body: { offer_id: "offer_1" },
    scope: {
      resolve: () => ({
        graph: async (query) =>
          query.entity === "offer"
            ? {
                data: [
                  {
                    seller: { status: SellerStatus.OPEN },
                    variant_id: "variant_1",
                  },
                ],
              }
            : { data: [] },
      }),
    },
  }
  await assert.doesNotReject(() =>
    restrictCartLineItemToActiveSeller(req, response, next),
  )

  const reservedReq = {
    body: { offer_id: "offer_1" },
    scope: {
      resolve: () => ({
        graph: async (query) =>
          query.entity === "offer"
            ? {
                data: [
                  {
                    seller: { status: SellerStatus.OPEN },
                    variant_id: "variant_1",
                  },
                ],
              }
            : { data: [{ id: "request_1" }] },
      }),
    },
  }
  await assert.rejects(
    () => restrictCartLineItemToActiveSeller(reservedReq, response, next),
    /active reservation request/,
  )
})

test("cart completion rejects a seller that is no longer active", async () => {
  for (const status of [
    SellerStatus.PENDING_APPROVAL,
    SellerStatus.SUSPENDED,
  ]) {
    const req = {
      params: { id: "cart_1" },
      scope: {
        resolve: () => ({
          graph: async (query) =>
            query.entity === "cart"
              ? {
                  data: [
                    {
                      items: [
                        {
                          offer: {
                            seller: { status },
                            variant_id: "variant_1",
                          },
                        },
                      ],
                    },
                  ],
                }
              : { data: [] },
        }),
      },
    }

    await assert.rejects(
      () => restrictCartCompletionToActiveSellers(req, response, next),
      /seller that is not accepting transactions/,
    )
  }

  const req = {
    params: { id: "cart_1" },
    scope: {
      resolve: () => ({
        graph: async (query) =>
          query.entity === "cart"
            ? {
                data: [
                  {
                    items: [
                      {
                        offer: {
                          seller: { status: SellerStatus.OPEN },
                          variant_id: "variant_1",
                        },
                      },
                    ],
                  },
                ],
              }
            : { data: [] },
      }),
    },
  }
  await assert.doesNotReject(() =>
    restrictCartCompletionToActiveSellers(req, response, next),
  )

  const reservedReq = {
    params: { id: "cart_1" },
    scope: {
      resolve: () => ({
        graph: async (query) =>
          query.entity === "cart"
            ? {
                data: [
                  {
                    items: [
                      {
                        offer: {
                          seller: { status: SellerStatus.OPEN },
                          variant_id: "variant_1",
                        },
                      },
                    ],
                  },
                ],
              }
            : { data: [{ id: "request_1" }] },
      }),
    },
  }
  await assert.rejects(
    () => restrictCartCompletionToActiveSellers(reservedReq, response, next),
    /active reservation request/,
  )
})

test("external SINPE fulfillment is blocked until seller confirmation", async () => {
  let orderMetadata = {}
  const queries = []
  const req = {
    params: { id: "order_1" },
    seller_context: { seller_member: { seller: { id: "seller_1" } } },
    scope: {
      resolve: () => ({
        graph: async (query) => {
          queries.push(query)
          if (query.entity === "order_seller") {
            return { data: [{ seller_id: "seller_1", order_id: "order_1" }] }
          }
          return {
            data: [{
              id: "order_1",
              metadata: orderMetadata,
              cart: {
                payment_collection: {
                  payment_sessions: [{
                    provider_id: EXTERNAL_SINPE_PROVIDER_ID,
                  }],
                },
              },
            }],
          }
        },
      }),
    },
  }
  await assert.rejects(
    restrictUnconfirmedSinpeFulfillment(req, response, next),
    /Confirm receipt of the external SINPE payment/,
  )
  assert.equal(queries[0].filters.seller_id, "seller_1")
  assert.deepEqual(queries[0].filters.order_id, ["order_1"])

  orderMetadata = { external_payment_status: "confirmed" }
  await assert.doesNotReject(
    restrictUnconfirmedSinpeFulfillment(req, response, next),
  )
})
