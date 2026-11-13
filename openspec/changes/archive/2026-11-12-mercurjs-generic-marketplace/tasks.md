# Tasks

## 1. Fase 1: Diagnóstico y arquitectura

- [x] 1.1 Inspeccionar `package.json`, `go.mod`, `main.go`, `vite.config.ts`, `index.html` y `src/`; verificar que el backend existente es Go/PocketBase, el frontend es un starter Preact/Vite y no hay MercurJS/Medusa instalado.
- [x] 1.2 Contrastar la arquitectura y las rutas nativas de Mercur con su documentación vigente; verificar en `design.md` el mapa de módulos, la separación entre rutas `/store` y `/vendor`, y las extensiones requeridas.
- [x] 1.3 Registrar decisiones de alcance de esta fase: catálogo Mercur limpio, solicitudes de contacto y reserva autenticadas, y reserva sujeta a confirmación del vendedor; verificar su reflejo en las especificaciones.

## 2. Fase 2: Configuración Backend MercurJS

- [x] 2.1 Convertir el root en workspace npm y crear `apps/api` con versiones compatibles de Medusa y Mercur, `medusa-config.ts` con `withMercur()`, y configuración PostgreSQL/Redis por entorno; verificar instalación, type-check y arranque contra una base vacía.
- [x] 2.2 Implementar el estado de aprobación del vendedor, asociación miembro-vendedor, flujo administrativo de aprobación y guardas para visibilidad/publicación; verificar con pruebas que `pending` y `suspended` no publican ni aceptan transacciones y que `active` sí puede hacerlo.
- [x] 2.3 Configurar categorías jerárquicas y atributos dinámicos tipados por categoría, más ubicación universal y disponibilidad de stock único/variantes; verificar creación, validación de valores y consultas facetadas con pruebas de integración.
- [x] 2.4 Implementar la configuración de modo de transacción por defecto/plataforma y override de categoría, más flujos de lead y reserva atómica con confirmación/declinación del vendedor; verificar conflictos concurrentes y liberación de inventario con pruebas.
- [x] 2.5 Conectar las rutas nativas Store/Vendor y añadir las rutas faltantes de wishlist, leads y solicitudes de reserva con autenticación y scoping; verificar acceso permitido/denegado, aislamiento entre vendedores y visibilidad privada mediante pruebas HTTP.
- [x] 2.6 Configurar regiones, monedas y proveedores mediante valores de entorno/configuración, documentar las variables requeridas y verificar que Store API expone la región/moneda configurada sin valores de Costa Rica codificados.
- [x] 2.7 Presentar los resultados, rutas y pruebas de la Fase 2, y esperar confirmación del usuario antes de comenzar la Fase 3; verificar que no se inició trabajo del storefront antes de esa aprobación.

## 3. Fase 3: Capa de datos y autenticación en Preact

- [x] 3.1 Crear `apps/storefront` con cliente `@mercurjs/client` y tipos de rutas generados; verificar que el build tipado cubre las llamadas Store y Vendor y no expone secretos administrativos.
- [x] 3.2 Implementar estado reactivo separado para sesión customer/member, vendedor seleccionado, carrito, wishlist y filtros; verificar restauración de sesión, logout y separación entre credenciales buyer/vendor con pruebas unitarias.
- [x] 3.3 Crear layout, navegación y protección de rutas de cuenta/vendedor en Preact; verificar navegación pública, onboarding autenticado y bloqueo UI para páginas privadas sin reemplazar la autorización backend.
- [x] 3.4 Presentar el flujo de autenticación y el layout de la Fase 3, y esperar confirmación del usuario antes de comenzar la Fase 4; verificar que no se inició la implementación del catálogo UI antes de esa aprobación.

## 4. Fase 4: Catálogo agnóstico y publicación

- [x] 4.1 Implementar `/explorar` con búsqueda, filtros facetados construidos desde categorías/atributos, precio, ubicación y paginación sincronizada con URL; verificar combinaciones de filtros y resultados con pruebas de componente.
- [x] 4.2 Implementar `/item/:handle` con media, variantes, atributos dinámicos, vendedor y acción de checkout/contacto/reserva; verificar que la acción corresponde al modo efectivo y que los errores de disponibilidad se muestran correctamente.
- [x] 4.3 Implementar `/vendedor/*` para onboarding, creación/edición/publicación de productos, subida de imágenes, atributos, variantes, inventario, modo permitido y teléfono WhatsApp requerido para checkout; verificar validación, conservación de entradas ante errores, aislamiento de vendedor y bloqueo de publicaciones sin contacto mediante pruebas.
- [x] 4.4 Implementar `/cuenta` y `/favoritos`, historial de order groups, leads y reservas, además de las vistas del vendedor para órdenes, confirmación manual de SINPE, fulfillment y solicitudes; verificar scoping y que el fulfillment permanece bloqueado hasta la confirmación de pago.
- [x] 4.5 Ejecutar pruebas end-to-end de compra con dos vendedores, órdenes pendientes de SINPE externo, enlaces WhatsApp, confirmación del vendedor, publicación con atributos dinámicos, wishlist, lead autenticado y reserva única confirmada/declinada; verificar split orders, comisión registrada sin cobro automático, scoping y disponibilidad de inventario.
- [x] 4.6 Documentar comandos de desarrollo/build, el arranque limpio Mercur/PostgreSQL y el pago externo SINPE sin procesador integrado; verificar `npm run build` y pruebas de integración desde el workspace nuevo con región de prueba Costa Rica/CRC.
- [x] 4.7 Presentar la Fase 4 y esperar confirmación del usuario antes de cualquier corte de tráfico o despliegue; verificar que el runtime PocketBase y su base SQLite siguen intactos hasta esa decisión.
