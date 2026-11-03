# data-schema-and-access Specification

## Purpose

Defines the database collections, field schemas, validation rules, seed records, API access control rules, and server-side record hooks for users, categories, furniture listings, and favorites in the C2C furniture marketplace.

## Requirements

### Requirement: Extended Users Auth Collection
The system SHALL extend the `users` authentication collection with `phone` (text field for Costa Rica / WhatsApp numbers) and `province` (single select with values: `San José`, `Alajuela`, `Cartago`, `Heredia`, `Guanacaste`, `Puntarenas`, `Limón`), and SHALL support authentication via Email/Password and OAuth2 providers (Google and Facebook).

#### Scenario: User registration with Costa Rica contact details
- **WHEN** a user registers or updates their profile with a valid `phone` and selects one of the 7 provinces of Costa Rica in `province`
- **THEN** the `users` record persists the `phone` and `province` fields and makes them available for listing seller contact flows

### Requirement: Categories Collection and Seed Data
The system SHALL provide a `categories` base collection containing `name` (required text), `slug` (required unique text), and `icon` (optional text). The system SHALL enforce public read access (`""`) and admin-only write access (`null`), and SHALL automatically seed the initial categories if missing: `Camas`, `Sillones`, `Juegos de Comedor`, `Juegos de Sala`, `Juegos de Terraza`, `Escritorios`, `Cómodas`, `Electrodomésticos`, `Antigüedades`, `Infantiles`, and `Otros`.

#### Scenario: Public user lists seeded categories
- **WHEN** an unauthenticated or authenticated client requests the list of records from `categories`
- **THEN** the system returns all 11 seeded categories with their `name`, unique `slug`, and `icon`

#### Scenario: Non-admin user attempts to modify categories
- **WHEN** a non-admin client attempts to create, update, or delete a record in `categories`
- **THEN** the system rejects the request with a forbidden error (`403`)

### Requirement: Furniture Listings Collection and Validation
The system SHALL provide a `listings` base collection with the following fields and constraints:
- `title`: text, required, minimum 5 characters
- `slug`: text, unique (or generated with ID)
- `description`: editor/text, required
- `price`: number (CRC `₡`), required
- `condition`: single select (`Nuevo`, `Como Nuevo`, `Usado`), required
- `space`: single select (`Sala`, `Comedor`, `Habitación`, `Oficina - Estudio`, `Cocina`, `Baño`, `Exteriores`, `Jardín`, `Área de Lavado`, `Gimnasio`, `Otros`), required
- `province`: single select (`San José`, `Heredia`, `Alajuela`, `Cartago`, `Guanacaste`, `Puntarenas`, `Limón`), required
- `category`: single relation to `categories`, required
- `seller`: single relation to `users`, required
- `images`: multi-file field, maximum 8 files, allowed MIME types `image/jpeg`, `image/png`, `image/webp`, configured with thumbnails `300x300f` and `800x600f`
- `status`: single select (`active`, `sold`, `paused`, `pending`)
- `views`: number, default `0`

#### Scenario: Creating a valid furniture listing with images
- **WHEN** an authenticated seller submits a listing with a title of at least 5 characters, required fields, and up to 8 valid images (`jpg`, `png`, or `webp`)
- **THEN** the system stores the listing record and generates `300x300f` and `800x600f` thumbnails on demand

#### Scenario: Rejecting invalid listing title or excess images
- **WHEN** a client submits a listing with a title shorter than 5 characters or more than 8 images
- **THEN** the system rejects the creation with a validation error (`400`)

### Requirement: Listings Access Rules and Ownership Enforcement Hook
The system SHALL enforce the following access rules on `listings`:
- List and View: `status = "active" || @request.auth.id = seller.id`
- Create: `@request.auth.id != "" && @request.body.seller = @request.auth.id`
- Update and Delete: `@request.auth.id = seller.id`

Additionally, on record creation and update requests for `listings`, the server hook SHALL force `seller = authRecord.Id` and SHALL generate a clean URL-safe `slug` (incorporating the title and record ID) if not already set.

#### Scenario: Public visibility restricted to active listings
- **WHEN** an unauthenticated visitor or a different user queries `listings`
- **THEN** the system returns only records where `status = "active"`

#### Scenario: Seller views and manages own non-active listings
- **WHEN** an authenticated seller queries or updates their own listings with status `paused`, `sold`, or `pending`
- **THEN** the system permits viewing and updating those records

#### Scenario: Server hook enforces seller identity and slug generation
- **WHEN** an authenticated user creates a listing through the API
- **THEN** the server hook forces `seller` to match the authenticated user's ID and populates a clean `slug` automatically

### Requirement: Favorites Collection and Uniqueness
The system SHALL provide a `favorites` base collection with `user` (single relation to `users`, required) and `listing` (single relation to `listings`, required), a composite unique index on `(user, listing)`, and API rules restricting List, View, Create, and Delete operations to `@request.auth.id = user.id`.

#### Scenario: User saves a listing to favorites once
- **WHEN** an authenticated user creates a `favorites` record for a listing not yet in their favorites
- **THEN** the system saves the favorite record associated with that user

#### Scenario: Duplicate favorite is prevented
- **WHEN** an authenticated user attempts to create a second `favorites` record for the same `listing`
- **THEN** the system rejects the duplicate record due to the composite unique index on `(user, listing)`

#### Scenario: User cannot access another user's favorites
- **WHEN** a user queries or attempts to delete a `favorites` record belonging to a different `user`
- **THEN** the system denies access or excludes the record from the query results
