<?php

define('ABSPATH', __DIR__ . '/');
define('HF_COMMERCE_DIR', __DIR__ . '/../backend/wordpress/wp-content/plugins/horizon-fit-commerce/');

function add_action() { return true; }
function add_filter() { return true; }
function sanitize_text_field($value) { return trim(strip_tags((string) $value)); }

require_once HF_COMMERCE_DIR . 'includes/product-size-table-fields.php';
require_once HF_COMMERCE_DIR . 'includes/product-catalog-operational-data.php';

function hf_catalog_operational_assert($condition, $message) {
    if (!$condition) {
        fwrite(STDERR, "FAIL: {$message}\n");
        exit(1);
    }
}

$raw = json_decode((string) file_get_contents(hf_catalog_operational_data_path()), true);
hf_catalog_operational_assert(is_array($raw), 'El JSON debe ser válido.');
hf_catalog_operational_assert(count($raw['stock']) === 156, 'Debe conservar los 156 SKU del Excel recibido.');
hf_catalog_operational_assert(array_sum(array_column($raw['stock'], 'quantity')) === 1018, 'El total debe ser 1.018 unidades.');
hf_catalog_operational_assert(count(array_filter($raw['stock'], static function ($row) { return (int) $row['quantity'] === 0; })) === 7, 'Debe haber siete SKU sin stock.');
hf_catalog_operational_assert(count($raw['size_tables']) === 15, 'Deben existir las quince tablas por colección y tipo de prenda.');
hf_catalog_operational_assert(hf_catalog_operational_size_key_from_sku('005-SHO-NEG-L') === '005-SHO', 'Debe derivar la tabla desde el SKU.');
hf_catalog_operational_assert(hf_catalog_operational_size_key_from_sku('sku-invalido') === '', 'Debe rechazar un SKU inválido.');

$skus = array_column($raw['stock'], 'sku');
hf_catalog_operational_assert(count($skus) === count(array_unique($skus)), 'No debe haber SKU duplicados.');

$catalog = json_decode((string) file_get_contents(__DIR__ . '/fixtures/production-catalog-summary.json'), true);
$catalog_skus = array();
foreach ($catalog['items'] as $product) {
    foreach ($product['variations'] as $variation) {
        $catalog_skus[] = $variation['sku'];
    }
}
$extra_skus = array_values(array_diff($skus, $catalog_skus));
sort($extra_skus);
hf_catalog_operational_assert(count($catalog_skus) === 153, 'El catálogo de producción debe contener 153 variantes actuales.');
hf_catalog_operational_assert($extra_skus === array('005-SHO-NEG-L', '005-SHO-NEG-M', '005-SHO-NEG-S'), 'Solo Short Destiny negro puede quedar pendiente de crear.');

echo "OK catalog operational data: stock y tablas validados\n";
