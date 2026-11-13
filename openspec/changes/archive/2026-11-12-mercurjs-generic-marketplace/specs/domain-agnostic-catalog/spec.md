# Spec Delta

## Purpose

Defines a reusable catalog model for products in different verticals, with category-specific typed attributes and filterable discovery. Categories can evolve without adding domain-specific columns to the core product record.

## ADDED Requirements

### Requirement: Domain-Neutral Product and Stock Models
The system SHALL represent listings using product, category, collection, variant, offer, and inventory concepts that do not require furniture- or vertical-specific fields. The system SHALL support both a single unique item and products with multiple variants or inventory units.

#### Scenario: Seller publishes a unique item
- **WHEN** an active seller publishes a product with one available unit
- **THEN** the product is discoverable with its category, offer, and available inventory represented without requiring a second variant

#### Scenario: Seller publishes a product with variants
- **WHEN** an active seller publishes a product with multiple variants and stock levels
- **THEN** each variant's offer and inventory availability can be discovered and purchased independently

### Requirement: Hierarchical Product Categories
The system SHALL support a public, hierarchical category tree and SHALL allow products to be assigned to one or more valid categories and collections according to marketplace policy.

#### Scenario: Shopper browses a category
- **WHEN** a shopper requests a category and its descendants
- **THEN** the system returns the category hierarchy and published products eligible for public discovery

### Requirement: Typed Category-Specific Product Attributes
The system SHALL allow marketplace operators to define typed product attributes and associate applicable attributes with categories. The system SHALL validate values against each attribute's type and constraints without changing the core product schema.

#### Scenario: Product supplies valid category attributes
- **WHEN** a seller submits values matching the types and constraints of attributes applicable to the selected category
- **THEN** the system stores those values and returns them with the product detail

#### Scenario: Product supplies an invalid attribute value
- **WHEN** a seller submits a value that violates an applicable attribute's type or constraints
- **THEN** the system rejects the product change with a validation error identifying the invalid attribute

### Requirement: Attribute-Aware Catalog Discovery
The system SHALL expose published product attributes that can be used to construct category-specific filters. Shoppers SHALL be able to combine category, typed attribute, price, location, and text filters without receiving products hidden by seller lifecycle or publication status. Universal listing location SHALL use an ISO 3166-1 alpha-2 country code and optional region/province and locality text, without storing precise coordinates.

#### Scenario: Shopper filters products by category attributes
- **WHEN** a shopper applies multiple valid filters to catalog discovery
- **THEN** the system returns only matching, publicly eligible products and the applicable filter definitions

#### Scenario: Category has no custom filterable attributes
- **WHEN** a shopper browses a category without custom filterable attributes
- **THEN** the catalog remains usable with its standard category, text, price, and location filters
