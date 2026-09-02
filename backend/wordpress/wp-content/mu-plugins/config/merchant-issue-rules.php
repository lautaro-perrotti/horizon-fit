<?php
/**
 * Merchant auditor rules.
 *
 * severity: error | warning | info
 * blocks_merchant: true only when severity is error.
 *
 * These rules describe feed/schema quality. They do not change WooCommerce
 * products, prices, stock or checkout.
 */

return array(
    'missing_image' => array(
        'severity' => 'error',
        'blocks_merchant' => true,
        'label' => 'Falta imagen principal',
    ),
    'missing_price' => array(
        'severity' => 'error',
        'blocks_merchant' => true,
        'label' => 'Falta precio',
    ),
    'missing_color' => array(
        'severity' => 'error',
        'blocks_merchant' => true,
        'label' => 'Falta color en indumentaria',
    ),
    'missing_size' => array(
        'severity' => 'error',
        'blocks_merchant' => true,
        'label' => 'Variante de indumentaria sin talle',
    ),
    'missing_description' => array(
        'severity' => 'error',
        'blocks_merchant' => true,
        'label' => 'Falta descripción',
    ),
    'placeholder_name' => array(
        'severity' => 'error',
        'blocks_merchant' => true,
        'label' => 'Nombre placeholder, copia o de prueba',
    ),
    'placeholder_description' => array(
        'severity' => 'error',
        'blocks_merchant' => true,
        'label' => 'Descripción placeholder o de prueba',
    ),
    'invalid_gtin' => array(
        'severity' => 'error',
        'blocks_merchant' => true,
        'label' => 'GTIN presente pero inválido',
    ),
    'duplicate_sku' => array(
        'severity' => 'error',
        'blocks_merchant' => true,
        'label' => 'SKU duplicado',
    ),
    'duplicate_id' => array(
        'severity' => 'error',
        'blocks_merchant' => true,
        'label' => 'ID Merchant duplicado',
    ),
    'canonical_feed_url_mismatch' => array(
        'severity' => 'error',
        'blocks_merchant' => true,
        'label' => 'Canonical y URL del feed no coinciden',
    ),
    'schema_price_mismatch' => array(
        'severity' => 'error',
        'blocks_merchant' => true,
        'label' => 'Precio schema distinto al feed',
    ),
    'missing_item_group_id' => array(
        'severity' => 'error',
        'blocks_merchant' => true,
        'label' => 'Variante sin item_group_id',
    ),
    'incomplete_variant' => array(
        'severity' => 'error',
        'blocks_merchant' => true,
        'label' => 'Variante publicada sin datos mínimos Merchant',
    ),
    'missing_sku' => array(
        'severity' => 'warning',
        'blocks_merchant' => false,
        'label' => 'Falta SKU interno; se usa un ID estable',
    ),
    'fallback_item_group_id' => array(
        'severity' => 'info',
        'blocks_merchant' => false,
        'label' => 'item_group_id usa fallback estable HF-P{id}',
    ),
    'stock_not_managed' => array(
        'severity' => 'info',
        'blocks_merchant' => false,
        'label' => 'WooCommerce no administra cantidad; el status sí está informado',
    ),
    'incoherent_stock' => array(
        'severity' => 'warning',
        'blocks_merchant' => false,
        'label' => 'Status in stock con cantidad administrada en 0',
    ),
    'inherited_image' => array(
        'severity' => 'warning',
        'blocks_merchant' => false,
        'label' => 'La variante hereda la imagen del padre',
    ),
    'weak_description' => array(
        'severity' => 'warning',
        'blocks_merchant' => false,
        'label' => 'Descripción corta',
    ),
    'color_name_mismatch' => array(
        'severity' => 'warning',
        'blocks_merchant' => false,
        'label' => 'Color del nombre no coincide con el atributo',
    ),
    'unmapped_google_category' => array(
        'severity' => 'warning',
        'blocks_merchant' => false,
        'label' => 'Sin google_product_category confirmado',
    ),
    'shared_item_group_id' => array(
        'severity' => 'warning',
        'blocks_merchant' => false,
        'label' => 'item_group_id compartido por más de un padre',
    ),
    'schema_sku_mismatch' => array(
        'severity' => 'warning',
        'blocks_merchant' => false,
        'label' => 'SKU schema distinto al ID Merchant',
    ),
    'schema_availability_mismatch' => array(
        'severity' => 'warning',
        'blocks_merchant' => false,
        'label' => 'Disponibilidad schema distinta a Merchant',
    ),
    'schema_color_mismatch' => array(
        'severity' => 'warning',
        'blocks_merchant' => false,
        'label' => 'Color schema distinto a Merchant',
    ),
    'schema_size_mismatch' => array(
        'severity' => 'warning',
        'blocks_merchant' => false,
        'label' => 'Talle schema distinto a Merchant',
    ),
    'schema_item_group_id_mismatch' => array(
        'severity' => 'warning',
        'blocks_merchant' => false,
        'label' => 'ProductGroupID distinto a item_group_id',
    ),
    'schema_product_missing' => array(
        'severity' => 'info',
        'blocks_merchant' => false,
        'label' => 'No hay Product/ProductGroup prerender',
    ),
    'search_html_missing' => array(
        'severity' => 'info',
        'blocks_merchant' => false,
        'label' => 'No hay HTML prerender para comparar',
    ),
    'missing_shipping' => array(
        'severity' => 'info',
        'blocks_merchant' => false,
        'label' => 'El feed no inventa shipping; falta costo/plazo confirmado',
    ),
    'missing_return_policy' => array(
        'severity' => 'info',
        'blocks_merchant' => false,
        'label' => 'El feed no inventa return_policy de Merchant Center',
    ),
    'identifier_exists_false' => array(
        'severity' => 'info',
        'blocks_merchant' => false,
        'label' => 'identifier_exists=no sólo si faltan GTIN, MPN y brand',
    ),
);
