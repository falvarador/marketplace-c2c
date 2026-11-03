# Tasks

## 1. Fase 1: Ajuste de Estructura y Configuración Base (Go + Vite)

- [ ] 1.1 Actualizar `go.mod` para declarar `github.com/pocketbase/pocketbase` como dependencia directa y crear los paquetes `internal/schema`, `internal/hooks` e `internal/server`, verificando que `go mod tidy` finalice sin errores
- [ ] 1.2 Instalar las dependencias de frontend (`pocketbase`, `@preact/signals`, `preact-iso`) en `package.json` y configurar `vite.config.ts` con salida a `pb_public` y proxy de desarrollo `/api` hacia `http://127.0.0.1:8090`, verificando que `npm install` complete correctamente
- [ ] 1.3 Actualizar `index.html` con idioma `es`, título base del marketplace y los marcadores placeholder para `<title>`, `<meta name="description">`, etiquetas OpenGraph (`og:title`, `og:description`, `og:image`, `og:url`, `og:type`) y el bloque `<script type="application/ld+json">`, verificando la presencia de los placeholders en el HTML

## 2. Fase 2: Backend en Go (Colecciones, Seeder, Hooks y Servidor SEO/SPA)

- [ ] 2.1 Implementar en `internal/schema/collections.go` la configuración programática idempotente de las colecciones `users` (con `phone` y `province`), `categories`, `listings` (con validaciones, miniaturas `300x300f` y `800x600f` y API Rules) y `favorites` (con índice único compuesto `user, listing` y API Rules), más el seeder de las 11 categorías iniciales, verificando con pruebas en Go (`internal/schema/collections_test.go`) que las colecciones y las 11 categorías se creen correctamente
- [ ] 2.2 Implementar en `internal/hooks/listings.go` los hooks `OnRecordCreateRequest` y `OnRecordUpdateRequest` para `listings` que fuercen `seller = authRecord.Id`, asignen `status = "active"` por defecto si está vacío y generen un `slug` limpio con el título e ID, verificando su comportamiento mediante pruebas unitarias en Go
- [ ] 2.3 Implementar en `internal/server/seo_spa.go` el endpoint `POST /api/listings/{id}/view` para incremento atómico de `views` y el handler SPA que sirve `pb_public` e inyecta en memoria los metadatos SEO, OpenGraph (`?thumb=800x600f`) y JSON-LD (`@type: "Product"`, `priceCurrency: "CRC"`, `offers`, `itemCondition`) en `/anuncio/{id}` y `/mueble/{id}`, verificando con pruebas HTTP en Go tanto el incremento de vistas como la respuesta HTML enriquecida
- [ ] 2.4 Integrar `schema`, `hooks` y `server` dentro de `main.go` y verificar que `go test ./...` y `go build -o marketplace-c2c .` compilen y pasen todas las pruebas sin errores

## 3. Fase 3: Cliente PocketBase, Estado Reactivo y Autenticación en Preact

- [ ] 3.1 Crear `src/lib/constants.ts` (provincias de Costa Rica, condiciones, espacios, categorías) y `src/lib/pb.ts` con la instancia singleton de PocketBase, signals reactivos (`currentUser`, `favoriteMap`, `categoriesList`, `authModalOpen`), helpers de sincronización de favoritos y formateador de precios en Colones (`₡`), verificando que `npx tsc -b` compile sin errores de tipos
- [ ] 3.2 Implementar los componentes globales `src/components/Navbar.tsx`, `src/components/Footer.tsx`, `src/components/ListingCard.tsx` y `src/components/AuthModal.tsx` (con soporte para Login/Registro por correo/contraseña y botones OAuth2 para Google y Facebook con `pb.collection('users').authWithOAuth2`), verificando la compilación TypeScript

## 4. Fase 4: Vistas del Catálogo, Detalle con WhatsApp, Publicación y Gestión

- [ ] 4.1 Implementar la vista `src/pages/Home.tsx` (`/`) con Hero buscador rápido (palabra clave, Categoría, Estado, Espacio y Provincia), sección "Anuncios Recientes", sección "Muebles por Provincia" con conteo para las 7 provincias de Costa Rica y sección "Lo Más Visto" (ordenado por `-views`), verificando su renderizado y enlaces hacia `/explorar`
- [ ] 4.2 Implementar la vista `src/pages/Explore.tsx` (`/explorar`) con filtros combinables en tiempo real sincronizados con los query params de la URL (`q`, `categoria`, `condicion`, `espacio`, `provincia`, `orden`) y paginación / "Cargar más" vía `pb.collection('listings').getList(...)`, verificando que los cambios de filtro actualicen la URL y la consulta
- [ ] 4.3 Implementar la vista `src/pages/ListingDetail.tsx` (`/anuncio/:id` y `/mueble/:id`) con incremento automático de vista (`POST /api/listings/{id}/view`), galería de imágenes (`800x600f` y miniaturas `300x300f`), información completa en `₡`, botón "Contactar por WhatsApp" (`https://wa.me/506{telefono}` con mensaje prellenado), botón de Favoritos y "Anuncios Relacionados", verificando la estructura del enlace de WhatsApp y la galería
- [ ] 4.4 Implementar las vistas protegidas `src/pages/ListingForm.tsx` (`/anunciar` y `/editar/:id`, con carga y previsualización de hasta 8 imágenes), `src/pages/Favorites.tsx` (`/favoritos`) y `src/pages/MyListings.tsx` (`/mis-anuncios`, con acciones para marcar como "Vendido", pausar/activar, editar o eliminar), verificando la protección de rutas para usuarios no autenticados
- [ ] 4.5 Conectar todas las rutas en `src/app.tsx`, diseñar el sistema de estilos responsivos en `src/index.css` (Vanilla CSS moderno adaptado a un portal de muebles de Costa Rica) y verificar que `npm run build` genere `pb_public/` y que el binario `./marketplace-c2c` sirva correctamente la aplicación completa
