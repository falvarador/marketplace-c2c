# Preact Marketplace Experience Specification

## Purpose

Defines the buyer-facing storefront and seller hub experiences for a domain-neutral multi-vendor marketplace. It covers discovery, product actions, seller publishing, account, wishlist, and purchase or lead history.

## Requirements

### Requirement: Buyer Catalog Discovery and Product Detail
The storefront SHALL provide catalog search and filtering driven by backend category and attribute definitions. Product cards and details SHALL display available variants, price and currency, product attributes, seller identity, availability, and the action appropriate to the product's transaction mode.

#### Scenario: Shopper browses a category with dynamic attributes
- **WHEN** a shopper opens catalog discovery for a category with filterable custom attributes
- **THEN** the interface presents applicable filters and displays only matching products as filters change

#### Scenario: Shopper opens a product detail
- **WHEN** a shopper opens a published product
- **THEN** the detail view displays its media, variants, price and configured currency, seller, dynamic specifications, availability, and checkout or lead action

### Requirement: Buyer Account, Wishlist, and History
The storefront SHALL provide buyer authentication, account/profile access, wishlist management, and access to the buyer's order groups, inquiries, and reservation statuses. Private account data SHALL not be shown to another user.

#### Scenario: Buyer restores an authenticated session
- **WHEN** a buyer returns with a valid stored session
- **THEN** the storefront restores the buyer identity and loads that buyer's cart and wishlist state

#### Scenario: Buyer reviews their marketplace activity
- **WHEN** an authenticated buyer opens their account activity
- **THEN** the interface shows only their order groups, inquiries, and reservation statuses

### Requirement: Seller Onboarding and Protected Seller Hub
The storefront SHALL provide a protected seller hub where an authenticated user can start or resume seller onboarding. Seller catalog and commerce views SHALL reflect the seller's lifecycle state and SHALL expose only the selected seller's data.

#### Scenario: Buyer starts seller onboarding
- **WHEN** an authenticated buyer starts seller onboarding
- **THEN** the seller hub collects the required profile details and shows the resulting pending, active, or suspended state

#### Scenario: Seller opens the hub without seller membership
- **WHEN** an authenticated user opens a seller-only catalog or fulfillment view without an authorized seller membership
- **THEN** the interface blocks access to private seller data and directs the user to onboarding or seller selection

### Requirement: Seller Product Publishing and Management
The seller hub SHALL allow an active seller to create, edit, publish, pause, or archive owned products with category, typed attributes, media, variants, offer, inventory, location, and transaction mode settings supported by marketplace policy.

#### Scenario: Seller publishes a product with category attributes
- **WHEN** an active seller submits a valid product and its required category attributes
- **THEN** the product is published with the submitted attribute values and configured transaction mode

#### Scenario: Seller submits invalid category attributes
- **WHEN** a seller submits attribute values that fail backend validation
- **THEN** the interface shows the validation errors and preserves the seller's unsaved form values

### Requirement: Seller Order, Lead, and Reservation Management
The seller hub SHALL show the active seller's orders, fulfillment status, buyer inquiries, and reservation requests. Sellers SHALL be able to perform only actions allowed by each item's current status.

#### Scenario: Seller handles a split order
- **WHEN** a seller opens an order belonging to their seller within a multi-vendor order group
- **THEN** the interface shows that seller's items and fulfillment actions without exposing another seller's order details

#### Scenario: Seller responds to a reservation request
- **WHEN** a seller confirms or declines a pending reservation request for their seller
- **THEN** the interface reflects the resulting request status and item availability

### Requirement: External Payment and WhatsApp Order Follow-Up
The buyer account SHALL show the external-payment state for each seller order and provide a prefilled WhatsApp link to that seller while payment is pending. The seller hub SHALL show pending external payment and provide a confirmation action only for the selected seller's pending orders. Fulfillment actions SHALL remain unavailable until the seller confirms receipt.

#### Scenario: Buyer opens a WhatsApp payment message
- **WHEN** a buyer views a seller order awaiting SINPE payment
- **THEN** the interface offers a `wa.me` link to that seller with the seller-order reference and amount prefilled

#### Scenario: Seller confirms SINPE receipt
- **WHEN** a seller views one of its orders awaiting external payment and confirms receipt
- **THEN** the interface updates the order to paid and exposes only the fulfillment actions now allowed for that order

#### Scenario: Seller order is not yet paid
- **WHEN** a seller views an order awaiting external payment
- **THEN** the interface does not offer a fulfillment action
