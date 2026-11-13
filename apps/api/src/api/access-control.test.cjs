const assert = require("node:assert/strict")
const test = require("node:test")
const { GET: getWishlist } = require("./store/wishlist/route.ts")
const { GET: getBuyerLeads } = require("./store/leads/route.ts")
const { GET: getBuyerReservations } = require("./store/reservation-requests/route.ts")
const { GET: getSellerLeads } = require("./vendor/leads/route.ts")
const { GET: getSellerReservations } = require("./vendor/reservation-requests/route.ts")
const { GET: getBuyerExternalPayments } =
  require("./store/order-groups/[id]/external-payments/route.ts")
const { POST: confirmSellerExternalPayment } =
  require("./vendor/orders/[id]/external-payment-confirmation/route.ts")
const { EXTERNAL_SINPE_PROVIDER_ID } = require("../utils/external-sinpe.ts")

function makeRequest(actor, service) {
  return {
    auth_context: actor.customer_id ? { actor_id: actor.customer_id } : undefined,
    seller_context: actor.seller_id
      ? { seller_member: { seller: { id: actor.seller_id } } }
      : undefined,
    scope: { resolve: () => service },
  }
}

function makeResponse() {
  return {
    body: undefined,
    json(body) {
      this.body = body
    },
  }
}

test("buyer wishlist reads are scoped to the authenticated customer", async () => {
  let filters
  const service = {
    listWishlistItems: async (value) => {
      filters = value
      return [{
        id: "wish_1",
        customer_id: value.customer_id,
        product_id: "prod_1",
        claim_key: `${value.customer_id}:prod_1`,
      }]
    },
  }
  const res = makeResponse()

  await getWishlist(makeRequest({ customer_id: "cus_1" }, service), res)

  assert.deepEqual(filters, { customer_id: "cus_1" })
  assert.deepEqual(res.body.wishlist_items, [
    { id: "wish_1", product_id: "prod_1", created_at: undefined },
  ])
})

test("buyer leads and reservations are scoped to the authenticated customer", async () => {
  const calls = []
  const service = {
    listLeads: async (filters) => {
      calls.push(filters)
      return [{ id: "lead_1" }]
    },
    listReservationRequests: async (filters) => {
      calls.push(filters)
      return [{ id: "resreq_1" }]
    },
  }

  await getBuyerLeads(
    makeRequest({ customer_id: "cus_1" }, service),
    makeResponse(),
  )
  await getBuyerReservations(
    makeRequest({ customer_id: "cus_1" }, service),
    makeResponse(),
  )

  assert.deepEqual(calls, [
    { customer_id: "cus_1" },
    { customer_id: "cus_1" },
  ])
})

test("seller leads and reservations are scoped to the selected seller", async () => {
  const calls = []
  const service = {
    listLeads: async (filters) => {
      calls.push(filters)
      return [{ id: "lead_1" }]
    },
    listReservationRequests: async (filters) => {
      calls.push(filters)
      return [{ id: "resreq_1" }]
    },
  }

  await getSellerLeads(
    makeRequest({ seller_id: "seller_1" }, service),
    makeResponse(),
  )
  await getSellerReservations(
    makeRequest({ seller_id: "seller_1" }, service),
    makeResponse(),
  )

  assert.deepEqual(calls, [
    { seller_id: "seller_1" },
    { seller_id: "seller_1" },
  ])
})

test("buyer and seller private reads reject requests without their actor context", async () => {
  const service = {
    listWishlistItems: async () => [],
    listLeads: async () => [],
    listReservationRequests: async () => [],
  }
  const emptyRequest = makeRequest({}, service)

  for (const handler of [
    getWishlist,
    getBuyerLeads,
    getBuyerReservations,
    getSellerLeads,
    getSellerReservations,
  ]) {
    await assert.rejects(() => handler(emptyRequest, makeResponse()), {
      type: "unauthorized",
    })
  }
})

test("buyer external payment details are scoped to their own order group", async () => {
  let graphQuery
  const req = makeRequest(
    { customer_id: "cus_1" },
    {
      graph: async (input) => {
        graphQuery = input
        return {
          data: [{
            id: "group_1",
            customer_id: "cus_1",
            orders: [{
              id: "order_1",
              display_id: 17,
              total: 2500,
              currency_code: "crc",
              seller: { name: "Tienda", phone: "+506 8888-8888" },
              cart: {
                payment_collection: {
                  payment_sessions: [{
                    provider_id: EXTERNAL_SINPE_PROVIDER_ID,
                  }],
                },
              },
            }],
          }],
        }
      },
    },
  )
  req.params = { id: "group_1" }
  const res = makeResponse()

  await getBuyerExternalPayments(req, res)

  assert.deepEqual(graphQuery.filters, {
    id: "group_1",
    customer_id: "cus_1",
  })
  assert.deepEqual(res.body.seller_orders, [{
    id: "order_1",
    display_id: 17,
    total: 2500,
    currency_code: "crc",
    seller_name: "Tienda",
    whatsapp_number: "50688888888",
    payment_status: "pending",
  }])
})

test("seller cannot confirm an external payment for another seller's order", async () => {
  let ownershipFilters
  const req = makeRequest(
    { seller_id: "seller_2" },
    {
      graph: async ({ entity, filters }) => {
        if (entity === "order_seller") ownershipFilters = filters
        return { data: [] }
      },
    },
  )
  req.params = { id: "order_1" }

  await assert.rejects(
    confirmSellerExternalPayment(req, makeResponse()),
    { type: "not_found" },
  )
  assert.deepEqual(ownershipFilters, {
    seller_id: "seller_2",
    order_id: ["order_1"],
  })
})

test("seller cannot confirm an external payment that is already confirmed", async () => {
  const graphEntities = []
  const req = makeRequest(
    { seller_id: "seller_1" },
    {
      graph: async ({ entity }) => {
        graphEntities.push(entity)
        if (entity === "order_seller") {
          return { data: [{ order_id: "order_1" }] }
        }
        return {
          data: [{
            id: "order_1",
            metadata: { external_payment_status: "confirmed" },
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
    },
  )
  req.params = { id: "order_1" }

  await assert.rejects(
    confirmSellerExternalPayment(req, makeResponse()),
    { type: "not_allowed" },
  )
  assert.deepEqual(graphEntities, ["order_seller", "order"])
})
