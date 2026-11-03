# 🪑 C2C Marketplace

A lightweight Customer-to-Customer (C2C) classifieds web platform for buying something that you want.

Engineered around an ultra-lightweight architecture that combines the snappy user experience of a **Preact SPA** with the portability of **PocketBase extended as a Go framework**. The entire platform compiles into a single self-contained binary without sacrificing search engine optimization (SEO) or rich link previews on WhatsApp and social media.

---

## 🚀 Key Features

* **Advanced Catalog & Filtering:** Instant filtering by keyword, category, item condition (*New, Like New, Used*), home space, price in Costa Rican Colones (`₡`), and location across all 7 provinces of Costa Rica.
* **Dynamic SEO & OpenGraph without Node.js:** Custom Go middleware intercepts listing routes (`/anuncio/:id`) and injects dynamic OpenGraph `<meta>` tags and **`Product` JSON-LD** structured data directly into `index.html` in under 1 ms—ensuring rich social previews on WhatsApp/Facebook and full Google indexing.
* **Self-Service Listing Management:** Complete workflow for sellers to upload multiple images with automatic on-the-fly thumbnail generation (`300x300` and `800x600`), update item statuses (*Active, Paused, Sold*), and manage their active inventory.
* **Direct WhatsApp Conversion:** Built-in WhatsApp lead generation with pre-filled messages containing the item's title, reference ID, and direct link.
* **Authentication & Fine-Grained Security:** Email/password and OAuth2 login (Google / Facebook) protected by database-level *API Rules*, ensuring users can only modify their own listings and private favorites list.
* **Single Portable Binary:** The compiled Preact frontend is embedded directly into the Go binary (`embed.FS`), running the API, SQLite database (WAL mode), image storage, moderation backoffice, and SPA inside a single process using under 40 MB of RAM.

---

## 🛠️ Tech Stack

| Layer | Technology | Architectural Role |
| :--- | :--- | :--- |
| **Backend & Core** | **Go (Golang)** + **PocketBase (v0.23+)** | HTTP server, business hooks, SEO meta injection, and REST/Realtime API. |
| **Database** | **SQLite (WAL mode)** | High-performance embedded relational persistence. |
| **Frontend** | **Preact** + **Vite** + **TypeScript** | Fast, lightweight reactive SPA interface (~3kB core). |
| **State & Routing** | **`@preact/signals`** + **`preact-iso`** | Fine-grained reactive state management (Auth/Favorites) and client-side routing. |

---

## 📂 Project Structure

```text
├── backend/                  # Go + PocketBase project
│   ├── migrations/           # Collection schemas (listings, categories, favorites)
│   ├── seo/                  # OpenGraph and JSON-LD injection middleware
│   ├── pb_data/              # SQLite database and uploaded media (git-ignored)
│   ├── main.go               # Entry point, custom hooks, and embedded static server
│   └── go.mod
├── frontend/                 # Preact SPA application
│   ├── src/
│   │   ├── components/       # Reusable UI components (Cards, Filters, Gallery)
│   │   ├── pages/            # Route views (Home, Explore, Listing Detail, Publish, Profile)
│   │   ├── lib/              # PocketBase SDK singleton and Signals stores
│   │   └── main.tsx
│   ├── index.html            # Base HTML template with SEO injection placeholders
│   └── package.json
└── README.md