import { loadEnv } from "@medusajs/framework/utils"
import { withMercur } from "@mercurjs/core"

loadEnv(process.env.NODE_ENV ?? "development", process.cwd())

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

const defaultTransactionMode =
  process.env.MARKETPLACE_DEFAULT_TRANSACTION_MODE ?? "checkout"
if (defaultTransactionMode !== "checkout" && defaultTransactionMode !== "lead") {
  throw new Error(
    "MARKETPLACE_DEFAULT_TRANSACTION_MODE must be checkout or lead.",
  )
}

module.exports = withMercur({
  projectConfig: {
    databaseUrl: requiredEnv("DATABASE_URL"),
    redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
    http: {
      storeCors: requiredEnv("STORE_CORS"),
      adminCors: requiredEnv("ADMIN_CORS"),
      vendorCors: requiredEnv("VENDOR_CORS"),
      authCors: requiredEnv("AUTH_CORS"),
      jwtSecret: requiredEnv("JWT_SECRET"),
      cookieSecret: requiredEnv("COOKIE_SECRET"),
    },
  },
  featureFlags: {
    seller_registration: true,
  },
  modules: [
    {
      resolve: "./src/modules/marketplace-policy",
    },
    {
      resolve: "./src/modules/classified-engagement",
    },
    {
      resolve: "./src/modules/wishlist",
    },
    {
      resolve: "@medusajs/medusa/payment",
      options: {
        providers: [
          {
            resolve: "./src/modules/external-sinpe",
            id: "external_sinpe",
          },
        ],
      },
    },
    {
      resolve: "@mercurjs/core/modules/admin-ui",
      options: { disable: true },
    },
    {
      resolve: "@mercurjs/core/modules/vendor-ui",
      options: { disable: true },
    },
  ],
})
