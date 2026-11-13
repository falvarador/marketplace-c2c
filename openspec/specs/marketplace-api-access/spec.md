# Marketplace API Access Specification

## Purpose

Defines the public buyer API and authenticated seller API boundaries for marketplace discovery and account actions. It ensures vendor operations are scoped to a verified seller membership and buyer-private data remains private.

## Requirements

### Requirement: Public Store Discovery API
The system SHALL expose public Store API operations to search and retrieve published products, categories, category attribute definitions, public seller profiles, and eligible offers. Results SHALL respect product publication and seller lifecycle visibility.

#### Scenario: Shopper searches the public catalog
- **WHEN** a shopper requests products with valid text, category, price, location, or attribute filters
- **THEN** the Store API returns only matching published products from active sellers

#### Scenario: Shopper retrieves dynamic filter definitions
- **WHEN** a shopper requests categories and filterable attributes for a category
- **THEN** the Store API returns the category tree and typed attribute definitions applicable to that category

### Requirement: Seller API Authentication and Scoping
The system SHALL require member authentication and verified seller membership for seller-managed operations. Each request SHALL resolve one selected seller context and SHALL reject requests with missing, invalid, or unauthorized seller context.

#### Scenario: Authorized seller selects a seller profile
- **WHEN** an authenticated member selects a seller profile they belong to
- **THEN** subsequent seller operations execute in that seller's scope

#### Scenario: Member selects an unrelated seller
- **WHEN** an authenticated member selects a seller profile they do not belong to
- **THEN** the system rejects the selection and does not return seller-private data

### Requirement: Buyer Wishlist Access
The system SHALL allow an authenticated buyer to add, list, and remove products in their wishlist. A buyer SHALL NOT read or modify another buyer's wishlist.

#### Scenario: Buyer saves and retrieves a product
- **WHEN** an authenticated buyer adds a public product to their wishlist and then lists saved products
- **THEN** the product appears once in that buyer's wishlist

#### Scenario: Buyer accesses another wishlist
- **WHEN** a buyer requests or changes wishlist data belonging to another buyer
- **THEN** the system rejects the request without exposing or changing that data

### Requirement: Seller API for Catalog and Commerce Operations
The system SHALL expose authenticated seller operations for managing seller-owned products, variants, attributes, inventory, offers, orders, commissions, and fulfillment. Every operation SHALL enforce the seller scope and applicable lifecycle rules.

#### Scenario: Seller updates product attributes and stock
- **WHEN** an active seller updates valid attributes or inventory for an owned product
- **THEN** the system persists the change and returns the seller-scoped result

#### Scenario: Pending seller attempts to publish a product
- **WHEN** a pending seller attempts a product publication or inventory operation that enables a transaction
- **THEN** the system rejects the operation while allowing access to required onboarding actions

### Requirement: Buyer Lead and Reservation API
The system SHALL require buyer authentication for product inquiries and reservation requests, and SHALL expose seller operations for reviewing, confirming, or declining those requests. Responses SHALL enforce buyer, seller, and operator visibility boundaries.

#### Scenario: Seller reviews a buyer request
- **WHEN** a seller member lists requests for their seller
- **THEN** the system returns only requests associated with that seller

#### Scenario: Visitor submits a buyer request
- **WHEN** an unauthenticated visitor attempts to create an inquiry or reservation request
- **THEN** the system rejects the request without creating buyer activity

#### Scenario: Buyer retrieves own request status
- **WHEN** an authenticated buyer retrieves their inquiry or reservation status
- **THEN** the system returns only that buyer's request and its current status

### Requirement: Seller-Scoped External Payment Confirmation
The system SHALL allow an authenticated seller member to confirm an external SINPE payment only for an order owned by the selected seller. Confirmation SHALL be recorded against a pending seller order, and seller fulfillment operations SHALL reject orders whose external payment has not been confirmed.

#### Scenario: Seller confirms payment for its own order
- **WHEN** an authenticated seller confirms a pending order belonging to the selected seller
- **THEN** the system records the confirmation and allows fulfillment for that seller order

#### Scenario: Seller confirms payment for another seller's order
- **WHEN** an authenticated seller attempts to confirm an order outside the selected seller's scope
- **THEN** the system rejects the request without exposing or changing the order

#### Scenario: Seller repeats or misuses payment confirmation
- **WHEN** a seller confirms an order that is not awaiting external payment
- **THEN** the system rejects the invalid state transition and preserves the existing payment and fulfillment state
