# Design

## Context

See `proposal.md` for the motivation. The current repository is a single Go module with PocketBase in `main.go` and a root Preact/Vite starter; `package.json` has no Mercur, Medusa, router, or signals dependencies. There is no `medusa-config.ts`, PostgreSQL setup, or published OpenSpec capability. The separate `c2c-furniture-marketplace` change describes the previous furniture/PocketBase direction and is left untouched.

The design follows Mercur's documented request path (route → workflow → module) and uses the existing `/store`, `/vendor`, and `/admin` surfaces. Mercur's own seller, product, order-group, commission, attribute, and vendor-scoping modules are the default source of those behaviors; custom modules cover only the gaps identified in the specs.

## Goals / Non-Goals

**Goals:**
- Keep backend domain changes inside Medusa modules, workflows, links, API routes, and middleware; do not fork or duplicate Mercur's marketplace modules.
- Keep the storefront and seller hub in Preact and make category attributes and transaction mode backend-driven.
- Make buyer/customer and seller/member authentication distinct, and derive seller scope from the authenticated member rather than trusting a seller ID supplied by the UI.
- Keep the former PocketBase runtime and SQLite data out of the new service's runtime path.

**Non-Goals:**
- Reimplement Mercur's seller, catalog, cart, order splitting, commission, or vendor authorization features.
- Process or custody payments, integrate SINPE Móvil, or automatically collect or settle commissions.
- Automatically migrate existing PocketBase records or preserve old PocketBase endpoints.
- Add server-side rendering or a separate React seller dashboard.

## Decisions

### 1. Move to a small npm-workspaces layout

Restructure the root into an npm workspace, retaining npm because the repository already has `package-lock.json`:

```text
package.json
apps/
  api/
    medusa-config.ts
    src/
      api/
        middlewares.ts
        store/
          wishlist/route.ts
          wishlist/items/[product_id]/route.ts
          leads/route.ts
          reservation-requests/route.ts
        vendor/
          leads/route.ts
          reservation-requests/[id]/route.ts
      links/
      modules/
        marketplace-policy/
        wishlist/
        classified-engagement/
      workflows/
        approve-seller/
        create-lead/
        request-reservation/
        decide-reservation/
      subscribers/
      jobs/
  storefront/
    index.html
    vite.config.ts
    src/
      app.tsx
      lib/api.ts
      store/
        auth.ts
        cart.ts
        filters.ts
        wishlist.ts
      components/
      pages/
        explore/
        item/
        seller/
        account/
```

`apps/api/medusa-config.ts` wraps the Medusa configuration with `withMercur()` and reads PostgreSQL, Redis, file storage, and provider settings from the environment. The exact Mercur and Medusa versions should be pinned together from the supported starter/release at implementation time rather than inferred from the current Go or frontend dependencies. A separate `packages/` workspace is unnecessary until code is genuinely shared.

### 2. Reuse Mercur modules; isolate marketplace-specific policy

Use Mercur's seller/member, product, offer, product-attribute, inventory, order-group, commission, and vendor API behavior directly. Product-to-seller and product-to-offer associations should use the links already supplied by Mercur. Add links only for new records, such as a wishlist item joining a customer to a product or a classified inquiry joining a buyer, product, and seller.

Use the Mercur seller/member lifecycle as the account and authorization foundation. Store the requested `pending`, `active`, and `suspended` approval state as marketplace policy associated with the native seller rather than replacing Mercur's seller model. Centralize visibility and write guards so pending/suspended sellers cannot appear in public results, publish transaction-ready products, or accept new requests. The admin decision that changes approval state runs through a workflow.

Keep category-specific specifications in Mercur's product-attribute facilities. Store only cross-vertical marketplace policy—effective transaction mode, universal location/search data, and classified request state—in custom module records linked to the native product or category. The effective mode is the platform default unless a category overrides it; product pages consume the resolved mode rather than duplicating precedence logic.

Universal listing location uses an ISO 3166-1 alpha-2 country code with optional region/province and locality text. The marketplace does not store or expose precise coordinates; categories may add domain-specific location attributes separately.

When a product belongs to multiple categories with transaction-mode overrides, `lead` takes precedence over `checkout`. This conservative rule prevents a category from accidentally exposing a contact/reservation listing to checkout.

### 3. Compose all writes through workflows

Custom API routes validate the caller and input, then invoke workflows. Workflows compose native module operations and custom steps with compensations for multi-record writes:

- Seller approval updates the marketplace policy and the public visibility state used by discovery.
- A wishlist workflow enforces one entry per customer/product and supports add/remove/list.
- A lead workflow records buyer contact against a product and seller and sends a notification through the configured notification provider.
- A reservation workflow atomically claims the unique inventory unit for one pending request, allows only that seller to confirm or decline it, and releases the claim on decline.
- The native cart completion workflow remains responsible for checkout; Mercur creates an order group and seller-specific orders with commission data. Seller fulfillment remains on `/vendor/orders`.
- Checkout records external payment as pending per seller order. A seller-scoped workflow records the seller's manual confirmation of SINPE receipt; the seller order cannot be fulfilled before that confirmation.

Do not implement inventory reservations with an unlocked read-then-write check. The reservation persistence/claim must have a database-enforced uniqueness or equivalent atomic operation so concurrent requests cannot both claim one unit.

### 4. Keep default API routes distinct from custom extensions

Use the documented native routes for capabilities Mercur already provides:

| Surface | Routes used |
| --- | --- |
| Store discovery | `GET /store/products`, `/store/product-categories`, `/store/product-attributes`, `/store/sellers`, and `/store/offers` |
| Store checkout/history | `POST /store/carts/:id/line-items`, `POST /store/carts/:id/complete`, and authenticated `GET /store/order-groups[/:id]` |
| Seller onboarding | `GET/POST /vendor/sellers`, `POST /vendor/sellers/select`, and `GET/POST /vendor/sellers/me` |
| Seller operations | `/vendor/products`, `/vendor/products/:id/attributes/batch`, `/vendor/products/:id/variants`, `/vendor/offers`, `/vendor/inventory-items`, `/vendor/orders`, and seller order fulfillment routes |

Add custom routes only for behavior not provided by the selected Mercur release: `GET/POST /store/wishlist`, `DELETE /store/wishlist/items/:product_id`, `POST /store/leads`, `POST /store/reservation-requests`, and seller-scoped `/vendor/leads`, `/vendor/reservation-requests/:id` decision actions, and payment-confirmation actions for seller orders. The Store API owns buyer actions; `/vendor` middleware must resolve member membership and seller context before custom handlers run. Do not expose a caller-controlled seller ID as authorization. The payment-confirmation route must also guard fulfillment until the selected seller confirms the order's external payment.

Use `/auth/customer/emailpass` for buyer credentials and `/auth/member/emailpass` for seller-member credentials, with the appropriate actor session/token on each surface. Classified inquiries and reservation requests require buyer authentication so activity appears in the buyer's account. Configure deployment so credentials are sent through secure same-site cookies where the origin arrangement permits; otherwise use Mercur-supported bearer auth and keep customer and vendor credentials in separate client auth stores. Never put admin or publishable secrets in the browser bundle.

### 5. Build one Preact SPA with role-aware route areas

Keep buyer and seller experiences in `apps/storefront`; separate their route/page areas, not their product data or API authority. `src/lib/api.ts` wraps `@mercurjs/client` and generated backend route types. Use `@preact/signals` for current buyer/member session, selected seller, cart, wishlist, and catalog filters. The backend remains the source of truth for permissions, product eligibility, price, inventory, transaction mode, and reservation state.

The SPA route map is `/explorar`, `/item/:handle`, `/vendedor/*`, `/cuenta`, and `/favoritos`. Catalog filters and pagination are reflected in the URL; category facets come from Store API product-attribute definitions. Product details select checkout, lead, or reservation actions from the resolved product/category mode. Protected seller pages require an authenticated member and selected seller; UI route guards improve UX but do not replace backend scoping.

An inquiry is associated with the authenticated buyer profile and product, with an optional message; seller delivery uses the configured notification provider. This avoids collecting a second set of contact details when the buyer already has an account.

### 6. Keep checkout settlement external to the marketplace

Completing a multi-seller cart creates the native order group and seller orders, but does not capture or transfer funds. Each seller order records its own external SINPE Móvil payment as pending; the buyer receives a `wa.me` link to that seller with the order reference and amount prefilled. Checkout-enabled sellers must configure a WhatsApp number. After the seller verifies the transfer outside the platform, a seller-scoped action records the confirmation and unlocks fulfillment for that seller order. The platform calculates and records commissions but does not collect or settle them.

Use Costa Rica (`CR`) and Costa Rican colón (`CRC`) for the initial local test configuration, supplied through the existing environment-driven region settings rather than hard-coded values. Keep payment and commission settlement outside the platform; do not configure a payment processor for SINPE.

### 7. Treat this as a service and data cutover

Run the new API against a separate PostgreSQL database and keep PocketBase's SQLite data untouched. The initial MercurJS deployment starts with a clean catalog and does not import existing users or listings. Until cutover is approved, rollback means routing traffic back to the existing Go binary and its preserved database backup; the two services must not write to the same data store.

## Risks / Trade-offs

- **[Risk] Mercur's route and module APIs evolve with its release train** → Pin compatible Mercur/Medusa versions and validate each native route against that release's installed docs and generated route types before writing extensions.
- **[Risk] Mercur seller availability states may not exactly match the requested approval states** → Keep approval state separate from native seller state and enforce it in one policy/workflow boundary; test public discovery, purchase, and lead paths for every state.
- **[Risk] Dynamic attributes can create inconsistent or unfilterable data if definitions change after products are published** → Version attribute definitions or validate existing values before changing/removing a definition; only expose attributes marked filterable.
- **[Risk] A unique-item reservation can race with checkout or another reservation** → Use an atomic inventory claim with a database constraint and make checkout honor the same claim.
- **[Risk] A seller may confirm an external transfer incorrectly or before it settles** → Keep confirmation seller-scoped and auditable, require explicit confirmation before fulfillment, and make clear that SINPE verification happens outside the platform.
- **[Risk] Mercur may require a payment session to complete a cart** → Verify the installed checkout contract; if required, use only a non-capturing external-payment marker so order creation does not imply that funds were received.
- **[Risk] Replacing PocketBase is a breaking runtime and deployment change** → Deploy the new API and database separately, start with a clean catalog as decided, and retain the existing service and backup until acceptance.
- **[Risk] The requested Preact seller hub is separate from Mercur's maintained React vendor panel** → Keep the custom Preact hub limited to seller-facing flows required by this product and use `/vendor` APIs; do not fork or embed Mercur's React dashboard.

## Migration Plan

1. Establish the npm workspace and Node runtime without deleting the current Go/PocketBase source; record the local start/build commands for both services during development.
2. Add the Mercur API, PostgreSQL/Redis configuration, provider stubs, and a clean-environment smoke test for `/store` and `/vendor` authentication.
3. Implement and test seller approval policy, category attributes, transaction-mode resolution, wishlist, lead, and reservation workflows against isolated PostgreSQL.
4. Build the Preact API client and route areas against the generated API types; verify buyer/member identity separation, seller scoping, and each transaction mode end to end.
5. Configure the Costa Rica/CRC test region and fulfillment resources, seed categories and category attributes, then run acceptance tests with multiple sellers, both transaction modes, and external-payment confirmation.
6. Cut over with a clean MercurJS catalog only after configuration, payment, fulfillment, backups, and rollback have been verified; on failure, restore routing to the preserved PocketBase service/database.

## Open Questions

- Which fulfillment provider(s) should each deployment configure?
