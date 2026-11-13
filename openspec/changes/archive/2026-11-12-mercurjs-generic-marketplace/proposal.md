# Proposal

## Why

The repository is currently a Preact/Vite starter paired with a Go/PocketBase server and has no MercurJS or Medusa backend, so it cannot support the requested Node.js marketplace workflows. This change establishes a domain-agnostic multi-vendor foundation in MercurJS and a lightweight Preact storefront/seller experience, replacing the current furniture-classified direction with configurable commerce and lead-generation flows.

## What Changes

- Replace the Go/PocketBase backend and its SQLite-oriented deployment model with a MercurJS/Medusa v2 API backed by PostgreSQL, using Mercur's seller, product, offer, inventory, order-group, commission, and vendor-scoping capabilities.
- Define seller onboarding and lifecycle rules, including pending, active, and suspended visibility and the association between authenticated members and seller-owned catalog and orders.
- Use native product, category, collection, variant, inventory, and product-attribute concepts for a domain-neutral catalog, with typed, category-specific attributes rather than furniture-specific fields.
- Support both multi-vendor checkout with per-seller order fulfillment and a classified/lead path for unique-stock products, including contact and reservation behavior. Checkout orders use external SINPE Móvil transfers directly to each seller; the marketplace does not process payments.
- Provide a prefilled WhatsApp contact link for each seller order and require the seller to confirm receipt of the external payment before fulfillment can proceed.
- Build a Preact + Vite + TypeScript storefront and seller hub with a typed API client, reactive session/cart/wishlist/filter state, catalog discovery and details, listing management, account, and order/lead views.
- Replace furniture-only Costa Rica content and PocketBase-specific SEO/API assumptions with configurable catalog, region, currency, and marketplace behavior.

## Capabilities

### New Capabilities
- `seller-lifecycle`: Seller registration, onboarding, lifecycle status, seller-owned products/inventory, and order access.
- `domain-agnostic-catalog`: Native catalog taxonomy and typed dynamic attributes that can vary by category without adding vertical-specific product fields.
- `marketplace-transactions`: Multi-vendor checkout and split orders, plus direct-contact and reservation flows for classified items.
- `marketplace-api-access`: Store and vendor API behavior, buyer wishlist access, authentication, and seller-scoped authorization.
- `preact-marketplace-experience`: Preact API/state architecture and buyer storefront, seller hub, account, and wishlist user experiences.

### Modified Capabilities

None. The base `openspec/specs/` directory contains no published capabilities.

## Impact

- **Current backend**: `main.go`, `go.mod`, and the PocketBase server/runtime are replaced by a Node.js MercurJS/Medusa application, `medusa-config.ts`, PostgreSQL configuration, migrations, modules, workflows, links, API routes, and middleware.
- **Current frontend**: the root Vite/Preact starter (`package.json`, `vite.config.ts`, `index.html`, and `src/`) is reorganized into a workspace layout with a Preact storefront and shared typed API/state modules.
- **APIs**: buyer flows use Mercur `/store/*`; seller flows use the authenticated and seller-scoped `/vendor/*` surface. Wishlist, classified contact/reservation, and seller confirmation of external payment require marketplace-specific routes/workflows where Mercur does not provide the required behavior natively.
- **Data and operations**: introduces PostgreSQL and the Node/Mercur runtime; the initial MercurJS deployment starts with a clean catalog and does not import existing PocketBase users or listings. SINPE Móvil transfers and commission settlement remain outside the platform; Costa Rica/CRC is the initial local test region, configured by environment.
- **Existing plan**: `c2c-furniture-marketplace` is an unfinished OpenSpec change for the former PocketBase/furniture direction. This proposal is separate and does not modify or archive it.
