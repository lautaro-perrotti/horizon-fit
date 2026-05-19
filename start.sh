#!/bin/bash

echo "🚀 Iniciando Horizon Fit..."
echo ""
echo "📦 Levantando contenedores Docker..."
docker-compose up -d

echo ""
echo "⏳ Esperando que WordPress esté listo..."
sleep 10

echo ""
echo "✅ Servicios iniciados:"
echo "   - WordPress Admin: http://localhost:8088/wp-admin"
echo "   - Storefront: http://localhost:8088/"
echo "   - WooCommerce API: http://localhost:8088/wp-json/wc/v3"
echo "   - PhpMyAdmin: http://localhost:8089"
echo ""
echo "📝 Base de datos:"
echo "   - Host: localhost:3308"
echo "   - Usuario: horizon_fit"
echo "   - Contraseña: horizon_fit"
echo "   - DB: horizon_fit"
echo ""
echo "💡 Para ver logs: docker-compose logs -f wordpress"
echo "🛑 Para detener: docker-compose down"
