---
name: Mercur Marketplace
description: A civic route system for exploring Mercur and choosing a buyer or seller path.
colors:
  primary: "#2463eb"
  primary-hover: "#174fcf"
  secondary: "#ddf23b"
  secondary-hover: "#cce327"
  neutral-bg: "#edf3f5"
  neutral-ink: "#112a3a"
  neutral-white: "#ffffff"
  neutral-muted: "#3d5664"
  neutral-line: "#c5d3d9"
  error: "#a32332"
  success: "#235a34"
  seller-route-line: "#b7cf17"
  map-connector: "#8fa4af"
  seller-stop: "#91a900"
  seller-accent: "#9bad00"
  input-border: "#9db0b9"
typography:
  display:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    fontSize: "3.15rem"
    fontWeight: 760
    lineHeight: 1.02
    letterSpacing: "-0.055em"
  display-medium:
    fontSize: "2.8rem"
  page-title:
    fontSize: "2.7rem"
  page-title-mobile:
    fontSize: "2.65rem"
  route-title:
    fontSize: "2.45rem"
  route-title-mobile:
    fontSize: "2.35rem"
  status-title:
    fontSize: "2.3rem"
  compact-title:
    fontSize: "2rem"
  brand:
    fontSize: "1.15rem"
  section-title:
    fontSize: "1.12rem"
  body:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    fontSize: "1rem"
    fontWeight: 400
  body-large:
    fontSize: "1.06rem"
  body-reading:
    fontSize: "1.02rem"
  body-small:
    fontSize: "0.98rem"
  body-compact:
    fontSize: "0.92rem"
  label:
    fontSize: "0.9rem"
  label-small:
    fontSize: "0.88rem"
  form-label:
    fontSize: "0.86rem"
  navigation-label:
    fontSize: "0.82rem"
  footnote:
    fontSize: "0.78rem"
  footer-label:
    fontSize: "0.77rem"
  supporting-label:
    fontSize: "0.76rem"
  breadcrumb-label:
    fontSize: "0.75rem"
  map-label:
    fontSize: "0.7rem"
rounded:
  sm: "0.4rem"
  pill: "999px"
  route: "1.25rem"
  route-cap: "4rem"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.neutral-white}"
    rounded: "{rounded.pill}"
    padding: "0.7rem 1.2rem"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-seller:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.neutral-ink}"
    rounded: "{rounded.pill}"
    padding: "0.7rem 1.2rem"
  button-seller-hover:
    backgroundColor: "{colors.secondary-hover}"
---

# Design System: Mercur Marketplace

## Overview

**Creative North Star: “The Mercur Route Map”**

Mercur uses a civic transit diagram to make its buyer and seller journeys easy
to distinguish. Cool paper and navy ink establish a calm, legible base; blue
marks the buyer route and lime marks the seller route. Flat lines, outlined
stops, and a shared transfer node turn navigation into a visible choice of
paths, not a claim about geographic search.

The interface is typographic and intentionally light on ornament. A compact
brand mark, clear route labels, and generous open space keep the paths readable
across the public entry, account access, and seller entry views. Buyer and
seller actions retain their own route colors rather than merging into one
undifferentiated call to action.

**Key Characteristics:**
- Civic route-map geometry and transfer nodes
- Cool paper, navy ink, buyer blue, and seller lime
- System sans typography with strong, compact headings
- Pill-shaped primary actions and mostly flat surfaces

## Colors

The palette pairs a cool paper-and-ink foundation with two route accents and
distinct status colors.

### Primary
- **Buyer route blue** (`colors.primary`): The primary buyer action, route marks, active navigation indicator, links, and buyer-focused form accents.

### Secondary
- **Seller route lime** (`colors.secondary`): Seller actions, route stops, membership markers, and seller-focused accents.

### Neutral
- **Cool paper** (`colors.neutral-bg`): The page and outlined route-node background.
- **Navy ink** (`colors.neutral-ink`): Primary text, the seller route's foreground, and dark route geometry.
- **White** (`colors.neutral-white`): Map and input surfaces, and text on the primary blue action.
- **Muted ink** (`colors.neutral-muted`): Supporting copy, labels, and secondary navigation.
- **Map line** (`colors.neutral-line`): Dividers, borders, and route connectors.
- **Error red** (`colors.error`): Error-state route nodes and form messages.
- **Success green** (`colors.success`): Confirmation messages after a buyer or seller action.

### Named Rules
**The Two-Route Rule.** Keep buyer actions on the blue route and seller actions on the lime route; use navy ink and paper for shared structure.

## Typography

**Display Font:** System sans (`ui-sans-serif`, system UI, Apple system, BlinkMacSystemFont, Segoe UI, sans-serif)  
**Body Font:** The same system sans stack  
**Label/Mono Font:** No distinct label or monospace family is defined.

**Character:** Neutral, native-feeling sans typography keeps the interface direct and readable. Headings use tight line spacing and tracking; labels and supporting copy remain compact without switching type families.

### Hierarchy
- **Display** (weight 760, 3.15rem, line-height 1.02): The home-page headline; its size reduces on narrower screens and on route pages.
- **Headline** (weight 760, 2.7rem in authentication views and 2.45rem in seller selection): Route-specific page titles.
- **Body** (weight 400, 1rem on authentication copy, line-height 1.58): Explanatory text, with narrower measure for comfortable reading.
- **Label** (weight 600–650, 0.82–0.9rem): Navigation, route labels, and form labels.

## Layout

The storefront uses a centered content frame capped at 76rem, with three-rem desktop gutters and two-rem gutters on small screens. The header aligns the brand, route navigation, and account actions; the footer repeats the brand and seller entry link.

The home view pairs a text-led introduction with a route map in a two-column grid, then places three route links in a horizontal strip. Below 680px, the introduction stacks above the map, the strip becomes a vertical list, and authentication and onboarding layouts become single-column. Header navigation stays on one horizontally scrollable row on small screens. Content pages use a breadcrumb-like route trail, a clear title, and one main content region.

## Elevation & Depth

Surfaces are flat at rest; depth comes from paper/white contrast, fine borders, and the route geometry rather than elevated cards. The focus treatment uses a visible two-tone ring, and the active route marker has a soft halo. Hover responses are small color or position changes, not persistent shadow elevation.

## Shapes

Most controls use gently rounded corners: compact inputs and markers use the small radius, while standard buttons are fully pill-shaped. The route map is the signature exception, with a large asymmetric top-right corner. Thin strokes, circular stops, and outlined transfer nodes keep the map language consistent; content areas rely on dividers instead of enclosing every element in a card.

## Components

### Buttons
- **Character:** Compact, high-contrast route actions with a pill silhouette.
- **Shape:** Fully rounded (`rounded.pill`); standard actions have a 2.9rem minimum height and 0.7rem by 1.2rem padding.
- **Primary:** Buyer actions use buyer blue with white text.
- **Seller:** Seller actions use lime with navy text.
- **Hover / Focus:** Hover shifts each route color and lifts the button by one pixel. Keyboard focus receives the shared visible focus ring.
- **Quiet:** Transparent navy text with a fine border; hover strengthens the border and adds a white surface.
- **Disabled:** Reduced opacity; pending buttons show a wait cursor.

### Inputs / Fields
- **Style:** White fill, a fine blue-gray border, compact rounded corners, and navy text; labels sit above each field.
- **Focus:** Use the shared visible focus ring so keyboard focus is clear without relying on color alone.
- **Error / Disabled:** Form errors use the error color and are announced as alerts. Disabled submit controls use the shared disabled treatment.

### Marketplace Operations
- **Catalog and item views:** Use flat white or paper surfaces, fine dividers, and the compact radius; product imagery supplies the visual emphasis.
- **Seller and account views:** Favor readable lists and inline task feedback over nested cards; buyer actions remain blue and seller actions remain lime.

### Navigation
- **Style:** The header uses understated text links with a blue underline for the current route; hover and active states strengthen the text color.
- **Route trail:** Inner pages show a linked home stop, a thin connector, and the current page label.
- **Mobile:** Main navigation becomes a horizontally scrollable row beneath the brand and account actions.

### Route Map
- **Character:** A flat map of distinct paths converging at a lime transfer node.
- **Geometry:** Solid blue, ink, and lime lines connect circular stops; a thin dashed connector is secondary. Stop labels are white, fine-bordered links.
- **Behavior:** The labeled Explore, Account, and Seller stops link to their corresponding storefront routes. Keep this diagrammatic rather than geographic.

## Do's and Don'ts

### Do:
- **Do** use the paper-and-ink palette as the shared foundation and preserve the blue buyer / lime seller distinction.
- **Do** make route choices explicit with labels, link affordances, and transfer-node geometry.
- **Do** keep surfaces mostly flat and use borders, dividers, and tonal contrast to organize content.
- **Do** preserve visible keyboard focus and the reduced-motion behavior already used by the interface.

### Don't:
- **Don't** use the route diagram to imply geographic search or location coverage.
- **Don't** merge buyer and seller actions into a single route color.
- **Don't** add heavy card shadows or decorative gradients that compete with the route lines.
- **Don't** substitute a display or monospace font for the system sans stack.
