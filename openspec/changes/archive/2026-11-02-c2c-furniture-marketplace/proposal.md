# Proposal

## Why

El proyecto actual cuenta únicamente con el boilerplate inicial de Go + PocketBase y Preact + Vite, sin esquema de datos, lógica de negocio ni vistas del marketplace. Se necesita construir la arquitectura completa de un portal de anuncios clasificados de muebles C2C para Costa Rica (inspirado en `mueblesusados.cr`) que combine la agilidad de una SPA en Preact con inyección dinámica de metadatos SEO/OpenGraph y JSON-LD desde el binario de Go (PocketBase), manteniendo un despliegue portable de binario único.

## What Changes

- **Esquema de Colecciones y Reglas de Acceso en PocketBase**: Configuración programática/migraciones en Go para extender `users` (`phone`, `province`) y crear las colecciones `categories` (con seeder inicial de 11 categorías), `listings` (con validación, miniaturas `300x300f` y `800x600f`, estados, precios en CRC `₡` y reglas de seguridad) y `favorites` (con índice único compuesto `user` + `listing`).
- **Hooks de Seguridad y Endpoint de Vistas en Go**: Hooks `OnRecordCreateRequest` / `OnRecordUpdateRequest` para `listings` que fuerzan `seller = authRecord.Id` y generan un `slug` limpio; endpoint `POST /api/listings/{id}/view` para incremento atómico de vistas sin exigir permisos de edición sobre el anuncio.
- **Servidor SPA con Inyección Dinámica SEO / OpenGraph / JSON-LD**: Handler en `app.OnServe()` que sirve el build de Preact e intercepta `/anuncio/{id}` y `/mueble/{id}` para inyectar en memoria `<title>`, `<meta name="description">`, etiquetas OpenGraph (`og:title`, `og:description`, `og:image`, `og:url`, `og:type`) y `<script type="application/ld+json">` de tipo `Product` (`priceCurrency: "CRC"`, `offers`, `itemCondition`), con fallback SPA para el resto de rutas.
- **Cliente PocketBase y Estado Reactivo en Preact**: Configuración de `src/lib/pb.ts` con el SDK `pocketbase` y `@preact/signals` para gestionar sesión de usuario (`pb.authStore`), autenticación por correo/contraseña y OAuth2 (Google/Facebook), y sincronización reactiva de favoritos.
- **Vistas y Ruteo del Marketplace C2C**: Implementación de las rutas y vistas en Preact con Vanilla CSS moderno:
  - Home (`/`) con buscador hero, anuncios recientes, conteo de muebles por las 7 provincias de Costa Rica y sección "Lo Más Visto".
  - Explorar (`/explorar`) con filtros combinables sincronizados con query params y paginación.
  - Detalle del Mueble (`/anuncio/:id`) con galería de fotos, contacto directo por WhatsApp (`https://wa.me/506{telefono}`), botón de favoritos y anuncios relacionados.
  - Publicación y Edición (`/anunciar`, `/editar/:id`) con previsualización de múltiples imágenes y rutas protegidas.
  - Panel de Favoritos (`/favoritos`) y Mis Anuncios (`/mis-anuncios`) para marcar anuncios como vendidos, pausarlos o eliminarlos.

## Capabilities

### New Capabilities
- `data-schema-and-access`: Esquema de colecciones de PocketBase (`users`, `categories`, `listings`, `favorites`), API Rules, seeder de categorías iniciales y hooks de integridad de anuncios (`seller` y `slug`).
- `seo-and-spa-server`: Servidor HTTP en Go (`app.OnServe()`) para servir la SPA compilada, inyectar dinámicamente metadatos SEO/OpenGraph/JSON-LD en rutas de anuncios (`/anuncio/{id}`, `/mueble/{id}`) e incrementar vistas de anuncios de forma atómica (`POST /api/listings/{id}/view`).
- `frontend-auth-and-state`: Cliente singleton de PocketBase (`src/lib/pb.ts`), store reactivo de autenticación y favoritos con `@preact/signals`, vistas/modales de Login y Registro (Email/Password + OAuth2) y protección de rutas.
- `frontend-catalog-and-listings`: Ruteo SPA y vistas de usuario para Home (`/`), Explorar (`/explorar`), Detalle del Anuncio (`/anuncio/:id`) con integración de WhatsApp, Publicar/Editar (`/anunciar`, `/editar/:id`), Favoritos (`/favoritos`) y Mis Anuncios (`/mis-anuncios`).

### Modified Capabilities
<!-- Ninguna capacidad existente se modifica ya que el proyecto no cuenta con especificaciones previas. -->

## Impact

- **Backend Go (`main.go`, `go.mod`, migraciones/hooks)**: Actualización e integración directa de `github.com/pocketbase/pocketbase`, creación de estructura modular para migraciones/seeding, hooks de registros y middleware/handler de servidor SPA con reemplazo de placeholders SEO.
- **Frontend Preact (`package.json`, `vite.config.ts`, `index.html`, `src/`)**: Adición de dependencias `pocketbase`, `@preact/signals` y `preact-iso` (o `preact-router`); adición de marcadores SEO/JSON-LD en `index.html`; reemplazo de la plantilla demo de Vite por la arquitectura completa de vistas, componentes y estilos del marketplace.
- **Build & Despliegue**: Configuración del flujo de compilación de Vite (`dist` / `pb_public`) para ser servido directamente por el binario de PocketBase.
