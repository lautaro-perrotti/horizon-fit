# Backend WooCommerce

Este proyecto ahora incluye una base de backend en:

- `backend/wordpress`

Contenido instalado:

- `WordPress 6.9.4`
- `WooCommerce 10.7.0`

Estado actual:

- WordPress descargado y copiado dentro del repo.
- WooCommerce descargado y dejado en `wp-content/plugins/woocommerce`.
- No hay integración todavía con el frontend estático del proyecto.
- No configuré base de datos, `wp-config.php`, dominio local ni pasarelas.

Qué falta para levantarlo:

1. Crear una base de datos MySQL o MariaDB.
2. Copiar `backend/wordpress/wp-config-sample.php` a `backend/wordpress/wp-config.php`.
3. Completar credenciales de DB y claves de WordPress.
4. Servir `backend/wordpress` con PHP/Apache/Nginx o con Local.
5. Entrar al instalador de WordPress.
6. Activar WooCommerce desde el admin.

Notas:

- En esta máquina no encontré `php` ni `wp-cli` en PATH, así que dejé la instalación de archivos lista, pero no pude ejecutar el instalador.
- Cuando quieras, el siguiente paso lógico es conectar este backend a una instalación local real y después sumar `Mercado Pago` y `Payway`.
