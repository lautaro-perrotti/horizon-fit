# Horizon Fit - Setup Demo Data (Windows PowerShell)

Write-Host "🚀 Horizon Fit - Setup Demo Data" -ForegroundColor Green
Write-Host "==================================" -ForegroundColor Green
Write-Host ""

function Run-WpCli {
    param([string]$Command)
    docker exec horizon-fit-wpcli wp $Command
}

# 1. Crear página Home
Write-Host "📄 Creando página Home..." -ForegroundColor Cyan
$homeId = (docker exec horizon-fit-wpcli wp post create --post_type=hf_page --post_title='Home' --post_status=publish --porcelain)
docker exec horizon-fit-wpcli wp post meta set $homeId _hf_page_slug 'home' | Out-Null
Write-Host "✅ Home creada (ID: $homeId)" -ForegroundColor Green
Write-Host ""

# 2. Crear secciones
Write-Host "🔨 Creando secciones..." -ForegroundColor Cyan

# Marquee
$marqueeId = (docker exec horizon-fit-wpcli wp post create --post_type=hf_page_section --post_title='Marquee' --post_status=publish --porcelain)
docker exec horizon-fit-wpcli wp post meta set $marqueeId _hf_page_id $homeId | Out-Null
docker exec horizon-fit-wpcli wp post meta set $marqueeId _hf_section_type marquee | Out-Null
docker exec horizon-fit-wpcli wp post meta set $marqueeId _hf_section_order 1 | Out-Null
docker exec horizon-fit-wpcli wp post meta set $marqueeId _hf_section_visible 1 | Out-Null
Write-Host "✅ Marquee section (ID: $marqueeId)" -ForegroundColor Green

# Hero
$heroId = (docker exec horizon-fit-wpcli wp post create --post_type=hf_page_section --post_title='Hero' --post_status=publish --porcelain)
docker exec horizon-fit-wpcli wp post meta set $heroId _hf_page_id $homeId | Out-Null
docker exec horizon-fit-wpcli wp post meta set $heroId _hf_section_type hero | Out-Null
docker exec horizon-fit-wpcli wp post meta set $heroId _hf_section_order 2 | Out-Null
docker exec horizon-fit-wpcli wp post meta set $heroId _hf_section_visible 1 | Out-Null
Write-Host "✅ Hero section (ID: $heroId)" -ForegroundColor Green

# Productos
$productosId = (docker exec horizon-fit-wpcli wp post create --post_type=hf_page_section --post_title='Productos' --post_status=publish --porcelain)
docker exec horizon-fit-wpcli wp post meta set $productosId _hf_page_id $homeId | Out-Null
docker exec horizon-fit-wpcli wp post meta set $productosId _hf_section_type productos | Out-Null
docker exec horizon-fit-wpcli wp post meta set $productosId _hf_section_order 3 | Out-Null
docker exec horizon-fit-wpcli wp post meta set $productosId _hf_section_visible 1 | Out-Null
Write-Host "✅ Productos section (ID: $productosId)" -ForegroundColor Green
Write-Host ""

# 3. Configurar Marquee
Write-Host "📢 Configurando Marquee..." -ForegroundColor Cyan
$marqueeMessages = '["3 y 6 cuotas sin interés","Envío gratis a todo el país","Compra online, retira en tienda","Garantía de 30 días","Devoluciones sin cargo"]'
docker exec horizon-fit-wpcli wp option set hf_marquee_messages "$marqueeMessages" | Out-Null
docker exec horizon-fit-wpcli wp option set hf_marquee_speed 20 | Out-Null
Write-Host "✅ Marquee configurado" -ForegroundColor Green
Write-Host ""

# 4. Configurar Hero
Write-Host "🎬 Configurando Hero..." -ForegroundColor Cyan
docker exec horizon-fit-wpcli wp option set hf_hero_video_mobile "assets/hero-video-mobile.mp4" | Out-Null
docker exec horizon-fit-wpcli wp option set hf_hero_video_desktop "assets/hero-video-desktop.mp4" | Out-Null
docker exec horizon-fit-wpcli wp option set hf_hero_title "Bienvenido a Horizon Fit" | Out-Null
docker exec horizon-fit-wpcli wp option set hf_hero_subtitle "Ropa deportiva de calidad premium" | Out-Null
docker exec horizon-fit-wpcli wp option set hf_hero_button1_text "Comprar Ahora" | Out-Null
docker exec horizon-fit-wpcli wp option set hf_hero_button1_url "http://localhost:8089/productos" | Out-Null
docker exec horizon-fit-wpcli wp option set hf_hero_button2_text "Ver Colecciones" | Out-Null
docker exec horizon-fit-wpcli wp option set hf_hero_button2_url "http://localhost:8089/colecciones" | Out-Null
Write-Host "✅ Hero configurado" -ForegroundColor Green
Write-Host ""

# 5. Crear categorías
Write-Host "🏷️  Creando categorías..." -ForegroundColor Cyan
docker exec horizon-fit-wpcli wp term create product_cat "Tops" --slug=tops --description="Tops, bras y remeras técnicas" 2>&1 | Out-Null
docker exec horizon-fit-wpcli wp term create product_cat "Calzas" --slug=calzas --description="Calzas y leggings" 2>&1 | Out-Null
docker exec horizon-fit-wpcli wp term create product_cat "Shorts" --slug=shorts --description="Shorts y bikers" 2>&1 | Out-Null
docker exec horizon-fit-wpcli wp term create product_cat "Buzos" --slug=buzos --description="Buzos y hoodies" 2>&1 | Out-Null
Write-Host "✅ Categorías creadas" -ForegroundColor Green
Write-Host ""

# 6. Crear colecciones
Write-Host "👜 Creando colecciones..." -ForegroundColor Cyan
docker exec horizon-fit-wpcli wp term create hf_collection "Set Motion" --slug=set-motion --description="Top + Calza | Compresión media" 2>&1 | Out-Null
docker exec horizon-fit-wpcli wp term create hf_collection "Set Power" --slug=set-power --description="Top + Short | Liviano y elástico" 2>&1 | Out-Null
docker exec horizon-fit-wpcli wp term create hf_collection "Set Urban" --slug=set-urban --description="Buzo + Calza | Athleisure diario" 2>&1 | Out-Null
Write-Host "✅ Colecciones creadas" -ForegroundColor Green
Write-Host ""

Write-Host "🎉 ¡Setup completado!" -ForegroundColor Green
Write-Host ""
Write-Host "📍 Próximos pasos:" -ForegroundColor Yellow
Write-Host "1. Ir a http://localhost:8089/wp-admin" -ForegroundColor White
Write-Host "2. Menú > Horizon Fit > Horizon Fit | Seeder" -ForegroundColor White
Write-Host "3. Clickear 'Importar catálogo base'" -ForegroundColor White
Write-Host "4. Luego probar en http://localhost:8088" -ForegroundColor White
Write-Host ""
