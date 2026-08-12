#!/bin/sh
set -eu

# index.html cambia de inode cuando Git actualiza el repositorio. El enlace
# apunta al path dentro del bind mount de directorio y siempre resuelve la
# versión actual, sin recrear el contenedor en cada deploy.
rm -f /usr/local/apache2/htdocs/index.html
ln -s /workspace/index.html /usr/local/apache2/htdocs/index.html

exec httpd-foreground
