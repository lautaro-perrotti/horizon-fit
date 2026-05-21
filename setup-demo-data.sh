#!/bin/bash
set -e

echo "🚀 Horizon Fit - Setup Demo Data"
echo "=================================="
echo ""

WPCLI="docker-compose exec -T wpcli"

# 1. Crear página Home
echo "📄 Creando página Home..."
HOME_ID=$($WPCLI wp post create --post_type=hf_page --post_title='Home' --post_status=publish --porcelain)
$WPCLI wp post meta set $HOME_ID _hf_page_slug 'home'
echo "✅ Home creada (ID: $HOME_ID)"
echo ""

# 2. Crear secciones para Home
echo "🔨 Creando secciones..."

# Marquee
MARQUEE_ID=$($WPCLI wp post create --post_type=hf_page_section --post_title='Marquee' --post_status=publish --porcelain)
$WPCLI wp post meta set $MARQUEE_ID _hf_page_id $HOME_ID
$WPCLI wp post meta set $MARQUEE_ID _hf_section_type marquee
$WPCLI wp post meta set $MARQUEE_ID _hf_section_order 1
$WPCLI wp post meta set $MARQUEE_ID _hf_section_visible 1
echo "✅ Marquee section (ID: $MARQUEE_ID)"

# Hero
HERO_ID=$($WPCLI wp post create --post_type=hf_page_section --post_title='Hero' --post_status=publish --porcelain)
$WPCLI wp post meta set $HERO_ID _hf_page_id $HOME_ID
$WPCLI wp post meta set $HERO_ID _hf_section_type hero
$WPCLI wp post meta set $HERO_ID _hf_section_order 2
$WPCLI wp post meta set $HERO_ID _hf_section_visible 1
echo "✅ Hero section (ID: $HERO_ID)"

# Productos
PRODUCTOS_ID=$($WPCLI wp post create --post_type=hf_page_section --post_title='Productos' --post_status=publish --porcelain)
$WPCLI wp post meta set $PRODUCTOS_ID _hf_page_id $HOME_ID
$WPCLI wp post meta set $PRODUCTOS_ID _hf_section_type productos
$WPCLI wp post meta set $PRODUCTOS_ID _hf_section_order 3
$WPCLI wp post meta set $PRODUCTOS_ID _hf_section_visible 1
echo "✅ Productos section (ID: $PRODUCTOS_ID)"
echo ""

# 3. Configurar Marquee
echo "📢 Configurando Marquee..."
$WPCLI wp option set hf_marquee_messages '["3 y 6 cuotas sin interés","Envío gratis a todo el país","Compra online, retira en tienda","Garantía de 30 días","Devoluciones sin cargo"]'
$WPCLI wp option set hf_marquee_speed 20
echo "✅ Marquee configurado"
echo ""

# 4. Configurar Hero
echo "🎬 Configurando Hero..."
$WPCLI wp option set hf_hero_video_mobile "assets/hero-video-mobile.mp4"
$WPCLI wp option set hf_hero_video_desktop "assets/hero-video-desktop.mp4"
$WPCLI wp option set hf_hero_title "Bienvenido a Horizon Fit"
$WPCLI wp option set hf_hero_subtitle "Ropa deportiva de calidad premium"
$WPCLI wp option set hf_hero_button1_text "Comprar Ahora"
$WPCLI wp option set hf_hero_button1_url "http://localhost:8089/productos"
$WPCLI wp option set hf_hero_button2_text "Ver Colecciones"
$WPCLI wp option set hf_hero_button2_url "http://localhost:8089/colecciones"
echo "✅ Hero configurado"
echo ""

# 5. Crear categorías
echo "🏷️  Creando categorías..."
$WPCLI wp term create product_cat "Tops" --slug=tops --description="Tops, bras y remeras técnicas" > /dev/null 2>&1 || true
$WPCLI wp term create product_cat "Calzas" --slug=calzas --description="Calzas y leggings" > /dev/null 2>&1 || true
$WPCLI wp term create product_cat "Shorts" --slug=shorts --description="Shorts y bikers" > /dev/null 2>&1 || true
$WPCLI wp term create product_cat "Buzos" --slug=buzos --description="Buzos y hoodies" > /dev/null 2>&1 || true
echo "✅ Categorías creadas"
echo ""

# 6. Crear colecciones
echo "👜 Creando colecciones..."
$WPCLI wp term create hf_collection "Set Motion" --slug=set-motion --description="Top + Calza | Compresión media" > /dev/null 2>&1 || true
$WPCLI wp term create hf_collection "Set Power" --slug=set-power --description="Top + Short | Liviano y elástico" > /dev/null 2>&1 || true
$WPCLI wp term create hf_collection "Set Urban" --slug=set-urban --description="Buzo + Calza | Athleisure diario" > /dev/null 2>&1 || true
echo "✅ Colecciones creadas"
echo ""

echo "🎉 ¡Setup completado!"
echo ""
echo "📍 Próximos pasos:"
echo "1. Ir a http://localhost:8089/wp-admin"
echo "2. Menú > Horizon Fit > Horizon Fit | Seeder"
echo "3. Clickear 'Importar catálogo base'"
echo "4. Luego probar en http://localhost:8088"
echo ""
