# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Buyers discover products from independent sellers and either purchase them or
contact the seller. Independent sellers publish and manage their own products.

## Product Purpose

Mercur is a multi-vertical marketplace that supports both transactional
checkout and direct seller contact for products.

## Capabilities and Constraints

- The storefront and seller hub use Preact and consume MercurJS Store and Vendor
  APIs.
- Buyer and seller-member authentication are separate; seller operations are
  scoped by the backend to the authenticated member's selected seller.
- Product and seller actions depend on marketplace state and permissions
  returned or enforced by the backend.
- No visual brand system or logo has been confirmed.

## Evidence on Hand

- Product scope and intended buyer/seller workflows are documented in
  `openspec/changes/mercurjs-generic-marketplace/proposal.md` and its specs.
- No approved brand assets, customer testimonials, or performance claims have
  been provided.

## Product Principles

- Keep the marketplace usable across product verticals.
- Make buyer checkout and direct-contact paths explicit.
- Keep buyer and seller identities distinct and protect private data.
- Treat the backend as the authority for access and marketplace state.
