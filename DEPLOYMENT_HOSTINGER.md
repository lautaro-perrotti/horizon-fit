# 🚀 DEPLOYMENT A HOSTINGER - GUÍA PARA TU AMIGO

Esta guía explica paso a paso cómo desplegar Horizon Fit a un VPS en Hostinger.

**Si no entiendes algo, lee dos veces. No es complicado, solo largo.**

---

## 📋 QUÉ NECESITAS ANTES DE EMPEZAR

- [ ] Acceso SSH a tu VPS Hostinger (usuario + contraseña o key)
- [ ] Acceso a panel Hostinger (para crear base de datos)
- [ ] Terminal (Windows: PowerShell, Mac/Linux: Terminal)
- [ ] Git instalado en tu máquina local
- [ ] Este proyecto en un repositorio GitHub/GitLab

---

## 🔑 PASO 0: PREPARAR EL REPOSITORIO

### En tu máquina (antes de que tu amigo haga nada):

**Crea un repo privado en GitHub** (si no lo tienes):

```bash
cd c:\Users\lsper\Local Sites\horizon-fit

# Inicializa git si no está
git init

# Agrega archivos importantes (EXCLUYENDO backend/wordpress)
git add index.html design-system/ assets/ TIPOGRAFIAS/ .htaccess docker-compose.yml docker/ start.* *.md STATUS.txt

# Crea .gitignore
cat > .gitignore << 'EOF'
backend/wordpress/wp-content/uploads/
backend/wordpress/wp-content/cache/
backend/wordpress/.htaccess
backend/wordpress/wp-config.php
node_modules/
.env
.DS_Store
*.log
EOF

git add .gitignore
git commit -m "Initial commit: Horizon Fit frontend + Docker config"
git remote add origin https://github.com/tuuser/horizon-fit.git
git branch -M main
git push -u origin main
```

**Ahora tu amigo tiene acceso al código.** ✅

---

## 🏗️ PASO 1: CONFIGURAR VPS EN HOSTINGER

### Tu amigo hace esto en el panel de Hostinger:

**1.1 Crear base de datos MySQL**

1. Ve a **Panel Hostinger** → **Bases de datos**
2. Click **+ Crear base de datos**
3. Completa:
   - **Nombre BD**: `horizon_fit_prod`
   - **Usuario BD**: `horizon_prod`
   - **Contraseña**: Algo fuerte (ej: `Ae#9xK@2mPq$Lv5W`)
   - **Carácter set**: `utf8mb4`
4. Click **Crear**

**Anota estos datos**, los necesitarás después.

---

**1.2 Habilitar SSH** (probablemente ya esté habilitado)

1. Ve a **Panel Hostinger** → **Acceso SSH**
2. Si no está habilitado, click **Habilitar**
3. Descarga la clave privada (si está disponible)
4. Anota el usuario SSH (ej: `u123456`)

---

## 💻 PASO 2: CONECTARSE POR SSH

### Tu amigo abre Terminal/PowerShell y hace:

**En Windows (PowerShell):**
```bash
# Si tienes clave privada
ssh -i "ruta\a\clave.pem" u123456@IP_O_DOMINIO

# Si usas contraseña (Hostinger te la proporciona)
ssh u123456@IP_O_DOMINIO
```

**En Mac/Linux:**
```bash
ssh -i ~/.ssh/clave.pem u123456@IP_O_DOMINIO
# O simplemente
ssh u123456@IP_O_DOMINIO
```

**Si pide contraseña, ingresa la que recibiste de Hostinger.**

Después de conectarse, deberías ver algo como:
```
u123456@vps-123456:~$
```

**Perfecto, estás dentro del VPS.** ✅

---

## 📥 PASO 3: DESCARGAR EL PROYECTO

Desde la terminal SSH:

```bash
# Ve a la carpeta home
cd ~

# Clona el repo
git clone https://github.com/tuuser/horizon-fit.git
cd horizon-fit

# Verifica que está todo
ls -la
# Deberías ver: index.html, design-system/, docker-compose.yml, etc
```

---

## ⚙️ PASO 4: CONFIGURAR docker-compose.yml PARA PRODUCCIÓN

**Tu amigo edita el archivo `docker-compose.yml`:**

Abre el archivo y cambia estos valores:

```bash
# Desde la terminal SSH
nano docker-compose.yml
```

Busca esta sección y CÁMBIALA:

```yaml
environment:
  WORDPRESS_DB_HOST: db:3306
  WORDPRESS_DB_NAME: horizon_fit_prod         # ← Cambiar a lo que creaste
  WORDPRESS_DB_USER: horizon_prod             # ← Cambiar
  WORDPRESS_DB_PASSWORD: Ae#9xK@2mPq$Lv5W    # ← Cambiar (la contraseña fuerte)
  WORDPRESS_TABLE_PREFIX: hf_
  WP_HOME: https://tudominio.com              # ← Tu dominio real
  WP_SITEURL: https://tudominio.com           # ← Tu dominio real
  WORDPRESS_DEBUG: 'false'
ports:
  - "80:80"                                    # ← Sin puerto específico
```

**Para salvar en nano:**
1. Presiona `Ctrl + X`
2. Presiona `Y` (yes)
3. Presiona `Enter`

---

## 🐳 PASO 5: INICIAR DOCKER

Desde la terminal SSH (en la carpeta `/root/horizon-fit` o donde lo clonaste):

```bash
# Sube todos los servicios
docker-compose up -d

# Verifica que están corriendo
docker-compose ps

# Deberías ver 3 contenedores: db, wordpress, phpmyadmin (todos "Up")
```

**Esto puede tardar 2-3 minutos la primera vez.**

Ver logs para verificar que todo está OK:
```bash
docker-compose logs wordpress | tail -20
# Busca algo como: "AH00094: Command line: 'apache2 -D FOREGROUND'"
```

---

## 🌐 PASO 6: APUNTAR DOMINIO

**Tu amigo hace esto en Hostinger:**

1. Ve a **Panel Hostinger** → **Dominios**
2. Selecciona tu dominio
3. Ve a **DNS**
4. Cambia los registros A para que apunten a la **IP de tu VPS**
5. Espera 24 horas (propagación DNS)

**O si el dominio está en otro registrador (NameCheap, GoDaddy, etc):**

1. Ve a tu registrador
2. Cambia los Name Servers a los de Hostinger
3. O crea registros A que apunten a la IP del VPS

**Mientras se propaga, puedes acceder por IP temporal:**
```
http://IP_VPS/
```

---

## ✅ PASO 7: VERIFICAR QUE ESTÁ CORRIENDO

**Tu amigo abre el navegador y accede a:**

```
http://IP_VPS        # Debería mostrar index.html
http://IP_VPS/wp-admin   # Panel de WordPress
```

Si ve `index.html` con tu diseño → **¡ÉXITO!** ✨

Si no carga, ver logs:
```bash
docker-compose logs wordpress
```

---

## 🔐 PASO 8: CONFIGURAR WORDPRESS INICIAL

**Tu amigo accede a** `http://IP_O_DOMINIO/wp-admin`

**Primera vez que accedes:**
- Usuario: `wordpress`
- Contraseña: La que esté en docker-compose.yml

Deberías ver un formulario de setup. Si no:

1. Ve a http://IP_O_DOMINIO/wp-admin
2. Si pide login, usa las credenciales
3. Ve a **WooCommerce** para verificar que está activo
4. Ve a **Plugins** y verifica que está activo `horizon-fit-commerce`

---

## 📦 PASO 9: IMPORTAR CATÁLOGO (OPCIONAL)

Si quieres tener productos de prueba:

1. Ve a **WooCommerce** → **Horizon Fit** → **Seeder de catálogo**
2. Click **Importar catálogo base**
3. Espera a que termine (1-2 minutos)

Ahora tendrás:
- 28 productos variables
- 7 categorías
- 5 colecciones

---

## 🔒 PASO 10: HABILITAR HTTPS (SSL)

**En Hostinger, generalmente está automático, pero verifica:**

1. Panel Hostinger → **SSL**
2. Si está deshabilitado, click **Activar**
3. Hostinger crea certificado automáticamente (Let's Encrypt, gratis)

Después:
- Accede a `https://tudominio.com` (con HTTPS)
- Apache redirige automáticamente HTTP → HTTPS

---

## 🗄️ PASO 11: BACKUPS AUTOMÁTICOS

**Tu amigo configura en Hostinger:**

1. Panel Hostinger → **Backups**
2. Click **Automático**
3. Elige frecuencia (diaria recomendado)

Ahora se bacupean automáticamente BD + archivos. ✅

---

## 📝 GUÍA RÁPIDA DE COMANDOS ÚTILES

Todos los comandos se ejecutan desde SSH en la carpeta del proyecto:

```bash
# Ver logs en tiempo real
docker-compose logs -f wordpress

# Detener servicios (sin borrar datos)
docker-compose down

# Volver a iniciar
docker-compose up -d

# Reiniciar WordPress
docker-compose restart wordpress

# Acceder a shell de WordPress
docker-compose exec wordpress bash

# Ver estado de contenedores
docker-compose ps

# Borrar TODO y empezar fresh (⚠️ BORRA DATOS)
docker-compose down -v
docker-compose up -d
```

---

## 🐛 TROUBLESHOOTING

### "Connection refused" en puerto 80
**Posible causa**: Docker aún está iniciando  
**Solución**: Espera 2-3 minutos, intenta de nuevo

### "port already in use"
**Posible causa**: Otro servicio usa puerto 80  
**Solución**:
```bash
sudo lsof -i :80
sudo kill -9 <PID>
docker-compose up -d
```

### WordPress muestra error de conexión BD
**Posible causa**: Credenciales incorrectas en docker-compose.yml  
**Solución**: Verifica que BD, usuario y contraseña coincidan con lo que creaste en Hostinger

### "No such file or directory: docker-compose.yml"
**Posible causa**: No estás en la carpeta correcta  
**Solución**: `cd ~/horizon-fit` (o donde clonaste el repo)

### index.html no carga, muestra admin de WordPress
**Posible causa**: Rewrite rules no están aplicadas correctamente  
**Solución**: Verifica que `.htaccess` está en la raíz del proyecto

### No puedo conectarme por SSH
**Posible causa**: Usuario/IP/contraseña incorrectos  
**Solución**: 
```bash
# Verifica que usas el usuario correcto de Hostinger
# Verifica que la contraseña es correcta (Hostinger la envía por email)
# Verifica que la IP es la del VPS (en panel Hostinger)

# Intenta con más verbosidad:
ssh -v u123456@IP
```

---

## ✨ DESPUÉS DE DEPLOYAR

**Tu amigo puede:**

1. **Editar frontend**:
   - Por SFTP (Hostinger proporciona acceso)
   - O hacer `git pull` en el VPS

2. **Editar backend**:
   - Ve a `https://tudominio.com/wp-admin`
   - Edita productos, precios, categorías como si fuera local

3. **Ver logs**:
   ```bash
   docker-compose logs wordpress
   ```

4. **Cambiar contraseña de WordPress**:
   ```bash
   docker-compose exec wordpress wp user list
   docker-compose exec wordpress wp user set-password admin newpassword
   ```

---

## 🎯 CHECKLIST FINAL

Después de completar todos los pasos, verifica:

- [ ] SSH conectado y funcionando
- [ ] docker-compose.yml actualizado con credenciales de Hostinger
- [ ] Docker levantado (`docker-compose up -d`)
- [ ] http://IP_VPS muestra index.html
- [ ] http://IP_VPS/wp-admin accesible
- [ ] Dominio apuntado (puede tardar 24h)
- [ ] HTTPS funcionando
- [ ] Backups automáticos configurados
- [ ] Catálogo importado (opcional)

---

## 📞 SI ALGO SALE MAL

**Tu amigo puede:**

1. Resetear todo:
   ```bash
   docker-compose down -v
   docker-compose up -d
   # Espera 2-3 min
   ```

2. Revisar logs:
   ```bash
   docker-compose logs wordpress | tail -50
   ```

3. Contactar soporte de Hostinger:
   - Dile que tiene un VPS con Docker
   - Que levantó wordpress:6.9.4-php8.2-apache
   - Que levantó mariadb:10.6
   - Que puertos 80, 3306 estén abiertos

---

## 🎉 ¡LISTO!

Una vez completado:

✅ Sitio visible en https://tudominio.com  
✅ Admin accesible en https://tudominio.com/wp-admin  
✅ Productos editables en WordPress  
✅ Frontend actualizable sin tocar backend  
✅ Backups automáticos  

**¡Horizon Fit está en producción!** 🚀

---

**Preguntas frecuentes:**

**P: ¿Necesito saber programación?**  
R: No. Solo SSH y seguir instrucciones.

**P: ¿Cuánto tarda el deployment?**  
R: 15-30 minutos la primera vez (DNS puede tardar 24h)

**P: ¿Puedo cambiar algo después?**  
R: Sí. Por SFTP o por SSH con git pull

**P: ¿Hostinger soporta Docker?**  
R: Sí, en planes VPS y superiores.

**P: ¿Qué pasa con los datos si reinicio?**  
R: Los datos en la BD persisten en volúmenes de Docker. No se pierden.

---

**¡Buena suerte! 🍀**
