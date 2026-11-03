# Spec Delta

## Purpose

Defines the HTTP server behavior for atomic listing view counting, SPA static asset delivery, and dynamic server-side injection of SEO meta tags, OpenGraph properties, and Schema.org Product JSON-LD into the HTML shell.

## ADDED Requirements

### Requirement: Atomic Listing View Increment Endpoint
The system SHALL expose a `POST /api/listings/{id}/view` endpoint that atomically increments the `views` counter of the specified listing by 1 without requiring authentication or edit permissions on the listing.

#### Scenario: Visitor views an active listing
- **WHEN** a client sends `POST /api/listings/{id}/view` for an existing listing ID
- **THEN** the server increments the listing's `views` field by 1 atomically in the database and returns a `200 OK` JSON response containing the updated view count

#### Scenario: View increment requested for non-existent listing
- **WHEN** a client sends `POST /api/listings/{id}/view` with an unknown listing ID
- **THEN** the server returns a `404 Not Found` response

### Requirement: Dynamic SEO, OpenGraph, and Product JSON-LD Injection for Listing Routes
When a `GET` request arrives for `/anuncio/{id}` or `/mueble/{id}` (where `{id}` is a listing ID or slug) and the listing exists with `status = "active"`, the server SHALL serve the compiled `index.html` with its SEO placeholders replaced in memory with:
- `<title>`: Listing title and formatted price in Costa Rican Colones (`₡`)
- `<meta name="description">`: Truncated plain-text description of the listing
- OpenGraph tags (`og:title`, `og:description`, `og:image` pointing to the first listing image with `?thumb=800x600f`, `og:url`, and `og:type` set to `"product"`)
- `<script type="application/ld+json">`: Valid Schema.org `Product` structured data including `name`, `description`, `image`, `itemCondition` mapped from the listing's `condition`, and `offers` with `priceCurrency: "CRC"`, numeric `price`, and `availability`

#### Scenario: Social crawler or browser requests active listing URL
- **WHEN** a client sends `GET /anuncio/{id}` or `GET /mueble/{id}` for an active listing
- **THEN** the server returns `200 OK` with `text/html` containing the listing's formatted CRC price (`₡`), OpenGraph tags with the `?thumb=800x600f` image URL, and a valid `application/ld+json` block of `@type: "Product"` with `priceCurrency: "CRC"`

#### Scenario: Listing route requested for inactive or missing listing
- **WHEN** a client sends `GET /anuncio/{id}` for a listing that does not exist or is not `active`
- **THEN** the server returns the `index.html` shell populated with default marketplace metadata so the client-side SPA router can render the appropriate state

### Requirement: SPA Fallback and Static Asset Serving
For any `GET` request that does not match `/api/*` or `/_/*`, the server SHALL serve matching static files from the compiled frontend output directory (`pb_public` or `dist`), or fall back to serving `index.html` with default marketplace SEO metadata when no static file matches the path.

#### Scenario: Direct navigation to a frontend SPA route
- **WHEN** a browser navigates directly to `/explorar`, `/anunciar`, `/favoritos`, or `/mis-anuncios`
- **THEN** the server responds with `index.html` populated with the default marketplace title, meta description, OpenGraph tags, and JSON-LD so the Preact router takes control
