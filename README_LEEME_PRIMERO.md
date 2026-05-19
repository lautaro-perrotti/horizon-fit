# 📚 HORIZON FIT - INICIO RÁPIDO

**Lee esto PRIMERO.**

---

## 🎯 ¿QUÉ ES ESTO?

Tu proyecto Horizon Fit está **100% listo** para:
- ✅ Correr localmente
- ✅ Subirlo a Hostinger
- ✅ Mantenerse en producción

---

## 🚀 3 FORMAS DE USARLO

### 1️⃣ **DESARROLLO LOCAL** (Tu máquina)

Ejecuta:
```bash
cd c:\Users\lsper\Local Sites\horizon-fit
.\start.bat
```

Accede a: `http://localhost:8088`

**Documentación:** Lee [`EJECUTAR_LOCALMENTE.md`](EJECUTAR_LOCALMENTE.md)

---

### 2️⃣ **DEPLOYAR A HOSTINGER** (Para tu amigo)

Dos opciones:

**A) Sin terminal (FÁCIL):**
- Lee [`PARA_TU_AMIGO.txt`](PARA_TU_AMIGO.txt)
- Usa Docker Manager en panel Hostinger

**B) Con terminal (Más control):**
- Lee [`HOSTINGER_DOCKER_PASO_A_PASO.md`](HOSTINGER_DOCKER_PASO_A_PASO.md)
- Usa SSH para git pull, logs, etc

**Usa el CHECKLIST:** [`CHECKLIST_DEPLOYMENT.txt`](CHECKLIST_DEPLOYMENT.txt)

**Documentación técnica:** [`DEPLOYMENT_HOSTINGER.md`](DEPLOYMENT_HOSTINGER.md)

---

### 3️⃣ **MANTENER EN PRODUCCIÓN** (Después de deploy)

```bash
# Ver logs
docker-compose logs wordpress

# Actualizar código
git pull origin main

# Cambiar precios masivamente
# → WordPress admin: /wp-admin

# Backups
# → Hostinger lo hace automático

# HTTPS + SSL
# → Hostinger lo hace automático
```

---

## 📁 ESTRUCTURA DEL PROYECTO

```
horizon-fit/
│
├── 🌐 FRONTEND (Tu diseño)
│   ├── index.html              ← Tu sitio (NO BORRES)
│   ├── design-system/          ← Componentes CSS/JS
│   ├── assets/                 ← Imágenes, videos
│   └── TIPOGRAFIAS/            ← Fuentes custom
│
├── 🗄️ BACKEND (WordPress + WooCommerce)
│   └── backend/wordpress/
│       ├── wp-content/plugins/
│       │   ├── woocommerce/          ← Plugin estándar
│       │   └── horizon-fit-commerce/ ← Plugin custom
│       └── wp-content/themes/
│           └── horizon-fit-blank/    ← Tema mínimo
│
├── 🐳 DOCKER
│   ├── docker-compose.yml      ← Configuración principal
│   ├── docker/apache/          ← Config Apache rewrite
│   └── docker/php/             ← Config PHP upload
│
├── 📖 DOCUMENTACIÓN
│   ├── README_LEEME_PRIMERO.md ← Este archivo
│   ├── EJECUTAR_LOCALMENTE.md  ← Setup local
│   ├── PARA_TU_AMIGO.txt       ← Paso a paso simple
│   ├── HOSTINGER_DOCKER_PASO_A_PASO.md ← Docker en Hostinger
│   ├── DEPLOYMENT_HOSTINGER.md ← Documentación técnica
│   └── CHECKLIST_DEPLOYMENT.txt ← Checklist imprimible
│
├── 🚀 SCRIPTS
│   ├── start.bat               ← Inicia Docker (Windows)
│   ├── start.sh                ← Inicia Docker (Mac/Linux)
│   └── .htaccess               ← Rewrite rules
│
└── 📊 STATUS
    └── STATUS.txt              ← Estado actual
```

---

## 🎯 RÁPIDO INICIO

### Opción A: LOCAL (Tu máquina ahora)

```bash
.\start.bat
# Espera 30 seg
# Abre http://localhost:8088
```

✅ Ves tu sitio con diseño  
✅ Puedes editar index.html, guardar, recarga = cambios al instante

---

### Opción B: PRODUCTION (Hostinger mañana)

**Para tu amigo:**

1. Abre [`PARA_TU_AMIGO.txt`](PARA_TU_AMIGO.txt)
2. Sigue paso a paso
3. Listo en 30 minutos

O más técnico:

1. Abre [`HOSTINGER_DOCKER_PASO_A_PASO.md`](HOSTINGER_DOCKER_PASO_A_PASO.md)
2. Elige: Docker Manager (fácil) o SSH (control total)
3. Sigue paso a paso

---

## 📊 ¿QUÉ SE ENTREGA?

✅ **Frontend HTML/CSS/JS** (index.html + Design System)
✅ **Backend WordPress + WooCommerce**
✅ **Plugin personalizado** (Horizon Fit Commerce)
✅ **Docker Compose** listo para producción
✅ **Base de datos** (MariaDB automática)
✅ **HTTPS/SSL** (automático en Hostinger)
✅ **Backups automáticos** (automático en Hostinger)
✅ **Documentación completa** (esta carpeta)

---

## 🔑 CREDENCIALES IMPORTANTES

**Local (`http://localhost:8088`):**
```
WordPress Admin: http://localhost:8088/wp-admin
Usuario: (se crea al primer setup)
BD: localhost:3308 (dentro de Docker)
```

**Hostinger (después de deploy):**
```
Frontend: https://tudominio.com
WordPress Admin: https://tudominio.com/wp-admin
Usuario: wordpress (cambiar después)
Contraseña: la que esté en docker-compose.yml
```

---

## 🚀 FLUJO DE TRABAJO

### TÚ (Desarrollo)

```
Edita index.html
      ↓
Guardar
      ↓
Recarga http://localhost:8088
      ↓
Cambios al instante ✨
      ↓
git push origin main
      ↓
Tu amigo hace git pull en Hostinger
      ↓
Sitio en producción se actualiza
```

### TU AMIGO (Producción)

```
Sube a Hostinger con Docker
      ↓
WooCommerce admin en https://tudominio.com/wp-admin
      ↓
Edita productos, precios, categorías
      ↓
Frontend muestra cambios automáticamente (vía API)
```

---

## ✨ PRÓXIMAS ACCIONES

**Hoy:**
- [ ] Lee este archivo (estás aquí ✓)
- [ ] Ejecuta `.\start.bat` para ver local
- [ ] Sube código a GitHub

**Mañana (para Hostinger):**
- [ ] Dale a tu amigo: [`PARA_TU_AMIGO.txt`](PARA_TU_AMIGO.txt)
- [ ] Dale acceso SSH + credenciales Hostinger
- [ ] Usa [`CHECKLIST_DEPLOYMENT.txt`](CHECKLIST_DEPLOYMENT.txt) para seguimiento

**Semana que viene (en producción):**
- [ ] Editar productos en WordPress admin
- [ ] Actualizar frontend con git
- [ ] Monitorear logs con `docker-compose logs`

---

## 📚 DOCUMENTACIÓN COMPLETA

| Archivo | Para quién | Cuándo leer |
|---------|-----------|-----------|
| **README_LEEME_PRIMERO.md** | Todos | Ahora |
| **EJECUTAR_LOCALMENTE.md** | Desarrollo local | Si quieres correr local |
| **PARA_TU_AMIGO.txt** | Tu amigo | Antes de subirlo a Hostinger |
| **HOSTINGER_DOCKER_PASO_A_PASO.md** | Tu amigo (técnico) | Si quiere control total |
| **DEPLOYMENT_HOSTINGER.md** | Tu amigo (referencia) | Como referencia técnica |
| **CHECKLIST_DEPLOYMENT.txt** | Tu amigo | Para seguimiento paso a paso |
| **SETUP_LOCAL.md** | Referencia técnica | Para detalles de setup local |
| **STATUS.txt** | Resumen visual | Para ver estado actual |

---

## 🎯 ARQUITECTURA EN UNA IMAGEN

```
┌─ http://localhost:8088 o https://tudominio.com ─┐
│                                                  │
│  index.html (Frontend SPA)                       │
│  - HTML/CSS/JS vanilla                           │
│  - Diseño completo                               │
│  - Componentes del Design System                 │
│                                                  │
│  fetch() a /wp-json/wc/v3/...                   │
│         ↓                                        │
│  WordPress REST API                              │
│  - Productos                                     │
│  - Categorías                                    │
│  - Órdenes                                       │
│  - WooCommerce                                   │
│         ↓                                        │
│  MariaDB (Base de datos)                         │
│  - Todos los datos persistidos                   │
│  - Backupeados automáticamente                   │
│                                                  │
└──────────────────────────────────────────────────┘
```

---

## 🆘 ALGO SALIÓ MAL?

**No carga local:**
```bash
docker-compose ps  # Ver si están corriendo
docker-compose logs wordpress  # Ver qué pasó
docker-compose restart wordpress  # Reintentar
```

**No carga en Hostinger:**
```bash
ssh u123456@IP_VPS
docker-compose ps
docker-compose logs wordpress | tail -50
```

**"Port already in use":**
```bash
# Windows
netstat -ano | findstr :8088
taskkill /PID <PID> /F

# Mac/Linux
lsof -i :8088
kill -9 <PID>
```

---

## ✅ VERIFICACIÓN RÁPIDA

Local:
```bash
curl http://localhost:8088
# Deberías ver HTML de index.html
```

Hostinger:
```bash
curl http://IP_DEL_VPS
# Deberías ver HTML de index.html
```

---

## 🎉 ¡LISTO!

Tenés todo lo necesario para:
- ✅ Desarrollar localmente
- ✅ Subir a producción
- ✅ Mantener en vivo
- ✅ Escalar en el futuro

**Siguiente paso:**

1. Corre `.\start.bat` y abre http://localhost:8088
2. Verás tu sitio funcionando
3. Edita index.html, guarda, recarga
4. Cuando esté listo, pasa a tu amigo [`PARA_TU_AMIGO.txt`](PARA_TU_AMIGO.txt)

---

## 💬 PREGUNTAS FRECUENTES

**P: ¿Necesito saber Docker?**  
R: No. Solo necesitas ejecutar `.\start.bat` o `docker-compose up -d`

**P: ¿Por qué no instalé PHP directamente?**  
R: Docker es mejor (portable, fácil de actualizar, aislado)

**P: ¿Puedo cambiar el puerto 8088?**  
R: Sí, en docker-compose.yml: `- "8099:80"`

**P: ¿Dónde guardo contraseñas?**  
R: En `.env` (no en git), o en docker-compose.yml (solo local)

**P: ¿Qué pasa si borro todo?**  
R: Backups en Hostinger. Localmente: `docker-compose down -v && docker-compose up -d`

---

## 📞 SOPORTE

- **Documentación local:** Lee uno de los archivos .md
- **Soporte Hostinger:** Contacta si Docker no funciona
- **GitHub Issues:** Si necesitas feedback de otros

---

## 🚀 ¡EMPEZA!

```bash
.\start.bat
```

En 30 segundos verás tu sitio en http://localhost:8088

¡Buena suerte! 🍀
