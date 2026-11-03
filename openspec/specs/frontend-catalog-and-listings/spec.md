# frontend-catalog-and-listings Specification

## Purpose

Defines the user-facing SPA views, URL-synchronized catalog filtering, listing detail experience with WhatsApp contact integration, multi-image listing creation/editing, favorites view, and seller listing management.

## Requirements

### Requirement: Home View Discovery Sections
The Home view (`/`) SHALL display:
- A Hero quick-search bar allowing filtering by keyword, `category`, `condition`, `space`, and `province`, which navigates to `/explorar` with the corresponding URL query parameters
- A "Anuncios Recientes" grid displaying active listing cards with thumbnail (`300x300f`), `condition` badge (`Nuevo`, `Como Nuevo`, `Usado`), reference ID, category name, province, and price formatted in Costa Rican Colones (`₡195,000`)
- A "Muebles por Provincia" section displaying the count of active listings for each of the 7 provinces of Costa Rica (`San José`, `Alajuela`, `Cartago`, `Heredia`, `Guanacaste`, `Puntarenas`, `Limón`) with links to filter `/explorar?province=...`
- A "Lo Más Visto" section showing active listings ordered by `-views`

#### Scenario: Visitor searches from the Home hero bar
- **WHEN** a visitor selects province `Heredia` and category `Camas` in the Home hero search and submits
- **THEN** the router navigates to `/explorar?province=Heredia&category=camas` (or category ID/slug) and displays matching listings

#### Scenario: Home displays formatted CRC prices and province counts
- **WHEN** a visitor opens `/`
- **THEN** recent and most-viewed listing cards display prices formatted with the `₡` symbol and thousands separators, and each of the 7 provinces shows its active listing count

### Requirement: Explore Catalog with URL-Synchronized Filters and Pagination
The Explore view (`/explorar`) SHALL provide combinable real-time filters for text search, `category`, `condition`, `space`, `province`, and sort order (most recent `-created`, price ascending `+price`, price descending `-price`, most viewed `-views`), all synchronized bidirectionally with URL query parameters, plus pagination or "Cargar más" loading via `pb.collection('listings').getList(...)`.

#### Scenario: Filtering catalog updates URL and results
- **WHEN** a user selects `condition = "Como Nuevo"` and `province = "San José"` on `/explorar`
- **THEN** the URL query string updates to reflect the active filters and the listing grid refreshes with matching active listings from PocketBase

#### Scenario: Loading additional catalog pages
- **WHEN** more listings exist beyond the first page and the user clicks "Cargar más" (or navigates pages)
- **THEN** the next page of matching listings is fetched from PocketBase and displayed

### Requirement: Listing Detail View with Image Gallery, WhatsApp Contact, and Related Listings
The Listing Detail view (`/anuncio/:id`, also supporting `/mueble/:id`) SHALL:
- Trigger `POST /api/listings/{id}/view` once per visit to increment the view counter
- Render an interactive image gallery using `800x600f` main previews and `300x300f` thumbnails
- Display the full listing details: price in `₡`, `condition` badge, `province`, `space`, `category`, reference ID, views count, seller name, and description
- Provide a "Contactar por WhatsApp" button that opens `https://wa.me/506{telefono}` (using the seller's sanitized Costa Rica phone number) with a pre-filled URL-encoded message containing the furniture title, reference ID, and listing URL
- Provide a button to toggle saving/removing the listing in Favorites
- Display a "Anuncios Relacionados" section with other active listings from the same `category`

#### Scenario: Buyer contacts seller via WhatsApp
- **WHEN** a visitor views `/anuncio/:id` and clicks "Contactar por WhatsApp"
- **THEN** the browser opens `https://wa.me/506{telefono}?text=...` containing the listing's title, ID, and direct link

#### Scenario: Viewing listing detail increments views and shows related items
- **WHEN** a visitor opens `/anuncio/:id`
- **THEN** the client sends `POST /api/listings/{id}/view`, renders the gallery and metadata, and loads active listings from the same category excluding the current listing

### Requirement: Publish and Edit Listing Form with Multi-Image Preview
The protected views `/anunciar` and `/editar/:id` SHALL provide a form to create or update a listing with:
- Validation for `title` (min 5 chars), `price` in Colones (`₡`), `category`, `condition`, `space`, `province`, and `description`
- Multi-image upload (up to 8 images in `jpg`, `png`, or `webp`) with client-side thumbnail preview before uploading and ability to remove selected images
- Automatic redirection to the listing detail or `/mis-anuncios` upon successful save

#### Scenario: Seller publishes a new furniture listing with image previews
- **WHEN** an authenticated seller selects 3 images on `/anunciar`, verifies their previews, fills in all required fields, and submits
- **THEN** the client sends a ` multipart/form-data` request to PocketBase to create the listing with `status = "active"` and navigates to the created listing

#### Scenario: Seller edits an existing listing they own
- **WHEN** an authenticated seller opens `/editar/:id` for their own listing and updates the price or images
- **THEN** the form pre-populates existing values and images, and saves the changes to PocketBase

### Requirement: Favorites and Seller Listings Management Views
The `/favoritos` view SHALL list all active listings saved by the authenticated user with quick removal. The `/mis-anuncios` view SHALL list all listings owned by the authenticated seller (across all statuses: `active`, `sold`, `paused`, `pending`) and provide quick actions to mark a listing as "Vendido" (`sold`), pause/reactivate it (`paused` / `active`), edit it (`/editar/:id`), or delete it.

#### Scenario: Seller marks a listing as sold from Mis Anuncios
- **WHEN** an authenticated seller clicks "Marcar como Vendido" on a listing in `/mis-anuncios`
- **THEN** the listing's `status` updates to `"sold"` in PocketBase, the UI reflects the new status badge immediately, and the listing is no longer shown in public catalog queries
