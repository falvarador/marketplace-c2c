# Seller Lifecycle Specification

## Purpose

Defines seller onboarding, approval visibility, and ownership boundaries for marketplace catalog and fulfillment data. It lets independent sellers operate without exposing one seller's records to another.

## Requirements

### Requirement: Seller Registration and Member Association
The system SHALL allow an authenticated user to register a seller profile and SHALL associate the registering member with that seller. A user without an active seller profile SHALL be able to resume onboarding without creating duplicate seller profiles.

#### Scenario: User registers as a seller
- **WHEN** an authenticated user submits valid seller onboarding details
- **THEN** the system creates a seller profile in `pending` state and associates the authenticated member with it

#### Scenario: Seller member resumes onboarding
- **WHEN** a member associated with a pending seller submits onboarding again
- **THEN** the system returns or updates that seller profile instead of creating a second profile

### Requirement: Seller Lifecycle Controls Marketplace Availability
The system SHALL support `pending`, `active`, and `suspended` seller lifecycle states. Only active sellers SHALL have public storefronts and published products available for discovery, checkout, or classified reservations. Pending and suspended sellers SHALL be unable to publish new products or accept new transactions.

#### Scenario: Seller is approved
- **WHEN** an authorized marketplace operator changes a seller from `pending` to `active`
- **THEN** the seller's published products become eligible for public discovery and transactions

#### Scenario: Seller is suspended
- **WHEN** an authorized marketplace operator changes an active seller to `suspended`
- **THEN** the seller and its products are excluded from public discovery and new transactions are rejected

### Requirement: Seller-Owned Product and Inventory Access
The system SHALL restrict seller product, variant, offer, and inventory operations to the authenticated member's selected seller. A seller SHALL NOT read or mutate another seller's private catalog or inventory.

#### Scenario: Seller manages own product
- **WHEN** a member creates or updates a product while scoped to a seller they belong to
- **THEN** the product and its inventory are associated with that seller and the operation succeeds

#### Scenario: Seller attempts cross-seller access
- **WHEN** a member requests or mutates a product or inventory item belonging to a seller they do not belong to
- **THEN** the system rejects the request without revealing or changing the other seller's private data

### Requirement: Seller-Owned Order and Fulfillment Access
The system SHALL associate each seller's portion of an order with that seller and SHALL restrict seller order and fulfillment operations to the authenticated member's selected seller.

#### Scenario: Seller fulfills own split order
- **WHEN** a seller member retrieves or fulfills an order assigned to their seller
- **THEN** the system returns that seller's order data and applies the requested fulfillment change

#### Scenario: Seller attempts access to another seller's order
- **WHEN** a seller member retrieves or changes an order assigned to another seller
- **THEN** the system rejects the request and leaves the order unchanged

### Requirement: WhatsApp Contact for Checkout Sellers
An active seller SHALL provide a valid WhatsApp contact number before publishing or keeping checkout-enabled offers available. The number SHALL be available to buyers only as the seller contact needed to arrange external payment and SHALL NOT grant access to seller-private data.

#### Scenario: Seller enables checkout without a WhatsApp number
- **WHEN** an active seller attempts to publish a checkout-enabled offer without a valid WhatsApp contact number
- **THEN** the system rejects the publication and identifies the missing seller contact requirement

#### Scenario: Seller publishes checkout with a WhatsApp number
- **WHEN** an active seller with a valid WhatsApp contact number publishes a checkout-enabled offer
- **THEN** the offer can be purchased and its seller contact can be used to create the buyer's prefilled payment message
