# 🚀 HOSTINGER VPS + DOCKER + WORDPRESS - GUÍA DEFINITIVA 2026

Esta es la guía **MÁS ACTUALIZADA** para desplegar Horizon Fit a Hostinger con Docker.

Basada en la documentación oficial de Hostinger 2026.

---

## 🎯 ¿CÓMO FUNCIONA EN HOSTINGER?

Hostinger tiene **DOS formas de usar Docker**:

### Opción A: Docker Manager (FÁCIL) 
- Interfaz visual en el panel Hostinger
- No tocar terminal
- Ideal para tu amigo

### Opción B: SSH Manual (POTENTE)
- Terminal SSH
- Más control
- Ideal si quieres actualizar código con git pull

**Te muestro AMBAS.** Elige una.

---

## 📋 REQUISITOS

✅ VPS Hostinger con plan Docker (cualquier tier)  
✅ Tiene Ubuntu 24.04 + Docker + Docker Compose preinstalado  
✅ Este proyecto (con docker-compose.yml)

---

# OPCIÓN A: DOCKER MANAGER (SIN TERMINAL) - ⭐ RECOMENDADO PARA TU AMIGO

Esta es la forma **MÁS FÁCIL** y visual.

## PASO 1: Acceder al Panel Docker de Hostinger

1. Abre **panel.hostinger.com**
2. Ve a **VPS** → Selecciona tu VPS
3. En el lado izquierdo, ve a **Docker Manager**
4. Deberías ver una interfaz con botones

---

## PASO 2: Crear Base de Datos en Hostinger

**En el panel Hostinger (no en Docker Manager):**

1. Ve a **Bases de Datos** (en el menú izquierdo)
2. Click **+ Crear base de datos**
3. Llena:
   ```
   Nombre: horizon_fit_prod
   Usuario: horizon_prod
   Contraseña: Algo_Fuerte_Aqui_123!
   Charset: utf8mb4
   ```
4. Click **Crear**

**Anota estos datos** - los necesitarás en paso siguiente.

---

## PASO 3: Preparar el docker-compose.yml

**En tu máquina (NO en Hostinger):**

Edita el archivo `docker-compose.yml` con estos valores:

```yaml
environment:
  WORDPRESS_DB_HOST: db:3306
  WORDPRESS_DB_NAME: horizon_fit_prod
  WORDPRESS_DB_USER: horizon_prod
  WORDPRESS_DB_PASSWORD: Algo_Fuerte_Aqui_123!
  WP_HOME: https://tudominio.com
  WP_SITEURL: https://tudominio.com
  WORDPRESS_DEBUG: 'false'

ports:
  - "80:80"
```

Guarda el archivo.

---

## PASO 4: Subir el docker-compose.yml a GitHub

En tu máquina:

```bash
cd c:\Users\lsper\Local Sites\horizon-fit

# Si no está en GitHub:
git init
git add docker-compose.yml docker/ .htaccess index.html design-system/ assets/
git commit -m "Docker setup for Hostinger"
git remote add origin https://github.com/tuuser/horizon-fit.git
git push -u origin main
```

Ahora el archivo está en GitHub, listo para Hostinger.

---

## PASO 5: Desplegar en Docker Manager

**De vuelta en el panel Hostinger:**

1. Ve a **Docker Manager** (VPS → Docker Manager)
2. Click **+ New Project** (o similar)
3. Selecciona **Deploy from URL**
4. Pega esta URL:
   ```
   https://raw.githubusercontent.com/tuuser/horizon-fit/main/docker-compose.yml
   ```
5. Click **Validate**
6. Hostinger valida el archivo
7. Click **Deploy**

**Hostinger:**
- Descarga las imágenes de Docker
- Levanta los contenedores (db, wordpress, phpmyadmin)
- Todo automático

Espera **3-5 minutos** (descarga imágenes).

---

## PASO 6: Verificar que está corriendo

En Docker Manager deberías ver:

```
PROJECT: horizon-fit
├── horizon-fit-db (running)
├── horizon-fit-wp (running)
└── horizon-fit-pma (running)
```

Si todos están "running" → ✅ Éxito

---

## PASO 7: Acceder al sitio

Abre en navegador:

```
http://IP_DE_TU_VPS
```

O si el dominio ya está apuntado:

```
http://tudominio.com
```

Deberías ver tu **index.html** con el diseño. ✨

---

## PASO 8: WordPress Admin

Abre:

```
http://IP_O_DOMINIO/wp-admin
```

Login:
```
Usuario: wordpress
Contraseña: (la que está en docker-compose.yml bajo WORDPRESS_DB_PASSWORD)
```

Si entra → ✅ WordPress funciona

---

## PASO 9: Apuntar dominio

**En Hostinger:**

1. Ve a **Dominios**
2. Selecciona tu dominio
3. Ve a **DNS**
4. Verifica que registros **A** apunten a la **IP del VPS**

Espera hasta 24h para que se propague.

---

## PASO 10: HTTPS

**En Hostinger:**

1. Ve a **SSL**
2. Si está deshabilitado, click **Activar**
3. Hostinger crea certificado automáticamente (Let's Encrypt, gratis)

Listo. Ahora funciona `https://tudominio.com`

---

## PASO 11: Backups automáticos

**En Hostinger:**

1. Ve a **Backups**
2. Click **Automático**
3. Elige frecuencia (diaria = bien)

Listo. Se backupea todo automáticamente.

---

# OPCIÓN B: SSH MANUAL (CON TERMINAL) - PARA MÁS CONTROL

Si prefieres o necesitas controlar desde terminal (para git pull, logs, etc).

## PASO 1: Conectarte por SSH

En tu máquina, abre Terminal/PowerShell:

```bash
ssh u123456@IP_DEL_VPS
# O con clave privada:
ssh -i ~/.ssh/clave.pem u123456@IP_DEL_VPS
```

Ingresa contraseña.

---

## PASO 2: Descargar el código

```bash
cd ~
git clone https://github.com/tuuser/horizon-fit.git
cd horizon-fit
```

---

## PASO 3: Configurar docker-compose.yml

```bash
nano docker-compose.yml
```

Busca y cambia:
```yaml
WORDPRESS_DB_NAME: horizon_fit_prod
WORDPRESS_DB_USER: horizon_prod
WORDPRESS_DB_PASSWORD: Algo_Fuerte_Aqui_123!
WP_HOME: https://tudominio.com
WP_SITEURL: https://tudominio.com
```

Para salvar: `Ctrl+X` → `Y` → `Enter`

---

## PASO 4: Crear BD MySQL en Hostinger

**En el panel Hostinger (no SSH):**

1. Ve a **Bases de Datos**
2. Click **+ Crear base de datos**
3. Nombre: `horizon_fit_prod`
4. Usuario: `horizon_prod`
5. Contraseña: `Algo_Fuerte_Aqui_123!`
6. Click **Crear**

---

## PASO 5: Levantame con Docker Compose

De vuelta en SSH:

```bash
docker-compose up -d
```

Espera 2-3 minutos.

Verifica:

```bash
docker-compose ps
```

Deberías ver 3 contenedores, todos "Up".

---

## PASO 6: Ver logs si hay problemas

```bash
docker-compose logs wordpress | tail -50
```

Muestra los últimos 50 líneas de logs.

---

## PASO 7: Acceder al sitio

```
http://IP_DEL_VPS
```

Debería cargar el sitio.

---

## PASO 8: Actualizar código (con git pull)

Una ventaja de SSH es que puedes actualizar código:

```bash
cd ~/horizon-fit
git pull origin main
docker-compose restart wordpress
```

Listo. El sitio se actualiza en segundos.

---

# 📝 COMPARATIVA: Docker Manager vs SSH Manual

| Aspecto | Docker Manager | SSH Manual |
|---------|---|---|
| **Dificultad** | ⭐ Muy fácil | ⭐⭐⭐ Medio |
| **Interfaz** | Visual (punto y click) | Terminal (comandos) |
| **Actualizar código** | SFTP | git pull |
| **Ver logs** | Limitado | Completo |
| **Ideal para** | Tu amigo (sin experiencia) | Tú (desarrollo) |
| **Soporte** | Hostinger lo ayuda | Eres independiente |

---

# ✅ CHECKLIST FINAL

- [ ] Base de datos creada en Hostinger
- [ ] docker-compose.yml configurado con credenciales
- [ ] GitHub tiene el código (si quieres usar Docker Manager)
- [ ] Docker levantado (vía Manager o SSH)
- [ ] http://IP_VPS carga el sitio
- [ ] http://IP_VPS/wp-admin accesible
- [ ] Dominio apuntado en Hostinger
- [ ] HTTPS habilitado
- [ ] Backups automáticos configurados

---

# 🔧 COMANDOS ÚTILES (SSH)

```bash
# Ver contenedores corriendo
docker-compose ps

# Ver logs en vivo
docker-compose logs -f wordpress

# Reiniciar WordPress
docker-compose restart wordpress

# Detener sin borrar datos
docker-compose down

# Volver a iniciar
docker-compose up -d

# Cambiar contraseña WordPress
docker-compose exec wordpress wp user set-password admin nuevapass

# Actualizar código desde GitHub
cd ~/horizon-fit && git pull origin main && docker-compose restart wordpress
```

---

# 🎯 AFTER DEPLOYMENT

**Para editar frontend:**
- Por SFTP (Hostinger proporciona)
- O `git pull` si estás en SSH

**Para editar backend:**
- WordPress admin en `https://tudominio.com/wp-admin`

**Para monitorear:**
- `docker-compose logs wordpress` (SSH)
- O Docker Manager (visual en Hostinger)

---

# 🐛 TROUBLESHOOTING

**No carga el sitio:**
```bash
docker-compose logs wordpress | tail -20
# Busca errores
```

**BD no conecta:**
```
Verifica:
- WORDPRESS_DB_NAME = nombre correcto
- WORDPRESS_DB_USER = usuario correcto
- WORDPRESS_DB_PASSWORD = contraseña correcta
- BD existe en Hostinger
```

**Port 80 en uso:**
```bash
sudo lsof -i :80
sudo kill -9 <PID>
docker-compose up -d
```

---

# 📞 SOPORTE

**Si Hostinger dice que Docker no funciona:**
- Muy raro en 2026
- Verifica que tu plan VPS incluye Docker
- Contacta soporte Hostinger

**Si no sabes qué comando usar:**
- Grep "el comando" en esta guía
- O pregunta a quien instaló Docker en Hostinger

---

# 🎉 ¡LISTO!

Una vez completado:

✅ Sitio visible en `https://tudominio.com`  
✅ Admin en `https://tudominio.com/wp-admin`  
✅ BD automáticamente bacupeada  
✅ Fácil de actualizar  
✅ Escalable para el futuro  

**¡Horizon Fit en producción!** 🚀

---

## Referencias:
- [Hostinger: How to deploy a container with Docker Manager](https://www.hostinger.com/support/12040815-how-to-deploy-your-first-container-with-hostinger-docker-manager/)
- [Hostinger: Docker VPS Templates](https://www.hostinger.com/vps/docker)
- [Hostinger: How to install WordPress with Docker](https://www.hostinger.com/tutorials/run-docker-wordpress)
- [Hostinger: Docker Manager Help](https://www.hostinger.com/support/vps/docker-manager/)
