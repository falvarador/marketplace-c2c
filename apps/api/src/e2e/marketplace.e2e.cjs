"use strict"

const assert = require("node:assert/strict")
const { spawn, execFileSync } = require("node:child_process")
const { createServer } = require("node:net")
const { randomUUID } = require("node:crypto")
const path = require("node:path")
const { Client } = require("pg")

const root = path.resolve(__dirname, "../../../..")
const apiDir = path.join(root, "apps/api")
const medusaBin = path.join(root, "node_modules/.bin/medusa")
const externalPaymentProvider = "pp_external_sinpe_external_sinpe"
const password = "E2E-only-Password-451!"

class HttpError extends Error {
  constructor(method, route, status, message) {
    super(`${method} ${route} returned ${status}: ${message}`)
    this.status = status
  }
}

function isLocalHost(hostname) {
  return ["localhost", "127.0.0.1", "::1"].includes(hostname)
}

function buildEnvironment(databaseUrl, port) {
  const regionName = process.env.E2E_REGION_NAME ?? "Costa Rica E2E"
  return {
    ...process.env,
    NODE_ENV: "development",
    DATABASE_URL: databaseUrl,
    REDIS_URL: process.env.E2E_REDIS_URL ?? "redis://localhost:6379",
    STORE_CORS: "http://localhost:5173",
    ADMIN_CORS: "http://localhost:9000",
    VENDOR_CORS: "http://localhost:5173",
    AUTH_CORS: "http://localhost:5173",
    JWT_SECRET: randomUUID(),
    COOKIE_SECRET: randomUUID(),
    PORT: String(port),
    MARKETPLACE_REGION_NAME: regionName,
    MARKETPLACE_CURRENCY_CODE: process.env.E2E_CURRENCY_CODE ?? "crc",
    MARKETPLACE_COUNTRIES: process.env.E2E_COUNTRIES ?? "cr",
    MARKETPLACE_PAYMENT_PROVIDER_IDS: externalPaymentProvider,
    MARKETPLACE_DEFAULT_TRANSACTION_MODE: "checkout",
  }
}

async function getAvailablePort() {
  const server = createServer()
  await new Promise((resolve, reject) => {
    server.once("error", reject)
    server.listen(0, "127.0.0.1", resolve)
  })
  const { port } = server.address()
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()))
  })
  return port
}

function runMedusa(args, env) {
  execFileSync(medusaBin, args, {
    cwd: apiDir,
    env,
    stdio: "inherit",
  })
}

async function waitForApi(child, baseUrl, logs) {
  const deadline = Date.now() + 90_000
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Mercur API exited before becoming healthy.\n${logs.join("")}`)
    }
    try {
      const response = await fetch(`${baseUrl}/health`)
      if (response.ok && (await response.text()) === "OK") return
    } catch {
      // The API is expected to refuse connections while it is starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error(`Mercur API did not become healthy within 90 seconds.\n${logs.join("")}`)
}

async function request(baseUrl, method, route, options = {}) {
  const headers = {}
  if (options.body !== undefined) headers["content-type"] = "application/json"
  if (options.token) headers.authorization = `Bearer ${options.token}`
  if (options.publishableKey) headers["x-publishable-api-key"] = options.publishableKey
  if (options.sellerId) headers["x-seller-id"] = options.sellerId

  const response = await fetch(new URL(route, baseUrl), {
    method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  })
  const text = await response.text()
  let data
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }
  if (!response.ok) {
    const message =
      typeof data === "object" && data !== null
        ? data.message ?? data.error?.message ?? JSON.stringify(data)
        : String(data)
    throw new HttpError(method, route, response.status, message.slice(0, 400))
  }
  return data
}

async function expectHttpFailure(action, statuses, description) {
  try {
    await action()
  } catch (error) {
    assert.ok(error instanceof HttpError, `${description}: ${error}`)
    assert.ok(
      statuses.includes(error.status),
      `${description}: expected HTTP ${statuses.join("/")}, got ${error.message}`,
    )
    return
  }
  assert.fail(`${description}: the request unexpectedly succeeded`)
}

function decodeTokenClaims(token) {
  return JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString())
}

async function provisionSeller(baseUrl, publishableKey, adminToken, region, channel, profile, label) {
  const suffix = randomUUID().replaceAll("-", "")
  const email = `e2e-${label}-${suffix}@example.test`
  const registration = await request(baseUrl, "POST", "/auth/member/emailpass/register", {
    body: { email, password },
  })
  const { seller } = await request(baseUrl, "POST", "/vendor/sellers", {
    token: registration.token,
    publishableKey,
    body: {
      name: `E2E ${label} ${suffix}`,
      handle: `e2e-${label}-${suffix}`,
      email,
      member_email: email,
      currency_code: region.currency_code,
      phone: "+50688880001",
    },
  })

  await request(baseUrl, "POST", `/admin/sellers/${seller.id}/approve`, {
    token: adminToken,
    body: {},
  })
  await request(baseUrl, "POST", `/admin/sellers/${seller.id}/regions`, {
    token: adminToken,
    body: { add: [region.id] },
  })
  const memberToken = (
    await request(baseUrl, "POST", "/auth/member/emailpass", {
      body: { email, password },
    })
  ).token
  const scope = { token: memberToken, publishableKey, sellerId: seller.id }

  const { stock_location: stockLocation } = await request(
    baseUrl,
    "POST",
    "/vendor/stock-locations",
    {
      ...scope,
      body: {
        name: `E2E Stock ${suffix}`,
        address: {
          address_1: "1 Test Street",
          city: "San Jose",
          country_code: "cr",
        },
      },
    },
  )
  await request(
    baseUrl,
    "POST",
    `/vendor/stock-locations/${stockLocation.id}/sales-channels`,
    { ...scope, body: { add: [channel.id] } },
  )
  await request(
    baseUrl,
    "POST",
    `/vendor/stock-locations/${stockLocation.id}/fulfillment-providers`,
    { ...scope, body: { add: ["manual_manual"] } },
  )
  await request(
    baseUrl,
    "POST",
    `/vendor/stock-locations/${stockLocation.id}/fulfillment-sets`,
    { ...scope, body: { name: `E2E Shipping ${suffix}`, type: "shipping" } },
  )
  const location = (
    await request(
      baseUrl,
      "GET",
      `/vendor/stock-locations/${stockLocation.id}?fields=fulfillment_sets.id`,
      scope,
    )
  ).stock_location
  const fulfillmentSetId = location.fulfillment_sets?.[0]?.id
  assert.ok(fulfillmentSetId, `${label} seller needs a fulfillment set`)

  await request(
    baseUrl,
    "POST",
    `/vendor/fulfillment-sets/${fulfillmentSetId}/service-zones`,
    {
      ...scope,
      body: {
        name: `E2E Costa Rica ${suffix}`,
        geo_zones: [{ type: "country", country_code: "cr" }],
      },
    },
  )
  const expandedLocation = (
    await request(
      baseUrl,
      "GET",
      `/vendor/stock-locations/${stockLocation.id}?fields=fulfillment_sets.service_zones.id`,
      scope,
    )
  ).stock_location
  const serviceZoneId =
    expandedLocation.fulfillment_sets?.[0]?.service_zones?.[0]?.id
  assert.ok(serviceZoneId, `${label} seller needs a shipping service zone`)

  const { shipping_option: shippingOption } = await request(
    baseUrl,
    "POST",
    "/vendor/shipping-options",
    {
      ...scope,
      body: {
        name: `E2E Delivery ${suffix}`,
        service_zone_id: serviceZoneId,
        shipping_profile_id: profile.id,
        price_type: "flat",
        provider_id: "manual_manual",
        type: { label: "Delivery", code: `delivery-${suffix}` },
        prices: [{ currency_code: region.currency_code, amount: 0 }],
      },
    },
  )

  return {
    id: seller.id,
    name: seller.name,
    email,
    memberToken,
    scope,
    stockLocationId: stockLocation.id,
    shippingOptionId: shippingOption.id,
  }
}

async function createProduct(baseUrl, publishableKey, seller, category, label, options = {}) {
  const suffix = randomUUID().replaceAll("-", "")
  const { product } = await request(
    baseUrl,
    "POST",
    "/vendor/products?fields=id,title,status,variants.id,variants.title",
    {
      ...seller.scope,
      body: {
        title: `E2E ${label} ${suffix}`,
        description: "Disposable HTTP acceptance fixture",
        categories: [{ id: category.id }],
        variants: [{ title: "Único", options: {} }],
      },
    },
  )
  const variant = product.variants?.[0]
  assert.ok(variant?.id, `${label} product needs a variant`)

  if (options.attribute) {
    await request(
      baseUrl,
      "POST",
      `/vendor/products/${product.id}/attributes/batch`,
      {
        ...seller.scope,
        body: { add: [{ id: options.attribute.id, value: "new" }] },
      },
    )
  }

  const { offer } = await request(baseUrl, "POST", "/vendor/offers", {
    ...seller.scope,
    body: {
      sku: `e2e-${label}-${suffix}`,
      variant_id: variant.id,
      shipping_profile_id: options.shippingProfileId,
      manage_inventory: true,
      inventory_items: [
        {
          sku: `e2e-inventory-${suffix}`,
          stock_levels: [
            { location_id: seller.stockLocationId, stocked_quantity: 1 },
          ],
        },
      ],
      prices: [{ currency_code: options.currencyCode, amount: 2500 }],
    },
  })
  await request(
    baseUrl,
    "POST",
    `/vendor/products/${product.id}/publication`,
    { ...seller.scope, body: { status: "published" } },
  )
  return { ...product, variant, offer }
}

async function createBuyer(baseUrl, publishableKey, label) {
  const email = `e2e-buyer-${label}-${randomUUID()}@example.test`
  await request(baseUrl, "POST", "/auth/customer/emailpass/register", {
    body: { email, password },
  })
  const registrationToken = (
    await request(baseUrl, "POST", "/auth/customer/emailpass", {
      body: { email, password },
    })
  ).token
  await request(baseUrl, "POST", "/store/customers", {
    token: registrationToken,
    publishableKey,
    body: { email, first_name: "E2E", last_name: label },
  })
  const token = (
    await request(baseUrl, "POST", "/auth/customer/emailpass", {
      body: { email, password },
    })
  ).token
  return { email, token }
}

async function createReservation(baseUrl, buyer, product, publishableKey, message) {
  const { reservation_request: reservation } = await request(
    baseUrl,
    "POST",
    "/store/reservation-requests",
    {
      token: buyer.token,
      publishableKey,
      body: {
        product_id: product.id,
        variant_id: product.variant.id,
        message,
      },
    },
  )
  return reservation
}

async function main() {
  const configuredDatabaseUrl =
    process.env.E2E_DATABASE_ADMIN_URL ??
    process.env.DATABASE_URL ??
    "postgres://postgres:postgres@localhost:5432/postgres"
  const adminDatabaseUrl = new URL(configuredDatabaseUrl)
  if (!isLocalHost(adminDatabaseUrl.hostname)) {
    throw new Error("E2E_DATABASE_ADMIN_URL must point to a local PostgreSQL server.")
  }
  adminDatabaseUrl.pathname = "/postgres"

  const redisUrl = new URL(process.env.E2E_REDIS_URL ?? "redis://localhost:6379")
  if (!isLocalHost(redisUrl.hostname)) {
    throw new Error("E2E_REDIS_URL must point to a local Redis server.")
  }

  const databaseName = `marketplace_e2e_${process.pid}_${Date.now()}`
  assert.match(databaseName, /^marketplace_e2e_[0-9]+_[0-9]+$/)
  const databaseUrl = new URL(adminDatabaseUrl)
  databaseUrl.pathname = `/${databaseName}`
  const port = await getAvailablePort()
  const baseUrl = `http://127.0.0.1:${port}`
  const env = buildEnvironment(databaseUrl.toString(), port)
  const adminClient = new Client({
    connectionString: adminDatabaseUrl.toString(),
  })
  let databaseCreated = false
  let apiProcess
  const logs = []
  let taskError
  let cleanupError

  try {
    await adminClient.connect()
    await adminClient.query(`CREATE DATABASE "${databaseName}"`)
    databaseCreated = true

    runMedusa(["build"], env)
    runMedusa(["db:migrate"], env)
    runMedusa(["exec", "./src/scripts/configure-region.ts"], env)

    apiProcess = spawn(medusaBin, ["start"], {
      cwd: apiDir,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    })
    for (const stream of [apiProcess.stdout, apiProcess.stderr]) {
      stream.setEncoding("utf8")
      stream.on("data", (chunk) => {
        logs.push(chunk)
        if (logs.length > 40) logs.shift()
      })
    }
    await waitForApi(apiProcess, baseUrl, logs)

    const testDatabase = new Client({ connectionString: databaseUrl.toString() })
    await testDatabase.connect()
    const { rows } = await testDatabase.query(
      "SELECT token FROM api_key WHERE type = 'publishable' ORDER BY created_at LIMIT 1",
    )
    await testDatabase.end()
    const publishableKey = rows[0]?.token
    assert.ok(publishableKey, "The isolated database needs a publishable API key")

    const adminEmail = `e2e-operator-${randomUUID()}@example.test`
    const registration = await request(
      baseUrl,
      "POST",
      "/auth/user/emailpass/register",
      { body: { email: adminEmail, password } },
    )
    const claims = decodeTokenClaims(registration.token)
    runMedusa(["exec", "./src/scripts/e2e-bootstrap-admin.ts"], {
      ...env,
      E2E_AUTH_IDENTITY_ID: claims.auth_identity_id,
      E2E_USER_EMAIL: adminEmail,
    })
    const adminToken = (
      await request(baseUrl, "POST", "/auth/user/emailpass", {
        body: { email: adminEmail, password },
      })
    ).token

    const regionResult = await request(
      baseUrl,
      "GET",
      "/admin/regions?limit=100",
      { token: adminToken },
    )
    const region = regionResult.regions?.find(
      ({ name }) => name === env.MARKETPLACE_REGION_NAME,
    )
    assert.ok(region, "The configured E2E region should be seeded")

    const [channelResult, profileResult, commissionResult] = await Promise.all([
      request(baseUrl, "GET", "/admin/sales-channels?limit=100", {
        token: adminToken,
      }),
      request(baseUrl, "GET", "/admin/shipping-profiles?limit=100", {
        token: adminToken,
      }),
      request(baseUrl, "GET", "/admin/commission-rates?limit=100", {
        token: adminToken,
      }),
    ])
    const channel = channelResult.sales_channels?.[0]
    const profile = profileResult.shipping_profiles?.[0]
    assert.ok(channel, "The isolated database needs a default sales channel")
    assert.ok(profile, "The isolated database needs a default shipping profile")

    const defaultCommission = commissionResult.commission_rates?.find(
      ({ is_default }) => is_default,
    )
    assert.ok(defaultCommission, "The isolated database needs its default commission rate")
    await request(
      baseUrl,
      "POST",
      `/admin/commission-rates/${defaultCommission.id}`,
      { token: adminToken, body: { value: 10 } },
    )

    const checkoutCategory = (
      await request(baseUrl, "POST", "/admin/product-categories", {
        token: adminToken,
        body: { name: `E2E Checkout ${randomUUID()}`, is_active: true },
      })
    ).product_category
    const leadCategory = (
      await request(baseUrl, "POST", "/admin/product-categories", {
        token: adminToken,
        body: { name: `E2E Lead ${randomUUID()}`, is_active: true },
      })
    ).product_category
    await request(
      baseUrl,
      "POST",
      `/admin/product-categories/${leadCategory.id}/marketplace-policy`,
      { token: adminToken, body: { transaction_mode: "lead" } },
    )

    const attribute = (
      await request(baseUrl, "POST", "/admin/product-attributes", {
        token: adminToken,
        body: {
          name: `E2E Condition ${randomUUID()}`,
          handle: `e2e-condition-${randomUUID()}`,
          type: "text",
          is_filterable: true,
          category_ids: [checkoutCategory.id],
        },
      })
    ).product_attribute
    const [sellerA, sellerB] = await Promise.all([
      provisionSeller(
        baseUrl,
        publishableKey,
        adminToken,
        region,
        channel,
        profile,
        "seller-a",
      ),
      provisionSeller(
        baseUrl,
        publishableKey,
        adminToken,
        region,
        channel,
        profile,
        "seller-b",
      ),
    ])

    const [checkoutA, checkoutB, leadA, leadB] = await Promise.all([
      createProduct(baseUrl, publishableKey, sellerA, checkoutCategory, "checkout-a", {
        attribute,
        shippingProfileId: profile.id,
        currencyCode: region.currency_code,
      }),
      createProduct(baseUrl, publishableKey, sellerB, checkoutCategory, "checkout-b", {
        attribute,
        shippingProfileId: profile.id,
        currencyCode: region.currency_code,
      }),
      createProduct(baseUrl, publishableKey, sellerA, leadCategory, "lead-a", {
        shippingProfileId: profile.id,
        currencyCode: region.currency_code,
      }),
      createProduct(baseUrl, publishableKey, sellerB, leadCategory, "lead-b", {
        shippingProfileId: profile.id,
        currencyCode: region.currency_code,
      }),
    ])

    const [attributeDefinitions, publicProduct] = await Promise.all([
      request(
        baseUrl,
        "GET",
        `/store/product-categories/${checkoutCategory.id}/attributes`,
        { publishableKey },
      ),
      request(
        baseUrl,
        "GET",
        `/store/products/${checkoutA.id}?fields=id,title,status,product_attribute_values.*,product_attribute_values.attribute.*`,
        { publishableKey },
      ),
    ])
    assert.ok(
      attributeDefinitions.product_attributes?.some(({ id }) => id === attribute.id),
      "The Store API should expose the category's dynamic attribute definition",
    )
    const dynamicValue = (
      publicProduct.product?.product_attribute_values ?? []
    ).find(({ attribute: linkedAttribute, attribute_id }) =>
      (linkedAttribute?.id ?? attribute_id) === attribute.id,
    )
    assert.ok(dynamicValue, "The published product should expose its dynamic attribute")
    assert.equal(dynamicValue.name, "new", "The product should preserve its typed attribute value")

    const [buyerA, buyerB] = await Promise.all([
      createBuyer(baseUrl, publishableKey, "a"),
      createBuyer(baseUrl, publishableKey, "b"),
    ])
    await request(baseUrl, "POST", "/store/wishlist", {
      token: buyerA.token,
      publishableKey,
      body: { product_id: checkoutA.id },
    })
    await request(baseUrl, "POST", "/store/wishlist", {
      token: buyerA.token,
      publishableKey,
      body: { product_id: checkoutA.id },
    })
    const wishlist = await request(baseUrl, "GET", "/store/wishlist", {
      token: buyerA.token,
      publishableKey,
    })
    assert.equal(
      wishlist.wishlist_items?.filter(({ product_id }) => product_id === checkoutA.id).length,
      1,
      "Wishlist insertion should be idempotent for a buyer/product pair",
    )

    const { lead } = await request(baseUrl, "POST", "/store/leads", {
      token: buyerA.token,
      publishableKey,
      body: { product_id: leadA.id, message: "I would like to know if this is available." },
    })
    const buyerLeads = await request(baseUrl, "GET", "/store/leads", {
      token: buyerA.token,
      publishableKey,
    })
    assert.ok(buyerLeads.leads?.some(({ id }) => id === lead.id))
    const sellerALeads = await request(baseUrl, "GET", "/vendor/leads", sellerA.scope)
    const sellerBLeads = await request(baseUrl, "GET", "/vendor/leads", sellerB.scope)
    assert.ok(sellerALeads.leads?.some(({ id }) => id === lead.id))
    assert.ok(!sellerBLeads.leads?.some(({ id }) => id === lead.id))

    const reservationA = await createReservation(
      baseUrl,
      buyerA,
      leadA,
      publishableKey,
      "Please hold this unique item.",
    )
    const sellerAReservations = await request(
      baseUrl,
      "GET",
      "/vendor/reservation-requests",
      sellerA.scope,
    )
    assert.ok(
      sellerAReservations.reservation_requests?.some(({ id }) => id === reservationA.id),
    )
    await request(
      baseUrl,
      "POST",
      `/vendor/reservation-requests/${reservationA.id}/decision`,
      { ...sellerA.scope, body: { status: "confirmed" } },
    )
    await expectHttpFailure(
      () =>
        createReservation(
          baseUrl,
          buyerB,
          leadA,
          publishableKey,
          "Competing reservation.",
        ),
      [400, 403, 404, 409],
      "A confirmed unique reservation must block a second buyer",
    )
    const reservedCart = (
      await request(baseUrl, "POST", "/store/carts", {
        token: buyerB.token,
        publishableKey,
        body: { region_id: region.id },
      })
    ).cart
    await expectHttpFailure(
      () =>
        request(
          baseUrl,
          "POST",
          `/store/carts/${reservedCart.id}/line-items`,
          {
            token: buyerB.token,
            publishableKey,
            body: { offer_id: leadA.offer.id, quantity: 1 },
          },
        ),
      [400, 403, 404, 409],
      "Checkout must not consume an actively reserved unique item",
    )

    const reservationB = await createReservation(
      baseUrl,
      buyerA,
      leadB,
      publishableKey,
      "Please hold this second unique item.",
    )
    await expectHttpFailure(
      () =>
        request(
          baseUrl,
          "POST",
          `/vendor/reservation-requests/${reservationB.id}/decision`,
          { ...sellerA.scope, body: { status: "confirmed" } },
        ),
      [400, 403, 404],
      "A seller must not decide another seller's reservation",
    )
    const sellerBReservations = await request(
      baseUrl,
      "GET",
      "/vendor/reservation-requests",
      sellerB.scope,
    )
    assert.ok(
      sellerBReservations.reservation_requests?.some(({ id }) => id === reservationB.id),
    )
    assert.ok(
      !sellerAReservations.reservation_requests?.some(({ id }) => id === reservationB.id),
      "Reservation lists must be seller-scoped",
    )
    await request(
      baseUrl,
      "POST",
      `/vendor/reservation-requests/${reservationB.id}/decision`,
      { ...sellerB.scope, body: { status: "declined" } },
    )
    const reservationBRetry = await createReservation(
      baseUrl,
      buyerB,
      leadB,
      publishableKey,
      "Retry after seller decline.",
    )
    await request(
      baseUrl,
      "POST",
      `/vendor/reservation-requests/${reservationBRetry.id}/decision`,
      { ...sellerB.scope, body: { status: "confirmed" } },
    )

    const cart = (
      await request(baseUrl, "POST", "/store/carts", {
        token: buyerA.token,
        publishableKey,
        body: { region_id: region.id, email: buyerA.email },
      })
    ).cart
    await request(
      baseUrl,
      "POST",
      `/store/carts/${cart.id}/customer`,
      { token: buyerA.token, publishableKey, body: {} },
    )
    await request(
      baseUrl,
      "POST",
      `/store/carts/${cart.id}`,
      {
        token: buyerA.token,
        publishableKey,
        body: {
          email: buyerA.email,
          shipping_address: {
            first_name: "E2E",
            last_name: "Buyer",
            address_1: "2 Test Street",
            city: "San Jose",
            postal_code: "10101",
            country_code: "cr",
          },
        },
      },
    )
    for (const product of [checkoutA, checkoutB]) {
      await request(
        baseUrl,
        "POST",
        `/store/carts/${cart.id}/line-items`,
        {
          token: buyerA.token,
          publishableKey,
          body: { offer_id: product.offer.id, quantity: 1 },
        },
      )
    }
    await request(
      baseUrl,
      "POST",
      `/store/carts/${cart.id}/shipping-methods`,
      {
        token: buyerA.token,
        publishableKey,
        body: [
          { option_id: sellerA.shippingOptionId },
          { option_id: sellerB.shippingOptionId },
        ],
      },
    )
    const { payment_collection: paymentCollection } = await request(
      baseUrl,
      "POST",
      "/store/payment-collections",
      {
        token: buyerA.token,
        publishableKey,
        body: { cart_id: cart.id },
      },
    )
    await request(
      baseUrl,
      "POST",
      `/store/payment-collections/${paymentCollection.id}/payment-sessions`,
      {
        token: buyerA.token,
        publishableKey,
        body: { provider_id: externalPaymentProvider, data: {} },
      },
    )
    const completed = await request(
      baseUrl,
      "POST",
      `/store/carts/${cart.id}/complete`,
      { token: buyerA.token, publishableKey },
    )
    assert.ok(completed.order_group?.id, "Multi-vendor checkout should create an order group")
    const externalPayments = await request(
      baseUrl,
      "GET",
      `/store/order-groups/${completed.order_group.id}/external-payments`,
      { token: buyerA.token, publishableKey },
    )
    const sellerOrders = externalPayments.seller_orders ?? []
    assert.equal(sellerOrders.length, 2, "The cart should split into two seller orders")
    assert.ok(sellerOrders.every(({ payment_status }) => payment_status === "pending"))
    assert.ok(
      sellerOrders.every(
        ({ whatsapp_number }) => whatsapp_number === "50688880001",
      ),
      "Each pending seller order should expose its normalized WhatsApp contact",
    )
    for (const order of sellerOrders) {
      const reference = order.display_id ? `#${order.display_id}` : order.id
      const message = `Order ${reference}`
      const whatsappUrl = new URL(`https://wa.me/${order.whatsapp_number}`)
      whatsappUrl.searchParams.set("text", message)
      assert.equal(whatsappUrl.hostname, "wa.me")
      assert.ok(whatsappUrl.searchParams.get("text")?.includes(reference))
    }

    const orderBySeller = new Map(
      sellerOrders.map((order) => [
        order.id,
        order.seller_name === sellerA.name ? sellerA : sellerB,
      ]),
    )
    for (const order of sellerOrders) {
      const seller = orderBySeller.get(order.id)
      assert.ok(seller)
      const commissions = await request(
        baseUrl,
        "GET",
        `/vendor/orders/${order.id}/commission-lines`,
        seller.scope,
      )
      assert.ok(
        commissions.commission_lines?.some(({ amount }) => Number(amount) > 0),
        "Each seller order should record a positive commission line",
      )
    }

    const orderA = sellerOrders.find(({ seller_name }) => seller_name === sellerA.name)
    const orderB = sellerOrders.find(({ seller_name }) => seller_name === sellerB.name)
    assert.ok(orderA && orderB)
    await expectHttpFailure(
      () =>
        request(
          baseUrl,
          "POST",
          `/vendor/orders/${orderB.id}/external-payment-confirmation`,
          { ...sellerA.scope, body: {} },
        ),
      [400, 403, 404],
      "A seller must not confirm another seller's external payment",
    )
    await request(
      baseUrl,
      "POST",
      `/vendor/orders/${orderA.id}/external-payment-confirmation`,
      { ...sellerA.scope, body: {} },
    )
    const updatedPayments = await request(
      baseUrl,
      "GET",
      `/store/order-groups/${completed.order_group.id}/external-payments`,
      { token: buyerA.token, publishableKey },
    )
    assert.equal(
      updatedPayments.seller_orders.find(({ id }) => id === orderA.id)?.payment_status,
      "confirmed",
    )
    assert.equal(
      updatedPayments.seller_orders.find(({ id }) => id === orderB.id)?.payment_status,
      "pending",
      "Confirming one seller's receipt must not change another seller's order",
    )

    console.log("E2E acceptance passed: split checkout, external payments, commissions, catalog, wishlist, leads, and reservations.")
  } catch (error) {
    taskError = error
  } finally {
    if (apiProcess && apiProcess.exitCode === null) {
      apiProcess.kill("SIGTERM")
      await new Promise((resolve) => {
        const timer = setTimeout(() => {
          if (apiProcess.exitCode === null) apiProcess.kill("SIGKILL")
          resolve()
        }, 10_000)
        apiProcess.once("exit", () => {
          clearTimeout(timer)
          resolve()
        })
      })
    }
    if (databaseCreated) {
      try {
        await adminClient.query(`DROP DATABASE "${databaseName}" WITH (FORCE)`)
      } catch (error) {
        cleanupError = error
      }
    }
    await adminClient.end().catch((error) => {
      cleanupError ??= error
    })
  }

  if (taskError) {
    if (cleanupError) {
      console.error(`E2E cleanup also failed: ${cleanupError.message}`)
    }
    throw taskError
  }
  if (cleanupError) throw cleanupError
}

main().catch((error) => {
  console.error(error.stack ?? error)
  process.exitCode = 1
})
