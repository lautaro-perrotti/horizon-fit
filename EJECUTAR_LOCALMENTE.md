# 🚀 CÓMO EJECUTAR HORIZON FIT LOCALMENTE

## ✅ Estado actual

Tu proyecto está **100% listo para ejecutar localmente**. Ahora tienes:

✅ **Frontend**: `index.html` con todo el Design System (HTML/CSS/JS)  
✅ **Backend**: WordPress + WooCommerce + Plugin custom  
✅ **Docker**: Configuración completa lista para levantar  
✅ **Base de datos**: MariaDB con PhpMyAdmin incluido

---

## 🎯 Pasos para ejecutar

### Opción 1: Windows (CMD o PowerShell)
```bash
cd c:\Users\lsper\Local Sites\horizon-fit
.\start.bat
```

### Opción 2: Mac/Linux (Terminal)
```bash
cd ~/Local Sites/horizon-fit
bash start.sh
```

### Opción 3: Manual con Docker Compose
```bash
cd c:\Users\lsper\Local Sites\horizon-fit
docker-compose up -d
```

---

## 📊 Lo que se levanta

Después de ejecutar `start.bat` o `docker-compose up -d`, tendrás accesibles:

| Servicio | URL | Usuario | Contraseña |
|----------|-----|---------|-----------|
| **Frontend (Storefront)** | http://localhost:8088 | - | - |
| **WordPress Admin** | http://localhost:8088/wp-admin | admin | admin |
| **PhpMyAdmin** | http://localhost:8089 | root | root |
| **WP REST API** | http://localhost:8088/wp-json | - | - |

**Base de datos:**
- Host: `localhost:3308`
- Usuario: `horizon_fit`
- Contraseña: `horizon_fit`
- Base: `horizon_fit`

---

## ⚙️ Primer inicio (setup inicial)

### 1️⃣ Espera a que se levante (1-2 minutos)

Los logs mostrarán cuando esté listo:
```
horizon-fit-wp  | [Wed May 19 21:17:14.346491 2026] AH00094: Command line: 'apache2 -D FOREGROUND'
```

### 2️⃣ Ve a http://localhost:8088

Verás el **index.html** con tu diseño completo sirviendo como frontend. ✨

### 3️⃣ (OPCIONAL) Importa el catálogo en WordPress

Si quieres que WooCommerce tenga productos de demo:

1. Ve a http://localhost:8088/wp-admin
2. Login: `admin` / `admin`
3. Ve a **WooCommerce > Horizon Fit > Seeder**
4. Click en **Importar catálogo base**

Esto creará:
- 28 productos variables (talle + color)
- 7 categorías (Tops, Calzas, Shorts, Buzos, Accesorios, Ofertas, Conjuntos)
- 5 colecciones (Set Motion, Set Power, etc)

---

## 🏗️ Arquitectura

```
┌─────────────────────────────────────────────────┐
│         NAVEGADOR (http://localhost:8088)        │
│  ┌──────────────────────────────────────────┐   │
│  │        index.html (tu frontend)          │   │
│  │   HTML/CSS/JS vanilla + components      │   │
│  └────────────────┬─────────────────────────┘   │
│                   │ fetch() requests              │
│                   ▼                               │
│  ┌──────────────────────────────────────────┐   │
│  │  WordPress + WooCommerce (Backend)       │   │
│  │  - Productos variables                   │   │
│  │  - Categorías + Colecciones              │   │
│  │  - Órdenes y checkout                    │   │
│  │  - REST API en /wp-json                  │   │
│  └────────────────┬─────────────────────────┘   │
│                   │ SQL queries                   │
│                   ▼                               │
│  ┌──────────────────────────────────────────┐   │
│  │   MariaDB (Base de datos)                │   │
│  │   Puerto 3308                            │   │
│  └──────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

---

## 📁 Estructura de archivos

```
horizon-fit/
├── index.html                    ← Tu frontend (IMPORTANTE: NO BORRAR)
├── design-system/               ← Componentes CSS/JS del Design System
├── assets/                       ← Imágenes, videos, fuentes
├── TIPOGRAFIAS/                  ← Fuentes custom
├── backend/
│   └── wordpress/               ← Core de WordPress
│       ├── wp-content/
│       │   ├── plugins/
│       │   │   ├── woocommerce/            ← Plugin de ecommerce
│       │   │   └── horizon-fit-commerce/   ← Plugin personalizado
│       │   └── themes/
│       │       └── horizon-fit-blank/      ← Tema mínimo (NO USARLO)
│       ├── wp-config.php
│       ├── wp-admin/
│       └── ...
├── docker-compose.yml           ← Configuración de Docker
├── docker/
│   ├── apache/horizon-fit.conf   ← Config Apache rewrite
│   └── php/uploads.ini           ← Config PHP upload
├── .htaccess                     ← Rewrite rules para frontend
├── start.bat / start.sh          ← Scripts para iniciar
├── EJECUTAR_LOCALMENTE.md        ← Este archivo
└── SETUP_LOCAL.md                ← Documentación técnica
```

---

## 🔄 Flujo de desarrollo

### 👨‍💻 Editar el frontend

El **index.html está mapeado en Docker**, así que:

1. Edita `index.html` en tu editor
2. Guarda el archivo
3. Recarga http://localhost:8088 en el navegador
4. Los cambios aparecen al instante ✨

### 🗄️ Editar datos en WordPress

1. Ve a http://localhost:8088/wp-admin
2. Edita productos, categorías, precios
3. Los cambios se guardan en la BD
4. El frontend los obtiene vía REST API

---

## 🛠️ Comandos útiles

### Ver logs en tiempo real
```bash
docker-compose logs -f wordpress
```

### Acceder a la base de datos
Usa PhpMyAdmin en http://localhost:8089 o tu cliente SQL:
```bash
Host: localhost
Puerto: 3308
Usuario: horizon_fit
Contraseña: horizon_fit
```

### Resetear base de datos (⚠️ BORRA TODO)
```bash
docker-compose down -v
docker-compose up -d
```

### Detener sin borrar datos
```bash
docker-compose down
```

### Ver estado de contenedores
```bash
docker-compose ps
```

---

## 🐛 Troubleshooting

### "Connection refused" en puerto 8088
**Solución**: Espera 30+ segundos. El primer startup tarda.

### "Port already in use"
**Windows**:
```bash
netstat -ano | findstr :8088
taskkill /PID <PID> /F
```

**Mac/Linux**:
```bash
lsof -i :8088
kill -9 <PID>
```

### Frontend no carga CSS/JS
1. Verifica que `design-system/` existe
2. Verifica que `assets/` existe  
3. Verifica logs: `docker-compose logs wordpress`

### WordPress lento o timeout
Reinicia: `docker-compose restart wordpress`

### Borré algo importante 😅
**NO TE PREOCUPES** — la BD está en Docker:
```bash
docker-compose down -v  # Borra todo
docker-compose up -d    # Crea fresh
```

---

## 🎯 Próximos pasos

### Ahora que está corriendo:

1. **Abre** http://localhost:8088 — verás tu diseño completo
2. **Explora** http://localhost:8088/wp-admin — panel de WordPress
3. **Crea** productos en WooCommerce si quieres datos de prueba
4. **Desarrolla** — edita index.html, guarda, recarga

### Para producción después:
- Deploying a servidor real (Heroku, AWS, DigitalOcean, etc)
- Conectar dominio custom
- SSL/HTTPS
- CDN para assets estáticos
- Backup automático de BD

---

## 📞 Problemas?

Si algo no funciona:

1. **Verifica que Docker está corriendo**:
   ```bash
   docker --version
   docker-compose ps
   ```

2. **Mira los logs**:
   ```bash
   docker-compose logs wordpress | tail -50
   ```

3. **Reinicia todo**:
   ```bash
   docker-compose down
   docker-compose up -d
   ```

4. **Limpia todo y empieza fresh**:
   ```bash
   docker-compose down -v
   docker-compose up -d
   ```

---

## ✨ ¡Listo!

Ya está todo configurado. Solo falta ejecutar `start.bat` o `docker-compose up -d` y tu Horizon Fit está en http://localhost:8088 

**El index.html es el frontend real** — NO lo borres. Borramos el tema de WordPress que no se veía bien. Ahora todo funciona juntos:

- ✅ Frontend visual bonito (index.html)
- ✅ Backend real con datos (WordPress + WooCommerce)
- ✅ API lista (REST endpoints)
- ✅ Base de datos (MariaDB)

**¡A codear!** 🚀
