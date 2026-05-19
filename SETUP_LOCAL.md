# 🏋️ Horizon Fit - Setup Local

## 📋 Requisitos previos

- **Docker Desktop** instalado en tu máquina
- **Docker Compose** (incluido en Docker Desktop)
- Puerto **8088** disponible (WordPress)
- Puerto **3308** disponible (MySQL)
- Puerto **8089** disponible (PhpMyAdmin)

## 🚀 Inicio rápido

### En Windows (PowerShell o CMD):
```bash
cd c:\Users\lsper\Local Sites\horizon-fit
.\start.bat
```

### En Mac/Linux:
```bash
cd ~/Local Sites/horizon-fit
bash start.sh
```

## 🎯 Después de iniciar

### 1️⃣ Espera a que los contenedores estén listos
Los contenedores pueden tardar 30-60 segundos en iniciar completamente. Verás en los logs cuando la base de datos esté lista.

### 2️⃣ Accede a los servicios

| Servicio | URL |
|----------|-----|
| **Frontend** (index.html) | http://localhost:8088 |
| **WordPress Admin** | http://localhost:8088/wp-admin |
| **WooCommerce API** | http://localhost:8088/wp-json/wc/v3 |
| **PhpMyAdmin** | http://localhost:8089 |

### 3️⃣ Credenciales de BD

```
Host: localhost:3308
Usuario: horizon_fit
Contraseña: horizon_fit
Base de datos: horizon_fit
```

## 🔧 Configuración inicial de WordPress

Si es la primera vez, importa el catálogo desde el plugin Horizon Fit:

1. Ve a http://localhost:8088/wp-admin
2. Ve a **WooCommerce > Horizon Fit > Seeder**
3. Haz click en **Importar catálogo base**

Esto cargará:
- 28 productos variables (con talle y color)
- 7 categorías
- 5 colecciones

## 📁 Estructura

```
horizon-fit/
├── index.html                 # Frontend principal (Design System)
├── design-system/             # Componentes CSS/JS del DS
├── assets/                    # Imágenes, videos, etc
├── TIPOGRAFIAS/              # Fuentes custom
├── backend/
│   └── wordpress/            # Núcleo de WordPress
│       ├── wp-content/
│       │   ├── plugins/
│       │   │   ├── woocommerce/
│       │   │   └── horizon-fit-commerce/  # Plugin custom
│       │   └── themes/
│       │       └── horizon-fit-blank/     # Tema mínimo (nuevo)
│       ├── wp-config.php
│       └── ...
├── docker-compose.yml        # Configuración Docker
├── .htaccess                 # Rewrite rules
├── start.sh / start.bat      # Scripts de inicio
└── SETUP_LOCAL.md           # Este archivo
```

## 🎨 Frontend vs Backend

### Frontend (index.html)
- **Ubicación**: `/index.html` (raíz del proyecto)
- **Tecnología**: HTML/CSS/JS vanilla
- **Sirve**: Interfaz de usuario, carrito, checkout UI
- **Comunica con**: WooCommerce REST API en `/wp-json/wc/v3`

### Backend (WordPress + WooCommerce + Plugin)
- **Ubicación**: `backend/wordpress/`
- **Tema**: `horizon-fit-blank` (mínimo, no interfiere)
- **Plugin**: `horizon-fit-commerce` (catálogo, precios, colecciones)
- **API**: Expone endpoints REST estándar de WooCommerce

## 🔌 API Endpoints principales

```
GET    /wp-json/wc/v3/products              # Lista productos
GET    /wp-json/wc/v3/products/{id}         # Producto específico
GET    /wp-json/wc/v3/products/categories   # Categorías
POST   /wp-json/wc/v3/orders                # Crear orden
GET    /wp-json/wc/v3/orders/{id}           # Orden específica
```

## 🛠️ Comandos útiles

### Ver logs en tiempo real
```bash
docker-compose logs -f wordpress
```

### Acceder a WP-CLI
```bash
docker-compose exec wordpress wp plugin list
docker-compose exec wordpress wp option get siteurl
```

### Resetear base de datos
```bash
docker-compose down -v
docker-compose up -d
```

### Detener servicios (sin borrar datos)
```bash
docker-compose down
```

### Borrar todo (contenedores + volumen de BD)
```bash
docker-compose down -v
```

## 🐛 Troubleshooting

### Error: "Cannot connect to Docker daemon"
- Asegurate que Docker Desktop está abierto y corriendo

### Error: "Port 8088 already in use"
```bash
# Windows
netstat -ano | findstr :8088
taskkill /PID <PID> /F

# Mac/Linux
lsof -i :8088
kill -9 <PID>
```

### WordPress está lento / hay timeout
- Espera 30+ segundos más (primer startup es lento)
- Verifica: `docker-compose logs wordpress | tail -20`

### Frontend no carga assets (CSS/JS)
- Verifica que `design-system/` y `assets/` existen
- Verifica el `.htaccess` (no debe bloquear estos directorios)

### "Connection refused" en WooCommerce API
- Verifica que el contenedor de WordPress está corriendo: `docker-compose ps`
- Verifica logs: `docker-compose logs wordpress`

## 📝 Notas sobre la arquitectura

### ¿Por qué tema mínimo?
El tema `horizon-fit-blank` existe solo para:
- Activar soporte de WooCommerce
- Habilitar REST API
- Permitir admin de WordPress

El frontend real (UI/UX) está completamente separado en `index.html`.

### ¿Cómo comunican?
```
Usuario → index.html (carga en navegador)
         → JavaScript hace fetch() a /wp-json/wc/v3/...
         → WordPress responde con JSON
         → JavaScript actualiza el DOM
```

### ¿Por qué este setup?
- **Flexibilidad**: Puedes cambiar el frontend sin tocar WordPress
- **Performance**: WordPress solo maneja API, no renderiza HTML
- **Escalabilidad**: Fácil de separar en microservicios después

## 📞 Soporte

Si algo no funciona:
1. Verifica Docker está corriendo: `docker-compose ps`
2. Mira los logs: `docker-compose logs wordpress`
3. Resetea todo: `docker-compose down -v && docker-compose up -d`

---

**Próximo paso**: Una vez que los servicios estén corriendo, abre http://localhost:8088 en tu navegador.
