# Guía de Setup - Horizon Fit Commerce

## 📋 Contenido
1. [Cargar Productos](#cargar-productos)
2. [Crear Banners](#crear-banners)
3. [Configurar Secciones de Página](#configurar-secciones-de-página)
4. [Integrar WooCommerce](#integrar-woocommerce)
5. [Comandos Rápidos](#comandos-rápidos)

---

## Cargar Productos

### Opción A: Via Seeder (Automático desde index.html)

1. Ve a WordPress Admin: `http://localhost:8089/wp-admin`
2. Menú > **Horizon Fit** > **Horizon Fit | Seeder**
3. Clickea **"Importar catálogo base"**
4. ✅ Se crearán automáticamente ~30 productos con:
   - Talles (S, M, L, XL)
   - Colores (Negro, Azul, Arena)
   - Precios
   - Categorías (Tops, Calzas, Buzos, etc)
   - Colecciones (Set Motion, Set Power, etc)

### Opción B: Vía WooCommerce (Manual)

1. Menú > **Productos** > **Agregar nuevo**
2. Completa:
   - Título: "BLACK HIGH TOP"
   - Descripción (opcional)
   - Imagen (sube o URL externa)
   - Precio regular: 1500
   - Precio de oferta: 1200 (opcional)
3. **Atributos** (muy importante):
   - Talle: S, M, L, XL
   - Color: Negro
4. Clickea **Variaciones** > **Crear variaciones**
   - Se generan automáticamente para cada talle + color
5. **Publicar**

### Opción C: Vía Bulk (Múltiples productos)

```bash
# Desde terminal, dentro del proyecto
docker-compose exec wpcli wp post create \
  --post_type=product \
  --post_title="Mi Producto" \
  --post_status=publish \
  --meta_input='{
    "_price": "1500",
    "_regular_price": "1500",
    "_sale_price": "1200"
  }'
```

---

## Crear Banners

Los banners se usan en el carrusel principal y secciones especiales.

### Vía WordPress Admin

1. Menú > **Productos** > **Atributos** (o crear nueva taxonomía)
2. O mejor aún, **crear posts de tipo custom**:

#### Opción Recomendada: Custom Post Type "Banner"

**Ya está disponible** pero necesita un loader. Por ahora usa esto:

```bash
# Crear un banner vía WP CLI
docker-compose exec wpcli wp post create \
  --post_type=post \
  --post_title="Banner Verano 2026" \
  --post_status=publish \
  --post_excerpt="Descuento 30% en toda la colección" \
  --meta_input='{
    "_hf_banner_url": "http://localhost:8089/productos/conjuntos",
    "_hf_banner_order": "1",
    "_hf_banner_color_bg": "#FF6B9D"
  }'
```

Luego en `index.html`, crea una sección banner:

```html
<section class="hf-banner" style="background-color: var(--banner-bg, #FF6B9D);">
  <div class="hf-banner__content">
    <h2>Verano 2026</h2>
    <p>Descuento 30% en toda la colección</p>
    <a href="#" class="hf-button hf-button--primary">Comprar Ahora</a>
  </div>
</section>
```

---

## Configurar Secciones de Página

### 1. Crear la Página Base (Home)

Ya está creada (ID: 28), pero si necesitas otra:

```bash
docker-compose exec wpcli wp post create \
  --post_type=hf_page \
  --post_title="Colecciones" \
  --post_status=publish

# Suponiendo que devuelve ID 30
docker-compose exec wpcli wp post meta set 30 _hf_page_slug "collections"
```

### 2. Agregar Secciones a la Página

#### Sección MARQUEE (Mensajes rodantes)

```bash
docker-compose exec wpcli wp post create \
  --post_type=hf_page_section \
  --post_title="Marquee" \
  --post_status=publish

# Devuelve ID 31
docker-compose exec wpcli wp post meta set 31 _hf_page_id 28
docker-compose exec wpcli wp post meta set 31 _hf_section_type marquee
docker-compose exec wpcli wp post meta set 31 _hf_section_order 1
docker-compose exec wpcli wp post meta set 31 _hf_section_visible 1
```

#### Sección HERO (Video principal)

```bash
docker-compose exec wpcli wp post create \
  --post_type=hf_page_section \
  --post_title="Hero" \
  --post_status=publish

# Devuelve ID 32
docker-compose exec wpcli wp post meta set 32 _hf_page_id 28
docker-compose exec wpcli wp post meta set 32 _hf_section_type hero
docker-compose exec wpcli wp post meta set 32 _hf_section_order 2
docker-compose exec wpcli wp post meta set 32 _hf_section_visible 1
```

#### Sección PRODUCTOS

```bash
docker-compose exec wpcli wp post create \
  --post_type=hf_page_section \
  --post_title="Productos Destacados" \
  --post_status=publish

# Devuelve ID 33
docker-compose exec wpcli wp post meta set 33 _hf_page_id 28
docker-compose exec wpcli wp post meta set 33 _hf_section_type productos
docker-compose exec wpcli wp post meta set 33 _hf_section_order 3
docker-compose exec wpcli wp post meta set 33 _hf_section_visible 1
```

### 3. Cambiar Orden de Secciones (Importante)

Si quieres que el Hero sea primero:

```bash
# Hero pasa a orden 1
docker-compose exec wpcli wp post meta update 32 _hf_section_order 1

# Marquee pasa a orden 2
docker-compose exec wpcli wp post meta update 31 _hf_section_order 2

# Productos pasa a orden 3
docker-compose exec wpcli wp post meta update 33 _hf_section_order 3
```

---

## Integrar WooCommerce

### 1. Configurar Categorías de Productos

```bash
# Las categorías ya se crean automáticamente con el Seeder
# Pero si quieres crearlas manualmente:

docker-compose exec wpcli wp term create product_cat "Tops" \
  --slug=tops \
  --description="Tops, bras y remeras técnicas"

docker-compose exec wpcli wp term create product_cat "Calzas" \
  --slug=calzas \
  --description="Calzas y leggings"

docker-compose exec wpcli wp term create product_cat "Buzos" \
  --slug=buzos \
  --description="Buzos y hoodies"
```

### 2. Asignar Productos a Categorías

```bash
# Obtener ID del producto (ej: 45)
# Asignarlo a una categoría (ej: Tops con ID 8)

docker-compose exec wpcli wp post term set 45 product_cat 8
```

### 3. Crear Colecciones (hf_collection)

```bash
docker-compose exec wpcli wp term create hf_collection "Set Motion" \
  --slug=set-motion \
  --description="Top + Calza | Compresión media"

docker-compose exec wpcli wp term create hf_collection "Set Power" \
  --slug=set-power \
  --description="Top + Short | Liviano y elástico"
```

### 4. Asignar Productos a Colecciones

```bash
# ID producto 45, colección Set Motion (ID 10)
docker-compose exec wpcli wp post term add 45 hf_collection 10
```

---

## Configurar Marquee (Mensajes Rodantes)

Los mensajes se guardan en WordPress options.

### Via WP CLI

```bash
docker-compose exec wpcli wp option set hf_marquee_messages \
  '["3 y 6 cuotas sin interés","Envío gratis a todo el país","Compra online, retira en tienda","Garantía de 30 días","Devoluciones sin cargo"]'

docker-compose exec wpcli wp option set hf_marquee_speed 20
```

### Verificar que están guardados

```bash
docker-compose exec wpcli wp option get hf_marquee_messages
docker-compose exec wpcli wp option get hf_marquee_speed
```

---

## Configurar Hero (Video Principal)

### Via WP CLI

```bash
# Videos (URL absoluta o relativa)
docker-compose exec wpcli wp option set hf_hero_video_mobile "assets/hero-video-mobile.mp4"
docker-compose exec wpcli wp option set hf_hero_video_desktop "assets/hero-video-desktop.mp4"

# Título y botones
docker-compose exec wpcli wp option set hf_hero_title "Bienvenido a Horizon Fit"
docker-compose exec wpcli wp option set hf_hero_subtitle "Ropa deportiva de calidad"
docker-compose exec wpcli wp option set hf_hero_button1_text "Comprar Ahora"
docker-compose exec wpcli wp option set hf_hero_button1_url "http://localhost:8089/productos"
docker-compose exec wpcli wp option set hf_hero_button2_text "Ver Colecciones"
docker-compose exec wpcli wp option set hf_hero_button2_url "http://localhost:8089/colecciones"
```

---

## Comandos Rápidos

### Ver todas las páginas creadas

```bash
docker-compose exec wpcli wp post list --post_type=hf_page --format=table
```

### Ver todas las secciones

```bash
docker-compose exec wpcli wp post list --post_type=hf_page_section --format=table
```

### Ver todos los productos

```bash
docker-compose exec wpcli wp post list --post_type=product --format=table
```

### Ver categorías de productos

```bash
docker-compose exec wpcli wp term list product_cat --format=table
```

### Ver colecciones

```bash
docker-compose exec wpcli wp term list hf_collection --format=table
```

### Editar una sección (cambiar orden o visibilidad)

```bash
# ID 32 = Hero section
docker-compose exec wpcli wp post meta update 32 _hf_section_order 1
docker-compose exec wpcli wp post meta update 32 _hf_section_visible 1
```

### Eliminar una sección

```bash
docker-compose exec wpcli wp post delete 32 --force
```

### Limpiar caché del frontend

En la consola del navegador (DevTools):
```javascript
HF.API.clearCache()
```

O via cURL:
```bash
# No hay endpoint para limpiar, pero los caches expiran en 2 horas
```

---

## Estructura de Datos (Reference)

### wp_options (Marquee & Hero)
```
hf_marquee_messages = JSON array
hf_marquee_speed = integer (ms por pixel)
hf_hero_video_mobile = string URL
hf_hero_video_desktop = string URL
hf_hero_title = string
hf_hero_subtitle = string
hf_hero_button1_text = string
hf_hero_button1_url = string
hf_hero_button2_text = string
hf_hero_button2_url = string
```

### Posts: hf_page
```
post_title = nombre de página
post_status = publish/draft
_hf_page_slug = home/collections/product/checkout
_hf_page_title = título para SEO
```

### Posts: hf_page_section
```
post_title = nombre sección (solo admin)
post_status = publish/draft
_hf_page_id = ID de la página padre
_hf_section_type = marquee/hero/productos/testimonios/info_banner
_hf_section_order = integer (1, 2, 3...)
_hf_section_visible = 1 o 0
_hf_section_settings = JSON config específica
```

### Posts: product (WooCommerce)
```
post_title = nombre del producto
post_content = descripción
_price = precio
_regular_price = precio normal
_sale_price = precio en oferta
_product_attributes = talles, colores, etc
```

---

## Testing

### 1. Verificar que los datos lleguen al frontend

Abre DevTools (F12) en `http://localhost:8088` y corre:

```javascript
// Ver si los loaders cargan correctamente
console.log('HF.API:', window.HF.API);

// Probar marquee
HF.API.marqueeSettings().then(data => console.log('Marquee:', data));

// Probar hero
HF.API.heroSettings().then(data => console.log('Hero:', data));

// Probar page sections
HF.API.pageSections('home').then(data => console.log('Page sections:', data));
```

### 2. Ver en la red (Network tab)

- Busca `marquee` request
- Busca `hero` request
- Busca `pages/home/sections` request
- Verifica que todos devuelvan **200 OK** y **JSON**

---

## Próximos Pasos

1. ✅ Ejecutar Seeder para cargar productos base
2. ✅ Configurar Marquee y Hero via WP CLI
3. ✅ Crear páginas adicionales (Colecciones, Producto detail, Carrito)
4. ✅ Agregar secciones a cada página
5. ⏳ Crear loaders para productos, banners, info sections (próximo sprint)

---

## Soporte

Si algo no funciona:

1. **Revisar logs de WordPress**:
   ```bash
   docker-compose logs wordpress | tail -100
   ```

2. **Revisar caché del navegador**:
   ```javascript
   HF.API.clearCache()
   ```

3. **Reiniciar Docker**:
   ```bash
   docker-compose restart wordpress
   ```

4. **Ver opciones guardadas en BD**:
   ```bash
   docker-compose exec wpcli wp option get hf_marquee_messages
   ```
