# Prompt maestro — cerrar la plataforma reutilizable

Copiá este bloque a un agente (o a un run de varios agentes). El objetivo es **terminar la plataforma**, no el editor de Horizon Fit.

## Contexto

`horizon-fit` es el repo de un **cliente**. La plataforma reutilizable vive en `feat/reusable-framework`. **Nunca merges a `main` ni deploys a producción de Horizon Fit.**

Ya existe el núcleo:

- `scripts/framework-store.mjs` — `build|refresh|backup|start|rebuild|status|stop|reset|seed|doctor`
- `framework/store.example.json` — Casa Sur (IDs de tracking vacíos)
- `mu-plugins/00-horizon-framework.php` + `mu-plugins/horizon-framework/`
  - identidad por tienda
  - webhook HMAC → rebuild de caché (payload solo identidad)
  - capabilities públicas vs diagnostics privilegiados
  - idempotencia de checkout (`absent → pending → done`)
- Storefront HTML estático + JSON cacheado; WooCommerce dueño de carrito, stock y checkout
- Tests: `tests/framework-tests.php`, `tests/framework-tracking-tests.mjs`, `tests/framework-cli-tests.mjs`

Patrones ya tomados de `modern-commerce` (no importar el monorepo ni Next.js): firma HMAC, capabilities vs diagnostics, idempotencia, reset a estado conocido, doctor que no imprime secretos.

## Qué falta para “plataforma completa”

Una segunda marca debe poder **publicarse** con `store.json` y no heredar nada de Horizon Fit: nombre, dominio, SEO, textos de envío/cuotas/cambios, redes, WhatsApp, newsletter, schema, sitemap, feed Merchant, GA4, Google Ads, Meta Pixel/CAPI.

Hoy, si `window.HF_STOREFRONT_CONFIG` existe, **todavía filtran** “Horizon Fit”, `horizonfit.com.ar`, cuotas 3/6, “envíos a todo el país”, Instagram/WhatsApp del cliente, en:

- `design-system/page-builder.js` (descripciones, checkout, alts, errores, categorías)
- `design-system/js/ga4.js` y `meta-pixel.js` (hostname gate + fallbacks)
- HTML: footer, navbar, trust-bar, PDP, lost-password, social-strip
- `storefront-seo-cache.php` (prerender/hero/contacto)
- `meta-conversions-api.php` (`event_source_url` hardcodeado)
- `newsletter.php` y defaults de info pages (parcialmente vaciados si hay config)

`store.example.json` no modela pagos, envío, redes ni políticas.

## Definición de hecho

1. Con `HF_STOREFRONT_CONFIG.name` (o `hf_framework_config()`), **cero** copys/URLs/schema/tracking de Horizon Fit en HTML, JSON, sitemap, feed o eventos.
2. Sin esa config, Horizon Fit producción **no cambia** (el fallback del cliente se conserva).
3. `store.json` es la única fuente de marca, dominio, SEO, tracking, Merchant, pagos visibles, envío, redes, WhatsApp, newsletter y páginas legales. Si un campo no está, queda **vacío** — no se inventa la política del cliente.
4. Woo sigue dueño de carrito/checkout/stock. El storefront no habla Woo salvo Store API para comercio.
5. Cachés JSON + HTML prerender + sitemap + robots + feed Merchant se regeneran por evento firmado.
6. `doctor` / diagnostics: `configured` ≠ `verified`. Sin credencial real + probe, `verified: false`.
7. `reset`/`seed` solo en `127.0.0.1`/`localhost`. Seed genérico (`Producto de ejemplo`), no catálogo Horizon.
8. Tests cubren aislamiento, firma, replay, idempotencia, doctor y “no Horizon Fit en Casa Sur”.
9. No ampliar el editor visual / `horizon-platform-bridge` / page sections CMS.
10. No segundo cliente HTTP de Google o Woo. No Ads UI. No LLM. No writes de catálogo de producción.
11. Commits solo en `feat/reusable-framework`. No push a `main`.

## Run conjunto (3 agentes, archivos disjuntos)

### A — Storefront isolation

Archivos: `design-system/page-builder.js`, `design-system/js/ga4.js`, `design-system/js/meta-pixel.js`, `design-system/components/sections/{footer,navbar,trust-bar,product-detail,lost-password,social-strip,checkout}.html`.

Cuando hay `STORE_CONFIG.name`: marca, dominio, email, WhatsApp, redes, textos de envío/cuotas/FAQ/alts/errores salen de config o quedan genéricos/vacíos. Tracking solo si `trackingEnabled` y el ID de **esa** tienda. El gate `horizonfit.com.ar` no debe bloquear otra marca en su propio dominio. Sin `STORE_CONFIG`, no tocar el comportamiento de Horizon Fit.

### B — PHP / caché / CAPI

Archivos: `backend/wordpress/wp-content/plugins/horizon-fit-commerce/includes/{storefront-seo-cache,meta-conversions-api,newsletter,info-pages-settings,footer-settings,featured-products-cache}.php`, `mu-plugins/00-horizon-framework.php`.

Si hay `hf_framework_config()`: prerender, schema, newsletter, CAPI `event_source_url`, contacto y legales usan origen/nombre/políticas de la tienda o quedan vacíos. No hardcodear `https://horizonfit.com.ar`. Health/capabilities/eventos siguen gated a config presente.

### C — Contrato, CLI y pruebas

Archivos: `framework/store.example.json`, `scripts/framework-store.mjs`, `tests/framework-*.php`, `tests/framework-*.mjs`.

Extender `store.json` con `payments`, `shipping`, `social`, `whatsappUrl`, `infoPages` (todos opcionales). El `build` inyecta eso en `HF_STOREFRONT_CONFIG` y neutraliza assets copiados (no dejar `horizonfit` en `public/` de la instancia). Tests: Casa Sur no contiene identidad/tracking/cuotas/redes de Horizon Fit; reset rechaza hosts remotos; doctor no marca `verified`; webhook e idempotencia siguen verdes.

## Cómo correrlo

```text
Trabajá SOLO en feat/reusable-framework.
Leé framework/COMPLETE-PLATFORM.prompt.md y ejecutá tu stream (A, B o C).
No toques archivos de otro stream.
No merges a main. No deploys. No expandas el editor.
Al terminar: tests de tu stream + lista de archivos tocados + qué quedó fuera (credenciales reales).
```

## Fuera de alcance (no bloquear el cierre)

- Conectar GA4 / Ads / Meta de verdad (hace falta cuenta y probe live).
- Publicar Casa Sur a un dominio real.
- Migrar el look de una tienda ajena (design-discovery de modern-commerce).
- Control Plane multi-tienda, Ads, warehouse, LLM.
