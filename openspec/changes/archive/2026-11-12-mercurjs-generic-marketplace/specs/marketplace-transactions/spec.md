# Spec Delta

## Purpose

Defines the two transaction paths available to a marketplace product: multi-vendor checkout or classified contact/reservation. The active path is configurable at platform or category level and preserves seller-specific order handling.

## ADDED Requirements

### Requirement: Configurable Product Transaction Mode
The system SHALL support `checkout` and `lead` transaction modes. A platform default SHALL apply unless a category overrides it, and product interactions SHALL follow the effective mode configured for the product's category.

#### Scenario: Category uses checkout mode
- **WHEN** a shopper views a product in a category configured for checkout
- **THEN** the primary purchase action adds an available offer to the multi-vendor cart

#### Scenario: Category uses lead mode
- **WHEN** a shopper views a product in a category configured for lead generation
- **THEN** the primary action offers direct seller contact or a reservation request instead of adding the product to checkout

#### Scenario: Product categories have conflicting overrides
- **WHEN** a product belongs to multiple categories and at least one category overrides its transaction mode to `lead`
- **THEN** the effective transaction mode is `lead`

### Requirement: Multi-Vendor Cart and Split Orders
The system SHALL allow a shopper to purchase eligible offers from multiple active sellers in one cart. Completing the cart SHALL create one order per seller under a shared order group, calculate configured commissions, and keep seller fulfillment and order status independently manageable.

#### Scenario: Shopper completes a cart containing multiple sellers
- **WHEN** a shopper completes a valid cart containing offers from two or more sellers
- **THEN** the system creates a shared order group with a separate seller-owned order for each seller and applies the configured commission to each seller order

#### Scenario: One seller's fulfillment changes
- **WHEN** a seller fulfills or updates its order within a multi-seller order group
- **THEN** the system updates only that seller's order while preserving the other seller orders and shared order-group relationship

### Requirement: Buyer Lead and Direct Contact
For a product in `lead` mode, the system SHALL require buyer authentication to submit a contact request to its seller. The request SHALL be associated with the product and seller and SHALL be visible only to the requesting buyer, the seller, and authorized marketplace operators.

#### Scenario: Authenticated buyer submits a product inquiry
- **WHEN** an authenticated buyer submits a valid inquiry for a publicly available lead-mode product
- **THEN** the system records the inquiry for that product and seller and confirms submission to the buyer

#### Scenario: Visitor attempts to submit a product inquiry
- **WHEN** an unauthenticated visitor submits an inquiry for a lead-mode product
- **THEN** the system requires buyer authentication and does not create an inquiry

#### Scenario: Inquiry targets an unavailable product
- **WHEN** a shopper submits an inquiry for a product that is unpublished, unavailable, or owned by a suspended seller
- **THEN** the system rejects the inquiry and does not expose private seller or product data

### Requirement: Unique-Item Reservation Requests
For an available unique item in `lead` mode, the system SHALL allow an authenticated buyer to request a reservation. The request SHALL be pending seller confirmation and SHALL NOT be represented as a completed sale. The system SHALL prevent more than one active pending or confirmed reservation from being accepted for the same unique inventory unit.

#### Scenario: Seller confirms a unique-item reservation
- **WHEN** a seller confirms a valid pending reservation for an available unique item
- **THEN** the system marks that reservation confirmed and prevents another buyer from reserving or purchasing the same unit

#### Scenario: Competing reservation is submitted
- **WHEN** another buyer submits a reservation for a unique item with an active pending or confirmed reservation
- **THEN** the system rejects the competing request and leaves the existing reservation unchanged

#### Scenario: Seller declines a reservation
- **WHEN** a seller declines a pending reservation
- **THEN** the system marks the request declined and makes the unique item eligible for a new reservation request

### Requirement: External SINPE Payment and Seller Confirmation
The system SHALL create the order group and seller-specific orders when an eligible multi-vendor cart is completed, while recording each seller order as awaiting external payment. Buyers SHALL transfer funds directly to each seller through SINPE Móvil; the marketplace SHALL NOT capture, transfer, or settle those funds. The system SHALL calculate and record commissions without collecting them automatically.

Each checkout-enabled seller SHALL have a WhatsApp contact number. The buyer SHALL be able to open a prefilled `wa.me` message for each seller order that identifies the order and amount due. Only the seller that owns an order may confirm receipt of its external payment. Fulfillment for that seller order SHALL remain unavailable until the seller confirms payment.

#### Scenario: Buyer completes a multi-seller cart without online payment
- **WHEN** a buyer completes a cart containing eligible offers from multiple sellers
- **THEN** the system creates the shared order group and seller-specific orders with payment awaiting external confirmation, records each applicable commission, and does not report a captured payment

#### Scenario: Buyer contacts a seller to arrange SINPE payment
- **WHEN** a buyer views an unpaid seller order
- **THEN** the system provides a WhatsApp link to that seller with the seller-order reference and amount prefilled

#### Scenario: Seller confirms external payment
- **WHEN** the seller that owns a seller order confirms that its SINPE transfer was received
- **THEN** the order records the payment confirmation and becomes eligible for fulfillment

#### Scenario: Seller attempts fulfillment before payment confirmation
- **WHEN** a seller attempts to fulfill an order whose external payment is still pending
- **THEN** the system rejects the fulfillment and leaves the order unchanged

#### Scenario: Seller attempts to confirm another seller's payment
- **WHEN** a seller attempts to confirm external payment for an order owned by another seller
- **THEN** the system rejects the action without exposing or changing that order
