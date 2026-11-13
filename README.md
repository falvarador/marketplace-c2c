# Generic Marketplace

This repository is transitioning to a modular marketplace backend based on
MercurJS and Medusa v2. The API lives in `apps/api`; the existing Go/PocketBase
application is retained during the transition. The Preact storefront in
`apps/storefront` provides catalog discovery, product details, buyer activity,
and seller product-management routes backed by the Store and Vendor APIs.

## Requirements

- Node.js version from `.nvmrc`
- Docker-compatible runtime with Docker Compose (OrbStack or Docker Desktop)

## Backend setup

Install dependencies, start the local data services, and configure the API
environment:

```sh
npm install
npm run docker:up
cp apps/api/.env.example apps/api/.env
```

Set the CORS and secrets in `apps/api/.env`. Its database URLs match the default
Compose credentials and ports. To override PostgreSQL credentials, set
`POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB` for Compose and update
`DATABASE_URL` to match. Before seeding a Store region, also set:

| Variable | Description |
| --- | --- |
| `MARKETPLACE_REGION_NAME` | Region name |
| `MARKETPLACE_CURRENCY_CODE` | ISO currency code for the region |
| `MARKETPLACE_COUNTRIES` | Comma-separated ISO alpha-2 country codes |
| `MARKETPLACE_PAYMENT_PROVIDER_IDS` | Provider IDs registered in this environment (local SINPE: `pp_external_sinpe_external_sinpe`) |

These deployment-specific choices are intentionally not hard-coded. The
region seeder creates or updates the region with the configured name, making
repeated runs safe.

```sh
npm run api:migrate
npm run api:seed-region
npm run api:build
npm run api:dev
```

Use `npm run docker:logs` to follow the service logs and `npm run docker:down`
to stop the services. `npm run docker:clean` also removes the persistent
database and Redis volumes.

The region is available to Store API clients at `GET /store/regions`; use a
publishable API key as required by the Medusa Store API. Seller and buyer
endpoints are scoped to the authenticated seller or customer. Payment
providers must be configured in the Medusa payment module before their IDs are
listed in the region environment variable. Fulfillment provider and stock
location setup remains an environment-specific Medusa admin configuration.

The local `external_sinpe` provider is a deferred-authorization marker only:
it creates no payment record, never captures or refunds money, and does not
process SINPE transfers. Sellers confirm transfers manually in their order
workspace; buyers coordinate each seller order through the returned WhatsApp
link. Do not list this provider in a region unless the matching module is
registered.

## Storefront

The Preact client reads its API URL and public publishable key from
`apps/storefront/.env`. Copy `apps/storefront/.env.example` there and set
`VITE_PUBLISHABLE_API_KEY`; never put an admin key in a `VITE_` variable. The
client uses generated Mercur route types, so build the API after configuring
`apps/api/.env` and before type-checking or building the storefront:

```sh
npm run api:build
npm run storefront:dev
npm test
npm run build
```

`npm run build` builds the Mercur API and Preact storefront; it requires the
configured `apps/api/.env`. `npm test` runs the API policy/access-control tests
and storefront unit tests. `npm run legacy:build` remains available for the
original root Vite starter during the transition.

The storefront exposes `/explorar` for category attributes, price, location,
and URL-synchronized catalog filters; `/item/:handle` for checkout, contact,
and reservation actions; `/carrito` for address, shipping, split-order
completion, and external SINPE setup; `/vendedor/*` for seller publication,
payment confirmation, and fulfillment; and `/cuenta` plus `/favoritos` for
buyer activity. Buyer and seller sessions remain separate, and the API remains
authoritative for seller scope, publication state, reservations, and order
access.

## Current marketplace API

- Store catalog and region APIs use Medusa's `/store/*` routes.
- Authenticated buyer features include wishlist, seller contact leads, and
  reservation requests.
- Seller management endpoints use `/vendor/*` and enforce seller scoping.
- Category marketplace policies select checkout or direct-contact behavior;
  category overrides take precedence over the configured default transaction
  mode.

See `openspec/changes/mercurjs-generic-marketplace/` for the implementation
specification and current task progress.
