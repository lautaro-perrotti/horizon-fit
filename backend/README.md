# Backend WooCommerce

Este proyecto ahora incluye una base de backend en:

- `backend/wordpress`

Contenido instalado:

- `WordPress 6.9.4`
- `WooCommerce 10.7.0`
- Theme custom: `wp-content/themes/horizon-fit-store`
- Plugin custom: `wp-content/plugins/horizon-fit-commerce`

Estado actual:

- WordPress descargado y copiado dentro del repo.
- WooCommerce descargado y dejado en `wp-content/plugins/woocommerce`.
- Ya existe una integración base con WooCommerce mediante un theme y un plugin propios.
- El storefront custom cubre home, PDP, categorías, colecciones y estilos de carrito / checkout.
- El plugin custom agrega taxonomía `hf_collection`, seeder inicial, sync de ofertas y tool de precios.
- No configuré base de datos, `wp-config.php`, dominio local ni pasarelas.

Stack local lista para probar:

- `docker-compose.yml` en la raíz del proyecto
- WordPress: `http://localhost:8088`
- phpMyAdmin: `http://localhost:8089`
- DB host interno: `db`
- DB externa: `127.0.0.1:3308`
- DB name: `horizon_fit`
- DB user: `horizon_fit`
- DB password: `horizon_fit`
- Admin WP: `admin`
- Password WP: `Admin123!HF`

Qué falta para levantarlo:

1. Crear una base de datos MySQL o MariaDB.
2. Copiar `backend/wordpress/wp-config-sample.php` a `backend/wordpress/wp-config.php`.
3. Completar credenciales de DB y claves de WordPress.
4. Servir `backend/wordpress` con PHP/Apache/Nginx o con Local.
5. Entrar al instalador de WordPress.
6. Activar WooCommerce desde el admin.
7. Activar el theme `Horizon Fit Store`.
8. Activar el plugin `Horizon Fit Commerce`.
9. Ir a `WooCommerce > Horizon Fit` para importar el catálogo base.
10. Ir a `WooCommerce > Precios` para usar la tool de cambios masivos.

Con Docker:

1. Ejecutar `docker compose up -d`.
2. Abrir `http://localhost:8088`.
3. Para apagar todo: `docker compose down`.

Notas:

- En esta máquina no encontré `php` ni `wp-cli` en PATH del sistema, así que el arranque local quedó resuelto con Docker.
- El catálogo demo ya puede importarse desde el storefront fake usando el plugin custom.
- Cuando quieras, el siguiente paso lógico es revisar visualmente la tienda, ajustar el theme y después sumar `Mercado Pago` y `Payway`.
