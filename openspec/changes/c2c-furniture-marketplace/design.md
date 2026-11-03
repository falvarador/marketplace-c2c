# Design

## Context

El workspace actual en `/Users/falvarador/Development/Projects/marketplace-c2c` contiene un proyecto híbrido en su estado inicial (boilerplate):
- **Backend Go (`go.mod`, `main.go`)**: Configurado con `module marketplace-c2c` y `github.com/pocketbase/pocketbase` (actualmente `v0.40.6` en `go.mod`, API de serie `v0.23+`/`v0.40+` basada en `core.App`, `core.ServeEvent`, `core.NewBaseCollection`, y `core.RecordRequestEvent`). `main.go` únicamente levanta `pocketbase.New()` y sirve `./pb_public` en `/{path...}`.
- **Frontend Preact (`package.json`, `vite.config.ts`, `index.html`, `src/`)**: Configurado con Preact (`^11.0.2`), `@preact/preset-vite` y Vite (`^8.3.5`). Aún no tiene instaladas las dependencias `pocketbase`, `@preact/signals` ni un router (`preact-iso`), y `src/app.tsx` contiene el contador de demostración de Vite.

Ver `proposal.md` para la motivación del proyecto y `specs/` para los requerimientos detallados.

## Goals / Non-Goals

**Goals:**
- Mantener un despliegue portable y autocontenido: Vite compila hacia `pb_public` (o `dist` embebido/servido por PocketBase) y el binario de Go sirve tanto la API de PocketBase como la SPA con inyección dinámica de SEO/OpenGraph/JSON-LD.
- Garantizar la inicialización idempotente del esquema de colecciones (`users`, `categories`, `listings`, `favorites`) y el seed de las 11 categorías al iniciar el servidor (`OnBootstrap` / migraciones programáticas).
- Asegurar que los crawlers de redes sociales (WhatsApp, Facebook, Google) reciban HTML enriquecido con `<meta property="og:*">` y `<script type="application/ld+json">` de tipo `Product` al compartir enlaces `/anuncio/{id}` o `/mueble/{id}` sin necesidad de SSR en Node.js.
- Ofrecer una interfaz rápida y responsiva en Preact + Vanilla CSS moderno inspirada en un portal clasificado de muebles para Costa Rica.

**Non-Goals:**
- Pasarela de pagos en línea o carrito de compras (el modelo es C2C clasificado con contacto directo vía WhatsApp).
- Renderizado de componentes Preact en el servidor (Node SSR); el SEO se resuelve exclusivamente mediante inyección en memoria de metadatos y JSON-LD en el `index.html` desde Go.
- Chat interno dentro de la plataforma (la comunicación comprador-vendedor se realiza vía enlace profundo a WhatsApp `wa.me/506...`).

## Decisions

### 1. Inicialización Programática del Esquema y Seeder en Go (`internal/setup` o `migrations`)
- **Decisión**: Registrar un hook en `app.OnBootstrap()` (o migración programática ejecutada al arranque después de `be.Next()`) que inspeccione y asegure la existencia de los campos adicionales en `users` (`phone`, `province`), las colecciones `categories`, `listings` y `favorites`, sus reglas de acceso (`ListRule`, `ViewRule`, `CreateRule`, `UpdateRule`, `DeleteRule`), y el seeder idempotente de las 11 categorías iniciales.
- **Racional**: Con la API moderna de PocketBase (`core.NewBaseCollection`, `&core.TextField{}`, `&core.NumberField{}`, `&core.SelectField{}`, `&core.RelationField{}`, `&core.FileField{}`), aseguramos que cualquier entorno (desarrollo o producción con `pb_data` limpio o existente) converja automáticamente al esquema requerido sin pasos manuales en el Admin UI.
- **Alternativas consideradas**: Archivos de migración autogenerados desde el Admin UI. Se descartó como único mecanismo porque requiere intervención manual previa y dificulta la reproducibilidad inmediata desde código fuente.

### 2. Exposición del Teléfono del Vendedor para el Botón de WhatsApp
- **Decisión**: En la colección `users`, asegurar que `ViewRule` sea pública (`types.Pointer("")`) o que el campo `phone` y `name` sean legibles al hacer `expand=seller` desde una consulta de `listings` activa (`pb.collection('listings').getOne(id, { expand: 'category,seller' })`).
- **Racional**: En PocketBase, los campos `email` tienen visibilidad protegida por defecto (`EmailVisibility`), mientras que campos personalizados como `name`, `phone` y `province` se incluyen en el `expand: "seller"` únicamente si la regla `ViewRule` de `users` permite su lectura (`""`). Esto permite construir el enlace `https://wa.me/506{telefono}` directamente en el detalle del anuncio sin exponer el correo privado del vendedor.

### 3. Inyección Dinámica de Meta Tags y Schema.org `Product` JSON-LD en Go
- **Decisión**: Definir marcadores explícitos en `index.html`:
  - `<!--__SEO_TITLE__-->` dentro de `<title>`
  - Metadatos con marcadores o reemplazo del bloque `<!--__SEO_META__-->` y `<!--__SEO_JSONLD__-->` en `<head>`
  En Go (`app.OnServe()`), leer la plantilla `index.html` desde el directorio de build (`pb_public/index.html` o `dist/index.html`) y:
  1. Para peticiones `GET /anuncio/{id}` y `GET /mueble/{id}`, buscar el registro en `listings` por ID o por `slug = {:id}` (con `expand` de categoría). Si existe y `status == "active"`, construir las cadenas escapadas con `html.EscapeString` y serializar con `encoding/json` el objeto `Product` JSON-LD (`@context: "https://schema.org"`, `@type: "Product"`, `name`, `description`, `image`, `itemCondition`, `offers: { @type: "Offer", priceCurrency: "CRC", price, availability: "https://schema.org/InStock", url }`).
  2. Para cualquier otra ruta que no comience con `/api/` ni `/_/` y no corresponda a un archivo estático existente en `pb_public`, devolver el `index.html` con los valores SEO por defecto del portal.
- **Racional**: Reemplazar marcadores en memoria en Go toma microsegundos, evita dependencias de Node.js en producción y garantiza que WhatsApp, Facebook e indexadores de búsqueda obtengan la foto (`?thumb=800x600f`), precio en `₡` y datos estructurados exactos.

### 4. Contador Atómico de Vistas (`POST /api/listings/{id}/view`)
- **Decisión**: Registrar `se.Router.POST("/api/listings/{id}/view", ...)` en `app.OnServe()`. Utilizar una sentencia SQL atómica vía `app.DB().NewQuery("UPDATE listings SET views = COALESCE(views, 0) + 1 WHERE id = {:id} AND status = 'active'")` (o actualización directa sin pasar por las API Rules de usuario) para incrementar `views` de forma segura ante concurrencia.
- **Racional**: Las API Rules de `listings` restringen `UpdateRule` a `@request.auth.id = seller.id`. Un endpoint dedicado permite que cualquier visitante incremente únicamente el contador `views` de forma atómica sin abrir permisos de escritura sobre el registro completo.

### 5. Arquitectura Frontend Preact (`preact-iso` + `@preact/signals` + `pocketbase`)
- **Decisión**:
  - Configurar `vite.config.ts` con `build.outDir = 'pb_public'` (y `emptyOutDir: true`) más proxy de desarrollo (`/api` y `/_` hacia `http://127.0.0.1:8090`) para que tanto `npm run build` + `./marketplace-c2c serve` como `npm run dev` funcionen sin fricción.
  - Utilizar `preact-iso` (ligero y oficial del ecosistema Preact) para ruteo declarativo (`LocationProvider`, `Router`, `Route`, `useLocation`) y `@preact/signals` para estado global reactivo en `src/lib/pb.ts` (`currentUser`, `favoriteIds`, funciones de toggle de favoritos y helpers de formato de moneda `₡` e imágenes de PocketBase).
- **Racional**: `preact-iso` y `@preact/signals` son paquetes oficiales de Preact compatibles con Preact 11, con huella mínima de bundle y excelente ergonomía para sincronizar query params en `/explorar`.

## Estructura de Archivos Propuesta

```text
marketplace-c2c/
├── main.go                       # Entrypoint PocketBase: bootstrap schema/seed, hooks listings, endpoint views y servidor SPA + SEO
├── internal/
│   ├── schema/
│   │   └── collections.go        # Migración programática idempotente (users, categories, listings, favorites) + seed de categorías
│   ├── hooks/
│   │   └── listings.go           # Hooks OnRecordCreateRequest / OnRecordUpdateRequest (forzar seller y generar slug)
│   └── server/
│       └── seo_spa.go            # Handler POST /api/listings/{id}/view + servidor estático e inyección SEO/OG/JSON-LD en index.html
├── index.html                    # Shell HTML con placeholders SEO/OpenGraph y JSON-LD
├── vite.config.ts                # OutDir a pb_public + proxy /api hacia PocketBase local en desarrollo
└── src/
    ├── main.tsx                  # Punto de entrada Preact
    ├── app.tsx                   # Layout principal (Navbar, Footer, AuthModal) y Router (preact-iso)
    ├── index.css                 # Sistema de diseño Vanilla CSS moderno (variables, grid, tarjetas, badges, formularios, responsivo)
    ├── lib/
    │   ├── pb.ts                 # Singleton PocketBase, signals (auth, favorites, categories), helpers de URLs/thumbs y formato CRC ₡
    │   └── constants.ts          # Constantes de Provincias de CR, Espacios, Condiciones y Categorías
    ├── components/
    │   ├── Navbar.tsx            # Navegación, contador de favoritos, acceso a publicar y sesión
    │   ├── Footer.tsx            # Pie de página del portal C2C Costa Rica
    │   ├── ListingCard.tsx       # Tarjeta reutilizable de mueble (thumb 300x300f, badge condición, precio ₡, favorito)
    │   └── AuthModal.tsx         # Modal/Vista de Login y Registro con Email/Password + OAuth2 (Google y Facebook)
    └── pages/
        ├── Home.tsx              # Hero buscador, Anuncios Recientes, Muebles por Provincia (7 provincias) y Lo Más Visto
        ├── Explore.tsx           # Catálogo con filtros combinables sincronizados con query params y paginación
        ├── ListingDetail.tsx     # Galería 800x600f/300x300f, detalle completo, botón WhatsApp (+506), favoritos y relacionados
        ├── ListingForm.tsx       # Crear (/anunciar) y Editar (/editar/:id) con previsualización de hasta 8 fotos
        ├── Favorites.tsx         # Listado de anuncios guardados por el usuario (/favoritos)
        └── MyListings.tsx        # Gestión de anuncios del vendedor (/mis-anuncios): marcar vendido, pausar, editar, eliminar
```

## Risks / Trade-offs

- **[Risk] Conteo de anuncios por provincia en el Home podría requerir múltiples consultas si hay miles de registros** → **Mitigación**: Realizar una consulta ligera de anuncios activos solicitando únicamente `fields: "id,province"` (con `perPage: 500` o conteo agrupado) para agregar en el cliente o exponer los totales de las 7 provincias de forma instantánea.
- **[Risk] Configuración de proveedores OAuth2 (Google/Facebook) requiere credenciales de cliente en PocketBase** → **Mitigación**: El frontend invocará `pb.collection('users').authWithOAuth2({ provider })` y manejará amigablemente errores informando si el proveedor OAuth2 aún no tiene `clientId`/`clientSecret` configurados en el panel de administración de PocketBase, manteniendo el login/registro con Email y Contraseña siempre operativo.
- **[Risk] Desfase entre `index.html` de desarrollo y `pb_public/index.html` de producción** → **Mitigación**: El handler de Go buscará primero `pb_public/index.html` (generado por `npm run build`) y hará fallback a `./index.html` si aún no se ha compilado el frontend, evitando errores `404` durante pruebas del backend.

## Migration Plan

1. Ejecutar la actualización de dependencias e implementación del paquete `internal/schema`, `internal/hooks` y `internal/server` en Go.
2. Instalar `pocketbase`, `@preact/signals` y `preact-iso` en el frontend; implementar `src/lib/pb.ts`, componentes y vistas.
3. Compilar el frontend con `npm run build` (que genera `pb_public/`) y compilar el binario de Go (`go build -o marketplace-c2c .`).
4. Al iniciar `./marketplace-c2c serve`, PocketBase aplicará automáticamente las colecciones, reglas y categorías iniciales sobre `pb_data`.
