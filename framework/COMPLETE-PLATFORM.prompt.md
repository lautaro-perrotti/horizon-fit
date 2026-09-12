# Prompt — plataforma reutilizable (estado actual + siguiente run)

Trabajá **solo** en `feat/reusable-framework`. Este repo es de un cliente (Horizon Fit). **No merges a `main`. No deploys. No amplíes el editor.**

## Plataforma cerrada (ya hecha)

Otra marca sale de `store.json`. WooCommerce es dueño de carrito, stock y checkout. El storefront es HTML + JSON cacheado. SEO, tracking y Merchant se configuran por tienda. Con config presente: **cero herencia de Horizon Fit**.

```text
scripts/framework-store.mjs
  build|refresh|backup|start|rebuild|status|stop|reset|seed|doctor
framework/store.example.json          Casa Sur — tracking vacío, contract 0.3.0
mu-plugins/00-horizon-framework.php   identidad, webhook HMAC, capabilities, idempotencia
```

`store.json` opcional: `payments`, `shipping`, `social`, `whatsappUrl`, `infoPages`. Campo ausente = vacío. No inventar cuotas, envíos ni redes del cliente.

### Run A/B/C — ejecutado

| Stream | Qué quedó |
| --- | --- |
| A storefront | Con `HF_STOREFRONT_CONFIG.name` el JS no pinta marca, cuotas, envíos, WhatsApp ni redes de Horizon Fit. Tracking solo con IDs de esa tienda. Gate `horizonfit.com.ar` no bloquea otro dominio. |
| B PHP / CAPI | Prerender, schema, newsletter y `event_source_url` usan origen/políticas de la tienda o quedan vacíos. |
| C contrato + tests | Build neutraliza `public/`. `reset`/`seed` solo localhost. `doctor`: `configured ≠ verified`, no imprime secretos. |

```bash
node tests/framework-tracking-tests.mjs
node tests/framework-cli-tests.mjs
php tests/framework-tests.php
node scripts/framework-store.mjs doctor framework/store.example.json
```

Sin `HF_STOREFRONT_CONFIG` / `hf_framework_config()`, Horizon Fit producción **no cambia**.

## Siguiente run (D/E/F) — archivos disjuntos

### D — Search / Merchant copy

Archivo: `backend/wordpress/wp-content/mu-plugins/horizon-fit-search-commerce.php`

Si hay `hf_framework_config()`: titles, metas, brand, permalinks y notas Merchant usan `hf_framework_name()` / `hf_framework_origin()` o quedan vacíos. No hardcodear `| Horizon Fit` ni `https://horizonfit.com.ar`. `ownBrandManufacturer` sigue gobernando SKU=MPN. Sin config, no tocar el cliente.

### E — Smoke local (solo si hay Docker)

No toques código de A–D salvo un bug de humo. Contra `framework/store.example.json` (localhost):

```bash
node scripts/framework-store.mjs build framework/store.example.json
node scripts/framework-store.mjs start framework/store.example.json
node scripts/framework-store.mjs seed framework/store.example.json
node scripts/framework-smoke.mjs framework/store.example.json
```

Probar home, PDP, colección, checkout, sitemap, carrito Store API. HTML/sitemap/JSON no pueden contener Horizon Fit ni `horizonfit.com.ar`. Si no hay Docker, documentá el bloqueo y no simules éxito.

### F — No hacer

- Conectar GA4 / Ads / Meta de verdad (hace falta cuenta + probe live).
- Publicar Casa Sur a un dominio público.
- Merge a `main` / deploy del cliente.
- Importar Next.js o el monorepo `modern-commerce`.
- Segundo cliente HTTP de Google o Woo. Ads UI. LLM. Writes de catálogo de producción.
- Ampliar `horizon-platform-bridge` / editor visual.

## Cómo pegarlo

```text
Leé framework/COMPLETE-PLATFORM.prompt.md.
Ejecutá solo el stream que te asigné (D, E o F).
Rama: feat/reusable-framework. No main. No deploy. No editor.
Al terminar: tests + archivos tocados + qué quedó fuera.
```
